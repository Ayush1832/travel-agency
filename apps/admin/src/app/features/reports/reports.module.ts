import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { ReportsDashboardComponent } from './reports-dashboard/reports-dashboard.component';
import { RevenueReportComponent } from './revenue-report/revenue-report.component';
import { BookingsReportComponent } from './bookings-report/bookings-report.component';
import { CreditReportComponent } from './credit-report/credit-report.component';

const routes: Routes = [
  { path: '', component: ReportsDashboardComponent },
  { path: 'revenue', component: RevenueReportComponent },
  { path: 'bookings', component: BookingsReportComponent },
  { path: 'credit', component: CreditReportComponent },
];

@NgModule({
  declarations: [ReportsDashboardComponent, RevenueReportComponent, BookingsReportComponent, CreditReportComponent],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class ReportsModule {}
