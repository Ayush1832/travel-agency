import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PageEvent } from '@angular/material/paginator';
import { ClientsService } from '../../../core/services/clients.service';
import { Company, WalletTransaction } from '../../../core/models/company.models';
import { SetCreditLimitDialog } from '../dialogs/set-credit-limit.dialog';
import { TopUpWalletDialog } from '../dialogs/top-up-wallet.dialog';
import { RecordSettlementDialog } from '../dialogs/record-settlement.dialog';
import { ConfirmActionDialog } from '../dialogs/confirm-action.dialog';

@Component({
  standalone: false,
  selector: 'app-client-detail',
  templateUrl: './client-detail.component.html',
  styleUrls: ['./client-detail.component.scss'],
})
export class ClientDetailComponent implements OnInit {
  clientId!: string;
  company: Company | null = null;
  creditBalance: any = null;
  recentBookings: any[] = [];
  transactions: WalletTransaction[] = [];
  txTotal = 0;
  txPage = 0;
  txLimit = 10;
  loading = true;
  txLoading = false;
  actionLoading = false;

  bookingColumns = ['bookingRef', 'hotelName', 'checkIn', 'status', 'totalAmount'];
  txColumns = ['createdAt', 'type', 'description', 'amount'];

  constructor(
    private route: ActivatedRoute,
    private clientsService: ClientsService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit() {
    this.clientId = this.route.snapshot.paramMap.get('id')!;
    this.loadClient();
    this.loadTransactions();
  }

  loadClient() {
    this.loading = true;
    this.clientsService.get(this.clientId).subscribe({
      next: (res) => {
        const d = (res as any).data;
        this.company = d.company || d;
        this.creditBalance = d.creditBalance || null;
        this.recentBookings = d.recentBookings || [];
        this.loading = false;
      },
      error: () => {
        this.snackBar.open('Failed to load client', 'OK', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  loadTransactions() {
    this.txLoading = true;
    this.clientsService.getTransactions(this.clientId, { page: this.txPage + 1, limit: this.txLimit }).subscribe({
      next: (res) => {
        this.transactions = res.data.data;
        this.txTotal = res.data.total;
        this.txLoading = false;
      },
      error: () => { this.txLoading = false; }
    });
  }

  onTxPage(event: PageEvent) {
    this.txPage = event.pageIndex;
    this.txLimit = event.pageSize;
    this.loadTransactions();
  }

  formatAed(fils: number): string {
    if (fils == null) return '0.00';
    return (fils / 100).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  statusClass(status: string): string {
    const map: Record<string, string> = {
      active: 'chip-active', pending: 'chip-pending',
      suspended: 'chip-suspended', rejected: 'chip-rejected'
    };
    return map[status] || '';
  }

  bookingStatusClass(status: string): string {
    const map: Record<string, string> = {
      confirmed: 'chip-confirmed', pending: 'chip-pending',
      cancelled: 'chip-cancelled', completed: 'chip-active'
    };
    return map[status] || '';
  }

  openSetCreditLimit() {
    const ref = this.dialog.open(SetCreditLimitDialog, {
      width: '380px',
      data: { currentLimit: this.company?.creditLimit || 0 }
    });
    ref.afterClosed().subscribe(amount => {
      if (amount != null) {
        this.clientsService.updateCreditLimit(this.clientId, amount).subscribe({
          next: () => { this.snackBar.open('Credit limit updated', 'OK', { duration: 3000 }); this.loadClient(); },
          error: () => this.snackBar.open('Failed to update credit limit', 'OK', { duration: 3000 })
        });
      }
    });
  }

  openTopUp() {
    const ref = this.dialog.open(TopUpWalletDialog, { width: '380px', data: {} });
    ref.afterClosed().subscribe(result => {
      if (result) {
        this.clientsService.adminTopUp(this.clientId, result.amount, result.description).subscribe({
          next: () => { this.snackBar.open('Wallet topped up', 'OK', { duration: 3000 }); this.loadClient(); this.loadTransactions(); },
          error: () => this.snackBar.open('Failed to top up', 'OK', { duration: 3000 })
        });
      }
    });
  }

  openSettlement() {
    const ref = this.dialog.open(RecordSettlementDialog, { width: '420px', data: {} });
    ref.afterClosed().subscribe(result => {
      if (result) {
        this.clientsService.recordSettlement(this.clientId, result).subscribe({
          next: () => { this.snackBar.open('Settlement recorded', 'OK', { duration: 3000 }); this.loadClient(); this.loadTransactions(); },
          error: () => this.snackBar.open('Failed to record settlement', 'OK', { duration: 3000 })
        });
      }
    });
  }

  approve() {
    this.actionLoading = true;
    this.clientsService.approve(this.clientId).subscribe({
      next: () => { this.snackBar.open('Client approved', 'OK', { duration: 3000 }); this.loadClient(); this.actionLoading = false; },
      error: () => { this.snackBar.open('Failed', 'OK', { duration: 3000 }); this.actionLoading = false; }
    });
  }

  reject() {
    const ref = this.dialog.open(ConfirmActionDialog, {
      width: '400px',
      data: { title: 'Reject Client', message: 'Reject this client application?', requireReason: true, reasonLabel: 'Rejection reason', confirmLabel: 'Reject', confirmColor: 'warn' }
    });
    ref.afterClosed().subscribe(reason => {
      if (reason) {
        this.clientsService.reject(this.clientId, reason).subscribe({
          next: () => { this.snackBar.open('Client rejected', 'OK', { duration: 3000 }); this.loadClient(); },
          error: () => this.snackBar.open('Failed', 'OK', { duration: 3000 })
        });
      }
    });
  }

  suspend() {
    const ref = this.dialog.open(ConfirmActionDialog, {
      width: '400px',
      data: { title: 'Suspend Client', message: 'Suspend this client?', requireReason: true, reasonLabel: 'Suspension reason', confirmLabel: 'Suspend', confirmColor: 'warn' }
    });
    ref.afterClosed().subscribe(reason => {
      if (reason) {
        this.clientsService.suspend(this.clientId, reason).subscribe({
          next: () => { this.snackBar.open('Client suspended', 'OK', { duration: 3000 }); this.loadClient(); },
          error: () => this.snackBar.open('Failed', 'OK', { duration: 3000 })
        });
      }
    });
  }

  activate() {
    this.actionLoading = true;
    this.clientsService.activate(this.clientId).subscribe({
      next: () => { this.snackBar.open('Client activated', 'OK', { duration: 3000 }); this.loadClient(); this.actionLoading = false; },
      error: () => { this.snackBar.open('Failed', 'OK', { duration: 3000 }); this.actionLoading = false; }
    });
  }
}
