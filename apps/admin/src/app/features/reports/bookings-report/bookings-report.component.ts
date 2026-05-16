import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ReportsService } from '../../../core/services/reports.service';
import { BookingsReport } from '../../../core/models/report.models';

@Component({
  standalone: false,
  selector: 'app-bookings-report',
  templateUrl: './bookings-report.component.html',
  styleUrls: ['./bookings-report.component.scss'],
})
export class BookingsReportComponent implements OnInit {
  fromDate = '';
  toDate = '';
  report: BookingsReport | null = null;
  loading = false;

  companyColumns = ['companyName', 'bookingsCount', 'totalAmount'];

  constructor(
    private reportsService: ReportsService,
    private route: ActivatedRoute,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit() {
    const now = new Date();
    this.toDate = now.toISOString().split('T')[0];
    this.fromDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const q = this.route.snapshot.queryParams;
    if (q['from']) this.fromDate = q['from'];
    if (q['to']) this.toDate = q['to'];
    this.loadReport();
  }

  loadReport() {
    this.loading = true;
    this.reportsService.getBookings(this.fromDate, this.toDate).subscribe({
      next: (res) => { this.report = (res as any).data; this.loading = false; },
      error: () => { this.snackBar.open('Failed to load report', 'OK', { duration: 3000 }); this.loading = false; }
    });
  }

  exportCsv() {
    this.reportsService.exportReport('bookings', 'csv', { from: this.fromDate, to: this.toDate }).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bookings-report-${this.fromDate}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => this.snackBar.open('Export failed', 'OK', { duration: 3000 })
    });
  }

  formatAed(fils: number): string {
    if (!fils) return '0.00';
    return (fils / 100).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  statusColor(status: string): string {
    const colors: Record<string, string> = {
      confirmed: '#1565c0', pending: '#e65100', cancelled: '#c62828',
      completed: '#2e7d32', refunded: '#6a1b9a'
    };
    return colors[status] || '#666';
  }
}
