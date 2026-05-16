import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  HotelSearchDto,
  NormalizedHotelResult,
  NormalizedHotelDetails,
  PrebookResult,
} from '../models/hotel.models';
import { ApiResponse } from '../models/common.models';

export interface DestinationSuggestion {
  cityCode: string;
  cityName: string;
  country: string;
}

export interface HotelSearchResponse {
  searchId: string;
  results: NormalizedHotelResult[];
}

@Injectable({ providedIn: 'root' })
export class HotelsService {
  private readonly api = `${environment.apiUrl}/hotels`;

  lastSearchId = signal<string>('');
  lastSearchResults = signal<NormalizedHotelResult[]>([]);
  selectedRoom = signal<{ roomToken: string; price: number; currency: string; roomType: string; mealPlan: string; cancellationPolicy?: string } | null>(null);
  lastSearchDto = signal<HotelSearchDto | null>(null);
  selectedHotelName = signal<string>('');

  constructor(private http: HttpClient) {}

  autocomplete(q: string): Observable<DestinationSuggestion[]> {
    return this.http
      .get<ApiResponse<DestinationSuggestion[]>>(`${this.api}/destinations/autocomplete`, {
        params: { q },
      })
      .pipe(map((res) => res.data));
  }

  search(dto: HotelSearchDto): Observable<HotelSearchResponse> {
    return this.http
      .post<ApiResponse<HotelSearchResponse>>(`${this.api}/search`, dto)
      .pipe(
        map((res) => {
          this.lastSearchId.set(res.data.searchId);
          this.lastSearchResults.set(res.data.results);
          return res.data;
        }),
      );
  }

  getDetails(supplierHotelId: string, searchId: string): Observable<NormalizedHotelDetails> {
    return this.http
      .get<ApiResponse<NormalizedHotelDetails>>(`${this.api}/${supplierHotelId}`, {
        params: { searchId },
      })
      .pipe(map((res) => res.data));
  }

  prebook(roomToken: string): Observable<PrebookResult> {
    return this.http
      .post<ApiResponse<PrebookResult>>(`${this.api}/prebook`, { roomToken })
      .pipe(map((res) => res.data));
  }
}
