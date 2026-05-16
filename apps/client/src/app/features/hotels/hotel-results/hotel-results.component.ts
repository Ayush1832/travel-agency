import { Component, OnInit, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { HotelsService } from '../../../core/services/hotels.service';
import { NormalizedHotelResult } from '../../../core/models/hotel.models';

@Component({
  standalone: false,
  selector: 'app-hotel-results',
  templateUrl: './hotel-results.component.html',
  styleUrls: ['./hotel-results.component.scss'],
})
export class HotelResultsComponent implements OnInit {
  allResults = signal<NormalizedHotelResult[]>([]);
  loading = signal(false);

  // Filters
  minPrice = signal(0);
  maxPrice = signal(10000);
  filterMaxPrice = signal(10000);
  selectedStars = signal<number[]>([]);
  refundableOnly = signal(false);
  selectedAmenities = signal<string[]>([]);
  sortBy = signal<'price-asc' | 'price-desc' | 'star-rating'>('price-asc');

  readonly amenityOptions = ['WiFi', 'Pool', 'Parking', 'Breakfast', 'Gym', 'Spa', 'Restaurant', 'Air Conditioning'];

  filteredResults = computed(() => {
    let results = [...this.allResults()];

    if (this.refundableOnly()) {
      results = results.filter((r) => r.isRefundable);
    }

    if (this.selectedStars().length > 0) {
      results = results.filter((r) => this.selectedStars().includes(r.starRating));
    }

    results = results.filter((r) => r.priceFrom <= this.filterMaxPrice());

    const amenities = this.selectedAmenities();
    if (amenities.length > 0) {
      results = results.filter((r) => {
        const hotelAmenities = ((r as unknown as Record<string, unknown>)['amenities'] as string[] | undefined) ?? [];
        return amenities.every((a) =>
          hotelAmenities.some((ha) => ha.toLowerCase().includes(a.toLowerCase())),
        );
      });
    }

    const sort = this.sortBy();
    if (sort === 'price-asc') results.sort((a, b) => a.priceFrom - b.priceFrom);
    else if (sort === 'price-desc') results.sort((a, b) => b.priceFrom - a.priceFrom);
    else if (sort === 'star-rating') results.sort((a, b) => b.starRating - a.starRating);

    return results;
  });

  stars = [5, 4, 3, 2, 1];

  constructor(private hotelsService: HotelsService, private router: Router) {}

  ngOnInit() {
    const results = this.hotelsService.lastSearchResults();
    if (results.length === 0) {
      this.router.navigate(['/hotels']);
      return;
    }
    this.allResults.set(results);
    const prices = results.map((r) => r.priceFrom);
    this.maxPrice.set(Math.max(...prices));
    this.filterMaxPrice.set(Math.max(...prices));
    this.minPrice.set(Math.min(...prices));
  }

  toggleStar(star: number) {
    const current = this.selectedStars();
    if (current.includes(star)) {
      this.selectedStars.set(current.filter((s) => s !== star));
    } else {
      this.selectedStars.set([...current, star]);
    }
  }

  toggleAmenity(amenity: string) {
    const current = this.selectedAmenities();
    if (current.includes(amenity)) {
      this.selectedAmenities.set(current.filter((a) => a !== amenity));
    } else {
      this.selectedAmenities.set([...current, amenity]);
    }
  }

  isAmenitySelected(amenity: string): boolean {
    return this.selectedAmenities().includes(amenity);
  }

  isStarSelected(star: number): boolean {
    return this.selectedStars().includes(star);
  }

  onMaxPriceChange(event: Event) {
    const val = +(event.target as HTMLInputElement).value;
    this.filterMaxPrice.set(val);
  }

  getStarArray(rating: number): number[] {
    return Array(Math.max(0, Math.min(5, Math.round(rating)))).fill(0);
  }

  viewDetails(hotel: NormalizedHotelResult) {
    this.hotelsService.selectedHotelName.set(hotel.name);
    this.router.navigate(['/hotels', hotel.supplierHotelId, 'details']);
  }

  newSearch() {
    this.router.navigate(['/hotels']);
  }
}
