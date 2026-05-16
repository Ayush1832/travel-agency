import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { SubAdminsDashboardComponent, RoleFormDialog, SubAdminFormDialog } from './sub-admins-dashboard/sub-admins-dashboard.component';

const routes: Routes = [
  { path: '', component: SubAdminsDashboardComponent },
];

@NgModule({
  declarations: [SubAdminsDashboardComponent, RoleFormDialog, SubAdminFormDialog],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class SubAdminsModule {}
