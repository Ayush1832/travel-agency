import { Component, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PageEvent } from '@angular/material/paginator';
import { SupportAdminService } from '../../../core/services/support-admin.service';
import { SupportTicket } from '../../../core/models/admin.models';

@Component({
  standalone: false,
  selector: 'app-admin-support-list',
  templateUrl: './admin-support-list.component.html',
  styleUrls: ['./admin-support-list.component.scss'],
})
export class AdminSupportListComponent implements OnInit {
  tickets: SupportTicket[] = [];
  total = 0;
  page = 0;
  limit = 20;
  loading = false;

  tabs = [
    { label: 'All', status: '' },
    { label: 'Open', status: 'open' },
    { label: 'In Progress', status: 'in_progress' },
    { label: 'Resolved', status: 'resolved' },
    { label: 'Closed', status: 'closed' },
  ];
  selectedTab = 0;

  priorityControl = new FormControl('');
  categoryControl = new FormControl('');

  priorities = ['low', 'medium', 'high', 'urgent'];
  categories = ['booking', 'payment', 'technical', 'account', 'other'];

  displayedColumns = ['ticketNo', 'companyName', 'subject', 'category', 'priority', 'status', 'assigneeName', 'createdAt', 'actions'];

  constructor(
    private supportService: SupportAdminService,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit() {
    this.loadTickets();
    this.priorityControl.valueChanges.subscribe(() => { this.page = 0; this.loadTickets(); });
    this.categoryControl.valueChanges.subscribe(() => { this.page = 0; this.loadTickets(); });
  }

  get currentStatus(): string { return this.tabs[this.selectedTab]?.status || ''; }

  loadTickets() {
    this.loading = true;
    this.supportService.list({
      status: this.currentStatus || undefined,
      priority: this.priorityControl.value || undefined,
      category: this.categoryControl.value || undefined,
      page: this.page + 1,
      limit: this.limit,
    }).subscribe({
      next: (res) => { this.tickets = res.data.data; this.total = res.data.total; this.loading = false; },
      error: () => { this.snackBar.open('Failed to load tickets', 'OK', { duration: 3000 }); this.loading = false; }
    });
  }

  onTabChange(index: number) { this.selectedTab = index; this.page = 0; this.loadTickets(); }
  onPage(event: PageEvent) { this.page = event.pageIndex; this.limit = event.pageSize; this.loadTickets(); }
  viewTicket(id: string) { this.router.navigate(['/support', id]); }

  priorityClass(p: string): string {
    const m: Record<string, string> = { urgent: 'chip-rejected', high: 'chip-suspended', medium: 'chip-pending', low: 'chip-active' };
    return m[p] || '';
  }

  statusClass(s: string): string {
    const m: Record<string, string> = { open: 'chip-pending', in_progress: 'chip-confirmed', resolved: 'chip-active', closed: 'chip-suspended' };
    return m[s] || '';
  }
}
