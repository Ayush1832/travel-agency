import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ReportsService } from './reports.service';
import { environment } from '../../../environments/environment';

const API = `${environment.apiUrl}/admin/reports`;

describe('ReportsService', () => {
  let service: ReportsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [ReportsService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ReportsService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('creates the service', () => expect(service).toBeTruthy());

  it('getRevenue() calls GET /admin/reports/revenue with from/to params', () => {
    service.getRevenue('2026-01-01', '2026-01-31').subscribe();
    const req = http.expectOne(r => r.url === `${API}/revenue`);
    expect(req.request.params.get('from')).toBe('2026-01-01');
    expect(req.request.params.get('to')).toBe('2026-01-31');
    req.flush({ data: {} });
  });

  it('getBookings() calls GET /admin/reports/bookings, optional groupBy', () => {
    service.getBookings('2026-01-01', '2026-01-31', 'day').subscribe();
    const req = http.expectOne(r => r.url === `${API}/bookings`);
    expect(req.request.params.get('groupBy')).toBe('day');
    req.flush({ data: {} });
  });

  it('getBookings() omits groupBy when not provided', () => {
    service.getBookings('2026-01-01', '2026-01-31').subscribe();
    const req = http.expectOne(r => r.url === `${API}/bookings`);
    expect(req.request.params.has('groupBy')).toBe(false);
    req.flush({ data: {} });
  });

  it('getCredit() calls GET /admin/reports/credit', () => {
    service.getCredit('2026-01-01', '2026-01-31').subscribe();
    http.expectOne(r => r.url === `${API}/credit`).flush({ data: {} });
  });

  it('getApiUsage() calls GET /admin/reports/api-usage', () => {
    service.getApiUsage('2026-01-01', '2026-01-31').subscribe();
    http.expectOne(r => r.url === `${API}/api-usage`).flush({ data: {} });
  });

  it('getCancellationReport() calls GET /admin/reports/cancellations', () => {
    service.getCancellationReport('2026-01-01', '2026-01-31').subscribe();
    http.expectOne(r => r.url === `${API}/cancellations`).flush({ data: {} });
  });

  it('exportReport() calls GET with blob responseType', () => {
    service.exportReport('revenue', 'csv', { from: '2026-01-01', to: '2026-01-31' }).subscribe();
    const req = http.expectOne(r => r.url === `${API}/revenue/export`);
    expect(req.request.responseType).toBe('blob');
    expect(req.request.params.get('format')).toBe('csv');
    req.flush(new Blob());
  });
});
