export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'refunded';

export interface Booking {
  _id: string;
  bookingRef: string;
  companyId: string;
  companyName?: string;
  hotelName: string;
  hotelId?: string;
  roomType?: string;
  checkIn: string;
  checkOut: string;
  status: BookingStatus;
  totalAmount: number;
  paymentMethod: string;
  guestName?: string;
  guestEmail?: string;
  guests?: number;
  createdAt: string;
  updatedAt: string;
}
