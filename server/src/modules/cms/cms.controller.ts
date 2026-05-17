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
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermission } from '../../common/decorators/permissions.decorator';
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

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.SUB_ADMIN)
@Controller('admin/cms')
export class CmsAdminController {
  constructor(private readonly cmsService: CmsService) {}

  // Pages
  @Get('pages')
  @RequirePermission('cms', 'view')
  listPages() {
    return this.cmsService.listPages();
  }

  @Post('pages')
  @RequirePermission('cms', 'edit')
  createPage(@Body() dto: CreatePageDto) {
    return this.cmsService.createPage(dto);
  }

  @Patch('pages/:id')
  @RequirePermission('cms', 'edit')
  updatePage(@Param('id') id: string, @Body() dto: UpdatePageDto) {
    return this.cmsService.updatePage(id, dto);
  }

  @Delete('pages/:id')
  @RequirePermission('cms', 'delete')
  deletePage(@Param('id') id: string) {
    return this.cmsService.deletePage(id);
  }

  // Banners
  @Get('banners')
  @RequirePermission('cms', 'view')
  listBanners() {
    return this.cmsService.listBanners();
  }

  @Post('banners')
  @RequirePermission('cms', 'edit')
  createBanner(@Body() dto: CreateBannerDto) {
    return this.cmsService.createBanner(dto);
  }

  @Patch('banners/:id')
  @RequirePermission('cms', 'edit')
  updateBanner(@Param('id') id: string, @Body() dto: UpdateBannerDto) {
    return this.cmsService.updateBanner(id, dto);
  }

  @Delete('banners/:id')
  @RequirePermission('cms', 'delete')
  deleteBanner(@Param('id') id: string) {
    return this.cmsService.deleteBanner(id);
  }

  // Email Templates
  @Get('email-templates')
  @RequirePermission('cms', 'view')
  listEmailTemplates() {
    return this.cmsService.listEmailTemplates();
  }

  @Post('email-templates')
  @RequirePermission('cms', 'edit')
  createEmailTemplate(@Body() dto: CreateEmailTemplateDto) {
    return this.cmsService.createEmailTemplate(dto);
  }

  @Patch('email-templates/:id')
  @RequirePermission('cms', 'edit')
  updateEmailTemplate(@Param('id') id: string, @Body() dto: UpdateEmailTemplateDto) {
    return this.cmsService.updateEmailTemplate(id, dto);
  }

  @Delete('email-templates/:id')
  @RequirePermission('cms', 'delete')
  deleteEmailTemplate(@Param('id') id: string) {
    return this.cmsService.deleteEmailTemplate(id);
  }
}
