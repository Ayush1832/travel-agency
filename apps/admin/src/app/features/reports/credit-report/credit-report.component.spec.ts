import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of, throwError } from 'rxjs';
import { CreditReportComponent } from './credit-report.component';
import { ReportsService } from '../../../core/services/reports.service';

const mockReport = { totalTopUps: 1000000, totalCreditUsed: 750000, totalSettlements: 800000, items: [] };

describe('CreditReportComponent', () => {
  let component: CreditReportComponent;
  let reportsService: jest.Mocked<Partial<ReportsService>>;
  let snackBar: jest.Mocked<Partial<MatSnackBar>>;

  beforeEach(() => {
    reportsService = {
      getCredit: jest.fn().mockReturnValue(of({ data: mockReport })),
    };
    snackBar = { open: jest.fn() };

    TestBed.configureTestingModule({
      declarations: [CreditReportComponent],
      providers: [
        { provide: ReportsService, useValue: reportsService },
        { provide: MatSnackBar, useValue: snackBar },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParams: {} } } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });
    component = TestBed.createComponent(CreditReportComponent).componentInstance;
  });

  it('creates the component', () => expect(component).toBeTruthy());

  it('ngOnInit() loads credit report', fakeAsync(() => {
    component.ngOnInit();
    tick();
    expect(reportsService.getCredit).toHaveBeenCalled();
    expect(component.report).toMatchObject({ totalTopUps: 1000000 });
    expect(component.loading).toBe(false);
  }));

  it('loadReport() shows error on failure', fakeAsync(() => {
    (reportsService.getCredit as jest.Mock).mockReturnValue(throwError(() => new Error()));
    component.fromDate = '2026-01-01';
    component.toDate = '2026-01-31';
    component.loadReport();
    tick();
    expect(snackBar.open).toHaveBeenCalledWith('Failed to load report', 'OK', expect.any(Object));
  }));

  it('formatAed() returns 0.00 for falsy', () => {
    expect(component.formatAed(0)).toBe('0.00');
    expect(component.formatAed(500000)).toContain('5,000');
  });
});
