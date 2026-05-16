import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { WalletService } from './wallet.service';
import type { AuthUser } from '../../common/types/auth-user.types';
import { TopUpWalletDto } from './dto/topup-wallet.dto';
import { RedeemLoyaltyDto } from './dto/redeem-loyalty.dto';
import { GetTransactionsDto } from './dto/get-transactions.dto';
import { WalletTransactionType } from '../../db/schemas/wallet-transaction.schema';

@UseGuards(JwtAuthGuard)
@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  /**
   * GET /wallet/balance
   * Current credit + wallet + loyalty summary.
   */
  @Get('balance')
  getBalance(@CurrentUser() user: AuthUser) {
    if (!user.companyId) return null;
    return this.walletService.getBalance(user.companyId);
  }

  /**
   * GET /wallet/transactions
   * Paginated transaction ledger with optional filters.
   */
  @Get('transactions')
  getTransactions(
    @CurrentUser() user: AuthUser,
    @Query() query: GetTransactionsDto,
  ) {
    if (!user.companyId) return { data: [], total: 0, page: 1, limit: 20 };

    const page = query.page ? parseInt(query.page, 10) : 1;
    const limit = query.limit ? parseInt(query.limit, 10) : 20;

    return this.walletService.getTransactions(
      user.companyId,
      {
        type: query.type as WalletTransactionType | undefined,
        from: query.from,
        to: query.to,
      },
      page,
      limit,
    );
  }

  /**
   * POST /wallet/topup
   * Create a PayTabs payment order for wallet top-up.
   */
  @Post('topup')
  topUpWallet(@Body() dto: TopUpWalletDto, @CurrentUser() user: AuthUser) {
    if (!user.companyId) return null;
    return this.walletService.topUpWallet(
      user.companyId,
      user,
      dto.amount,
      dto.currency,
      dto.callbackUrl,
    );
  }

  /**
   * GET /wallet/statement
   * Full transaction list for a date range (for exports / reconciliation).
   * Supports ?format=pdf|excel for binary download.
   */
  @Get('statement')
  async getStatement(
    @CurrentUser() user: AuthUser,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('format') format?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    if (!user.companyId) return null;

    if (format === 'excel' || format === 'pdf') {
      const result = await this.walletService.exportStatement(user.companyId, from, to, format);
      if (format === 'excel') {
        res!.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res!.setHeader('Content-Disposition', `attachment; filename=statement-${from}-${to}.xlsx`);
      } else {
        res!.setHeader('Content-Type', 'application/pdf');
        res!.setHeader('Content-Disposition', `attachment; filename=statement-${from}-${to}.pdf`);
      }
      res!.send(result);
      return;
    }

    return this.walletService.getStatement(user.companyId, from, to);
  }

  /**
   * POST /wallet/loyalty/redeem
   * Redeem loyalty points for wallet balance.
   */
  @Post('loyalty/redeem')
  redeemLoyaltyPoints(
    @Body() dto: RedeemLoyaltyDto,
    @CurrentUser() user: AuthUser,
  ) {
    if (!user.companyId) return null;
    return this.walletService.redeemLoyaltyPoints(
      user.companyId,
      user._id,
      dto.points,
    );
  }
}
