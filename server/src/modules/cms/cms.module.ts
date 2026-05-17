import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CmsService } from './cms.service';
import { CmsPublicController, CmsAdminController } from './cms.controller';
import { CmsPage, CmsPageSchema } from '../../db/schemas/cms-page.schema';
import { CmsBanner, CmsBannerSchema } from '../../db/schemas/cms-banner.schema';
import {
  CmsEmailTemplate,
  CmsEmailTemplateSchema,
} from '../../db/schemas/cms-email-template.schema';
import { Role, RoleSchema } from '../../db/schemas/role.schema';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CmsPage.name, schema: CmsPageSchema },
      { name: CmsBanner.name, schema: CmsBannerSchema },
      { name: CmsEmailTemplate.name, schema: CmsEmailTemplateSchema },
      { name: Role.name, schema: RoleSchema },
    ]),
  ],
  controllers: [CmsPublicController, CmsAdminController],
  providers: [CmsService, PermissionsGuard],
  exports: [CmsService],
})
export class CmsModule {}
