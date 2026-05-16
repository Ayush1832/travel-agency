import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AuditLogDocument = AuditLog & Document;

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class AuditLog {
  @Prop({ type: Types.ObjectId, required: true }) actorId: Types.ObjectId;

  @Prop({ required: true }) actorType: string;

  @Prop({ required: true }) action: string;

  @Prop({ required: true }) module: string;

  @Prop({ type: Types.ObjectId }) targetId?: Types.ObjectId;

  @Prop({ type: Object }) before?: Record<string, unknown>;

  @Prop({ type: Object }) after?: Record<string, unknown>;

  @Prop() ip?: string;

  @Prop() userAgent?: string;

  createdAt: Date;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

AuditLogSchema.index({ actorId: 1, createdAt: -1 });
AuditLogSchema.index({ module: 1, createdAt: -1 });
