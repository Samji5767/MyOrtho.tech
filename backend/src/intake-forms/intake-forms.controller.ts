import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { IntakeFormsService } from './intake-forms.service';

interface AuthUser { id: string; orgId: string | null }
function getUser(req: Request): { id: string; orgId: string } {
  const u = (req as Request & { user?: AuthUser }).user;
  if (!u?.orgId) throw new UnauthorizedException('No organization context');
  return { id: u.id, orgId: u.orgId };
}

@Controller('api/intake-forms')
@UseGuards(AuthGuard)
export class IntakeFormsController {
  constructor(private readonly svc: IntakeFormsService) {}

  @Get('templates')
  listTemplates(@Req() req: Request, @Query('formType') formType?: string) {
    return this.svc.listTemplates(getUser(req).orgId, formType);
  }

  @Post('templates')
  createTemplate(@Req() req: Request, @Body() body: { templateName: string; formType?: string; fields?: unknown[] }) {
    return this.svc.createTemplate(getUser(req).orgId, body);
  }

  @Patch('templates/:id')
  updateTemplate(@Req() req: Request, @Param('id') id: string, @Body() body: { templateName?: string; formType?: string; fields?: unknown[]; isActive?: boolean }) {
    return this.svc.updateTemplate(id, getUser(req).orgId, body);
  }

  @Post('submit')
  submit(@Req() req: Request, @Body() body: { templateId: string; patientId?: string; caseId?: string; submittedData: Record<string, unknown> }) {
    return this.svc.submit(getUser(req).orgId, body);
  }

  @Get('templates/:templateId/submissions')
  listSubmissions(@Req() req: Request, @Param('templateId') templateId: string) {
    return this.svc.listSubmissions(getUser(req).orgId, templateId);
  }

  @Patch('submissions/:id/review')
  review(@Req() req: Request, @Param('id') id: string) {
    const { id: userId, orgId } = getUser(req);
    return this.svc.review(id, orgId, userId);
  }
}
