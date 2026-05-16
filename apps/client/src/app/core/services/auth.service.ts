import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface UserProfile {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  companyId: string | null;
  status: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = `${environment.apiUrl}/auth`;

  currentUser = signal<UserProfile | null>(null);
  isAuthenticated = signal(false);

  constructor(private http: HttpClient, private router: Router) {}

  register(payload: {
    companyName: string;
    contactPerson: string;
    email: string;
    phone: string;
    addressLine1: string;
    city: string;
    country: string;
    postalCode: string;
    password: string;
    currency?: 'AED' | 'USD';
  }) {
    return this.http.post(`${this.api}/register`, payload);
  }

  login(email: string, password: string) {
    return this.http
      .post<{ data: { user: UserProfile } }>(`${this.api}/login`, { email, password }, { withCredentials: true })
      .pipe(
        tap((res) => {
          this.currentUser.set(res.data.user);
          this.isAuthenticated.set(true);
        }),
      );
  }

  logout() {
    return this.http
      .post(`${this.api}/logout`, {}, { withCredentials: true })
      .pipe(
        tap(() => {
          this.currentUser.set(null);
          this.isAuthenticated.set(false);
          this.router.navigate(['/auth/login']);
        }),
        catchError((err) => {
          this.currentUser.set(null);
          this.isAuthenticated.set(false);
          this.router.navigate(['/auth/login']);
          return throwError(() => err);
        }),
      );
  }

  refreshToken() {
    return this.http
      .post<{ data: unknown }>(`${this.api}/refresh`, {}, { withCredentials: true })
      .pipe(catchError((err) => throwError(() => err)));
  }

  getMe() {
    return this.http
      .get<{ data: { user: UserProfile } }>(`${this.api}/me`, { withCredentials: true })
      .pipe(
        tap((res) => {
          this.currentUser.set(res.data.user);
          this.isAuthenticated.set(true);
        }),
      );
  }

  forgotPassword(email: string) {
    return this.http.post(`${this.api}/forgot-password`, { email });
  }

  resetPassword(token: string, password: string) {
    return this.http.post(`${this.api}/reset-password`, { token, password });
  }
}
