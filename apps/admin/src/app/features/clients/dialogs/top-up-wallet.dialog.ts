import { Component, Inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

@Component({
  standalone: false,
  selector: 'app-top-up-wallet-dialog',
  template: `
    <h2 mat-dialog-title>Top Up Wallet</h2>
    <mat-dialog-content>
      <form [formGroup]="form">
        <mat-form-field class="full-width" style="margin-bottom:16px">
          <mat-label>Amount (AED)</mat-label>
          <input matInput type="number" formControlName="amount" min="1" step="1">
          <mat-error *ngIf="form.get('amount')?.hasError('required')">Required</mat-error>
          <mat-error *ngIf="form.get('amount')?.hasError('min')">Must be at least 1 AED</mat-error>
        </mat-form-field>
        <mat-form-field class="full-width">
          <mat-label>Description</mat-label>
          <input matInput formControlName="description">
          <mat-error *ngIf="form.get('description')?.hasError('required')">Required</mat-error>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" (click)="confirm()" [disabled]="form.invalid">Top Up</button>
    </mat-dialog-actions>
  `,
})
export class TopUpWalletDialog {
  form: FormGroup;
  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<TopUpWalletDialog>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    this.form = this.fb.group({
      amount: [null, [Validators.required, Validators.min(1)]],
      description: ['Manual top-up', Validators.required],
    });
  }
  confirm() {
    if (this.form.valid) {
      this.dialogRef.close({ amount: Math.round(this.form.value.amount * 100), description: this.form.value.description });
    }
  }
}
