import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PaytabsService } from './paytabs.service';

const mockAxiosInstance = { post: jest.fn() };

jest.mock('axios', () => ({
  create: jest.fn(() => mockAxiosInstance),
  isAxiosError: jest.fn().mockReturnValue(false),
  default: { create: jest.fn(() => mockAxiosInstance), isAxiosError: jest.fn().mockReturnValue(false) },
}));

const mockConfig = { get: jest.fn() };
mockConfig.get.mockImplementation((key: string) => {
  const map: Record<string, unknown> = {
    'paytabs.serverKey': 'test-server-key',
    'paytabs.profileId': 12345,
    'paytabs.region': 'ARE',
    'paytabs.sandbox': false,
  };
  return map[key];
});

describe('PaytabsService', () => {
  let service: PaytabsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaytabsService,
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<PaytabsService>(PaytabsService);
  });

  describe('createOrder', () => {
    it('returns the orderId and paymentUrl on success', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: { redirect_url: 'https://secure.paytabs.com/pay/page123', tran_ref: 'TST123' },
      });

      const result = await service.createOrder({
        amount: 100000,
        currency: 'AED',
        orderId: 'ORD-TEST-001',
        callbackUrl: 'https://example.com/callback',
        customerEmail: 'user@example.com',
        customerName: 'Test User',
        description: 'Wallet top-up',
      });

      expect(result.orderId).toBe('ORD-TEST-001');
      expect(result.paymentUrl).toBe('https://secure.paytabs.com/pay/page123');
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it('throws when PayTabs returns no redirect_url', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: { response_message: 'Profile not found' },
      });

      await expect(
        service.createOrder({
          amount: 100,
          currency: 'AED',
          orderId: 'ORD-002',
          callbackUrl: 'https://cb.example.com',
          customerEmail: 'user@example.com',
          customerName: 'User',
          description: 'Test',
        }),
      ).rejects.toThrow();
    });

    it('throws when axios request fails', async () => {
      mockAxiosInstance.post.mockRejectedValue(new Error('Network error'));

      await expect(
        service.createOrder({
          amount: 100,
          currency: 'AED',
          orderId: 'ORD-003',
          callbackUrl: 'https://cb.example.com',
          customerEmail: 'user@example.com',
          customerName: 'User',
          description: 'Test',
        }),
      ).rejects.toThrow();
    });
  });

  describe('verifyPayment', () => {
    it('returns success: true for response_status "A"', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          tran_ref: 'TST123',
          payment_result: { response_status: 'A', response_message: 'Approved' },
          cart_amount: 500.0,
          cart_currency: 'AED',
        },
      });

      const result = await service.verifyPayment('TST123');

      expect(result.success).toBe(true);
      expect(result.amount).toBe(50000);
      expect(result.currency).toBe('AED');
    });

    it('returns success: false for response_status "D" (declined)', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          tran_ref: 'TST456',
          payment_result: { response_status: 'D', response_message: 'Declined' },
          cart_amount: 500.0,
          cart_currency: 'AED',
        },
      });

      const result = await service.verifyPayment('TST456');

      expect(result.success).toBe(false);
    });
  });

  describe('verifyWebhookSignature', () => {
    it('returns true for a valid HMAC-SHA256 signature', () => {
      const crypto = require('crypto');
      const payload = JSON.stringify({ cart_id: 'ORD-001', payment_result: { response_status: 'A' } });
      const sig = crypto.createHmac('sha256', 'test-server-key').update(payload).digest('hex');

      expect(service.verifyWebhookSignature(payload, sig)).toBe(true);
    });

    it('returns false for an invalid signature', () => {
      const payload = JSON.stringify({ cart_id: 'ORD-001' });
      expect(service.verifyWebhookSignature(payload, 'bad-hex')).toBe(false);
    });

    it('uses timing-safe comparison (both wrong sigs return false)', () => {
      const payload = '{"test":1}';
      expect(service.verifyWebhookSignature(payload, 'wrong1')).toBe(false);
      expect(service.verifyWebhookSignature(payload, 'also-wrong')).toBe(false);
    });
  });

  describe('isWebhookSuccess', () => {
    it('returns true when payment_result.response_status is "A"', () => {
      expect(service.isWebhookSuccess({ payment_result: { response_status: 'A' } })).toBe(true);
    });

    it('returns false for declined "D"', () => {
      expect(service.isWebhookSuccess({ payment_result: { response_status: 'D' } })).toBe(false);
    });

    it('returns false for error "E"', () => {
      expect(service.isWebhookSuccess({ payment_result: { response_status: 'E' } })).toBe(false);
    });

    it('returns false when payment_result is missing', () => {
      expect(service.isWebhookSuccess({})).toBe(false);
    });
  });

  describe('processRefund', () => {
    it('returns success: true on refund approval', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          tran_ref: 'REF001',
          payment_result: { response_status: 'A', response_message: 'Approved' },
          cart_amount: 250.0,
          cart_currency: 'AED',
        },
      });

      const result = await service.processRefund('TST123', 25000, 'AED', 'Cancellation');

      expect(result.success).toBe(true);
    });
  });
});
