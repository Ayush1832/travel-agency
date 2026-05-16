import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type WalletTransactionDocument = WalletTransaction & Document;

export enum WalletTransactionType {
  TOPUP = 'topup',
  CREDIT_USE = 'credit_use',
  CREDIT_REFUND = 'credit_refund',
  SETTLEMENT = 'settlement',
  ADJUSTMENT = 'adjustment',
  LOYALTY_EARN = 'loyalty_earn',
  LOYALTY_REDEEM = 'loyalty_redeem',
}

export enum WalletTransactionDirection {
  CREDIT = 'credit',
  DEBIT = 'debit',
}

@Schema({ timestamps: false })
export class WalletTransaction {
  @Prop({ type: Types.ObjectId, ref: 'Company', required: true })
  companyId: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(WalletTransactionType), required: true })
  type: WalletTransactionType;

  @Prop({ type: String, enum: Object.values(WalletTransactionDirection), required: true })
  direction: WalletTransactionDirection;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true })
  balanceAfter: number;

  @Prop({ type: Number })
  pointsAmount?: number;

  @Prop({ type: Number })
  pointsBalanceAfter?: number;

  @Prop({ type: Types.ObjectId, ref: 'Booking' })
  refBookingId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Payment' })
  refPaymentId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Settlement' })
  refSettlementId?: Types.ObjectId;

  @Prop()
  description?: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  performedBy: Types.ObjectId;

  @Prop({ default: () => new Date() })
  createdAt: Date;
}

export const WalletTransactionSchema = SchemaFactory.createForClass(WalletTransaction);

WalletTransactionSchema.index({ companyId: 1, createdAt: -1 });
WalletTransactionSchema.index({ type: 1 });
