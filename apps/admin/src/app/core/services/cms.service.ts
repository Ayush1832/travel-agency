import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CmsPage, CmsBanner, EmailTemplate } from '../models/cms.models';
import { ApiResponse } from '../models/common.models';

@Injectable({ providedIn: 'root' })
export class CmsService {
  private readonly api = `${environment.apiUrl}/admin/cms`;

  constructor(private http: HttpClient) {}

  getPages(): Observable<ApiResponse<CmsPage[]>> {
    return this.http.get<ApiResponse<CmsPage[]>>(`${this.api}/pages`);
  }

  createPage(dto: Partial<CmsPage>): Observable<any> {
    return this.http.post(`${this.api}/pages`, dto);
  }

  updatePage(id: string, dto: Partial<CmsPage>): Observable<any> {
    return this.http.patch(`${this.api}/pages/${id}`, dto);
  }

  deletePage(id: string): Observable<any> {
    return this.http.delete(`${this.api}/pages/${id}`);
  }

  getBanners(): Observable<ApiResponse<CmsBanner[]>> {
    return this.http.get<ApiResponse<CmsBanner[]>>(`${this.api}/banners`);
  }

  createBanner(dto: Partial<CmsBanner>): Observable<any> {
    return this.http.post(`${this.api}/banners`, dto);
  }

  updateBanner(id: string, dto: Partial<CmsBanner>): Observable<any> {
    return this.http.patch(`${this.api}/banners/${id}`, dto);
  }

  deleteBanner(id: string): Observable<any> {
    return this.http.delete(`${this.api}/banners/${id}`);
  }

  getEmailTemplates(): Observable<ApiResponse<EmailTemplate[]>> {
    return this.http.get<ApiResponse<EmailTemplate[]>>(`${this.api}/email-templates`);
  }

  updateEmailTemplate(id: string, dto: Partial<EmailTemplate>): Observable<any> {
    return this.http.patch(`${this.api}/email-templates/${id}`, dto);
  }
}
