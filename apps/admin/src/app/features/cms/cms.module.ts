import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { CmsDashboardComponent } from './cms-dashboard/cms-dashboard.component';
import { CmsPagesComponent } from './cms-pages/cms-pages.component';
import { CmsPageEditorComponent } from './cms-page-editor/cms-page-editor.component';
import { CmsBannersComponent, BannerFormDialog } from './cms-banners/cms-banners.component';
import { CmsEmailTemplatesComponent } from './cms-email-templates/cms-email-templates.component';

const routes: Routes = [
  { path: '', component: CmsDashboardComponent },
  { path: 'pages', component: CmsPagesComponent },
  { path: 'pages/:id/edit', component: CmsPageEditorComponent },
  { path: 'banners', component: CmsBannersComponent },
  { path: 'email-templates', component: CmsEmailTemplatesComponent },
];

@NgModule({
  declarations: [
    CmsDashboardComponent,
    CmsPagesComponent,
    CmsPageEditorComponent,
    CmsBannersComponent,
    BannerFormDialog,
    CmsEmailTemplatesComponent,
  ],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class CmsModule {}
