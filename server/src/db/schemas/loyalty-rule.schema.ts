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

  /** AED per point for redemption (e.g. 0.01 = 1 fil per point) */
  @Prop({ required: true })
  redemptionRate: number;

  /** Minimum booking amount in AED to earn points */
  @Prop({ default: 0 })
  minBookingAmountAed: number;

  @Prop({ default: true })
  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export const LoyaltyRuleSchema = SchemaFactory.createForClass(LoyaltyRule);
