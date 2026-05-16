export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'failed';

export interface GuestInfo {
  title: string;
  firstName: string;
  lastName: string;
  isLead?: boolean;
}

export interface Booking {
  _id: string;
  bookingRef: string;
  hotelName: string;
  hotelId: string;
  checkIn: string;
  checkOut: string;
  roomType: string;
  status: BookingStatus;
  totalAmount: number;
  currency: string;
  paymentMethod: 'credit' | 'online';
  guests: GuestInfo[];
  specialRequests?: string;
  cancellationPolicy?: string;
  cancellationFee?: number;
  refundAmount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBookingDto {
  roomToken: string;
  searchId: string;
  guests: GuestInfo[];
  specialRequests?: string;
  paymentMethod: 'credit' | 'online';
}

export interface CancelBookingDto {
  reason?: string;
}
