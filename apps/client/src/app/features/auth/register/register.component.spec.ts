import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { RegisterComponent } from './register.component';
import { AuthService } from '../../../core/services/auth.service';

const VALID_FORM = {
  companyName: 'Acme', contactPerson: 'Alice', email: 'a@b.com', phone: '+971',
  addressLine1: 'St 1', city: 'Dubai', country: 'UAE', postalCode: '00001',
  currency: 'AED', taxId: '', password: 'Password1!',
};

describe('RegisterComponent', () => {
  let component: RegisterComponent;
  let authService: jest.Mocked<Partial<AuthService>>;

  beforeEach(() => {
    authService = { register: jest.fn() };

    TestBed.configureTestingModule({
      declarations: [RegisterComponent],
      imports: [ReactiveFormsModule],
      providers: [{ provide: AuthService, useValue: authService }, provideRouter([])],
      schemas: [NO_ERRORS_SCHEMA],
    });
    component = TestBed.createComponent(RegisterComponent).componentInstance;
  });

  it('creates the component', () => expect(component).toBeTruthy());

  it('initialises with empty form', () => {
    expect(component.form.valid).toBe(false);
    expect(component.success).toBe('');
    expect(component.error).toBe('');
  });

  it('submit() does nothing when form is invalid', () => {
    component.submit();
    expect(authService.register).not.toHaveBeenCalled();
  });

  it('submit() shows success message on successful registration', fakeAsync(() => {
    (authService.register as jest.Mock).mockReturnValue(of({}));
    component.form.setValue(VALID_FORM);
    component.submit();
    tick();
    expect(component.success).toContain('Registration submitted');
    expect(component.loading).toBe(false);
  }));

  it('submit() shows error on failure', fakeAsync(() => {
    (authService.register as jest.Mock).mockReturnValue(throwError(() => ({ error: { message: 'Email taken' } })));
    component.form.setValue(VALID_FORM);
    component.submit();
    tick();
    expect(component.error).toBe('Email taken');
  }));
});
