import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SupportTicketDocument = SupportTicket & Document;

export enum TicketCategory {
  BOOKING = 'booking',
  PAYMENT = 'payment',
  CREDIT = 'credit',
  TECHNICAL = 'technical',
  OTHER = 'other',
}

export enum TicketPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum TicketStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
}

@Schema({ _id: false })
class TicketMessage {
  @Prop({ type: Types.ObjectId, required: true })
  fromUserId: Types.ObjectId;

  @Prop({ type: String, enum: ['client', 'admin'], required: true })
  fromType: 'client' | 'admin';

  @Prop({ required: true })
  body: string;

  @Prop({ type: [String], default: [] })
  attachments: string[];

  @Prop({ default: () => new Date() })
  createdAt: Date;
}

@Schema({ timestamps: true })
export class SupportTicket {
  @Prop({ required: true, unique: true })
  ticketNo: string;

  @Prop({ type: Types.ObjectId, ref: 'Company', required: true })
  companyId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  subject: string;

  @Prop({ type: String, enum: Object.values(TicketCategory), required: true })
  category: TicketCategory;

  @Prop({ type: String, enum: Object.values(TicketPriority), required: true })
  priority: TicketPriority;

  @Prop({ type: String, enum: Object.values(TicketStatus), default: TicketStatus.OPEN })
  status: TicketStatus;

  @Prop()
  bookingRef?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  assignedTo?: Types.ObjectId;

  @Prop({ type: [TicketMessage], default: [] })
  messages: TicketMessage[];

  createdAt: Date;
  updatedAt: Date;
}

export const SupportTicketSchema = SchemaFactory.createForClass(SupportTicket);

SupportTicketSchema.index({ companyId: 1, createdAt: -1 });
SupportTicketSchema.index({ status: 1 });
SupportTicketSchema.index({ assignedTo: 1 });
