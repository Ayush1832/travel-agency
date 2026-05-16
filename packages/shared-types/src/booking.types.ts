import { SupportedCurrency } from './common.types';

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'failed';
export type PaymentMethod = 'online' | 'credit';
export type HotelSupplier = 'tbo';

export interface GuestInfo {
  firstName: string;
  lastName: string;
  title: 'Mr' | 'Mrs' | 'Ms' | 'Dr';
  dob?: string;
}

export interface CancellationPolicyRule {
  from: string;
  to: string;
  amount: number;
}

export interface BookingRoom {
  roomType: string;
  mealPlan: string;
  refundable: boolean;
  cancellationPolicy: CancellationPolicyRule[];
  adults: number;
  children: number;
  childrenAges: number[];
  leadGuest: GuestInfo;
  guests: GuestInfo[];
}

export interface BookingHotel {
  supplierHotelId: string;
  name: string;
  address: string;
  city: string;
  country: string;
  starRating: number;
  lat?: number;
  lng?: number;
  imageUrl?: string;
}

export interface Booking {
  _id: string;
  bookingRef: string;
  companyId: string;
  bookedByUserId: string;
  supplier: HotelSupplier;
  supplierBookingRef?: string;
  hotel: BookingHotel;
  rooms: BookingRoom[];
  checkIn: string;
  checkOut: string;
  nights: number;
  currency: SupportedCurrency;
  baseAmount: number;
  taxAmount: number;
  totalAmount: number;
  markupAmount: number;
  paymentMethod: PaymentMethod;
  paymentId?: string;
  status: BookingStatus;
  voucherUrl?: string;
  specialRequests?: string;
  cancellation?: {
    cancelledAt: string;
    cancelledBy: string;
    cancellationFee: number;
    refundAmount: number;
    refundStatus: 'pending' | 'processed' | 'failed';
  };
  createdAt: string;
  updatedAt: string;
}
