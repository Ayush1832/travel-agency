import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { AllBookingsListComponent } from './all-bookings-list/all-bookings-list.component';
import { AdminBookingDetailComponent } from './admin-booking-detail/admin-booking-detail.component';

const routes: Routes = [
  { path: '', component: AllBookingsListComponent },
  { path: ':id', component: AdminBookingDetailComponent },
];

@NgModule({
  declarations: [AllBookingsListComponent, AdminBookingDetailComponent],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class BookingsModule {}
