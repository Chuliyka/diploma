import { Controller, Get, Param, ParseIntPipe, Patch, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findMine(@Req() req: any) {
    return this.notificationsService.findMine(req.user.id);
  }

  @Get('unread-count')
  countUnread(@Req() req: any) {
    return this.notificationsService.countUnread(req.user.id);
  }

  @Patch(':notificationId/read')
  markRead(@Req() req: any, @Param('notificationId', ParseIntPipe) notificationId: number) {
    return this.notificationsService.markRead(req.user.id, notificationId);
  }
}