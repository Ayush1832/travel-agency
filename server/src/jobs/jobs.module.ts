import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { Booking, BookingSchema } from '../db/schemas/booking.schema';
import { NotificationsModule } from '../modules/notifications/notifications.module';
import {
  QUEUE_VOUCHER,
  QUEUE_EMAIL,
  QUEUE_REPORT,
  QUEUE_SETTLEMENT_REMINDER,
} from './jobs.constants';
import { VoucherProcessor } from './voucher.processor';
import { EmailProcessor } from './email.processor';
import { ReportProcessor } from './report.processor';
import { SettlementReminderProcessor } from './settlement-reminder.processor';

const DEFAULT_JOB_OPTIONS = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 200 },
};

@Module({
  imports: [
    ConfigModule,
    NotificationsModule,
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('redis.host') ?? 'localhost',
          port: config.get<number>('redis.port') ?? 6379,
          password: config.get<string>('redis.password'),
        },
      }),
    }),
    BullModule.registerQueue(
      { name: QUEUE_VOUCHER, defaultJobOptions: DEFAULT_JOB_OPTIONS },
      { name: QUEUE_EMAIL, defaultJobOptions: DEFAULT_JOB_OPTIONS },
      { name: QUEUE_REPORT, defaultJobOptions: DEFAULT_JOB_OPTIONS },
      { name: QUEUE_SETTLEMENT_REMINDER, defaultJobOptions: DEFAULT_JOB_OPTIONS },
    ),
    MongooseModule.forFeature([{ name: Booking.name, schema: BookingSchema }]),
  ],
  providers: [
    VoucherProcessor,
    EmailProcessor,
    ReportProcessor,
    SettlementReminderProcessor,
  ],
  exports: [BullModule],
})
export class JobsModule {}
