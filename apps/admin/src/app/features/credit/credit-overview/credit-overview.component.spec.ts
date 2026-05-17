import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { CreditOverviewComponent } from './credit-overview.component';
import { ClientsService } from '../../../core/services/clients.service';

const mockEntries = [
  { companyId: 'c1', companyName: 'ACME', outstandingBalance: 50000, currency: 'AED', agingBucket: '0-30' },
  { companyId: 'c2', companyName: 'BETA', outstandingBalance: 30000, currency: 'AED', agingBucket: '31-60' },
  { companyId: 'c3', companyName: 'GAMMA', outstandingBalance: 20000, currency: 'AED', agingBucket: '61-90' },
  { companyId: 'c4', companyName: 'DELTA', outstandingBalance: 10000, currency: 'AED', agingBucket: '90+' },
];

describe('CreditOverviewComponent', () => {
  let component: CreditOverviewComponent;
  let clientsService: jest.Mocked<Partial<ClientsService>>;

  beforeEach(() => {
    clientsService = {
      getOutstanding: jest.fn().mockReturnValue(of({ data: mockEntries })),
    };

    TestBed.configureTestingModule({
      declarations: [CreditOverviewComponent],
      providers: [{ provide: ClientsService, useValue: clientsService }],
      schemas: [NO_ERRORS_SCHEMA],
    });
    component = TestBed.createComponent(CreditOverviewComponent).componentInstance;
  });

  it('creates the component', () => expect(component).toBeTruthy());

  it('ngOnInit() loads outstanding entries', fakeAsync(() => {
    component.ngOnInit();
    tick();
    expect(clientsService.getOutstanding).toHaveBeenCalled();
    expect(component.entries()).toHaveLength(4);
    expect(component.loading()).toBe(false);
  }));

  it('loadOutstanding() handles array response directly', fakeAsync(() => {
    (clientsService.getOutstanding as jest.Mock).mockReturnValue(of(mockEntries));
    component.loadOutstanding();
    tick();
    expect(component.entries()).toHaveLength(4);
  }));

  it('loadOutstanding() sets error on failure', fakeAsync(() => {
    (clientsService.getOutstanding as jest.Mock).mockReturnValue(throwError(() => new Error()));
    component.loadOutstanding();
    tick();
    expect(component.error()).toBe('Failed to load outstanding accounts.');
    expect(component.loading()).toBe(false);
  }));

  it('bucket getters filter entries correctly', fakeAsync(() => {
    component.ngOnInit();
    tick();
    expect(component.bucket030).toHaveLength(1);
    expect(component.bucket3160).toHaveLength(1);
    expect(component.bucket6190).toHaveLength(1);
    expect(component.bucketOver90).toHaveLength(1);
  }));

  it('totalOutstanding sums all entries', fakeAsync(() => {
    component.ngOnInit();
    tick();
    expect(component.totalOutstanding).toBe(110000);
  }));

  it('formatAmount() converts fils to AED', () => {
    expect(component.formatAmount(100000)).toContain('1,000');
  });

  it('getBucketClass() returns correct classes', () => {
    expect(component.getBucketClass('0-30')).toBe('bucket-green');
    expect(component.getBucketClass('31-60')).toBe('bucket-yellow');
    expect(component.getBucketClass('61-90')).toBe('bucket-orange');
    expect(component.getBucketClass('90+')).toBe('bucket-red');
    expect(component.getBucketClass('unknown')).toBe('');
  });
});
