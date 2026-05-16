import { Component } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  standalone: false,
  selector: 'app-register',
  templateUrl: './register.component.html',
})
export class RegisterComponent {
  form = this.fb.group({
    companyName: ['', [Validators.required, Validators.maxLength(200)]],
    contactPerson: ['', [Validators.required, Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', Validators.required],
    addressLine1: ['', Validators.required],
    city: ['', Validators.required],
    country: ['', Validators.required],
    postalCode: ['', Validators.required],
    currency: ['AED'],
    password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(72)]],
  });

  loading = false;
  error = '';
  success = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
  ) {}

  submit() {
    if (this.form.invalid) return;
    this.loading = true;
    this.error = '';

    this.authService.register(this.form.value as Parameters<AuthService['register']>[0]).subscribe({
      next: () => {
        this.success =
          'Registration submitted successfully. You will be notified once your account is approved.';
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.message ?? 'Registration failed. Please try again.';
        this.loading = false;
      },
    });
  }
}
