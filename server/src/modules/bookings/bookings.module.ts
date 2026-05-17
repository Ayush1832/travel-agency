import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { Booking, BookingSchema } from '../../db/schemas/booking.schema';
import { BookingSequence, BookingSequenceSchema } from '../../db/schemas/booking-sequence.schema';
import { ApiConfig, ApiConfigSchema } from '../../db/schemas/api-config.schema';
import { WalletTransaction, WalletTransactionSchema } from '../../db/schemas/wallet-transaction.schema';
import { LoyaltyRule, LoyaltyRuleSchema } from '../../db/schemas/loyalty-rule.schema';
import { IntegrationsModule } from '../integrations/integrations.module';
import { CompaniesModule } from '../companies/companies.module';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Booking.name, schema: BookingSchema },
      { name: BookingSequence.name, schema: BookingSequenceSchema },
      { name: ApiConfig.name, schema: ApiConfigSchema },
      { name: WalletTransaction.name, schema: WalletTransactionSchema },
      { name: LoyaltyRule.name, schema: LoyaltyRuleSchema },
    ]),
    IntegrationsModule,
    CompaniesModule,
    WalletModule,
  ],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
