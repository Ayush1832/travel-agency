import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { SupportService } from './support.service';
import { environment } from '../../../environments/environment';

const API = `${environment.apiUrl}/support/tickets`;

describe('SupportService (client)', () => {
  let service: SupportService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [SupportService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(SupportService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('createTicket() sends POST to /support/tickets', () => {
    service.createTicket({ subject: 'Help', body: 'Issue' } as any).subscribe();
    const req = http.expectOne(API);
    expect(req.request.method).toBe('POST');
    req.flush({ data: { _id: 't1' } });
  });

  it('listTickets() sends GET with filter params', () => {
    service.listTickets({ status: 'open', page: 1 }).subscribe();
    const req = http.expectOne((r) => r.url === API);
    expect(req.request.params.get('status')).toBe('open');
    req.flush({ data: { items: [], total: 0 } });
  });

  it('getTicket() sends GET to /support/tickets/:id', () => {
    service.getTicket('t1').subscribe();
    http.expectOne(`${API}/t1`).flush({ data: { _id: 't1' } });
  });

  it('reply() sends POST with body', () => {
    service.reply('t1', 'Thanks!').subscribe();
    const req = http.expectOne(`${API}/t1/reply`);
    expect(req.request.body).toEqual({ body: 'Thanks!' });
    req.flush({});
  });

  it('closeTicket() sends PATCH to /support/tickets/:id/close', () => {
    service.closeTicket('t1').subscribe();
    const req = http.expectOne(`${API}/t1/close`);
    expect(req.request.method).toBe('PATCH');
    req.flush({});
  });

  it('reopenTicket() sends PATCH to /support/tickets/:id/reopen', () => {
    service.reopenTicket('t1').subscribe();
    const req = http.expectOne(`${API}/t1/reopen`);
    expect(req.request.method).toBe('PATCH');
    req.flush({});
  });
});
