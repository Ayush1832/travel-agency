import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { RevenueReport, BookingsReport, CreditReport } from '../models/report.models';
import { ApiResponse } from '../models/common.models';

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private readonly api = `${environment.apiUrl}/admin/reports`;

  constructor(private http: HttpClient) {}

  getRevenue(from: string, to: string): Observable<ApiResponse<RevenueReport>> {
    const params = new HttpParams().set('from', from).set('to', to);
    return this.http.get<ApiResponse<RevenueReport>>(`${this.api}/revenue`, { params });
  }

  getBookings(from: string, to: string, groupBy?: string): Observable<ApiResponse<BookingsReport>> {
    let params = new HttpParams().set('from', from).set('to', to);
    if (groupBy) params = params.set('groupBy', groupBy);
    return this.http.get<ApiResponse<BookingsReport>>(`${this.api}/bookings`, { params });
  }

  getCredit(from: string, to: string): Observable<ApiResponse<CreditReport>> {
    const params = new HttpParams().set('from', from).set('to', to);
    return this.http.get<ApiResponse<CreditReport>>(`${this.api}/credit`, { params });
  }

  exportReport(type: string, format: string, params: any = {}): Observable<Blob> {
    let httpParams = new HttpParams().set('format', format);
    Object.keys(params).forEach(k => {
      if (params[k] != null) httpParams = httpParams.set(k, params[k].toString());
    });
    return this.http.get(`${this.api}/${type}/export`, { params: httpParams, responseType: 'blob' });
  }
}
