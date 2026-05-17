import { Component, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PageEvent } from '@angular/material/paginator';
import { WalletService, TransactionFilters } from '../../../core/services/wallet.service';
import { CreditBalance, WalletTransaction } from '../../../core/models/wallet.models';
import { RedeemDialogComponent } from './redeem-dialog.component';

@Component({
  standalone: false,
  selector: 'app-wallet-dashboard',
  templateUrl: './wallet-dashboard.component.html',
  styleUrls: ['./wallet-dashboard.component.scss'],
})
export class WalletDashboardComponent implements OnInit {
  balance = signal<CreditBalance | null>(null);
  transactions = signal<WalletTransaction[]>([]);
  total = signal(0);
  page = signal(0);
  pageSize = signal(10);
  loading = signal(true);
  topping = signal(false);
  loyaltyPoints = signal(0);

  topUpForm!: FormGroup;
  txColumns = ['createdAt', 'type', 'amount', 'balanceAfter', 'description'];
  typeFilter = signal<string>('');

  constructor(
    private walletService: WalletService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private fb: FormBuilder,
  ) {}

  ngOnInit() {
    this.topUpForm = this.fb.group({
      amount: [null, [Validators.required, Validators.min(1)]],
      currency: ['AED', Validators.required],
    });

    this.loadBalance();
    this.loadTransactions();
  }

  loadBalance() {
    this.walletService.getBalance().subscribe({
      next: (b) => {
        this.balance.set(b);
        this.loyaltyPoints.set(b.loyaltyPoints ?? 0);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  get pointValueAed(): number {
    const fils = this.balance()?.pointValueFils ?? 1;
    return fils / 100;
  }

  get nextExpiryDate(): string | null {
    return this.balance()?.nextExpiryDate ?? null;
  }

  downloadStatement() {
    const to = new Date().toISOString().split('T')[0];
    const from = new Date(Date.now() - 90 * 24 * 60 * 60_000).toISOString().split('T')[0];
    this.walletService.getStatement(from, to).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `statement-${from}-to-${to}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => this.snackBar.open('Statement download failed', 'Close', { duration: 3000 }),
    });
  }

  loadTransactions() {
    const params: TransactionFilters = {
      page: this.page() + 1,
      limit: this.pageSize(),
    };
    if (this.typeFilter()) params.type = this.typeFilter();

    this.walletService.getTransactions(params).subscribe({
      next: (res) => {
        this.transactions.set(res.data);
        this.total.set(res.total);
      },
      error: () => {},
    });
  }

  onPage(event: PageEvent) {
    this.page.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.loadTransactions();
  }

  onTypeFilter(type: string) {
    this.typeFilter.set(type);
    this.page.set(0);
    this.loadTransactions();
  }

  get creditUsagePercent(): number {
    const b = this.balance();
    if (!b || b.creditLimit + b.walletBalance === 0) return 0;
    return Math.round((b.usedCredit / (b.creditLimit + b.walletBalance)) * 100);
  }

  topUp() {
    if (this.topUpForm.invalid) {
      this.topUpForm.markAllAsTouched();
      return;
    }
    this.topping.set(true);
    const { amount, currency } = this.topUpForm.value;
    this.walletService.topUp(amount, currency).subscribe({
      next: (res) => {
        this.topping.set(false);
        window.location.href = res.paymentUrl;
      },
      error: (err) => {
        this.topping.set(false);
        const msg = err?.error?.message || 'Top-up initiation failed';
        this.snackBar.open(msg, 'Close', { duration: 3000 });
      },
    });
  }

  openRedeemDialog() {
    const pts = this.loyaltyPoints();
    if (pts === 0) {
      this.snackBar.open('No loyalty points to redeem', 'Close', { duration: 3000 });
      return;
    }

    const dialogRef = this.dialog.open(RedeemDialogComponent, {
      width: '380px',
      data: { points: pts },
    });

    dialogRef.afterClosed().subscribe((points) => {
      if (points) {
        this.walletService.redeemPoints(points).subscribe({
          next: () => {
            this.snackBar.open(`${points} points redeemed successfully!`, 'Close', { duration: 3000 });
            this.loyaltyPoints.update((p) => p - points);
            this.loadBalance();
          },
          error: (err) => {
            const msg = err?.error?.message || 'Redemption failed';
            this.snackBar.open(msg, 'Close', { duration: 3000 });
          },
        });
      }
    });
  }

  getTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      topup: 'Top-up',
      credit_use: 'Credit Used',
      credit_refund: 'Credit Refund',
      loyalty_earn: 'Loyalty Earned',
      loyalty_redeem: 'Points Redeemed',
      adjustment: 'Adjustment',
    };
    return labels[type] || type;
  }

  getTypeClass(type: string): string {
    const credits = ['topup', 'credit_refund', 'loyalty_earn'];
    return credits.includes(type) ? 'tx-credit' : 'tx-debit';
  }
}
