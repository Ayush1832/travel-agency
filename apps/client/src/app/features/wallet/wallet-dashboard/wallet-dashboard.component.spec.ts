import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of, throwError, Subject } from 'rxjs';
import { WalletDashboardComponent } from './wallet-dashboard.component';
import { WalletService } from '../../../core/services/wallet.service';

const mockBalance = { walletBalance: 50000, creditLimit: 100000, outstandingBalance: 20000, usedCredit: 20000, availableCredit: 130000, loyaltyPoints: 500, currency: 'AED' };
const mockTxRes = { data: [{ _id: 'tx1', type: 'topup', direction: 'credit', amount: 10000 } as any], total: 1 };

describe('WalletDashboardComponent', () => {
  let component: WalletDashboardComponent;
  let walletService: jest.Mocked<Partial<WalletService>>;
  let snackBar: jest.Mocked<Partial<MatSnackBar>>;
  let dialog: jest.Mocked<Partial<MatDialog>>;

  beforeEach(() => {
    walletService = {
      getBalance: jest.fn().mockReturnValue(of(mockBalance)),
      getTransactions: jest.fn().mockReturnValue(of(mockTxRes)),
      topUp: jest.fn(),
      getStatement: jest.fn(),
      redeemPoints: jest.fn(),
    };
    snackBar = { open: jest.fn() };
    dialog = { open: jest.fn() };

    TestBed.configureTestingModule({
      declarations: [WalletDashboardComponent],
      imports: [ReactiveFormsModule],
      providers: [
        { provide: WalletService, useValue: walletService },
        { provide: MatSnackBar, useValue: snackBar },
        { provide: MatDialog, useValue: dialog },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });
    const fixture = TestBed.createComponent(WalletDashboardComponent);
    component = fixture.componentInstance;
    component.ngOnInit();
  });

  it('creates the component', () => expect(component).toBeTruthy());

  it('ngOnInit() loads balance and transactions', () => {
    expect(walletService.getBalance).toHaveBeenCalled();
    expect(walletService.getTransactions).toHaveBeenCalled();
  });

  it('loadBalance() sets balance and loyaltyPoints signals', () => {
    expect(component.balance()).toMatchObject({ walletBalance: 50000 });
    expect(component.loyaltyPoints()).toBe(500);
  });

  it('loadTransactions() sets transactions and total', () => {
    expect(component.transactions()).toHaveLength(1);
    expect(component.total()).toBe(1);
  });

  it('creditUsagePercent() returns correct percentage', () => {
    // usedCredit=20000, creditLimit+walletBalance=150000
    expect(component.creditUsagePercent).toBe(13);
  });

  it('creditUsagePercent() returns 0 when balance is null', () => {
    component.balance.set(null);
    expect(component.creditUsagePercent).toBe(0);
  });

  it('topUp() does nothing when form is invalid', () => {
    component.topUp();
    expect(walletService.topUp).not.toHaveBeenCalled();
  });

  it('topUp() calls walletService.topUp with form values', fakeAsync(() => {
    (walletService.topUp as jest.Mock).mockReturnValue(of({ paymentUrl: 'https://pay.example.com' }));
    const originalHref = window.location.href;
    component.topUpForm.setValue({ amount: 500, currency: 'AED' });
    component.topUp();
    tick();
    expect(walletService.topUp).toHaveBeenCalledWith(500, 'AED');
  }));

  it('topUp() shows error on failure', fakeAsync(() => {
    (walletService.topUp as jest.Mock).mockReturnValue(throwError(() => ({ error: { message: 'Payment error' } })));
    component.topUpForm.setValue({ amount: 500, currency: 'AED' });
    component.topUp();
    tick();
    expect(snackBar.open).toHaveBeenCalledWith('Payment error', 'Close', expect.any(Object));
  }));

  it('openRedeemDialog() shows snackbar when no points', () => {
    component.loyaltyPoints.set(0);
    component.openRedeemDialog();
    expect(snackBar.open).toHaveBeenCalledWith('No loyalty points to redeem', 'Close', expect.any(Object));
    expect(dialog.open).not.toHaveBeenCalled();
  });

  it('openRedeemDialog() opens dialog and redeems points on confirm', fakeAsync(() => {
    const afterClosed$ = new Subject<number>();
    (dialog.open as jest.Mock).mockReturnValue({ afterClosed: () => afterClosed$.asObservable() });
    (walletService.redeemPoints as jest.Mock).mockReturnValue(of({}));

    component.loyaltyPoints.set(200);
    component.openRedeemDialog();
    afterClosed$.next(100);
    tick();

    expect(walletService.redeemPoints).toHaveBeenCalledWith(100);
    // loyaltyPoints is reloaded from getBalance (returns 500 in mock) after redemption
    expect(walletService.getBalance).toHaveBeenCalledTimes(2);
    expect(snackBar.open).toHaveBeenCalledWith('100 points redeemed successfully!', 'Close', expect.any(Object));
  }));

  it('getTypeLabel() returns human-readable labels', () => {
    expect(component.getTypeLabel('topup')).toBe('Top-up');
    expect(component.getTypeLabel('credit_use')).toBe('Credit Used');
    expect(component.getTypeLabel('unknown')).toBe('unknown');
  });

  it('getTypeClass() returns credit/debit classes', () => {
    expect(component.getTypeClass('topup')).toBe('tx-credit');
    expect(component.getTypeClass('credit_use')).toBe('tx-debit');
  });

  it('onTypeFilter() updates filter and reloads', () => {
    component.onTypeFilter('topup');
    expect(component.typeFilter()).toBe('topup');
    expect(walletService.getTransactions).toHaveBeenCalledTimes(2); // ngOnInit + onTypeFilter
  });
});
