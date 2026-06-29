import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { WorkflowBuilderService } from './workflow-builder.service';

interface AuthUser { id: string; orgId: string | null }
function getUser(req: Request): { id: string; orgId: string } {
  const u = (req as Request & { user?: AuthUser }).user;
  if (!u?.orgId) throw new UnauthorizedException('No organization context');
  return { id: u.id, orgId: u.orgId };
}

@Controller('api/workflows')
@UseGuards(AuthGuard)
export class WorkflowBuilderController {
  constructor(private readonly svc: WorkflowBuilderService) {}

  @Get()
  list(@Req() req: Request) { return this.svc.listTemplates(getUser(req).orgId); }

  @Post()
  create(
    @Req() req: Request,
    @Body() body: { name: string; description?: string; triggerEvent: string; steps: { type: string; config: Record<string, unknown> }[] },
  ) {
    const { id, orgId } = getUser(req);
    return this.svc.createTemplate(orgId, id, body as Parameters<WorkflowBuilderService['createTemplate']>[2]);
  }

  @Patch(':templateId/toggle')
  toggle(@Req() req: Request, @Param('templateId') templateId: string, @Body() body: { isActive: boolean }) {
    return this.svc.toggleTemplate(templateId, getUser(req).orgId, body.isActive);
  }

  @Post(':templateId/execute')
  execute(@Req() req: Request, @Param('templateId') templateId: string, @Body() body: Record<string, unknown>) {
    return this.svc.executeWorkflow(templateId, getUser(req).orgId, body);
  }

  @Get('executions')
  listExecutions(@Req() req: Request, @Query('templateId') templateId?: string) {
    return this.svc.listExecutions(getUser(req).orgId, templateId);
  }
}
