import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SupportService } from './support.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateTicketDto, ReplyDto } from './dto/support.dto';

interface AuthUser {
  userId: string;
  companyId: string;
  role: string;
}

@UseGuards(JwtAuthGuard)
@Controller('support/tickets')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post()
  createTicket(@Body() dto: CreateTicketDto, @CurrentUser() user: AuthUser) {
    return this.supportService.createTicket(dto, user);
  }

  @Get()
  listTickets(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: string,
    @Query('category') category?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.supportService.listTickets(
      user.companyId,
      { status, category },
      parseInt(page, 10),
      parseInt(limit, 10),
    );
  }

  @Get(':id')
  getTicket(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.supportService.getTicket(id, user.companyId);
  }

  @Post(':id/reply')
  replyToTicket(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ReplyDto,
  ) {
    return this.supportService.replyToTicket(id, user.companyId, user.userId, dto);
  }

  @Patch(':id/close')
  closeTicket(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.supportService.closeTicket(id, user.companyId);
  }
}
