import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type BookingSequenceDocument = BookingSequence & Document;

@Schema({ collection: 'booking_sequences' })
export class BookingSequence {
  @Prop({ required: true, unique: true })
  year: number;

  @Prop({ required: true, default: 0 })
  seq: number;
}

export const BookingSequenceSchema = SchemaFactory.createForClass(BookingSequence);
