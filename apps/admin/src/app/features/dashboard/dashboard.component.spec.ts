import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of, throwError } from 'rxjs';
import { DashboardComponent } from './dashboard.component';
import { ReportsService } from '../../core/services/reports.service';
import { ClientsService } from '../../core/services/clients.service';
import { AdminBookingsService } from '../../core/services/admin-bookings.service';

const mockRevenueResp = { data: { totalGross: 1000000, totalBookings: 42, items: [{ bookingsCount: 5 }, { bookingsCount: 10 }, { bookingsCount: 3 }] } };
const mockPendingResp = { data: { total: 3, data: [{ _id: 'c1', companyName: 'ACME' }] } };
const mockActiveResp = { data: { total: 15, data: [] } };
const mockBookingsResp = { data: { total: 42, data: [] } };

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let reportsService: jest.Mocked<Partial<ReportsService>>;
  let clientsService: jest.Mocked<Partial<ClientsService>>;
  let bookingsService: jest.Mocked<Partial<AdminBookingsService>>;
  let snackBar: jest.Mocked<Partial<MatSnackBar>>;
  let mockRouter: jest.Mocked<Partial<Router>>;

  beforeEach(() => {
    reportsService = { getRevenue: jest.fn().mockReturnValue(of(mockRevenueResp)) };
    clientsService = {
      list: jest.fn().mockReturnValue(of(mockPendingResp)),
      approve: jest.fn(),
      reject: jest.fn(),
    };
    bookingsService = { list: jest.fn().mockReturnValue(of(mockBookingsResp)) };
    snackBar = { open: jest.fn() };
    mockRouter = { navigate: jest.fn() };

    TestBed.configureTestingModule({
      declarations: [DashboardComponent],
      providers: [
        { provide: ReportsService, useValue: reportsService },
        { provide: ClientsService, useValue: clientsService },
        { provide: AdminBookingsService, useValue: bookingsService },
        { provide: MatSnackBar, useValue: snackBar },
        { provide: Router, useValue: mockRouter },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });
    component = TestBed.createComponent(DashboardComponent).componentInstance;
  });

  it('creates the component', () => expect(component).toBeTruthy());

  it('ngOnInit() calls all data services', fakeAsync(() => {
    (clientsService.list as jest.Mock)
      .mockReturnValueOnce(of(mockPendingResp))
      .mockReturnValueOnce(of(mockActiveResp));
    component.ngOnInit();
    tick();
    expect(reportsService.getRevenue).toHaveBeenCalled();
    expect(clientsService.list).toHaveBeenCalled();
    expect(bookingsService.list).toHaveBeenCalled();
  }));

  it('ngOnInit() populates kpi and pendingClients', fakeAsync(() => {
    (clientsService.list as jest.Mock)
      .mockReturnValueOnce(of(mockPendingResp))
      .mockReturnValueOnce(of(mockActiveResp));
    component.ngOnInit();
    tick();
    expect(component.kpi.revenueThisMonth).toBe(1000000);
    expect(component.kpi.pendingClients).toBe(3);
    expect(component.pendingClients).toHaveLength(1);
    expect(component.loading).toBe(false);
  }));

  it('ngOnInit() handles revenue service error gracefully', fakeAsync(() => {
    (reportsService.getRevenue as jest.Mock).mockReturnValue(throwError(() => new Error()));
    (clientsService.list as jest.Mock).mockReturnValue(of(mockPendingResp));
    component.ngOnInit();
    tick();
    expect(component.loading).toBe(false);
  }));

  it('formatAed() converts fils to AED string', () => {
    expect(component.formatAed(100000)).toContain('1,000');
  });

  it('quickApprove() approves client and updates kpi', fakeAsync(() => {
    (clientsService.approve as jest.Mock).mockReturnValue(of({}));
    component.pendingClients = [{ _id: 'c1', companyName: 'ACME' }];
    component.kpi.pendingClients = 1;
    component.kpi.activeClients = 5;
    component.quickApprove({ _id: 'c1', companyName: 'ACME' });
    tick();
    expect(snackBar.open).toHaveBeenCalledWith('ACME approved', 'OK', expect.any(Object));
    expect(component.pendingClients).toHaveLength(0);
    expect(component.kpi.activeClients).toBe(6);
    expect(component.kpi.pendingClients).toBe(0);
  }));

  it('quickApprove() shows error snackbar on failure', fakeAsync(() => {
    (clientsService.approve as jest.Mock).mockReturnValue(throwError(() => new Error()));
    component.quickApprove({ _id: 'c1', companyName: 'ACME' });
    tick();
    expect(snackBar.open).toHaveBeenCalledWith('Failed to approve client', 'OK', expect.any(Object));
  }));

  it('quickReject() rejects client and decrements kpi', fakeAsync(() => {
    (clientsService.reject as jest.Mock).mockReturnValue(of({}));
    component.pendingClients = [{ _id: 'c1', companyName: 'ACME' }];
    component.kpi.pendingClients = 1;
    component.quickReject({ _id: 'c1', companyName: 'ACME' });
    tick();
    expect(snackBar.open).toHaveBeenCalledWith('ACME rejected', 'OK', expect.any(Object));
    expect(component.pendingClients).toHaveLength(0);
  }));

  it('quickReject() shows error snackbar on failure', fakeAsync(() => {
    (clientsService.reject as jest.Mock).mockReturnValue(throwError(() => new Error()));
    component.quickReject({ _id: 'c1', companyName: 'ACME' });
    tick();
    expect(snackBar.open).toHaveBeenCalledWith('Failed to reject client', 'OK', expect.any(Object));
  }));

  it('goToClients() navigates to /clients', () => {
    component.goToClients();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/clients']);
  });
});
