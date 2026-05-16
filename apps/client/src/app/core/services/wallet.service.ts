import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { CreditBalance, WalletTransaction } from '../models/wallet.models';
import { ApiResponse, PaginatedResponse, PaginatedData } from '../models/common.models';

export interface TransactionFilters {
  type?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

@Injectable({ providedIn: 'root' })
export class WalletService {
  private readonly api = `${environment.apiUrl}/wallet`;

  constructor(private http: HttpClient) {}

  getBalance(): Observable<CreditBalance> {
    return this.http
      .get<ApiResponse<CreditBalance>>(`${this.api}/balance`)
      .pipe(map((res) => res.data));
  }

  getTransactions(filters: TransactionFilters = {}): Observable<PaginatedData<WalletTransaction>> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        params = params.set(k, String(v));
      }
    });
    return this.http
      .get<PaginatedResponse<WalletTransaction>>(`${this.api}/transactions`, { params })
      .pipe(map((res) => res.data));
  }

  topUp(amount: number, currency: string): Observable<{ paymentUrl: string }> {
    return this.http
      .post<ApiResponse<{ paymentUrl: string }>>(`${this.api}/topup`, { amount, currency })
      .pipe(map((res) => res.data));
  }

  redeemPoints(points: number): Observable<unknown> {
    return this.http.post(`${this.api}/loyalty/redeem`, { points });
  }
}
