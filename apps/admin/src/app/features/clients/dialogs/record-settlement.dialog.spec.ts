import { TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { RecordSettlementDialog } from './record-settlement.dialog';

describe('RecordSettlementDialog', () => {
  let component: RecordSettlementDialog;
  let dialogRef: jest.Mocked<Partial<MatDialogRef<RecordSettlementDialog>>>;

  beforeEach(() => {
    dialogRef = { close: jest.fn() };

    TestBed.configureTestingModule({
      declarations: [RecordSettlementDialog],
      imports: [ReactiveFormsModule],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: {} },
        { provide: MatDialogRef, useValue: dialogRef },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });
    component = TestBed.createComponent(RecordSettlementDialog).componentInstance;
  });

  it('creates the component', () => expect(component).toBeTruthy());

  it('form is invalid when amount is missing', () => {
    expect(component.form.valid).toBe(false);
  });

  it('form defaults mode to bank_transfer', () => {
    expect(component.form.get('mode')?.value).toBe('bank_transfer');
  });

  it('confirm() does nothing when form is invalid', () => {
    component.confirm();
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('confirm() closes with settlement data (amount in fils)', () => {
    component.form.setValue({ amount: 500, mode: 'cash', referenceNo: 'REF-001', notes: 'test' });
    component.confirm();
    expect(dialogRef.close).toHaveBeenCalledWith({
      amount: 50000,
      mode: 'cash',
      referenceNo: 'REF-001',
      notes: 'test',
    });
  });
});
