import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { LoyaltyService } from '../../core/services/loyalty.service';
import { LoyaltyRule } from '../../core/models/admin.models';

@Component({
  standalone: false,
  selector: 'app-loyalty-settings',
  templateUrl: './loyalty-settings.component.html',
  styleUrls: ['./loyalty-settings.component.scss'],
})
export class LoyaltySettingsComponent implements OnInit {
  rules: LoyaltyRule[] = [];
  activeRule: LoyaltyRule | null = null;
  form!: FormGroup;
  loading = false;
  saving = false;
  newHotelId = '';
  addingHotel = false;

  constructor(
    private fb: FormBuilder,
    private loyaltyService: LoyaltyService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit() {
    this.form = this.fb.group({
      name: ['', Validators.required],
      pointsPerAed: [1, [Validators.required, Validators.min(0)]],
      pointValueFils: [100, [Validators.required, Validators.min(1)]],
      minBookingAmountAed: [0, [Validators.required, Validators.min(0)]],
      expirationPeriodDays: [365, [Validators.required, Validators.min(0)]],
      isActive: [true],
    });
    this.loadRules();
  }

  loadRules() {
    this.loading = true;
    this.loyaltyService.list().subscribe({
      next: (res: any) => {
        this.rules = res.data ?? res ?? [];
        this.activeRule = this.rules.find(r => r.isActive) ?? this.rules[0] ?? null;
        if (this.activeRule) this.patchForm(this.activeRule);
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  patchForm(rule: LoyaltyRule) {
    this.form.patchValue({
      name: rule.name,
      pointsPerAed: rule.pointsPerAed,
      pointValueFils: rule.pointValueFils ?? 100,
      minBookingAmountAed: rule.minBookingAmountAed ?? 0,
      expirationPeriodDays: rule.expirationPeriodDays ?? 365,
      isActive: rule.isActive,
    });
  }

  get pointValueAed(): number {
    const fils = this.form.get('pointValueFils')?.value ?? 100;
    return fils / 100;
  }

  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving = true;
    const dto = this.form.value;

    if (this.activeRule?._id) {
      this.loyaltyService.update(this.activeRule._id, dto).subscribe({
        next: (updated) => {
          this.activeRule = { ...this.activeRule!, ...updated };
          this.snackBar.open('Loyalty rule updated', 'OK', { duration: 2000 });
          this.saving = false;
          this.loadRules();
        },
        error: () => { this.snackBar.open('Failed to save', 'OK', { duration: 2000 }); this.saving = false; }
      });
    } else {
      this.loyaltyService.create(dto).subscribe({
        next: () => {
          this.snackBar.open('Loyalty rule created', 'OK', { duration: 2000 });
          this.saving = false;
          this.loadRules();
        },
        error: () => { this.snackBar.open('Failed to create', 'OK', { duration: 2000 }); this.saving = false; }
      });
    }
  }

  addHotel() {
    const hotelId = this.newHotelId.trim();
    if (!hotelId || !this.activeRule?._id) return;
    this.addingHotel = true;
    this.loyaltyService.addEligibleHotel(this.activeRule._id, hotelId).subscribe({
      next: (updated) => {
        this.activeRule = updated;
        this.newHotelId = '';
        this.addingHotel = false;
        this.snackBar.open('Hotel added', 'OK', { duration: 2000 });
      },
      error: () => { this.addingHotel = false; this.snackBar.open('Failed to add hotel', 'OK', { duration: 2000 }); }
    });
  }

  removeHotel(hotelId: string) {
    if (!this.activeRule?._id) return;
    this.loyaltyService.removeEligibleHotel(this.activeRule._id, hotelId).subscribe({
      next: (updated) => {
        this.activeRule = updated;
        this.snackBar.open('Hotel removed', 'OK', { duration: 2000 });
      },
      error: () => this.snackBar.open('Failed to remove hotel', 'OK', { duration: 2000 })
    });
  }
}
