import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { AdminBookingsService } from './admin-bookings.service';
import { environment } from '../../../environments/environment';

const API = `${environment.apiUrl}/admin/bookings`;

describe('AdminBookingsService', () => {
  let service: AdminBookingsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [AdminBookingsService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(AdminBookingsService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('creates the service', () => expect(service).toBeTruthy());

  it('list() calls GET /admin/bookings with no params when called with defaults', () => {
    service.list().subscribe();
    const req = http.expectOne(r => r.url === API);
    expect(req.request.method).toBe('GET');
    req.flush({ data: { data: [], total: 0 } });
  });

  it('list() passes all filter params', () => {
    service.list({ search: 'test', status: 'confirmed', paymentMethod: 'credit', from: '2026-01-01', to: '2026-01-31', page: 2, limit: 10 }).subscribe();
    const req = http.expectOne(r => r.url === API && r.params.get('search') === 'test' && r.params.get('status') === 'confirmed');
    expect(req.request.params.get('page')).toBe('2');
    req.flush({ data: { data: [], total: 0 } });
  });

  it('get() calls GET /admin/bookings/:id', () => {
    service.get('b1').subscribe();
    http.expectOne(`${API}/b1`).flush({ data: {} });
  });

  it('updateStatus() calls PATCH /admin/bookings/:id/status', () => {
    service.updateStatus('b1', 'cancelled').subscribe();
    const req = http.expectOne(`${API}/b1/status`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ status: 'cancelled' });
    req.flush({});
  });

  it('issueRefund() calls POST /admin/bookings/:id/refund', () => {
    service.issueRefund('b1', 5000).subscribe();
    const req = http.expectOne(`${API}/b1/refund`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ amount: 5000 });
    req.flush({});
  });

  it('resendVoucher() calls POST /admin/bookings/:id/resend-voucher', () => {
    service.resendVoucher('b1').subscribe();
    const req = http.expectOne(`${API}/b1/resend-voucher`);
    expect(req.request.method).toBe('POST');
    req.flush({ sentTo: 'a@b.com' });
  });

  it('resync() calls POST /admin/bookings/:id/resync', () => {
    service.resync('b1').subscribe();
    const req = http.expectOne(`${API}/b1/resync`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('exportCsv() calls GET /admin/bookings/export as blob', () => {
    service.exportCsv({ status: 'confirmed' }).subscribe();
    const req = http.expectOne(r => r.url === `${API}/export`);
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob());
  });
});
