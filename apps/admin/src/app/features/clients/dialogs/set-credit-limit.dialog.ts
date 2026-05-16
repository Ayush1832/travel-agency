import { Component, Inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

@Component({
  standalone: false,
  selector: 'app-set-credit-limit-dialog',
  template: `
    <h2 mat-dialog-title>Set Credit Limit</h2>
    <mat-dialog-content>
      <p>Current limit: <strong>{{ data.currentLimit / 100 | number:'1.2-2' }} AED</strong></p>
      <form [formGroup]="form">
        <mat-form-field class="full-width">
          <mat-label>New Credit Limit (AED)</mat-label>
          <input matInput type="number" formControlName="amount" min="0" step="100">
          <mat-hint>Enter amount in AED</mat-hint>
          <mat-error *ngIf="form.get('amount')?.hasError('required')">Required</mat-error>
          <mat-error *ngIf="form.get('amount')?.hasError('min')">Must be 0 or more</mat-error>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" (click)="confirm()" [disabled]="form.invalid">Confirm</button>
    </mat-dialog-actions>
  `,
})
export class SetCreditLimitDialog {
  form: FormGroup;
  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<SetCreditLimitDialog>,
    @Inject(MAT_DIALOG_DATA) public data: { currentLimit: number }
  ) {
    this.form = this.fb.group({ amount: [data.currentLimit / 100, [Validators.required, Validators.min(0)]] });
  }
  confirm() {
    if (this.form.valid) {
      this.dialogRef.close(Math.round(this.form.value.amount * 100));
    }
  }
}
