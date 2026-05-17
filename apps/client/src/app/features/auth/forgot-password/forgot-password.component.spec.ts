import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { of, throwError } from 'rxjs';
import { ForgotPasswordComponent } from './forgot-password.component';
import { AuthService } from '../../../core/services/auth.service';

describe('ForgotPasswordComponent', () => {
  let component: ForgotPasswordComponent;
  let authService: jest.Mocked<Partial<AuthService>>;

  beforeEach(() => {
    authService = { forgotPassword: jest.fn() };

    TestBed.configureTestingModule({
      declarations: [ForgotPasswordComponent],
      imports: [ReactiveFormsModule],
      providers: [{ provide: AuthService, useValue: authService }],
      schemas: [NO_ERRORS_SCHEMA],
    });
    component = TestBed.createComponent(ForgotPasswordComponent).componentInstance;
  });

  it('creates the component', () => expect(component).toBeTruthy());

  it('initialises with empty form and no sent state', () => {
    expect(component.form.valid).toBe(false);
    expect(component.sent).toBe(false);
    expect(component.loading).toBe(false);
  });

  it('submit() does nothing when form is invalid', () => {
    component.submit();
    expect(authService.forgotPassword).not.toHaveBeenCalled();
  });

  it('submit() calls authService.forgotPassword and sets sent=true on success', fakeAsync(() => {
    (authService.forgotPassword as jest.Mock).mockReturnValue(of({}));
    component.form.setValue({ email: 'a@b.com' });
    component.submit();
    tick();
    expect(component.sent).toBe(true);
    expect(component.loading).toBe(false);
  }));

  it('submit() sets sent=true even on error (security: always show "email sent")', fakeAsync(() => {
    (authService.forgotPassword as jest.Mock).mockReturnValue(throwError(() => new Error()));
    component.form.setValue({ email: 'a@b.com' });
    component.submit();
    tick();
    expect(component.sent).toBe(true);
    expect(component.loading).toBe(false);
  }));
});
