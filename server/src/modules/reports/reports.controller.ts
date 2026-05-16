import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../db/schemas/user.schema';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.SUB_ADMIN)
@Controller('admin/reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('revenue')
  getRevenueReport(
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const fromDate = from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const toDate = to || new Date().toISOString();
    return this.reportsService.getRevenueReport(fromDate, toDate);
  }

  @Get('bookings')
  getBookingsReport(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('groupBy') groupBy?: string,
  ) {
    const fromDate = from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const toDate = to || new Date().toISOString();
    return this.reportsService.getBookingsReport(fromDate, toDate, groupBy);
  }

  @Get('credit')
  getCreditReport(
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const fromDate = from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const toDate = to || new Date().toISOString();
    return this.reportsService.getCreditReport(fromDate, toDate);
  }

  @Get('api-usage')
  getApiUsageReport(
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const fromDate = from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const toDate = to || new Date().toISOString();
    return this.reportsService.getApiUsageReport(fromDate, toDate);
  }

  @Get('cancellation')
  getCancellationReport(
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const fromDate = from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const toDate = to || new Date().toISOString();
    return this.reportsService.getCancellationReport(fromDate, toDate);
  }

  @Get(':type/export')
  async exportReport(
    @Param('type') type: string,
    @Query('format') format = 'csv',
    @Query('from') from: string,
    @Query('to') to: string,
    @Res() res: Response,
  ) {
    const fromDate = from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const toDate = to || new Date().toISOString();

    let rawData: Record<string, unknown>;

    if (type === 'revenue') {
      rawData = await this.reportsService.getRevenueReport(fromDate, toDate);
    } else if (type === 'bookings') {
      rawData = await this.reportsService.getBookingsReport(fromDate, toDate);
    } else if (type === 'credit') {
      rawData = await this.reportsService.getCreditReport(fromDate, toDate);
    } else if (type === 'api-usage') {
      rawData = await this.reportsService.getApiUsageReport(fromDate, toDate);
    } else if (type === 'cancellation') {
      rawData = await this.reportsService.getCancellationReport(fromDate, toDate);
    } else {
      return res.status(400).json({ message: 'Unknown report type' });
    }

    // Flatten the relevant array for export
    const dataArray: Record<string, unknown>[] = Array.isArray(rawData)
      ? rawData
      : Array.isArray((rawData as Record<string, unknown>).daily)
      ? (rawData as { daily: Record<string, unknown>[] }).daily
      : Array.isArray((rawData as Record<string, unknown>).byType)
      ? (rawData as { byType: Record<string, unknown>[] }).byType
      : Array.isArray((rawData as Record<string, unknown>).bySupplier)
      ? (rawData as { bySupplier: Record<string, unknown>[] }).bySupplier
      : Array.isArray((rawData as Record<string, unknown>).byCompany)
      ? (rawData as { byCompany: Record<string, unknown>[] }).byCompany
      : [rawData];

    if (format === 'excel') {
      const buffer = await this.reportsService.exportToExcel(dataArray, `${type}_report`);
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader('Content-Disposition', `attachment; filename=${type}_report.xlsx`);
      return res.send(buffer);
    }

    // Default: CSV
    const csv = this.reportsService.exportToCsv(dataArray);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${type}_report.csv`);
    return res.send(csv);
  }
}
