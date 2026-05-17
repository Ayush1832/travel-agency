import {
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import sanitizeHtml from 'sanitize-html';
import { CmsPage, CmsPageDocument } from '../../db/schemas/cms-page.schema';
import { CmsBanner, CmsBannerDocument } from '../../db/schemas/cms-banner.schema';
import {
  CmsEmailTemplate,
  CmsEmailTemplateDocument,
} from '../../db/schemas/cms-email-template.schema';
import {
  CreatePageDto,
  UpdatePageDto,
  CreateBannerDto,
  UpdateBannerDto,
  CreateEmailTemplateDto,
  UpdateEmailTemplateDto,
} from './dto/cms.dto';

const DEFAULT_TEMPLATES = [
  {
    key: 'booking_confirmed',
    subject: 'Booking Confirmed - {{bookingRef}}',
    body: '<p>Your booking <strong>{{bookingRef}}</strong> at <strong>{{hotelName}}</strong> is confirmed. We look forward to your stay!</p>',
    variables: ['bookingRef', 'hotelName', 'checkIn', 'checkOut'],
  },
  {
    key: 'booking_cancelled',
    subject: 'Booking Cancelled - {{bookingRef}}',
    body: '<p>Your booking <strong>{{bookingRef}}</strong> has been cancelled. If you have any questions, please contact support.</p>',
    variables: ['bookingRef', 'hotelName', 'cancellationReason'],
  },
  {
    key: 'account_approved',
    subject: 'Your Agency Account Has Been Approved',
    body: '<p>Your agency account <strong>{{companyName}}</strong> has been approved. You can now log in and start making bookings.</p>',
    variables: ['companyName', 'loginUrl'],
  },
  {
    key: 'password_reset',
    subject: 'Reset Your Password',
    body: '<p>Click this link to reset your password: <a href="{{resetLink}}">{{resetLink}}</a>. This link expires in 1 hour.</p>',
    variables: ['resetLink', 'firstName'],
  },
  {
    key: 'credit_low',
    subject: 'Low Credit Balance Alert',
    body: '<p>Your credit balance is low. Available: <strong>{{availableCredit}} AED</strong>. Please top up your wallet to continue making bookings.</p>',
    variables: ['availableCredit', 'companyName'],
  },
];

@Injectable()
export class CmsService implements OnModuleInit {
  constructor(
    @InjectModel(CmsPage.name) private pageModel: Model<CmsPageDocument>,
    @InjectModel(CmsBanner.name) private bannerModel: Model<CmsBannerDocument>,
    @InjectModel(CmsEmailTemplate.name)
    private emailTemplateModel: Model<CmsEmailTemplateDocument>,
  ) {}

  async onModuleInit() {
    for (const tpl of DEFAULT_TEMPLATES) {
      const exists = await this.emailTemplateModel.findOne({ key: tpl.key }).lean();
      if (!exists) {
        await this.emailTemplateModel.create({ ...tpl, isActive: true });
        console.log(`[CMS] Seeded email template: ${tpl.key}`);
      }
    }
  }

  // ── Public ──────────────────────────────────────────────────────────────────

  async getPublishedPages() {
    return this.pageModel
      .find({ isPublished: true })
      .select('-body')
      .sort({ createdAt: -1 })
      .lean();
  }

  async getPageBySlug(slug: string) {
    const page = await this.pageModel.findOne({ slug: slug.toLowerCase(), isPublished: true }).lean();
    if (!page) throw new NotFoundException('Page not found');
    return page;
  }

  async getActiveBanners() {
    const now = new Date();
    return this.bannerModel
      .find({
        isActive: true,
        $or: [
          { scheduledFrom: { $exists: false }, scheduledTo: { $exists: false } },
          { scheduledFrom: { $lte: now }, scheduledTo: { $gte: now } },
          { scheduledFrom: { $lte: now }, scheduledTo: { $exists: false } },
          { scheduledFrom: { $exists: false }, scheduledTo: { $gte: now } },
        ],
      })
      .sort({ sortOrder: 1 })
      .lean();
  }

  async getEmailTemplate(key: string) {
    const tpl = await this.emailTemplateModel.findOne({ key, isActive: true }).lean();
    if (!tpl) throw new NotFoundException(`Email template '${key}' not found`);
    return tpl;
  }

  // ── Pages Admin ─────────────────────────────────────────────────────────────

  async listPages() {
    return this.pageModel.find().sort({ createdAt: -1 }).lean();
  }

  private sanitizePageBody(body: string): string {
    return sanitizeHtml(body, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2', 'iframe']),
      allowedAttributes: {
        ...sanitizeHtml.defaults.allowedAttributes,
        img: ['src', 'alt', 'width', 'height'],
        iframe: ['src', 'width', 'height', 'allowfullscreen'],
        '*': ['class', 'id', 'style'],
      },
      allowedSchemes: ['https', 'http', 'mailto'],
    });
  }

  async createPage(dto: CreatePageDto) {
    const sanitized = { ...dto, slug: dto.slug.toLowerCase() };
    if (sanitized.body) sanitized.body = this.sanitizePageBody(sanitized.body);
    return this.pageModel.create(sanitized);
  }

  async updatePage(id: string, dto: UpdatePageDto) {
    const sanitized = { ...dto };
    if (sanitized.body) sanitized.body = this.sanitizePageBody(sanitized.body);
    const page = await this.pageModel.findByIdAndUpdate(id, sanitized, { new: true });
    if (!page) throw new NotFoundException('Page not found');
    return page;
  }

  async deletePage(id: string) {
    const page = await this.pageModel.findByIdAndDelete(id);
    if (!page) throw new NotFoundException('Page not found');
    return { deleted: true };
  }

  // ── Banners Admin ───────────────────────────────────────────────────────────

  async listBanners() {
    return this.bannerModel.find().sort({ sortOrder: 1, createdAt: -1 }).lean();
  }

  async createBanner(dto: CreateBannerDto) {
    return this.bannerModel.create(dto);
  }

  async updateBanner(id: string, dto: UpdateBannerDto) {
    const banner = await this.bannerModel.findByIdAndUpdate(id, dto, { new: true });
    if (!banner) throw new NotFoundException('Banner not found');
    return banner;
  }

  async deleteBanner(id: string) {
    const banner = await this.bannerModel.findByIdAndDelete(id);
    if (!banner) throw new NotFoundException('Banner not found');
    return { deleted: true };
  }

  // ── Email Templates Admin ───────────────────────────────────────────────────

  async listEmailTemplates() {
    return this.emailTemplateModel.find().sort({ key: 1 }).lean();
  }

  async createEmailTemplate(dto: CreateEmailTemplateDto) {
    return this.emailTemplateModel.create(dto);
  }

  async updateEmailTemplate(id: string, dto: UpdateEmailTemplateDto) {
    const tpl = await this.emailTemplateModel.findByIdAndUpdate(id, dto, { new: true });
    if (!tpl) throw new NotFoundException('Email template not found');
    return tpl;
  }

  async deleteEmailTemplate(id: string) {
    const tpl = await this.emailTemplateModel.findByIdAndDelete(id);
    if (!tpl) throw new NotFoundException('Email template not found');
    return { deleted: true };
  }

  async renderEmailTemplate(key: string, variables: Record<string, string>): Promise<string> {
    const tpl = await this.getEmailTemplate(key);
    let html = tpl.body;
    for (const [varName, value] of Object.entries(variables)) {
      html = html.replace(new RegExp(`\\{\\{${varName}\\}\\}`, 'g'), value);
    }
    return html;
  }
}
