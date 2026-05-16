import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SettlementDocument = Settlement & Document;

export enum SettlementMode {
  BANK_TRANSFER = 'bank_transfer',
  CHEQUE = 'cheque',
  CASH = 'cash',
  GATEWAY = 'gateway',
}

export enum SettlementCurrency {
  AED = 'AED',
  USD = 'USD',
}

@Schema({ _id: false })
class AppliedToEntry {
  @Prop({ type: Types.ObjectId, ref: 'Booking' })
  bookingId: Types.ObjectId;

  @Prop({ required: true })
  amountApplied: number;
}

@Schema({ timestamps: true })
export class Settlement {
  @Prop({ type: Types.ObjectId, ref: 'Company', required: true })
  companyId: Types.ObjectId;

  @Prop({ required: true })
  amount: number;

  @Prop({ type: String, enum: Object.values(SettlementCurrency), required: true })
  currency: SettlementCurrency;

  @Prop({ type: String, enum: Object.values(SettlementMode), required: true })
  mode: SettlementMode;

  @Prop()
  referenceNo?: string;

  @Prop()
  attachmentUrl?: string;

  @Prop()
  notes?: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  recordedBy: Types.ObjectId;

  @Prop({ required: true })
  recordedAt: Date;

  @Prop({ type: [AppliedToEntry], default: [] })
  appliedTo: AppliedToEntry[];

  createdAt: Date;
  updatedAt: Date;
}

export const SettlementSchema = SchemaFactory.createForClass(Settlement);

SettlementSchema.index({ companyId: 1, recordedAt: -1 });
