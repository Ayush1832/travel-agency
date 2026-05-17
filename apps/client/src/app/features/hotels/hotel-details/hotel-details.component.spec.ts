import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of, throwError } from 'rxjs';
import { HotelDetailsComponent } from './hotel-details.component';
import { HotelsService } from '../../../core/services/hotels.service';

const mockHotel = {
  _id: 'h1', name: 'Grand Hotel', images: ['img1.jpg', 'img2.jpg', 'img3.jpg'],
  rooms: [{ roomToken: 'rt1', price: 10000, currency: 'AED', roomType: 'Deluxe', mealPlan: 'BB', cancellationPolicy: 'Free' }],
} as any;

describe('HotelDetailsComponent', () => {
  let component: HotelDetailsComponent;
  let hotelsService: jest.Mocked<Partial<HotelsService>>;
  let snackBar: jest.Mocked<Partial<MatSnackBar>>;
  let mockRouter: jest.Mocked<Partial<Router>>;

  function setupComponent(searchId = 'SRCH-001') {
    hotelsService = {
      lastSearchId: jest.fn().mockReturnValue(searchId) as any,
      getDetails: jest.fn().mockReturnValue(of(mockHotel)),
      selectedRoom: { set: jest.fn() } as any,
      selectedHotelName: { set: jest.fn() } as any,
    };
    snackBar = { open: jest.fn() };
    mockRouter = { navigate: jest.fn() };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      declarations: [HotelDetailsComponent],
      providers: [
        { provide: HotelsService, useValue: hotelsService },
        { provide: MatSnackBar, useValue: snackBar },
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: (_: string) => 'h1' } } } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });
    component = TestBed.createComponent(HotelDetailsComponent).componentInstance;
  }

  beforeEach(() => setupComponent());

  it('creates the component', () => expect(component).toBeTruthy());

  it('ngOnInit() redirects to /hotels when no searchId', () => {
    setupComponent('');
    component.ngOnInit();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/hotels']);
    expect(hotelsService.getDetails).not.toHaveBeenCalled();
  });

  it('ngOnInit() loads hotel details when searchId is present', () => {
    component.ngOnInit();
    expect(hotelsService.getDetails).toHaveBeenCalledWith('h1', 'SRCH-001');
    expect(component.hotel()).toMatchObject({ name: 'Grand Hotel' });
  });

  it('ngOnInit() navigates away on getDetails error', fakeAsync(() => {
    (hotelsService.getDetails as jest.Mock).mockReturnValue(throwError(() => new Error()));
    component.ngOnInit();
    tick();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/hotels/results']);
  }));

  it('prevImage() wraps to last image', () => {
    component.hotel.set(mockHotel);
    component.currentImageIndex.set(0);
    component.prevImage();
    expect(component.currentImageIndex()).toBe(2);
  });

  it('nextImage() wraps to first image', () => {
    component.hotel.set(mockHotel);
    component.currentImageIndex.set(2);
    component.nextImage();
    expect(component.currentImageIndex()).toBe(0);
  });

  it('getStarArray() returns correct length array', () => {
    expect(component.getStarArray(5)).toHaveLength(5);
    expect(component.getStarArray(3)).toHaveLength(3);
    expect(component.getStarArray(0)).toHaveLength(0);
  });

  it('selectRoom() sets selectedRoom and navigates to checkout', () => {
    component.hotel.set(mockHotel);
    component.selectRoom(mockHotel.rooms[0]);
    expect(hotelsService.selectedRoom.set).toHaveBeenCalled();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/hotels/checkout']);
  });

  it('goBack() navigates to /hotels/results', () => {
    component.goBack();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/hotels/results']);
  });
});
