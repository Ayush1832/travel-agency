import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Booking } from '../models/booking.models';
import { PaginatedResponse, ApiResponse } from '../models/common.models';

@Injectable({ providedIn: 'root' })
export class AdminBookingsService {
  private readonly api = `${environment.apiUrl}/admin/bookings`;

  constructor(private http: HttpClient) {}

  list(params: {
    search?: string;
    status?: string;
    paymentMethod?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  } = {}): Observable<PaginatedResponse<Booking>> {
    let httpParams = new HttpParams();
    if (params.search) httpParams = httpParams.set('search', params.search);
    if (params.status) httpParams = httpParams.set('status', params.status);
    if (params.paymentMethod) httpParams = httpParams.set('paymentMethod', params.paymentMethod);
    if (params.from) httpParams = httpParams.set('from', params.from);
    if (params.to) httpParams = httpParams.set('to', params.to);
    if (params.page != null) httpParams = httpParams.set('page', params.page.toString());
    if (params.limit != null) httpParams = httpParams.set('limit', params.limit.toString());
    return this.http.get<PaginatedResponse<Booking>>(this.api, { params: httpParams });
  }

  get(id: string): Observable<ApiResponse<Booking>> {
    return this.http.get<ApiResponse<Booking>>(`${this.api}/${id}`);
  }

  updateStatus(id: string, status: string): Observable<any> {
    return this.http.patch(`${this.api}/${id}/status`, { status });
  }

  issueRefund(id: string, amount: number): Observable<any> {
    return this.http.post(`${this.api}/${id}/refund`, { amount });
  }

  exportCsv(params: any = {}): Observable<Blob> {
    let httpParams = new HttpParams();
    Object.keys(params).forEach(k => {
      if (params[k] != null) httpParams = httpParams.set(k, params[k].toString());
    });
    return this.http.get(`${this.api}/export`, { params: httpParams, responseType: 'blob' });
  }
}
