import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';
import { Company } from '../../db/schemas/company.schema';
import { CompaniesService } from './companies.service';

const mockCompanyId = new Types.ObjectId().toString();

function makeModelMock(overrides: Record<string, jest.Mock> = {}) {
  return {
    findById: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
    ...overrides,
  };
}

describe('CompaniesService', () => {
  let service: CompaniesService;
  let model: ReturnType<typeof makeModelMock>;

  beforeEach(async () => {
    model = makeModelMock();
    const module = await Test.createTestingModule({
      providers: [
        CompaniesService,
        { provide: getModelToken(Company.name), useValue: model },
      ],
    }).compile();

    service = module.get(CompaniesService);
  });

  // ── getAvailableCredit ────────────────────────────────────────────────────────

  describe('getAvailableCredit', () => {
    it('returns creditLimit + walletBalance - outstandingBalance', async () => {
      model.findById.mockReturnValue({ lean: () => Promise.resolve({ creditLimit: 10000, walletBalance: 5000, outstandingBalance: 3000 }) });
      const result = await service.getAvailableCredit(mockCompanyId);
      expect(result).toBe(12000); // 10000 + 5000 - 3000
    });

    it('clamps to 0 when outstandingBalance exceeds limit+wallet', async () => {
      model.findById.mockReturnValue({ lean: () => Promise.resolve({ creditLimit: 1000, walletBalance: 0, outstandingBalance: 5000 }) });
      const result = await service.getAvailableCredit(mockCompanyId);
      expect(result).toBe(0);
    });

    it('throws NotFoundException if company not found', async () => {
      model.findById.mockReturnValue({ lean: () => Promise.resolve(null) });
      await expect(service.getAvailableCredit(mockCompanyId)).rejects.toThrow(NotFoundException);
    });
  });

  // ── atomicDeductCredit ────────────────────────────────────────────────────────

  describe('atomicDeductCredit', () => {
    it('succeeds when sufficient credit', async () => {
      model.findOneAndUpdate.mockResolvedValue({ outstandingBalance: 5000 });
      await expect(service.atomicDeductCredit(mockCompanyId, 5000)).resolves.not.toThrow();
      expect(model.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ _id: expect.any(Types.ObjectId) }),
        { $inc: { outstandingBalance: 5000 } },
        expect.any(Object),
      );
    });

    it('throws BadRequestException when insufficient credit', async () => {
      model.findOneAndUpdate.mockResolvedValue(null);
      await expect(service.atomicDeductCredit(mockCompanyId, 99999)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for non-positive amount', async () => {
      await expect(service.atomicDeductCredit(mockCompanyId, 0)).rejects.toThrow(BadRequestException);
      await expect(service.atomicDeductCredit(mockCompanyId, -100)).rejects.toThrow(BadRequestException);
    });

    it('uses $expr condition to prevent race conditions', async () => {
      model.findOneAndUpdate.mockResolvedValue({ outstandingBalance: 1000 });
      await service.atomicDeductCredit(mockCompanyId, 100);
      const callArgs = model.findOneAndUpdate.mock.calls[0][0];
      expect(callArgs.$expr).toBeDefined();
      expect(callArgs.$expr.$gte).toBeDefined();
    });
  });

  // ── creditBack ────────────────────────────────────────────────────────────────

  describe('creditBack', () => {
    it('decrements outstandingBalance only', async () => {
      model.findByIdAndUpdate.mockResolvedValue({ outstandingBalance: 0 });
      await service.creditBack(mockCompanyId, 5000);
      expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
        mockCompanyId,
        { $inc: { outstandingBalance: -5000 } },
        expect.any(Object),
      );
    });

    it('does NOT modify walletBalance', async () => {
      model.findByIdAndUpdate.mockResolvedValue({ outstandingBalance: 0 });
      await service.creditBack(mockCompanyId, 100);
      const updateArg = model.findByIdAndUpdate.mock.calls[0][1];
      expect(updateArg.$inc.walletBalance).toBeUndefined();
    });
  });

  // ── topUpWallet ───────────────────────────────────────────────────────────────

  describe('topUpWallet', () => {
    it('increments walletBalance', async () => {
      model.findByIdAndUpdate.mockResolvedValue({ walletBalance: 10000 });
      await service.topUpWallet(mockCompanyId, 10000);
      expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
        mockCompanyId,
        { $inc: { walletBalance: 10000 } },
        expect.any(Object),
      );
    });
  });

  // ── deductWallet ──────────────────────────────────────────────────────────────

  describe('deductWallet', () => {
    it('succeeds when sufficient wallet balance', async () => {
      model.findOneAndUpdate.mockResolvedValue({ walletBalance: 0 });
      await expect(service.deductWallet(mockCompanyId, 1000)).resolves.not.toThrow();
    });

    it('throws BadRequestException when insufficient balance', async () => {
      model.findOneAndUpdate.mockResolvedValue(null);
      await expect(service.deductWallet(mockCompanyId, 999999)).rejects.toThrow(BadRequestException);
    });
  });

  // ── updateCreditLimit ─────────────────────────────────────────────────────────

  describe('updateCreditLimit', () => {
    it('throws for negative limit', async () => {
      await expect(service.updateCreditLimit(mockCompanyId, -1)).rejects.toThrow(BadRequestException);
    });

    it('allows zero credit limit', async () => {
      model.findByIdAndUpdate.mockResolvedValue({ creditLimit: 0 });
      await expect(service.updateCreditLimit(mockCompanyId, 0)).resolves.not.toThrow();
    });
  });
});
