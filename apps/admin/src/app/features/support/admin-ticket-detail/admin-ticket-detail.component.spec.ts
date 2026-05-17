import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of, throwError } from 'rxjs';
import { AdminTicketDetailComponent } from './admin-ticket-detail.component';
import { SupportAdminService } from '../../../core/services/support-admin.service';
import { SubAdminService } from '../../../core/services/sub-admin.service';

const mockTicket = { _id: 't1', status: 'open', subject: 'Help', assigneeId: 'sa1' };
const mockGetResp = { data: mockTicket };

describe('AdminTicketDetailComponent', () => {
  let component: AdminTicketDetailComponent;
  let supportService: jest.Mocked<Partial<SupportAdminService>>;
  let subAdminService: jest.Mocked<Partial<SubAdminService>>;
  let snackBar: jest.Mocked<Partial<MatSnackBar>>;

  beforeEach(() => {
    supportService = {
      get: jest.fn().mockReturnValue(of(mockGetResp)),
      assign: jest.fn(),
      updateStatus: jest.fn(),
      reply: jest.fn(),
    };
    subAdminService = {
      listSubAdmins: jest.fn().mockReturnValue(of({ data: [{ _id: 'sa1', name: 'Admin' }] })),
    };
    snackBar = { open: jest.fn() };

    TestBed.configureTestingModule({
      declarations: [AdminTicketDetailComponent],
      imports: [ReactiveFormsModule],
      providers: [
        { provide: SupportAdminService, useValue: supportService },
        { provide: SubAdminService, useValue: subAdminService },
        { provide: MatSnackBar, useValue: snackBar },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 't1' } } } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });
    component = TestBed.createComponent(AdminTicketDetailComponent).componentInstance;
  });

  it('creates the component', () => expect(component).toBeTruthy());

  it('ngOnInit() loads ticket and sub-admins', fakeAsync(() => {
    component.ngOnInit();
    tick();
    expect(supportService.get).toHaveBeenCalledWith('t1');
    expect(subAdminService.listSubAdmins).toHaveBeenCalled();
    expect(component.ticket).toMatchObject({ _id: 't1' });
    expect(component.subAdmins).toHaveLength(1);
  }));

  it('loadTicket() sets controls from ticket data', fakeAsync(() => {
    component.ticketId = 't1';
    component.loadTicket();
    tick();
    expect(component.statusControl.value).toBe('open');
    expect(component.assigneeControl.value).toBe('sa1');
    expect(component.loading).toBe(false);
  }));

  it('loadTicket() shows error snackbar on failure', fakeAsync(() => {
    (supportService.get as jest.Mock).mockReturnValue(throwError(() => new Error()));
    component.ticketId = 't1';
    component.loadTicket();
    tick();
    expect(snackBar.open).toHaveBeenCalledWith('Failed to load ticket', 'OK', expect.any(Object));
  }));

  it('assign() does nothing when no assignee selected', fakeAsync(() => {
    component.ticketId = 't1';
    component.assigneeControl.setValue('');
    component.assign();
    expect(supportService.assign).not.toHaveBeenCalled();
  }));

  it('assign() calls service and reloads on success', fakeAsync(() => {
    (supportService.assign as jest.Mock).mockReturnValue(of({}));
    component.ticketId = 't1';
    component.assigneeControl.setValue('sa2');
    component.assign();
    tick();
    expect(supportService.assign).toHaveBeenCalledWith('t1', 'sa2');
    expect(snackBar.open).toHaveBeenCalledWith('Assigned', 'OK', expect.any(Object));
  }));

  it('updateStatus() does nothing when no status', fakeAsync(() => {
    component.ticketId = 't1';
    component.statusControl.setValue('');
    component.updateStatus();
    expect(supportService.updateStatus).not.toHaveBeenCalled();
  }));

  it('updateStatus() calls service on success', fakeAsync(() => {
    (supportService.updateStatus as jest.Mock).mockReturnValue(of({}));
    component.ticketId = 't1';
    component.statusControl.setValue('resolved');
    component.updateStatus();
    tick();
    expect(snackBar.open).toHaveBeenCalledWith('Status updated', 'OK', expect.any(Object));
  }));

  it('sendReply() does nothing when reply is empty', fakeAsync(() => {
    component.ticketId = 't1';
    component.replyControl.setValue('');
    component.sendReply();
    expect(supportService.reply).not.toHaveBeenCalled();
  }));

  it('sendReply() calls service and clears control on success', fakeAsync(() => {
    (supportService.reply as jest.Mock).mockReturnValue(of({}));
    component.ticketId = 't1';
    component.replyControl.setValue('Here is the answer');
    component.sendReply();
    tick();
    expect(supportService.reply).toHaveBeenCalledWith('t1', 'Here is the answer');
    expect(component.replyControl.value).toBe('');
    expect(snackBar.open).toHaveBeenCalledWith('Reply sent', 'OK', expect.any(Object));
  }));

  it('priorityClass() and statusClass() return correct values', () => {
    expect(component.priorityClass('urgent')).toBe('chip-rejected');
    expect(component.statusClass('open')).toBe('chip-pending');
    expect(component.statusClass('unknown')).toBe('');
  });
});
