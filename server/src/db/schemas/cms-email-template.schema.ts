import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CmsEmailTemplateDocument = CmsEmailTemplate & Document;

@Schema({ timestamps: true })
export class CmsEmailTemplate {
  @Prop({ required: true, unique: true })
  key: string;

  @Prop({ required: true })
  subject: string;

  @Prop({ required: true })
  body: string;

  @Prop({ type: [String], default: [] })
  variables: string[];

  @Prop({ default: true })
  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export const CmsEmailTemplateSchema = SchemaFactory.createForClass(CmsEmailTemplate);
