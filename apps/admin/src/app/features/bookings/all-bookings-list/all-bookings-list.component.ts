import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PageEvent } from '@angular/material/paginator';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { AdminBookingsService } from '../../../core/services/admin-bookings.service';
import { Booking } from '../../../core/models/booking.models';

@Component({
  standalone: false,
  selector: 'app-all-bookings-list',
  templateUrl: './all-bookings-list.component.html',
  styleUrls: ['./all-bookings-list.component.scss'],
})
export class AllBookingsListComponent implements OnInit {
  bookings: Booking[] = [];
  total = 0;
  page = 0;
  limit = 20;
  loading = false;

  searchControl = new FormControl('');
  filterForm = new FormGroup({
    status: new FormControl(''),
    paymentMethod: new FormControl(''),
    from: new FormControl(''),
    to: new FormControl(''),
  });

  statuses = ['pending', 'confirmed', 'cancelled', 'completed', 'refunded'];
  paymentMethods = ['credit', 'wallet', 'card', 'bank_transfer'];

  displayedColumns = ['bookingRef', 'companyName', 'hotelName', 'checkIn', 'checkOut', 'status', 'totalAmount', 'paymentMethod', 'actions'];

  constructor(
    private bookingsService: AdminBookingsService,
    private snackBar: MatSnackBar,
    private router: Router,
  ) {}

  ngOnInit() {
    this.loadBookings();
    this.searchControl.valueChanges.pipe(debounceTime(400), distinctUntilChanged()).subscribe(() => {
      this.page = 0;
      this.loadBookings();
    });
    this.filterForm.valueChanges.pipe(debounceTime(300)).subscribe(() => {
      this.page = 0;
      this.loadBookings();
    });
  }

  loadBookings() {
    this.loading = true;
    const f = this.filterForm.value;
    const from = f.from ? new Date(f.from as string).toISOString().split('T')[0] : undefined;
    const to = f.to ? new Date(f.to as string).toISOString().split('T')[0] : undefined;
    this.bookingsService.list({
      search: this.searchControl.value || undefined,
      status: f.status || undefined,
      paymentMethod: f.paymentMethod || undefined,
      from: from || undefined,
      to: to || undefined,
      page: this.page + 1,
      limit: this.limit,
    }).subscribe({
      next: (res) => {
        this.bookings = res.data.data;
        this.total = res.data.total;
        this.loading = false;
      },
      error: () => {
        this.snackBar.open('Failed to load bookings', 'OK', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  onPage(event: PageEvent) {
    this.page = event.pageIndex;
    this.limit = event.pageSize;
    this.loadBookings();
  }

  viewBooking(id: string) {
    this.router.navigate(['/bookings', id]);
  }

  exportCsv() {
    const f = this.filterForm.value;
    this.bookingsService.exportCsv({
      status: f.status || undefined,
      paymentMethod: f.paymentMethod || undefined,
    }).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bookings-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => this.snackBar.open('Export failed', 'OK', { duration: 3000 })
    });
  }

  resync(id: string, event: Event) {
    event.stopPropagation();
    this.bookingsService.resync(id).subscribe({
      next: () => this.snackBar.open('Booking resynced', 'OK', { duration: 3000 }),
      error: () => this.snackBar.open('Resync failed', 'OK', { duration: 3000 }),
    });
  }

  formatAed(fils: number): string {
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
