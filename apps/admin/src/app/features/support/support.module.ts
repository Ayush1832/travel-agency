import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { AdminSupportListComponent } from './admin-support-list/admin-support-list.component';
import { AdminTicketDetailComponent } from './admin-ticket-detail/admin-ticket-detail.component';

const routes: Routes = [
  { path: '', component: AdminSupportListComponent },
  { path: ':id', component: AdminTicketDetailComponent },
];

@NgModule({
  declarations: [AdminSupportListComponent, AdminTicketDetailComponent],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class SupportModule {}
