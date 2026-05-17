import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { BookingsService } from './bookings.service';
import { environment } from '../../../environments/environment';

const API = `${environment.apiUrl}/bookings`;

describe('BookingsService (client)', () => {
  let service: BookingsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [BookingsService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(BookingsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('createBooking() sends POST to /bookings', () => {
    service.createBooking({ prebookToken: 'tok', paymentMethod: 'credit', currency: 'AED' } as any).subscribe();
    const req = http.expectOne(API);
    expect(req.request.method).toBe('POST');
    req.flush({ data: { _id: 'b1' } });
  });

  it('listBookings() sends GET with filter params', () => {
    service.listBookings({ status: 'confirmed', page: 1, limit: 10 }).subscribe();
    const req = http.expectOne((r) => r.url === API);
    expect(req.request.params.get('status')).toBe('confirmed');
    expect(req.request.params.get('page')).toBe('1');
    req.flush({ data: { items: [], total: 0 } });
  });

  it('listBookings() omits empty filter values', () => {
    service.listBookings({ status: '', page: 1 }).subscribe();
    const req = http.expectOne((r) => r.url === API);
    expect(req.request.params.has('status')).toBe(false);
    req.flush({ data: { items: [], total: 0 } });
  });

  it('getBooking() sends GET to /bookings/:id', () => {
    service.getBooking('b1').subscribe();
    http.expectOne(`${API}/b1`).flush({ data: { _id: 'b1' } });
  });

  it('cancelBooking() sends POST to /bookings/:id/cancel', () => {
    service.cancelBooking('b1', { reason: 'Changed plans' }).subscribe();
    const req = http.expectOne(`${API}/b1/cancel`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('getVoucher() requests blob response', () => {
    service.getVoucher('b1').subscribe();
    const req = http.expectOne(`${API}/b1/voucher`);
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob());
  });
});
