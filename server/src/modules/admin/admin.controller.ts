import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { AdminService } from './admin.service';
import { SupportService } from '../support/support.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermission } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../db/schemas/user.schema';
import { TicketStatus } from '../../db/schemas/support-ticket.schema';
import {
  RejectClientDto,
  SuspendClientDto,
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
  AdminUpdateTicketDto,
  AdminReplyTicketDto,
} from './dto/admin.dto';

interface AuthUser {
  userId: string;
  companyId: string;
  role: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.SUB_ADMIN)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly supportService: SupportService,
  ) {}

  // ── Clients ──────────────────────────────────────────────────────────────────

  @Get('clients')
  @RequirePermission('clients', 'view')
  listClients(
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.adminService.listClients(
      { status, search },
      parseInt(page, 10),
      parseInt(limit, 10),
    );
  }

  @Get('clients/outstanding')
  @RequirePermission('credit', 'view')
  getOutstanding(@Query('aging') aging?: string) {
    return this.adminService.getOutstanding(aging);
  }

  @Post('outstanding/:companyId/remind')
  @RequirePermission('credit', 'edit')
  remindOutstanding(
    @Param('companyId') companyId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.adminService.remindOutstanding(companyId, user.userId);
  }

  @Get('clients/:id')
  @RequirePermission('clients', 'view')
  getClientDetail(@Param('id') id: string) {
    return this.adminService.getClientDetail(id);
  }

  @Patch('clients/:id')
  @RequirePermission('clients', 'edit')
  updateClient(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    const allowed = ['name', 'phone', 'notes', 'taxId', 'businessRegistrationNo'];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (body[key] !== undefined) updates[key] = body[key];
    }
    return this.adminService.updateClientProfile(id, updates);
  }

  @Post('clients/:id/approve')
  @RequirePermission('clients', 'edit')
  approveClient(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.adminService.approveClient(id, user.userId);
  }

  @Post('clients/:id/reject')
  @RequirePermission('clients', 'edit')
  rejectClient(
    @Param('id') id: string,
    @Body() dto: RejectClientDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.adminService.rejectClient(id, user.userId, dto.reason);
  }

  @Post('clients/:id/suspend')
  @RequirePermission('clients', 'edit')
  suspendClient(
    @Param('id') id: string,
    @Body() dto: SuspendClientDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.adminService.suspendClient(id, user.userId, dto.reason);
  }

  @Post('clients/:id/activate')
  @RequirePermission('clients', 'edit')
  activateClient(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.adminService.activateClient(id, user.userId);
  }

  @Patch('clients/:id/credit-limit')
  @RequirePermission('credit', 'edit')
  updateCreditLimit(
    @Param('id') id: string,
    @Body() dto: UpdateCreditLimitDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.adminService.updateCreditLimit(id, dto, user.userId);
  }

  @Post('clients/:id/topup')
  @RequirePermission('credit', 'create')
  topUpWallet(
    @Param('id') id: string,
    @Body() dto: TopUpWalletDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.adminService.adminTopUpWallet(id, dto, user.userId);
  }

  @Post('clients/:id/settlement')
  @RequirePermission('credit', 'create')
  recordSettlement(
    @Param('id') id: string,
    @Body() dto: RecordSettlementDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.adminService.recordSettlement(id, dto, user.userId);
  }

  @Get('clients/:id/transactions')
  @RequirePermission('credit', 'view')
  getClientTransactions(
    @Param('id') id: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.adminService.getClientTransactions(
      id,
      parseInt(page, 10),
      parseInt(limit, 10),
    );
  }

  // ── Bookings ─────────────────────────────────────────────────────────────────

  @Get('bookings')
  @RequirePermission('bookings', 'view')
  listAllBookings(
    @Query('status') status?: string,
    @Query('companyId') companyId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.adminService.listAllBookings(
      { status, companyId, from, to },
      parseInt(page, 10),
      parseInt(limit, 10),
    );
  }

  @Get('bookings/export')
  @RequirePermission('bookings', 'view')
  async exportBookings(
    @Query('format') format = 'csv',
    @Query('status') status?: string,
    @Query('companyId') companyId?: string,
    @Res() res?: Response,
  ) {
    const data = await this.adminService.exportBookings(
      { status: status || '', companyId: companyId || '' },
      format,
    );

    const flatData = (data as unknown[]).map((b) => b as Record<string, unknown>);

    if (format === 'csv') {
      const headers = [
        'bookingRef',
        'status',
        'hotel',
        'checkIn',
        'checkOut',
        'totalAmount',
        'currency',
        'createdAt',
      ];
      const rows = flatData.map((b) =>
        headers
          .map((h) => {
            if (h === 'hotel') return (b.hotel as Record<string, unknown>)?.name || '';
            return String(b[h] ?? '');
          })
          .join(','),
      );
      const csv = [headers.join(','), ...rows].join('\n');
      res!.setHeader('Content-Type', 'text/csv');
      res!.setHeader('Content-Disposition', 'attachment; filename=bookings.csv');
      return res!.send(csv);
    }

    return res!.json({ data });
  }

  @Get('bookings/:id')
  @RequirePermission('bookings', 'view')
  getBooking(@Param('id') id: string) {
    return this.adminService.getBooking(id);
  }

  @Patch('bookings/:id/status')
  @RequirePermission('bookings', 'edit')
  updateBookingStatus(
    @Param('id') id: string,
    @Body() dto: UpdateBookingStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.adminService.updateBookingStatus(id, dto, user.userId);
  }

  @Post('bookings/:id/refund')
  @RequirePermission('bookings', 'edit')
  refundBooking(
    @Param('id') id: string,
    @Body() dto: RefundBookingDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.adminService.refundBooking(id, dto, user.userId);
  }

  @Post('bookings/:id/resync')
  @RequirePermission('bookings', 'edit')
  resyncBooking(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.adminService.resyncBooking(id, user.userId);
  }

  // ── Roles ────────────────────────────────────────────────────────────────────

  @Get('roles')
  listRoles() {
    return this.adminService.listRoles();
  }

  @Post('roles')
  createRole(@Body() dto: CreateRoleDto) {
    return this.adminService.createRole(dto);
  }

  @Patch('roles/:id')
  updateRole(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.adminService.updateRole(id, dto);
  }

  @Delete('roles/:id')
  deleteRole(@Param('id') id: string) {
    return this.adminService.deleteRole(id);
  }

  // ── Sub-Admins ───────────────────────────────────────────────────────────────

  @Get('sub-admins')
  listSubAdmins() {
    return this.adminService.listSubAdmins();
  }

  @Post('sub-admins')
  createSubAdmin(@Body() dto: CreateSubAdminDto) {
    return this.adminService.createSubAdmin(dto);
  }

  @Patch('sub-admins/:id')
  updateSubAdmin(@Param('id') id: string, @Body() dto: UpdateSubAdminDto) {
    return this.adminService.updateSubAdmin(id, dto);
  }

  @Patch('sub-admins/:id/disable')
  disableSubAdmin(@Param('id') id: string) {
    return this.adminService.disableSubAdmin(id);
  }

  // ── API Integrations ─────────────────────────────────────────────────────────

  @Get('integrations')
  listConfigs() {
    return this.adminService.listConfigs();
  }

  @Patch('integrations/:provider')
  updateConfig(@Param('provider') provider: string, @Body() dto: UpdateApiConfigDto) {
    return this.adminService.updateConfig(provider, dto);
  }

  @Post('integrations/:provider/test')
  testConfig(@Param('provider') provider: string) {
    return this.adminService.testConfig(provider);
  }

  // ── Loyalty Rules ────────────────────────────────────────────────────────────

  @Get('loyalty-rules')
  listLoyaltyRules() {
    return this.adminService.listLoyaltyRules();
  }

  @Post('loyalty-rules')
  createLoyaltyRule(@Body() dto: CreateLoyaltyRuleDto) {
    return this.adminService.createLoyaltyRule(dto);
  }

  @Patch('loyalty-rules/:id')
  updateLoyaltyRule(@Param('id') id: string, @Body() dto: UpdateLoyaltyRuleDto) {
    return this.adminService.updateLoyaltyRule(id, dto);
  }

  // ── Admin Support ─────────────────────────────────────────────────────────────

  @Get('support/tickets')
  @RequirePermission('support', 'view')
  adminListTickets(
    @Query('status') status?: string,
    @Query('assignedTo') assignedTo?: string,
    @Query('companyId') companyId?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.supportService.adminListTickets(
      { status, assignedTo, companyId },
      parseInt(page, 10),
      parseInt(limit, 10),
    );
  }

  @Patch('support/tickets/:id')
  @RequirePermission('support', 'edit')
  adminUpdateTicket(@Param('id') id: string, @Body() dto: AdminUpdateTicketDto) {
    return this.supportService.adminUpdateTicket(id, {
      assignedTo: dto.assignedTo,
      status: dto.status as TicketStatus | undefined,
    });
  }

  @Post('support/tickets/:id/reply')
  @RequirePermission('support', 'edit')
  adminReplyToTicket(
    @Param('id') id: string,
    @Body() dto: AdminReplyTicketDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.supportService.adminReplyToTicket(id, user.userId, dto.body);
  }
}
