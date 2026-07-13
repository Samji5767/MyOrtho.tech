import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { RadiologyService } from './radiology.service';

interface AuthUser { id: string; orgId: string | null }
function getUser(req: Request): { id: string; orgId: string } {
  const u = (req as Request & { user?: AuthUser }).user;
  if (!u?.orgId) throw new UnauthorizedException('No organization context');
  return { id: u.id, orgId: u.orgId };
}

@Controller('api/radiology')
@UseGuards(AuthGuard, PermissionsGuard)
@RequirePermission('cases:read')
export class RadiologyController {
  constructor(private readonly svc: RadiologyService) {}

  @Get()
  list(
    @Req() req: Request,
    @Query('patientId') patientId?: string,
    @Query('caseId') caseId?: string,
    @Query('imageType') imageType?: string,
  ) {
    return this.svc.list(getUser(req).orgId, { patientId, caseId, imageType });
  }

  @Post()
  upload(
    @Req() req: Request,
    @Body() body: { patientId: string; caseId?: string; imageType?: string; fileUrl: string; captureDate?: string; notes?: string },
  ) {
    const { id, orgId } = getUser(req);
    return this.svc.upload(orgId, id, body);
  }

  @Delete(':id')
  remove(@Req() req: Request, @Param('id') id: string) {
    return this.svc.delete(id, getUser(req).orgId);
  }
}
