import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { FormControl } from '@angular/forms';

export interface CancelDialogData {
  bookingRef: string;
  cancellationFee: number;
  refundAmount: number;
  currency: string;
}

@Component({
  standalone: false,
  selector: 'app-cancel-dialog',
  template: `
    <h2 mat-dialog-title>Cancel Booking</h2>
    <mat-dialog-content>
      <p class="booking-ref">Booking: <strong>{{ data.bookingRef }}</strong></p>
      <div class="fee-row">
        <span>Cancellation Fee:</span>
        <strong class="fee">{{ data.cancellationFee | number:'1.2-2' }} {{ data.currency }}</strong>
      </div>
      <div class="fee-row">
        <span>Refund Amount:</span>
        <strong class="refund">{{ data.refundAmount | number:'1.2-2' }} {{ data.currency }}</strong>
      </div>
      <mat-form-field appearance="outline" class="full-width reason-field">
        <mat-label>Cancellation Reason (optional)</mat-label>
        <textarea matInput [formControl]="reasonCtrl" rows="3"></textarea>
      </mat-form-field>
      <p class="warning">This action cannot be undone. Are you sure you want to cancel this booking?</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-stroked-button (click)="onDismiss()">Keep Booking</button>
      <button mat-raised-button color="warn" (click)="onConfirm()">Yes, Cancel</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .booking-ref { margin-bottom: 12px; }
    .fee-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
    .fee { color: #c62828; }
    .refund { color: #2e7d32; }
    .reason-field { margin-top: 16px; }
    .warning { color: #e65100; font-size: 13px; margin-top: 8px; }
  `],
})
export class CancelDialogComponent {
  reasonCtrl = new FormControl('');

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: CancelDialogData,
    private dialogRef: MatDialogRef<CancelDialogComponent>,
  ) {}

  onDismiss() {
    this.dialogRef.close(false);
  }

  onConfirm() {
    this.dialogRef.close({ reason: this.reasonCtrl.value });
  }
}
