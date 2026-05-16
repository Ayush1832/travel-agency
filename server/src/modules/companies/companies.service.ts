import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
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
   * availableCredit = creditLimit + walletBalance
   * Old outstanding balances are tracked outside this system per client decision.
   */
  async getAvailableCredit(id: string): Promise<number> {
    const company = await this.companyModel.findById(id).lean();
    if (!company) throw new NotFoundException('Company not found');
    return company.creditLimit + company.walletBalance;
  }

  async deductCredit(id: string, amount: number, session?: unknown) {
    const company = await this.companyModel.findById(id).session(session as never);
    if (!company) throw new NotFoundException('Company not found');

    const available = company.creditLimit + company.walletBalance;
    if (available < amount) throw new BadRequestException('Insufficient credit balance');

    // Deduct from walletBalance first, then creditLimit
    if (company.walletBalance >= amount) {
      company.walletBalance -= amount;
    } else {
      const fromWallet = company.walletBalance;
      company.walletBalance = 0;
      company.creditLimit -= amount - fromWallet;
    }

    return company.save({ session: session as never });
  }

  async creditBack(id: string, amount: number) {
    return this.companyModel.findByIdAndUpdate(
      id,
      { $inc: { walletBalance: amount } },
      { new: true },
    );
  }

  async topUpWallet(id: string, amount: number) {
    return this.companyModel.findByIdAndUpdate(
      id,
      { $inc: { walletBalance: amount } },
      { new: true },
    );
  }
}
