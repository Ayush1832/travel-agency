import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  getForUser(
    @CurrentUser() user: { userId: string; companyId: string },
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.notificationsService.getForUser(
      user.userId,
      user.companyId,
      parseInt(page, 10),
      parseInt(limit, 10),
    );
  }

  @Get('unread-count')
  getUnreadCount(@CurrentUser() user: { userId: string; companyId: string }) {
    return this.notificationsService
      .getUnreadCount(user.userId, user.companyId)
      .then((count) => ({ count }));
  }

  @Patch(':id/read')
  markRead(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.notificationsService.markRead(id, user.userId);
  }

  @Post('read-all')
  markAllRead(@CurrentUser() user: { userId: string }) {
    return this.notificationsService
      .markAllRead(user.userId)
      .then(() => ({ message: 'All notifications marked as read' }));
  }
}
