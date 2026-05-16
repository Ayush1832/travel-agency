import { Injectable, signal, OnDestroy } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, Subscription, interval } from 'rxjs';
import { map, switchMap, startWith } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { AppNotification } from '../models/notification.models';
import { ApiResponse, PaginatedResponse, PaginatedData } from '../models/common.models';

export interface NotificationFilters {
  page?: number;
  limit?: number;
}

@Injectable({ providedIn: 'root' })
export class NotificationsService implements OnDestroy {
  private readonly api = `${environment.apiUrl}/notifications`;
  unreadCount = signal<number>(0);
  private pollSub?: Subscription;

  constructor(private http: HttpClient) {}

  startPolling() {
    this.stopPolling();
    this.pollSub = interval(30000)
      .pipe(
        startWith(0),
        switchMap(() => this.getUnreadCount()),
      )
      .subscribe((res) => this.unreadCount.set(res.count));
  }

  stopPolling() {
    this.pollSub?.unsubscribe();
  }

  ngOnDestroy() {
    this.stopPolling();
  }

  getAll(filters: NotificationFilters = {}): Observable<PaginatedData<AppNotification>> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null) {
        params = params.set(k, String(v));
      }
    });
    return this.http
      .get<PaginatedResponse<AppNotification>>(this.api, { params })
      .pipe(map((res) => res.data));
  }

  getUnreadCount(): Observable<{ count: number }> {
    return this.http
      .get<ApiResponse<{ count: number }>>(`${this.api}/unread-count`)
      .pipe(map((res) => res.data));
  }

  markRead(id: string): Observable<unknown> {
    return this.http.patch(`${this.api}/${id}/read`, {});
  }

  markAllRead(): Observable<unknown> {
    return this.http.post(`${this.api}/read-all`, {});
  }
}
