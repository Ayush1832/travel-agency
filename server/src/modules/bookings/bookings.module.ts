import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { Booking, BookingSchema } from '../../db/schemas/booking.schema';
import { BookingSequence, BookingSequenceSchema } from '../../db/schemas/booking-sequence.schema';
import { IntegrationsModule } from '../integrations/integrations.module';
import { CompaniesModule } from '../companies/companies.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Booking.name, schema: BookingSchema },
      { name: BookingSequence.name, schema: BookingSequenceSchema },
    ]),
    IntegrationsModule,
    CompaniesModule,
  ],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
