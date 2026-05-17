import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type LoyaltyRuleDocument = LoyaltyRule & Document;

@Schema({ timestamps: true })
export class LoyaltyRule {
  @Prop({ required: true })
  name: string;

  /** Points earned per AED spent (e.g. 1 = 1 point per AED) */
  @Prop({ required: true })
  pointsPerAed: number;

  /** Fils credited to wallet per point redeemed (e.g. 100 = 1 AED per point) */
  @Prop({ required: true, default: 1 })
  pointValueFils: number;

  /** Minimum booking amount in AED to earn points */
  @Prop({ default: 0 })
  minBookingAmountAed: number;

  /** How many days earned points are valid before expiry (0 = never expire) */
  @Prop({ required: true, default: 0 })
  expirationPeriodDays: number;

  /** TBO hotel IDs eligible for point earning (empty = all hotels eligible) */
  @Prop({ type: [String], default: [] })
  eligibleHotelIds: string[];

  @Prop({ default: true })
  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export const LoyaltyRuleSchema = SchemaFactory.createForClass(LoyaltyRule);
