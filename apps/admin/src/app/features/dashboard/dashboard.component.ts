import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ReportsService } from '../../core/services/reports.service';
import { ClientsService } from '../../core/services/clients.service';
import { AdminBookingsService } from '../../core/services/admin-bookings.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { forkJoin, of } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';

interface KpiData {
  activeClients: number;
  pendingClients: number;
  bookingsThisMonth: number;
  revenueThisMonth: number;
}

@Component({
  standalone: false,
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit {
  loading = true;
  kpi: KpiData = {
    activeClients: 0,
    pendingClients: 0,
    bookingsThisMonth: 0,
    revenueThisMonth: 0,
  };
  pendingClients: any[] = [];
  trendBars: number[] = [];
  approvingId: string | null = null;

  displayedColumns = ['companyName', 'email', 'createdAt', 'actions'];

  constructor(
    private reportsService: ReportsService,
    private clientsService: ClientsService,
    private bookingsService: AdminBookingsService,
    private snackBar: MatSnackBar,
    private router: Router,
  ) {}

  ngOnInit() {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    forkJoin({
      revenue: this.reportsService.getRevenue(firstOfMonth, today).pipe(timeout(8000), catchError(() => of(null))),
      pending: this.clientsService.list({ status: 'pending', limit: 5 }).pipe(timeout(8000), catchError(() => of(null))),
      active: this.clientsService.list({ status: 'active', limit: 1 }).pipe(timeout(8000), catchError(() => of(null))),
      bookings: this.bookingsService.list({ from: firstOfMonth, to: today, limit: 1 }).pipe(timeout(8000), catchError(() => of(null))),
    }).subscribe(({ revenue, pending, active, bookings }) => {
      if (revenue) {
        const r = (revenue as any).data;
        this.kpi.revenueThisMonth = r.totalGross || 0;
        if (r.items && r.items.length > 0) {
          const last7 = r.items.slice(-7);
          const max = Math.max(...last7.map((i: any) => i.bookingsCount || 0), 1);
          this.trendBars = last7.map((i: any) => Math.round(((i.bookingsCount || 0) / max) * 80));
        }
        this.kpi.bookingsThisMonth = r.totalBookings || 0;
      }
      if (pending) {
        const p = (pending as any).data;
        this.kpi.pendingClients = p.total || 0;
        this.pendingClients = p.data || [];
      }
      if (active) {
        const a = (active as any).data;
        this.kpi.activeClients = a.total || 0;
      }
      if (bookings) {
        const b = (bookings as any).data;
        this.kpi.bookingsThisMonth = b.total || 0;
      }
      this.loading = false;
    });
  }

  formatAed(fils: number): string {
    return (fils / 100).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  quickApprove(client: any) {
    this.approvingId = client._id;
    this.clientsService.approve(client._id).subscribe({
      next: () => {
        this.snackBar.open(`${client.companyName} approved`, 'OK', { duration: 3000 });
        this.pendingClients = this.pendingClients.filter(c => c._id !== client._id);
        this.kpi.pendingClients = Math.max(0, this.kpi.pendingClients - 1);
        this.kpi.activeClients += 1;
        this.approvingId = null;
      },
      error: () => {
        this.snackBar.open('Failed to approve client', 'OK', { duration: 3000 });
        this.approvingId = null;
      }
    });
  }

  quickReject(client: any) {
    this.approvingId = client._id;
    this.clientsService.reject(client._id, 'Rejected from dashboard').subscribe({
      next: () => {
        this.snackBar.open(`${client.companyName} rejected`, 'OK', { duration: 3000 });
        this.pendingClients = this.pendingClients.filter(c => c._id !== client._id);
        this.kpi.pendingClients = Math.max(0, this.kpi.pendingClients - 1);
        this.approvingId = null;
      },
      error: () => {
        this.snackBar.open('Failed to reject client', 'OK', { duration: 3000 });
        this.approvingId = null;
      }
    });
  }

  goToClients() {
    this.router.navigate(['/clients']);
  }
}
