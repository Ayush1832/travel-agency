import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { GuestGuard } from './guest.guard';
import { AuthService } from '../services/auth.service';
import { environment } from '../../../environments/environment';

describe('GuestGuard (client)', () => {
  let guard: GuestGuard;
  let authService: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [GuestGuard, AuthService, provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    guard = TestBed.inject(GuestGuard);
    authService = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('redirects to /dashboard when already authenticated', (done) => {
    authService.isAuthenticated.set(true);
    guard.canActivate().subscribe((result) => {
      expect(result).not.toBe(true);
      done();
    });
  });

  it('redirects to /dashboard when getMe() succeeds (user is logged in)', (done) => {
    authService.isAuthenticated.set(false);
    const mockUser = { _id: 'u1', email: 'a@b.com', firstName: 'A', lastName: 'B', role: 'client_owner', companyId: 'c1', status: 'active' };
    guard.canActivate().subscribe((result) => {
      expect(result).not.toBe(true);
      done();
    });
    http.expectOne(`${environment.apiUrl}/auth/me`).flush({ data: { user: mockUser } });
  });

  it('returns true (allow guest access) when getMe() fails', (done) => {
    authService.isAuthenticated.set(false);
    guard.canActivate().subscribe((result) => {
      expect(result).toBe(true);
      done();
    });
    http.expectOne(`${environment.apiUrl}/auth/me`).flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });
  });
});
