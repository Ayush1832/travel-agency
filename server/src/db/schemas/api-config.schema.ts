import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ApiConfigDocument = ApiConfig & Document;

export enum ApiConfigType {
  HOTEL_SUPPLIER = 'hotel_supplier',
  PAYMENT_GATEWAY = 'payment_gateway',
  EMAIL = 'email',
  SMS = 'sms',
  MAPS = 'maps',
}

@Schema({ timestamps: true })
export class ApiConfig {
  @Prop({ required: true, unique: true })
  provider: string;

  @Prop({ type: String, enum: Object.values(ApiConfigType), required: true })
  type: ApiConfigType;

  @Prop({ type: Object, default: {} })
  config: Record<string, unknown>;

  @Prop({ default: 0 })
  markupPercent: number;

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  lastTestedAt?: Date;

  @Prop()
  lastTestResult?: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export const ApiConfigSchema = SchemaFactory.createForClass(ApiConfig);
