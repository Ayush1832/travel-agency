import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QUEUE_SETTLEMENT_REMINDER, JOB_SEND_SETTLEMENT_REMINDER } from './jobs.constants';

export interface SettlementReminderJobData {
  companyId: string;
  companyName: string;
  outstandingBalance: number;
  currency: string;
  adminId: string;
}

@Processor(QUEUE_SETTLEMENT_REMINDER)
export class SettlementReminderProcessor extends WorkerHost {
  private readonly logger = new Logger(SettlementReminderProcessor.name);

  async process(job: Job<SettlementReminderJobData>): Promise<void> {
    if (job.name !== JOB_SEND_SETTLEMENT_REMINDER) return;

    const { companyId, companyName, outstandingBalance, currency } = job.data;
    this.logger.log(
      `[SettlementReminderJob] Sending reminder to ${companyName} (${companyId}) — outstanding: ${outstandingBalance} ${currency}`,
    );
    // NotificationsService.send() with outstanding_reminder template is called from AdminService.
    this.logger.log(`[SettlementReminderJob] Reminder sent for ${companyId}`);
  }
}
