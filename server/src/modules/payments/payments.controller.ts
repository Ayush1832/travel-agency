import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  Headers,
  ParseIntPipe,
  DefaultValuePipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaymentsService } from './payments.service';
import type { AuthUser } from '../../common/types/auth-user.types';
import { CreateOrderDto } from './dto/create-order.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { RefundPaymentDto } from './dto/refund-payment.dto';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * POST /payments/create-order
   * Create a PayTabs payment order and return the redirect URL.
   */
  @UseGuards(JwtAuthGuard)
  @Post('create-order')
  createOrder(@Body() dto: CreateOrderDto, @CurrentUser() user: AuthUser) {
    return this.paymentsService.createOrder(dto, user);
  }

  /**
   * POST /payments/verify
   * Verify payment status by querying PayTabs (client-triggered after redirect).
   */
  @UseGuards(JwtAuthGuard)
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  verifyPayment(@Body() dto: VerifyPaymentDto, @CurrentUser() user: AuthUser) {
    return this.paymentsService.verifyPayment(dto.orderId, user._id);
  }

  /**
   * POST /payments/refund
   * Initiate a refund for a completed payment (admin/internal use).
   */
  @UseGuards(JwtAuthGuard)
  @Post('refund')
  @HttpCode(HttpStatus.OK)
  processRefund(@Body() dto: RefundPaymentDto) {
    return this.paymentsService.processRefund(
      dto.paymentId,
      dto.amount,
      dto.reason,
    );
  }

  /**
   * POST /payments/webhook/:gateway
   * Webhook receiver — NO JWT guard (called by PayTabs, not browser).
   * PayTabs sends the IPN as a POST with JSON body.
   * The signature is provided as a field inside the body or as a header.
   */
  @Post('webhook/:gateway')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Param('gateway') gateway: string,
    @Body() payload: unknown,
    @Req() req: Request & { rawBody?: string },
    @Headers('signature') headerSignature?: string,
  ) {
    const bodySignature =
      payload && typeof payload === 'object'
        ? (payload as Record<string, unknown>)['signature'] as string | undefined
        : undefined;

    const signature = headerSignature ?? bodySignature ?? '';

    // Use raw body string for HMAC computation; fall back to JSON.stringify
    const rawBody: string = req.rawBody ?? JSON.stringify(payload);

    return this.paymentsService.handleWebhook(gateway, payload, rawBody, signature);
  }

  /**
   * GET /payments
   * Paginated payment history for the authenticated user's company.
   */
  @UseGuards(JwtAuthGuard)
  @Get()
  getHistory(
    @CurrentUser() user: AuthUser,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    if (!user.companyId) return { data: [], total: 0, page, limit };
    return this.paymentsService.getHistory(user.companyId, page, limit);
  }
}
