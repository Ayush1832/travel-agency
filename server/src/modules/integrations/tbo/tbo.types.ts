// ─────────────────────────────────────────────────────────────────────────────
// TBO Holidays API v7 — TypeScript types for XML/SOAP request & response objects
// API base: http://api.tbotechnology.in/hotelapi_v7/hotelservice.svc
// Auth:  ClientId + UserName + Password in SOAP Header
// ─────────────────────────────────────────────────────────────────────────────

// ── Credentials ───────────────────────────────────────────────────────────────

export interface TboCredentials {
  ClientId: string;
  UserName: string;
  Password: string;
}

// ── HotelSearch ───────────────────────────────────────────────────────────────

export interface TboRoomGuest {
  AdultCount: number;
  ChildCount: number;
  ChildAge?: number[]; // child ages (required when ChildCount > 0)
}

export interface TboHotelSearchRequest {
  CheckInDate: string;   // DD/MM/YYYY
  CheckOutDate: string;  // DD/MM/YYYY
  CountryName: string;
  CityName?: string;
  CityId?: string;
  IsNearBySearchAllowed: boolean;
  GuestNationality: string;
  NoOfRooms: number;
  RoomGuests: TboRoomGuest[];
  ResponseTime?: number;
  IsBaseCurrencyRequired?: boolean;
  Filters?: TboSearchFilters;
}

export interface TboSearchFilters {
  NoOfRooms?: number;
  StarRating?: number;
  HotelName?: string;
  OrderBy?: number;     // 1=Price, 2=Star, 3=Name
  HotelCodeList?: string[];
  Refundable?: boolean;
  MealType?: number;
  ResultCount?: number;
}

export interface TboHotelResult {
  HotelCode: string;
  HotelName: string;
  HotelCategory: string;    // star rating string e.g. "5 Star"
  StarRating: number;
  HotelAddress: string;
  HotelContactNo: string;
  HotelMap: string;         // "lat|lng"
  HotelPicture: string;     // image URL
  HotelDescription: string;
  HotelFacilities: string[];
  Rooms: TboRoomResult[];
  Currency: string;
  Price: TboPrice;
  Attractions?: string[];
  ResultToken: string;
}

export interface TboRoomResult {
  BookingCode: string;      // opaque token
  RoomTypeName: string;
  RatePlanCode: string;
  MealType: string;
  Refundable: boolean;
  WithTransfers: boolean;
  Amenities: string[];
  SmokingPreference: string;
  BedTypes: string[];
  Supplements: unknown[];
  Discount: number;
  RoomPromotion: string;
  CancellationPolicies: TboCancellationPolicy[];
  DayRates: TboDayRate[];
  TotalFare: number;
  TotalTax: number;
  RoomAdultCount: number;
  RoomChildCount: number;
  ChildAge?: number[];
  ImageList?: string[];
  RoomIndex: number;
  InfoSource?: string;
}

export interface TboPrice {
  PublishedPrice: number;
  PublishedPriceRoundedOff: number;
  OfferedPrice: number;
  OfferedPriceRoundedOff: number;
  AgentCommission: number;
  AgentMarkUp: number;
  ServiceTax: number;
  TDS: number;
  ServiceCharge: number;
  TotalGSTAmount: number;
  GST: TboGST;
  Currency: string;
}

export interface TboGST {
  CGSTAmount: number;
  SGSTAmount: number;
  IGSTAmount: number;
  Cess: number;
  GSTIncentive: number;
}

export interface TboCancellationPolicy {
  ChargeType: string;
  Currency: string;
  FromDate: string;
  ToDate: string;
  CancellationCharge: number;
}

export interface TboDayRate {
  Date: string;
  BasePrice: number;
}

export interface TboHotelSearchResponse {
  Status: TboStatus;
  HotelSearchResult: {
    HotelResults: TboHotelResult[];
  };
}

// ── HotelDetails ──────────────────────────────────────────────────────────────

export interface TboHotelDetailsRequest {
  Hotelcodes: string;   // comma separated hotel codes
  Language: string;     // 'EN'
}

export interface TboHotelDetailsResponse {
  Status: TboStatus;
  Hotels: {
    Hotel: TboHotelDetail[];
  };
}

export interface TboHotelDetail {
  HotelCode: string;
  HotelName: string;
  HotelCategory: string;
  StarRating: number;
  HotelDescription: string;
  HotelAddress: string;
  PinCode: string;
  HotelContactNo: string;
  HotelMap: string;
  HotelPicture: string;
  CountryName: string;
  CityName: string;
  FaxNumber: string;
  HotelFacilities: string[];
  HotelPolicies: string;
  Images: string[];
}

// ── PreBook ───────────────────────────────────────────────────────────────────

export interface TboPreBookRequest {
  BookingCode: string;  // BookingCode from search result
  PaymentMode: string;  // 'Limit'
  ClientReferenceNo?: string;
  IsPrebookOnly: boolean;
  Quota?: number;
}

export interface TboPreBookResponse {
  Status: TboStatus;
  IsPriceChanged: boolean;
  IsCancellationPolicyChanged: boolean;
  AvailabilityType: string;  // 'Available' | 'OnRequest'
  HotelResult: TboHotelResult[];
  AuthenticationKey: string;  // token for actual book call
}

// ── HotelBook ─────────────────────────────────────────────────────────────────

export interface TboBookRequest {
  BookingCode: string;
  PaymentMode: string;    // 'Limit'
  ClientReferenceNo: string;
  BookingType: string;    // 'Voucher'
  IsPrebookOnly: boolean;
  IsVoucherBooking: boolean;
  HotelRoomsDetails: TboBookRoomDetail[];
}

export interface TboBookRoomDetail {
  RoomIndex: number;
  RoomTypeCode: string;
  RoomTypeName: string;
  RatePlanCode: string;
  BedTypeCode?: string;
  SmokingPreference?: string;
  Adults: number;
  Children: number;
  ChildrenAge?: string;    // comma-separated ages
  LeadPassenger: TboPassenger;
  Passengers: TboPassenger[];
}

export interface TboPassenger {
  Title: string;           // 'Mr' | 'Mrs' | 'Ms' | 'Miss' | 'Mstr'
  FirstName: string;
  LastName: string;
  Type: string;            // 'Adult' | 'Child'
  PaxId?: number;
  PassportNo?: string;
  PassportExpiry?: string;
  NationalId?: string;
}

export interface TboBookResponse {
  Status: TboStatus;
  BookingId: string;       // supplier booking ref
  ClientReferenceNo: string;
  ConfirmationNo: string;
  BookingStatus: string;   // 'Confirmed' | 'On Hold'
  BookingDate: string;
  HotelBookingDetail: TboHotelBookingDetail;
}

export interface TboHotelBookingDetail {
  HotelCode: string;
  HotelName: string;
  HotelAddress: string;
  HotelContactNo: string;
  CheckInDate: string;
  CheckOutDate: string;
  TotalFare: number;
  Currency: string;
  Rooms: TboBookedRoom[];
  HotelPicture: string;
  HotelMap: string;
  StarRating: number;
  CountryName: string;
  CityName: string;
}

export interface TboBookedRoom {
  RoomIndex: number;
  RoomTypeName: string;
  MealType: string;
  CancellationPolicies: TboCancellationPolicy[];
  TotalFare: number;
  TotalTax: number;
}

// ── CancelBooking ─────────────────────────────────────────────────────────────

export interface TboCancelRequest {
  BookingId: string;
  RequestType: string;    // 'Cancel'
  Remarks?: string;
}

export interface TboCancelResponse {
  Status: TboStatus;
  IsCancelled: boolean;
  CancellationCharge: number;
  RefundAmount: number;
}

// ── Common ────────────────────────────────────────────────────────────────────

export interface TboStatus {
  StatusId: number;       // 1 = Success
  Title: string;
  Description: string;
}
