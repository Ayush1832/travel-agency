import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TicketSequenceDocument = TicketSequence & Document;

@Schema({ collection: 'ticket_sequences' })
export class TicketSequence {
  @Prop({ required: true, unique: true })
  year: number;

  @Prop({ required: true, default: 0 })
  seq: number;
}

export const TicketSequenceSchema = SchemaFactory.createForClass(TicketSequence);
