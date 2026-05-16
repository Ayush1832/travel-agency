import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Role, SubAdmin } from '../models/admin.models';
import { ApiResponse } from '../models/common.models';

@Injectable({ providedIn: 'root' })
export class SubAdminService {
  private readonly api = `${environment.apiUrl}/admin`;

  constructor(private http: HttpClient) {}

  listRoles(): Observable<ApiResponse<Role[]>> {
    return this.http.get<ApiResponse<Role[]>>(`${this.api}/roles`);
  }

  createRole(dto: Partial<Role>): Observable<any> {
    return this.http.post(`${this.api}/roles`, dto);
  }

  updateRole(id: string, dto: Partial<Role>): Observable<any> {
    return this.http.patch(`${this.api}/roles/${id}`, dto);
  }

  deleteRole(id: string): Observable<any> {
    return this.http.delete(`${this.api}/roles/${id}`);
  }

  listSubAdmins(): Observable<ApiResponse<SubAdmin[]>> {
    return this.http.get<ApiResponse<SubAdmin[]>>(`${this.api}/sub-admins`);
  }

  createSubAdmin(dto: any): Observable<any> {
    return this.http.post(`${this.api}/sub-admins`, dto);
  }

  updateSubAdmin(id: string, dto: any): Observable<any> {
    return this.http.patch(`${this.api}/sub-admins/${id}`, dto);
  }

  disableSubAdmin(id: string): Observable<any> {
    return this.http.patch(`${this.api}/sub-admins/${id}/disable`, {});
  }
}
