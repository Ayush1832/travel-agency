import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CompanyDocument = Company & Document;

export enum CompanyStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  REJECTED = 'rejected',
}

export enum SupportedCurrency {
  AED = 'AED',
  USD = 'USD',
}

@Schema({ _id: false })
class Address {
  @Prop({ required: true }) line1: string;
  @Prop() line2?: string;
  @Prop({ required: true }) city: string;
  @Prop() state?: string;
  @Prop({ required: true }) country: string;
  @Prop({ required: true }) postalCode: string;
}

@Schema({ timestamps: true })
export class Company {
  @Prop({ required: true }) name: string;

  @Prop({ required: true }) contactPerson: string;

  @Prop({ required: true, unique: true, lowercase: true }) email: string;

  @Prop({ required: true }) phone: string;

  @Prop({ type: Address, required: true }) address: Address;

  @Prop() taxId?: string;

  @Prop() businessRegistrationNo?: string;

  @Prop({ type: String, enum: Object.values(CompanyStatus), default: CompanyStatus.PENDING })
  status: CompanyStatus;

  /** Credit limit assigned by admin (in minor units — fils for AED, cents for USD) */
  @Prop({ default: 0 }) creditLimit: number;

  /** Top-up wallet balance (in minor units) */
  @Prop({ default: 0 }) walletBalance: number;

  /** Loyalty points balance */
  @Prop({ default: 0 }) loyaltyPoints: number;

  @Prop({ type: String, enum: Object.values(SupportedCurrency), default: SupportedCurrency.AED })
  currency: SupportedCurrency;

  @Prop({ type: Types.ObjectId, ref: 'User' }) approvedBy?: Types.ObjectId;

  @Prop() approvedAt?: Date;

  @Prop() notes?: string;

  /** Soft delete */
  @Prop() deletedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export const CompanySchema = SchemaFactory.createForClass(Company);

CompanySchema.index({ email: 1 }, { unique: true });
CompanySchema.index({ status: 1 });
