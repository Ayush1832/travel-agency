import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type BookingDocument = Booking & Document;

export enum BookingStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum BookingSupplier {
  TBO = 'tbo',
}

export enum BookingCurrency {
  AED = 'AED',
  USD = 'USD',
}

export enum BookingPaymentMethod {
  ONLINE = 'online',
  CREDIT = 'credit',
}

export enum RefundStatus {
  PENDING = 'pending',
  PROCESSED = 'processed',
  FAILED = 'failed',
}

// ── Nested schemas ─────────────────────────────────────────────────────────────

@Schema({ _id: false })
class CancellationPolicyItem {
  @Prop() from: Date;
  @Prop() to: Date;
  /** Amount in minor units */
  @Prop() amount: number;
}

@Schema({ _id: false })
class GuestDetail {
  @Prop({ required: true }) firstName: string;
  @Prop({ required: true }) lastName: string;
  @Prop({ required: true }) title: string;
  @Prop() dob?: Date;
}

@Schema({ _id: false })
class LeadGuest {
  @Prop({ required: true }) firstName: string;
  @Prop({ required: true }) lastName: string;
  @Prop({ required: true }) title: string;
}

@Schema({ _id: false })
class Room {
  @Prop() roomType: string;
  @Prop() mealPlan: string;
  @Prop({ default: true }) refundable: boolean;
  @Prop({ type: [{ from: Date, to: Date, amount: Number }], default: [] })
  cancellationPolicy: CancellationPolicyItem[];
  @Prop({ required: true }) adults: number;
  @Prop({ default: 0 }) children: number;
  @Prop({ type: [Number], default: [] }) childrenAges: number[];
  @Prop({ type: LeadGuest }) leadGuest: LeadGuest;
  @Prop({ type: [GuestDetail], default: [] }) guests: GuestDetail[];
}

@Schema({ _id: false })
class HotelInfo {
  @Prop({ required: true }) supplierHotelId: string;
  @Prop({ required: true }) name: string;
  @Prop() address: string;
  @Prop() city: string;
  @Prop() country: string;
  @Prop() starRating: number;
  @Prop() lat: number;
  @Prop() lng: number;
  @Prop() phone: string;
  @Prop() imageUrl: string;
}

@Schema({ _id: false })
class CancellationInfo {
  @Prop() cancelledAt?: Date;
  @Prop({ type: Types.ObjectId, ref: 'User' }) cancelledBy?: Types.ObjectId;
  /** Cancellation fee in minor units */
  @Prop({ default: 0 }) cancellationFee: number;
  /** Refund amount in minor units */
  @Prop({ default: 0 }) refundAmount: number;
  @Prop({ type: String, enum: Object.values(RefundStatus) }) refundStatus?: RefundStatus;
}

// ── Main booking schema ────────────────────────────────────────────────────────

@Schema({ timestamps: true })
export class Booking {
  /** Format: BK-2025-000001 */
  @Prop({ required: true, unique: true })
  bookingRef: string;

  @Prop({ type: Types.ObjectId, ref: 'Company', required: true })
  companyId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  bookedByUserId: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(BookingSupplier), default: BookingSupplier.TBO })
  supplier: BookingSupplier;

  @Prop()
  supplierBookingRef?: string;

  @Prop({ type: HotelInfo, required: true })
  hotel: HotelInfo;

  @Prop({ type: [Room], required: true })
  rooms: Room[];

  @Prop({ required: true }) checkIn: Date;
  @Prop({ required: true }) checkOut: Date;
  @Prop({ required: true }) nights: number;

  @Prop({ type: String, enum: Object.values(BookingCurrency), required: true })
  currency: BookingCurrency;

  /** All money in minor units (fils for AED, cents for USD) */
  @Prop({ required: true }) baseAmount: number;
  @Prop({ default: 0 }) taxAmount: number;
  @Prop({ required: true }) totalAmount: number;
  @Prop({ default: 0 }) markupAmount: number;

  @Prop({ type: String, enum: Object.values(BookingPaymentMethod), required: true })
  paymentMethod: BookingPaymentMethod;

  @Prop({ type: Types.ObjectId, ref: 'Payment' })
  paymentId?: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(BookingStatus), default: BookingStatus.PENDING })
  status: BookingStatus;

  /** S3 URL for voucher PDF */
  @Prop()
  voucherUrl?: string;

  @Prop({ default: '' })
  specialRequests: string;

  @Prop({ type: CancellationInfo })
  cancellation?: CancellationInfo;

  /** Raw TBO API request/response stored for debugging */
  @Prop({ type: Object })
  apiRaw?: Record<string, unknown>;

  /** Soft delete */
  @Prop()
  deletedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export const BookingSchema = SchemaFactory.createForClass(Booking);

BookingSchema.index({ companyId: 1, createdAt: -1 });
BookingSchema.index({ bookingRef: 1 }, { unique: true });
BookingSchema.index({ status: 1 });
BookingSchema.index({ checkIn: 1 });
