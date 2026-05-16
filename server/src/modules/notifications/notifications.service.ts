import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import * as https from 'https';
import * as crypto from 'crypto';
import * as querystring from 'querystring';
import {
  Notification,
  NotificationDocument,
  NotificationChannel,
  NotificationStatus,
  NotificationType,
} from '../../db/schemas/notification.schema';
import { User, UserDocument } from '../../db/schemas/user.schema';
import { Company, CompanyDocument } from '../../db/schemas/company.schema';

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
        const html = this.buildEmailHtml(dto.title, dto.message);
        await this.sendEmail(recipientEmail, dto.title, html);
      } else {
        this.logger.warn('[Email Notification] Could not resolve recipient email', {
          recipientUserId: dto.recipientUserId,
          recipientCompanyId: dto.recipientCompanyId,
          type: dto.type,
        });
      }
    } else if (dto.channel === NotificationChannel.SMS) {
      // SMS via Twilio or other provider — structured log until provider is configured
      this.logger.log('[SMS Notification]', {
        to: dto.recipientUserId || dto.recipientCompanyId,
        type: dto.type,
        message: dto.message,
      });
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

  private buildEmailHtml(title: string, message: string): string {
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
   * Send an email via AWS SES using the Query API over HTTPS.
   * Falls back to structured console logging when AWS credentials are not configured.
   *
   * Required env vars:
   *   AWS_ACCESS_KEY_ID
   *   AWS_SECRET_ACCESS_KEY
   *   AWS_SES_SENDER_EMAIL  (verified sender address)
   *   AWS_REGION            (default: us-east-1)
   */
  private async sendEmail(to: string, subject: string, html: string): Promise<void> {
    const accessKeyId = this.config.get<string>('AWS_ACCESS_KEY_ID');
    const secretKey = this.config.get<string>('AWS_SECRET_ACCESS_KEY');
    const senderEmail = this.config.get<string>('AWS_SES_SENDER_EMAIL');

    if (!accessKeyId || !secretKey || !senderEmail) {
      this.logger.log('[Email Notification] AWS SES not configured — logging email instead', {
        to,
        subject,
        htmlPreview: html.substring(0, 120) + '…',
      });
      return;
    }

    const region = this.config.get<string>('AWS_REGION') ?? 'us-east-1';

    try {
      await this.sesSendEmail({ to, subject, html, senderEmail, region, accessKeyId, secretKey });
      this.logger.log(`[Email Notification] Sent to ${to} — subject: "${subject}"`);
    } catch (err) {
      this.logger.error(`[Email Notification] Failed to send to ${to}`, err);
    }
  }

  /**
   * Call SES SendEmail using AWS Signature Version 4 and the Query (form-urlencoded) API.
   * We use Node's built-in `https` module — no extra packages required.
   */
  private sesSendEmail(opts: {
    to: string;
    subject: string;
    html: string;
    senderEmail: string;
    region: string;
    accessKeyId: string;
    secretKey: string;
  }): Promise<void> {
    return new Promise((resolve, reject) => {
      const { to, subject, html, senderEmail, region, accessKeyId, secretKey } = opts;

      const host = `email.${region}.amazonaws.com`;
      const endpoint = '/';
      const service = 'ses';

      // ── Build the query-string body ────────────────────────────────────────
      const params: Record<string, string> = {
        Action: 'SendEmail',
        'Source': senderEmail,
        'Destination.ToAddresses.member.1': to,
        'Message.Subject.Data': subject,
        'Message.Subject.Charset': 'UTF-8',
        'Message.Body.Html.Data': html,
        'Message.Body.Html.Charset': 'UTF-8',
        Version: '2010-12-01',
      };
      const body = querystring.stringify(params);

      // ── AWS Signature Version 4 ────────────────────────────────────────────
      const now = new Date();
      const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '').substring(0, 15) + 'Z';
      const dateStamp = amzDate.substring(0, 8);

      const contentType = 'application/x-www-form-urlencoded';

      const canonicalHeaders =
        `content-type:${contentType}\n` +
        `host:${host}\n` +
        `x-amz-date:${amzDate}\n`;

      const signedHeaders = 'content-type;host;x-amz-date';

      const payloadHash = crypto.createHash('sha256').update(body).digest('hex');

      const canonicalRequest = [
        'POST',
        endpoint,
        '',
        canonicalHeaders,
        signedHeaders,
        payloadHash,
      ].join('\n');

      const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
      const stringToSign = [
        'AWS4-HMAC-SHA256',
        amzDate,
        credentialScope,
        crypto.createHash('sha256').update(canonicalRequest).digest('hex'),
      ].join('\n');

      const signingKey = this.getSigningKey(secretKey, dateStamp, region, service);
      const signature = crypto
        .createHmac('sha256', signingKey)
        .update(stringToSign)
        .digest('hex');

      const authorizationHeader =
        `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, ` +
        `SignedHeaders=${signedHeaders}, Signature=${signature}`;

      // ── Make the HTTPS request ─────────────────────────────────────────────
      const reqOptions: https.RequestOptions = {
        method: 'POST',
        hostname: host,
        path: endpoint,
        headers: {
          'Content-Type': contentType,
          'Content-Length': Buffer.byteLength(body),
          'X-Amz-Date': amzDate,
          'Authorization': authorizationHeader,
        },
      };

      const req = https.request(reqOptions, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve();
          } else {
            reject(new Error(`SES returned HTTP ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }

  private getSigningKey(
    secretKey: string,
    dateStamp: string,
    region: string,
    service: string,
  ): Buffer {
    const kDate = crypto.createHmac('sha256', `AWS4${secretKey}`).update(dateStamp).digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
    const kService = crypto.createHmac('sha256', kRegion).update(service).digest();
    return crypto.createHmac('sha256', kService).update('aws4_request').digest();
  }

  // ── Read methods (unchanged) ─────────────────────────────────────────────────

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
