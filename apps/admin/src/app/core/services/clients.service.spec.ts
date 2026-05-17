import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ClientsService } from './clients.service';
import { environment } from '../../../environments/environment';

const API = `${environment.apiUrl}/admin/clients`;

describe('ClientsService', () => {
  let service: ClientsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [ClientsService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ClientsService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('creates the service', () => expect(service).toBeTruthy());

  it('list() calls GET /admin/clients with no params by default', () => {
    service.list().subscribe();
    const req = http.expectOne(r => r.url === API);
    expect(req.request.method).toBe('GET');
    req.flush({ data: { data: [], total: 0 } });
  });

  it('list() passes status and search params', () => {
    service.list({ status: 'pending', search: 'acme', page: 1, limit: 10 }).subscribe();
    const req = http.expectOne(r => r.url === API && r.params.get('status') === 'pending');
    expect(req.request.params.get('search')).toBe('acme');
    req.flush({ data: { data: [], total: 0 } });
  });

  it('get() calls GET /admin/clients/:id', () => {
    service.get('c1').subscribe();
    http.expectOne(`${API}/c1`).flush({ data: {} });
  });

  it('approve() calls POST /admin/clients/:id/approve', () => {
    service.approve('c1').subscribe();
    const req = http.expectOne(`${API}/c1/approve`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('reject() calls POST /admin/clients/:id/reject with reason', () => {
    service.reject('c1', 'fraud').subscribe();
    const req = http.expectOne(`${API}/c1/reject`);
    expect(req.request.body).toEqual({ reason: 'fraud' });
    req.flush({});
  });

  it('suspend() calls POST /admin/clients/:id/suspend with reason', () => {
    service.suspend('c1', 'policy violation').subscribe();
    const req = http.expectOne(`${API}/c1/suspend`);
    expect(req.request.body).toEqual({ reason: 'policy violation' });
    req.flush({});
  });

  it('activate() calls POST /admin/clients/:id/activate', () => {
    service.activate('c1').subscribe();
    http.expectOne(`${API}/c1/activate`).flush({});
  });

  it('updateCreditLimit() calls PATCH /admin/clients/:id/credit-limit', () => {
    service.updateCreditLimit('c1', 500000).subscribe();
    const req = http.expectOne(`${API}/c1/credit-limit`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ creditLimit: 500000 });
    req.flush({});
  });

  it('adminTopUp() calls POST /admin/clients/:id/wallet/top-up', () => {
    service.adminTopUp('c1', 10000, 'Manual credit').subscribe();
    const req = http.expectOne(`${API}/c1/wallet/top-up`);
    expect(req.request.body).toEqual({ amount: 10000, description: 'Manual credit' });
    req.flush({});
  });

  it('recordSettlement() calls POST /admin/clients/:id/settlements', () => {
    service.recordSettlement('c1', { amount: 5000, mode: 'bank_transfer' }).subscribe();
    const req = http.expectOne(`${API}/c1/settlements`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('getOutstanding() calls GET /admin/clients/outstanding', () => {
    service.getOutstanding().subscribe();
    http.expectOne(`${API}/outstanding`).flush({ data: [] });
  });

  it('getTransactions() calls GET /admin/clients/:id/transactions', () => {
    service.getTransactions('c1', { page: 1, limit: 10 }).subscribe();
    const req = http.expectOne(r => r.url === `${API}/c1/transactions`);
    expect(req.request.params.get('page')).toBe('1');
    req.flush({ data: { data: [], total: 0 } });
  });
});
