import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';
import {
  IPaymentGateway,
  CreateOrderResult,
  VerifyPaymentResult,
  RefundResult,
} from '../payment-gateway.interface';
import {
  PayTabsCreateOrderRequest,
  PayTabsCreateOrderResponse,
  PayTabsQueryRequest,
  PayTabsQueryResponse,
  PayTabsRefundRequest,
  PayTabsRefundResponse,
  PayTabsWebhookPayload,
} from './paytabs.types';

/**
 * Region → base URL mapping per PayTabs documentation.
 * https://support.paytabs.com/en/support/solutions/articles/60000718070
 */
const REGION_ENDPOINTS: Record<string, string> = {
  ARE: 'https://secure.paytabs.com',
  SAU: 'https://secure.paytabs.sa',
  OMN: 'https://secure-oman.paytabs.com',
  JOR: 'https://secure-jordan.paytabs.com',
  EGY: 'https://secure-egypt.paytabs.com',
  GLOBAL: 'https://secure-global.paytabs.com',
};

@Injectable()
export class PaytabsService implements IPaymentGateway {
  private readonly logger = new Logger(PaytabsService.name);
  private readonly client: AxiosInstance;
  private readonly profileId: number;
  private readonly serverKey: string;
  private readonly sandbox: boolean;

  constructor(private readonly config: ConfigService) {
    const region = this.config.get<string>('paytabs.region') ?? 'ARE';
    const serverKey = this.config.get<string>('paytabs.serverKey');
    const profileId = this.config.get<number>('paytabs.profileId');
    this.sandbox = this.config.get<boolean>('paytabs.sandbox') ?? false;

    if (!serverKey) {
      this.logger.warn('PAYTABS_SERVER_KEY is not configured — payment gateway will be unavailable');
    }
    if (!profileId) {
      this.logger.warn('PAYTABS_PROFILE_ID is not configured — payment gateway will be unavailable');
    }

    this.serverKey = serverKey ?? '';
    this.profileId = Number(profileId ?? 0);

    const baseURL =
      this.sandbox
        ? 'https://secure-global.paytabs.com'
        : (REGION_ENDPOINTS[region] ?? REGION_ENDPOINTS['ARE']);

    this.client = axios.create({
      baseURL,
      headers: {
        Authorization: serverKey,
        'Content-Type': 'application/json',
      },
      timeout: 30_000,
    });
  }

  /**
   * Convert minor units (fils/cents) to decimal for PayTabs.
   * AED: fils → AED (÷100), USD: cents → USD (÷100)
   */
  private toDecimal(amountMinor: number): number {
    return amountMinor / 100;
  }

  /**
   * Convert decimal (PayTabs) back to minor units.
   */
  private toMinor(amountDecimal: number): number {
    return Math.round(amountDecimal * 100);
  }

  async createOrder(params: {
    amount: number;
    currency: string;
    orderId: string;
    callbackUrl: string;
    customerEmail: string;
    customerName: string;
    description: string;
  }): Promise<CreateOrderResult> {
    const body: PayTabsCreateOrderRequest = {
      profile_id: this.profileId,
      tran_type: 'sale',
      tran_class: 'ecom',
      cart_id: params.orderId,
      cart_description: params.description,
      cart_currency: params.currency,
      cart_amount: this.toDecimal(params.amount),
      return: params.callbackUrl,
      callback: params.callbackUrl,
      hide_shipping: true,
      customer_details: {
        name: params.customerName,
        email: params.customerEmail,
      },
    };

    try {
      const { data } = await this.client.post<PayTabsCreateOrderResponse>(
        '/payment/request',
        body,
      );

      if (!data.redirect_url && !data.payment_url) {
        this.logger.error('PayTabs createOrder failed', data);
        throw new InternalServerErrorException(
          `Payment gateway error: ${data.response_message ?? data.message ?? 'Unknown error'}`,
        );
      }

      // Payment URL expires in 2 hours (PayTabs default)
      const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);

      return {
        orderId: params.orderId,
        paymentUrl: (data.redirect_url ?? data.payment_url) as string,
        expiresAt,
      };
    } catch (err) {
      if (axios.isAxiosError(err)) {
        this.logger.error('PayTabs createOrder axios error', err.response?.data);
        throw new InternalServerErrorException(
          `Payment gateway error: ${err.response?.data?.response_message ?? err.message}`,
        );
      }
      throw err;
    }
  }

  async verifyPayment(orderId: string): Promise<VerifyPaymentResult> {
    const body: PayTabsQueryRequest = {
      profile_id: this.profileId,
      tran_ref: orderId,
    };

    try {
      const { data } = await this.client.post<PayTabsQueryResponse>(
        '/payment/query',
        body,
      );

      const responseStatus = data.payment_result?.response_status ?? '';
      // PayTabs: "A" = Authorised/Approved
      const success = responseStatus === 'A';

      return {
        success,
        amount: this.toMinor(data.cart_amount ?? 0),
        currency: data.cart_currency ?? '',
        gatewayPaymentId: data.tran_ref ?? orderId,
        rawResponse: data as unknown as Record<string, unknown>,
      };
    } catch (err) {
      if (axios.isAxiosError(err)) {
        this.logger.error('PayTabs verifyPayment axios error', err.response?.data);
        throw new InternalServerErrorException(
          `Payment gateway error: ${err.response?.data?.response_message ?? err.message}`,
        );
      }
      throw err;
    }
  }

  async processRefund(params: {
    orderId: string;
    amount: number;
    reason: string;
  }): Promise<RefundResult> {
    // Refund cart_id must be unique; we suffix the original orderId with -refund-<ts>
    const refundCartId = `${params.orderId}-refund-${Date.now()}`;

    const body: PayTabsRefundRequest = {
      profile_id: this.profileId,
      tran_type: 'refund',
      tran_class: 'ecom',
      cart_id: refundCartId,
      cart_description: params.reason,
      cart_currency: 'AED', // Will be overridden by tran_ref currency in PayTabs
      cart_amount: this.toDecimal(params.amount),
      tran_ref: params.orderId,
    };

    try {
      const { data } = await this.client.post<PayTabsRefundResponse>(
        '/payment/request',
        body,
      );

      const responseStatus = data.payment_result?.response_status ?? '';
      const success = responseStatus === 'A';

      if (!success) {
        this.logger.warn('PayTabs refund did not return success status', data);
        throw new InternalServerErrorException(
          `Refund failed: ${data.payment_result?.response_message ?? data.response_message ?? 'Unknown error'}`,
        );
      }

      return {
        success,
        refundId: data.tran_ref ?? refundCartId,
        refundedAmount: params.amount,
      };
    } catch (err) {
      if (axios.isAxiosError(err)) {
        this.logger.error('PayTabs processRefund axios error', err.response?.data);
        throw new InternalServerErrorException(
          `Refund gateway error: ${err.response?.data?.response_message ?? err.message}`,
        );
      }
      throw err;
    }
  }

  /**
   * Verify PayTabs webhook/IPN signature.
   * PayTabs signs the IPN payload using HMAC-SHA256 with the server key.
   * The signature is passed as a query param or in the payload body as "signature".
   * We compute HMAC-SHA256(rawBody, serverKey) in hex and compare.
   */
  verifyWebhookSignature(payload: unknown, signature: string): boolean {
    try {
      const rawBody =
        typeof payload === 'string' ? payload : JSON.stringify(payload);

      const computed = crypto
        .createHmac('sha256', this.serverKey)
        .update(rawBody, 'utf8')
        .digest('hex');

      // Constant-time comparison to prevent timing attacks
      if (computed.length !== signature.length) return false;
      return crypto.timingSafeEqual(
        Buffer.from(computed, 'utf8'),
        Buffer.from(signature, 'utf8'),
      );
    } catch {
      return false;
    }
  }

  /**
   * Extract cart_id (our orderId) from a PayTabs webhook payload.
   */
  extractOrderId(payload: PayTabsWebhookPayload): string {
    return payload.cart_id;
  }

  /**
   * Check if a PayTabs webhook payload indicates a successful payment.
   */
  isWebhookSuccess(payload: PayTabsWebhookPayload): boolean {
    return payload.payment_result?.response_status === 'A';
  }
}
