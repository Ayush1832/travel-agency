import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import {
  Payment,
  PaymentDocument,
  PaymentStatus,
  PaymentType,
  PaymentGateway,
  PaymentCurrency,
} from '../../db/schemas/payment.schema';
import { PaytabsService } from '../integrations/paytabs/paytabs.service';
import { CompaniesService } from '../companies/companies.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { PayTabsWebhookPayload } from '../integrations/paytabs/paytabs.types';
import { AuthUser } from '../../common/types/auth-user.types';

export type { AuthUser };

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    private readonly paytabsService: PaytabsService,
    private readonly companiesService: CompaniesService,
  ) {}

  /**
   * Create a new payment order.
   * 1. Create Payment doc (status=created)
   * 2. Call PayTabs to get a payment URL
   * 3. Update Payment with gatewayOrderId
   * Returns { paymentId, paymentUrl }
   */
  async createOrder(dto: CreateOrderDto, user: AuthUser) {
    if (!user.companyId) {
      throw new BadRequestException('User does not belong to a company');
    }

    const company = await this.companiesService.findById(user.companyId);

    // Generate a unique internal order ID (used as cart_id in PayTabs)
    const internalOrderId = `ORD-${uuidv4().replace(/-/g, '').toUpperCase().slice(0, 16)}`;

    // Build initial Payment document
    const payment = new this.paymentModel({
      companyId: new Types.ObjectId(user.companyId),
      userId: new Types.ObjectId(user._id),
      type: dto.type,
      bookingId: dto.bookingId ? new Types.ObjectId(dto.bookingId) : undefined,
      gateway: PaymentGateway.PAYTABS,
      amount: dto.amount,
      currency: dto.currency as PaymentCurrency,
      status: PaymentStatus.CREATED,
    });

    await payment.save();

    try {
      const result = await this.paytabsService.createOrder({
        amount: dto.amount,
        currency: dto.currency,
        orderId: internalOrderId,
        callbackUrl: dto.callbackUrl,
        customerEmail: user.email,
        customerName: `${user.firstName} ${user.lastName}`,
        description:
          dto.type === PaymentType.WALLET_TOPUP
            ? `Wallet top-up for ${company.name}`
            : `Booking payment for ${company.name}`,
      });

      // Update Payment with gateway data
      payment.gatewayOrderId = result.orderId;
      payment.status = PaymentStatus.PENDING;
      await payment.save();

      return {
        paymentId: (payment._id as Types.ObjectId).toString(),
        paymentUrl: result.paymentUrl,
        expiresAt: result.expiresAt,
      };
    } catch (err) {
      // Mark payment as failed if gateway call fails
      payment.status = PaymentStatus.FAILED;
      await payment.save();
      throw err;
    }
  }

  /**
   * Verify payment status by querying PayTabs.
   * Updates Payment document and triggers downstream effects if successful.
   */
  async verifyPayment(orderId: string, userId: string) {
    const payment = await this.paymentModel.findOne({ gatewayOrderId: orderId });
    if (!payment) throw new NotFoundException('Payment not found');

    // Already processed — idempotency
    if (payment.status === PaymentStatus.SUCCESS) {
      return { status: payment.status, payment };
    }

    const result = await this.paytabsService.verifyPayment(orderId);

    if (result.success) {
      payment.status = PaymentStatus.SUCCESS;
      payment.gatewayPaymentId = result.gatewayPaymentId;
      payment.paidAt = new Date();
      payment.raw = result.rawResponse;
      await payment.save();

      await this.handlePostPaymentSuccess(payment);
    } else {
      payment.status = PaymentStatus.FAILED;
      payment.raw = result.rawResponse;
      await payment.save();
    }

    return { status: payment.status, payment };
  }

  /**
   * Handle incoming webhook/IPN from PayTabs.
   * IDEMPOTENT: checks payment status before processing.
   */
  async handleWebhook(
    gateway: string,
    payload: unknown,
    rawBody: string,
    signature: string,
  ) {
    if (gateway !== 'paytabs') {
      throw new BadRequestException(`Unsupported gateway: ${gateway}`);
    }

    // Verify signature
    const isValid = this.paytabsService.verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      this.logger.warn('PayTabs webhook signature verification failed');
      throw new BadRequestException('Invalid webhook signature');
    }

    const webhookPayload = payload as PayTabsWebhookPayload;
    const orderId = webhookPayload.cart_id;

    if (!orderId) {
      this.logger.warn('PayTabs webhook missing cart_id');
      return { received: true };
    }

    const payment = await this.paymentModel.findOne({ gatewayOrderId: orderId });
    if (!payment) {
      this.logger.warn(`PayTabs webhook: payment not found for orderId=${orderId}`);
      return { received: true };
    }

    // Append webhook event for audit trail (always)
    payment.webhookEvents.push({
      ...(payload as Record<string, unknown>),
      _receivedAt: new Date().toISOString(),
    });

    // Idempotency — don't reprocess if already succeeded
    if (payment.status === PaymentStatus.SUCCESS) {
      await payment.save();
      return { received: true, alreadyProcessed: true };
    }

    const isSuccess = this.paytabsService.isWebhookSuccess(webhookPayload);

    if (isSuccess) {
      payment.status = PaymentStatus.SUCCESS;
      payment.gatewayPaymentId = webhookPayload.tran_ref;
      payment.paidAt = new Date();
      payment.raw = payload as Record<string, unknown>;
      await payment.save();

      try {
        await this.handlePostPaymentSuccess(payment);
      } catch (err) {
        this.logger.error('Post-payment success handler failed', err);
        // Don't re-throw — webhook must return 200 to PayTabs
      }
    } else {
      payment.status = PaymentStatus.FAILED;
      payment.raw = payload as Record<string, unknown>;
      await payment.save();
    }

    return { received: true };
  }

  /**
   * Downstream effects after a payment is confirmed successful.
   * - wallet_topup → topUp company wallet
   * - booking_online → (booking confirmation handled by booking module)
   */
  private async handlePostPaymentSuccess(payment: PaymentDocument) {
    if (payment.type === PaymentType.WALLET_TOPUP) {
      await this.companiesService.topUpWallet(
        payment.companyId.toString(),
        payment.amount,
      );
      this.logger.log(
        `Wallet topped up: companyId=${payment.companyId}, amount=${payment.amount}`,
      );
    }
    // For booking_online, the booking module listens or can call verifyPayment
    // and check payment.type to trigger booking confirmation.
  }

  /**
   * Process a refund via PayTabs.
   */
  async processRefund(paymentId: string, amount: number, reason = 'Customer refund') {
    const payment = await this.paymentModel.findById(paymentId);
    if (!payment) throw new NotFoundException('Payment not found');

    if (payment.status !== PaymentStatus.SUCCESS) {
      throw new BadRequestException('Only successful payments can be refunded');
    }

    if (!payment.gatewayOrderId) {
      throw new BadRequestException('Payment has no gateway order ID');
    }

    const result = await this.paytabsService.processRefund({
      orderId: payment.gatewayPaymentId || payment.gatewayOrderId,
      amount,
      reason,
    });

    payment.status = PaymentStatus.REFUNDED;
    payment.refundReason = reason;
    payment.refundedAt = new Date();
    await payment.save();

    // If it was a wallet topup refund, deduct from wallet
    if (payment.type === PaymentType.WALLET_TOPUP) {
      await this.companiesService.deductCredit(payment.companyId.toString(), amount);
    }

    return result;
  }

  /**
   * Paginated payment history for a company.
   */
  async getHistory(companyId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const filter = { companyId: new Types.ObjectId(companyId) };

    const [data, total] = await Promise.all([
      this.paymentModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.paymentModel.countDocuments(filter),
    ]);

    return { data, total, page, limit };
  }

  /**
   * Find payment by internal DB id.
   */
  async findById(paymentId: string): Promise<PaymentDocument> {
    const payment = await this.paymentModel.findById(paymentId);
    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
  }
}
