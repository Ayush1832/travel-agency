import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  standalone: false,
  selector: 'app-reports-dashboard',
  templateUrl: './reports-dashboard.component.html',
  styleUrls: ['./reports-dashboard.component.scss'],
})
export class ReportsDashboardComponent {
  fromDate = '';
  toDate = '';

  reports = [
    { title: 'Revenue Report', icon: 'trending_up', route: '/reports/revenue', desc: 'Gross sales, markup, and net revenue breakdown' },
    { title: 'Bookings Report', icon: 'book_online', route: '/reports/bookings', desc: 'Booking status distribution and company breakdown' },
    { title: 'Credit Report', icon: 'account_balance', route: '/reports/credit', desc: 'Top-ups, credit usage, and settlement summary' },
  ];

  constructor(private router: Router) {
    const now = new Date();
    this.toDate = now.toISOString().split('T')[0];
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    this.fromDate = firstOfMonth.toISOString().split('T')[0];
  }

  navigate(route: string) {
    this.router.navigate([route], { queryParams: { from: this.fromDate, to: this.toDate } });
  }
}
