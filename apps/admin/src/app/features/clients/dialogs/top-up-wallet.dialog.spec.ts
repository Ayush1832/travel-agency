import { TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TopUpWalletDialog } from './top-up-wallet.dialog';

describe('TopUpWalletDialog', () => {
  let component: TopUpWalletDialog;
  let dialogRef: jest.Mocked<Partial<MatDialogRef<TopUpWalletDialog>>>;

  beforeEach(() => {
    dialogRef = { close: jest.fn() };

    TestBed.configureTestingModule({
      declarations: [TopUpWalletDialog],
      imports: [ReactiveFormsModule],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: {} },
        { provide: MatDialogRef, useValue: dialogRef },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });
    component = TestBed.createComponent(TopUpWalletDialog).componentInstance;
  });

  it('creates the component', () => expect(component).toBeTruthy());

  it('form defaults description to "Manual top-up"', () => {
    expect(component.form.get('description')?.value).toBe('Manual top-up');
  });

  it('form is invalid when amount is missing', () => {
    expect(component.form.valid).toBe(false);
  });

  it('confirm() does nothing when form is invalid', () => {
    component.confirm();
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('confirm() closes with amount in fils and description', () => {
    component.form.setValue({ amount: 1000, description: 'Test credit' });
    component.confirm();
    expect(dialogRef.close).toHaveBeenCalledWith({ amount: 100000, description: 'Test credit' });
  });
});
