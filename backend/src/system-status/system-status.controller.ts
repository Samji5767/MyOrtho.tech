import { Controller, Get, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { SystemStatusService } from './system-status.service';

interface AuthUser { sub?: string; role?: string; orgId?: string }

@Controller('api/system')
@UseGuards(AuthGuard)
export class SystemStatusController {
  constructor(private readonly statusService: SystemStatusService) {}

  /** Full production readiness report — super_admin and admin only. */
  @Get('status')
  async getStatus(@Req() req: Request) {
    const user = (req as Request & { user?: AuthUser }).user;
    if (!user || !['super_admin', 'admin'].includes(user.role ?? '')) {
      throw new ForbiddenException('Admin role required to view system status');
    }
    return this.statusService.getSystemStatus();
  }

  /** Public liveness probe — returns 200 if the API is up. */
  @Get('ping')
  ping() {
    return { ok: true, ts: new Date().toISOString() };
  }
}
