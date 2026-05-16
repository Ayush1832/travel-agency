import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { Notification, NotificationSchema } from '../../db/schemas/notification.schema';
import { User, UserSchema } from '../../db/schemas/user.schema';
import { Company, CompanySchema } from '../../db/schemas/company.schema';
import { CmsEmailTemplate, CmsEmailTemplateSchema } from '../../db/schemas/cms-email-template.schema';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
      { name: User.name, schema: UserSchema },
      { name: Company.name, schema: CompanySchema },
      { name: CmsEmailTemplate.name, schema: CmsEmailTemplateSchema },
    ]),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
