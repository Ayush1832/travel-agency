import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HTTP_INTERCEPTORS, HttpClient, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { AuthInterceptor } from './auth.interceptor';
import { AuthService } from '../services/auth.service';
import { environment } from '../../../environments/environment';

describe('AuthInterceptor (client)', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let authService: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AuthService,
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    authService = TestBed.inject(AuthService);
  });

  afterEach(() => httpMock.verify());

  it('adds withCredentials to every outgoing request', () => {
    http.get('/api/test').subscribe();
    const req = httpMock.expectOne('/api/test');
    expect(req.request.withCredentials).toBe(true);
    req.flush({});
  });

  it('passes non-401 errors through unchanged', (done) => {
    http.get('/api/resource').subscribe({
      error: (err) => {
        expect(err.status).toBe(403);
        done();
      },
    });
    httpMock.expectOne('/api/resource').flush('Forbidden', { status: 403, statusText: 'Forbidden' });
  });

  it('does NOT attempt token refresh for /auth/ endpoints on 401', (done) => {
    http.post(`${environment.apiUrl}/auth/login`, {}).subscribe({
      error: () => done(),
    });
    httpMock.expectOne(`${environment.apiUrl}/auth/login`).flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });
  });

  it('attempts token refresh on 401 for non-auth endpoints', (done) => {
    http.get('/api/v1/bookings').subscribe({
      next: () => done(),
      error: () => done(),
    });
    httpMock.expectOne('/api/v1/bookings').flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });
    const refreshReq = httpMock.expectOne(`${environment.apiUrl}/auth/refresh`);
    expect(refreshReq.request.withCredentials).toBe(true);
    refreshReq.flush({});
    httpMock.expectOne('/api/v1/bookings').flush([]);
  });
});
