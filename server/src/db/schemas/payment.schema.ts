import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PaymentDocument = Payment & Document;

export enum PaymentType {
  BOOKING_ONLINE = 'booking_online',
  WALLET_TOPUP = 'wallet_topup',
  REFUND = 'refund',
}

export enum PaymentGateway {
  PAYTABS = 'paytabs',
}

export enum PaymentStatus {
  CREATED = 'created',
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

export enum PaymentCurrency {
  AED = 'AED',
  USD = 'USD',
}

@Schema({ timestamps: true })
export class Payment {
  @Prop({ type: Types.ObjectId, ref: 'Company', required: true })
  companyId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(PaymentType), required: true })
  type: PaymentType;

  @Prop({ type: Types.ObjectId, ref: 'Booking' })
  bookingId?: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(PaymentGateway), required: true })
  gateway: PaymentGateway;

  @Prop({ type: String })
  gatewayOrderId: string;

  @Prop({ type: String })
  gatewayPaymentId: string;

  @Prop({ type: String })
  gatewaySignature: string;

  @Prop({ required: true })
  amount: number;

  @Prop({ type: String, enum: Object.values(PaymentCurrency), required: true })
  currency: PaymentCurrency;

  @Prop({ type: String, enum: Object.values(PaymentStatus), default: PaymentStatus.CREATED })
  status: PaymentStatus;

  @Prop()
  paidAt?: Date;

  @Prop({ type: Object })
  raw?: Record<string, unknown>;

  @Prop({ type: [Object], default: [] })
  webhookEvents: Record<string, unknown>[];

  @Prop()
  refundReason?: string;

  @Prop()
  refundedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);

PaymentSchema.index({ gatewayOrderId: 1 }, { unique: true, sparse: true });
PaymentSchema.index({ companyId: 1, createdAt: -1 });
PaymentSchema.index({ status: 1 });
