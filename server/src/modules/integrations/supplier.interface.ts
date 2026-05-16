import {
  NormalizedHotelResult,
  NormalizedHotelDetails,
  PrebookResult,
  BookingResult,
  CancelResult,
  SearchCriteria,
} from './normalized.types';

export interface GuestInfo {
  firstName: string;
  lastName: string;
  title: string;
  adults: number;
  children: number;
}

export interface IHotelSupplier {
  search(criteria: SearchCriteria): Promise<NormalizedHotelResult[]>;
  getDetails(supplierHotelId: string, searchToken: string): Promise<NormalizedHotelDetails>;
  prebook(roomToken: string): Promise<PrebookResult>;
  book(prebookToken: string, guests: GuestInfo[]): Promise<BookingResult>;
  cancel(supplierBookingRef: string): Promise<CancelResult>;
}
