import { TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of, throwError } from 'rxjs';
import { SupportListComponent } from './support-list.component';
import { SupportService } from '../../../core/services/support.service';

const mockTicketsRes = {
  data: [{ _id: 't1', status: 'open' } as any, { _id: 't2', status: 'resolved' } as any],
  total: 2,
};

describe('SupportListComponent', () => {
  let component: SupportListComponent;
  let supportService: jest.Mocked<Partial<SupportService>>;
  let snackBar: jest.Mocked<Partial<MatSnackBar>>;
  let router: Router;

  beforeEach(() => {
    supportService = { listTickets: jest.fn().mockReturnValue(of(mockTicketsRes)) };
    snackBar = { open: jest.fn() };

    TestBed.configureTestingModule({
      declarations: [SupportListComponent],
      providers: [
        { provide: SupportService, useValue: supportService },
        { provide: MatSnackBar, useValue: snackBar },
        provideRouter([]),
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });
    const fixture = TestBed.createComponent(SupportListComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
  });

  it('creates the component', () => expect(component).toBeTruthy());

  it('ngOnInit() calls loadTickets()', () => {
    component.ngOnInit();
    expect(supportService.listTickets).toHaveBeenCalled();
  });

  it('loadTickets() sets tickets and total', () => {
    component.loadTickets();
    expect(component.tickets()).toHaveLength(2);
    expect(component.total()).toBe(2);
    expect(component.loading()).toBe(false);
  });

  it('loadTickets() passes statusFilter when set', () => {
    component.statusFilter.set('open');
    component.loadTickets();
    expect(supportService.listTickets).toHaveBeenCalledWith(expect.objectContaining({ status: 'open' }));
  });

  it('loadTickets() shows snackbar on error', () => {
    (supportService.listTickets as jest.Mock).mockReturnValue(throwError(() => new Error()));
    component.loadTickets();
    expect(snackBar.open).toHaveBeenCalled();
  });

  it('onStatusFilter() updates filter and reloads', () => {
    component.onStatusFilter('in_progress');
    expect(component.statusFilter()).toBe('in_progress');
    expect(component.page()).toBe(0);
  });

  it('onPage() updates page/pageSize and reloads', () => {
    component.onPage({ pageIndex: 1, pageSize: 20, length: 100 });
    expect(component.page()).toBe(1);
    expect(component.pageSize()).toBe(20);
  });

  it('viewTicket() navigates to support detail', () => {
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
    component.viewTicket('t1');
    expect(router.navigate).toHaveBeenCalledWith(['/support', 't1']);
  });

  it('newTicket() navigates to support/new', () => {
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
    component.newTicket();
    expect(router.navigate).toHaveBeenCalledWith(['/support/new']);
  });

  it('getStatusClass() returns correct CSS class', () => {
    expect(component.getStatusClass('open')).toBe('status-pending');
    expect(component.getStatusClass('resolved')).toBe('status-confirmed');
    expect(component.getStatusClass('unknown')).toBe('status-pending');
  });

  it('getPriorityClass() returns correct CSS class', () => {
    expect(component.getPriorityClass('urgent')).toBe('priority-urgent');
    expect(component.getPriorityClass('medium')).toBe('priority-medium');
    expect(component.getPriorityClass('unknown')).toBe('');
  });
});
