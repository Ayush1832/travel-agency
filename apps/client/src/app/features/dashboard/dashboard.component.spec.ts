import { TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { DashboardComponent } from './dashboard.component';
import { AuthService } from '../../core/services/auth.service';
import { WalletService } from '../../core/services/wallet.service';
import { BookingsService } from '../../core/services/bookings.service';

const mockBalance = { walletBalance: 50000, creditLimit: 100000, outstandingBalance: 20000, usedCredit: 20000, availableCredit: 130000, loyaltyPoints: 500, currency: 'AED' };
const mockBookingsRes = { data: [{ _id: 'b1', status: 'confirmed', createdAt: new Date().toISOString() } as any], total: 1 };

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let walletService: jest.Mocked<Partial<WalletService>>;
  let bookingsService: jest.Mocked<Partial<BookingsService>>;
  let authService: jest.Mocked<Partial<AuthService>>;
  let router: Router;

  beforeEach(() => {
    walletService = { getBalance: jest.fn().mockReturnValue(of(mockBalance)) };
    bookingsService = { listBookings: jest.fn().mockReturnValue(of(mockBookingsRes)) };
    authService = { currentUser: jest.fn().mockReturnValue(null) as any };

    TestBed.configureTestingModule({
      declarations: [DashboardComponent],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: WalletService, useValue: walletService },
        { provide: BookingsService, useValue: bookingsService },
        provideRouter([]),
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });
    const fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
  });

  it('creates the component', () => {
    expect(component).toBeTruthy();
  });

  it('ngOnInit() calls loadDashboardData()', () => {
    component.ngOnInit();
    expect(walletService.getBalance).toHaveBeenCalled();
    expect(bookingsService.listBookings).toHaveBeenCalled();
  });

  it('loadDashboardData() sets creditBalance signal', () => {
    component.loadDashboardData();
    expect(component.creditBalance()).toMatchObject({ walletBalance: 50000 });
  });

  it('loadDashboardData() sets recentBookings and totalBookings', () => {
    component.loadDashboardData();
    expect(component.totalBookings()).toBe(1);
    expect(component.recentBookings()).toHaveLength(1);
  });

  it('loadDashboardData() handles wallet error gracefully', () => {
    (walletService.getBalance as jest.Mock).mockReturnValue(throwError(() => new Error('fail')));
    expect(() => component.loadDashboardData()).not.toThrow();
    expect(component.loading()).toBe(false);
  });

  it('creditUsagePercent() returns correct percentage', () => {
    component.loadDashboardData();
    // usedCredit=20000, creditLimit+walletBalance=150000 → 13%
    expect(component.creditUsagePercent).toBe(13);
  });

  it('creditUsagePercent() returns 0 when creditBalance is null', () => {
    expect(component.creditUsagePercent).toBe(0);
  });

  it('navigateTo() calls router.navigate', () => {
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
    component.navigateTo('/bookings');
    expect(router.navigate).toHaveBeenCalledWith(['/bookings']);
  });

  it('getStatusClass() returns correct class string', () => {
    expect(component.getStatusClass('confirmed')).toBe('status-confirmed');
    expect(component.getStatusClass('cancelled')).toBe('status-cancelled');
  });
});
