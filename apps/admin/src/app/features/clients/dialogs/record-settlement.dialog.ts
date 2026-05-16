import { Component, Inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

@Component({
  standalone: false,
  selector: 'app-record-settlement-dialog',
  template: `
    <h2 mat-dialog-title>Record Settlement</h2>
    <mat-dialog-content>
      <form [formGroup]="form">
        <mat-form-field class="full-width" style="margin-bottom:16px">
          <mat-label>Amount (AED)</mat-label>
          <input matInput type="number" formControlName="amount" min="1">
          <mat-error *ngIf="form.get('amount')?.hasError('required')">Required</mat-error>
        </mat-form-field>
        <mat-form-field class="full-width" style="margin-bottom:16px">
          <mat-label>Payment Mode</mat-label>
          <mat-select formControlName="mode">
            <mat-option value="bank_transfer">Bank Transfer</mat-option>
            <mat-option value="cash">Cash</mat-option>
            <mat-option value="cheque">Cheque</mat-option>
            <mat-option value="card">Card</mat-option>
            <mat-option value="other">Other</mat-option>
          </mat-select>
          <mat-error *ngIf="form.get('mode')?.hasError('required')">Required</mat-error>
        </mat-form-field>
        <mat-form-field class="full-width" style="margin-bottom:16px">
          <mat-label>Reference No</mat-label>
          <input matInput formControlName="referenceNo">
        </mat-form-field>
        <mat-form-field class="full-width">
          <mat-label>Notes</mat-label>
          <textarea matInput formControlName="notes" rows="3"></textarea>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" (click)="confirm()" [disabled]="form.invalid">Record</button>
    </mat-dialog-actions>
  `,
})
export class RecordSettlementDialog {
  form: FormGroup;
  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<RecordSettlementDialog>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    this.form = this.fb.group({
      amount: [null, [Validators.required, Validators.min(1)]],
      mode: ['bank_transfer', Validators.required],
      referenceNo: [''],
      notes: [''],
    });
  }
  confirm() {
    if (this.form.valid) {
      const v = this.form.value;
      this.dialogRef.close({ amount: Math.round(v.amount * 100), mode: v.mode, referenceNo: v.referenceNo, notes: v.notes });
    }
  }
}
