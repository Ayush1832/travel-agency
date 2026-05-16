import { Component, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { SupportService } from '../../../core/services/support.service';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  standalone: false,
  selector: 'app-create-ticket',
  templateUrl: './create-ticket.component.html',
  styleUrls: ['./create-ticket.component.scss'],
})
export class CreateTicketComponent implements OnInit {
  form!: FormGroup;
  submitting = signal(false);

  categories = [
    { value: 'booking', label: 'Booking' },
    { value: 'payment', label: 'Payment' },
    { value: 'credit', label: 'Credit' },
    { value: 'technical', label: 'Technical' },
    { value: 'other', label: 'Other' },
  ];

  priorities = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'urgent', label: 'Urgent' },
  ];

  constructor(
    private fb: FormBuilder,
    private supportService: SupportService,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit() {
    this.form = this.fb.group({
      subject: ['', [Validators.required, Validators.minLength(5)]],
      category: ['booking', Validators.required],
      priority: ['medium', Validators.required],
      bookingRef: [''],
      message: ['', [Validators.required, Validators.minLength(20)]],
    });
  }

  onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.supportService.createTicket(this.form.value).subscribe({
      next: () => {
        this.submitting.set(false);
        this.snackBar.open('Ticket created successfully', 'Close', { duration: 3000 });
        this.router.navigate(['/support']);
      },
      error: (err) => {
        this.submitting.set(false);
        const msg = err?.error?.message || 'Failed to create ticket';
        this.snackBar.open(msg, 'Close', { duration: 3000 });
      },
    });
  }

  goBack() {
    this.router.navigate(['/support']);
  }
}
