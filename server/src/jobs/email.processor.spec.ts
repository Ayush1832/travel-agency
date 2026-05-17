import { Test, TestingModule } from '@nestjs/testing';
import { EmailProcessor } from './email.processor';
import { NotificationsService } from '../modules/notifications/notifications.service';
import { JOB_SEND_EMAIL } from './jobs.constants';

const mockNotifications = { directSendEmail: jest.fn() };

const makeJob = (data: Record<string, unknown>, name = JOB_SEND_EMAIL) =>
  ({ name, data, id: '1' }) as never;

describe('EmailProcessor', () => {
  let processor: EmailProcessor;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailProcessor,
        { provide: NotificationsService, useValue: mockNotifications },
      ],
    }).compile();

    processor = module.get<EmailProcessor>(EmailProcessor);
  });

  it('delegates to NotificationsService.directSendEmail for a valid job', async () => {
    mockNotifications.directSendEmail.mockResolvedValue(undefined);

    await processor.process(
      makeJob({ to: 'user@example.com', subject: 'Hello', html: '<p>Hello</p>' }),
    );

    expect(mockNotifications.directSendEmail).toHaveBeenCalledWith(
      'user@example.com',
      'Hello',
      '<p>Hello</p>',
    );
  });

  it('skips processing for unrecognised job names', async () => {
    await processor.process(makeJob({ to: 'x@example.com', subject: 'S', html: '<p/>' }, 'unknown_job'));
    expect(mockNotifications.directSendEmail).not.toHaveBeenCalled();
  });

  describe('CRLF injection prevention', () => {
    it('rejects a "to" address containing CR character', async () => {
      await processor.process(
        makeJob({ to: 'victim@example.com\rBcc: attacker@evil.com', subject: 'Hi', html: '' }),
      );
      expect(mockNotifications.directSendEmail).not.toHaveBeenCalled();
    });

    it('rejects a "to" address containing LF character', async () => {
      await processor.process(
        makeJob({ to: 'victim@example.com\nBcc: attacker@evil.com', subject: 'Hi', html: '' }),
      );
      expect(mockNotifications.directSendEmail).not.toHaveBeenCalled();
    });

    it('rejects a "to" address containing CRLF sequence', async () => {
      await processor.process(
        makeJob({ to: 'victim@example.com\r\nBcc: attacker@evil.com', subject: 'Hi', html: '' }),
      );
      expect(mockNotifications.directSendEmail).not.toHaveBeenCalled();
    });

    it('allows a clean address through', async () => {
      mockNotifications.directSendEmail.mockResolvedValue(undefined);

      await processor.process(
        makeJob({ to: 'clean@example.com', subject: 'Subject', html: '<p>OK</p>' }),
      );

      expect(mockNotifications.directSendEmail).toHaveBeenCalledWith(
        'clean@example.com',
        'Subject',
        '<p>OK</p>',
      );
    });
  });
});
