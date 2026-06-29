import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { AppointmentsService } from './appointments.service';

interface AuthUser { id: string; orgId: string | null }
function getUser(req: Request): { id: string; orgId: string } {
  const u = (req as Request & { user?: AuthUser }).user;
  if (!u?.orgId) throw new UnauthorizedException('No organization context');
  return { id: u.id, orgId: u.orgId };
}

@Controller('api')
@UseGuards(AuthGuard)
export class AppointmentsController {
  constructor(private readonly svc: AppointmentsService) {}

  @Get('appointment-types')
  listTypes(@Req() req: Request) {
    return this.svc.listTypes(getUser(req).orgId);
  }

  @Get('appointments/upcoming')
  upcoming(@Req() req: Request, @Query('days') days?: string) {
    return this.svc.listUpcoming(getUser(req).orgId, days ? parseInt(days, 10) : 7);
  }

  @Get('cases/:caseId/appointments')
  list(@Req() req: Request, @Param('caseId') caseId: string) {
    return this.svc.listAppointments(caseId, getUser(req).orgId);
  }

  @Post('cases/:caseId/appointments')
  create(
    @Req() req: Request,
    @Param('caseId') caseId: string,
    @Body() body: { appointmentTypeId?: string; scheduledAt: string; durationMinutes?: number; notes?: string },
  ) {
    const { id, orgId } = getUser(req);
    return this.svc.createAppointment(caseId, orgId, { ...body, clinicianId: id });
  }

  @Patch('appointments/:apptId/status')
  updateStatus(@Req() req: Request, @Param('apptId') apptId: string, @Body() body: { status: string }) {
    return this.svc.updateStatus(apptId, getUser(req).orgId, body.status);
  }

  @Get('cases/:caseId/milestones')
  listMilestones(@Req() req: Request, @Param('caseId') caseId: string) {
    return this.svc.listMilestones(caseId, getUser(req).orgId);
  }

  @Post('cases/:caseId/milestones')
  createMilestone(
    @Req() req: Request,
    @Param('caseId') caseId: string,
    @Body() body: { title: string; milestoneType: string; planId?: string; targetDate?: string; notes?: string },
  ) {
    return this.svc.createMilestone(caseId, getUser(req).orgId, body);
  }

  @Patch('milestones/:milestoneId/complete')
  completeMilestone(
    @Req() req: Request,
    @Param('milestoneId') milestoneId: string,
    @Body() body: { notes?: string },
  ) {
    return this.svc.completeMilestone(milestoneId, getUser(req).orgId, body.notes);
  }
}
