import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { AuthGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';
import { environment } from '../../../environments/environment';

describe('AuthGuard (client)', () => {
  let guard: AuthGuard;
  let authService: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AuthGuard,
        AuthService,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    guard = TestBed.inject(AuthGuard);
    authService = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('returns true when already authenticated', (done) => {
    authService.isAuthenticated.set(true);
    guard.canActivate().subscribe((result) => {
      expect(result).toBe(true);
      done();
    });
  });

  it('calls getMe() and returns true on success', (done) => {
    authService.isAuthenticated.set(false);
    const mockUser = { _id: 'u1', email: 'a@b.com', firstName: 'A', lastName: 'B', role: 'client_owner', companyId: 'c1', status: 'active' };

    guard.canActivate().subscribe((result) => {
      expect(result).toBe(true);
      done();
    });

    http.expectOne(`${environment.apiUrl}/auth/me`).flush({ data: { user: mockUser } });
  });

  it('redirects to /auth/login when getMe() fails', (done) => {
    authService.isAuthenticated.set(false);

    guard.canActivate().subscribe((result) => {
      expect(result).not.toBe(true);
      done();
    });

    http.expectOne(`${environment.apiUrl}/auth/me`).flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });
  });
});
