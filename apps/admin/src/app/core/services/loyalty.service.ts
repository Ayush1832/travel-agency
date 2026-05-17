import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LoyaltyRule } from '../models/admin.models';

@Injectable({ providedIn: 'root' })
export class LoyaltyService {
  private readonly base = `${environment.apiUrl}/admin/loyalty-rules`;

  constructor(private http: HttpClient) {}

  list(): Observable<{ data: LoyaltyRule[] }> {
    return this.http.get<{ data: LoyaltyRule[] }>(this.base);
  }

  create(dto: Partial<LoyaltyRule>): Observable<LoyaltyRule> {
    return this.http.post<LoyaltyRule>(this.base, dto);
  }

  update(id: string, dto: Partial<LoyaltyRule>): Observable<LoyaltyRule> {
    return this.http.patch<LoyaltyRule>(`${this.base}/${id}`, dto);
  }

  addEligibleHotel(ruleId: string, hotelId: string): Observable<LoyaltyRule> {
    return this.http.post<LoyaltyRule>(`${this.base}/${ruleId}/eligible-hotels`, { hotelId });
  }

  removeEligibleHotel(ruleId: string, hotelId: string): Observable<LoyaltyRule> {
    return this.http.delete<LoyaltyRule>(`${this.base}/${ruleId}/eligible-hotels/${hotelId}`);
  }
}
