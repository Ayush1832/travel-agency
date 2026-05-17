import {
  Injectable,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  WalletTransaction,
  WalletTransactionDocument,
  WalletTransactionType,
  WalletTransactionDirection,
} from '../../db/schemas/wallet-transaction.schema';
import { Settlement, SettlementDocument } from '../../db/schemas/settlement.schema';
import { Company, CompanyDocument } from '../../db/schemas/company.schema';
import { LoyaltyRule, LoyaltyRuleDocument } from '../../db/schemas/loyalty-rule.schema';
import { CompaniesService } from '../companies/companies.service';
import { PaymentsService } from '../payments/payments.service';
import type { AuthUser } from '../../common/types/auth-user.types';
import { PaymentType } from '../../db/schemas/payment.schema';
import { CreateOrderDto } from '../payments/dto/create-order.dto';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    @InjectModel(WalletTransaction.name)
    private readonly txModel: Model<WalletTransactionDocument>,
    @InjectModel(Settlement.name)
    private readonly settlementModel: Model<SettlementDocument>,
    @InjectModel(Company.name)
    private readonly companyModel: Model<CompanyDocument>,
    @InjectModel(LoyaltyRule.name)
    private readonly loyaltyRuleModel: Model<LoyaltyRuleDocument>,
    private readonly companiesService: CompaniesService,
    private readonly paymentsService: PaymentsService,
  ) {}

  /**
   * Get current wallet balance for a company, including loyalty expiry info.
   */
  async getBalance(companyId: string) {
    const company = await this.companiesService.findById(companyId);
    const availableCredit = Math.max(0, company.creditLimit + company.walletBalance - company.outstandingBalance);

    const rule = await this.loyaltyRuleModel.findOne({ isActive: true }).lean();
    const pointValueFils = rule?.pointValueFils ?? 1;

    // Find next expiry batch — earliest non-expired loyalty_earn transaction
    const now = new Date();
    const nextExpiryTx = await this.txModel
      .findOne({
        companyId: new Types.ObjectId(companyId),
        type: WalletTransactionType.LOYALTY_EARN,
        expiresAt: { $gt: now },
      })
      .sort({ expiresAt: 1 })
      .lean();

    return {
      creditLimit: company.creditLimit,
      walletBalance: company.walletBalance,
      outstandingBalance: company.outstandingBalance,
      availableCredit,
      loyaltyPoints: company.loyaltyPoints,
      pointValueFils,
      nextExpiryDate: nextExpiryTx?.expiresAt ?? null,
      currency: company.currency,
    };
  }

  /**
   * Paginated transaction list with optional filters.
   */
  async getTransactions(
    companyId: string,
    filters: { type?: WalletTransactionType; from?: string; to?: string },
    page = 1,
    limit = 20,
  ) {
    const query: Record<string, unknown> = {
      companyId: new Types.ObjectId(companyId),
    };

    if (filters.type) query.type = filters.type;
    if (filters.from || filters.to) {
      query.createdAt = {};
      if (filters.from) (query.createdAt as Record<string, unknown>).$gte = new Date(filters.from);
      if (filters.to) (query.createdAt as Record<string, unknown>).$lte = new Date(filters.to);
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.txModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.txModel.countDocuments(query),
    ]);

    return { data, total, page, limit };
  }

  /**
   * Create a WalletTransaction ledger entry.
   * balanceAfter is the wallet balance AFTER this transaction.
   */
  async recordTransaction(data: {
    companyId: string;
    type: WalletTransactionType;
    direction: WalletTransactionDirection;
    amount: number;
    balanceAfter: number;
    pointsAmount?: number;
    pointsBalanceAfter?: number;
    refBookingId?: string;
    refPaymentId?: string;
    refSettlementId?: string;
    description?: string;
    performedBy: string;
  }): Promise<WalletTransactionDocument> {
    const tx = new this.txModel({
      companyId: new Types.ObjectId(data.companyId),
      type: data.type,
      direction: data.direction,
      amount: data.amount,
      balanceAfter: data.balanceAfter,
      pointsAmount: data.pointsAmount,
      pointsBalanceAfter: data.pointsBalanceAfter,
      refBookingId: data.refBookingId ? new Types.ObjectId(data.refBookingId) : undefined,
      refPaymentId: data.refPaymentId ? new Types.ObjectId(data.refPaymentId) : undefined,
      refSettlementId: data.refSettlementId
        ? new Types.ObjectId(data.refSettlementId)
        : undefined,
      description: data.description,
      performedBy: new Types.ObjectId(data.performedBy),
    });

    return tx.save();
  }

  /**
   * Initiate a wallet top-up by creating a PayTabs payment order.
   * Actual balance update happens in PaymentsService.handlePostPaymentSuccess.
   */
  async topUpWallet(
    companyId: string,
    user: AuthUser,
    amount: number,
    currency: string,
    callbackUrl: string,
  ) {
    const dto: CreateOrderDto = {
      amount,
      currency: currency as 'AED' | 'USD',
      type: PaymentType.WALLET_TOPUP,
      callbackUrl,
    };

    return this.paymentsService.createOrder(dto, user);
  }

  /**
   * Statement: all transactions in a date range.
   */
  async getStatement(companyId: string, from: string, to: string) {
    const query: Record<string, unknown> = {
      companyId: new Types.ObjectId(companyId),
      createdAt: {
        $gte: new Date(from),
        $lte: new Date(to),
      },
    };

    const data = await this.txModel.find(query).sort({ createdAt: 1 }).lean();
    const company = await this.companiesService.findById(companyId);

    return {
      companyId,
      companyName: company.name,
      from,
      to,
      transactions: data,
      totalTransactions: data.length,
    };
  }

  /**
   * Export wallet statement as PDF or Excel buffer.
   */
  async exportStatement(companyId: string, from: string, to: string, format: 'pdf' | 'excel'): Promise<Buffer> {
    const result = await this.getStatement(companyId, from, to);

    if (format === 'excel') {
      const ExcelJS = require('exceljs') as typeof import('exceljs');
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Statement');

      // Header
      sheet.addRow([`Wallet Statement — ${result.companyName}`]);
      sheet.addRow([`Period: ${from} to ${to}`]);
      sheet.addRow([]);
      sheet.addRow(['Date', 'Type', 'Direction', 'Amount (fils)', 'Balance After', 'Description']);
      const headerRow = sheet.getRow(4);
      headerRow.font = { bold: true };

      for (const tx of result.transactions) {
        sheet.addRow([
          new Date(tx.createdAt as unknown as string).toISOString().split('T')[0],
          tx.type,
          tx.direction,
          tx.amount,
          tx.balanceAfter,
          tx.description || '',
        ]);
      }

      sheet.columns.forEach((col) => { col.width = 20; });
      const buf = await workbook.xlsx.writeBuffer();
      return Buffer.from(buf);
    }

    // PDF
    const PDFDocument = require('pdfkit') as typeof import('pdfkit');
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    await new Promise<void>((resolve) => {
      doc.on('end', resolve);

      doc.fontSize(18).text('Wallet Statement', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(11).text(`Company: ${result.companyName}`);
      doc.text(`Period: ${from} to ${to}`);
      doc.text(`Total Transactions: ${result.totalTransactions}`);
      doc.moveDown();

      // Table header
      const cols = { date: 60, type: 130, direction: 220, amount: 300, balance: 380, desc: 450 };
      doc.font('Helvetica-Bold').fontSize(9);
      const headerY = doc.y;
      doc.text('Date', cols.date, headerY);
      doc.text('Type', cols.type, headerY);
      doc.text('Direction', cols.direction, headerY);
      doc.text('Amount', cols.amount, headerY);
      doc.text('Balance', cols.balance, headerY);
      doc.text('Description', cols.desc, headerY);

      doc.moveDown(0.3);
      doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
      doc.moveDown(0.2);

      doc.font('Helvetica').fontSize(8);
      for (const tx of result.transactions) {
        if (doc.y > 750) { doc.addPage(); }
        const row = doc.y;
        doc.text(new Date(tx.createdAt as unknown as string).toISOString().split('T')[0], cols.date, row);
        doc.text(String(tx.type || ''), cols.type, row);
        doc.text(String(tx.direction || ''), cols.direction, row);
        doc.text(String(tx.amount || 0), cols.amount, row);
        doc.text(String(tx.balanceAfter || 0), cols.balance, row);
        doc.text(String(tx.description || '').substring(0, 25), cols.desc, row);
        doc.moveDown(0.6);
      }

      doc.end();
    });

    return Buffer.concat(chunks);
  }

  /**
   * Award loyalty points using the active rule's settings.
   * Stores expiresAt on the transaction if the rule has an expiration period.
   */
  async addLoyaltyPoints(
    companyId: string,
    userId: string,
    pointsToAdd: number,
    bookingId?: string,
    expiresAt?: Date,
  ) {
    const company = await this.companyModel.findByIdAndUpdate(
      companyId,
      { $inc: { loyaltyPoints: pointsToAdd } },
      { new: true },
    );

    if (!company) throw new BadRequestException('Company not found');

    const rule = await this.loyaltyRuleModel.findOne({ isActive: true }).lean();
    const pointValueFils = rule?.pointValueFils ?? 1;
    const newPointsBalance = company.loyaltyPoints;

    const tx = new this.txModel({
      companyId: new Types.ObjectId(companyId),
      type: WalletTransactionType.LOYALTY_EARN,
      direction: WalletTransactionDirection.CREDIT,
      amount: pointsToAdd * pointValueFils,
      balanceAfter: company.walletBalance,
      pointsAmount: pointsToAdd,
      pointsBalanceAfter: newPointsBalance,
      refBookingId: bookingId ? new Types.ObjectId(bookingId) : undefined,
      description: `Loyalty points earned: ${pointsToAdd} pts`,
      performedBy: new Types.ObjectId(userId),
      expiresAt: expiresAt ?? null,
    });
    await tx.save();

    return { pointsAdded: pointsToAdd, newPointsBalance, expiresAt: expiresAt ?? null };
  }

  /**
   * Redeem loyalty points — converts to wallet balance using the active rule's pointValueFils.
   */
  async redeemLoyaltyPoints(companyId: string, userId: string, points: number) {
    const current = await this.companiesService.findById(companyId);

    if (current.loyaltyPoints < points) {
      throw new BadRequestException(
        `Insufficient loyalty points. Available: ${current.loyaltyPoints}, requested: ${points}`,
      );
    }

    const rule = await this.loyaltyRuleModel.findOne({ isActive: true }).lean();
    const pointValueFils = rule?.pointValueFils ?? 1;
    const walletCreditFils = points * pointValueFils;

    const updated = await this.companyModel.findByIdAndUpdate(
      companyId,
      {
        $inc: {
          loyaltyPoints: -points,
          walletBalance: walletCreditFils,
        },
      },
      { new: true },
    );

    if (!updated) throw new BadRequestException('Company not found');

    const newPointsBalance = updated.loyaltyPoints;
    const newWalletBalance = updated.walletBalance;

    await this.recordTransaction({
      companyId,
      type: WalletTransactionType.LOYALTY_REDEEM,
      direction: WalletTransactionDirection.DEBIT,
      amount: walletCreditFils,
      balanceAfter: newWalletBalance,
      pointsAmount: points,
      pointsBalanceAfter: newPointsBalance,
      description: `Loyalty points redeemed: ${points} pts → ${walletCreditFils} fils`,
      performedBy: userId,
    });

    return {
      pointsRedeemed: points,
      newPointsBalance,
      walletCredited: walletCreditFils,
      newWalletBalance,
    };
  }

  /**
   * Compute loyalty points to award based on the active rule.
   * Falls back to 1 pt per AED if no rule provided.
   */
  static computeLoyaltyPoints(amountFils: number, pointsPerAed = 1): number {
    // amountFils / 100 = AED; multiply by pointsPerAed
    return Math.floor((amountFils / 100) * pointsPerAed);
  }
}
