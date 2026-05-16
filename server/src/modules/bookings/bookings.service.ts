import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  HttpException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
// eslint-disable-next-line @typescript-eslint/no-require-imports,@typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit') as typeof import('pdfkit');
import { Booking, BookingDocument, BookingStatus, BookingCurrency, BookingPaymentMethod, BookingSupplier, RefundStatus } from '../../db/schemas/booking.schema';
import { BookingSequence, BookingSequenceDocument } from '../../db/schemas/booking-sequence.schema';
import { ApiConfig, ApiConfigDocument } from '../../db/schemas/api-config.schema';
import { CompaniesService } from '../companies/companies.service';
import { TboService } from '../integrations/tbo/tbo.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { GuestInfo } from '../integrations/supplier.interface';

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
    @InjectModel(BookingSequence.name) private sequenceModel: Model<BookingSequenceDocument>,
    @InjectModel(ApiConfig.name) private apiConfigModel: Model<ApiConfigDocument>,
    private readonly companiesService: CompaniesService,
    private readonly tboService: TboService,
  ) {}

  // ── Booking reference generation ─────────────────────────────────────────────

  private async generateBookingRef(): Promise<string> {
    const year = new Date().getFullYear();
    const doc = await this.sequenceModel.findOneAndUpdate(
      { year },
      { $inc: { seq: 1 } },
      { upsert: true, new: true },
    );
    const seq = String(doc.seq).padStart(6, '0');
    return `BK-${year}-${seq}`;
  }

  // ── Nights calculator ────────────────────────────────────────────────────────

  private calcNights(checkIn: Date, checkOut: Date): number {
    const diff = checkOut.getTime() - checkIn.getTime();
    return Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)));
  }

  // ── Markup ──────────────────────────────────────────────────────────────────

  private async getMarkupPercent(supplier: string): Promise<number> {
    try {
      const config = await this.apiConfigModel.findOne({ provider: supplier.toLowerCase() }).lean();
      return config?.markupPercent ?? 0;
    } catch {
      return 0;
    }
  }

  private applyMarkup(baseAmount: number, markupPercent: number): { total: number; markup: number } {
    const markup = Math.round(baseAmount * markupPercent / 100);
    return { total: baseAmount + markup, markup };
  }

  // ── Loyalty points ───────────────────────────────────────────────────────────

  private calcLoyaltyPoints(totalAmountMinorUnits: number, currency: string): number {
    // 1 point per 1 AED spent (100 fils = 1 AED → 1 point per 100 minor units)
    // For USD: use exchange rate approximation 1 USD ≈ 3.67 AED
    if (currency === 'AED') {
      return Math.floor(totalAmountMinorUnits / 100);
    }
    // USD → AED conversion factor
    const aedEquivalent = totalAmountMinorUnits * 3.67;
    return Math.floor(aedEquivalent / 100);
  }

  // ── Create booking ────────────────────────────────────────────────────────────

  async createBooking(
    dto: CreateBookingDto,
    user: { _id: string | Types.ObjectId; companyId: string | Types.ObjectId },
    company: { _id: string | Types.ObjectId },
  ) {
    const companyId = String(user.companyId ?? company._id);
    const userId = String(user._id);

    // 1. Check credit availability for credit bookings
    if (dto.paymentMethod === 'credit') {
      // Prebook to get final price
      const prebook = await this.tboService.prebook(dto.prebookToken);
      const baseAmount = prebook.finalPrice;
      const markupPct = await this.getMarkupPercent('tbo');
      const { total: totalAmount, markup: markupAmount } = this.applyMarkup(baseAmount, markupPct);

      const available = await this.companiesService.getAvailableCredit(companyId);
      if (available < totalAmount) {
        throw new BadRequestException(
          `Insufficient credit. Available: ${available}, Required: ${totalAmount}`,
        );
      }

      // Deduct credit atomically
      await this.companiesService.deductCredit(companyId, totalAmount);

      // Map guests to supplier format
      const guestInfos: GuestInfo[] = dto.guests.map((g) => ({
        firstName: g.firstName,
        lastName: g.lastName,
        title: g.title,
        adults: g.adults,
        children: g.children,
      }));

      // Call TBO book — CRITICAL: if this fails, rollback credit
      let bookResult;
      try {
        bookResult = await this.tboService.book(prebook.prebookToken, guestInfos);
      } catch (err) {
        // COMPENSATING ACTION: rollback credit
        this.logger.error(
          `TBO book() failed after credit deduction for company ${companyId}. Rolling back credit of ${totalAmount}`,
          (err as Error).message,
        );
        try {
          await this.companiesService.creditBack(companyId, totalAmount);
          this.logger.log(`Credit rollback successful for company ${companyId}`);
        } catch (rollbackErr) {
          this.logger.error(
            `CRITICAL: Credit rollback FAILED for company ${companyId}. Manual intervention required!`,
            (rollbackErr as Error).message,
          );
        }
        throw new HttpException(
          'Booking failed at supplier level. Credit has been refunded.',
          502,
        );
      }

      if (!bookResult.confirmed) {
        // Book returned but not confirmed — rollback credit
        await this.companiesService.creditBack(companyId, totalAmount);
        throw new BadRequestException('Booking was not confirmed by supplier. Credit refunded.');
      }

      // Build and save booking
      const bookingRef = await this.generateBookingRef();
      const checkIn = new Date(prebook.hotel ? `${new Date().toISOString().split('T')[0]}` : new Date().toISOString());
      const checkOut = new Date(checkIn.getTime() + 24 * 60 * 60 * 1000);
      const nights = this.calcNights(checkIn, checkOut);

      const rooms = dto.guests.map((g) => ({
        roomType: prebook.room.roomType,
        mealPlan: prebook.room.mealPlan,
        refundable: prebook.room.refundable,
        cancellationPolicy: prebook.room.cancellationPolicy,
        adults: g.adults,
        children: g.children,
        childrenAges: [],
        leadGuest: { firstName: g.firstName, lastName: g.lastName, title: g.title },
        guests: [],
      }));

      const booking = new this.bookingModel({
        bookingRef,
        companyId: new Types.ObjectId(companyId),
        bookedByUserId: new Types.ObjectId(userId),
        supplier: BookingSupplier.TBO,
        supplierBookingRef: bookResult.supplierBookingRef,
        hotel: {
          supplierHotelId: bookResult.hotel.supplierHotelId || prebook.hotel.supplierHotelId,
          name: bookResult.hotel.name || prebook.hotel.name,
          address: bookResult.hotel.address || prebook.hotel.address,
          city: bookResult.hotel.city,
          country: bookResult.hotel.country,
          starRating: bookResult.hotel.starRating || prebook.hotel.starRating,
          lat: bookResult.hotel.lat || prebook.hotel.lat,
          lng: bookResult.hotel.lng || prebook.hotel.lng,
          phone: bookResult.hotel.phone || '',
          imageUrl: bookResult.hotel.imageUrl || prebook.hotel.imageUrl,
        },
        rooms,
        checkIn,
        checkOut,
        nights,
        currency: dto.currency as BookingCurrency,
        baseAmount,
        taxAmount: 0,
        totalAmount,
        markupAmount,
        paymentMethod: BookingPaymentMethod.CREDIT,
        status: BookingStatus.CONFIRMED,
        specialRequests: dto.specialRequests ?? '',
        apiRaw: { prebook, bookResult },
      });

      const saved = await booking.save();

      // Track outstanding balance for credit bookings
      try {
        await this.companiesService.incrementOutstanding(companyId, totalAmount);
      } catch {
        this.logger.warn('Could not increment outstandingBalance — non-critical');
      }

      // Award loyalty points (best-effort)
      const points = this.calcLoyaltyPoints(totalAmount, dto.currency);
      if (points > 0) {
        try {
          await this.companiesService.addLoyaltyPoints(companyId, points);
        } catch {
          this.logger.warn('Loyalty point update failed — non-critical');
        }
      }

      return saved;
    }

    // ── Online payment flow ────────────────────────────────────────────────────

    if (dto.paymentMethod === 'online') {
      if (!dto.paymentId) {
        throw new BadRequestException('paymentId is required for online payment bookings');
      }

      // Prebook to get final price
      const prebook = await this.tboService.prebook(dto.prebookToken);
      const onlineBaseAmount = prebook.finalPrice;
      const onlineMarkupPct = await this.getMarkupPercent('tbo');
      const { total: totalAmount, markup: onlineMarkupAmount } = this.applyMarkup(onlineBaseAmount, onlineMarkupPct);

      const guestInfos: GuestInfo[] = dto.guests.map((g) => ({
        firstName: g.firstName,
        lastName: g.lastName,
        title: g.title,
        adults: g.adults,
        children: g.children,
      }));

      // Call TBO book — if fails, flag for refund
      let bookResult;
      try {
        bookResult = await this.tboService.book(prebook.prebookToken, guestInfos);
      } catch (err) {
        this.logger.error(
          `TBO book() failed for online payment ${dto.paymentId}. Flagging for refund.`,
          (err as Error).message,
        );
        // Save a failed booking record with refund status pending
        const failedRef = await this.generateBookingRef();
        await this.bookingModel.create({
          bookingRef: failedRef,
          companyId: new Types.ObjectId(companyId),
          bookedByUserId: new Types.ObjectId(userId),
          supplier: BookingSupplier.TBO,
          hotel: { supplierHotelId: 'unknown', name: 'Unknown', address: '', city: '', country: '', starRating: 0, lat: 0, lng: 0, phone: '', imageUrl: '' },
          rooms: [],
          checkIn: new Date(),
          checkOut: new Date(),
          nights: 0,
          currency: dto.currency as BookingCurrency,
          baseAmount: totalAmount,
          taxAmount: 0,
          totalAmount,
          markupAmount: 0,
          paymentMethod: BookingPaymentMethod.ONLINE,
          paymentId: new Types.ObjectId(dto.paymentId),
          status: BookingStatus.FAILED,
          cancellation: {
            cancellationFee: 0,
            refundAmount: totalAmount,
            refundStatus: RefundStatus.PENDING,
          },
          apiRaw: { error: (err as Error).message },
        });
        throw new HttpException('Booking failed at supplier. Refund has been initiated.', 502);
      }

      const bookingRef = await this.generateBookingRef();
      const checkIn = new Date();
      const checkOut = new Date(checkIn.getTime() + 24 * 60 * 60 * 1000);
      const nights = this.calcNights(checkIn, checkOut);

      const rooms = dto.guests.map((g) => ({
        roomType: prebook.room.roomType,
        mealPlan: prebook.room.mealPlan,
        refundable: prebook.room.refundable,
        cancellationPolicy: prebook.room.cancellationPolicy,
        adults: g.adults,
        children: g.children,
        childrenAges: [],
        leadGuest: { firstName: g.firstName, lastName: g.lastName, title: g.title },
        guests: [],
      }));

      const booking = new this.bookingModel({
        bookingRef,
        companyId: new Types.ObjectId(companyId),
        bookedByUserId: new Types.ObjectId(userId),
        supplier: BookingSupplier.TBO,
        supplierBookingRef: bookResult.supplierBookingRef,
        hotel: {
          supplierHotelId: bookResult.hotel.supplierHotelId || prebook.hotel.supplierHotelId,
          name: bookResult.hotel.name || prebook.hotel.name,
          address: bookResult.hotel.address || prebook.hotel.address,
          city: bookResult.hotel.city,
          country: bookResult.hotel.country,
          starRating: bookResult.hotel.starRating || prebook.hotel.starRating,
          lat: bookResult.hotel.lat || prebook.hotel.lat,
          lng: bookResult.hotel.lng || prebook.hotel.lng,
          phone: bookResult.hotel.phone || '',
          imageUrl: bookResult.hotel.imageUrl || prebook.hotel.imageUrl,
        },
        rooms,
        checkIn,
        checkOut,
        nights,
        currency: dto.currency as BookingCurrency,
        baseAmount: onlineBaseAmount,
        taxAmount: 0,
        totalAmount,
        markupAmount: onlineMarkupAmount,
        paymentMethod: BookingPaymentMethod.ONLINE,
        paymentId: new Types.ObjectId(dto.paymentId),
        status: bookResult.confirmed ? BookingStatus.CONFIRMED : BookingStatus.FAILED,
        specialRequests: dto.specialRequests ?? '',
        apiRaw: { prebook, bookResult },
      });

      const saved = await booking.save();

      // Award loyalty points for online payments (best-effort)
      if (bookResult.confirmed) {
        const pts = this.calcLoyaltyPoints(totalAmount, dto.currency);
        if (pts > 0) {
          try {
            await this.companiesService.addLoyaltyPoints(companyId, pts);
          } catch {
            this.logger.warn('Loyalty point update failed — non-critical');
          }
        }
      }

      return saved;
    }

    throw new BadRequestException('Invalid payment method');
  }

  // ── Find all (paginated) ─────────────────────────────────────────────────────

  async findAll(
    companyId: string,
    filters: {
      status?: string;
      from?: string;
      to?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const query: Record<string, unknown> = {
      companyId: new Types.ObjectId(companyId),
      deletedAt: { $exists: false },
    };

    if (filters.status) query.status = filters.status;
    if (filters.from || filters.to) {
      query.checkIn = {};
      if (filters.from) (query.checkIn as Record<string, unknown>).$gte = new Date(filters.from);
      if (filters.to) (query.checkIn as Record<string, unknown>).$lte = new Date(filters.to);
    }

    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));

    const [data, total] = await Promise.all([
      this.bookingModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.bookingModel.countDocuments(query),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ── Find one ─────────────────────────────────────────────────────────────────

  async findOne(id: string, companyId: string): Promise<BookingDocument> {
    const booking = await this.bookingModel
      .findOne({
        _id: new Types.ObjectId(id),
        companyId: new Types.ObjectId(companyId),
        deletedAt: { $exists: false },
      })
      .lean();

    if (!booking) throw new NotFoundException('Booking not found');
    return booking as unknown as BookingDocument;
  }

  // ── Cancel booking ────────────────────────────────────────────────────────────

  async cancelBooking(
    id: string,
    companyId: string,
    user: { _id: string | Types.ObjectId },
    _dto: CancelBookingDto,
  ) {
    const booking = await this.bookingModel.findOne({
      _id: new Types.ObjectId(id),
      companyId: new Types.ObjectId(companyId),
      deletedAt: { $exists: false },
    });

    if (!booking) throw new NotFoundException('Booking not found');

    if (![BookingStatus.CONFIRMED, BookingStatus.PENDING].includes(booking.status)) {
      throw new BadRequestException(
        `Cannot cancel a booking with status "${booking.status}"`,
      );
    }

    if (!booking.supplierBookingRef) {
      throw new BadRequestException('Booking has no supplier reference to cancel');
    }

    // Call TBO cancel
    let cancelResult;
    try {
      cancelResult = await this.tboService.cancel(booking.supplierBookingRef);
    } catch (err) {
      this.logger.error(
        `TBO cancel() failed for bookingRef=${booking.bookingRef}`,
        (err as Error).message,
      );
      throw new HttpException('Cancellation failed at supplier level', 502);
    }

    // Update booking
    booking.status = BookingStatus.CANCELLED;
    booking.cancellation = {
      cancelledAt: new Date(),
      cancelledBy: new Types.ObjectId(String(user._id)),
      cancellationFee: cancelResult.cancellationFee,
      refundAmount: cancelResult.refundAmount,
      refundStatus: booking.paymentMethod === BookingPaymentMethod.ONLINE ? RefundStatus.PENDING : RefundStatus.PROCESSED,
    } as unknown as typeof booking.cancellation;

    // Credit booking — credit back (amount minus cancellation fee)
    if (booking.paymentMethod === BookingPaymentMethod.CREDIT) {
      const refundableAmount = booking.totalAmount - cancelResult.cancellationFee;
      if (refundableAmount > 0) {
        try {
          await this.companiesService.creditBack(companyId, refundableAmount);
          this.logger.log(
            `Credit refunded ${refundableAmount} to company ${companyId} for cancelled booking ${booking.bookingRef}`,
          );
          if (booking.cancellation) {
            (booking.cancellation as unknown as Record<string, unknown>).refundStatus = RefundStatus.PROCESSED;
          }
        } catch (err) {
          this.logger.error('Credit refund failed after cancel', (err as Error).message);
        }
      }
    }

    // Online payment — mark refund as pending (payment service handles actual refund)
    if (booking.paymentMethod === BookingPaymentMethod.ONLINE && booking.cancellation) {
      (booking.cancellation as unknown as Record<string, unknown>).refundStatus = RefundStatus.PENDING;
      this.logger.log(
        `Online refund of ${cancelResult.refundAmount} flagged as pending for booking ${booking.bookingRef}`,
      );
    }

    return booking.save();
  }

  // ── Generate PDF voucher ──────────────────────────────────────────────────────

  async generateVoucher(booking: BookingDocument): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const currency = booking.currency;
      const formatAmount = (amount: number) =>
        `${currency} ${(amount / 100).toFixed(2)}`;

      // Header
      doc
        .fillColor('#1a3c5e')
        .fontSize(24)
        .text('Hotel Booking Voucher', { align: 'center' });
      doc.moveDown(0.5);

      doc
        .fillColor('#666')
        .fontSize(10)
        .text(`Booking Reference: ${booking.bookingRef}`, { align: 'center' });
      doc.moveDown(1);

      // Separator
      doc.strokeColor('#1a3c5e').lineWidth(2).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(1);

      // Status badge
      doc
        .fillColor(booking.status === 'confirmed' ? '#16a34a' : '#dc2626')
        .fontSize(12)
        .text(`Status: ${booking.status.toUpperCase()}`, { align: 'right' });
      doc.moveDown(1);

      // Hotel info
      doc.fillColor('#1a3c5e').fontSize(14).text('Hotel Information');
      doc.moveDown(0.5);
      doc.fillColor('#333').fontSize(11);
      doc.text(`Hotel: ${booking.hotel?.name ?? 'N/A'}`);
      doc.text(`Address: ${booking.hotel?.address ?? 'N/A'}`);
      doc.text(`City: ${booking.hotel?.city ?? 'N/A'}, ${booking.hotel?.country ?? ''}`);
      doc.text(`Star Rating: ${'★'.repeat(booking.hotel?.starRating ?? 0)}`);
      if (booking.hotel?.phone) doc.text(`Phone: ${booking.hotel.phone}`);
      doc.moveDown(1);

      // Stay details
      doc.fillColor('#1a3c5e').fontSize(14).text('Stay Details');
      doc.moveDown(0.5);
      doc.fillColor('#333').fontSize(11);
      const checkIn = new Date(booking.checkIn).toLocaleDateString('en-AE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      const checkOut = new Date(booking.checkOut).toLocaleDateString('en-AE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      doc.text(`Check-in: ${checkIn}`);
      doc.text(`Check-out: ${checkOut}`);
      doc.text(`Nights: ${booking.nights}`);
      doc.moveDown(1);

      // Room details
      doc.fillColor('#1a3c5e').fontSize(14).text('Room Details');
      doc.moveDown(0.5);
      (booking.rooms ?? []).forEach((room, idx: number) => {
        doc.fillColor('#333').fontSize(11);
        doc.text(`Room ${idx + 1}: ${room.roomType ?? 'Standard'}`);
        doc.text(`Meal Plan: ${room.mealPlan ?? 'Room Only'}`);
        doc.text(`Adults: ${room.adults ?? 1} | Children: ${room.children ?? 0}`);
        const lead = room.leadGuest;
        if (lead) {
          doc.text(`Lead Guest: ${lead.title ?? ''} ${lead.firstName ?? ''} ${lead.lastName ?? ''}`);
        }
        doc.moveDown(0.5);
      });

      // Pricing
      doc.fillColor('#1a3c5e').fontSize(14).text('Payment Summary');
      doc.moveDown(0.5);
      doc.fillColor('#333').fontSize(11);
      doc.text(`Base Amount: ${formatAmount(booking.baseAmount)}`);
      if (booking.taxAmount > 0) doc.text(`Taxes: ${formatAmount(booking.taxAmount)}`);
      doc.text(`Total Amount: ${formatAmount(booking.totalAmount)}`);
      doc.text(`Payment Method: ${booking.paymentMethod}`);
      doc.moveDown(1);

      // Special requests
      if (booking.specialRequests) {
        doc.fillColor('#1a3c5e').fontSize(14).text('Special Requests');
        doc.fillColor('#333').fontSize(11).text(booking.specialRequests);
        doc.moveDown(1);
      }

      // Supplier booking ref
      if (booking.supplierBookingRef) {
        doc
          .fillColor('#666')
          .fontSize(9)
          .text(`Supplier Booking Reference: ${booking.supplierBookingRef}`, { align: 'center' });
      }

      // Footer
      doc.moveDown(2);
      doc.strokeColor('#ccc').lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.5);
      doc
        .fillColor('#999')
        .fontSize(8)
        .text(
          `Generated on ${new Date().toLocaleString('en-AE')} | This voucher is your booking confirmation.`,
          { align: 'center' },
        );

      doc.end();
    });
  }

  // ── Get voucher PDF stream ────────────────────────────────────────────────────

  async getVoucherPdf(id: string, companyId: string): Promise<Buffer> {
    const booking = await this.findOne(id, companyId);
    return this.generateVoucher(booking);
  }
}
