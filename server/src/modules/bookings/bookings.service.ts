import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  HttpException,
} from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Types, Connection } from 'mongoose';
// eslint-disable-next-line @typescript-eslint/no-require-imports,@typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit') as typeof import('pdfkit');
import { Booking, BookingDocument, BookingStatus, BookingCurrency, BookingPaymentMethod, BookingSupplier, RefundStatus } from '../../db/schemas/booking.schema';
import { BookingSequence, BookingSequenceDocument } from '../../db/schemas/booking-sequence.schema';
import { ApiConfig, ApiConfigDocument } from '../../db/schemas/api-config.schema';
import { WalletTransaction, WalletTransactionDocument, WalletTransactionType, WalletTransactionDirection } from '../../db/schemas/wallet-transaction.schema';
import { LoyaltyRule, LoyaltyRuleDocument } from '../../db/schemas/loyalty-rule.schema';
import { CompaniesService } from '../companies/companies.service';
import { WalletService } from '../wallet/wallet.service';
import { TboService } from '../integrations/tbo/tbo.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { GuestInfo } from '../integrations/supplier.interface';

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
    @InjectModel(BookingSequence.name) private sequenceModel: Model<BookingSequenceDocument>,
    @InjectModel(ApiConfig.name) private apiConfigModel: Model<ApiConfigDocument>,
    @InjectModel(WalletTransaction.name) private walletTxModel: Model<WalletTransactionDocument>,
    @InjectModel(LoyaltyRule.name) private loyaltyRuleModel: Model<LoyaltyRuleDocument>,
    private readonly companiesService: CompaniesService,
    private readonly walletService: WalletService,
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

  private async awardLoyaltyPoints(
    companyId: string,
    userId: string,
    totalAmountFils: number,
    currency: string,
    hotelId: string | undefined,
    bookingId: string,
  ): Promise<void> {
    try {
      const rule = await this.loyaltyRuleModel.findOne({ isActive: true }).lean();
      if (!rule) return;

      // Hotel eligibility: if eligibleHotelIds is non-empty, hotel must be in the list
      if (rule.eligibleHotelIds?.length && hotelId && !rule.eligibleHotelIds.includes(hotelId)) {
        this.logger.log(`Hotel ${hotelId} not eligible for loyalty points`);
        return;
      }

      // Convert to AED-equivalent fils for point calculation
      const aedFils = currency === 'USD' ? Math.round(totalAmountFils * 3.67) : totalAmountFils;
      const minAmountFils = (rule.minBookingAmountAed ?? 0) * 100;
      if (aedFils < minAmountFils) return;

      const points = WalletService.computeLoyaltyPoints(aedFils, rule.pointsPerAed);
      if (points <= 0) return;

      const expiresAt = rule.expirationPeriodDays > 0
        ? new Date(Date.now() + rule.expirationPeriodDays * 24 * 60 * 60 * 1000)
        : undefined;

      await this.walletService.addLoyaltyPoints(companyId, userId, points, bookingId, expiresAt);
      this.logger.log(`Awarded ${points} loyalty points to company ${companyId} for booking ${bookingId}`);
    } catch (e) {
      this.logger.warn(`Loyalty point award failed: ${(e as Error).message}`);
    }
  }

  // ── Create booking ────────────────────────────────────────────────────────────

  async createBooking(
    dto: CreateBookingDto,
    user: { _id: string | Types.ObjectId; companyId: string | Types.ObjectId },
    company: { _id: string | Types.ObjectId },
  ) {
    const companyId = String(user.companyId ?? company._id);
    const userId = String(user._id);

    // ── Credit booking flow (ATOMIC) ──────────────────────────────────────────────
    if (dto.paymentMethod === 'credit') {
      // Prebook to get final price (external call — outside transaction)
      const prebook = await this.tboService.prebook(dto.roomToken);
      const baseAmount = prebook.finalPrice;
      const markupPct = await this.getMarkupPercent('tbo');
      const { total: totalAmount, markup: markupAmount } = this.applyMarkup(baseAmount, markupPct);

      // Validate dates from prebook
      const checkIn = prebook.checkIn ? new Date(prebook.checkIn) : new Date();
      const checkOut = prebook.checkOut ? new Date(prebook.checkOut) : new Date(checkIn.getTime() + 86400000);
      const nights = this.calcNights(checkIn, checkOut);

      // STEP 1: Atomically deduct credit — prevents race conditions where two parallel
      // requests both pass the credit check. Uses conditional findOneAndUpdate.
      await this.companiesService.atomicDeductCredit(companyId, totalAmount);

      // Map guests to supplier format
      const guestInfos: GuestInfo[] = dto.guests.map((g) => ({
        firstName: g.firstName,
        lastName: g.lastName,
        title: g.title,
        adults: g.adults ?? 2,
        children: g.children ?? 0,
      }));

      // STEP 2: Call TBO book — external call, NOT inside transaction.
      // If this fails, we must compensate (rollback outstanding increment).
      let bookResult;
      try {
        bookResult = await this.tboService.book(prebook.prebookToken, guestInfos);
      } catch (err) {
        // COMPENSATING ACTION: rollback the outstanding increment
        this.logger.error(
          `[CRITICAL] TBO book() failed after credit deduction for company ${companyId}. Rolling back ${totalAmount} outstanding.`,
          (err as Error).message,
        );
        try {
          await this.companiesService.creditBack(companyId, totalAmount);
          this.logger.log(`[COMPENSATING] Credit rollback successful for company ${companyId}`);
        } catch (rollbackErr) {
          this.logger.error(
            `[CRITICAL] Credit rollback FAILED for company ${companyId}. Manual intervention required! Amount: ${totalAmount}`,
            (rollbackErr as Error).message,
          );
        }
        throw new HttpException('Booking failed at supplier level. Credit has been refunded.', 502);
      }

      if (!bookResult.confirmed) {
        await this.companiesService.creditBack(companyId, totalAmount);
        throw new BadRequestException('Booking was not confirmed by supplier. Credit refunded.');
      }

      // STEP 3: Persist booking + wallet ledger entry in a Mongo transaction
      const session = await this.connection.startSession();
      let saved: BookingDocument;
      try {
        await session.withTransaction(async () => {
          const bookingRef = await this.generateBookingRef();
          const rooms = dto.guests.map((g) => ({
            roomType: prebook.room.roomType,
            mealPlan: prebook.room.mealPlan,
            refundable: prebook.room.refundable,
            cancellationPolicy: prebook.room.cancellationPolicy.map((p) => ({
              from: new Date(p.from),
              to: new Date(p.to),
              amount: p.amount,
            })),
            adults: g.adults ?? 2,
            children: g.children ?? 0,
            childrenAges: [] as number[],
            leadGuest: { firstName: g.firstName, lastName: g.lastName, title: g.title },
            guests: [] as unknown[],
          }));

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const [booking] = await (this.bookingModel as any).create(
            [{
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
              currency: (dto.currency ?? 'AED') as BookingCurrency,
              baseAmount,
              taxAmount: 0,
              totalAmount,
              markupAmount,
              paymentMethod: BookingPaymentMethod.CREDIT,
              status: BookingStatus.CONFIRMED,
              specialRequests: dto.specialRequests ?? '',
              apiRaw: { prebook, bookResult },
            }],
            { session },
          );
          saved = booking as BookingDocument;

          // Wallet ledger entry: record the credit debit
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (this.walletTxModel as any).create(
            [{
              companyId: new Types.ObjectId(companyId),
              type: WalletTransactionType.CREDIT_USE,
              direction: WalletTransactionDirection.DEBIT,
              amount: totalAmount,
              description: `Booking ${bookingRef}`,
              refBookingId: booking._id,
              performedBy: new Types.ObjectId(userId),
            }],
            { session },
          );
        });
      } finally {
        await session.endSession();
      }

      // Best-effort: loyalty points (non-critical, outside transaction)
      void this.awardLoyaltyPoints(
        companyId, userId, totalAmount, dto.currency ?? 'AED',
        bookResult.hotel?.supplierHotelId || prebook.hotel?.supplierHotelId,
        String(saved!._id),
      );

      return saved!;
    }

    // ── Online payment flow ────────────────────────────────────────────────────

    if (dto.paymentMethod === 'online') {
      if (!dto.paymentId) {
        throw new BadRequestException('paymentId is required for online payment bookings');
      }

      // Prebook to get final price
      const prebook = await this.tboService.prebook(dto.roomToken);
      const onlineBaseAmount = prebook.finalPrice;
      const onlineMarkupPct = await this.getMarkupPercent('tbo');
      const { total: totalAmount, markup: onlineMarkupAmount } = this.applyMarkup(onlineBaseAmount, onlineMarkupPct);

      const guestInfos: GuestInfo[] = dto.guests.map((g) => ({
        firstName: g.firstName,
        lastName: g.lastName,
        title: g.title,
        adults: g.adults ?? 2,
        children: g.children ?? 0,
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
          currency: (dto.currency ?? 'AED') as BookingCurrency,
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

      const checkIn = prebook.checkIn ? new Date(prebook.checkIn) : new Date();
      const checkOut = prebook.checkOut ? new Date(prebook.checkOut) : new Date(checkIn.getTime() + 86400000);
      const nights = this.calcNights(checkIn, checkOut);

      const rooms = dto.guests.map((g) => ({
        roomType: prebook.room.roomType,
        mealPlan: prebook.room.mealPlan,
        refundable: prebook.room.refundable,
        cancellationPolicy: prebook.room.cancellationPolicy.map((p) => ({
          from: new Date(p.from),
          to: new Date(p.to),
          amount: p.amount,
        })),
        adults: g.adults ?? 2,
        children: g.children ?? 0,
        childrenAges: [] as number[],
        leadGuest: { firstName: g.firstName, lastName: g.lastName, title: g.title },
        guests: [] as unknown[],
      }));

      // Persist booking atomically
      const onlineSession = await this.connection.startSession();
      let onlineSaved: BookingDocument;
      try {
        await onlineSession.withTransaction(async () => {
          const bookingRef = await this.generateBookingRef();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const [booking] = await (this.bookingModel as any).create(
            [{
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
              currency: (dto.currency ?? 'AED') as BookingCurrency,
              baseAmount: onlineBaseAmount,
              taxAmount: 0,
              totalAmount,
              markupAmount: onlineMarkupAmount,
              paymentMethod: BookingPaymentMethod.ONLINE,
              paymentId: new Types.ObjectId(dto.paymentId),
              status: bookResult.confirmed ? BookingStatus.CONFIRMED : BookingStatus.FAILED,
              specialRequests: dto.specialRequests ?? '',
              apiRaw: { prebook, bookResult },
            }],
            { session: onlineSession },
          );
          onlineSaved = booking as BookingDocument;
        });
      } finally {
        await onlineSession.endSession();
      }

      // Award loyalty points for online payments (best-effort, outside transaction)
      if (bookResult.confirmed) {
        void this.awardLoyaltyPoints(
          companyId, userId, totalAmount, dto.currency ?? 'AED',
          bookResult.hotel?.supplierHotelId || prebook.hotel?.supplierHotelId,
          String(onlineSaved!._id),
        );
      }

      return onlineSaved!;
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
          // Record the refund in the wallet ledger
          await this.walletTxModel.create({
            companyId: new Types.ObjectId(companyId),
            type: WalletTransactionType.CREDIT_REFUND,
            direction: WalletTransactionDirection.CREDIT,
            amount: refundableAmount,
            description: `Refund for cancelled booking ${booking.bookingRef}`,
            refBookingId: booking._id,
            performedBy: new Types.ObjectId(String(user._id)),
          });
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
