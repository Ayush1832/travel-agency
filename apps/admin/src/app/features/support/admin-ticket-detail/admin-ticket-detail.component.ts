import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormControl } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SupportAdminService } from '../../../core/services/support-admin.service';
import { SubAdminService } from '../../../core/services/sub-admin.service';
import { SupportTicket, SubAdmin } from '../../../core/models/admin.models';

@Component({
  standalone: false,
  selector: 'app-admin-ticket-detail',
  templateUrl: './admin-ticket-detail.component.html',
  styleUrls: ['./admin-ticket-detail.component.scss'],
})
export class AdminTicketDetailComponent implements OnInit {
  ticketId!: string;
  ticket: SupportTicket | null = null;
  subAdmins: SubAdmin[] = [];
  loading = true;
  sending = false;
  updating = false;

  assigneeControl = new FormControl('');
  statusControl = new FormControl('');
  replyControl = new FormControl('');

  statuses = ['open', 'in_progress', 'resolved', 'closed'];

  constructor(
    private route: ActivatedRoute,
    private supportService: SupportAdminService,
    private subAdminService: SubAdminService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit() {
    this.ticketId = this.route.snapshot.paramMap.get('id')!;
    this.loadTicket();
    this.subAdminService.listSubAdmins().subscribe({
      next: (res) => { this.subAdmins = (res as any).data || []; },
      error: () => {}
    });
  }

  loadTicket() {
    this.loading = true;
    this.supportService.get(this.ticketId).subscribe({
      next: (res) => {
        this.ticket = (res as any).data;
        this.statusControl.setValue(this.ticket?.status || '');
        this.assigneeControl.setValue(this.ticket?.assigneeId || '');
        this.loading = false;
      },
      error: () => { this.snackBar.open('Failed to load ticket', 'OK', { duration: 3000 }); this.loading = false; }
    });
  }

  assign() {
    const subAdminId = this.assigneeControl.value;
    if (!subAdminId) return;
    this.updating = true;
    this.supportService.assign(this.ticketId, subAdminId).subscribe({
      next: () => { this.snackBar.open('Assigned', 'OK', { duration: 2000 }); this.loadTicket(); this.updating = false; },
      error: () => { this.snackBar.open('Failed', 'OK', { duration: 2000 }); this.updating = false; }
    });
  }

  updateStatus() {
    const status = this.statusControl.value;
    if (!status) return;
    this.updating = true;
    this.supportService.updateStatus(this.ticketId, status).subscribe({
      next: () => { this.snackBar.open('Status updated', 'OK', { duration: 2000 }); this.loadTicket(); this.updating = false; },
      error: () => { this.snackBar.open('Failed', 'OK', { duration: 2000 }); this.updating = false; }
    });
  }

  sendReply() {
    const body = this.replyControl.value;
    if (!body?.trim()) return;
    this.sending = true;
    this.supportService.reply(this.ticketId, body).subscribe({
      next: () => {
        this.snackBar.open('Reply sent', 'OK', { duration: 2000 });
        this.replyControl.setValue('');
        this.loadTicket();
        this.sending = false;
      },
      error: () => { this.snackBar.open('Failed to send reply', 'OK', { duration: 2000 }); this.sending = false; }
    });
  }

  priorityClass(p: string): string {
    const m: Record<string, string> = { urgent: 'chip-rejected', high: 'chip-suspended', medium: 'chip-pending', low: 'chip-active' };
    return m[p] || '';
  }

  statusClass(s: string): string {
    const m: Record<string, string> = { open: 'chip-pending', in_progress: 'chip-confirmed', resolved: 'chip-active', closed: 'chip-suspended' };
    return m[s] || '';
  }
}
