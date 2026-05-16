import { NgModule } from '@angular/core';
import { SharedModule } from '../../shared/shared.module';
import { BookingsRoutingModule } from './bookings-routing.module';
import { BookingsListComponent } from './bookings-list/bookings-list.component';
import { BookingDetailComponent } from './booking-detail/booking-detail.component';
import { CancelDialogComponent } from './booking-detail/cancel-dialog.component';

@NgModule({
  declarations: [BookingsListComponent, BookingDetailComponent, CancelDialogComponent],
  imports: [SharedModule, BookingsRoutingModule],
})
export class BookingsModule {}
