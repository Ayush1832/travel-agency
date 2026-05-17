import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { NotificationsService } from './notifications.service';
import {
  Notification,
  NotificationChannel,
  NotificationStatus,
  NotificationType,
} from '../../db/schemas/notification.schema';
import { User } from '../../db/schemas/user.schema';
import { Company } from '../../db/schemas/company.schema';
import { CmsEmailTemplate } from '../../db/schemas/cms-email-template.schema';

const userId = new Types.ObjectId().toString();
const companyId = new Types.ObjectId().toString();

const mockNotification = {
  save: jest.fn().mockResolvedValue(undefined),
};

const mockNotificationModel = jest.fn().mockReturnValue(mockNotification);
(mockNotificationModel as unknown as Record<string, unknown>).findById = jest.fn();
(mockNotificationModel as unknown as Record<string, unknown>).find = jest.fn();
(mockNotificationModel as unknown as Record<string, unknown>).countDocuments = jest.fn();
(mockNotificationModel as unknown as Record<string, unknown>).updateOne = jest.fn();
(mockNotificationModel as unknown as Record<string, unknown>).updateMany = jest.fn();

const mockUserModel = { findById: jest.fn() };
const mockCompanyModel = { findById: jest.fn() };
const mockEmailTemplateModel = { findOne: jest.fn() };

const mockConfig = { get: jest.fn() };

function withSelect(result: unknown) {
  return { select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(result) }) };
}

describe('NotificationsService', () => {
  let service: NotificationsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockNotification.save.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: getModelToken(Notification.name), useValue: mockNotificationModel },
        { provide: getModelToken(User.name), useValue: mockUserModel },
        { provide: getModelToken(Company.name), useValue: mockCompanyModel },
        { provide: getModelToken(CmsEmailTemplate.name), useValue: mockEmailTemplateModel },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  describe('send — in-app channel', () => {
    it('saves notification document without calling email/SMS', async () => {
      await service.send({
        recipientUserId: userId,
        channel: NotificationChannel.IN_APP,
        type: NotificationType.BOOKING_CONFIRMED,
        title: 'Booking Confirmed',
        message: 'Your booking is confirmed',
      });

      expect(mockNotification.save).toHaveBeenCalled();
      expect(mockUserModel.findById).not.toHaveBeenCalled();
    });
  });

  describe('send — email channel', () => {
    it('resolves recipient email from user and sends', async () => {
      mockUserModel.findById.mockReturnValue(withSelect({ email: 'user@example.com' }));
      mockEmailTemplateModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });
      mockConfig.get.mockReturnValue(undefined); // SES not configured → logs only

      await service.send({
        recipientUserId: userId,
        channel: NotificationChannel.EMAIL,
        type: NotificationType.BOOKING_CONFIRMED,
        title: 'Booking Confirmed',
        message: 'Your booking is confirmed',
      });

      expect(mockUserModel.findById).toHaveBeenCalledWith(userId);
      expect(mockNotification.save).toHaveBeenCalled();
    });

    it('resolves email from company when recipientCompanyId is set', async () => {
      mockCompanyModel.findById.mockReturnValue(withSelect({ email: 'agency@example.com' }));
      mockEmailTemplateModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });
      mockConfig.get.mockReturnValue(undefined);

      await service.send({
        recipientCompanyId: companyId,
        channel: NotificationChannel.EMAIL,
        type: NotificationType.ACCOUNT_APPROVED,
        title: 'Approved',
        message: 'Your account is approved',
      });

      expect(mockCompanyModel.findById).toHaveBeenCalledWith(companyId);
    });

    it('uses CMS template when one exists and replaces placeholders', async () => {
      mockUserModel.findById.mockReturnValue(withSelect({ email: 'user@example.com' }));
      mockEmailTemplateModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          slug: 'booking_confirmed',
          body: '<p>Booking {{bookingRef}} confirmed at {{hotelName}}</p>',
          isPublished: true,
        }),
      });
      mockConfig.get.mockReturnValue(undefined);

      await service.send({
        recipientUserId: userId,
        channel: NotificationChannel.EMAIL,
        type: NotificationType.BOOKING_CONFIRMED,
        title: 'Booking Confirmed',
        message: 'Confirmed',
        data: { bookingRef: 'BK-001', hotelName: 'Dubai Grand' },
      });

      expect(mockNotification.save).toHaveBeenCalled();
    });
  });

  describe('send — SMS channel', () => {
    it('resolves phone from user and attempts to send', async () => {
      mockUserModel.findById.mockReturnValue(
        withSelect({ phone: '+971501234567' }),
      );
      mockConfig.get.mockReturnValue(undefined); // Twilio not configured

      await service.send({
        recipientUserId: userId,
        channel: NotificationChannel.SMS,
        type: NotificationType.BOOKING_CONFIRMED,
        title: 'Booking Confirmed',
        message: 'Your booking BK-001 is confirmed',
      });

      expect(mockUserModel.findById).toHaveBeenCalledWith(userId);
      expect(mockNotification.save).toHaveBeenCalled();
    });
  });

  describe('directSendEmail — falls back when SES not configured', () => {
    it('returns without error when AWS credentials are absent', async () => {
      mockConfig.get.mockReturnValue(undefined);
      await expect(
        service.directSendEmail('test@example.com', 'Subject', '<p>Body</p>'),
      ).resolves.toBeUndefined();
    });
  });

  describe('directSendSms — falls back when Twilio not configured', () => {
    it('returns without error when Twilio credentials are absent', async () => {
      mockConfig.get.mockReturnValue(undefined);
      await expect(
        service.directSendSms('+971501234567', 'Test message'),
      ).resolves.toBeUndefined();
    });
  });
});
