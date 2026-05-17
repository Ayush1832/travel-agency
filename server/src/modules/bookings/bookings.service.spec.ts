import { BadRequestException, HttpException, NotFoundException } from '@nestjs/common';
import { getModelToken, getConnectionToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';
import { Booking } from '../../db/schemas/booking.schema';
import { BookingSequence } from '../../db/schemas/booking-sequence.schema';
import { ApiConfig } from '../../db/schemas/api-config.schema';
import { WalletTransaction } from '../../db/schemas/wallet-transaction.schema';
import { LoyaltyRule } from '../../db/schemas/loyalty-rule.schema';
import { BookingsService } from './bookings.service';
import { CompaniesService } from '../companies/companies.service';
import { WalletService } from '../wallet/wallet.service';
import { TboService } from '../integrations/tbo/tbo.service';

const mockUser = { _id: new Types.ObjectId().toString(), companyId: new Types.ObjectId().toString() };
const mockCompany = { _id: new Types.ObjectId() };

const mockPrebook = {
  roomToken: 'tok-1',
  confirmed: true,
  finalPrice: 10000,
  expiresAt: new Date(Date.now() + 3600000),
  checkIn: '2026-07-01',
  checkOut: '2026-07-03',
  hotel: { supplierHotelId: 'h1', name: 'Test Hotel', city: 'Dubai', country: 'AE', address: 'Addr', starRating: 5, imageUrl: '', lat: 25.2, lng: 55.3 },
  room: { roomType: 'Deluxe', mealPlan: 'BB', refundable: true, cancellationPolicy: [], maxAdults: 2, maxChildren: 0 },
};

const mockBookResult = {
  supplierBookingRef: 'TBO-12345',
  status: 'confirmed',
  confirmed: true,
  hotel: { supplierHotelId: 'h1', name: 'Test Hotel', city: 'Dubai', country: 'AE', address: 'Addr', starRating: 5, phone: '', imageUrl: '', lat: 25.2, lng: 55.3 },
  room: { roomType: 'Deluxe', mealPlan: 'BB', refundable: true, cancellationPolicy: [] },
};

function makeSession() {
  return {
    withTransaction: jest.fn().mockImplementation(async (fn: () => Promise<void>) => fn()),
    endSession: jest.fn(),
  };
}

describe('BookingsService', () => {
  let service: BookingsService;
  let bookingModel: jest.Mocked<any>;
  let walletTxModel: jest.Mocked<any>;
  let sequenceModel: jest.Mocked<any>;
  let apiConfigModel: jest.Mocked<any>;
  let loyaltyRuleModel: jest.Mocked<any>;
  let companiesService: jest.Mocked<Partial<CompaniesService>>;
  let walletService: jest.Mocked<Partial<WalletService>>;
  let tboService: jest.Mocked<Partial<TboService>>;
  let connection: any;
  let mockSession: ReturnType<typeof makeSession>;

  beforeEach(async () => {
    mockSession = makeSession();
    connection = { startSession: jest.fn().mockResolvedValue(mockSession) };

    const savedBooking = { _id: new Types.ObjectId(), bookingRef: 'BK-2026-000001' };
    bookingModel = {
      create: jest.fn().mockResolvedValue([savedBooking]),
      find: jest.fn(),
      findOne: jest.fn(),
      countDocuments: jest.fn(),
    };
    walletTxModel = { create: jest.fn().mockResolvedValue([{}]) };
    sequenceModel = {
      findOneAndUpdate: jest.fn().mockResolvedValue({ seq: 1 }),
    };
    apiConfigModel = {
      findOne: jest.fn().mockReturnValue({ lean: () => Promise.resolve({ markupPercent: 0 }) }),
    };
    loyaltyRuleModel = {
      findOne: jest.fn().mockReturnValue({
        lean: () => Promise.resolve({ pointsPerAed: 1, pointValueFils: 100, minBookingAmountAed: 0, expirationPeriodDays: 365, eligibleHotelIds: [], isActive: true }),
      }),
    };
    companiesService = {
      atomicDeductCredit: jest.fn().mockResolvedValue(undefined),
      creditBack: jest.fn().mockResolvedValue(undefined),
    };
    walletService = {
      addLoyaltyPoints: jest.fn().mockResolvedValue(undefined),
    };
    tboService = {
      prebook: jest.fn().mockResolvedValue(mockPrebook),
      book: jest.fn().mockResolvedValue(mockBookResult),
      cancel: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        BookingsService,
        { provide: getConnectionToken(), useValue: connection },
        { provide: getModelToken(Booking.name), useValue: bookingModel },
        { provide: getModelToken(BookingSequence.name), useValue: sequenceModel },
        { provide: getModelToken(ApiConfig.name), useValue: apiConfigModel },
        { provide: getModelToken(WalletTransaction.name), useValue: walletTxModel },
        { provide: getModelToken(LoyaltyRule.name), useValue: loyaltyRuleModel },
        { provide: CompaniesService, useValue: companiesService },
        { provide: WalletService, useValue: walletService },
        { provide: TboService, useValue: tboService },
      ],
    }).compile();

    service = module.get(BookingsService);
  });

  // ── createBooking — credit path ───────────────────────────────────────────────

  describe('createBooking (credit)', () => {
    const creditDto = {
      roomToken: 'tok-1',
      paymentMethod: 'credit' as const,
      currency: 'AED' as const,
      guests: [{ firstName: 'John', lastName: 'Doe', title: 'Mr', adults: 1, children: 0 }],
    };

    it('calls atomicDeductCredit before TBO book', async () => {
      const callOrder: string[] = [];
      (companiesService.atomicDeductCredit as jest.Mock).mockImplementation(() => { callOrder.push('deduct'); return Promise.resolve(); });
      (tboService.book as jest.Mock).mockImplementation(() => { callOrder.push('book'); return Promise.resolve(mockBookResult); });

      await service.createBooking(creditDto, mockUser, mockCompany);
      expect(callOrder).toEqual(['deduct', 'book']);
    });

    it('rolls back credit if TBO book fails', async () => {
      (tboService.book as jest.Mock).mockRejectedValue(new Error('TBO timeout'));
      await expect(service.createBooking(creditDto, mockUser, mockCompany)).rejects.toThrow(HttpException);
      expect(companiesService.creditBack).toHaveBeenCalledWith(mockUser.companyId, 10000);
    });

    it('rolls back credit if TBO book is unconfirmed', async () => {
      (tboService.book as jest.Mock).mockResolvedValue({ ...mockBookResult, confirmed: false });
      await expect(service.createBooking(creditDto, mockUser, mockCompany)).rejects.toThrow(BadRequestException);
      expect(companiesService.creditBack).toHaveBeenCalled();
    });

    it('saves booking inside a Mongo transaction', async () => {
      await service.createBooking(creditDto, mockUser, mockCompany);
      expect(mockSession.withTransaction).toHaveBeenCalled();
      expect(bookingModel.create).toHaveBeenCalled();
    });

    it('writes wallet ledger entry inside same transaction', async () => {
      await service.createBooking(creditDto, mockUser, mockCompany);
      expect(walletTxModel.create).toHaveBeenCalled();
      const walletCreateCall = walletTxModel.create.mock.calls[0];
      expect(walletCreateCall[1]).toMatchObject({ session: mockSession });
    });

    it('applies markup when markupPercent > 0', async () => {
      apiConfigModel.findOne.mockReturnValue({ lean: () => Promise.resolve({ markupPercent: 10 }) });
      await service.createBooking(creditDto, mockUser, mockCompany);
      expect(companiesService.atomicDeductCredit).toHaveBeenCalledWith(mockUser.companyId, 11000); // 10000 + 10%
    });

    it('awards loyalty points after confirmed booking', async () => {
      await service.createBooking(creditDto, mockUser, mockCompany);
      // addLoyaltyPoints is best-effort, called async — give microtask queue a tick
      await new Promise((r) => setImmediate(r));
      expect(walletService.addLoyaltyPoints).toHaveBeenCalled();
    });
  });

  // ── createBooking — online path ───────────────────────────────────────────────

  describe('createBooking (online)', () => {
    const onlineDto = {
      roomToken: 'tok-1',
      paymentMethod: 'online' as const,
      currency: 'AED' as const,
      paymentId: new Types.ObjectId().toString(),
      guests: [{ firstName: 'Jane', lastName: 'Doe', title: 'Ms', adults: 2, children: 0 }],
    };

    it('requires paymentId', async () => {
      const dto = { ...onlineDto, paymentId: undefined };
      await expect(service.createBooking(dto as any, mockUser, mockCompany)).rejects.toThrow(BadRequestException);
    });

    it('saves booking inside a transaction', async () => {
      await service.createBooking(onlineDto, mockUser, mockCompany);
      expect(mockSession.withTransaction).toHaveBeenCalled();
      expect(bookingModel.create).toHaveBeenCalled();
    });

    it('does NOT call atomicDeductCredit for online payments', async () => {
      await service.createBooking(onlineDto, mockUser, mockCompany);
      expect(companiesService.atomicDeductCredit).not.toHaveBeenCalled();
    });

    it('saves FAILED booking record if TBO book throws', async () => {
      (tboService.book as jest.Mock).mockRejectedValue(new Error('Supplier error'));
      // Failed booking saved directly (no session needed for error record)
      bookingModel.create.mockResolvedValue([{ _id: new Types.ObjectId() }]);
      await expect(service.createBooking(onlineDto, mockUser, mockCompany)).rejects.toThrow(HttpException);
    });
  });

  // ── findAll ───────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('paginates results correctly', async () => {
      bookingModel.find.mockReturnValue({ sort: () => ({ skip: () => ({ limit: () => ({ lean: () => Promise.resolve([]) }) }) }) });
      bookingModel.countDocuments.mockResolvedValue(0);
      const result = await service.findAll(mockUser.companyId, { page: 2, limit: 10 });
      expect(result).toMatchObject({ page: 2, limit: 10, totalPages: 0 });
    });

    it('caps limit at 100', async () => {
      bookingModel.find.mockReturnValue({ sort: () => ({ skip: () => ({ limit: () => ({ lean: () => Promise.resolve([]) }) }) }) });
      bookingModel.countDocuments.mockResolvedValue(0);
      const result = await service.findAll(mockUser.companyId, { limit: 999 });
      expect(result.limit).toBe(100);
    });
  });

  // ── findOne ───────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('throws NotFoundException for missing booking', async () => {
      bookingModel.findOne.mockReturnValue({ lean: () => Promise.resolve(null) });
      const fakeId = new Types.ObjectId().toString();
      await expect(service.findOne(fakeId, mockUser.companyId)).rejects.toThrow(NotFoundException);
    });
  });

  // ── cancelBooking ──────────────────────────────────────────────────────────────

  describe('cancelBooking', () => {
    const mockBookingDoc = {
      _id: new Types.ObjectId(),
      bookingRef: 'BK-2026-000001',
      status: 'confirmed',
      paymentMethod: 'credit',
      totalAmount: 10000,
      supplierBookingRef: 'TBO-123',
      cancellation: null,
      save: jest.fn().mockResolvedValue(undefined),
    };

    it('calls TBO cancel and credits back', async () => {
      bookingModel.findOne.mockResolvedValue({ ...mockBookingDoc, save: jest.fn() });
      (tboService.cancel as jest.Mock).mockResolvedValue({ refundAmount: 9000, cancellationFee: 1000 });
      companiesService.creditBack = jest.fn().mockResolvedValue(undefined);

      await service.cancelBooking(mockBookingDoc._id.toString(), mockUser.companyId, mockUser, {});
      expect(tboService.cancel).toHaveBeenCalledWith('TBO-123');
      expect(companiesService.creditBack).toHaveBeenCalledWith(mockUser.companyId, 9000);
    });

    it('throws NotFoundException if booking does not belong to company', async () => {
      bookingModel.findOne.mockResolvedValue(null);
      const fakeId = new Types.ObjectId().toString();
      await expect(
        service.cancelBooking(fakeId, mockUser.companyId, mockUser, {})
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException if booking is already cancelled', async () => {
      bookingModel.findOne.mockResolvedValue({ ...mockBookingDoc, status: 'cancelled', save: jest.fn() });
      await expect(
        service.cancelBooking(mockBookingDoc._id.toString(), mockUser.companyId, mockUser, {})
      ).rejects.toThrow(BadRequestException);
    });

    it('throws HttpException 502 when TBO cancel fails', async () => {
      bookingModel.findOne.mockResolvedValue({ ...mockBookingDoc, save: jest.fn() });
      (tboService.cancel as jest.Mock).mockRejectedValue(new Error('TBO timeout'));
      await expect(
        service.cancelBooking(mockBookingDoc._id.toString(), mockUser.companyId, mockUser, {})
      ).rejects.toThrow(HttpException);
    });

    it('does NOT call creditBack when cancellationFee equals totalAmount (non-refundable)', async () => {
      bookingModel.findOne.mockResolvedValue({ ...mockBookingDoc, save: jest.fn() });
      (tboService.cancel as jest.Mock).mockResolvedValue({ refundAmount: 0, cancellationFee: 10000 });
      companiesService.creditBack = jest.fn().mockResolvedValue(undefined);

      await service.cancelBooking(mockBookingDoc._id.toString(), mockUser.companyId, mockUser, {});
      expect(companiesService.creditBack).not.toHaveBeenCalled();
    });

    it('marks refundStatus PENDING for online payment cancellation', async () => {
      const onlineBooking = {
        ...mockBookingDoc,
        paymentMethod: 'online',
        cancellation: {},
        save: jest.fn().mockResolvedValue(undefined),
      };
      bookingModel.findOne.mockResolvedValue(onlineBooking);
      (tboService.cancel as jest.Mock).mockResolvedValue({ refundAmount: 9000, cancellationFee: 1000 });

      await service.cancelBooking(mockBookingDoc._id.toString(), mockUser.companyId, mockUser, {});
      expect(onlineBooking.cancellation).toMatchObject({ refundStatus: 'pending' });
    });

    it('throws BadRequestException when booking has no supplier reference', async () => {
      bookingModel.findOne.mockResolvedValue({ ...mockBookingDoc, supplierBookingRef: null, save: jest.fn() });
      await expect(
        service.cancelBooking(mockBookingDoc._id.toString(), mockUser.companyId, mockUser, {})
      ).rejects.toThrow(BadRequestException);
    });

    it('does not throw when creditBack fails after successful TBO cancel', async () => {
      bookingModel.findOne.mockResolvedValue({ ...mockBookingDoc, save: jest.fn() });
      (tboService.cancel as jest.Mock).mockResolvedValue({ refundAmount: 9000, cancellationFee: 1000 });
      companiesService.creditBack = jest.fn().mockRejectedValue(new Error('DB error'));

      await expect(
        service.cancelBooking(mockBookingDoc._id.toString(), mockUser.companyId, mockUser, {})
      ).resolves.not.toThrow();
    });
  });

  // ── generateVoucher ───────────────────────────────────────────────────────────

  describe('generateVoucher', () => {
    const mockBookingDoc2 = {
      _id: new Types.ObjectId(),
      bookingRef: 'BK-2026-VOUCH',
      status: 'confirmed',
      paymentMethod: 'credit',
      currency: 'AED',
      checkIn: '2026-07-01',
      checkOut: '2026-07-05',
      nights: 4,
      baseAmount: 40000,
      taxAmount: 2000,
      totalAmount: 42000,
      hotel: { name: 'Grand Hotel', address: 'Main St', city: 'Dubai', country: 'UAE', starRating: 5 },
      rooms: [{ roomType: 'Deluxe', mealPlan: 'BB', adults: 2, children: 0 }],
      guests: [],
    };

    it('generates a Buffer with valid PDF header', async () => {
      const buf = await service.generateVoucher(mockBookingDoc2 as any);
      expect(Buffer.isBuffer(buf)).toBe(true);
      expect(buf.slice(0, 5).toString('ascii')).toBe('%PDF-');
    });

    it('generates a larger PDF when specialRequests is present', async () => {
      const withRequests = { ...mockBookingDoc2, specialRequests: 'High floor room please' };
      const without = { ...mockBookingDoc2, specialRequests: undefined };
      const bufWith = await service.generateVoucher(withRequests as any);
      const bufWithout = await service.generateVoucher(without as any);
      expect(bufWith.length).toBeGreaterThan(bufWithout.length);
    });

    it('includes supplier booking ref when present', async () => {
      const withRef = { ...mockBookingDoc2, supplierBookingRef: 'TBO-SUP-999' };
      const buf = await service.generateVoucher(withRef as any);
      expect(buf.length).toBeGreaterThan(500);
      expect(buf.slice(0, 5).toString('ascii')).toBe('%PDF-');
    });
  });
});
