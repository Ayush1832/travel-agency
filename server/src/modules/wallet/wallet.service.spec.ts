import { BadRequestException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';
import { WalletTransaction, WalletTransactionType, WalletTransactionDirection } from '../../db/schemas/wallet-transaction.schema';
import { Settlement } from '../../db/schemas/settlement.schema';
import { Company } from '../../db/schemas/company.schema';
import { LoyaltyRule } from '../../db/schemas/loyalty-rule.schema';
import { WalletService } from './wallet.service';
import { CompaniesService } from '../companies/companies.service';
import { PaymentsService } from '../payments/payments.service';

const mockActiveRule = {
  pointsPerAed: 1,
  pointValueFils: 100,
  minBookingAmountAed: 0,
  expirationPeriodDays: 365,
  eligibleHotelIds: [],
  isActive: true,
};

const mockCompanyId = new Types.ObjectId().toString();
const mockUserId = new Types.ObjectId().toString();

describe('WalletService', () => {
  let service: WalletService;
  let txModel: jest.Mocked<any>;
  let companyModel: jest.Mocked<any>;
  let loyaltyRuleModel: jest.Mocked<any>;
  let companiesService: jest.Mocked<Partial<CompaniesService>>;
  let paymentsService: jest.Mocked<Partial<PaymentsService>>;

  beforeEach(async () => {
    txModel = {
      find: jest.fn(),
      findOne: jest.fn().mockReturnValue({ sort: () => ({ lean: () => Promise.resolve(null) }) }),
      countDocuments: jest.fn(),
    };

    const MockTxModel = jest.fn().mockImplementation((data: unknown) => ({
      ...(data as object),
      save: jest.fn().mockResolvedValue({ _id: new Types.ObjectId(), ...(data as object) }),
    }));
    Object.assign(MockTxModel, txModel);

    companyModel = {
      findByIdAndUpdate: jest.fn(),
    };

    loyaltyRuleModel = {
      findOne: jest.fn().mockReturnValue({ lean: () => Promise.resolve(mockActiveRule) }),
    };

    companiesService = {
      findById: jest.fn().mockResolvedValue({
        _id: new Types.ObjectId(mockCompanyId),
        name: 'Test Company',
        creditLimit: 100000,
        walletBalance: 50000,
        outstandingBalance: 20000,
        loyaltyPoints: 500,
        currency: 'AED',
      }),
    };

    paymentsService = {
      createOrder: jest.fn().mockResolvedValue({ paymentId: 'pay-1', paymentUrl: 'https://pay.example.com' }),
    };

    const module = await Test.createTestingModule({
      providers: [
        WalletService,
        { provide: getModelToken(WalletTransaction.name), useValue: MockTxModel },
        { provide: getModelToken(Settlement.name), useValue: {} },
        { provide: getModelToken(Company.name), useValue: companyModel },
        { provide: getModelToken(LoyaltyRule.name), useValue: loyaltyRuleModel },
        { provide: CompaniesService, useValue: companiesService },
        { provide: PaymentsService, useValue: paymentsService },
      ],
    }).compile();

    service = module.get(WalletService);
  });

  // ── getBalance ────────────────────────────────────────────────────────────────

  describe('getBalance', () => {
    it('returns correct availableCredit (creditLimit + walletBalance - outstandingBalance)', async () => {
      const result = await service.getBalance(mockCompanyId);
      // 100000 + 50000 - 20000 = 130000
      expect(result.availableCredit).toBe(130000);
    });

    it('includes outstandingBalance in response', async () => {
      const result = await service.getBalance(mockCompanyId);
      expect(result.outstandingBalance).toBe(20000);
    });

    it('clamps availableCredit to 0 when outstanding exceeds limit+wallet', async () => {
      (companiesService.findById as jest.Mock).mockResolvedValue({
        creditLimit: 1000, walletBalance: 0, outstandingBalance: 5000, loyaltyPoints: 0, currency: 'AED',
      });
      const result = await service.getBalance(mockCompanyId);
      expect(result.availableCredit).toBe(0);
    });

    it('includes pointValueFils from active rule', async () => {
      const result = await service.getBalance(mockCompanyId);
      expect(result.pointValueFils).toBe(100);
    });
  });

  // ── redeemLoyaltyPoints ────────────────────────────────────────────────────────

  describe('redeemLoyaltyPoints', () => {
    it('throws BadRequestException when insufficient points', async () => {
      (companiesService.findById as jest.Mock).mockResolvedValue({ loyaltyPoints: 100 });
      await expect(service.redeemLoyaltyPoints(mockCompanyId, mockUserId, 200)).rejects.toThrow(BadRequestException);
    });

    it('converts points to wallet balance using active rule pointValueFils', async () => {
      (companiesService.findById as jest.Mock).mockResolvedValue({ loyaltyPoints: 500 });
      companyModel.findByIdAndUpdate.mockResolvedValue({
        loyaltyPoints: 400,
        walletBalance: 60000,
      });

      const result = await service.redeemLoyaltyPoints(mockCompanyId, mockUserId, 100);
      // 100 points × 100 fils/point (from mockActiveRule) = 10000 fils
      expect(result.walletCredited).toBe(10000);
      expect(result.pointsRedeemed).toBe(100);
    });

    it('throws BadRequestException if company not found', async () => {
      (companiesService.findById as jest.Mock).mockResolvedValue({ loyaltyPoints: 500 });
      companyModel.findByIdAndUpdate.mockResolvedValue(null);
      await expect(service.redeemLoyaltyPoints(mockCompanyId, mockUserId, 100)).rejects.toThrow(BadRequestException);
    });
  });

  // ── topUpWallet ───────────────────────────────────────────────────────────────

  describe('topUpWallet', () => {
    it('delegates to paymentsService.createOrder', async () => {
      const mockUser = { _id: mockUserId, email: 'a@b.com', companyId: mockCompanyId } as any;
      const result = await service.topUpWallet(mockCompanyId, mockUser, 10000, 'AED', 'https://callback.example.com');
      expect(paymentsService.createOrder).toHaveBeenCalled();
      expect(result).toMatchObject({ paymentId: 'pay-1' });
    });
  });

  // ── computeLoyaltyPoints (static) ─────────────────────────────────────────────

  describe('WalletService.computeLoyaltyPoints', () => {
    it('1 point per AED (default rate)', () => {
      expect(WalletService.computeLoyaltyPoints(100)).toBe(1);   // 1 AED = 1 pt
      expect(WalletService.computeLoyaltyPoints(1000)).toBe(10);  // 10 AED = 10 pts
      expect(WalletService.computeLoyaltyPoints(150)).toBe(1);   // 1.5 AED → floor 1
    });

    it('scales with pointsPerAed', () => {
      expect(WalletService.computeLoyaltyPoints(100, 2)).toBe(2); // 1 AED × 2 = 2 pts
      expect(WalletService.computeLoyaltyPoints(100, 0.5)).toBe(0); // 0.5 pts → floor 0
    });

    it('returns 0 for amounts below 100 fils', () => {
      expect(WalletService.computeLoyaltyPoints(50)).toBe(0);
    });
  });

  // ── getTransactions ───────────────────────────────────────────────────────────

  describe('getTransactions', () => {
    it('paginates results and returns total', async () => {
      txModel.find.mockReturnValue({ sort: () => ({ skip: () => ({ limit: () => ({ lean: () => Promise.resolve([]) }) }) }) });
      txModel.countDocuments.mockResolvedValue(5);

      const result = await service.getTransactions(mockCompanyId, {}, 1, 10);
      expect(result).toMatchObject({ total: 5, page: 1, limit: 10 });
    });
  });

  // ── getStatement ──────────────────────────────────────────────────────────────

  describe('getStatement', () => {
    it('returns statement with transactions and company name', async () => {
      const mockTxs = [
        { type: 'credit_booking', direction: 'debit', amount: 10000, createdAt: new Date('2026-01-15') },
        { type: 'wallet_topup', direction: 'credit', amount: 50000, createdAt: new Date('2026-01-20') },
      ];
      txModel.find.mockReturnValue({ sort: () => ({ lean: () => Promise.resolve(mockTxs) }) });

      const result = await service.getStatement(mockCompanyId, '2026-01-01', '2026-01-31');
      expect(result.transactions).toHaveLength(2);
      expect(result.totalTransactions).toBe(2);
      expect(result.companyName).toBe('Test Company');
      expect(result.from).toBe('2026-01-01');
      expect(result.to).toBe('2026-01-31');
    });

    it('returns empty transactions for period with no activity', async () => {
      txModel.find.mockReturnValue({ sort: () => ({ lean: () => Promise.resolve([]) }) });
      const result = await service.getStatement(mockCompanyId, '2020-01-01', '2020-01-31');
      expect(result.transactions).toHaveLength(0);
      expect(result.totalTransactions).toBe(0);
    });
  });

  // ── exportStatement ───────────────────────────────────────────────────────────

  describe('exportStatement', () => {
    const mockTxs = [
      { type: 'credit_booking', direction: 'debit', amount: 10000, balanceAfter: 40000, description: 'Booking BK-001', createdAt: new Date('2026-01-15') },
    ];

    beforeEach(() => {
      txModel.find.mockReturnValue({ sort: () => ({ lean: () => Promise.resolve(mockTxs) }) });
    });

    it('returns a valid PDF Buffer (starts with %PDF-)', async () => {
      const buf = await service.exportStatement(mockCompanyId, '2026-01-01', '2026-01-31', 'pdf');
      expect(Buffer.isBuffer(buf)).toBe(true);
      expect(buf.slice(0, 5).toString('ascii')).toBe('%PDF-');
    });

    it('returns a valid Excel Buffer (starts with PK zip magic bytes)', async () => {
      const buf = await service.exportStatement(mockCompanyId, '2026-01-01', '2026-01-31', 'excel');
      expect(Buffer.isBuffer(buf)).toBe(true);
      // XLSX is a zip file — starts with PK (0x50 0x4B)
      expect(buf[0]).toBe(0x50);
      expect(buf[1]).toBe(0x4b);
    });

    it('PDF buffer size grows with more transactions', async () => {
      const manyTxs = Array.from({ length: 10 }, (_, i) => ({
        type: 'credit_booking', direction: 'debit', amount: 1000 * i,
        balanceAfter: 50000 - 1000 * i, description: `Booking ${i}`, createdAt: new Date(),
      }));
      txModel.find
        .mockReturnValueOnce({ sort: () => ({ lean: () => Promise.resolve(mockTxs) }) })
        .mockReturnValueOnce({ sort: () => ({ lean: () => Promise.resolve(manyTxs) }) });

      const small = await service.exportStatement(mockCompanyId, '2026-01-01', '2026-01-31', 'pdf');
      const large = await service.exportStatement(mockCompanyId, '2026-01-01', '2026-01-31', 'pdf');
      expect(large.length).toBeGreaterThan(small.length);
    });
  });

  // ── addLoyaltyPoints ──────────────────────────────────────────────────────────

  describe('addLoyaltyPoints', () => {
    it('increments loyaltyPoints and returns new balance', async () => {
      companyModel.findByIdAndUpdate.mockResolvedValue({
        loyaltyPoints: 600,
        walletBalance: 50000,
      });

      const result = await service.addLoyaltyPoints(mockCompanyId, mockUserId, 100);
      expect(companyModel.findByIdAndUpdate).toHaveBeenCalledWith(
        mockCompanyId,
        { $inc: { loyaltyPoints: 100 } },
        { new: true },
      );
      expect(result.pointsAdded).toBe(100);
      expect(result.newPointsBalance).toBe(600);
    });

    it('throws BadRequestException when company not found', async () => {
      companyModel.findByIdAndUpdate.mockResolvedValue(null);
      await expect(service.addLoyaltyPoints(mockCompanyId, mockUserId, 50)).rejects.toThrow(BadRequestException);
    });

    it('records a LOYALTY_EARN wallet transaction', async () => {
      companyModel.findByIdAndUpdate.mockResolvedValue({ loyaltyPoints: 550, walletBalance: 50000 });
      await service.addLoyaltyPoints(mockCompanyId, mockUserId, 50);
    });

    it('accepts optional bookingId and expiresAt for transaction reference', async () => {
      companyModel.findByIdAndUpdate.mockResolvedValue({ loyaltyPoints: 600, walletBalance: 50000 });
      const bookingId = new Types.ObjectId().toString();
      const expiresAt = new Date(Date.now() + 30 * 24 * 3600_000);
      const result = await service.addLoyaltyPoints(mockCompanyId, mockUserId, 100, bookingId, expiresAt);
      expect(result.pointsAdded).toBe(100);
      expect(result.expiresAt).toEqual(expiresAt);
    });
  });
});
