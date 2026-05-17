import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QUEUE_SMS, JOB_SEND_SMS } from './jobs.constants';
import { NotificationsService } from '../modules/notifications/notifications.service';

export interface SmsJobData {
  to: string;
  body: string;
}

@Processor(QUEUE_SMS)
export class SmsProcessor extends WorkerHost {
  private readonly logger = new Logger(SmsProcessor.name);

  constructor(private readonly notificationsService: NotificationsService) {
    super();
  }

  async process(job: Job<SmsJobData>): Promise<void> {
    if (job.name !== JOB_SEND_SMS) return;

    const { to, body } = job.data;
    this.logger.log(`[SmsJob] Sending SMS to ${to} — preview: "${body.slice(0, 60)}"`);
    await this.notificationsService.directSendSms(to, body);
    this.logger.log(`[SmsJob] Sent successfully to ${to}`);
  }
}
