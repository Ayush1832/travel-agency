import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of, throwError } from 'rxjs';
import { BookingsReportComponent } from './bookings-report.component';
import { ReportsService } from '../../../core/services/reports.service';

const mockReport = { totalBookings: 100, totalAmount: 5000000, byStatus: [], byCompany: [] };

describe('BookingsReportComponent', () => {
  let component: BookingsReportComponent;
  let reportsService: jest.Mocked<Partial<ReportsService>>;
  let snackBar: jest.Mocked<Partial<MatSnackBar>>;

  beforeEach(() => {
    reportsService = {
      getBookings: jest.fn().mockReturnValue(of({ data: mockReport })),
      exportReport: jest.fn(),
    };
    snackBar = { open: jest.fn() };

    TestBed.configureTestingModule({
      declarations: [BookingsReportComponent],
      providers: [
        { provide: ReportsService, useValue: reportsService },
        { provide: MatSnackBar, useValue: snackBar },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParams: {} } } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });
    component = TestBed.createComponent(BookingsReportComponent).componentInstance;
  });

  it('creates the component', () => expect(component).toBeTruthy());

  it('ngOnInit() loads report with current month dates', fakeAsync(() => {
    component.ngOnInit();
    tick();
    expect(reportsService.getBookings).toHaveBeenCalled();
    expect(component.report).toMatchObject({ totalBookings: 100 });
    expect(component.loading).toBe(false);
  }));

  it('ngOnInit() uses query params for dates when provided', fakeAsync(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      declarations: [BookingsReportComponent],
      providers: [
        { provide: ReportsService, useValue: reportsService },
        { provide: MatSnackBar, useValue: snackBar },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParams: { from: '2026-01-01', to: '2026-01-31' } } } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });
    component = TestBed.createComponent(BookingsReportComponent).componentInstance;
    component.ngOnInit();
    tick();
    expect(component.fromDate).toBe('2026-01-01');
    expect(component.toDate).toBe('2026-01-31');
  }));

  it('loadReport() shows error snackbar on failure', fakeAsync(() => {
    (reportsService.getBookings as jest.Mock).mockReturnValue(throwError(() => new Error()));
    component.fromDate = '2026-01-01';
    component.toDate = '2026-01-31';
    component.loadReport();
    tick();
    expect(snackBar.open).toHaveBeenCalledWith('Failed to load report', 'OK', expect.any(Object));
  }));

  it('exportCsv() triggers download on success', fakeAsync(() => {
    (reportsService.exportReport as jest.Mock).mockReturnValue(of(new Blob(['csv'])));
    Object.defineProperty(URL, 'createObjectURL', { value: jest.fn().mockReturnValue('blob:url'), writable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: jest.fn(), writable: true });
    component.fromDate = '2026-01-01';
    component.exportCsv();
    tick();
    expect(reportsService.exportReport).toHaveBeenCalledWith('bookings', 'csv', expect.any(Object));
  }));

  it('exportCsv() shows error snackbar on failure', fakeAsync(() => {
    (reportsService.exportReport as jest.Mock).mockReturnValue(throwError(() => new Error()));
    component.exportCsv();
    tick();
    expect(snackBar.open).toHaveBeenCalledWith('Export failed', 'OK', expect.any(Object));
  }));

  it('formatAed() returns 0.00 for falsy value', () => {
    expect(component.formatAed(0)).toBe('0.00');
  });

  it('statusColor() returns correct colors', () => {
    expect(component.statusColor('confirmed')).toBe('#1565c0');
    expect(component.statusColor('cancelled')).toBe('#c62828');
    expect(component.statusColor('unknown')).toBe('#666');
  });
});
