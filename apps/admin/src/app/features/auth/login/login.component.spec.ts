import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { LoginComponent } from './login.component';
import { AuthService } from '../../../core/services/auth.service';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let authService: jest.Mocked<Partial<AuthService>>;
  let mockRouter: jest.Mocked<Partial<Router>>;

  beforeEach(() => {
    authService = { login: jest.fn() };
    mockRouter = { navigate: jest.fn() };

    TestBed.configureTestingModule({
      declarations: [LoginComponent],
      imports: [ReactiveFormsModule],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: mockRouter },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });
    component = TestBed.createComponent(LoginComponent).componentInstance;
  });

  it('creates the component', () => expect(component).toBeTruthy());

  it('has invalid form initially', () => {
    expect(component.form.valid).toBe(false);
  });

  it('form is valid with correct credentials', () => {
    component.form.setValue({ email: 'admin@test.com', password: 'password123' });
    expect(component.form.valid).toBe(true);
  });

  it('submit() does nothing when form is invalid', () => {
    component.submit();
    expect(authService.login).not.toHaveBeenCalled();
  });

  it('submit() navigates to /dashboard on success', fakeAsync(() => {
    (authService.login as jest.Mock).mockReturnValue(of({}));
    component.form.setValue({ email: 'admin@test.com', password: 'password123' });
    component.submit();
    tick();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/dashboard']);
  }));

  it('submit() sets error message on failure', fakeAsync(() => {
    (authService.login as jest.Mock).mockReturnValue(throwError(() => ({ error: { message: 'Invalid credentials' } })));
    component.form.setValue({ email: 'admin@test.com', password: 'wrongpassword' });
    component.submit();
    tick();
    expect(component.error).toBe('Invalid credentials');
    expect(component.loading).toBe(false);
  }));

  it('submit() sets default error message when error has no message', fakeAsync(() => {
    (authService.login as jest.Mock).mockReturnValue(throwError(() => ({})));
    component.form.setValue({ email: 'admin@test.com', password: 'password123' });
    component.submit();
    tick();
    expect(component.error).toBe('Login failed');
  }));
});
