import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ReportsService } from './reports.service';
import { Booking } from '../../db/schemas/booking.schema';
import { WalletTransaction, WalletTransactionType } from '../../db/schemas/wallet-transaction.schema';

const mockBookingModel = { aggregate: jest.fn() };
const mockWalletTxModel = { aggregate: jest.fn() };

describe('ReportsService', () => {
  let service: ReportsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: getModelToken(Booking.name), useValue: mockBookingModel },
        { provide: getModelToken(WalletTransaction.name), useValue: mockWalletTxModel },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  describe('getRevenueReport', () => {
    it('sums daily gross, markup, and net from aggregation and returns totals', async () => {
      const dailyData = [
        { _id: { year: 2026, month: 5, day: 1 }, gross: 500000, markup: 50000, bookingCount: 5, date: new Date('2026-05-01') },
        { _id: { year: 2026, month: 5, day: 2 }, gross: 300000, markup: 30000, bookingCount: 3, date: new Date('2026-05-02') },
      ];
      // net is added by $addFields in pipeline but we simulate what aggregate returns
      const withNet = dailyData.map((d) => ({ ...d, net: d.gross - d.markup }));
      mockBookingModel.aggregate.mockResolvedValue(withNet);

      const result = await service.getRevenueReport('2026-05-01', '2026-05-31');

      expect(result.totals.gross).toBe(800000);
      expect(result.totals.markup).toBe(80000);
      expect(result.totals.net).toBe(720000);
      expect(result.totals.bookingCount).toBe(8);
      expect(result.daily).toHaveLength(2);
    });

    it('passes correct date range to aggregate pipeline', async () => {
      mockBookingModel.aggregate.mockResolvedValue([]);

      await service.getRevenueReport('2026-01-01', '2026-01-31');

      const pipeline = mockBookingModel.aggregate.mock.calls[0][0];
      const matchStage = pipeline[0].$match;
      expect(matchStage.createdAt.$gte).toEqual(new Date('2026-01-01'));
      expect(matchStage.createdAt.$lte).toEqual(new Date('2026-01-31'));
    });

    it('returns zero totals when no bookings exist in the period', async () => {
      mockBookingModel.aggregate.mockResolvedValue([]);

      const result = await service.getRevenueReport('2026-06-01', '2026-06-30');

      expect(result.totals.gross).toBe(0);
      expect(result.totals.bookingCount).toBe(0);
    });
  });

  describe('getBookingsReport', () => {
    it('returns byStatus, byCompany, byCity aggregations', async () => {
      mockBookingModel.aggregate
        .mockResolvedValueOnce([{ _id: 'confirmed', count: 10, totalAmount: 1000000 }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.getBookingsReport('2026-01-01', '2026-01-31');

      expect(result.byStatus).toHaveLength(1);
      expect(result.byStatus[0]._id).toBe('confirmed');
      expect(result.byCompany).toHaveLength(0);
      expect(result.byCity).toHaveLength(0);
    });
  });

  describe('getCreditReport', () => {
    it('maps wallet transaction types to summary with counts and amounts', async () => {
      mockWalletTxModel.aggregate.mockResolvedValue([
        { _id: WalletTransactionType.CREDIT_USE, totalAmount: 500000, count: 5 },
        { _id: WalletTransactionType.TOPUP, totalAmount: 200000, count: 2 },
      ]);

      const result = await service.getCreditReport('2026-01-01', '2026-01-31');

      expect(result.summary[WalletTransactionType.CREDIT_USE].totalAmount).toBe(500000);
      expect(result.summary[WalletTransactionType.TOPUP].count).toBe(2);
    });
  });
});
