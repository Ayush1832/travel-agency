import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

describe('AuthService (admin)', () => {
  let service: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AuthService,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('initialises with unauthenticated state', () => {
    expect(service.isAuthenticated()).toBe(false);
    expect(service.currentUser()).toBeNull();
  });

  describe('login()', () => {
    const superAdminUser = { _id: 'a1', email: 'admin@b.com', firstName: 'Admin', lastName: 'A', role: 'super_admin' as const, status: 'active' };

    it('sets currentUser for super_admin on success', (done) => {
      service.login('admin@b.com', 'pass').subscribe(() => {
        expect(service.isAuthenticated()).toBe(true);
        expect(service.currentUser()?.role).toBe('super_admin');
        done();
      });
      http.expectOne(`${environment.apiUrl}/auth/login`).flush({ data: { user: superAdminUser } });
    });

    it('sets currentUser for sub_admin on success', (done) => {
      const subAdmin = { ...superAdminUser, role: 'sub_admin' as const, subRoleId: 'role1' };
      service.login('sub@b.com', 'pass').subscribe(() => {
        expect(service.isAuthenticated()).toBe(true);
        expect(service.currentUser()?.role).toBe('sub_admin');
        done();
      });
      http.expectOne(`${environment.apiUrl}/auth/login`).flush({ data: { user: subAdmin } });
    });

    it('throws when user role is not admin', (done) => {
      const clientUser = { ...superAdminUser, role: 'client_owner' as unknown as 'super_admin' };
      service.login('client@b.com', 'pass').subscribe({
        error: (err) => {
          expect(err.message).toContain('Not an admin account');
          done();
        },
      });
      http.expectOne(`${environment.apiUrl}/auth/login`).flush({ data: { user: clientUser } });
    });

    it('sends POST with credentials', () => {
      service.login('x@y.com', 'abc').subscribe();
      const req = http.expectOne(`${environment.apiUrl}/auth/login`);
      expect(req.request.method).toBe('POST');
      expect(req.request.withCredentials).toBe(true);
      req.flush({ data: { user: superAdminUser } });
    });
  });

  describe('logout()', () => {
    it('clears auth state on success', (done) => {
      service.isAuthenticated.set(true);
      service.currentUser.set({ _id: 'a1', email: 'admin@b.com', firstName: 'Admin', lastName: 'A', role: 'super_admin', status: 'active' });

      service.logout().subscribe(() => {
        expect(service.isAuthenticated()).toBe(false);
        expect(service.currentUser()).toBeNull();
        done();
      });

      http.expectOne(`${environment.apiUrl}/auth/logout`).flush({});
    });

    it('clears auth state even on network error', (done) => {
      service.isAuthenticated.set(true);
      service.logout().subscribe({
        error: () => {
          expect(service.isAuthenticated()).toBe(false);
          done();
        },
      });
      http.expectOne(`${environment.apiUrl}/auth/logout`).error(new ErrorEvent('network'));
    });
  });

  describe('getMe()', () => {
    it('fetches and sets current admin user', (done) => {
      const mockUser = { _id: 'a2', email: 'me@admin.com', firstName: 'Me', lastName: 'X', role: 'super_admin' as const, status: 'active' };
      service.getMe().subscribe(() => {
        expect(service.currentUser()?.email).toBe('me@admin.com');
        done();
      });
      http.expectOne(`${environment.apiUrl}/auth/me`).flush({ data: { user: mockUser } });
    });
  });
});
