import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { RegulatoryComplianceService } from './regulatory-compliance.service';

interface AuthUser { id: string; orgId: string | null }
function getUser(req: Request): { id: string; orgId: string } {
  const u = (req as Request & { user?: AuthUser }).user;
  if (!u?.orgId) throw new UnauthorizedException('No organization context');
  return { id: u.id, orgId: u.orgId };
}

@Controller('api/compliance')
@UseGuards(AuthGuard)
export class RegulatoryComplianceController {
  constructor(private readonly svc: RegulatoryComplianceService) {}

  @Get()
  list(@Req() req: Request, @Query('category') category?: string) {
    return this.svc.listRequirements(getUser(req).orgId, category);
  }

  @Get('score')
  score(@Req() req: Request) { return this.svc.getComplianceScore(getUser(req).orgId); }

  @Post('seed')
  seed(@Req() req: Request) {
    const { id, orgId } = getUser(req);
    return this.svc.seedDefaults(orgId, id);
  }

  @Post()
  create(@Req() req: Request, @Body() body: { requirementName: string; category?: string; description?: string; dueDate?: string }) {
    return this.svc.createRequirement(getUser(req).orgId, body);
  }

  @Patch(':reqId/status')
  updateStatus(
    @Req() req: Request,
    @Param('reqId') reqId: string,
    @Body() body: { status: string; evidenceUrl?: string },
  ) {
    const { id, orgId } = getUser(req);
    return this.svc.updateStatus(reqId, orgId, id, body);
  }
}
