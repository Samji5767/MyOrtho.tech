import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { PatientEducationService } from './patient-education.service';

interface AuthUser { id: string; orgId: string | null }
function getUser(req: Request): { id: string; orgId: string } {
  const u = (req as Request & { user?: AuthUser }).user;
  if (!u?.orgId) throw new UnauthorizedException('No organization context');
  return { id: u.id, orgId: u.orgId };
}

@Controller('api/education')
@UseGuards(AuthGuard)
export class PatientEducationController {
  constructor(private readonly svc: PatientEducationService) {}

  @Get('content')
  listContent(@Req() req: Request, @Query('category') category?: string) {
    return this.svc.listContent(getUser(req).orgId, category);
  }

  @Post('content')
  createContent(@Req() req: Request, @Body() body: { title: string; category?: string; contentType?: string; contentUrl?: string; bodyText?: string; tags?: string[] }) {
    return this.svc.createContent(getUser(req).orgId, body);
  }

  @Get('cases/:caseId/assignments')
  listAssignments(@Req() req: Request, @Param('caseId') caseId: string) {
    return this.svc.listAssignments(caseId, getUser(req).orgId);
  }

  @Post('cases/:caseId/assignments')
  assign(@Req() req: Request, @Param('caseId') caseId: string, @Body() body: { contentId: string }) {
    const { id, orgId } = getUser(req);
    return this.svc.assign(caseId, orgId, id, body.contentId);
  }

  @Patch('assignments/:id/viewed')
  markViewed(@Req() req: Request, @Param('id') id: string) {
    return this.svc.markViewed(id, getUser(req).orgId);
  }

  @Patch('assignments/:id/completed')
  markCompleted(@Req() req: Request, @Param('id') id: string) {
    return this.svc.markCompleted(id, getUser(req).orgId);
  }
}
