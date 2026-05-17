import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { of, Subject, throwError } from 'rxjs';
import { ClientsListComponent } from './clients-list.component';
import { ClientsService } from '../../../core/services/clients.service';

const mockListResp = { data: { data: [{ _id: 'c1', companyName: 'ACME', status: 'pending' }], total: 1 } };

describe('ClientsListComponent', () => {
  let component: ClientsListComponent;
  let clientsService: jest.Mocked<Partial<ClientsService>>;
  let snackBar: jest.Mocked<Partial<MatSnackBar>>;
  let dialog: jest.Mocked<Partial<MatDialog>>;
  let mockRouter: jest.Mocked<Partial<Router>>;

  beforeEach(() => {
    clientsService = {
      list: jest.fn().mockReturnValue(of(mockListResp)),
      approve: jest.fn(),
      suspend: jest.fn(),
    };
    snackBar = { open: jest.fn() };
    dialog = { open: jest.fn() };
    mockRouter = { navigate: jest.fn() };

    TestBed.configureTestingModule({
      declarations: [ClientsListComponent],
      imports: [ReactiveFormsModule],
      providers: [
        { provide: ClientsService, useValue: clientsService },
        { provide: MatSnackBar, useValue: snackBar },
        { provide: MatDialog, useValue: dialog },
        { provide: Router, useValue: mockRouter },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });
    const fixture = TestBed.createComponent(ClientsListComponent);
    component = fixture.componentInstance;
  });

  it('creates the component', () => expect(component).toBeTruthy());

  it('ngOnInit() loads clients', fakeAsync(() => {
    component.ngOnInit();
    tick(500);
    expect(clientsService.list).toHaveBeenCalled();
    expect(component.clients).toHaveLength(1);
    expect(component.total).toBe(1);
  }));

  it('loadClients() shows error snackbar on failure', fakeAsync(() => {
    (clientsService.list as jest.Mock).mockReturnValue(throwError(() => new Error()));
    component.loadClients();
    tick();
    expect(snackBar.open).toHaveBeenCalledWith('Failed to load clients', 'OK', expect.any(Object));
  }));

  it('currentStatus returns correct status for selected tab', () => {
    component.selectedTab = 1;
    expect(component.currentStatus).toBe('pending');
    component.selectedTab = 2;
    expect(component.currentStatus).toBe('active');
  });

  it('onTabChange() updates selectedTab and reloads', () => {
    component.onTabChange(2);
    expect(component.selectedTab).toBe(2);
    expect(clientsService.list).toHaveBeenCalled();
  });

  it('onPage() updates page/limit and reloads', () => {
    component.onPage({ pageIndex: 1, pageSize: 10, length: 20 } as any);
    expect(component.page).toBe(1);
    expect(component.limit).toBe(10);
  });

  it('viewClient() navigates to /clients/:id', () => {
    component.viewClient('c1');
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/clients', 'c1']);
  });

  it('approve() calls service and reloads on success', fakeAsync(() => {
    (clientsService.approve as jest.Mock).mockReturnValue(of({}));
    component.approve({ _id: 'c1', companyName: 'ACME' } as any);
    tick();
    expect(snackBar.open).toHaveBeenCalledWith('Client approved', 'OK', expect.any(Object));
    expect(clientsService.list).toHaveBeenCalled();
  }));

  it('approve() shows error on failure', fakeAsync(() => {
    (clientsService.approve as jest.Mock).mockReturnValue(throwError(() => new Error()));
    component.approve({ _id: 'c1' } as any);
    tick();
    expect(snackBar.open).toHaveBeenCalledWith('Failed to approve', 'OK', expect.any(Object));
  }));

  it('openSuspend() opens dialog and suspends on confirm', fakeAsync(() => {
    const afterClosed$ = new Subject<string>();
    (dialog.open as jest.Mock).mockReturnValue({ afterClosed: () => afterClosed$.asObservable() });
    (clientsService.suspend as jest.Mock).mockReturnValue(of({}));
    component.openSuspend({ _id: 'c1', companyName: 'ACME' } as any);
    afterClosed$.next('Suspicious activity');
    tick();
    expect(clientsService.suspend).toHaveBeenCalledWith('c1', 'Suspicious activity');
    expect(snackBar.open).toHaveBeenCalledWith('Client suspended', 'OK', expect.any(Object));
  }));

  it('openSuspend() does nothing when dialog is cancelled', fakeAsync(() => {
    const afterClosed$ = new Subject<null>();
    (dialog.open as jest.Mock).mockReturnValue({ afterClosed: () => afterClosed$.asObservable() });
    component.openSuspend({ _id: 'c1', companyName: 'ACME' } as any);
    afterClosed$.next(null);
    tick();
    expect(clientsService.suspend).not.toHaveBeenCalled();
  }));

  it('formatAed() converts fils correctly', () => {
    expect(component.formatAed(50000)).toContain('500');
  });

  it('statusClass() returns correct class', () => {
    expect(component.statusClass('active')).toBe('chip-active');
    expect(component.statusClass('suspended')).toBe('chip-suspended');
    expect(component.statusClass('unknown')).toBe('');
  });
});
