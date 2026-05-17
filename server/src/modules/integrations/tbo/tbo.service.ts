import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import * as xml2js from 'xml2js';
import {
  TboCredentials,
  TboHotelSearchResponse,
  TboHotelResult,
  TboHotelDetailsResponse,
  TboPreBookResponse,
  TboBookResponse,
  TboCancelResponse,
  TboCancellationPolicy,
} from './tbo.types';
import {
  SearchCriteria,
  NormalizedHotelResult,
  NormalizedHotelDetails,
  NormalizedRoomOption,
  PrebookResult,
  BookingResult,
  CancelResult,
  CancellationPolicyEntry,
} from '../normalized.types';
import { IHotelSupplier, GuestInfo } from '../supplier.interface';

@Injectable()
export class TboService implements IHotelSupplier {
  private readonly logger = new Logger(TboService.name);
  private readonly http: AxiosInstance;
  private readonly credentials: TboCredentials;
  private readonly sandbox: boolean;
  private readonly xmlBuilder: xml2js.Builder;
  private readonly xmlParser: xml2js.Parser;

  // TBO SOAP service endpoint
  private readonly SOAP_URL: string;
  private readonly SOAP_NAMESPACE = 'http://TekTravel/HotelBookingService';

  constructor(private readonly config: ConfigService) {
    const apiUrl =
      this.config.get<string>('TBO_API_URL') ??
      'http://api.tbotechnology.in/HotelAPI_v7/HotelService.svc';

    this.SOAP_URL = apiUrl;
    this.sandbox = this.config.get<string>('TBO_SANDBOX') === 'true';

    this.credentials = {
      ClientId: this.config.get<string>('TBO_CLIENT_ID') ?? '',
      UserName: this.config.get<string>('TBO_API_USERNAME') ?? '',
      Password: this.config.get<string>('TBO_API_KEY') ?? '',
    };

    this.xmlBuilder = new xml2js.Builder({
      rootName: 'soap:Envelope',
      xmldec: { version: '1.0', encoding: 'UTF-8' },
      renderOpts: { pretty: false },
    });

    this.xmlParser = new xml2js.Parser({
      explicitArray: false,
      ignoreAttrs: false,
      mergeAttrs: true,
    });

    this.http = axios.create({
      baseURL: this.SOAP_URL,
      timeout: 60000,
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        Accept: 'text/xml',
      },
    });
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private buildSoapEnvelope(action: string, bodyContent: string): string {
    const { ClientId, UserName, Password } = this.credentials;
    return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:tem="http://tempuri.org/"
               xmlns:hot="http://TekTravel/HotelBookingService">
  <soap:Header>
    <hot:Credentials>
      <hot:ClientId>${ClientId}</hot:ClientId>
      <hot:UserName>${UserName}</hot:UserName>
      <hot:Password>${Password}</hot:Password>
    </hot:Credentials>
  </soap:Header>
  <soap:Body>
    <tem:${action}>
      ${bodyContent}
    </tem:${action}>
  </soap:Body>
</soap:Envelope>`;
  }

  private async callSoap<T>(action: string, bodyContent: string): Promise<T> {
    const soap = this.buildSoapEnvelope(action, bodyContent);
    try {
      const response = await this.http.post('', soap, {
        headers: {
          SOAPAction: `"http://tempuri.org/${action}"`,
        },
      });

      const parsed = await this.xmlParser.parseStringPromise(response.data);
      // Navigate SOAP envelope
      const body =
        parsed?.['soap:Envelope']?.['soap:Body'] ??
        parsed?.Envelope?.Body;
      if (!body) {
        throw new HttpException('Invalid TBO SOAP response', HttpStatus.BAD_GATEWAY);
      }
      // Get the action result key — TBO returns e.g. <HotelSearchResponse>
      const resultKey = Object.keys(body).find(
        (k) => k !== 'soap:Fault' && k !== 'Fault',
      );
      if (!resultKey) {
        const fault = body['soap:Fault'] ?? body['Fault'];
        throw new HttpException(
          `TBO SOAP Fault: ${fault?.faultstring ?? 'Unknown error'}`,
          HttpStatus.BAD_GATEWAY,
        );
      }
      return body[resultKey] as T;
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`TBO SOAP call ${action} failed`, (err as Error).message);
      throw new HttpException(
        `TBO API error: ${(err as Error).message}`,
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  /**
   * Convert TBO date string DD/MM/YYYY → Date
   */
  private parseTboDate(dateStr: string): Date {
    if (!dateStr) return new Date();
    const [day, month, year] = dateStr.split('/');
    return new Date(`${year}-${month}-${day}T00:00:00Z`);
  }

  /**
   * Convert JS Date → TBO format DD/MM/YYYY
   */
  private toTboDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  /**
   * Parse "lat|lng" string from TBO HotelMap field
   */
  private parseLatLng(hotelMap: string): { lat: number; lng: number } {
    if (!hotelMap) return { lat: 0, lng: 0 };
    const parts = hotelMap.split('|');
    return {
      lat: parseFloat(parts[0] ?? '0') || 0,
      lng: parseFloat(parts[1] ?? '0') || 0,
    };
  }

  /**
   * Convert TBO star rating string "5 Star" → number 5
   */
  private parseStarRating(category: string, starRating?: number): number {
    if (typeof starRating === 'number' && starRating > 0) return starRating;
    const match = String(category ?? '').match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  /**
   * Convert TBO price (in major units) → minor units
   */
  private toMinorUnits(amount: number): number {
    return Math.round((amount ?? 0) * 100);
  }

  private mapCancellationPolicy(
    policies: TboCancellationPolicy | TboCancellationPolicy[],
  ): CancellationPolicyEntry[] {
    const list = Array.isArray(policies) ? policies : policies ? [policies] : [];
    return list.map((p) => ({
      from: this.parseTboDate(p.FromDate),
      to: this.parseTboDate(p.ToDate),
      amount: this.toMinorUnits(p.CancellationCharge),
    }));
  }

  private mapHotelResultToNormalized(
    hotel: TboHotelResult,
    currency: string,
  ): NormalizedHotelResult {
    const { lat, lng } = this.parseLatLng(hotel.HotelMap);
    const rooms = Array.isArray(hotel.Rooms) ? hotel.Rooms : hotel.Rooms ? [hotel.Rooms] : [];

    const roomOptions: NormalizedRoomOption[] = rooms.map((room) => ({
      roomToken: room.BookingCode,
      roomType: room.RoomTypeName,
      mealPlan: room.MealType,
      refundable: room.Refundable ?? true,
      price: this.toMinorUnits(
        (hotel.Price?.OfferedPrice ?? hotel.Price?.PublishedPrice ?? 0),
      ),
      taxes: this.toMinorUnits(hotel.Price?.ServiceTax ?? 0),
      totalPrice: this.toMinorUnits(
        (hotel.Price?.OfferedPrice ?? hotel.Price?.PublishedPrice ?? 0) +
          (hotel.Price?.ServiceTax ?? 0),
      ),
      currency: hotel.Price?.Currency ?? currency,
      cancellationPolicy: this.mapCancellationPolicy(room.CancellationPolicies ?? []),
      maxAdults: room.RoomAdultCount ?? 2,
      maxChildren: room.RoomChildCount ?? 0,
    }));

    const priceFrom = roomOptions.reduce(
      (min, r) => (r.totalPrice < min ? r.totalPrice : min),
      roomOptions[0]?.totalPrice ?? 0,
    );

    return {
      hotelId: hotel.HotelCode,
      supplierHotelId: hotel.HotelCode,
      name: hotel.HotelName,
      starRating: this.parseStarRating(hotel.HotelCategory, hotel.StarRating),
      city: '',    // Not always returned in search; enriched in getDetails
      country: '',
      address: hotel.HotelAddress ?? '',
      lat,
      lng,
      imageUrl: hotel.HotelPicture ?? '',
      currency: hotel.Price?.Currency ?? currency,
      priceFrom,
      roomsAvailable: rooms.length,
      supplier: 'tbo',
      searchToken: hotel.ResultToken ?? '',
      roomOptions,
    };
  }

  // ── Public supplier interface ─────────────────────────────────────────────────

  async search(criteria: SearchCriteria): Promise<NormalizedHotelResult[]> {
    const roomGuestXml = criteria.rooms
      .map(
        (r) =>
          `<hot:RoomGuest AdultCount="${r.adults}" ChildCount="${r.children}">${
            (r.childrenAges ?? [])
              .map((age) => `<hot:ChildAge>${age}</hot:ChildAge>`)
              .join('')
          }</hot:RoomGuest>`,
      )
      .join('');

    const checkIn = this.toTboDate(new Date(criteria.checkIn));
    const checkOut = this.toTboDate(new Date(criteria.checkOut));

    const bodyContent = `
      <tem:HotelSearchRQ>
        <hot:CheckInDate>${checkIn}</hot:CheckInDate>
        <hot:CheckOutDate>${checkOut}</hot:CheckOutDate>
        <hot:CityName>${criteria.destination}</hot:CityName>
        ${criteria.cityId ? `<hot:CityId>${criteria.cityId}</hot:CityId>` : ''}
        <hot:IsNearBySearchAllowed>false</hot:IsNearBySearchAllowed>
        <hot:GuestNationality>${criteria.nationality ?? 'AE'}</hot:GuestNationality>
        <hot:NoOfRooms>${criteria.rooms.length}</hot:NoOfRooms>
        <hot:RoomGuests>
          ${roomGuestXml}
        </hot:RoomGuests>
        <hot:IsBaseCurrencyRequired>false</hot:IsBaseCurrencyRequired>
        <hot:Filters>
          <hot:ResultCount>50</hot:ResultCount>
        </hot:Filters>
      </tem:HotelSearchRQ>`;

    let raw: TboHotelSearchResponse;
    try {
      raw = await this.callSoap<TboHotelSearchResponse>(
        'HotelSearch',
        bodyContent,
      );
    } catch (err) {
      this.logger.error('TBO HotelSearch failed', (err as Error).message);
      throw err;
    }

    const results =
      raw?.HotelSearchResult?.HotelResults;
    if (!results) return [];

    const hotels = Array.isArray(results) ? results : [results];
    return hotels.map((h) =>
      this.mapHotelResultToNormalized(h, criteria.currency),
    );
  }

  async getDetails(
    supplierHotelId: string,
    _searchToken: string,
  ): Promise<NormalizedHotelDetails> {
    const bodyContent = `
      <tem:HotelDetailsRQ>
        <hot:Hotelcodes>${supplierHotelId}</hot:Hotelcodes>
        <hot:Language>EN</hot:Language>
      </tem:HotelDetailsRQ>`;

    let raw: TboHotelDetailsResponse;
    try {
      raw = await this.callSoap<TboHotelDetailsResponse>(
        'HotelDetails',
        bodyContent,
      );
    } catch (err) {
      this.logger.error('TBO HotelDetails failed', (err as Error).message);
      throw err;
    }

    const hotelsRaw = raw?.Hotels?.Hotel;
    const hotelArr = Array.isArray(hotelsRaw) ? hotelsRaw : hotelsRaw ? [hotelsRaw] : [];
    const hotel = hotelArr[0];

    if (!hotel) {
      throw new HttpException('Hotel not found in TBO', HttpStatus.NOT_FOUND);
    }

    const { lat, lng } = this.parseLatLng(hotel.HotelMap);
    const facilities = Array.isArray(hotel.HotelFacilities)
      ? hotel.HotelFacilities
      : hotel.HotelFacilities
        ? [hotel.HotelFacilities]
        : [];
    const images = Array.isArray(hotel.Images) ? hotel.Images : hotel.Images ? [hotel.Images] : [];

    return {
      hotelId: hotel.HotelCode,
      supplierHotelId: hotel.HotelCode,
      name: hotel.HotelName,
      starRating: this.parseStarRating(hotel.HotelCategory, hotel.StarRating),
      city: hotel.CityName ?? '',
      country: hotel.CountryName ?? '',
      address: hotel.HotelAddress ?? '',
      lat,
      lng,
      imageUrl: hotel.HotelPicture ?? images[0] ?? '',
      currency: 'AED',
      priceFrom: 0,
      roomsAvailable: 0,
      supplier: 'tbo',
      searchToken: _searchToken,
      roomOptions: [],
      description: hotel.HotelDescription ?? '',
      amenities: facilities,
      photos: images,
      policies: hotel.HotelPolicies ?? '',
    };
  }

  async prebook(roomToken: string): Promise<PrebookResult> {
    const bodyContent = `
      <tem:PreBookRQ>
        <hot:BookingCode>${roomToken}</hot:BookingCode>
        <hot:PaymentMode>Limit</hot:PaymentMode>
        <hot:IsPrebookOnly>true</hot:IsPrebookOnly>
      </tem:PreBookRQ>`;

    let raw: TboPreBookResponse;
    try {
      raw = await this.callSoap<TboPreBookResponse>('PreBook', bodyContent);
    } catch (err) {
      this.logger.error('TBO PreBook failed', (err as Error).message);
      throw err;
    }

    if (!raw?.HotelResult || Number(raw.Status?.StatusId) !== 1) {
      throw new HttpException(
        `TBO PreBook failed: ${raw?.Status?.Description ?? 'Unknown'}`,
        HttpStatus.BAD_GATEWAY,
      );
    }

    const hotels = Array.isArray(raw.HotelResult) ? raw.HotelResult : [raw.HotelResult];
    const hotel = hotels[0];
    const rooms = Array.isArray(hotel?.Rooms) ? hotel.Rooms : hotel?.Rooms ? [hotel.Rooms] : [];
    const room = rooms[0];
    const { lat, lng } = this.parseLatLng(hotel?.HotelMap ?? '');

    const totalFare = this.toMinorUnits(hotel?.Price?.OfferedPrice ?? room?.TotalFare ?? 0);

    // Prebook token = original roomToken (TBO uses AuthenticationKey for confirmation)
    const prebookToken = raw.AuthenticationKey ?? roomToken;

    return {
      prebookToken,
      confirmed: raw.AvailabilityType === 'Available',
      finalPrice: totalFare,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 min validity
      hotel: {
        supplierHotelId: hotel?.HotelCode ?? '',
        name: hotel?.HotelName ?? '',
        city: '',
        country: '',
        address: hotel?.HotelAddress ?? '',
        starRating: this.parseStarRating(hotel?.HotelCategory ?? '', hotel?.StarRating),
        imageUrl: hotel?.HotelPicture ?? '',
        lat,
        lng,
      },
      room: {
        roomType: room?.RoomTypeName ?? '',
        mealPlan: room?.MealType ?? '',
        refundable: room?.Refundable ?? true,
        cancellationPolicy: this.mapCancellationPolicy(room?.CancellationPolicies ?? []),
        maxAdults: room?.RoomAdultCount ?? 2,
        maxChildren: room?.RoomChildCount ?? 0,
      },
    };
  }

  async book(prebookToken: string, guests: GuestInfo[]): Promise<BookingResult> {
    // Build room details from guests
    const roomDetails = guests.map((g, idx) => {
      return `<hot:RoomDetail>
        <hot:RoomIndex>${idx + 1}</hot:RoomIndex>
        <hot:RoomTypeCode></hot:RoomTypeCode>
        <hot:RoomTypeName></hot:RoomTypeName>
        <hot:RatePlanCode></hot:RatePlanCode>
        <hot:Adults>${g.adults}</hot:Adults>
        <hot:Children>${g.children}</hot:Children>
        <hot:LeadPassenger>
          <hot:Title>${g.title}</hot:Title>
          <hot:FirstName>${g.firstName}</hot:FirstName>
          <hot:LastName>${g.lastName}</hot:LastName>
          <hot:Type>Adult</hot:Type>
        </hot:LeadPassenger>
      </hot:RoomDetail>`;
    });

    const clientRef = `CL-${Date.now()}`;
    const bodyContent = `
      <tem:BookRQ>
        <hot:BookingCode>${prebookToken}</hot:BookingCode>
        <hot:PaymentMode>Limit</hot:PaymentMode>
        <hot:ClientReferenceNo>${clientRef}</hot:ClientReferenceNo>
        <hot:BookingType>Voucher</hot:BookingType>
        <hot:IsPrebookOnly>false</hot:IsPrebookOnly>
        <hot:IsVoucherBooking>true</hot:IsVoucherBooking>
        <hot:HotelRoomsDetails>
          ${roomDetails.join('')}
        </hot:HotelRoomsDetails>
      </tem:BookRQ>`;

    let raw: TboBookResponse;
    try {
      raw = await this.callSoap<TboBookResponse>('Book', bodyContent);
    } catch (err) {
      this.logger.error('TBO Book failed', (err as Error).message);
      throw err;
    }

    const confirmed =
      raw?.BookingStatus === 'Confirmed' || Number(raw?.Status?.StatusId) === 1;
    const detail = raw?.HotelBookingDetail;
    const { lat, lng } = this.parseLatLng(detail?.HotelMap ?? '');

    return {
      supplierBookingRef: raw?.BookingId ?? raw?.ConfirmationNo ?? '',
      status: confirmed ? 'confirmed' : 'failed',
      confirmed,
      hotel: {
        supplierHotelId: detail?.HotelCode ?? '',
        name: detail?.HotelName ?? '',
        city: detail?.CityName ?? '',
        country: detail?.CountryName ?? '',
        address: detail?.HotelAddress ?? '',
        starRating: detail?.StarRating ?? 0,
        phone: detail?.HotelContactNo ?? '',
        imageUrl: detail?.HotelPicture ?? '',
        lat,
        lng,
      },
      room: {
        roomType: detail?.Rooms?.[0]?.RoomTypeName ?? '',
        mealPlan: detail?.Rooms?.[0]?.MealType ?? '',
        refundable: true,
        cancellationPolicy: this.mapCancellationPolicy(
          detail?.Rooms?.[0]?.CancellationPolicies ?? [],
        ),
      },
    };
  }

  async cancel(supplierBookingRef: string): Promise<CancelResult> {
    const bodyContent = `
      <tem:CancelRQ>
        <hot:BookingId>${supplierBookingRef}</hot:BookingId>
        <hot:RequestType>Cancel</hot:RequestType>
      </tem:CancelRQ>`;

    let raw: TboCancelResponse;
    try {
      raw = await this.callSoap<TboCancelResponse>('Cancel', bodyContent);
    } catch (err) {
      this.logger.error('TBO Cancel failed', (err as Error).message);
      throw err;
    }

    return {
      success: raw?.IsCancelled ?? Number(raw?.Status?.StatusId) === 1,
      refundAmount: this.toMinorUnits(raw?.RefundAmount ?? 0),
      cancellationFee: this.toMinorUnits(raw?.CancellationCharge ?? 0),
    };
  }
}
