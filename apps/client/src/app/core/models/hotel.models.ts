export interface RoomGuests {
  adults: number;
  children: number;
}

export interface HotelSearchDto {
  destination: string;
  cityCode: string;
  checkIn: string;
  checkOut: string;
  rooms: RoomGuests[];
  nationality: string;
  currency: 'AED' | 'USD';
}

export interface NormalizedHotelResult {
  supplierHotelId: string;
  name: string;
  starRating: number;
  city: string;
  country: string;
  imageUrl?: string;
  priceFrom: number;
  currency: string;
  isRefundable: boolean;
  reviewScore?: number;
}

export interface RoomOption {
  roomToken: string;
  roomType: string;
  mealPlan: string;
  isRefundable: boolean;
  price: number;
  currency: string;
  cancellationPolicy?: string;
}

export interface NormalizedHotelDetails {
  supplierHotelId: string;
  name: string;
  starRating: number;
  city: string;
  country: string;
  address: string;
  description?: string;
  amenities: string[];
  images: string[];
  rooms: RoomOption[];
  latitude?: number;
  longitude?: number;
}

export interface PrebookResult {
  roomToken: string;
  price: number;
  currency: string;
  isRefundable: boolean;
  cancellationPolicy?: string;
  priceChanged: boolean;
}
