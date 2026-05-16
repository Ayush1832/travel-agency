import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Res,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';

@UseGuards(JwtAuthGuard)
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  /**
   * POST /api/v1/bookings
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createBooking(
    @Body() dto: CreateBookingDto,
    @CurrentUser() user: { _id: string; companyId: string },
  ) {
    return this.bookingsService.createBooking(dto, user, { _id: user.companyId });
  }

  /**
   * GET /api/v1/bookings?status=&from=&to=&page=&limit=
   */
  @Get()
  async findAll(
    @CurrentUser() user: { _id: string; companyId: string },
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) {
    return this.bookingsService.findAll(user.companyId, { status, from, to, page, limit });
  }

  /**
   * GET /api/v1/bookings/:id
   */
  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: { _id: string; companyId: string },
  ) {
    return this.bookingsService.findOne(id, user.companyId);
  }

  /**
   * GET /api/v1/bookings/:id/voucher
   * Streams PDF directly
   */
  @Get(':id/voucher')
  async getVoucher(
    @Param('id') id: string,
    @CurrentUser() user: { _id: string; companyId: string },
    @Res() res: Response,
  ) {
    const buffer = await this.bookingsService.getVoucherPdf(id, user.companyId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="voucher-${id}.pdf"`);
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  }

  /**
   * POST /api/v1/bookings/:id/cancel
   */
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelBooking(
    @Param('id') id: string,
    @Body() dto: CancelBookingDto,
    @CurrentUser() user: { _id: string; companyId: string },
  ) {
    return this.bookingsService.cancelBooking(id, user.companyId, user, dto);
  }
}
