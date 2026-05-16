import { Component, Inject } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

export interface ConfirmActionData {
  title: string;
  message: string;
  requireReason?: boolean;
  reasonLabel?: string;
  confirmLabel?: string;
  confirmColor?: string;
}

@Component({
  standalone: false,
  selector: 'app-confirm-action-dialog',
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      <p>{{ data.message }}</p>
      <mat-form-field class="full-width" *ngIf="data.requireReason" style="margin-top:16px">
        <mat-label>{{ data.reasonLabel || 'Reason' }}</mat-label>
        <textarea matInput [formControl]="reasonControl" rows="3"></textarea>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button [color]="data.confirmColor || 'primary'"
              (click)="confirm()"
              [disabled]="data.requireReason && !reasonControl.value">
        {{ data.confirmLabel || 'Confirm' }}
      </button>
    </mat-dialog-actions>
  `,
})
export class ConfirmActionDialog {
  reasonControl = new FormControl('');
  constructor(
    private dialogRef: MatDialogRef<ConfirmActionDialog>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmActionData
  ) {}
  confirm() {
    this.dialogRef.close(this.data.requireReason ? this.reasonControl.value : true);
  }
}
