import { TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { RedeemDialogComponent } from './redeem-dialog.component';

describe('RedeemDialogComponent', () => {
  let component: RedeemDialogComponent;
  let dialogRef: jest.Mocked<Partial<MatDialogRef<RedeemDialogComponent>>>;

  beforeEach(() => {
    dialogRef = { close: jest.fn() };

    TestBed.configureTestingModule({
      declarations: [RedeemDialogComponent],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: { points: 500 } },
        { provide: MatDialogRef, useValue: dialogRef },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });
    component = TestBed.createComponent(RedeemDialogComponent).componentInstance;
  });

  it('creates the component', () => expect(component).toBeTruthy());

  it('has available points from dialog data', () => {
    expect(component.data.points).toBe(500);
  });

  it('pointsCtrl starts invalid (null)', () => {
    expect(component.pointsCtrl.valid).toBe(false);
  });

  it('pointsCtrl is valid with value between 1 and max points', () => {
    component.pointsCtrl.setValue(100);
    expect(component.pointsCtrl.valid).toBe(true);
  });

  it('pointsCtrl is invalid when exceeding max points', () => {
    component.pointsCtrl.setValue(600);
    expect(component.pointsCtrl.valid).toBe(false);
    expect(component.pointsCtrl.hasError('max')).toBe(true);
  });

  it('onCancel() closes dialog with null', () => {
    component.onCancel();
    expect(dialogRef.close).toHaveBeenCalledWith(null);
  });

  it('onConfirm() closes dialog with points value when valid', () => {
    component.pointsCtrl.setValue(200);
    component.onConfirm();
    expect(dialogRef.close).toHaveBeenCalledWith(200);
  });

  it('onConfirm() does nothing when form is invalid', () => {
    component.onConfirm();
    expect(dialogRef.close).not.toHaveBeenCalled();
  });
});
