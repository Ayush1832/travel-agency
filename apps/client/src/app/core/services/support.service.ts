import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { SupportTicket, CreateTicketDto } from '../models/support.models';
import { ApiResponse, PaginatedResponse, PaginatedData } from '../models/common.models';

export interface TicketFilters {
  status?: string;
  page?: number;
  limit?: number;
}

@Injectable({ providedIn: 'root' })
export class SupportService {
  private readonly api = `${environment.apiUrl}/support/tickets`;

  constructor(private http: HttpClient) {}

  createTicket(dto: CreateTicketDto): Observable<SupportTicket> {
    return this.http
      .post<ApiResponse<SupportTicket>>(this.api, dto)
      .pipe(map((res) => res.data));
  }

  listTickets(filters: TicketFilters = {}): Observable<PaginatedData<SupportTicket>> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        params = params.set(k, String(v));
      }
    });
    return this.http
      .get<PaginatedResponse<SupportTicket>>(this.api, { params })
      .pipe(map((res) => res.data));
  }

  getTicket(id: string): Observable<SupportTicket> {
    return this.http
      .get<ApiResponse<SupportTicket>>(`${this.api}/${id}`)
      .pipe(map((res) => res.data));
  }

  reply(id: string, body: string): Observable<unknown> {
    return this.http.post(`${this.api}/${id}/reply`, { body });
  }
}
