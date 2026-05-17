import { TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { SetCreditLimitDialog } from './set-credit-limit.dialog';

describe('SetCreditLimitDialog', () => {
  let component: SetCreditLimitDialog;
  let dialogRef: jest.Mocked<Partial<MatDialogRef<SetCreditLimitDialog>>>;

  beforeEach(() => {
    dialogRef = { close: jest.fn() };

    TestBed.configureTestingModule({
      declarations: [SetCreditLimitDialog],
      imports: [ReactiveFormsModule],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: { currentLimit: 100000 } },
        { provide: MatDialogRef, useValue: dialogRef },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });
    component = TestBed.createComponent(SetCreditLimitDialog).componentInstance;
  });

  it('creates the component', () => expect(component).toBeTruthy());

  it('form initializes with current limit in AED', () => {
    expect(component.form.get('amount')?.value).toBe(1000);
  });

  it('confirm() does nothing when form is invalid', () => {
    component.form.get('amount')?.setValue(-1);
    component.confirm();
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('confirm() closes with amount in fils', () => {
    component.form.get('amount')?.setValue(5000);
    component.confirm();
    expect(dialogRef.close).toHaveBeenCalledWith(500000);
  });
});
