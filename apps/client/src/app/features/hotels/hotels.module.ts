import { NgModule } from '@angular/core';
import { SharedModule } from '../../shared/shared.module';
import { HotelsRoutingModule } from './hotels-routing.module';
import { HotelSearchComponent } from './hotel-search/hotel-search.component';
import { HotelResultsComponent } from './hotel-results/hotel-results.component';
import { HotelDetailsComponent } from './hotel-details/hotel-details.component';
import { BookingCheckoutComponent } from './booking-checkout/booking-checkout.component';

@NgModule({
  declarations: [
    HotelSearchComponent,
    HotelResultsComponent,
    HotelDetailsComponent,
    BookingCheckoutComponent,
  ],
  imports: [SharedModule, HotelsRoutingModule],
})
export class HotelsModule {}
