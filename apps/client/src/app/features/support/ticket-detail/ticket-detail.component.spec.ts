import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of, throwError } from 'rxjs';
import { TicketDetailComponent } from './ticket-detail.component';
import { SupportService } from '../../../core/services/support.service';

const mockTicket = { _id: 't1', status: 'open', subject: 'Help', body: 'Broken', messages: [] } as any;

describe('TicketDetailComponent', () => {
  let component: TicketDetailComponent;
  let supportService: jest.Mocked<Partial<SupportService>>;
  let snackBar: jest.Mocked<Partial<MatSnackBar>>;
  let router: Router;

  beforeEach(() => {
    supportService = {
      getTicket: jest.fn().mockReturnValue(of(mockTicket)),
      reply: jest.fn(),
      closeTicket: jest.fn(),
      reopenTicket: jest.fn(),
    };
    snackBar = { open: jest.fn() };

    const mockRouter = { navigate: jest.fn() };

    TestBed.configureTestingModule({
      declarations: [TicketDetailComponent],
      imports: [ReactiveFormsModule, FormsModule],
      providers: [
        { provide: SupportService, useValue: supportService },
        { provide: MatSnackBar, useValue: snackBar },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: (_key: string) => 't1' } } } },
        { provide: Router, useValue: mockRouter },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });
    const fixture = TestBed.createComponent(TicketDetailComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router) as unknown as Router;
  });

  it('creates the component', () => expect(component).toBeTruthy());

  it('ngOnInit() loads ticket', () => {
    component.ngOnInit();
    expect(supportService.getTicket).toHaveBeenCalledWith('t1');
    expect(component.ticket()).toMatchObject({ _id: 't1' });
  });

  it('loadTicket() navigates away on error', fakeAsync(() => {
    (supportService.getTicket as jest.Mock).mockReturnValue(throwError(() => new Error()));
    component.loadTicket('t1');
    tick();
    expect(router.navigate).toHaveBeenCalledWith(['/support']);
  }));

  it('sendReply() does nothing when replyCtrl is invalid', () => {
    component.ticket.set(mockTicket);
    component.sendReply();
    expect(supportService.reply).not.toHaveBeenCalled();
  });

  it('sendReply() calls service and reloads on success', fakeAsync(() => {
    (supportService.reply as jest.Mock).mockReturnValue(of({}));
    component.ticket.set(mockTicket);
    component.replyCtrl.setValue('This is a valid reply message');
    component.sendReply();
    tick();
    expect(supportService.reply).toHaveBeenCalledWith('t1', 'This is a valid reply message');
    expect(snackBar.open).toHaveBeenCalledWith('Reply sent', 'Close', expect.any(Object));
  }));

  it('isOpen() returns true for open/in_progress tickets', () => {
    component.ticket.set({ ...mockTicket, status: 'open' });
    expect(component.isOpen()).toBe(true);
    component.ticket.set({ ...mockTicket, status: 'in_progress' });
    expect(component.isOpen()).toBe(true);
  });

  it('isClosed() returns true for closed tickets', () => {
    component.ticket.set({ ...mockTicket, status: 'closed' });
    expect(component.isClosed()).toBe(true);
    component.ticket.set(mockTicket);
    expect(component.isClosed()).toBe(false);
  });

  it('closeTicket() calls service and reloads on success', fakeAsync(() => {
    (supportService.closeTicket as jest.Mock).mockReturnValue(of({}));
    component.ticket.set(mockTicket);
    component.closeTicket();
    tick();
    expect(snackBar.open).toHaveBeenCalledWith('Ticket closed', 'Close', expect.any(Object));
  }));

  it('reopenTicket() calls service and reloads on success', fakeAsync(() => {
    (supportService.reopenTicket as jest.Mock).mockReturnValue(of({}));
    component.ticket.set(mockTicket);
    component.reopenTicket();
    tick();
    expect(snackBar.open).toHaveBeenCalledWith('Ticket reopened', 'Close', expect.any(Object));
  }));

  it('getStatusClass() returns correct CSS class', () => {
    expect(component.getStatusClass('open')).toBe('status-pending');
    expect(component.getStatusClass('closed')).toBe('status-cancelled');
  });
});
