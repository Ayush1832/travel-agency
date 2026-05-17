import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  WalletTransaction,
  WalletTransactionSchema,
} from '../../db/schemas/wallet-transaction.schema';
import { Settlement, SettlementSchema } from '../../db/schemas/settlement.schema';
import { Company, CompanySchema } from '../../db/schemas/company.schema';
import { LoyaltyRule, LoyaltyRuleSchema } from '../../db/schemas/loyalty-rule.schema';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { CompaniesModule } from '../companies/companies.module';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WalletTransaction.name, schema: WalletTransactionSchema },
      { name: Settlement.name, schema: SettlementSchema },
      { name: Company.name, schema: CompanySchema },
      { name: LoyaltyRule.name, schema: LoyaltyRuleSchema },
    ]),
    CompaniesModule,
    PaymentsModule,
  ],
  providers: [WalletService],
  controllers: [WalletController],
  exports: [WalletService],
})
export class WalletModule {}
