import { Component, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { WalletService } from '../../core/services/wallet.service';
import { BookingsService } from '../../core/services/bookings.service';
import { CreditBalance } from '../../core/models/wallet.models';
import { Booking } from '../../core/models/booking.models';
import { timeout, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  standalone: false,
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit {
  currentUser = this.authService.currentUser;

  creditBalance = signal<CreditBalance | null>(null);
  recentBookings = signal<Booking[]>([]);
  totalBookings = signal<number>(0);
  confirmedBookings = signal<number>(0);
  thisMonthBookings = signal<number>(0);
  loyaltyPoints = signal<number>(0);
  loading = signal<boolean>(true);

  constructor(
    private authService: AuthService,
    private walletService: WalletService,
    private bookingsService: BookingsService,
    private router: Router,
  ) {}

  ngOnInit() {
    this.loadDashboardData();
  }

  loadDashboardData() {
    this.loading.set(true);

    this.walletService.getBalance().pipe(
      timeout(8000),
      catchError(() => of(null)),
    ).subscribe({
      next: (balance) => {
        if (balance) this.creditBalance.set(balance);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });

    this.bookingsService.listBookings({ limit: 5 }).subscribe({
      next: (res) => {
        this.recentBookings.set(res.data);
        this.totalBookings.set(res.total);
        this.confirmedBookings.set(res.data.filter((b) => b.status === 'confirmed').length);
      },
      error: () => {},
    });

    this.bookingsService.listBookings({ status: 'confirmed', limit: 100 }).subscribe({
      next: (res) => {
        const now = new Date();
        const thisMonth = res.data.filter((b) => {
          const d = new Date(b.createdAt);
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        });
        this.thisMonthBookings.set(thisMonth.length);
      },
      error: () => {},
    });
  }

  get creditUsagePercent(): number {
    const b = this.creditBalance();
    if (!b || b.creditLimit + b.walletBalance === 0) return 0;
    return Math.round((b.usedCredit / (b.creditLimit + b.walletBalance)) * 100);
  }

  navigateTo(path: string) {
    this.router.navigate([path]);
  }

  getStatusClass(status: string): string {
    return `status-${status}`;
  }
}
