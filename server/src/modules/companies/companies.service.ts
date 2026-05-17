import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, ClientSession } from 'mongoose';
import { Company, CompanyDocument, CompanyStatus } from '../../db/schemas/company.schema';

@Injectable()
export class CompaniesService {
  constructor(@InjectModel(Company.name) private companyModel: Model<CompanyDocument>) {}

  async findById(id: string) {
    const company = await this.companyModel.findById(id).lean();
    if (!company) throw new NotFoundException('Company not found');
    return company;
  }

  async findAll(status?: CompanyStatus, page = 1, limit = 20) {
    const filter = status ? { status } : {};
    const [data, total] = await Promise.all([
      this.companyModel.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      this.companyModel.countDocuments(filter),
    ]);
    return { data, total, page, limit };
  }

  async approve(id: string, adminId: string) {
    const company = await this.companyModel.findById(id);
    if (!company) throw new NotFoundException('Company not found');
    if (company.status !== CompanyStatus.PENDING) throw new BadRequestException('Company is not pending');
    company.status = CompanyStatus.ACTIVE;
    company.approvedBy = new Types.ObjectId(adminId);
    company.approvedAt = new Date();
    return company.save();
  }

  async reject(id: string) {
    return this.companyModel.findByIdAndUpdate(id, { status: CompanyStatus.REJECTED }, { new: true });
  }

  async suspend(id: string) {
    return this.companyModel.findByIdAndUpdate(id, { status: CompanyStatus.SUSPENDED }, { new: true });
  }

  async activate(id: string) {
    return this.companyModel.findByIdAndUpdate(id, { status: CompanyStatus.ACTIVE }, { new: true });
  }

  async updateCreditLimit(id: string, creditLimit: number) {
    if (creditLimit < 0) throw new BadRequestException('Credit limit cannot be negative');
    return this.companyModel.findByIdAndUpdate(id, { creditLimit }, { new: true });
  }

  /**
   * availableCredit = creditLimit + walletBalance - outstandingBalance
   * This reflects how much more the client can spend.
   */
  async getAvailableCredit(id: string): Promise<number> {
    const company = await this.companyModel.findById(id).lean();
    if (!company) throw new NotFoundException('Company not found');
    const available = company.creditLimit + company.walletBalance - company.outstandingBalance;
    return Math.max(0, available);
  }

  /**
   * Atomically check and deduct credit for a booking.
   * Uses a conditional findOneAndUpdate to prevent race conditions — two parallel
   * requests for the same company cannot both pass if there is only enough credit for one.
   *
   * For credit bookings: increments outstandingBalance (creates a debt).
   * Does NOT reduce creditLimit or walletBalance — those are settled separately.
   *
   * @throws BadRequestException if insufficient credit.
   */
  async atomicDeductCredit(id: string, amount: number, session?: ClientSession): Promise<void> {
    if (amount <= 0) throw new BadRequestException('Amount must be positive');

    // Atomic: only proceed if availableCredit >= amount
    const result = await this.companyModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(id),
        // Condition: creditLimit + walletBalance - outstandingBalance >= amount
        $expr: {
          $gte: [
            {
              $subtract: [
                { $add: ['$creditLimit', '$walletBalance'] },
                '$outstandingBalance',
              ],
            },
            amount,
          ],
        },
      },
      { $inc: { outstandingBalance: amount } },
      { new: true, session },
    );

    if (!result) {
      throw new BadRequestException('Insufficient credit. Please top up your wallet or contact admin.');
    }
  }

  /**
   * Rollback a credit deduction (compensating action when supplier booking fails).
   */
  async creditBack(id: string, amount: number, session?: ClientSession) {
    return this.companyModel.findByIdAndUpdate(
      id,
      { $inc: { outstandingBalance: -amount } },
      { new: true, session },
    );
  }

  async topUpWallet(id: string, amount: number, session?: ClientSession) {
    return this.companyModel.findByIdAndUpdate(
      id,
      { $inc: { walletBalance: amount } },
      { new: true, session },
    );
  }

  /**
   * Deduct from wallet balance (used for wallet-topup refunds).
   */
  async deductWallet(id: string, amount: number) {
    const result = await this.companyModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(id),
        walletBalance: { $gte: amount },
      },
      { $inc: { walletBalance: -amount } },
      { new: true },
    );
    if (!result) throw new BadRequestException('Insufficient wallet balance');
    return result;
  }

  /** @deprecated Use atomicDeductCredit for credit bookings. */
  async deductCredit(id: string, amount: number, session?: unknown) {
    return this.deductWallet(id, amount);
  }

  async addLoyaltyPoints(id: string, points: number) {
    return this.companyModel.findByIdAndUpdate(
      id,
      { $inc: { loyaltyPoints: points } },
      { new: true },
    );
  }

  async incrementOutstanding(id: string, amount: number, session?: ClientSession) {
    return this.companyModel.findByIdAndUpdate(
      id,
      { $inc: { outstandingBalance: amount } },
      { new: true, session },
    );
  }

  async decrementOutstanding(id: string, amount: number, session?: ClientSession) {
    return this.companyModel.findByIdAndUpdate(
      id,
      { $inc: { outstandingBalance: -amount } },
      { new: true, session },
    );
  }
}
