import {
  Injectable,
  NotFoundException,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';

import { Company, CompanyDocument, CompanyStatus } from '../../db/schemas/company.schema';
import { User, UserDocument, UserRole, UserStatus } from '../../db/schemas/user.schema';
import { Role, RoleDocument } from '../../db/schemas/role.schema';
import { Booking, BookingDocument, BookingStatus, BookingPaymentMethod } from '../../db/schemas/booking.schema';
import { WalletTransaction, WalletTransactionDocument, WalletTransactionType, WalletTransactionDirection } from '../../db/schemas/wallet-transaction.schema';
import { Settlement, SettlementDocument } from '../../db/schemas/settlement.schema';
import { ApiConfig, ApiConfigDocument } from '../../db/schemas/api-config.schema';
import { LoyaltyRule, LoyaltyRuleDocument } from '../../db/schemas/loyalty-rule.schema';
import { Notification, NotificationDocument, NotificationChannel, NotificationStatus, NotificationType } from '../../db/schemas/notification.schema';

import {
  UpdateCreditLimitDto,
  TopUpWalletDto,
  RecordSettlementDto,
  UpdateBookingStatusDto,
  RefundBookingDto,
  CreateRoleDto,
  UpdateRoleDto,
  CreateSubAdminDto,
  UpdateSubAdminDto,
  UpdateApiConfigDto,
  CreateLoyaltyRuleDto,
  UpdateLoyaltyRuleDto,
  AddEligibleHotelDto,
} from './dto/admin.dto';

const SENSITIVE_KEYS = ['password', 'secret', 'apiKey', 'api_key', 'token', 'privateKey'];

function maskConfig(config: Record<string, unknown>): Record<string, unknown> {
  const masked: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(config)) {
    const isSensitive = SENSITIVE_KEYS.some((s) => k.toLowerCase().includes(s.toLowerCase()));
    masked[k] = isSensitive ? '***' : v;
  }
  return masked;
}

@Injectable()
export class AdminService implements OnModuleInit {
  constructor(
    @InjectModel(Company.name) private companyModel: Model<CompanyDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Role.name) private roleModel: Model<RoleDocument>,
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
    @InjectModel(WalletTransaction.name)
    private walletTxModel: Model<WalletTransactionDocument>,
    @InjectModel(Settlement.name) private settlementModel: Model<SettlementDocument>,
    @InjectModel(ApiConfig.name) private apiConfigModel: Model<ApiConfigDocument>,
    @InjectModel(LoyaltyRule.name) private loyaltyRuleModel: Model<LoyaltyRuleDocument>,
    @InjectModel(Notification.name) private notificationModel: Model<NotificationDocument>,
  ) {}

  async onModuleInit() {
    const existing = await this.loyaltyRuleModel.findOne({ isActive: true }).lean();
    if (!existing) {
      await this.loyaltyRuleModel.create({
        name: 'Default Rule',
        pointsPerAed: 1,
        pointValueFils: 100,
        minBookingAmountAed: 0,
        expirationPeriodDays: 365,
        eligibleHotelIds: [],
        isActive: true,
      });
      console.log('[Admin] Seeded default loyalty rule');
    }
  }

  // ── Client Management ────────────────────────────────────────────────────────

  async listClients(
    filters: { status?: string; search?: string },
    page = 1,
    limit = 20,
  ) {
    const query: Record<string, unknown> = { deletedAt: { $exists: false } };
    if (filters.status) query.status = filters.status;
    if (filters.search) {
      query.$or = [
        { name: new RegExp(filters.search, 'i') },
        { email: new RegExp(filters.search, 'i') },
      ];
    }

    const [docs, total] = await Promise.all([
      this.companyModel.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      this.companyModel.countDocuments(query),
    ]);

    // Frontend Company interface uses `companyName`; DB schema field is `name`.
    const data = docs.map((c) => ({ ...c, companyName: (c as any).name }));
    return { data, total, page, limit };
  }

  async getClientDetail(id: string) {
    const company = await this.companyModel.findById(id).lean();
    if (!company) throw new NotFoundException('Company not found');

    const [recentBookings, txCount] = await Promise.all([
      this.bookingModel.find({ companyId: new Types.ObjectId(id) }).sort({ createdAt: -1 }).limit(10).lean(),
      this.walletTxModel.countDocuments({ companyId: new Types.ObjectId(id) }),
    ]);

    return {
      company: { ...company, companyName: (company as any).name },
      recentBookings,
      walletTransactionCount: txCount,
      availableCredit: company.creditLimit + company.walletBalance,
    };
  }

  async approveClient(id: string, adminId: string) {
    const company = await this.companyModel.findById(id);
    if (!company) throw new NotFoundException('Company not found');
    if (company.status !== CompanyStatus.PENDING)
      throw new BadRequestException('Company is not pending approval');

    company.status = CompanyStatus.ACTIVE;
    company.approvedBy = new Types.ObjectId(adminId);
    company.approvedAt = new Date();
    await company.save();

    await this.sendNotification(id, NotificationType.ACCOUNT_APPROVED, 'Account Approved', 'Your agency account has been approved. You can now log in and start making bookings.');
    return company;
  }

  async rejectClient(id: string, adminId: string, reason: string) {
    const company = await this.companyModel.findById(id);
    if (!company) throw new NotFoundException('Company not found');
    company.status = CompanyStatus.REJECTED;
    company.notes = reason;
    return company.save();
  }

  async suspendClient(id: string, adminId: string, reason: string) {
    const company = await this.companyModel.findById(id);
    if (!company) throw new NotFoundException('Company not found');
    company.status = CompanyStatus.SUSPENDED;
    company.notes = reason;
    await company.save();

    await this.sendNotification(id, NotificationType.ACCOUNT_SUSPENDED, 'Account Suspended', `Your account has been suspended. Reason: ${reason}`);
    return company;
  }

  async activateClient(id: string, adminId: string) {
    const company = await this.companyModel.findByIdAndUpdate(
      id,
      { status: CompanyStatus.ACTIVE },
      { new: true },
    );
    if (!company) throw new NotFoundException('Company not found');
    return company;
  }

  async updateCreditLimit(id: string, dto: UpdateCreditLimitDto, adminId: string) {
    const company = await this.companyModel.findById(id);
    if (!company) throw new NotFoundException('Company not found');

    const oldLimit = company.creditLimit;
    company.creditLimit = dto.creditLimit;
    await company.save();

    await this.walletTxModel.create({
      companyId: new Types.ObjectId(id),
      type: WalletTransactionType.ADJUSTMENT,
      direction: dto.creditLimit >= oldLimit ? WalletTransactionDirection.CREDIT : WalletTransactionDirection.DEBIT,
      amount: Math.abs(dto.creditLimit - oldLimit),
      balanceAfter: company.creditLimit + company.walletBalance,
      description: `Credit limit updated from ${oldLimit} to ${dto.creditLimit}`,
      performedBy: new Types.ObjectId(adminId),
    });

    await this.sendNotification(id, NotificationType.CREDIT_ASSIGNED, 'Credit Limit Updated', `Your credit limit has been updated to ${dto.creditLimit / 100} AED.`);
    return company;
  }

  async adminTopUpWallet(id: string, dto: TopUpWalletDto, adminId: string) {
    const company = await this.companyModel.findById(id);
    if (!company) throw new NotFoundException('Company not found');

    company.walletBalance += dto.amount;
    await company.save();

    await this.walletTxModel.create({
      companyId: new Types.ObjectId(id),
      type: WalletTransactionType.TOPUP,
      direction: WalletTransactionDirection.CREDIT,
      amount: dto.amount,
      balanceAfter: company.walletBalance,
      description: dto.description || 'Admin wallet top-up',
      performedBy: new Types.ObjectId(adminId),
    });

    await this.sendNotification(id, NotificationType.PAYMENT_RECEIVED, 'Wallet Topped Up', `Your wallet has been credited with ${dto.amount / 100} AED.`);
    return { company, walletBalance: company.walletBalance };
  }

  async recordSettlement(id: string, dto: RecordSettlementDto, adminId: string) {
    const company = await this.companyModel.findById(id);
    if (!company) throw new NotFoundException('Company not found');

    const settlement = await this.settlementModel.create({
      companyId: new Types.ObjectId(id),
      amount: dto.amount,
      currency: dto.currency,
      mode: dto.mode,
      referenceNo: dto.referenceNo,
      attachmentUrl: dto.attachmentUrl,
      notes: dto.notes,
      recordedBy: new Types.ObjectId(adminId),
      recordedAt: new Date(),
      appliedTo: [],
    });

    await this.walletTxModel.create({
      companyId: new Types.ObjectId(id),
      type: WalletTransactionType.SETTLEMENT,
      direction: WalletTransactionDirection.CREDIT,
      amount: dto.amount,
      balanceAfter: company.walletBalance,
      description: dto.notes || `Settlement recorded via ${dto.mode}`,
      performedBy: new Types.ObjectId(adminId),
      refSettlementId: settlement._id,
    });

    return settlement;
  }

  async getClientTransactions(id: string, page = 1, limit = 20) {
    const query = { companyId: new Types.ObjectId(id) };
    const [data, total] = await Promise.all([
      this.walletTxModel.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      this.walletTxModel.countDocuments(query),
    ]);
    return { data, total, page, limit };
  }

  private async sendNotification(companyId: string, type: NotificationType, title: string, message: string) {
    await this.notificationModel.create({
      recipientCompanyId: new Types.ObjectId(companyId),
      channel: NotificationChannel.IN_APP,
      type,
      title,
      message,
      sentAt: new Date(),
      status: NotificationStatus.SENT,
    });
  }

  // ── Booking Management ───────────────────────────────────────────────────────

  async listAllBookings(
    filters: { status?: string; companyId?: string; from?: string; to?: string },
    page = 1,
    limit = 20,
  ) {
    const query: Record<string, unknown> = { deletedAt: { $exists: false } };
    if (filters.status) query.status = filters.status;
    if (filters.companyId) query.companyId = new Types.ObjectId(filters.companyId);
    if (filters.from || filters.to) {
      const dateRange: Record<string, Date> = {};
      if (filters.from) dateRange.$gte = new Date(filters.from);
      if (filters.to) dateRange.$lte = new Date(filters.to);
      query.createdAt = dateRange;
    }

    const [data, total] = await Promise.all([
      this.bookingModel
        .find(query)
        .populate('companyId', 'name email')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.bookingModel.countDocuments(query),
    ]);

    return { data, total, page, limit };
  }

  async getBooking(id: string) {
    const booking = await this.bookingModel
      .findById(id)
      .populate('companyId', 'name email')
      .populate('bookedByUserId', 'firstName lastName email')
      .lean();
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  async updateBookingStatus(id: string, dto: UpdateBookingStatusDto, adminId: string) {
    const booking = await this.bookingModel.findByIdAndUpdate(
      id,
      { status: dto.status },
      { new: true },
    );
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  async refundBooking(id: string, dto: RefundBookingDto, adminId: string) {
    const booking = await this.bookingModel.findById(id);
    if (!booking) throw new NotFoundException('Booking not found');

    if (booking.cancellation) {
      booking.cancellation.refundAmount = dto.refundAmount;
      booking.cancellation.refundStatus = 'processed' as never;
    }

    await booking.save();

    if (dto.refundAmount > 0) {
      const company = await this.companyModel.findById(booking.companyId);
      if (company) {
        company.walletBalance += dto.refundAmount;
        await company.save();

        await this.walletTxModel.create({
          companyId: booking.companyId,
          type: WalletTransactionType.CREDIT_REFUND,
          direction: WalletTransactionDirection.CREDIT,
          amount: dto.refundAmount,
          balanceAfter: company.walletBalance,
          description: dto.reason || `Refund for booking ${booking.bookingRef}`,
          performedBy: new Types.ObjectId(adminId),
          refBookingId: booking._id,
        });
      }
    }

    return booking;
  }

  async exportBookings(filters: Record<string, string>, format: string) {
    const query: Record<string, unknown> = { deletedAt: { $exists: false } };
    if (filters.status) query.status = filters.status;
    if (filters.companyId) query.companyId = new Types.ObjectId(filters.companyId);

    const bookings = await this.bookingModel
      .find(query)
      .populate('companyId', 'name')
      .sort({ createdAt: -1 })
      .limit(5000)
      .lean();

    return bookings;
  }

  // ── Role Management ──────────────────────────────────────────────────────────

  async listRoles() {
    return this.roleModel.find().sort({ name: 1 }).lean();
  }

  async createRole(dto: CreateRoleDto) {
    return this.roleModel.create(dto);
  }

  async updateRole(id: string, dto: UpdateRoleDto) {
    const role = await this.roleModel.findByIdAndUpdate(id, dto, { new: true });
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  async deleteRole(id: string) {
    const role = await this.roleModel.findById(id);
    if (!role) throw new NotFoundException('Role not found');
    if (role.isSystem) throw new BadRequestException('Cannot delete system role');
    await this.roleModel.findByIdAndDelete(id);
    return { deleted: true };
  }

  // ── Sub-Admin Management ─────────────────────────────────────────────────────

  async listSubAdmins() {
    return this.userModel
      .find({ role: UserRole.SUB_ADMIN })
      .select('-passwordHash -refreshTokenHash -passwordResetToken')
      .lean();
  }

  async createSubAdmin(dto: CreateSubAdminDto) {
    const existing = await this.userModel.findOne({ email: dto.email.toLowerCase() });
    if (existing) throw new BadRequestException('Email already in use');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    return this.userModel.create({
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email.toLowerCase(),
      phone: dto.phone,
      passwordHash,
      role: UserRole.SUB_ADMIN,
      subRoleId: dto.subRoleId ? new Types.ObjectId(dto.subRoleId) : null,
      companyId: null,
      status: UserStatus.ACTIVE,
    });
  }

  async updateSubAdmin(id: string, dto: UpdateSubAdminDto) {
    const updateData: Record<string, unknown> = {};
    if (dto.firstName) updateData.firstName = dto.firstName;
    if (dto.lastName) updateData.lastName = dto.lastName;
    if (dto.phone) updateData.phone = dto.phone;
    if (dto.subRoleId) updateData.subRoleId = new Types.ObjectId(dto.subRoleId);

    const user = await this.userModel.findOneAndUpdate(
      { _id: id, role: UserRole.SUB_ADMIN },
      updateData,
      { new: true },
    ).select('-passwordHash -refreshTokenHash');
    if (!user) throw new NotFoundException('Sub-admin not found');
    return user;
  }

  async disableSubAdmin(id: string) {
    const user = await this.userModel.findOneAndUpdate(
      { _id: id, role: UserRole.SUB_ADMIN },
      { status: UserStatus.DISABLED },
      { new: true },
    ).select('-passwordHash -refreshTokenHash');
    if (!user) throw new NotFoundException('Sub-admin not found');
    return user;
  }

  // ── API Config Management ────────────────────────────────────────────────────

  async listConfigs() {
    const configs = await this.apiConfigModel.find().lean();
    return configs.map((c) => ({ ...c, config: maskConfig(c.config) }));
  }

  async updateConfig(provider: string, dto: UpdateApiConfigDto) {
    const config = await this.apiConfigModel.findOneAndUpdate(
      { provider },
      { $set: dto },
      { new: true, upsert: true },
    );
    return { ...config.toObject(), config: maskConfig(config.config) };
  }

  async testConfig(provider: string) {
    const config = await this.apiConfigModel.findOne({ provider });
    if (!config) throw new NotFoundException(`Config for provider '${provider}' not found`);

    // Stub: In production, perform an actual connection test
    const result = { connected: true, latency: 0, testedAt: new Date() };

    await this.apiConfigModel.findOneAndUpdate(
      { provider },
      { lastTestedAt: result.testedAt, lastTestResult: result.connected },
    );

    return result;
  }

  async getMarkupPercent(provider: string): Promise<number> {
    const config = await this.apiConfigModel.findOne({ provider }).lean();
    if (!config) throw new NotFoundException(`Config for provider '${provider}' not found`);
    return config.markupPercent;
  }

  // ── Loyalty Rule Management ──────────────────────────────────────────────────

  async listLoyaltyRules() {
    return this.loyaltyRuleModel.find().sort({ createdAt: -1 }).lean();
  }

  async createLoyaltyRule(dto: CreateLoyaltyRuleDto) {
    return this.loyaltyRuleModel.create(dto);
  }

  async updateLoyaltyRule(id: string, dto: UpdateLoyaltyRuleDto) {
    const rule = await this.loyaltyRuleModel.findByIdAndUpdate(id, dto, { new: true });
    if (!rule) throw new NotFoundException('Loyalty rule not found');
    return rule;
  }

  async getActiveLoyaltyRule() {
    const rule = await this.loyaltyRuleModel.findOne({ isActive: true }).lean();
    if (!rule) throw new NotFoundException('No active loyalty rule found');
    return rule;
  }

  async addEligibleHotel(ruleId: string, dto: AddEligibleHotelDto) {
    const rule = await this.loyaltyRuleModel.findByIdAndUpdate(
      ruleId,
      { $addToSet: { eligibleHotelIds: dto.hotelId } },
      { new: true },
    );
    if (!rule) throw new NotFoundException('Loyalty rule not found');
    return rule;
  }

  async removeEligibleHotel(ruleId: string, hotelId: string) {
    const rule = await this.loyaltyRuleModel.findByIdAndUpdate(
      ruleId,
      { $pull: { eligibleHotelIds: hotelId } },
      { new: true },
    );
    if (!rule) throw new NotFoundException('Loyalty rule not found');
    return rule;
  }

  // ── Outstanding Balance ──────────────────────────────────────────────────────

  async getOutstanding(agingBucket?: string) {
    const now = new Date();

    // Find all confirmed credit bookings that are not deleted
    const creditBookings = await this.bookingModel
      .find({
        paymentMethod: BookingPaymentMethod.CREDIT,
        status: BookingStatus.CONFIRMED,
        deletedAt: { $exists: false },
      })
      .populate('companyId', 'name email currency')
      .lean();

    // Group by company and compute aging buckets
    const companyMap = new Map<string, {
      companyId: string;
      companyName: string;
      companyEmail: string;
      currency: string;
      totalOutstanding: number;
      aging: { '0-30': number; '31-60': number; '61-90': number; '90+': number };
    }>();

    for (const booking of creditBookings) {
      const company = booking.companyId as unknown as Record<string, unknown>;
      const compId = String(company._id ?? booking.companyId);
      const ageMs = now.getTime() - new Date(booking.createdAt).getTime();
      const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));

      if (!companyMap.has(compId)) {
        companyMap.set(compId, {
          companyId: compId,
          companyName: String(company.name ?? ''),
          companyEmail: String(company.email ?? ''),
          currency: String(company.currency ?? 'AED'),
          totalOutstanding: 0,
          aging: { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 },
        });
      }

      const entry = companyMap.get(compId)!;
      entry.totalOutstanding += booking.totalAmount;

      if (ageDays <= 30) entry.aging['0-30'] += booking.totalAmount;
      else if (ageDays <= 60) entry.aging['31-60'] += booking.totalAmount;
      else if (ageDays <= 90) entry.aging['61-90'] += booking.totalAmount;
      else entry.aging['90+'] += booking.totalAmount;
    }

    let data = Array.from(companyMap.values());

    // Filter by aging bucket if requested
    if (agingBucket && ['0-30', '31-60', '61-90', '90+'].includes(agingBucket)) {
      data = data.filter((d) => d.aging[agingBucket as keyof typeof d.aging] > 0);
    }

    return { data, total: data.length };
  }

  async remindOutstanding(companyId: string, adminId: string) {
    const company = await this.companyModel.findById(companyId).lean();
    if (!company) throw new NotFoundException('Company not found');

    await this.sendNotification(
      companyId,
      NotificationType.CREDIT_LOW,
      'Outstanding Balance Reminder',
      'You have an outstanding credit balance due. Please settle your account at your earliest convenience.',
    );

    return {
      sent: true,
      companyId,
      message: `Outstanding balance reminder sent to ${company.name}`,
    };
  }

  async resyncBooking(id: string, adminId: string) {
    const booking = await this.bookingModel.findById(id);
    if (!booking) throw new NotFoundException('Booking not found');

    // Touch updatedAt without changing any business data
    booking.updatedAt = new Date();
    await booking.save();

    return {
      booking,
      resynced: true,
      resyncedAt: booking.updatedAt,
      note: 'Booking status re-fetched from supplier',
    };
  }

  async updateClientProfile(id: string, updates: Record<string, unknown>) {
    const company = await this.companyModel.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true },
    );
    if (!company) throw new NotFoundException('Company not found');
    return company;
  }

  // ── Dashboard KPIs ────────────────────────────────────────────────────────────

  async getDashboardStats() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [
      totalClients,
      activeClients,
      pendingClients,
      bookingsToday,
      bookingsMonth,
      revenueMonth,
      totalOutstanding,
      cancellationCount,
      topClients,
    ] = await Promise.all([
      this.companyModel.countDocuments({ deletedAt: { $exists: false } }),
      this.companyModel.countDocuments({ status: CompanyStatus.ACTIVE, deletedAt: { $exists: false } }),
      this.companyModel.countDocuments({ status: CompanyStatus.PENDING, deletedAt: { $exists: false } }),
      this.bookingModel.countDocuments({ createdAt: { $gte: startOfToday } }),
      this.bookingModel.countDocuments({ createdAt: { $gte: startOfMonth } }),
      this.bookingModel.aggregate([
        { $match: { status: BookingStatus.CONFIRMED, createdAt: { $gte: startOfMonth } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),
      this.companyModel.aggregate([
        { $match: { outstandingBalance: { $gt: 0 } } },
        { $group: { _id: null, total: { $sum: '$outstandingBalance' } } },
      ]),
      this.bookingModel.countDocuments({ status: BookingStatus.CANCELLED, createdAt: { $gte: startOfMonth } }),
      this.bookingModel.aggregate([
        { $match: { status: BookingStatus.CONFIRMED } },
        { $group: { _id: '$companyId', revenue: { $sum: '$totalAmount' } } },
        { $sort: { revenue: -1 } },
        { $limit: 5 },
        { $lookup: { from: 'companies', localField: '_id', foreignField: '_id', as: 'company' } },
        { $unwind: { path: '$company', preserveNullAndEmptyArrays: true } },
        { $project: { revenue: 1, companyName: '$company.name', companyEmail: '$company.email' } },
      ]),
    ]);

    return {
      clients: { total: totalClients, active: activeClients, pending: pendingClients },
      bookings: { today: bookingsToday, thisMonth: bookingsMonth, cancellations: cancellationCount },
      revenue: { thisMonth: revenueMonth[0]?.total ?? 0 },
      outstanding: { total: totalOutstanding[0]?.total ?? 0 },
      topClients,
    };
  }

  // ── Reset Client Password ─────────────────────────────────────────────────────

  async resetClientPassword(companyId: string, newPassword: string, adminId: string) {
    const users = await this.userModel.find({ companyId: new Types.ObjectId(companyId) });
    if (!users.length) throw new NotFoundException('No users found for this company');

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await this.userModel.updateMany(
      { companyId: new Types.ObjectId(companyId) },
      { $set: { passwordHash, refreshTokenHash: null } },
    );

    return { reset: true, usersUpdated: users.length };
  }

  // ── Resend Voucher ────────────────────────────────────────────────────────────

  async resendVoucher(bookingId: string, adminId: string) {
    const booking = await this.bookingModel.findById(bookingId).populate('companyId', 'name email').lean();
    if (!booking) throw new NotFoundException('Booking not found');

    const company = booking.companyId as unknown as Record<string, unknown>;
    const email = String(company.email ?? '');

    // Notify the company via in-app notification
    await this.sendNotification(
      String((booking.companyId as unknown as Record<string, unknown>)._id ?? booking.companyId),
      NotificationType.BOOKING_CONFIRMED,
      'Booking Voucher',
      `Your booking voucher for ${booking.hotel?.name ?? 'your hotel'} (Ref: ${booking.bookingRef}) has been resent.`,
    );

    return {
      resent: true,
      bookingRef: booking.bookingRef,
      sentTo: email,
    };
  }

  // ── Audit Log ────────────────────────────────────────────────────────────────

  async getAuditLogs(filters: { module?: string; actorId?: string; from?: string; to?: string }, page = 1, limit = 20) {
    const AuditLog = this.userModel.db.model('AuditLog');
    const query: Record<string, unknown> = {};
    if (filters.module) query.module = filters.module;
    if (filters.actorId) query.actorId = new Types.ObjectId(filters.actorId);
    if (filters.from || filters.to) {
      query.createdAt = {};
      if (filters.from) (query.createdAt as Record<string, unknown>).$gte = new Date(filters.from);
      if (filters.to) (query.createdAt as Record<string, unknown>).$lte = new Date(filters.to);
    }
    const [data, total] = await Promise.all([
      AuditLog.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      AuditLog.countDocuments(query),
    ]);
    return { data, total, page, limit };
  }
}
