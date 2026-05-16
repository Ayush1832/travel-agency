import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SupportTicket } from '../models/admin.models';
import { PaginatedResponse, ApiResponse } from '../models/common.models';

@Injectable({ providedIn: 'root' })
export class SupportAdminService {
  private readonly api = `${environment.apiUrl}/admin/support/tickets`;

  constructor(private http: HttpClient) {}

  list(params: { status?: string; priority?: string; category?: string; page?: number; limit?: number } = {}): Observable<PaginatedResponse<SupportTicket>> {
    let httpParams = new HttpParams();
    if (params.status) httpParams = httpParams.set('status', params.status);
    if (params.priority) httpParams = httpParams.set('priority', params.priority);
    if (params.category) httpParams = httpParams.set('category', params.category);
    if (params.page != null) httpParams = httpParams.set('page', params.page.toString());
    if (params.limit != null) httpParams = httpParams.set('limit', params.limit.toString());
    return this.http.get<PaginatedResponse<SupportTicket>>(this.api, { params: httpParams });
  }

  get(id: string): Observable<ApiResponse<SupportTicket>> {
    return this.http.get<ApiResponse<SupportTicket>>(`${this.api}/${id}`);
  }

  assign(id: string, subAdminId: string): Observable<any> {
    return this.http.patch(`${this.api}/${id}`, { assigneeId: subAdminId });
  }

  updateStatus(id: string, status: string): Observable<any> {
    return this.http.patch(`${this.api}/${id}`, { status });
  }

  reply(id: string, body: string): Observable<any> {
    return this.http.post(`${this.api}/${id}/reply`, { body });
  }
}
