import { Component, OnInit, signal, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { BookingsService, BookingFilters } from '../../../core/services/bookings.service';
import { Booking, BookingStatus } from '../../../core/models/booking.models';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  standalone: false,
  selector: 'app-bookings-list',
  templateUrl: './bookings-list.component.html',
  styleUrls: ['./bookings-list.component.scss'],
})
export class BookingsListComponent implements OnInit {
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  bookings = signal<Booking[]>([]);
  total = signal(0);
  loading = signal(true);
  page = signal(0);
  pageSize = signal(10);
  activeTab = signal<string>('all');
  searchQuery = signal('');

  displayedColumns = ['bookingRef', 'hotel', 'checkIn', 'checkOut', 'status', 'amount', 'actions'];
  statusTabs = ['all', 'confirmed', 'pending', 'cancelled', 'completed'];

  constructor(
    private bookingsService: BookingsService,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit() {
    this.loadBookings();
  }

  loadBookings() {
    this.loading.set(true);
    const filters: BookingFilters = {
      page: this.page() + 1,
      limit: this.pageSize(),
    };

    if (this.activeTab() !== 'all') {
      filters.status = this.activeTab();
    }

    if (this.searchQuery()) {
      filters.search = this.searchQuery();
    }

    this.bookingsService.listBookings(filters).subscribe({
      next: (res) => {
        this.bookings.set(res.data);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.snackBar.open('Failed to load bookings', 'Close', { duration: 3000 });
      },
    });
  }

  onTabChange(status: string) {
    this.activeTab.set(status);
    this.page.set(0);
    this.loadBookings();
  }

  onSearch(event: Event) {
    this.searchQuery.set((event.target as HTMLInputElement).value);
    this.page.set(0);
    this.loadBookings();
  }

  onPage(event: PageEvent) {
    this.page.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.loadBookings();
  }

  viewBooking(id: string) {
    this.router.navigate(['/bookings', id]);
  }

  downloadVoucher(id: string, event: Event) {
    event.stopPropagation();
    this.bookingsService.getVoucher(id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `voucher-${id}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => {
        this.snackBar.open('Failed to download voucher', 'Close', { duration: 3000 });
      },
    });
  }

  canCancel(status: BookingStatus): boolean {
    return status === 'confirmed' || status === 'pending';
  }

  cancelBooking(id: string, event: Event) {
    event.stopPropagation();
    if (!confirm('Are you sure you want to cancel this booking?')) return;
    this.bookingsService.cancelBooking(id, { reason: 'Cancelled by client' }).subscribe({
      next: () => {
        this.snackBar.open('Booking cancelled', 'Close', { duration: 3000 });
        this.loadBookings();
      },
      error: (err) => {
        const msg = err?.error?.message || 'Failed to cancel booking';
        this.snackBar.open(msg, 'Close', { duration: 3000 });
      },
    });
  }

  getStatusClass(status: string): string {
    return `status-${status}`;
  }
}
