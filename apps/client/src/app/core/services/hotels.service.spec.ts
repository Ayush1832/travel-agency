import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { HotelsService } from './hotels.service';
import { environment } from '../../../environments/environment';

const API = `${environment.apiUrl}/hotels`;

describe('HotelsService (client)', () => {
  let service: HotelsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [HotelsService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(HotelsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('initialises with empty signals', () => {
    expect(service.lastSearchId()).toBe('');
    expect(service.lastSearchResults()).toEqual([]);
    expect(service.selectedRoom()).toBeNull();
  });

  it('autocomplete() sends GET with query param', () => {
    service.autocomplete('Dub').subscribe();
    const req = http.expectOne((r) => r.url.includes('/destinations/autocomplete'));
    expect(req.request.params.get('q')).toBe('Dub');
    req.flush({ data: [] });
  });

  it('search() updates lastSearchId signal', (done) => {
    service.search({ cityId: 'DXB', checkIn: '2026-07-01', checkOut: '2026-07-05', adults: 2 } as any).subscribe(() => {
      expect(service.lastSearchId()).toBe('SRCH-001');
      done();
    });
    http.expectOne(`${API}/search`).flush({ data: { searchId: 'SRCH-001', results: [] } });
  });

  it('getDetails() sends GET with searchId param', () => {
    service.getDetails('h1', 'SRCH-001').subscribe();
    const req = http.expectOne((r) => r.url.includes('/h1'));
    expect(req.request.params.get('searchId')).toBe('SRCH-001');
    req.flush({ data: {} });
  });

  it('prebook() sends POST with roomToken', () => {
    service.prebook('RT-abc').subscribe();
    const req = http.expectOne(`${API}/prebook`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ roomToken: 'RT-abc' });
    req.flush({ data: {} });
  });
});
