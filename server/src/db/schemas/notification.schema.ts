import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type NotificationDocument = Notification & Document;

export enum NotificationChannel {
  INAPP = 'inapp',
  EMAIL = 'email',
  SMS = 'sms',
}

export enum NotificationType {
  BOOKING_CONFIRMED = 'booking_confirmed',
  BOOKING_CANCELLED = 'booking_cancelled',
  PAYMENT_RECEIVED = 'payment_received',
  PAYMENT_FAILED = 'payment_failed',
  CREDIT_LOW = 'credit_low',
  CREDIT_ASSIGNED = 'credit_assigned',
  ACCOUNT_APPROVED = 'account_approved',
  ACCOUNT_SUSPENDED = 'account_suspended',
  LOYALTY_EARNED = 'loyalty_earned',
  PASSWORD_RESET = 'password_reset',
}

export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed',
}

@Schema({ timestamps: true })
export class Notification {
  @Prop({ type: Types.ObjectId, ref: 'User' })
  recipientUserId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Company' })
  recipientCompanyId?: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(NotificationChannel), required: true })
  channel: NotificationChannel;

  @Prop({ type: String, enum: Object.values(NotificationType), required: true })
  type: NotificationType;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  message: string;

  @Prop({ type: Object })
  data?: Record<string, unknown>;

  @Prop()
  readAt?: Date;

  @Prop({ required: true })
  sentAt: Date;

  @Prop({ type: String, enum: Object.values(NotificationStatus), default: NotificationStatus.PENDING })
  status: NotificationStatus;

  createdAt: Date;
  updatedAt: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

NotificationSchema.index({ recipientUserId: 1, createdAt: -1 });
NotificationSchema.index({ recipientCompanyId: 1, createdAt: -1 });
NotificationSchema.index({ readAt: 1 });
