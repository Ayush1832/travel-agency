import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { FormControl, Validators } from '@angular/forms';

@Component({
  standalone: false,
  selector: 'app-redeem-dialog',
  template: `
    <h2 mat-dialog-title>Redeem Loyalty Points</h2>
    <mat-dialog-content>
      <p class="available">Available points: <strong>{{ data.points | number }}</strong></p>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Points to Redeem</mat-label>
        <input matInput type="number" [formControl]="pointsCtrl" [max]="data.points" min="1" />
        <mat-error *ngIf="pointsCtrl.hasError('required')">Required</mat-error>
        <mat-error *ngIf="pointsCtrl.hasError('max')">Cannot exceed available points</mat-error>
      </mat-form-field>
      <p class="value" *ngIf="pointsCtrl.value">
        AED equivalent: <strong>{{ (pointsCtrl.value * 0.01) | number:'1.2-2' }} AED</strong>
      </p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-stroked-button (click)="onCancel()">Cancel</button>
      <button mat-raised-button color="primary" (click)="onConfirm()" [disabled]="pointsCtrl.invalid">Redeem</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .available { margin-bottom: 12px; }
    .value { color: #2e7d32; margin-top: 8px; font-size: 14px; }
  `],
})
export class RedeemDialogComponent {
  pointsCtrl: FormControl;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { points: number },
    private dialogRef: MatDialogRef<RedeemDialogComponent>,
  ) {
    this.pointsCtrl = new FormControl(null, [
      Validators.required,
      Validators.min(1),
      Validators.max(data.points),
    ]);
  }

  onCancel() {
    this.dialogRef.close(null);
  }

  onConfirm() {
    if (this.pointsCtrl.valid) {
      this.dialogRef.close(this.pointsCtrl.value);
    }
  }
}
