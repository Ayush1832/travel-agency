import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Booking, BookingDocument } from '../db/schemas/booking.schema';
import { QUEUE_VOUCHER, JOB_GENERATE_VOUCHER } from './jobs.constants';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit') as typeof import('pdfkit');

export interface VoucherJobData {
  bookingId: string;
}

@Processor(QUEUE_VOUCHER)
export class VoucherProcessor extends WorkerHost {
  private readonly logger = new Logger(VoucherProcessor.name);

  constructor(
    @InjectModel(Booking.name) private readonly bookingModel: Model<BookingDocument>,
  ) {
    super();
  }

  async process(job: Job<VoucherJobData>): Promise<void> {
    if (job.name !== JOB_GENERATE_VOUCHER) return;

    const { bookingId } = job.data;
    this.logger.log(`[VoucherJob] Generating voucher for booking ${bookingId}`);

    const booking = await this.bookingModel.findById(bookingId).lean();
    if (!booking) {
      this.logger.warn(`[VoucherJob] Booking ${bookingId} not found`);
      return;
    }

    // Generate PDF in-memory
    const pdfBuffer = await this.generatePdf(booking as unknown as Record<string, unknown>);

    // In production: upload to S3 and update booking.voucherUrl
    // For now: log success (S3 wired via EncryptionService / AWS SDK in next phase)
    this.logger.log(
      `[VoucherJob] PDF generated for ${booking.bookingRef} — ${pdfBuffer.length} bytes`,
    );
  }

  private generatePdf(booking: Record<string, unknown>): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const hotel = booking.hotel as Record<string, unknown>;
      const rooms = (booking.rooms as unknown[]) ?? [];

      doc.fontSize(22).font('Helvetica-Bold').text('BOOKING VOUCHER', { align: 'center' });
      doc.moveDown();
      doc.fontSize(14).font('Helvetica').text(`Booking Reference: ${booking.bookingRef ?? '-'}`);
      doc.text(`Status: ${booking.status ?? '-'}`);
      doc.moveDown();

      doc.fontSize(16).font('Helvetica-Bold').text('Hotel Details');
      doc.fontSize(12).font('Helvetica');
      doc.text(`Hotel: ${(hotel?.name as string) ?? '-'}`);
      doc.text(`City: ${(hotel?.city as string) ?? '-'}, ${(hotel?.country as string) ?? '-'}`);
      doc.text(`Star Rating: ${hotel?.starRating ?? '-'}`);
      doc.moveDown();

      doc.fontSize(16).font('Helvetica-Bold').text('Stay Details');
      doc.fontSize(12).font('Helvetica');
      doc.text(`Check-in: ${booking.checkIn ? new Date(booking.checkIn as string).toDateString() : '-'}`);
      doc.text(`Check-out: ${booking.checkOut ? new Date(booking.checkOut as string).toDateString() : '-'}`);
      doc.text(`Nights: ${booking.nights ?? '-'}`);
      doc.moveDown();

      if (rooms.length > 0) {
        doc.fontSize(16).font('Helvetica-Bold').text('Rooms');
        doc.fontSize(12).font('Helvetica');
        rooms.forEach((room, i) => {
          const r = room as Record<string, unknown>;
          const lg = r.leadGuest as Record<string, unknown> | undefined;
          doc.text(`Room ${i + 1}: ${r.roomType ?? '-'} — ${r.mealPlan ?? '-'}`);
          if (lg) doc.text(`  Lead Guest: ${lg.title ?? ''} ${lg.firstName ?? ''} ${lg.lastName ?? ''}`);
        });
        doc.moveDown();
      }

      doc.fontSize(16).font('Helvetica-Bold').text('Payment Summary');
      doc.fontSize(12).font('Helvetica');
      doc.text(`Total: ${((booking.totalAmount as number) ?? 0) / 100} ${booking.currency ?? 'AED'}`);
      doc.text(`Payment Method: ${booking.paymentMethod ?? '-'}`);
      doc.text(`Supplier Ref: ${booking.supplierBookingRef ?? '-'}`);
      doc.moveDown();

      doc.fontSize(10).fillColor('#888888').text(
        'This voucher is your proof of booking. Please present it at check-in.',
        { align: 'center' },
      );

      doc.end();
    });
  }
}
