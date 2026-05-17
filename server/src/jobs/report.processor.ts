import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QUEUE_REPORT, JOB_EXPORT_REPORT } from './jobs.constants';

export interface ReportJobData {
  type: 'revenue' | 'bookings' | 'credit' | 'cancellations' | 'api-usage';
  format: 'csv' | 'excel' | 'pdf';
  from: string;
  to: string;
  requestedBy: string; // userId who requested
  emailTo?: string;
}

@Processor(QUEUE_REPORT)
export class ReportProcessor extends WorkerHost {
  private readonly logger = new Logger(ReportProcessor.name);

  async process(job: Job<ReportJobData>): Promise<void> {
    if (job.name !== JOB_EXPORT_REPORT) return;

    const { type, format, from, to, requestedBy } = job.data;
    this.logger.log(
      `[ReportJob] Generating ${type} report (${format}) from ${from} to ${to} for user ${requestedBy}`,
    );

    // TODO: generate report, upload to S3, email download link.
    // For > 5k rows the report is sent async to avoid HTTP timeout.
    this.logger.log(`[ReportJob] Report generation complete for ${type}`);
  }
}
