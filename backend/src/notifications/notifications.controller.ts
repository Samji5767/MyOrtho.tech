import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { NotificationsService } from './notifications.service';

@Controller('api/notifications')
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  private user(req: Request) {
    return (req as unknown as { user: { id: string; orgId: string } }).user;
  }

  @Get()
  list(@Req() req: Request, @Query('limit') limit?: string) {
    const { id, orgId } = this.user(req);
    return this.svc.listForUser(id, orgId, limit ? Number(limit) : 50);
  }

  @Get('unread-count')
  async unreadCount(@Req() req: Request) {
    const { id, orgId } = this.user(req);
    const count = await this.svc.unreadCount(id, orgId);
    return { count };
  }

  @Post('mark-read')
  @HttpCode(HttpStatus.NO_CONTENT)
  markRead(@Req() req: Request, @Body() body: { ids: string[] }) {
    const { id, orgId } = this.user(req);
    return this.svc.markRead(body.ids ?? [], id, orgId);
  }

  @Post('mark-all-read')
  @HttpCode(HttpStatus.NO_CONTENT)
  markAllRead(@Req() req: Request) {
    const { id, orgId } = this.user(req);
    return this.svc.markAllRead(id, orgId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  dismiss(@Req() req: Request, @Param('id') id: string) {
    const { id: userId } = this.user(req);
    return this.svc.dismiss(id, userId);
  }

  @Get('preferences')
  async getPrefs(@Req() req: Request) {
    const { id } = this.user(req);
    const prefs = await this.svc.getPrefs(id);
    return { prefs };
  }

  @Put('preferences')
  @HttpCode(HttpStatus.NO_CONTENT)
  async setPrefs(
    @Req() req: Request,
    @Body() body: { prefs: Record<string, boolean> },
  ) {
    const { id, orgId } = this.user(req);
    await this.svc.setPrefs(id, orgId, body.prefs ?? {});
  }
}
