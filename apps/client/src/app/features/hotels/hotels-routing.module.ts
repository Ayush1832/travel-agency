import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HotelSearchComponent } from './hotel-search/hotel-search.component';
import { HotelResultsComponent } from './hotel-results/hotel-results.component';
import { HotelDetailsComponent } from './hotel-details/hotel-details.component';
import { BookingCheckoutComponent } from './booking-checkout/booking-checkout.component';

const routes: Routes = [
  { path: '', component: HotelSearchComponent },
  { path: 'results', component: HotelResultsComponent },
  { path: 'checkout', component: BookingCheckoutComponent },
  { path: ':supplierHotelId/details', component: HotelDetailsComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class HotelsRoutingModule {}
