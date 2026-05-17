import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { AdminService } from './admin.service';
import { Company, CompanyStatus } from '../../db/schemas/company.schema';
import { User } from '../../db/schemas/user.schema';
import { Role } from '../../db/schemas/role.schema';
import { Booking } from '../../db/schemas/booking.schema';
import { WalletTransaction } from '../../db/schemas/wallet-transaction.schema';
import { Settlement } from '../../db/schemas/settlement.schema';
import { ApiConfig } from '../../db/schemas/api-config.schema';
import { LoyaltyRule } from '../../db/schemas/loyalty-rule.schema';
import { Notification } from '../../db/schemas/notification.schema';

const adminId = new Types.ObjectId().toString();
const companyId = new Types.ObjectId().toString();

const makeCompany = (overrides: Record<string, unknown> = {}) => ({
  _id: new Types.ObjectId(companyId),
  name: 'Test Agency',
  email: 'agency@example.com',
  status: CompanyStatus.PENDING,
  creditLimit: 100000,
  walletBalance: 50000,
  outstandingBalance: 0,
  save: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

const makeModel = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  create: jest.fn(),
  countDocuments: jest.fn(),
  aggregate: jest.fn(),
  lean: jest.fn(),
});

describe('AdminService', () => {
  let service: AdminService;
  let companyModel: ReturnType<typeof makeModel>;
  let walletTxModel: ReturnType<typeof makeModel>;
  let loyaltyRuleModel: ReturnType<typeof makeModel>;
  let notificationModel: ReturnType<typeof makeModel>;

  const models: Record<string, ReturnType<typeof makeModel>> = {};

  beforeEach(async () => {
    jest.clearAllMocks();

    companyModel = makeModel();
    walletTxModel = makeModel();
    loyaltyRuleModel = makeModel();
    notificationModel = makeModel();

    models[Company.name] = companyModel;
    models[WalletTransaction.name] = walletTxModel;
    models[LoyaltyRule.name] = loyaltyRuleModel;
    models[Notification.name] = notificationModel;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: getModelToken(Company.name), useValue: companyModel },
        { provide: getModelToken(User.name), useValue: makeModel() },
        { provide: getModelToken(Role.name), useValue: makeModel() },
        { provide: getModelToken(Booking.name), useValue: makeModel() },
        { provide: getModelToken(WalletTransaction.name), useValue: walletTxModel },
        { provide: getModelToken(Settlement.name), useValue: makeModel() },
        { provide: getModelToken(ApiConfig.name), useValue: makeModel() },
        { provide: getModelToken(LoyaltyRule.name), useValue: loyaltyRuleModel },
        { provide: getModelToken(Notification.name), useValue: notificationModel },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  describe('onModuleInit — loyalty rule seeding', () => {
    it('creates default loyalty rule if none exists', async () => {
      loyaltyRuleModel.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
      loyaltyRuleModel.create.mockResolvedValue({});

      await service.onModuleInit();

      expect(loyaltyRuleModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ pointsPerAed: 1, isActive: true }),
      );
    });

    it('does not create loyalty rule if one already exists', async () => {
      loyaltyRuleModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({ isActive: true }),
      });

      await service.onModuleInit();

      expect(loyaltyRuleModel.create).not.toHaveBeenCalled();
    });
  });

  describe('approveClient', () => {
    it('sets status to ACTIVE and records approvedBy', async () => {
      const company = makeCompany({ status: CompanyStatus.PENDING });
      companyModel.findById.mockResolvedValue(company);
      notificationModel.create = jest.fn().mockResolvedValue({});
      // notif model used via private sendNotification helper
      const notifSave = jest.fn().mockResolvedValue({});
      (notificationModel as unknown as { new: unknown }).new = jest.fn();

      await service.approveClient(companyId, adminId);

      expect(company.status).toBe(CompanyStatus.ACTIVE);
      expect(company.approvedBy.toString()).toBe(adminId);
      expect(company.save).toHaveBeenCalled();
    });

    it('throws NotFoundException when company does not exist', async () => {
      companyModel.findById.mockResolvedValue(null);
      await expect(service.approveClient(new Types.ObjectId().toString(), adminId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when company is not PENDING', async () => {
      const company = makeCompany({ status: CompanyStatus.ACTIVE });
      companyModel.findById.mockResolvedValue(company);
      await expect(service.approveClient(companyId, adminId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateCreditLimit', () => {
    it('updates creditLimit and creates wallet transaction audit entry', async () => {
      const company = makeCompany({ creditLimit: 100000 });
      companyModel.findById.mockResolvedValue(company);
      walletTxModel.create.mockResolvedValue({});
      notificationModel.create = jest.fn().mockResolvedValue({});

      await service.updateCreditLimit(companyId, { creditLimit: 200000 }, adminId);

      expect(company.creditLimit).toBe(200000);
      expect(walletTxModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 100000 }),
      );
    });

    it('throws NotFoundException when company not found', async () => {
      companyModel.findById.mockResolvedValue(null);
      await expect(
        service.updateCreditLimit(new Types.ObjectId().toString(), { creditLimit: 100 }, adminId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('adminTopUpWallet', () => {
    it('increments walletBalance and creates TOPUP ledger entry', async () => {
      const company = makeCompany({ walletBalance: 50000 });
      companyModel.findById.mockResolvedValue(company);
      walletTxModel.create.mockResolvedValue({});
      notificationModel.create = jest.fn().mockResolvedValue({});

      await service.adminTopUpWallet(companyId, { amount: 25000, description: 'Admin top-up' }, adminId);

      expect(company.walletBalance).toBe(75000);
      expect(walletTxModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 25000 }),
      );
    });
  });

  describe('listClients', () => {
    it('returns paginated company list', async () => {
      const chain = { sort: jest.fn(), skip: jest.fn(), limit: jest.fn(), lean: jest.fn() };
      chain.sort.mockReturnValue(chain);
      chain.skip.mockReturnValue(chain);
      chain.limit.mockReturnValue(chain);
      chain.lean.mockResolvedValue([makeCompany()]);
      companyModel.find.mockReturnValue(chain);
      companyModel.countDocuments.mockResolvedValue(1);

      const result = await service.listClients({}, 1, 20);

      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
    });
  });
});
