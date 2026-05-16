import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BookingsService } from '../../../core/services/bookings.service';
import { Booking } from '../../../core/models/booking.models';
import { CancelDialogComponent } from './cancel-dialog.component';

@Component({
  standalone: false,
  selector: 'app-booking-detail',
  templateUrl: './booking-detail.component.html',
  styleUrls: ['./booking-detail.component.scss'],
})
export class BookingDetailComponent implements OnInit {
  booking = signal<Booking | null>(null);
  loading = signal(true);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private bookingsService: BookingsService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.loadBooking(id);
  }

  loadBooking(id: string) {
    this.loading.set(true);
    this.bookingsService.getBooking(id).subscribe({
      next: (b) => {
        this.booking.set(b);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.snackBar.open('Failed to load booking', 'Close', { duration: 3000 });
        this.router.navigate(['/bookings']);
      },
    });
  }

  canCancel(): boolean {
    const b = this.booking();
    return b?.status === 'confirmed' || b?.status === 'pending';
  }

  openCancelDialog() {
    const b = this.booking()!;
    const dialogRef = this.dialog.open(CancelDialogComponent, {
      width: '420px',
      data: {
        bookingRef: b.bookingRef,
        cancellationFee: b.cancellationFee ?? 0,
        refundAmount: b.refundAmount ?? b.totalAmount,
        currency: b.currency,
      },
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.bookingsService.cancelBooking(b._id, { reason: confirmed.reason }).subscribe({
          next: () => {
            this.snackBar.open('Booking cancelled successfully', 'Close', { duration: 3000 });
            this.loadBooking(b._id);
          },
          error: (err) => {
            const msg = err?.error?.message || 'Cancellation failed';
            this.snackBar.open(msg, 'Close', { duration: 3000 });
          },
        });
      }
    });
  }

  downloadVoucher() {
    const b = this.booking()!;
    this.bookingsService.getVoucher(b._id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `voucher-${b.bookingRef}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => {
        this.snackBar.open('Failed to download voucher', 'Close', { duration: 3000 });
      },
    });
  }

  getStatusClass(status: string): string {
    return `status-${status}`;
  }

  goBack() {
    this.router.navigate(['/bookings']);
  }
}
