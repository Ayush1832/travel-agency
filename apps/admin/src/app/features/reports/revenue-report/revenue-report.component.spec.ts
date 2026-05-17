import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of, throwError } from 'rxjs';
import { RevenueReportComponent } from './revenue-report.component';
import { ReportsService } from '../../../core/services/reports.service';

const mockReport = { totalGross: 5000000, totalBookings: 50, items: [] };

describe('RevenueReportComponent', () => {
  let component: RevenueReportComponent;
  let reportsService: jest.Mocked<Partial<ReportsService>>;
  let snackBar: jest.Mocked<Partial<MatSnackBar>>;

  beforeEach(() => {
    reportsService = {
      getRevenue: jest.fn().mockReturnValue(of({ data: mockReport })),
      exportReport: jest.fn(),
    };
    snackBar = { open: jest.fn() };

    TestBed.configureTestingModule({
      declarations: [RevenueReportComponent],
      providers: [
        { provide: ReportsService, useValue: reportsService },
        { provide: MatSnackBar, useValue: snackBar },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParams: {} } } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });
    component = TestBed.createComponent(RevenueReportComponent).componentInstance;
  });

  it('creates the component', () => expect(component).toBeTruthy());

  it('ngOnInit() loads report', fakeAsync(() => {
    component.ngOnInit();
    tick();
    expect(reportsService.getRevenue).toHaveBeenCalled();
    expect(component.report).toMatchObject({ totalGross: 5000000 });
    expect(component.loading).toBe(false);
  }));

  it('loadReport() shows error on failure', fakeAsync(() => {
    (reportsService.getRevenue as jest.Mock).mockReturnValue(throwError(() => new Error()));
    component.fromDate = '2026-01-01';
    component.toDate = '2026-01-31';
    component.loadReport();
    tick();
    expect(snackBar.open).toHaveBeenCalledWith('Failed to load report', 'OK', expect.any(Object));
  }));

  it('exportExcel() calls exportReport and triggers download', fakeAsync(() => {
    (reportsService.exportReport as jest.Mock).mockReturnValue(of(new Blob(['xlsx'])));
    Object.defineProperty(URL, 'createObjectURL', { value: jest.fn().mockReturnValue('blob:url'), writable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: jest.fn(), writable: true });
    component.fromDate = '2026-01-01';
    component.toDate = '2026-01-31';
    component.exportExcel();
    tick();
    expect(reportsService.exportReport).toHaveBeenCalledWith('revenue', 'xlsx', expect.any(Object));
  }));

  it('exportExcel() shows error on failure', fakeAsync(() => {
    (reportsService.exportReport as jest.Mock).mockReturnValue(throwError(() => new Error()));
    component.exportExcel();
    tick();
    expect(snackBar.open).toHaveBeenCalledWith('Export failed', 'OK', expect.any(Object));
  }));

  it('formatAed() returns 0.00 for falsy', () => {
    expect(component.formatAed(0)).toBe('0.00');
    expect(component.formatAed(100000)).toContain('1,000');
  });
});
