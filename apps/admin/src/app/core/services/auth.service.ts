import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AdminProfile {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'super_admin' | 'sub_admin';
  subRoleId?: string;
  status: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = `${environment.apiUrl}/auth`;

  currentUser = signal<AdminProfile | null>(null);
  isAuthenticated = signal(false);

  constructor(private http: HttpClient, private router: Router) {}

  login(email: string, password: string) {
    return this.http
      .post<{ data: { user: AdminProfile } }>(`${this.api}/login`, { email, password }, { withCredentials: true })
      .pipe(
        tap((res) => {
          const user = res.data.user;
          if (user.role !== 'super_admin' && user.role !== 'sub_admin') {
            throw new Error('Not an admin account');
          }
          this.currentUser.set(user);
          this.isAuthenticated.set(true);
        }),
      );
  }

  logout() {
    return this.http.post(`${this.api}/logout`, {}, { withCredentials: true }).pipe(
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
    return this.http.post(`${this.api}/refresh`, {}, { withCredentials: true });
  }

  getMe() {
    return this.http
      .get<{ data: { user: AdminProfile } }>(`${this.api}/me`, { withCredentials: true })
      .pipe(
        tap((res) => {
          this.currentUser.set(res.data.user);
          this.isAuthenticated.set(true);
        }),
      );
  }
}
