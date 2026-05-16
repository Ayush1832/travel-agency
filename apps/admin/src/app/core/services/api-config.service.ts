import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiConfig } from '../models/admin.models';
import { ApiResponse } from '../models/common.models';

@Injectable({ providedIn: 'root' })
export class ApiConfigService {
  private readonly api = `${environment.apiUrl}/admin/integrations`;

  constructor(private http: HttpClient) {}

  list(): Observable<ApiResponse<ApiConfig[]>> {
    return this.http.get<ApiResponse<ApiConfig[]>>(this.api);
  }

  update(provider: string, dto: any): Observable<any> {
    return this.http.patch(`${this.api}/${provider}`, dto);
  }

  test(provider: string): Observable<any> {
    return this.http.post(`${this.api}/${provider}/test`, {});
  }
}
