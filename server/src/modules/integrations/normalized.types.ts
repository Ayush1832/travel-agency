// ─────────────────────────────────────────────────────────────────────────────
// Normalized types — all hotel suppliers map their responses to these shapes
// ─────────────────────────────────────────────────────────────────────────────

export interface CancellationPolicyEntry {
  from: Date | string;
  to: Date | string;
  /** Penalty amount in minor units */
  amount: number;
}

export interface NormalizedRoomOption {
  /** Opaque token passed back to prebook/book */
  roomToken: string;
  roomType: string;
  mealPlan: string;
  refundable: boolean;
  /** Base price in minor units */
  price: number;
  /** Taxes in minor units */
  taxes: number;
  /** Total price (price + taxes) in minor units */
  totalPrice: number;
  currency: string;
  cancellationPolicy: CancellationPolicyEntry[];
  maxAdults: number;
  maxChildren: number;
}

export interface NormalizedHotelResult {
  /** Internal ID (same as supplierHotelId for single-supplier setup) */
  hotelId: string;
  supplierHotelId: string;
  name: string;
  starRating: number;
  city: string;
  country: string;
  address: string;
  lat: number;
  lng: number;
  imageUrl: string;
  currency: string;
  /** Lowest available price in minor units */
  priceFrom: number;
  roomsAvailable: number;
  supplier: 'tbo';
  /** Opaque token that carries the supplier session / search context */
  searchToken: string;
  roomOptions: NormalizedRoomOption[];
}

export interface NormalizedHotelDetails extends NormalizedHotelResult {
  description: string;
  amenities: string[];
  photos: string[];
  policies: string;
}

export interface PrebookResult {
  prebookToken: string;
  confirmed: boolean;
  /** Final price in minor units — may differ from search price */
  finalPrice: number;
  expiresAt: Date;
  hotel: {
    supplierHotelId: string;
    name: string;
    city: string;
    country: string;
    address: string;
    starRating: number;
    imageUrl: string;
    lat: number;
    lng: number;
  };
  room: {
    roomType: string;
    mealPlan: string;
    refundable: boolean;
    cancellationPolicy: CancellationPolicyEntry[];
    maxAdults: number;
    maxChildren: number;
  };
}

export interface BookingResult {
  supplierBookingRef: string;
  status: 'confirmed' | 'failed' | 'pending';
  confirmed: boolean;
  hotel: {
    supplierHotelId: string;
    name: string;
    city: string;
    country: string;
    address: string;
    starRating: number;
    phone: string;
    imageUrl: string;
    lat: number;
    lng: number;
  };
  room: {
    roomType: string;
    mealPlan: string;
    refundable: boolean;
    cancellationPolicy: CancellationPolicyEntry[];
  };
}

export interface CancelResult {
  success: boolean;
  /** Refund amount in minor units */
  refundAmount: number;
  /** Cancellation fee in minor units */
  cancellationFee: number;
}

export interface SearchCriteria {
  destination: string;
  cityId?: string;
  countryCode?: string;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  rooms: Array<{
    adults: number;
    children: number;
    childrenAges: number[];
  }>;
  nationality?: string;
  currency: 'AED' | 'USD';
}
