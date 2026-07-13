import {
  Controller, Get, Post, Patch, Body, Param, Query,
  UseGuards, Req, UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { WorkingHoursService } from './working-hours.service';

interface AuthUser { id: string; orgId: string | null }
function getUser(req: Request): { id: string; orgId: string } {
  const u = (req as Request & { user?: AuthUser }).user;
  if (!u?.orgId) throw new UnauthorizedException('No organization context');
  return { id: u.id, orgId: u.orgId };
}

@Controller('api/working-hours')
@UseGuards(AuthGuard)
export class WorkingHoursController {
  constructor(private readonly svc: WorkingHoursService) {}

  @Get('schedule')
  getSchedule(@Req() req: Request, @Query('locationId') locationId?: string) {
    return this.svc.getSchedule(getUser(req).orgId, locationId);
  }

  @Post('schedule')
  upsertSchedule(
    @Req() req: Request,
    @Body() body: {
      locationId?: string;
      schedule: Array<{ dayOfWeek: number; openTime: string; closeTime: string; isOpen: boolean }>;
    },
  ) {
    return this.svc.upsertSchedule(getUser(req).orgId, body.locationId ?? null, body.schedule);
  }

  @Get('chairs')
  listChairs(@Req() req: Request, @Query('locationId') locationId?: string) {
    return this.svc.listChairs(getUser(req).orgId, locationId);
  }

  @Post('chairs')
  createChair(
    @Req() req: Request,
    @Body() body: { name: string; locationId?: string; chairType?: string },
  ) {
    return this.svc.createChair(getUser(req).orgId, body);
  }

  @Patch('chairs/:id')
  updateChair(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: Partial<{ name: string; chairType: string; isActive: boolean }>,
  ) {
    return this.svc.updateChair(id, getUser(req).orgId, body);
  }
}
