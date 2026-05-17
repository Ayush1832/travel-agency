import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';
import { Payment, PaymentStatus, PaymentType } from '../../db/schemas/payment.schema';
import { PaymentsService } from './payments.service';
import { PaytabsService } from '../integrations/paytabs/paytabs.service';
import { CompaniesService } from '../companies/companies.service';

const mockCompanyId = new Types.ObjectId();
const mockUserId = new Types.ObjectId();
const mockAuthUser = {
  _id: mockUserId.toString(),
  companyId: mockCompanyId.toString(),
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  role: 'client_owner',
};

function makePaymentDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: new Types.ObjectId(),
    companyId: mockCompanyId,
    userId: mockUserId,
    type: PaymentType.WALLET_TOPUP,
    gateway: 'paytabs',
    gatewayOrderId: 'ORD-TEST123',
    amount: 50000,
    currency: 'AED',
    status: PaymentStatus.CREATED,
    webhookEvents: [],
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('PaymentsService', () => {
  let service: PaymentsService;
  let paymentModel: jest.Mocked<any>;
  let paytabsService: jest.Mocked<Partial<PaytabsService>>;
  let companiesService: jest.Mocked<Partial<CompaniesService>>;

  beforeEach(async () => {
    paymentModel = {
      findById: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      countDocuments: jest.fn(),
    };

    // Mock constructor (for `new this.paymentModel({...})`)
    const MockPaymentModel = jest.fn().mockImplementation((data: unknown) => ({
      ...makePaymentDoc(),
      ...(data as object),
      save: jest.fn().mockResolvedValue(undefined),
      _id: new Types.ObjectId(),
    }));
    Object.assign(MockPaymentModel, paymentModel);

    paytabsService = {
      createOrder: jest.fn().mockResolvedValue({
        orderId: 'ORD-TEST123',
        paymentUrl: 'https://payment.example.com/pay',
        expiresAt: new Date(Date.now() + 3600000),
      }),
      verifyPayment: jest.fn(),
      verifyWebhookSignature: jest.fn().mockReturnValue(true),
      isWebhookSuccess: jest.fn(),
      processRefund: jest.fn(),
    };

    companiesService = {
      findById: jest.fn().mockResolvedValue({ _id: mockCompanyId, name: 'Test Company' }),
      topUpWallet: jest.fn().mockResolvedValue(undefined),
      deductCredit: jest.fn().mockResolvedValue(undefined),
    };

    const module = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: getModelToken(Payment.name), useValue: MockPaymentModel },
        { provide: PaytabsService, useValue: paytabsService },
        { provide: CompaniesService, useValue: companiesService },
      ],
    }).compile();

    service = module.get(PaymentsService);
  });

  // ── createOrder ───────────────────────────────────────────────────────────────

  describe('createOrder', () => {
    const dto = {
      type: PaymentType.WALLET_TOPUP as PaymentType.WALLET_TOPUP,
      amount: 50000,
      currency: 'AED' as const,
      callbackUrl: 'https://example.com/callback',
    };

    it('returns paymentId and paymentUrl', async () => {
      const result = await service.createOrder(dto, mockAuthUser as any);
      expect(result).toMatchObject({
        paymentId: expect.any(String),
        paymentUrl: 'https://payment.example.com/pay',
      });
    });

    it('throws if user has no companyId', async () => {
      await expect(service.createOrder(dto, { ...mockAuthUser, companyId: null } as any)).rejects.toThrow(BadRequestException);
    });

    it('marks payment FAILED if gateway throws', async () => {
      (paytabsService.createOrder as jest.Mock).mockRejectedValue(new Error('Gateway error'));
      await expect(service.createOrder(dto, mockAuthUser as any)).rejects.toThrow();
    });
  });

  // ── handleWebhook ─────────────────────────────────────────────────────────────

  describe('handleWebhook', () => {
    const makePayload = (cartId: string) => ({ cart_id: cartId, tran_ref: 'TR-ABC', tran_total: 500 });

    it('rejects unknown gateways', async () => {
      await expect(service.handleWebhook('stripe', {}, '', '')).rejects.toThrow(BadRequestException);
    });

    it('rejects invalid signatures', async () => {
      (paytabsService.verifyWebhookSignature as jest.Mock).mockReturnValue(false);
      await expect(service.handleWebhook('paytabs', makePayload('ORD-1'), '', 'bad-sig')).rejects.toThrow(BadRequestException);
    });

    it('returns received:true when no matching payment found', async () => {
      paymentModel.findOne.mockResolvedValue(null);
      const result = await service.handleWebhook('paytabs', makePayload('UNKNOWN'), '', 'sig');
      expect(result).toMatchObject({ received: true });
    });

    it('processes successful webhook and tops up wallet', async () => {
      const paymentDoc = makePaymentDoc({ type: PaymentType.WALLET_TOPUP, status: PaymentStatus.PENDING });
      paymentModel.findOne.mockResolvedValue(paymentDoc);
      (paytabsService.isWebhookSuccess as jest.Mock).mockReturnValue(true);

      await service.handleWebhook('paytabs', makePayload('ORD-TEST123'), '', 'sig');

      expect(paymentDoc.save).toHaveBeenCalled();
      expect(paymentDoc.status).toBe(PaymentStatus.SUCCESS);
      expect(companiesService.topUpWallet).toHaveBeenCalledWith(mockCompanyId.toString(), 50000);
    });

    it('marks payment FAILED on failed webhook', async () => {
      const paymentDoc = makePaymentDoc({ status: PaymentStatus.PENDING });
      paymentModel.findOne.mockResolvedValue(paymentDoc);
      (paytabsService.isWebhookSuccess as jest.Mock).mockReturnValue(false);

      await service.handleWebhook('paytabs', makePayload('ORD-TEST123'), '', 'sig');
      expect(paymentDoc.status).toBe(PaymentStatus.FAILED);
    });

    it('is idempotent — does not reprocess already-succeeded payments', async () => {
      const paymentDoc = makePaymentDoc({ status: PaymentStatus.SUCCESS });
      paymentModel.findOne.mockResolvedValue(paymentDoc);

      const result = await service.handleWebhook('paytabs', makePayload('ORD-TEST123'), '', 'sig');
      expect(result).toMatchObject({ received: true, alreadyProcessed: true });
      expect(companiesService.topUpWallet).not.toHaveBeenCalled();
    });

    it('always appends webhook event to audit trail', async () => {
      const paymentDoc = makePaymentDoc({ status: PaymentStatus.PENDING, webhookEvents: [] });
      paymentModel.findOne.mockResolvedValue(paymentDoc);
      (paytabsService.isWebhookSuccess as jest.Mock).mockReturnValue(false);

      await service.handleWebhook('paytabs', makePayload('ORD-TEST123'), '', 'sig');
      expect(paymentDoc.webhookEvents).toHaveLength(1);
    });
  });

  // ── verifyPayment ─────────────────────────────────────────────────────────────

  describe('verifyPayment', () => {
    it('throws NotFoundException for unknown order', async () => {
      paymentModel.findOne.mockResolvedValue(null);
      await expect(service.verifyPayment('UNKNOWN-ORD', mockUserId.toString())).rejects.toThrow(NotFoundException);
    });

    it('returns early with SUCCESS status when payment already succeeded (idempotent)', async () => {
      const paymentDoc = makePaymentDoc({ status: PaymentStatus.SUCCESS });
      paymentModel.findOne.mockResolvedValue(paymentDoc);
      const result = await service.verifyPayment('ORD-TEST123', mockUserId.toString());
      expect(result.status).toBe(PaymentStatus.SUCCESS);
      expect(paytabsService.verifyPayment).not.toHaveBeenCalled();
    });

    it('marks payment SUCCESS and tops up wallet when verification succeeds', async () => {
      const paymentDoc = makePaymentDoc({ status: PaymentStatus.PENDING, type: PaymentType.WALLET_TOPUP });
      paymentModel.findOne.mockResolvedValue(paymentDoc);
      (paytabsService.verifyPayment as jest.Mock).mockResolvedValue({
        success: true,
        gatewayPaymentId: 'TRN-ABC',
        rawResponse: {},
      });

      const result = await service.verifyPayment('ORD-TEST123', mockUserId.toString());
      expect(result.status).toBe(PaymentStatus.SUCCESS);
      expect(paymentDoc.save).toHaveBeenCalled();
      expect(companiesService.topUpWallet).toHaveBeenCalledWith(mockCompanyId.toString(), 50000);
    });

    it('marks payment FAILED when verification returns failure', async () => {
      const paymentDoc = makePaymentDoc({ status: PaymentStatus.PENDING });
      paymentModel.findOne.mockResolvedValue(paymentDoc);
      (paytabsService.verifyPayment as jest.Mock).mockResolvedValue({ success: false, rawResponse: {} });

      const result = await service.verifyPayment('ORD-TEST123', mockUserId.toString());
      expect(result.status).toBe(PaymentStatus.FAILED);
      expect(paymentDoc.save).toHaveBeenCalled();
    });
  });

  // ── getHistory ────────────────────────────────────────────────────────────────

  describe('getHistory', () => {
    it('returns paginated payment history', async () => {
      const mockPayments = [makePaymentDoc(), makePaymentDoc()];
      paymentModel.find.mockReturnValue({ sort: () => ({ skip: () => ({ limit: () => ({ lean: () => Promise.resolve(mockPayments) }) }) }) });
      paymentModel.countDocuments.mockResolvedValue(2);

      const result = await service.getHistory(mockCompanyId.toString(), 1, 10);
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });

    it('returns empty list when no payments exist', async () => {
      paymentModel.find.mockReturnValue({ sort: () => ({ skip: () => ({ limit: () => ({ lean: () => Promise.resolve([]) }) }) }) });
      paymentModel.countDocuments.mockResolvedValue(0);

      const result = await service.getHistory(mockCompanyId.toString());
      expect(result.total).toBe(0);
      expect(result.data).toHaveLength(0);
    });
  });

  // ── findById ──────────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('returns payment document when found', async () => {
      const paymentDoc = makePaymentDoc();
      paymentModel.findById.mockResolvedValue(paymentDoc);
      const result = await service.findById(paymentDoc._id.toString());
      expect(result).toBe(paymentDoc);
    });

    it('throws NotFoundException for unknown id', async () => {
      paymentModel.findById.mockResolvedValue(null);
      await expect(service.findById(new Types.ObjectId().toString())).rejects.toThrow(NotFoundException);
    });
  });

  // ── processRefund ─────────────────────────────────────────────────────────────

  describe('processRefund', () => {
    it('throws NotFoundException for unknown payment', async () => {
      paymentModel.findById.mockResolvedValue(null);
      await expect(service.processRefund('bad-id', 1000)).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException if payment is not successful', async () => {
      paymentModel.findById.mockResolvedValue(makePaymentDoc({ status: PaymentStatus.PENDING }));
      await expect(service.processRefund('some-id', 1000)).rejects.toThrow(BadRequestException);
    });

    it('calls PayTabs and marks payment REFUNDED', async () => {
      const paymentDoc = makePaymentDoc({ status: PaymentStatus.SUCCESS, gatewayOrderId: 'ORD-1' });
      paymentModel.findById.mockResolvedValue(paymentDoc);
      (paytabsService.processRefund as jest.Mock).mockResolvedValue({ success: true });

      await service.processRefund(paymentDoc._id.toString(), 50000);
      expect(paymentDoc.status).toBe(PaymentStatus.REFUNDED);
      expect(paymentDoc.save).toHaveBeenCalled();
    });
  });
});
