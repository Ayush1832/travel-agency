import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { VoucherProcessor } from './voucher.processor';
import { Booking } from '../db/schemas/booking.schema';
import { JOB_GENERATE_VOUCHER } from './jobs.constants';

const bookingId = new Types.ObjectId().toString();

const mockBooking = {
  _id: new Types.ObjectId(bookingId),
  bookingRef: 'BK-2026-001',
  status: 'confirmed',
  checkIn: '2026-06-01',
  checkOut: '2026-06-05',
  nights: 4,
  guestName: 'John Doe',
  totalAmount: 200000,
  currency: 'AED',
  hotel: {
    name: 'Dubai Grand Hotel',
    city: 'Dubai',
    country: 'UAE',
    starRating: 5,
    address: 'Sheikh Zayed Rd',
  },
  rooms: [
    { roomTypeName: 'Deluxe King', adults: 2, children: 0 },
  ],
  guests: [],
};

const mockBookingModel = { findById: jest.fn() };

const makeJob = (data: Record<string, unknown>, name = JOB_GENERATE_VOUCHER) =>
  ({ name, data, id: '1' }) as never;

type GeneratePdfFn = (b: Record<string, unknown>) => Promise<Buffer>;

describe('VoucherProcessor', () => {
  let processor: VoucherProcessor;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VoucherProcessor,
        { provide: getModelToken(Booking.name), useValue: mockBookingModel },
      ],
    }).compile();

    processor = module.get<VoucherProcessor>(VoucherProcessor);
  });

  it('skips processing for unknown job names', async () => {
    await processor.process(makeJob({ bookingId }, 'other_job'));
    expect(mockBookingModel.findById).not.toHaveBeenCalled();
  });

  it('returns early when booking is not found', async () => {
    mockBookingModel.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });

    await expect(
      processor.process(makeJob({ bookingId: new Types.ObjectId().toString() })),
    ).resolves.toBeUndefined();
  });

  it('generates a non-empty Buffer', async () => {
    mockBookingModel.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue(mockBooking) });

    const pdfBuffer = await (processor as unknown as { generatePdf: GeneratePdfFn }).generatePdf(
      mockBooking as unknown as Record<string, unknown>,
    );

    expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
    expect(pdfBuffer.length).toBeGreaterThan(500);
  });

  it('output is a valid PDF (starts with %PDF- header)', async () => {
    mockBookingModel.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue(mockBooking) });

    const pdfBuffer = await (processor as unknown as { generatePdf: GeneratePdfFn }).generatePdf(
      mockBooking as unknown as Record<string, unknown>,
    );

    expect(pdfBuffer.slice(0, 5).toString('ascii')).toBe('%PDF-');
  });

  it('output ends with %%EOF trailer (valid PDF structure)', async () => {
    mockBookingModel.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue(mockBooking) });

    const pdfBuffer = await (processor as unknown as { generatePdf: GeneratePdfFn }).generatePdf(
      mockBooking as unknown as Record<string, unknown>,
    );

    const tail = pdfBuffer.slice(-10).toString('ascii');
    expect(tail).toContain('%%EOF');
  });

  it('generates a larger PDF when booking has rooms (content variation)', async () => {
    const bookingWithRooms = { ...mockBooking, rooms: [
      { roomTypeName: 'Suite', adults: 2, children: 1 },
      { roomTypeName: 'Deluxe', adults: 1, children: 0 },
    ]};
    const bookingNoRooms = { ...mockBooking, rooms: [] };

    mockBookingModel.findById
      .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue(bookingWithRooms) })
      .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue(bookingNoRooms) });

    const bufWith = await (processor as unknown as { generatePdf: GeneratePdfFn }).generatePdf(
      bookingWithRooms as unknown as Record<string, unknown>,
    );
    const bufWithout = await (processor as unknown as { generatePdf: GeneratePdfFn }).generatePdf(
      bookingNoRooms as unknown as Record<string, unknown>,
    );

    expect(bufWith.length).toBeGreaterThan(bufWithout.length);
  });

  it('runs full process() flow end-to-end', async () => {
    mockBookingModel.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue(mockBooking) });
    await expect(processor.process(makeJob({ bookingId }))).resolves.toBeUndefined();
    expect(mockBookingModel.findById).toHaveBeenCalledWith(bookingId);
  });
});
