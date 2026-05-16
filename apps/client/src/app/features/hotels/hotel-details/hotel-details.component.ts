import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HotelsService } from '../../../core/services/hotels.service';
import { NormalizedHotelDetails, RoomOption } from '../../../core/models/hotel.models';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  standalone: false,
  selector: 'app-hotel-details',
  templateUrl: './hotel-details.component.html',
  styleUrls: ['./hotel-details.component.scss'],
})
export class HotelDetailsComponent implements OnInit {
  hotel = signal<NormalizedHotelDetails | null>(null);
  loading = signal(true);
  currentImageIndex = signal(0);
  displayedColumns = ['roomType', 'mealPlan', 'refundable', 'price', 'action'];

  constructor(
    private route: ActivatedRoute,
    private hotelsService: HotelsService,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit() {
    const hotelId = this.route.snapshot.paramMap.get('supplierHotelId')!;
    const searchId = this.hotelsService.lastSearchId();

    if (!searchId) {
      this.router.navigate(['/hotels']);
      return;
    }

    this.hotelsService.getDetails(hotelId, searchId).subscribe({
      next: (details) => {
        this.hotel.set(details);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.snackBar.open('Failed to load hotel details', 'Close', { duration: 3000 });
        this.router.navigate(['/hotels/results']);
      },
    });
  }

  prevImage() {
    const h = this.hotel();
    if (!h) return;
    const total = h.images.length;
    this.currentImageIndex.set((this.currentImageIndex() - 1 + total) % total);
  }

  nextImage() {
    const h = this.hotel();
    if (!h) return;
    const total = h.images.length;
    this.currentImageIndex.set((this.currentImageIndex() + 1) % total);
  }

  getStarArray(rating: number): number[] {
    return Array(Math.max(0, Math.min(5, Math.round(rating)))).fill(0);
  }

  selectRoom(room: RoomOption) {
    this.hotelsService.selectedRoom.set({
      roomToken: room.roomToken,
      price: room.price,
      currency: room.currency,
      roomType: room.roomType,
      mealPlan: room.mealPlan,
      cancellationPolicy: room.cancellationPolicy,
    });
    this.hotelsService.selectedHotelName.set(this.hotel()?.name ?? '');
    this.router.navigate(['/hotels/checkout']);
  }

  goBack() {
    this.router.navigate(['/hotels/results']);
  }
}
