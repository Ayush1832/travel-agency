import { TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ConfirmActionDialog } from './confirm-action.dialog';

describe('ConfirmActionDialog', () => {
  let component: ConfirmActionDialog;
  let dialogRef: jest.Mocked<Partial<MatDialogRef<ConfirmActionDialog>>>;

  function setup(data: any) {
    dialogRef = { close: jest.fn() };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      declarations: [ConfirmActionDialog],
      imports: [ReactiveFormsModule],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: dialogRef },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });
    component = TestBed.createComponent(ConfirmActionDialog).componentInstance;
  }

  beforeEach(() => setup({ title: 'Test', message: 'Are you sure?', requireReason: false }));

  it('creates the component', () => expect(component).toBeTruthy());

  it('confirm() closes with true when requireReason is false', () => {
    component.confirm();
    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it('confirm() closes with reason value when requireReason is true', () => {
    setup({ title: 'Suspend', message: 'Reason?', requireReason: true });
    component.reasonControl.setValue('Policy violation');
    component.confirm();
    expect(dialogRef.close).toHaveBeenCalledWith('Policy violation');
  });

  it('data is accessible in component', () => {
    expect(component.data.message).toBe('Are you sure?');
  });
});
