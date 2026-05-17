import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Company, ClientDetail, WalletTransaction } from '../models/company.models';
import { PaginatedResponse, ApiResponse } from '../models/common.models';

@Injectable({ providedIn: 'root' })
export class ClientsService {
  private readonly api = `${environment.apiUrl}/admin/clients`;

  constructor(private http: HttpClient) {}

  list(params: { status?: string; search?: string; page?: number; limit?: number } = {}): Observable<PaginatedResponse<Company>> {
    let httpParams = new HttpParams();
    if (params.status) httpParams = httpParams.set('status', params.status);
    if (params.search) httpParams = httpParams.set('search', params.search);
    if (params.page != null) httpParams = httpParams.set('page', params.page.toString());
    if (params.limit != null) httpParams = httpParams.set('limit', params.limit.toString());
    return this.http.get<PaginatedResponse<Company>>(this.api, { params: httpParams });
  }

  get(id: string): Observable<ApiResponse<ClientDetail>> {
    return this.http.get<ApiResponse<ClientDetail>>(`${this.api}/${id}`);
  }

  approve(id: string): Observable<any> {
    return this.http.post(`${this.api}/${id}/approve`, {});
  }

  reject(id: string, reason: string): Observable<any> {
    return this.http.post(`${this.api}/${id}/reject`, { reason });
  }

  suspend(id: string, reason: string): Observable<any> {
    return this.http.post(`${this.api}/${id}/suspend`, { reason });
  }

  activate(id: string): Observable<any> {
    return this.http.post(`${this.api}/${id}/activate`, {});
  }

  updateCreditLimit(id: string, creditLimit: number): Observable<any> {
    return this.http.patch(`${this.api}/${id}/credit-limit`, { creditLimit });
  }

  adminTopUp(id: string, amount: number, description: string): Observable<any> {
    return this.http.post(`${this.api}/${id}/wallet/top-up`, { amount, description });
  }

  recordSettlement(id: string, dto: { amount: number; mode: string; referenceNo?: string; notes?: string }): Observable<any> {
    return this.http.post(`${this.api}/${id}/settlements`, dto);
  }

  getOutstanding(): Observable<ApiResponse<unknown>> {
    return this.http.get<ApiResponse<unknown>>(`${this.api}/outstanding`);
  }

  getTransactions(id: string, params: { page?: number; limit?: number } = {}): Observable<PaginatedResponse<WalletTransaction>> {
    let httpParams = new HttpParams();
    if (params.page != null) httpParams = httpParams.set('page', params.page.toString());
    if (params.limit != null) httpParams = httpParams.set('limit', params.limit.toString());
    return this.http.get<PaginatedResponse<WalletTransaction>>(`${this.api}/${id}/transactions`, { params: httpParams });
  }
}
