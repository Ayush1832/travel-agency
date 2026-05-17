import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { NotificationsService } from './notifications.service';
import { environment } from '../../../environments/environment';

const API = `${environment.apiUrl}/notifications`;

describe('NotificationsService (client)', () => {
  let service: NotificationsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [NotificationsService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(NotificationsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    service.stopPolling();
    http.verify();
  });

  it('initialises unreadCount to 0', () => {
    expect(service.unreadCount()).toBe(0);
  });

  it('getAll() sends GET to /notifications', () => {
    service.getAll({ page: 1, limit: 10 }).subscribe();
    const req = http.expectOne((r) => r.url === API);
    expect(req.request.params.get('page')).toBe('1');
    req.flush({ data: { items: [], total: 0 } });
  });

  it('getUnreadCount() sends GET to /notifications/unread-count', () => {
    service.getUnreadCount().subscribe();
    http.expectOne(`${API}/unread-count`).flush({ data: { count: 5 } });
  });

  it('markRead() sends PATCH to /notifications/:id/read', () => {
    service.markRead('n1').subscribe();
    const req = http.expectOne(`${API}/n1/read`);
    expect(req.request.method).toBe('PATCH');
    req.flush({});
  });

  it('markAllRead() sends POST to /notifications/read-all', () => {
    service.markAllRead().subscribe();
    const req = http.expectOne(`${API}/read-all`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('startPolling() immediately fetches unread count', fakeAsync(() => {
    service.startPolling();
    http.expectOne(`${API}/unread-count`).flush({ data: { count: 3 } });
    tick(0);
    expect(service.unreadCount()).toBe(3);
    service.stopPolling();
  }));

  it('stopPolling() stops interval subscriptions', () => {
    service.startPolling();
    http.expectOne(`${API}/unread-count`).flush({ data: { count: 0 } });
    service.stopPolling();
    // After stopping, no more requests should be issued
  });
});
