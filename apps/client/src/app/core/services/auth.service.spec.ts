import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

describe('AuthService (client)', () => {
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
    it('sets currentUser and isAuthenticated on success', (done) => {
      const mockUser = { _id: 'u1', email: 'a@b.com', firstName: 'A', lastName: 'B', role: 'client_owner', companyId: 'c1', status: 'active' };

      service.login('a@b.com', 'pass').subscribe(() => {
        expect(service.isAuthenticated()).toBe(true);
        expect(service.currentUser()).toMatchObject({ email: 'a@b.com' });
        done();
      });

      http.expectOne(`${environment.apiUrl}/auth/login`).flush({ data: { user: mockUser } });
    });

    it('sends POST to /auth/login with credentials', () => {
      service.login('x@y.com', '123').subscribe();
      const req = http.expectOne(`${environment.apiUrl}/auth/login`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ email: 'x@y.com', password: '123' });
      expect(req.request.withCredentials).toBe(true);
      req.flush({ data: { user: { _id: 'u2', email: 'x@y.com', firstName: 'X', lastName: 'Y', role: 'client_owner', companyId: 'c2', status: 'active' } } });
    });
  });

  describe('logout()', () => {
    it('clears currentUser and isAuthenticated on success', (done) => {
      service.isAuthenticated.set(true);
      service.currentUser.set({ _id: 'u1', email: 'a@b.com', firstName: 'A', lastName: 'B', role: 'client_owner', companyId: 'c1', status: 'active' });

      service.logout().subscribe(() => {
        expect(service.isAuthenticated()).toBe(false);
        expect(service.currentUser()).toBeNull();
        done();
      });

      http.expectOne(`${environment.apiUrl}/auth/logout`).flush({});
    });

    it('clears auth state even when request errors', (done) => {
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

  describe('register()', () => {
    it('sends POST to /auth/register', () => {
      const payload = { companyName: 'Acme', contactPerson: 'Alice', email: 'a@b.com', phone: '+971', addressLine1: 'St 1', city: 'Dubai', country: 'UAE', postalCode: '00001', password: 'Pass123!' };
      service.register(payload).subscribe();
      const req = http.expectOne(`${environment.apiUrl}/auth/register`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body.companyName).toBe('Acme');
      req.flush({ data: {} });
    });
  });

  describe('forgotPassword()', () => {
    it('sends POST with email', () => {
      service.forgotPassword('x@y.com').subscribe();
      const req = http.expectOne(`${environment.apiUrl}/auth/forgot-password`);
      expect(req.request.body).toEqual({ email: 'x@y.com' });
      req.flush({});
    });
  });

  describe('resetPassword()', () => {
    it('sends POST with token and password', () => {
      service.resetPassword('tok123', 'newPass!').subscribe();
      const req = http.expectOne(`${environment.apiUrl}/auth/reset-password`);
      expect(req.request.body).toEqual({ token: 'tok123', password: 'newPass!' });
      req.flush({});
    });
  });

  describe('getMe()', () => {
    it('updates currentUser from server response', (done) => {
      const mockUser = { _id: 'u3', email: 'me@b.com', firstName: 'Me', lastName: 'X', role: 'client_owner', companyId: 'c3', status: 'active' };

      service.getMe().subscribe(() => {
        expect(service.currentUser()?.email).toBe('me@b.com');
        expect(service.isAuthenticated()).toBe(true);
        done();
      });

      http.expectOne(`${environment.apiUrl}/auth/me`).flush({ data: { user: mockUser } });
    });
  });
});
