import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormControl } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { AdminBookingsService } from '../../../core/services/admin-bookings.service';
import { Booking } from '../../../core/models/booking.models';

@Component({
  standalone: false,
  selector: 'app-admin-booking-detail',
  templateUrl: './admin-booking-detail.component.html',
  styleUrls: ['./admin-booking-detail.component.scss'],
})
export class AdminBookingDetailComponent implements OnInit {
  bookingId!: string;
  booking: Booking | null = null;
  loading = true;
  updating = false;

  statusControl = new FormControl('');
  refundAmount = new FormControl(0);

  statuses = ['pending', 'confirmed', 'cancelled', 'completed', 'refunded'];

  constructor(
    private route: ActivatedRoute,
    private bookingsService: AdminBookingsService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit() {
    this.bookingId = this.route.snapshot.paramMap.get('id')!;
    this.loadBooking();
  }

  loadBooking() {
    this.loading = true;
    this.bookingsService.get(this.bookingId).subscribe({
      next: (res) => {
        this.booking = (res as any).data;
        this.statusControl.setValue(this.booking?.status || '');
        this.refundAmount.setValue(this.booking ? this.booking.totalAmount / 100 : 0);
        this.loading = false;
      },
      error: () => {
        this.snackBar.open('Failed to load booking', 'OK', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  updateStatus() {
    const newStatus = this.statusControl.value;
    if (!newStatus || newStatus === this.booking?.status) return;
    this.updating = true;
    this.bookingsService.updateStatus(this.bookingId, newStatus).subscribe({
      next: () => {
        this.snackBar.open('Status updated', 'OK', { duration: 3000 });
        this.loadBooking();
        this.updating = false;
      },
      error: () => {
        this.snackBar.open('Failed to update status', 'OK', { duration: 3000 });
        this.updating = false;
      }
    });
  }

  issueRefund() {
    const amount = Math.round((this.refundAmount.value || 0) * 100);
    if (!amount) return;
    this.updating = true;
    this.bookingsService.issueRefund(this.bookingId, amount).subscribe({
      next: () => {
        this.snackBar.open('Refund issued', 'OK', { duration: 3000 });
        this.loadBooking();
        this.updating = false;
      },
      error: () => {
        this.snackBar.open('Failed to issue refund', 'OK', { duration: 3000 });
        this.updating = false;
      }
    });
  }

  cancelBooking() {
    this.updating = true;
    this.bookingsService.updateStatus(this.bookingId, 'cancelled').subscribe({
      next: () => {
        this.snackBar.open('Booking cancelled', 'OK', { duration: 3000 });
        this.loadBooking();
        this.updating = false;
      },
      error: () => {
        this.snackBar.open('Failed to cancel', 'OK', { duration: 3000 });
        this.updating = false;
      }
    });
  }

  formatAed(fils: number): string {
    if (!fils) return '0.00';
    return (fils / 100).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  statusClass(status: string): string {
    const map: Record<string, string> = {
      confirmed: 'chip-confirmed', pending: 'chip-pending',
      cancelled: 'chip-cancelled', completed: 'chip-active', refunded: 'chip-suspended'
    };
    return map[status] || '';
  }
}
