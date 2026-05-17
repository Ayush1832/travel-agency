import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { LoginComponent } from './login.component';
import { AuthService } from '../../../core/services/auth.service';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let authService: jest.Mocked<Partial<AuthService>>;
  let router: Router;

  beforeEach(() => {
    authService = { login: jest.fn() };

    TestBed.configureTestingModule({
      declarations: [LoginComponent],
      imports: [ReactiveFormsModule],
      providers: [
        { provide: AuthService, useValue: authService },
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });
    const fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
  });

  it('creates the component', () => {
    expect(component).toBeTruthy();
  });

  it('initialises with empty form and no error', () => {
    expect(component.form.valid).toBe(false);
    expect(component.error).toBe('');
    expect(component.loading).toBe(false);
  });

  it('submit() does nothing when form is invalid', () => {
    component.submit();
    expect(authService.login).not.toHaveBeenCalled();
  });

  it('submit() calls authService.login with form values', fakeAsync(() => {
    (authService.login as jest.Mock).mockReturnValue(of({ data: { user: { _id: 'u1' } } }));
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
    component.form.setValue({ email: 'a@b.com', password: 'Password1!' });
    component.submit();
    tick();
    expect(authService.login).toHaveBeenCalledWith('a@b.com', 'Password1!');
  }));

  it('submit() sets error message on login failure', fakeAsync(() => {
    (authService.login as jest.Mock).mockReturnValue(throwError(() => ({ error: { message: 'Invalid credentials' } })));
    component.form.setValue({ email: 'a@b.com', password: 'Password1!' });
    component.submit();
    tick();
    expect(component.error).toBe('Invalid credentials');
    expect(component.loading).toBe(false);
  }));

  it('submit() uses fallback error message when no error.message', fakeAsync(() => {
    (authService.login as jest.Mock).mockReturnValue(throwError(() => ({})));
    component.form.setValue({ email: 'a@b.com', password: 'Password1!' });
    component.submit();
    tick();
    expect(component.error).toBe('Login failed. Please try again.');
  }));
});
