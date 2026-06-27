import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { NotificationsService } from './notifications.service';

@Controller('api/notifications')
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  private user(req: Request) {
    return (req as unknown as { user: { id: string; organizationId: string } }).user;
  }

  @Get()
  list(@Req() req: Request, @Query('limit') limit?: string) {
    const { id, organizationId } = this.user(req);
    return this.svc.listForUser(id, organizationId, limit ? Number(limit) : 50);
  }

  @Get('unread-count')
  unreadCount(@Req() req: Request) {
    const { id, organizationId } = this.user(req);
    return this.svc.unreadCount(id, organizationId).then((count) => ({ count }));
  }

  @Post('mark-read')
  @HttpCode(HttpStatus.NO_CONTENT)
  markRead(@Req() req: Request, @Body() body: { ids: string[] }) {
    const { id } = this.user(req);
    return this.svc.markRead(body.ids ?? [], id);
  }

  @Post('mark-all-read')
  @HttpCode(HttpStatus.NO_CONTENT)
  markAllRead(@Req() req: Request) {
    const { id, organizationId } = this.user(req);
    return this.svc.markAllRead(id, organizationId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  dismiss(@Req() req: Request, @Param('id') id: string) {
    const { id: userId } = this.user(req);
    return this.svc.dismiss(id, userId);
  }
}
