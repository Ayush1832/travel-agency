import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as ExcelJS from 'exceljs';
import { Booking, BookingDocument } from '../../db/schemas/booking.schema';
import {
  WalletTransaction,
  WalletTransactionDocument,
  WalletTransactionType,
} from '../../db/schemas/wallet-transaction.schema';

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
    @InjectModel(WalletTransaction.name)
    private walletTxModel: Model<WalletTransactionDocument>,
  ) {}

  async getRevenueReport(from: string, to: string) {
    const fromDate = new Date(from);
    const toDate = new Date(to);

    const pipeline = [
      {
        $match: {
          createdAt: { $gte: fromDate, $lte: toDate },
          deletedAt: { $exists: false },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' },
          },
          gross: { $sum: '$totalAmount' },
          markup: { $sum: '$markupAmount' },
          bookingCount: { $sum: 1 },
        },
      },
      {
        $addFields: {
          net: { $subtract: ['$gross', '$markup'] },
          date: {
            $dateFromParts: {
              year: '$_id.year',
              month: '$_id.month',
              day: '$_id.day',
            },
          },
        },
      },
      { $sort: { date: 1 as const } },
    ];

    const daily = await this.bookingModel.aggregate(pipeline);

    const totals = daily.reduce(
      (acc, d) => ({
        gross: acc.gross + d.gross,
        markup: acc.markup + d.markup,
        net: acc.net + d.net,
        bookingCount: acc.bookingCount + d.bookingCount,
      }),
      { gross: 0, markup: 0, net: 0, bookingCount: 0 },
    );

    return { from, to, daily, totals };
  }

  async getBookingsReport(from: string, to: string, groupBy = 'status') {
    const fromDate = new Date(from);
    const toDate = new Date(to);

    const base = {
      createdAt: { $gte: fromDate, $lte: toDate },
      deletedAt: { $exists: false },
    };

    const [byStatus, byCompany, byCity] = await Promise.all([
      this.bookingModel.aggregate([
        { $match: base },
        { $group: { _id: '$status', count: { $sum: 1 }, totalAmount: { $sum: '$totalAmount' } } },
        { $sort: { count: -1 } },
      ]),
      this.bookingModel.aggregate([
        { $match: base },
        {
          $group: {
            _id: '$companyId',
            count: { $sum: 1 },
            totalAmount: { $sum: '$totalAmount' },
          },
        },
        {
          $lookup: {
            from: 'companies',
            localField: '_id',
            foreignField: '_id',
            as: 'company',
          },
        },
        { $unwind: { path: '$company', preserveNullAndEmptyArrays: true } },
        { $project: { companyName: '$company.name', count: 1, totalAmount: 1 } },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ]),
      this.bookingModel.aggregate([
        { $match: base },
        {
          $group: {
            _id: '$hotel.city',
            count: { $sum: 1 },
            totalAmount: { $sum: '$totalAmount' },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ]),
    ]);

    return { from, to, byStatus, byCompany, byCity };
  }

  async getCreditReport(from: string, to: string) {
    const fromDate = new Date(from);
    const toDate = new Date(to);

    const pipeline = [
      { $match: { createdAt: { $gte: fromDate, $lte: toDate } } },
      {
        $group: {
          _id: '$type',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 as const } },
    ];

    const byType = await this.walletTxModel.aggregate(pipeline);

    const summary: Record<string, { totalAmount: number; count: number }> = {};
    for (const t of Object.values(WalletTransactionType)) {
      summary[t] = { totalAmount: 0, count: 0 };
    }
    for (const row of byType) {
      if (summary[row._id]) {
        summary[row._id] = { totalAmount: row.totalAmount, count: row.count };
      }
    }

    return { from, to, byType, summary };
  }

  async exportToExcel(
    data: Record<string, unknown>[],
    sheetName = 'Report',
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(sheetName);

    if (data.length === 0) {
      sheet.addRow(['No data available']);
    } else {
      const headers = Object.keys(data[0]);
      sheet.addRow(headers);

      // Style the header row
      const headerRow = sheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      };

      for (const row of data) {
        sheet.addRow(headers.map((h) => row[h]));
      }

      // Auto-width columns
      sheet.columns.forEach((col) => {
        let maxLen = 10;
        col.eachCell?.({ includeEmpty: true }, (cell) => {
          const len = cell.value ? String(cell.value).length : 0;
          if (len > maxLen) maxLen = len;
        });
        col.width = Math.min(maxLen + 2, 50);
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async getApiUsageReport(from: string, to: string) {
    // Query bookings collection for API call stats
    // Each booking has: supplier field, status, createdAt
    // Group by supplier and status to get: total calls, success rate, error rate
    const fromDate = new Date(from);
    const toDate = new Date(to);

    const bySupplier = await this.bookingModel.aggregate([
      { $match: { createdAt: { $gte: fromDate, $lte: toDate } } },
      {
        $group: {
          _id: '$supplier',
          totalCalls: { $sum: 1 },
          successful: { $sum: { $cond: [{ $in: ['$status', ['confirmed', 'completed']] }, 1, 0] } },
          failed: { $sum: { $cond: [{ $in: ['$status', ['failed', 'cancelled']] }, 1, 0] } },
          totalAmount: { $sum: '$totalAmount' },
        },
      },
      {
        $addFields: {
          successRate: {
            $cond: [
              { $gt: ['$totalCalls', 0] },
              { $multiply: [{ $divide: ['$successful', '$totalCalls'] }, 100] },
              0,
            ],
          },
        },
      },
      { $sort: { totalCalls: -1 } },
    ]);

    const totals = bySupplier.reduce(
      (acc, s) => ({
        totalCalls: acc.totalCalls + s.totalCalls,
        successful: acc.successful + s.successful,
        failed: acc.failed + s.failed,
      }),
      { totalCalls: 0, successful: 0, failed: 0 },
    );

    return { from, to, bySupplier, totals };
  }

  async getCancellationReport(from: string, to: string) {
    const fromDate = new Date(from);
    const toDate = new Date(to);

    const base = {
      status: 'cancelled',
      'cancellation.cancelledAt': { $gte: fromDate, $lte: toDate },
    };

    const [byCompany, totalStats] = await Promise.all([
      this.bookingModel.aggregate([
        { $match: base },
        {
          $group: {
            _id: '$companyId',
            count: { $sum: 1 },
            totalCancellationFee: { $sum: '$cancellation.cancellationFee' },
            totalRefund: { $sum: '$cancellation.refundAmount' },
          },
        },
        {
          $lookup: {
            from: 'companies',
            localField: '_id',
            foreignField: '_id',
            as: 'company',
          },
        },
        { $unwind: { path: '$company', preserveNullAndEmptyArrays: true } },
        { $project: { companyName: '$company.name', count: 1, totalCancellationFee: 1, totalRefund: 1 } },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ]),
      this.bookingModel.aggregate([
        { $match: base },
        {
          $group: {
            _id: null,
            totalCancellations: { $sum: 1 },
            totalCancellationFees: { $sum: '$cancellation.cancellationFee' },
            totalRefunds: { $sum: '$cancellation.refundAmount' },
            totalOriginalValue: { $sum: '$totalAmount' },
          },
        },
      ]),
    ]);

    const stats = totalStats[0] || { totalCancellations: 0, totalCancellationFees: 0, totalRefunds: 0, totalOriginalValue: 0 };

    return { from, to, byCompany, stats };
  }

  exportToCsv(data: Record<string, unknown>[]): string {
    if (data.length === 0) return 'No data available\n';

    const headers = Object.keys(data[0]);
    const escape = (v: unknown) => {
      const s = String(v ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };

    const rows = data.map((row) => headers.map((h) => escape(row[h])).join(','));
    return [headers.join(','), ...rows].join('\n');
  }
}
