import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of, throwError } from 'rxjs';
import { AdminSupportListComponent } from './admin-support-list.component';
import { SupportAdminService } from '../../../core/services/support-admin.service';

const mockListResp = { data: { data: [{ _id: 't1', subject: 'Help', priority: 'high', status: 'open' }], total: 1 } };

describe('AdminSupportListComponent', () => {
  let component: AdminSupportListComponent;
  let supportService: jest.Mocked<Partial<SupportAdminService>>;
  let snackBar: jest.Mocked<Partial<MatSnackBar>>;
  let mockRouter: jest.Mocked<Partial<Router>>;

  beforeEach(() => {
    supportService = { list: jest.fn().mockReturnValue(of(mockListResp)) };
    snackBar = { open: jest.fn() };
    mockRouter = { navigate: jest.fn() };

    TestBed.configureTestingModule({
      declarations: [AdminSupportListComponent],
      imports: [ReactiveFormsModule],
      providers: [
        { provide: SupportAdminService, useValue: supportService },
        { provide: MatSnackBar, useValue: snackBar },
        { provide: Router, useValue: mockRouter },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });
    const fixture = TestBed.createComponent(AdminSupportListComponent);
    component = fixture.componentInstance;
  });

  it('creates the component', () => expect(component).toBeTruthy());

  it('ngOnInit() loads tickets', fakeAsync(() => {
    component.ngOnInit();
    tick();
    expect(supportService.list).toHaveBeenCalled();
    expect(component.tickets).toHaveLength(1);
    expect(component.total).toBe(1);
    expect(component.loading).toBe(false);
  }));

  it('loadTickets() shows error snackbar on failure', fakeAsync(() => {
    (supportService.list as jest.Mock).mockReturnValue(throwError(() => new Error()));
    component.loadTickets();
    tick();
    expect(snackBar.open).toHaveBeenCalledWith('Failed to load tickets', 'OK', expect.any(Object));
    expect(component.loading).toBe(false);
  }));

  it('currentStatus returns correct status for selected tab', () => {
    component.selectedTab = 1;
    expect(component.currentStatus).toBe('open');
    component.selectedTab = 2;
    expect(component.currentStatus).toBe('in_progress');
  });

  it('onTabChange() updates tab and reloads', () => {
    component.onTabChange(3);
    expect(component.selectedTab).toBe(3);
    expect(supportService.list).toHaveBeenCalled();
  });

  it('onPage() updates pagination and reloads', () => {
    component.onPage({ pageIndex: 1, pageSize: 10, length: 30 } as any);
    expect(component.page).toBe(1);
    expect(component.limit).toBe(10);
  });

  it('viewTicket() navigates to /support/:id', () => {
    component.viewTicket('t1');
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/support', 't1']);
  });

  it('priorityClass() returns correct chip class', () => {
    expect(component.priorityClass('urgent')).toBe('chip-rejected');
    expect(component.priorityClass('high')).toBe('chip-suspended');
    expect(component.priorityClass('low')).toBe('chip-active');
    expect(component.priorityClass('unknown')).toBe('');
  });

  it('statusClass() returns correct chip class', () => {
    expect(component.statusClass('open')).toBe('chip-pending');
    expect(component.statusClass('in_progress')).toBe('chip-confirmed');
    expect(component.statusClass('resolved')).toBe('chip-active');
    expect(component.statusClass('closed')).toBe('chip-suspended');
  });
});
