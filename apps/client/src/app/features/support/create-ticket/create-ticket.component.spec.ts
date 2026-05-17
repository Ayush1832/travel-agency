import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of, throwError } from 'rxjs';
import { CreateTicketComponent } from './create-ticket.component';
import { SupportService } from '../../../core/services/support.service';

const VALID_FORM = {
  subject: 'Help with booking',
  category: 'booking',
  priority: 'medium',
  bookingRef: '',
  message: 'I need help with my booking reference BK-2026-001 as it shows incorrect dates.',
};

describe('CreateTicketComponent', () => {
  let component: CreateTicketComponent;
  let supportService: jest.Mocked<Partial<SupportService>>;
  let snackBar: jest.Mocked<Partial<MatSnackBar>>;
  let mockRouter: jest.Mocked<Partial<Router>>;

  beforeEach(() => {
    supportService = { createTicket: jest.fn() };
    snackBar = { open: jest.fn() };
    mockRouter = { navigate: jest.fn() };

    TestBed.configureTestingModule({
      declarations: [CreateTicketComponent],
      imports: [ReactiveFormsModule],
      providers: [
        { provide: SupportService, useValue: supportService },
        { provide: MatSnackBar, useValue: snackBar },
        { provide: Router, useValue: mockRouter },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });
    const fixture = TestBed.createComponent(CreateTicketComponent);
    component = fixture.componentInstance;
    component.ngOnInit();
  });

  it('creates the component', () => expect(component).toBeTruthy());

  it('ngOnInit() creates form with defaults', () => {
    expect(component.form.get('category')?.value).toBe('booking');
    expect(component.form.get('priority')?.value).toBe('medium');
  });

  it('has predefined categories and priorities', () => {
    expect(component.categories).toHaveLength(5);
    expect(component.priorities).toHaveLength(4);
  });

  it('onSubmit() marks all touched when form is invalid', () => {
    component.onSubmit();
    expect(supportService.createTicket).not.toHaveBeenCalled();
    expect(component.form.get('subject')?.touched).toBe(true);
  });

  it('onSubmit() creates ticket on valid form', fakeAsync(() => {
    (supportService.createTicket as jest.Mock).mockReturnValue(of({ _id: 't1' } as any));
    component.form.setValue(VALID_FORM);
    component.onSubmit();
    tick();
    expect(supportService.createTicket).toHaveBeenCalled();
    expect(snackBar.open).toHaveBeenCalledWith('Ticket created successfully', 'Close', expect.any(Object));
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/support']);
  }));

  it('onSubmit() shows error on failure', fakeAsync(() => {
    (supportService.createTicket as jest.Mock).mockReturnValue(throwError(() => ({ error: { message: 'Server error' } })));
    component.form.setValue(VALID_FORM);
    component.onSubmit();
    tick();
    expect(snackBar.open).toHaveBeenCalledWith('Server error', 'Close', expect.any(Object));
  }));

  it('goBack() navigates to /support', () => {
    component.goBack();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/support']);
  });
});
