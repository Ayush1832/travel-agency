import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { WalletService } from './wallet.service';
import { environment } from '../../../environments/environment';

const API = `${environment.apiUrl}/wallet`;

describe('WalletService (client)', () => {
  let service: WalletService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [WalletService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(WalletService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('getBalance() sends GET to /wallet/balance', () => {
    service.getBalance().subscribe();
    http.expectOne(`${API}/balance`).flush({ data: { walletBalance: 50000 } });
  });

  it('getTransactions() sends GET with filter params', () => {
    service.getTransactions({ type: 'credit_booking', page: 2 }).subscribe();
    const req = http.expectOne((r) => r.url.includes('/transactions'));
    expect(req.request.params.get('type')).toBe('credit_booking');
    expect(req.request.params.get('page')).toBe('2');
    req.flush({ data: { items: [], total: 0 } });
  });

  it('getTransactions() omits empty params', () => {
    service.getTransactions({ type: '', page: 1 }).subscribe();
    const req = http.expectOne((r) => r.url.includes('/transactions'));
    expect(req.request.params.has('type')).toBe(false);
    req.flush({ data: { items: [], total: 0 } });
  });

  it('topUp() sends POST with amount and currency', () => {
    service.topUp(10000, 'AED').subscribe();
    const req = http.expectOne(`${API}/topup`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ amount: 10000, currency: 'AED' });
    req.flush({ data: { paymentUrl: 'https://pay.example.com' } });
  });

  it('redeemPoints() sends POST with points', () => {
    service.redeemPoints(100).subscribe();
    const req = http.expectOne(`${API}/loyalty/redeem`);
    expect(req.request.body).toEqual({ points: 100 });
    req.flush({});
  });

  it('getStatement() requests blob response', () => {
    service.getStatement('2026-01-01', '2026-12-31').subscribe();
    const req = http.expectOne((r) => r.url.includes('/statement'));
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob());
  });
});
