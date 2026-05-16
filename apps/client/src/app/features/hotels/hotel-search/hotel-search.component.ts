import { Component, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError } from 'rxjs/operators';
import { HotelsService, DestinationSuggestion } from '../../../core/services/hotels.service';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  standalone: false,
  selector: 'app-hotel-search',
  templateUrl: './hotel-search.component.html',
  styleUrls: ['./hotel-search.component.scss'],
})
export class HotelSearchComponent implements OnInit {
  form!: FormGroup;
  suggestions$: Observable<DestinationSuggestion[]> = of([]);
  searching = signal(false);
  today = new Date();

  constructor(
    private fb: FormBuilder,
    private hotelsService: HotelsService,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit() {
    this.form = this.fb.group({
      destination: [null, Validators.required],
      checkIn: [null, Validators.required],
      checkOut: [null, Validators.required],
      rooms: this.fb.array([this.createRoom()]),
      nationality: ['AE', Validators.required],
      currency: ['AED', Validators.required],
    });

    this.suggestions$ = this.form.get('destination')!.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((val) => {
        if (typeof val === 'string' && val.length >= 2) {
          return this.hotelsService.autocomplete(val).pipe(catchError(() => of([])));
        }
        return of([]);
      }),
    );
  }

  get rooms(): FormArray {
    return this.form.get('rooms') as FormArray;
  }

  createRoom(): FormGroup {
    return this.fb.group({
      adults: [2, [Validators.required, Validators.min(1), Validators.max(4)]],
      children: [0, [Validators.min(0), Validators.max(4)]],
    });
  }

  addRoom() {
    if (this.rooms.length < 5) {
      this.rooms.push(this.createRoom());
    }
  }

  removeRoom(i: number) {
    if (this.rooms.length > 1) {
      this.rooms.removeAt(i);
    }
  }

  displayFn(suggestion: DestinationSuggestion | string): string {
    if (typeof suggestion === 'string') return suggestion;
    return suggestion ? `${suggestion.cityName}, ${suggestion.country}` : '';
  }

  get minCheckOut(): Date {
    const checkIn = this.form.get('checkIn')?.value;
    if (checkIn) {
      const d = new Date(checkIn);
      d.setDate(d.getDate() + 1);
      return d;
    }
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  }

  onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const val = this.form.value;
    const dest = val.destination as DestinationSuggestion;

    if (!dest || typeof dest === 'string') {
      this.snackBar.open('Please select a destination from the list', 'Close', { duration: 3000 });
      return;
    }

    const checkIn = new Date(val.checkIn);
    const checkOut = new Date(val.checkOut);

    const dto = {
      destination: dest.cityName,
      cityCode: dest.cityCode,
      checkIn: checkIn.toISOString().split('T')[0],
      checkOut: checkOut.toISOString().split('T')[0],
      rooms: val.rooms,
      nationality: val.nationality,
      currency: val.currency,
    };

    this.hotelsService.lastSearchDto.set(dto);
    this.searching.set(true);

    this.hotelsService.search(dto).subscribe({
      next: () => {
        this.searching.set(false);
        this.router.navigate(['/hotels/results']);
      },
      error: (err) => {
        this.searching.set(false);
        const msg = err?.error?.message || 'Search failed. Please try again.';
        this.snackBar.open(msg, 'Close', { duration: 5000 });
      },
    });
  }
}
