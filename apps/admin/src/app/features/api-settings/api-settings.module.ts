import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { ApiSettingsComponent, ApiConfigDialog } from './api-settings.component';

const routes: Routes = [
  { path: '', component: ApiSettingsComponent },
];

@NgModule({
  declarations: [ApiSettingsComponent, ApiConfigDialog],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class ApiSettingsModule {}
