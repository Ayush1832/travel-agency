import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import {
  Notification,
  NotificationDocument,
  NotificationChannel,
  NotificationStatus,
  NotificationType,
} from '../../db/schemas/notification.schema';
import { User, UserDocument } from '../../db/schemas/user.schema';
import { Company, CompanyDocument } from '../../db/schemas/company.schema';
import { CmsEmailTemplate, CmsEmailTemplateDocument } from '../../db/schemas/cms-email-template.schema';

export interface SendNotificationDto {
  recipientUserId?: string;
  recipientCompanyId?: string;
  channel: NotificationChannel;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    @InjectModel(Company.name)
    private companyModel: Model<CompanyDocument>,
    @InjectModel(CmsEmailTemplate.name)
    private emailTemplateModel: Model<CmsEmailTemplateDocument>,
    private config: ConfigService,
  ) {}

  async send(dto: SendNotificationDto): Promise<NotificationDocument> {
    const notification = new this.notificationModel({
      recipientUserId: dto.recipientUserId ? new Types.ObjectId(dto.recipientUserId) : undefined,
      recipientCompanyId: dto.recipientCompanyId
        ? new Types.ObjectId(dto.recipientCompanyId)
        : undefined,
      channel: dto.channel,
      type: dto.type,
      title: dto.title,
      message: dto.message,
      data: dto.data,
      sentAt: new Date(),
      status: NotificationStatus.SENT,
    });

    await notification.save();

    if (dto.channel === NotificationChannel.EMAIL) {
      const recipientEmail = await this.resolveEmail(dto);
      if (recipientEmail) {
        const html = await this.renderEmailTemplate(dto.type, dto.title, dto.message, dto.data);
        await this.sendEmail(recipientEmail, dto.title, html);
      } else {
        this.logger.warn('[Email Notification] Could not resolve recipient email', {
          recipientUserId: dto.recipientUserId,
          recipientCompanyId: dto.recipientCompanyId,
          type: dto.type,
        });
      }
    }

    return notification;
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private async resolveEmail(dto: SendNotificationDto): Promise<string | null> {
    if (dto.recipientUserId) {
      const user = await this.userModel
        .findById(dto.recipientUserId)
        .select('email')
        .lean();
      return user?.email ?? null;
    }
    if (dto.recipientCompanyId) {
      const company = await this.companyModel
        .findById(dto.recipientCompanyId)
        .select('email')
        .lean();
      return company?.email ?? null;
    }
    return null;
  }

  private async renderEmailTemplate(
    type: NotificationType,
    title: string,
    message: string,
    data?: Record<string, unknown>,
  ): Promise<string> {
    try {
      const template = await this.emailTemplateModel
        .findOne({ slug: type, isPublished: true })
        .lean();

      if (template?.body) {
        let html = template.body as string;
        html = html.replace(/\{\{title\}\}/g, title);
        html = html.replace(/\{\{message\}\}/g, message);
        if (data) {
          for (const [k, v] of Object.entries(data)) {
            html = html.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
          }
        }
        return html;
      }
    } catch {
      // fall through to default template
    }
    return this.buildDefaultEmailHtml(title, message);
  }

  private buildDefaultEmailHtml(title: string, message: string): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding: 32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0"
               style="background: #ffffff; border-radius: 8px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          <tr>
            <td>
              <h2 style="color: #1a1a2e; margin-top: 0;">${title}</h2>
              <p style="color: #444; line-height: 1.6;">${message}</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
              <p style="color: #aaa; font-size: 12px;">
                This is an automated notification from the Travel Agency Platform.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
  }

  /**
   * Send an email via Nodemailer using SMTP (Brevo or any provider).
   * Required env vars: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
   * Falls back to structured logging when SMTP is not configured.
   */
  private async sendEmail(to: string, subject: string, html: string): Promise<void> {
    const host = this.config.get<string>('SMTP_HOST');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    const from = this.config.get<string>('SMTP_FROM') ?? user;

    if (!host || !user || !pass) {
      this.logger.log('[Email Notification] SMTP not configured — logging email instead', {
        to,
        subject,
        htmlPreview: html.substring(0, 120) + '…',
      });
      return;
    }

    const port = parseInt(this.config.get<string>('SMTP_PORT') ?? '587', 10);

    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });

      await transporter.sendMail({ from, to, subject, html });
      this.logger.log(`[Email Notification] Sent to ${to} — subject: "${subject}"`);
    } catch (err) {
      this.logger.error(`[Email Notification] Failed to send to ${to}`, err);
    }
  }

  async directSendEmail(to: string, subject: string, html: string): Promise<void> {
    return this.sendEmail(to, subject, html);
  }

  // ── Read methods ─────────────────────────────────────────────────────────────

  async markRead(notificationId: string, userId: string): Promise<NotificationDocument | null> {
    return this.notificationModel.findOneAndUpdate(
      { _id: new Types.ObjectId(notificationId), recipientUserId: new Types.ObjectId(userId) },
      { $set: { readAt: new Date() } },
      { new: true },
    );
  }

  async markAllRead(userId: string): Promise<void> {
    await this.notificationModel.updateMany(
      { recipientUserId: new Types.ObjectId(userId), readAt: { $exists: false } },
      { $set: { readAt: new Date() } },
    );
  }

  async getForUser(userId: string, companyId: string, page = 1, limit = 20) {
    const filter = {
      $or: [
        { recipientUserId: new Types.ObjectId(userId) },
        { recipientCompanyId: new Types.ObjectId(companyId) },
      ],
    };

    const [data, total] = await Promise.all([
      this.notificationModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.notificationModel.countDocuments(filter),
    ]);

    return { data, total, page, limit };
  }

  async getUnreadCount(userId: string, companyId: string): Promise<number> {
    return this.notificationModel.countDocuments({
      $or: [
        { recipientUserId: new Types.ObjectId(userId) },
        { recipientCompanyId: new Types.ObjectId(companyId) },
      ],
      readAt: { $exists: false },
    });
  }
}
