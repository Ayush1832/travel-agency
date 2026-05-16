import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { Observable, map, catchError, of } from 'rxjs';
import { AuthService } from '../services/auth.service';

/** Redirects already-authenticated users away from login/register pages */
@Injectable({ providedIn: 'root' })
export class GuestGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(): Observable<boolean | UrlTree> {
    if (this.authService.isAuthenticated()) {
      return of(this.router.createUrlTree(['/dashboard']));
    }

    return this.authService.getMe().pipe(
      map(() => this.router.createUrlTree(['/dashboard'])),
      catchError(() => of(true)),
    );
  }
}
