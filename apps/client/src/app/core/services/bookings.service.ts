import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Booking, CreateBookingDto, CancelBookingDto } from '../models/booking.models';
import { ApiResponse, PaginatedResponse, PaginatedData } from '../models/common.models';

export interface BookingFilters {
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

@Injectable({ providedIn: 'root' })
export class BookingsService {
  private readonly api = `${environment.apiUrl}/bookings`;

  constructor(private http: HttpClient) {}

  createBooking(dto: CreateBookingDto): Observable<Booking> {
    return this.http
      .post<ApiResponse<Booking>>(this.api, dto)
      .pipe(map((res) => res.data));
  }

  listBookings(filters: BookingFilters = {}): Observable<PaginatedData<Booking>> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        params = params.set(k, String(v));
      }
    });
    return this.http
      .get<PaginatedResponse<Booking>>(this.api, { params })
      .pipe(map((res) => res.data));
  }

  getBooking(id: string): Observable<Booking> {
    return this.http
      .get<ApiResponse<Booking>>(`${this.api}/${id}`)
      .pipe(map((res) => res.data));
  }

  cancelBooking(id: string, dto: CancelBookingDto = {}): Observable<unknown> {
    return this.http.post(`${this.api}/${id}/cancel`, dto);
  }

  getVoucher(id: string): Observable<Blob> {
    return this.http.get(`${this.api}/${id}/voucher`, { responseType: 'blob' });
  }
}
