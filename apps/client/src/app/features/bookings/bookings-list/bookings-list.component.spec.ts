import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of, throwError } from 'rxjs';
import { BookingsListComponent } from './bookings-list.component';
import { BookingsService } from '../../../core/services/bookings.service';

const mockBookingsRes = {
  data: [
    { _id: 'b1', status: 'confirmed', createdAt: new Date().toISOString() } as any,
    { _id: 'b2', status: 'cancelled', createdAt: new Date().toISOString() } as any,
  ],
  total: 2,
};

describe('BookingsListComponent', () => {
  let component: BookingsListComponent;
  let bookingsService: jest.Mocked<Partial<BookingsService>>;
  let snackBar: jest.Mocked<Partial<MatSnackBar>>;
  let router: Router;

  beforeEach(() => {
    bookingsService = {
      listBookings: jest.fn().mockReturnValue(of(mockBookingsRes)),
      getVoucher: jest.fn(),
      cancelBooking: jest.fn(),
    };
    snackBar = { open: jest.fn() };

    TestBed.configureTestingModule({
      declarations: [BookingsListComponent],
      providers: [
        { provide: BookingsService, useValue: bookingsService },
        { provide: MatSnackBar, useValue: snackBar },
        provideRouter([]),
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });
    const fixture = TestBed.createComponent(BookingsListComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
  });

  it('creates the component', () => expect(component).toBeTruthy());

  it('ngOnInit() calls loadBookings()', () => {
    component.ngOnInit();
    expect(bookingsService.listBookings).toHaveBeenCalled();
  });

  it('loadBookings() sets bookings and total signals', () => {
    component.loadBookings();
    expect(component.bookings()).toHaveLength(2);
    expect(component.total()).toBe(2);
    expect(component.loading()).toBe(false);
  });

  it('loadBookings() passes status filter when tab is not "all"', () => {
    component.activeTab.set('confirmed');
    component.loadBookings();
    expect(bookingsService.listBookings).toHaveBeenCalledWith(expect.objectContaining({ status: 'confirmed' }));
  });

  it('loadBookings() shows snackbar on error', () => {
    (bookingsService.listBookings as jest.Mock).mockReturnValue(throwError(() => new Error('fail')));
    component.loadBookings();
    expect(snackBar.open).toHaveBeenCalledWith('Failed to load bookings', 'Close', expect.any(Object));
  });

  it('onTabChange() updates activeTab and reloads', () => {
    component.onTabChange('pending');
    expect(component.activeTab()).toBe('pending');
    expect(component.page()).toBe(0);
    expect(bookingsService.listBookings).toHaveBeenCalledTimes(1);
  });

  it('onPage() updates page/pageSize and reloads', () => {
    component.onPage({ pageIndex: 2, pageSize: 20, length: 100 });
    expect(component.page()).toBe(2);
    expect(component.pageSize()).toBe(20);
  });

  it('viewBooking() navigates to booking detail', () => {
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
    component.viewBooking('b1');
    expect(router.navigate).toHaveBeenCalledWith(['/bookings', 'b1']);
  });

  it('canCancel() returns true for confirmed/pending, false otherwise', () => {
    expect(component.canCancel('confirmed' as any)).toBe(true);
    expect(component.canCancel('pending' as any)).toBe(true);
    expect(component.canCancel('cancelled' as any)).toBe(false);
  });

  it('getStatusClass() returns correct CSS class', () => {
    expect(component.getStatusClass('confirmed')).toBe('status-confirmed');
  });

  it('cancelBooking() does nothing when user cancels confirm dialog', () => {
    jest.spyOn(window, 'confirm').mockReturnValue(false);
    const mockEvent = new MouseEvent('click');
    jest.spyOn(mockEvent, 'stopPropagation');
    component.cancelBooking('b1', mockEvent);
    expect(bookingsService.cancelBooking).not.toHaveBeenCalled();
  });

  it('cancelBooking() calls service and reloads on success', fakeAsync(() => {
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    (bookingsService.cancelBooking as jest.Mock).mockReturnValue(of({}));
    const mockEvent = new MouseEvent('click');
    component.cancelBooking('b1', mockEvent);
    tick();
    expect(bookingsService.cancelBooking).toHaveBeenCalledWith('b1', expect.any(Object));
    expect(snackBar.open).toHaveBeenCalledWith('Booking cancelled', 'Close', expect.any(Object));
  }));
});
