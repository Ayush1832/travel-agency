import { Injectable } from '@angular/core';
import {
  HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse,
} from '@angular/common/http';
import { Observable, throwError, BehaviorSubject, switchMap, filter, take, catchError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private isRefreshing = false;
  private refreshDone$ = new BehaviorSubject<boolean>(false);

  constructor(private authService: AuthService, private router: Router) {}

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const authReq = req.clone({ withCredentials: true });
    return next.handle(authReq).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401 && !req.url.includes('/auth/')) {
          return this.handle401(authReq, next);
        }
        return throwError(() => error);
      }),
    );
  }

  private handle401(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    if (this.isRefreshing) {
      return this.refreshDone$.pipe(
        filter((done) => done),
        take(1),
        switchMap(() => next.handle(req)),
      );
    }
    this.isRefreshing = true;
    this.refreshDone$.next(false);
    return this.authService.refreshToken().pipe(
      switchMap(() => {
        this.isRefreshing = false;
        this.refreshDone$.next(true);
        return next.handle(req);
      }),
      catchError((err) => {
        this.isRefreshing = false;
        this.authService.currentUser.set(null);
        this.authService.isAuthenticated.set(false);
        this.router.navigate(['/auth/login']);
        return throwError(() => err);
      }),
    );
  }
}
