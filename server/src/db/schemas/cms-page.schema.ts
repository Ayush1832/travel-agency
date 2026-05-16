import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CmsPageDocument = CmsPage & Document;

@Schema({ _id: false })
class SeoMeta {
  @Prop() metaTitle?: string;
  @Prop() metaDescription?: string;
  @Prop({ type: [String], default: [] }) keywords: string[];
}

@Schema({ timestamps: true })
export class CmsPage {
  @Prop({ required: true, unique: true, lowercase: true })
  slug: string;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  body: string;

  @Prop({ type: SeoMeta })
  seo?: SeoMeta;

  @Prop({ default: false })
  isPublished: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export const CmsPageSchema = SchemaFactory.createForClass(CmsPage);
