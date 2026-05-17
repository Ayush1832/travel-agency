import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormControl, Validators } from '@angular/forms';
import { SupportService } from '../../../core/services/support.service';
import { SupportTicket } from '../../../core/models/support.models';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  standalone: false,
  selector: 'app-ticket-detail',
  templateUrl: './ticket-detail.component.html',
  styleUrls: ['./ticket-detail.component.scss'],
})
export class TicketDetailComponent implements OnInit {
  ticket = signal<SupportTicket | null>(null);
  loading = signal(true);
  sending = signal(false);

  replyCtrl = new FormControl('', [Validators.required, Validators.minLength(5)]);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private supportService: SupportService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.loadTicket(id);
  }

  loadTicket(id: string) {
    this.loading.set(true);
    this.supportService.getTicket(id).subscribe({
      next: (t) => {
        this.ticket.set(t);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.snackBar.open('Failed to load ticket', 'Close', { duration: 3000 });
        this.router.navigate(['/support']);
      },
    });
  }

  sendReply() {
    if (this.replyCtrl.invalid) {
      this.replyCtrl.markAsTouched();
      return;
    }

    const t = this.ticket()!;
    this.sending.set(true);

    this.supportService.reply(t._id, this.replyCtrl.value!).subscribe({
      next: () => {
        this.sending.set(false);
        this.replyCtrl.reset();
        this.snackBar.open('Reply sent', 'Close', { duration: 2000 });
        this.loadTicket(t._id);
      },
      error: (err) => {
        this.sending.set(false);
        const msg = err?.error?.message || 'Failed to send reply';
        this.snackBar.open(msg, 'Close', { duration: 3000 });
      },
    });
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

  goBack() {
    this.router.navigate(['/support']);
  }

  isOpen(): boolean {
    const t = this.ticket();
    return t?.status === 'open' || t?.status === 'in_progress';
  }

  isClosed(): boolean {
    return this.ticket()?.status === 'closed';
  }

  closeTicket() {
    const t = this.ticket()!;
    this.supportService.closeTicket(t._id).subscribe({
      next: () => {
        this.snackBar.open('Ticket closed', 'Close', { duration: 2000 });
        this.loadTicket(t._id);
      },
      error: (err) => {
        const msg = err?.error?.message || 'Failed to close ticket';
        this.snackBar.open(msg, 'Close', { duration: 3000 });
      },
    });
  }

  reopenTicket() {
    const t = this.ticket()!;
    this.supportService.reopenTicket(t._id).subscribe({
      next: () => {
        this.snackBar.open('Ticket reopened', 'Close', { duration: 2000 });
        this.loadTicket(t._id);
      },
      error: (err) => {
        const msg = err?.error?.message || 'Failed to reopen ticket';
        this.snackBar.open(msg, 'Close', { duration: 3000 });
      },
    });
  }
}
