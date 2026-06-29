import { Controller, Get, Post, Patch, Body, Param, UseGuards, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { TrainingService } from './training.service';

interface AuthUser { id: string; orgId: string | null }
function getUser(req: Request): { id: string; orgId: string } {
  const u = (req as Request & { user?: AuthUser }).user;
  if (!u?.orgId) throw new UnauthorizedException('No organization context');
  return { id: u.id, orgId: u.orgId };
}

@Controller('api/training')
@UseGuards(AuthGuard)
export class TrainingController {
  constructor(private readonly svc: TrainingService) {}

  @Get('activities')
  listOrg(@Req() req: Request) {
    return this.svc.listOrgActivities(getUser(req).orgId);
  }

  @Get('activities/my')
  listMy(@Req() req: Request) {
    const { id, orgId } = getUser(req);
    return this.svc.listActivities(orgId, id);
  }

  @Get('activities/my/summary')
  mySummary(@Req() req: Request) {
    const { id, orgId } = getUser(req);
    return this.svc.getCpdSummary(orgId, id);
  }

  @Post('activities')
  log(
    @Req() req: Request,
    @Body() body: { title: string; provider?: string; activityType?: string; cpdHours: number; completionDate: string; certificateUrl?: string; notes?: string },
  ) {
    const { id, orgId } = getUser(req);
    return this.svc.logActivity(orgId, id, body);
  }

  @Patch('activities/:activityId/verify')
  verify(@Req() req: Request, @Param('activityId') activityId: string) {
    return this.svc.verifyActivity(activityId, getUser(req).orgId);
  }

  @Post('users/:userId/requirement')
  setRequirement(
    @Req() req: Request,
    @Param('userId') userId: string,
    @Body() body: { periodStart: string; periodEnd: string; requiredHours: number },
  ) {
    return this.svc.setRequirement(getUser(req).orgId, userId, body);
  }
}
