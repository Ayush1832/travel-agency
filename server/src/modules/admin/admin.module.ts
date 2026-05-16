import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { CompaniesModule } from '../companies/companies.module';
import { UsersModule } from '../users/users.module';
import { SupportModule } from '../support/support.module';

import { Company, CompanySchema } from '../../db/schemas/company.schema';
import { User, UserSchema } from '../../db/schemas/user.schema';
import { Role, RoleSchema } from '../../db/schemas/role.schema';
import { Booking, BookingSchema } from '../../db/schemas/booking.schema';
import {
  WalletTransaction,
  WalletTransactionSchema,
} from '../../db/schemas/wallet-transaction.schema';
import { Settlement, SettlementSchema } from '../../db/schemas/settlement.schema';
import { ApiConfig, ApiConfigSchema } from '../../db/schemas/api-config.schema';
import { LoyaltyRule, LoyaltyRuleSchema } from '../../db/schemas/loyalty-rule.schema';
import { Notification, NotificationSchema } from '../../db/schemas/notification.schema';

@Module({
  imports: [
    CompaniesModule,
    UsersModule,
    SupportModule,
    MongooseModule.forFeature([
      { name: Company.name, schema: CompanySchema },
      { name: User.name, schema: UserSchema },
      { name: Role.name, schema: RoleSchema },
      { name: Booking.name, schema: BookingSchema },
      { name: WalletTransaction.name, schema: WalletTransactionSchema },
      { name: Settlement.name, schema: SettlementSchema },
      { name: ApiConfig.name, schema: ApiConfigSchema },
      { name: LoyaltyRule.name, schema: LoyaltyRuleSchema },
      { name: Notification.name, schema: NotificationSchema },
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
