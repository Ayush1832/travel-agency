import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { UsersService } from './users.service';
import { User } from '../../db/schemas/user.schema';

const userId = new Types.ObjectId().toString();
const companyId = new Types.ObjectId().toString();

const mockUser = { _id: new Types.ObjectId(userId), email: 'user@example.com', companyId: new Types.ObjectId(companyId) };

const mockUserModel = {
  findById: jest.fn(),
  find: jest.fn(),
  findByIdAndUpdate: jest.fn(),
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getModelToken(User.name), useValue: mockUserModel },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('findById', () => {
    it('returns user when found', async () => {
      mockUserModel.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue(mockUser) });
      const result = await service.findById(userId);
      expect(result).toEqual(mockUser);
    });

    it('throws NotFoundException when user does not exist', async () => {
      mockUserModel.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
      await expect(service.findById(new Types.ObjectId().toString())).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByCompany', () => {
    it('returns all users belonging to the company', async () => {
      mockUserModel.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([mockUser]) });
      const result = await service.findByCompany(companyId);
      expect(result).toHaveLength(1);
      expect(mockUserModel.find).toHaveBeenCalledWith({ companyId: new Types.ObjectId(companyId) });
    });
  });

  describe('updateStatus', () => {
    it('updates user status to disabled', async () => {
      const updated = { ...mockUser, status: 'disabled' };
      mockUserModel.findByIdAndUpdate.mockReturnValue({ lean: jest.fn().mockResolvedValue(updated) });

      const result = await service.updateStatus(userId, 'disabled');

      expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        userId,
        { status: 'disabled' },
        { new: true },
      );
      expect(result?.status).toBe('disabled');
    });

    it('updates user status to active', async () => {
      const updated = { ...mockUser, status: 'active' };
      mockUserModel.findByIdAndUpdate.mockReturnValue({ lean: jest.fn().mockResolvedValue(updated) });

      const result = await service.updateStatus(userId, 'active');
      expect(result?.status).toBe('active');
    });
  });
});
