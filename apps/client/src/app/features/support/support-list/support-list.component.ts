import { Component, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SupportService, TicketFilters } from '../../../core/services/support.service';
import { SupportTicket } from '../../../core/models/support.models';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PageEvent } from '@angular/material/paginator';

@Component({
  standalone: false,
  selector: 'app-support-list',
  templateUrl: './support-list.component.html',
  styleUrls: ['./support-list.component.scss'],
})
export class SupportListComponent implements OnInit {
  tickets = signal<SupportTicket[]>([]);
  total = signal(0);
  loading = signal(true);
  page = signal(0);
  pageSize = signal(10);
  statusFilter = signal<string>('');

  displayedColumns = ['ticketNumber', 'subject', 'category', 'status', 'priority', 'createdAt', 'actions'];

  constructor(
    private supportService: SupportService,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit() {
    this.loadTickets();
  }

  loadTickets() {
    this.loading.set(true);
    const params: TicketFilters = {
      page: this.page() + 1,
      limit: this.pageSize(),
    };
    if (this.statusFilter()) params.status = this.statusFilter();

    this.supportService.listTickets(params).subscribe({
      next: (res) => {
        this.tickets.set(res.data);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.snackBar.open('Failed to load tickets', 'Close', { duration: 3000 });
      },
    });
  }

  onPage(event: PageEvent) {
    this.page.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.loadTickets();
  }

  onStatusFilter(status: string) {
    this.statusFilter.set(status);
    this.page.set(0);
    this.loadTickets();
  }

  viewTicket(id: string) {
    this.router.navigate(['/support', id]);
  }

  newTicket() {
    this.router.navigate(['/support/new']);
  }

  getStatusClass(status: string): string {
    const map: Record<string, string> = {
      open: 'status-pending',
      in_progress: 'status-completed',
      resolved: 'status-confirmed',
      closed: 'status-cancelled',
    };
    return map[status] || 'status-pending';
  }

  getPriorityClass(priority: string): string {
    const map: Record<string, string> = {
      urgent: 'priority-urgent',
      high: 'priority-high',
      medium: 'priority-medium',
      low: 'priority-low',
    };
    return map[priority] || '';
  }
}
