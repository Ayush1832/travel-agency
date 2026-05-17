import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of, throwError } from 'rxjs';
import { AllBookingsListComponent } from './all-bookings-list.component';
import { AdminBookingsService } from '../../../core/services/admin-bookings.service';

const mockListResp = { data: { data: [{ _id: 'b1' }], total: 1 } };

describe('AllBookingsListComponent', () => {
  let component: AllBookingsListComponent;
  let bookingsService: jest.Mocked<Partial<AdminBookingsService>>;
  let snackBar: jest.Mocked<Partial<MatSnackBar>>;
  let mockRouter: jest.Mocked<Partial<Router>>;

  beforeEach(() => {
    bookingsService = {
      list: jest.fn().mockReturnValue(of(mockListResp)),
      exportCsv: jest.fn(),
      resync: jest.fn(),
    };
    snackBar = { open: jest.fn() };
    mockRouter = { navigate: jest.fn() };

    TestBed.configureTestingModule({
      declarations: [AllBookingsListComponent],
      imports: [ReactiveFormsModule],
      providers: [
        { provide: AdminBookingsService, useValue: bookingsService },
        { provide: MatSnackBar, useValue: snackBar },
        { provide: Router, useValue: mockRouter },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });
    const fixture = TestBed.createComponent(AllBookingsListComponent);
    component = fixture.componentInstance;
  });

  it('creates the component', () => expect(component).toBeTruthy());

  it('ngOnInit() loads bookings', fakeAsync(() => {
    component.ngOnInit();
    tick(500);
    expect(bookingsService.list).toHaveBeenCalled();
    expect(component.bookings).toHaveLength(1);
    expect(component.total).toBe(1);
    expect(component.loading).toBe(false);
  }));

  it('loadBookings() shows error snackbar on failure', fakeAsync(() => {
    (bookingsService.list as jest.Mock).mockReturnValue(throwError(() => new Error()));
    component.loadBookings();
    tick();
    expect(snackBar.open).toHaveBeenCalledWith('Failed to load bookings', 'OK', expect.any(Object));
    expect(component.loading).toBe(false);
  }));

  it('onPage() updates page and limit then reloads', () => {
    component.onPage({ pageIndex: 2, pageSize: 10, length: 50 } as any);
    expect(component.page).toBe(2);
    expect(component.limit).toBe(10);
    expect(bookingsService.list).toHaveBeenCalled();
  });

  it('viewBooking() navigates to /bookings/:id', () => {
    component.viewBooking('b1');
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/bookings', 'b1']);
  });

  it('exportCsv() triggers download on success', fakeAsync(() => {
    const mockBlob = new Blob(['csv,data'], { type: 'text/csv' });
    (bookingsService.exportCsv as jest.Mock).mockReturnValue(of(mockBlob));
    const createObjURL = jest.fn().mockReturnValue('blob:url');
    const revokeObjURL = jest.fn();
    Object.defineProperty(URL, 'createObjectURL', { value: createObjURL, writable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjURL, writable: true });
    component.exportCsv();
    tick();
    expect(createObjURL).toHaveBeenCalledWith(mockBlob);
  }));

  it('exportCsv() shows error snackbar on failure', fakeAsync(() => {
    (bookingsService.exportCsv as jest.Mock).mockReturnValue(throwError(() => new Error()));
    component.exportCsv();
    tick();
    expect(snackBar.open).toHaveBeenCalledWith('Export failed', 'OK', expect.any(Object));
  }));

  it('resync() calls service and shows snackbar on success', fakeAsync(() => {
    (bookingsService.resync as jest.Mock).mockReturnValue(of({}));
    const event = { stopPropagation: jest.fn() } as any;
    component.resync('b1', event);
    tick();
    expect(event.stopPropagation).toHaveBeenCalled();
    expect(snackBar.open).toHaveBeenCalledWith('Booking resynced', 'OK', expect.any(Object));
  }));

  it('formatAed() converts fils to AED string', () => {
    expect(component.formatAed(100000)).toContain('1,000');
  });

  it('statusClass() returns correct class', () => {
    expect(component.statusClass('confirmed')).toBe('chip-confirmed');
    expect(component.statusClass('pending')).toBe('chip-pending');
    expect(component.statusClass('unknown')).toBe('');
  });
});
