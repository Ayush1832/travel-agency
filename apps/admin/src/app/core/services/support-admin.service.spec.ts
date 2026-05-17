import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { SupportAdminService } from './support-admin.service';
import { environment } from '../../../environments/environment';

const API = `${environment.apiUrl}/admin/support/tickets`;

describe('SupportAdminService', () => {
  let service: SupportAdminService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [SupportAdminService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(SupportAdminService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('creates the service', () => expect(service).toBeTruthy());

  it('list() calls GET /admin/support/tickets with no params by default', () => {
    service.list().subscribe();
    const req = http.expectOne(r => r.url === API);
    expect(req.request.method).toBe('GET');
    req.flush({ data: { data: [], total: 0 } });
  });

  it('list() passes filter params', () => {
    service.list({ status: 'open', priority: 'high', category: 'booking', page: 1, limit: 10 }).subscribe();
    const req = http.expectOne(r => r.url === API && r.params.get('status') === 'open');
    expect(req.request.params.get('priority')).toBe('high');
    expect(req.request.params.get('category')).toBe('booking');
    req.flush({ data: { data: [], total: 0 } });
  });

  it('get() calls GET /admin/support/tickets/:id', () => {
    service.get('t1').subscribe();
    http.expectOne(`${API}/t1`).flush({ data: {} });
  });

  it('assign() calls PATCH /admin/support/tickets/:id with assigneeId', () => {
    service.assign('t1', 'sa1').subscribe();
    const req = http.expectOne(`${API}/t1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ assigneeId: 'sa1' });
    req.flush({});
  });

  it('updateStatus() calls PATCH /admin/support/tickets/:id with status', () => {
    service.updateStatus('t1', 'resolved').subscribe();
    const req = http.expectOne(`${API}/t1`);
    expect(req.request.body).toEqual({ status: 'resolved' });
    req.flush({});
  });

  it('reply() calls POST /admin/support/tickets/:id/reply', () => {
    service.reply('t1', 'Here is my reply').subscribe();
    const req = http.expectOne(`${API}/t1/reply`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ body: 'Here is my reply' });
    req.flush({});
  });
});
