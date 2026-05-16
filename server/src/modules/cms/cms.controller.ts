import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { CmsService } from './cms.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../db/schemas/user.schema';
import {
  CreatePageDto,
  UpdatePageDto,
  CreateBannerDto,
  UpdateBannerDto,
  CreateEmailTemplateDto,
  UpdateEmailTemplateDto,
} from './dto/cms.dto';

// ── Public routes ───────────────────────────────────────────────────────────

@Controller('cms')
export class CmsPublicController {
  constructor(private readonly cmsService: CmsService) {}

  @Get('pages')
  getPublishedPages() {
    return this.cmsService.getPublishedPages();
  }

  @Get('pages/:slug')
  getPageBySlug(@Param('slug') slug: string) {
    return this.cmsService.getPageBySlug(slug);
  }

  @Get('banners/active')
  getActiveBanners() {
    return this.cmsService.getActiveBanners();
  }
}

// ── Admin routes ────────────────────────────────────────────────────────────

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.SUB_ADMIN)
@Controller('admin/cms')
export class CmsAdminController {
  constructor(private readonly cmsService: CmsService) {}

  // Pages
  @Get('pages')
  listPages() {
    return this.cmsService.listPages();
  }

  @Post('pages')
  createPage(@Body() dto: CreatePageDto) {
    return this.cmsService.createPage(dto);
  }

  @Patch('pages/:id')
  updatePage(@Param('id') id: string, @Body() dto: UpdatePageDto) {
    return this.cmsService.updatePage(id, dto);
  }

  @Delete('pages/:id')
  deletePage(@Param('id') id: string) {
    return this.cmsService.deletePage(id);
  }

  // Banners
  @Get('banners')
  listBanners() {
    return this.cmsService.listBanners();
  }

  @Post('banners')
  createBanner(@Body() dto: CreateBannerDto) {
    return this.cmsService.createBanner(dto);
  }

  @Patch('banners/:id')
  updateBanner(@Param('id') id: string, @Body() dto: UpdateBannerDto) {
    return this.cmsService.updateBanner(id, dto);
  }

  @Delete('banners/:id')
  deleteBanner(@Param('id') id: string) {
    return this.cmsService.deleteBanner(id);
  }

  // Email Templates
  @Get('email-templates')
  listEmailTemplates() {
    return this.cmsService.listEmailTemplates();
  }

  @Post('email-templates')
  createEmailTemplate(@Body() dto: CreateEmailTemplateDto) {
    return this.cmsService.createEmailTemplate(dto);
  }

  @Patch('email-templates/:id')
  updateEmailTemplate(@Param('id') id: string, @Body() dto: UpdateEmailTemplateDto) {
    return this.cmsService.updateEmailTemplate(id, dto);
  }

  @Delete('email-templates/:id')
  deleteEmailTemplate(@Param('id') id: string) {
    return this.cmsService.deleteEmailTemplate(id);
  }
}
