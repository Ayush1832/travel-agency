import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CmsBannerDocument = CmsBanner & Document;

@Schema({ timestamps: true })
export class CmsBanner {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  imageUrl: string;

  @Prop()
  linkUrl?: string;

  @Prop()
  altText?: string;

  @Prop({ default: 0 })
  sortOrder: number;

  @Prop({ required: true })
  isActive: boolean;

  @Prop()
  scheduledFrom?: Date;

  @Prop()
  scheduledTo?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export const CmsBannerSchema = SchemaFactory.createForClass(CmsBanner);
