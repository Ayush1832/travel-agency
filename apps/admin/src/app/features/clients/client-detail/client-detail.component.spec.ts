import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { of, Subject, throwError } from 'rxjs';
import { ClientDetailComponent } from './client-detail.component';
import { ClientsService } from '../../../core/services/clients.service';

const mockCompany = { _id: 'c1', companyName: 'ACME', status: 'active', creditLimit: 500000 };
const mockGetResp = { data: { company: mockCompany, creditBalance: { outstanding: 0 }, recentBookings: [] } };
const mockTxResp = { data: { data: [], total: 0 } };

describe('ClientDetailComponent', () => {
  let component: ClientDetailComponent;
  let clientsService: jest.Mocked<Partial<ClientsService>>;
  let snackBar: jest.Mocked<Partial<MatSnackBar>>;
  let dialog: jest.Mocked<Partial<MatDialog>>;

  beforeEach(() => {
    clientsService = {
      get: jest.fn().mockReturnValue(of(mockGetResp)),
      getTransactions: jest.fn().mockReturnValue(of(mockTxResp)),
      updateCreditLimit: jest.fn(),
      adminTopUp: jest.fn(),
      recordSettlement: jest.fn(),
      approve: jest.fn(),
      reject: jest.fn(),
      suspend: jest.fn(),
      activate: jest.fn(),
    };
    snackBar = { open: jest.fn() };
    dialog = { open: jest.fn() };

    TestBed.configureTestingModule({
      declarations: [ClientDetailComponent],
      providers: [
        { provide: ClientsService, useValue: clientsService },
        { provide: MatSnackBar, useValue: snackBar },
        { provide: MatDialog, useValue: dialog },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'c1' } } } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });
    component = TestBed.createComponent(ClientDetailComponent).componentInstance;
  });

  it('creates the component', () => expect(component).toBeTruthy());

  it('ngOnInit() loads client and transactions', fakeAsync(() => {
    component.ngOnInit();
    tick();
    expect(clientsService.get).toHaveBeenCalledWith('c1');
    expect(clientsService.getTransactions).toHaveBeenCalledWith('c1', expect.any(Object));
    expect(component.company).toMatchObject({ _id: 'c1' });
  }));

  it('loadClient() shows error snackbar on failure', fakeAsync(() => {
    (clientsService.get as jest.Mock).mockReturnValue(throwError(() => new Error()));
    component.clientId = 'c1';
    component.loadClient();
    tick();
    expect(snackBar.open).toHaveBeenCalledWith('Failed to load client', 'OK', expect.any(Object));
  }));

  it('onTxPage() updates txPage/txLimit and reloads transactions', () => {
    component.clientId = 'c1';
    component.onTxPage({ pageIndex: 1, pageSize: 5, length: 20 } as any);
    expect(component.txPage).toBe(1);
    expect(component.txLimit).toBe(5);
    expect(clientsService.getTransactions).toHaveBeenCalled();
  });

  it('formatAed() handles null input', () => {
    expect(component.formatAed(null as any)).toBe('0.00');
  });

  it('statusClass() and bookingStatusClass() return correct classes', () => {
    expect(component.statusClass('active')).toBe('chip-active');
    expect(component.bookingStatusClass('confirmed')).toBe('chip-confirmed');
    expect(component.bookingStatusClass('unknown')).toBe('');
  });

  it('approve() calls service and reloads', fakeAsync(() => {
    (clientsService.approve as jest.Mock).mockReturnValue(of({}));
    component.clientId = 'c1';
    component.approve();
    tick();
    expect(snackBar.open).toHaveBeenCalledWith('Client approved', 'OK', expect.any(Object));
    expect(component.actionLoading).toBe(false);
  }));

  it('approve() shows error on failure', fakeAsync(() => {
    (clientsService.approve as jest.Mock).mockReturnValue(throwError(() => new Error()));
    component.clientId = 'c1';
    component.approve();
    tick();
    expect(snackBar.open).toHaveBeenCalledWith('Failed', 'OK', expect.any(Object));
    expect(component.actionLoading).toBe(false);
  }));

  it('activate() calls service and reloads', fakeAsync(() => {
    (clientsService.activate as jest.Mock).mockReturnValue(of({}));
    component.clientId = 'c1';
    component.activate();
    tick();
    expect(snackBar.open).toHaveBeenCalledWith('Client activated', 'OK', expect.any(Object));
  }));

  it('openSetCreditLimit() opens dialog and updates limit on confirm', fakeAsync(() => {
    const afterClosed$ = new Subject<number>();
    (dialog.open as jest.Mock).mockReturnValue({ afterClosed: () => afterClosed$.asObservable() });
    (clientsService.updateCreditLimit as jest.Mock).mockReturnValue(of({}));
    component.clientId = 'c1';
    component.company = mockCompany as any;
    component.openSetCreditLimit();
    afterClosed$.next(100000);
    tick();
    expect(clientsService.updateCreditLimit).toHaveBeenCalledWith('c1', 100000);
    expect(snackBar.open).toHaveBeenCalledWith('Credit limit updated', 'OK', expect.any(Object));
  }));

  it('openSetCreditLimit() does nothing when dialog closed with null', fakeAsync(() => {
    const afterClosed$ = new Subject<null>();
    (dialog.open as jest.Mock).mockReturnValue({ afterClosed: () => afterClosed$.asObservable() });
    component.company = mockCompany as any;
    component.openSetCreditLimit();
    afterClosed$.next(null);
    tick();
    expect(clientsService.updateCreditLimit).not.toHaveBeenCalled();
  }));

  it('openTopUp() opens dialog and tops up on confirm', fakeAsync(() => {
    const afterClosed$ = new Subject<any>();
    (dialog.open as jest.Mock).mockReturnValue({ afterClosed: () => afterClosed$.asObservable() });
    (clientsService.adminTopUp as jest.Mock).mockReturnValue(of({}));
    component.clientId = 'c1';
    component.openTopUp();
    afterClosed$.next({ amount: 5000, description: 'Test' });
    tick();
    expect(clientsService.adminTopUp).toHaveBeenCalledWith('c1', 5000, 'Test');
    expect(snackBar.open).toHaveBeenCalledWith('Wallet topped up', 'OK', expect.any(Object));
  }));

  it('openSettlement() opens dialog and records settlement on confirm', fakeAsync(() => {
    const afterClosed$ = new Subject<any>();
    (dialog.open as jest.Mock).mockReturnValue({ afterClosed: () => afterClosed$.asObservable() });
    (clientsService.recordSettlement as jest.Mock).mockReturnValue(of({}));
    component.clientId = 'c1';
    component.openSettlement();
    afterClosed$.next({ amount: 10000, mode: 'bank_transfer' });
    tick();
    expect(clientsService.recordSettlement).toHaveBeenCalled();
    expect(snackBar.open).toHaveBeenCalledWith('Settlement recorded', 'OK', expect.any(Object));
  }));

  it('reject() opens dialog and rejects on confirm', fakeAsync(() => {
    const afterClosed$ = new Subject<string>();
    (dialog.open as jest.Mock).mockReturnValue({ afterClosed: () => afterClosed$.asObservable() });
    (clientsService.reject as jest.Mock).mockReturnValue(of({}));
    component.clientId = 'c1';
    component.reject();
    afterClosed$.next('Fraudulent company');
    tick();
    expect(clientsService.reject).toHaveBeenCalledWith('c1', 'Fraudulent company');
  }));

  it('suspend() opens dialog and suspends on confirm', fakeAsync(() => {
    const afterClosed$ = new Subject<string>();
    (dialog.open as jest.Mock).mockReturnValue({ afterClosed: () => afterClosed$.asObservable() });
    (clientsService.suspend as jest.Mock).mockReturnValue(of({}));
    component.clientId = 'c1';
    component.suspend();
    afterClosed$.next('Policy violation');
    tick();
    expect(clientsService.suspend).toHaveBeenCalledWith('c1', 'Policy violation');
  }));
});
