import { Component, OnInit, signal, computed } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { HotelsService } from '../../../core/services/hotels.service';
import { WalletService } from '../../../core/services/wallet.service';
import { BookingsService } from '../../../core/services/bookings.service';
import { CreditBalance } from '../../../core/models/wallet.models';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

@Component({
  standalone: false,
  selector: 'app-booking-checkout',
  templateUrl: './booking-checkout.component.html',
  styleUrls: ['./booking-checkout.component.scss'],
})
export class BookingCheckoutComponent implements OnInit {
  form!: FormGroup;
  creditBalance = signal<CreditBalance | null>(null);
  loading = signal(false);
  submitting = signal(false);

  selectedRoom = this.hotelsService.selectedRoom;
  hotelName = this.hotelsService.selectedHotelName;
  searchDto = this.hotelsService.lastSearchDto;

  canPayWithCredit = computed(() => {
    const b = this.creditBalance();
    const room = this.selectedRoom();
    if (!b || !room) return true;
    return b.availableCredit >= room.price;
  });

  nights = computed(() => {
    const dto = this.searchDto();
    if (!dto) return 1;
    const checkIn = new Date(dto.checkIn);
    const checkOut = new Date(dto.checkOut);
    return Math.max(1, Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)));
  });

  totalAmount = computed(() => {
    const room = this.selectedRoom();
    if (!room) return 0;
    return room.price * this.nights();
  });

  titles = ['Mr', 'Mrs', 'Ms', 'Dr'];

  constructor(
    private fb: FormBuilder,
    private hotelsService: HotelsService,
    private walletService: WalletService,
    private bookingsService: BookingsService,
    private router: Router,
    private snackBar: MatSnackBar,
    private http: HttpClient,
  ) {}

  ngOnInit() {
    if (!this.selectedRoom()) {
      this.router.navigate(['/hotels']);
      return;
    }

    this.form = this.fb.group({
      guests: this.fb.array([this.createGuest(true)]),
      paymentMethod: ['credit', Validators.required],
      specialRequests: [''],
      policyAcknowledged: [false, Validators.requiredTrue],
    });

    this.walletService.getBalance().subscribe({
      next: (b) => this.creditBalance.set(b),
      error: () => {},
    });
  }

  get guestsArray(): FormArray {
    return this.form.get('guests') as FormArray;
  }

  createGuest(isLead = false): FormGroup {
    return this.fb.group({
      title: ['Mr', Validators.required],
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      isLead: [isLead],
    });
  }

  onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const val = this.form.value;
    const room = this.selectedRoom()!;
    const searchId = this.hotelsService.lastSearchId();

    if (val.paymentMethod === 'credit' && !this.canPayWithCredit()) {
      this.snackBar.open('Insufficient credit balance', 'Close', { duration: 3000 });
      return;
    }

    this.submitting.set(true);

    const dto = {
      roomToken: room.roomToken,
      searchId,
      guests: val.guests,
      specialRequests: val.specialRequests,
      paymentMethod: val.paymentMethod,
    };

    if (val.paymentMethod === 'credit') {
      this.bookingsService.createBooking(dto).subscribe({
        next: () => {
          this.submitting.set(false);
          this.snackBar.open('Booking confirmed!', 'Close', { duration: 3000 });
          this.router.navigate(['/bookings']);
        },
        error: (err) => {
          this.submitting.set(false);
          const msg = err?.error?.message || 'Booking failed. Please try again.';
          this.snackBar.open(msg, 'Close', { duration: 5000 });
        },
      });
    } else {
      this.http
        .post<{ data: { paymentUrl: string } }>(`${environment.apiUrl}/payments/create-order`, {
          roomToken: room.roomToken,
          searchId,
          guests: val.guests,
          specialRequests: val.specialRequests,
        })
        .subscribe({
          next: (res) => {
            this.submitting.set(false);
            window.location.href = res.data.paymentUrl;
          },
          error: (err) => {
            this.submitting.set(false);
            const msg = err?.error?.message || 'Payment initiation failed.';
            this.snackBar.open(msg, 'Close', { duration: 5000 });
          },
        });
    }
  }
}
