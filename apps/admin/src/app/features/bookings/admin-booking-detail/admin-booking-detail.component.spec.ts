import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of, throwError } from 'rxjs';
import { AdminBookingDetailComponent } from './admin-booking-detail.component';
import { AdminBookingsService } from '../../../core/services/admin-bookings.service';

const mockBooking = { _id: 'b1', status: 'pending', totalAmount: 100000, bookingRef: 'BK-001' };
const mockGetResp = { data: mockBooking };

describe('AdminBookingDetailComponent', () => {
  let component: AdminBookingDetailComponent;
  let bookingsService: jest.Mocked<Partial<AdminBookingsService>>;
  let snackBar: jest.Mocked<Partial<MatSnackBar>>;

  beforeEach(() => {
    bookingsService = {
      get: jest.fn().mockReturnValue(of(mockGetResp)),
      updateStatus: jest.fn(),
      issueRefund: jest.fn(),
      resendVoucher: jest.fn(),
      resync: jest.fn(),
    };
    snackBar = { open: jest.fn() };

    TestBed.configureTestingModule({
      declarations: [AdminBookingDetailComponent],
      imports: [ReactiveFormsModule],
      providers: [
        { provide: AdminBookingsService, useValue: bookingsService },
        { provide: MatSnackBar, useValue: snackBar },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'b1' } } } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });
    const fixture = TestBed.createComponent(AdminBookingDetailComponent);
    component = fixture.componentInstance;
  });

  it('creates the component', () => expect(component).toBeTruthy());

  it('ngOnInit() loads booking and sets controls', fakeAsync(() => {
    component.ngOnInit();
    tick();
    expect(bookingsService.get).toHaveBeenCalledWith('b1');
    expect(component.booking).toMatchObject({ _id: 'b1' });
    expect(component.statusControl.value).toBe('pending');
    expect(component.refundAmount.value).toBe(1000);
  }));

  it('loadBooking() shows error snackbar on failure', fakeAsync(() => {
    (bookingsService.get as jest.Mock).mockReturnValue(throwError(() => new Error()));
    component.bookingId = 'b1';
    component.loadBooking();
    tick();
    expect(snackBar.open).toHaveBeenCalledWith('Failed to load booking', 'OK', expect.any(Object));
  }));

  it('updateStatus() does nothing when status unchanged', fakeAsync(() => {
    component.ngOnInit();
    tick();
    component.statusControl.setValue('pending');
    component.updateStatus();
    expect(bookingsService.updateStatus).not.toHaveBeenCalled();
  }));

  it('updateStatus() calls service and reloads on success', fakeAsync(() => {
    (bookingsService.updateStatus as jest.Mock).mockReturnValue(of({}));
    component.ngOnInit();
    tick();
    component.statusControl.setValue('confirmed');
    component.updateStatus();
    tick();
    expect(bookingsService.updateStatus).toHaveBeenCalledWith('b1', 'confirmed');
    expect(snackBar.open).toHaveBeenCalledWith('Status updated', 'OK', expect.any(Object));
  }));

  it('updateStatus() shows error on failure', fakeAsync(() => {
    (bookingsService.updateStatus as jest.Mock).mockReturnValue(throwError(() => new Error()));
    component.ngOnInit();
    tick();
    component.statusControl.setValue('confirmed');
    component.updateStatus();
    tick();
    expect(snackBar.open).toHaveBeenCalledWith('Failed to update status', 'OK', expect.any(Object));
  }));

  it('issueRefund() does nothing when amount is zero', fakeAsync(() => {
    component.ngOnInit();
    tick();
    component.refundAmount.setValue(0);
    component.issueRefund();
    expect(bookingsService.issueRefund).not.toHaveBeenCalled();
  }));

  it('issueRefund() calls service on success', fakeAsync(() => {
    (bookingsService.issueRefund as jest.Mock).mockReturnValue(of({}));
    component.ngOnInit();
    tick();
    component.refundAmount.setValue(500);
    component.issueRefund();
    tick();
    expect(bookingsService.issueRefund).toHaveBeenCalledWith('b1', 50000);
    expect(snackBar.open).toHaveBeenCalledWith('Refund issued', 'OK', expect.any(Object));
  }));

  it('cancelBooking() calls updateStatus with cancelled', fakeAsync(() => {
    (bookingsService.updateStatus as jest.Mock).mockReturnValue(of({}));
    component.bookingId = 'b1';
    component.cancelBooking();
    tick();
    expect(bookingsService.updateStatus).toHaveBeenCalledWith('b1', 'cancelled');
  }));

  it('resendVoucher() shows success snackbar', fakeAsync(() => {
    (bookingsService.resendVoucher as jest.Mock).mockReturnValue(of({ sentTo: 'a@b.com' }));
    component.bookingId = 'b1';
    component.resendVoucher();
    tick();
    expect(snackBar.open).toHaveBeenCalledWith('Voucher sent to a@b.com', 'OK', expect.any(Object));
  }));

  it('resync() calls service and reloads on success', fakeAsync(() => {
    (bookingsService.resync as jest.Mock).mockReturnValue(of({}));
    component.bookingId = 'b1';
    component.resync();
    tick();
    expect(snackBar.open).toHaveBeenCalledWith('Booking resynced with supplier', 'OK', expect.any(Object));
  }));

  it('formatAed() returns 0.00 for falsy value', () => {
    expect(component.formatAed(0)).toBe('0.00');
  });

  it('statusClass() returns correct class', () => {
    expect(component.statusClass('confirmed')).toBe('chip-confirmed');
    expect(component.statusClass('unknown')).toBe('');
  });
});
