import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QUEUE_EMAIL, JOB_SEND_EMAIL } from './jobs.constants';
import { NotificationsService } from '../modules/notifications/notifications.service';

export interface EmailJobData {
  to: string;
  subject: string;
  html: string;
  notificationType?: string;
}

@Processor(QUEUE_EMAIL)
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(private readonly notificationsService: NotificationsService) {
    super();
  }

  async process(job: Job<EmailJobData>): Promise<void> {
    if (job.name !== JOB_SEND_EMAIL) return;

    const { to, subject, html } = job.data;

    // Validate to header to prevent CRLF injection
    const sanitizedTo = to.split(/[\r\n]/)[0].trim();
    if (sanitizedTo !== to.trim()) {
      this.logger.warn(`[EmailJob] Rejected job with CRLF in "to" field: ${JSON.stringify(to)}`);
      return;
    }

    this.logger.log(`[EmailJob] Sending email to ${sanitizedTo} — subject: "${subject}"`);
    await this.notificationsService.directSendEmail(sanitizedTo, subject, html);
    this.logger.log(`[EmailJob] Sent successfully to ${sanitizedTo}`);
  }
}
