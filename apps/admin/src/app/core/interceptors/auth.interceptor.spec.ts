import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HTTP_INTERCEPTORS, HttpClient, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { AuthInterceptor } from './auth.interceptor';
import { AuthService } from '../services/auth.service';
import { environment } from '../../../environments/environment';

describe('AuthInterceptor (admin)', () => {
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
    http.get('/api/v1/admin/clients').subscribe();
    const req = httpMock.expectOne('/api/v1/admin/clients');
    expect(req.request.withCredentials).toBe(true);
    req.flush([]);
  });

  it('passes through non-401 errors', (done) => {
    http.get('/api/v1/admin/reports').subscribe({
      error: (err) => {
        expect(err.status).toBe(403);
        done();
      },
    });
    httpMock.expectOne('/api/v1/admin/reports').flush('Forbidden', { status: 403, statusText: 'Forbidden' });
  });

  it('does NOT refresh for /auth/ 401 errors', (done) => {
    http.post(`${environment.apiUrl}/auth/login`, {}).subscribe({
      error: () => done(),
    });
    httpMock.expectOne(`${environment.apiUrl}/auth/login`).flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });
  });

  it('refreshes token on 401 for protected admin endpoints', (done) => {
    http.get('/api/v1/admin/clients').subscribe({
      next: () => done(),
      error: () => done(),
    });
    httpMock.expectOne('/api/v1/admin/clients').flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });
    const refreshReq = httpMock.expectOne(`${environment.apiUrl}/auth/refresh`);
    expect(refreshReq.request.withCredentials).toBe(true);
    refreshReq.flush({});
    httpMock.expectOne('/api/v1/admin/clients').flush([]);
  });

  it('navigates to login and clears auth when refresh token fails', (done) => {
    authService.isAuthenticated.set(true);

    http.get('/api/v1/admin/clients').subscribe({
      error: () => {
        expect(authService.isAuthenticated()).toBe(false);
        done();
      },
    });
    httpMock.expectOne('/api/v1/admin/clients').flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });
    httpMock.expectOne(`${environment.apiUrl}/auth/refresh`).flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });
  });
});
