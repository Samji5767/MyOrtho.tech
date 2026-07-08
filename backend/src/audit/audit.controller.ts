import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import type { AuthenticatedRequest } from '../common/auth-request.type';
import { AuditService } from './audit.service';

@Controller()
@UseGuards(AuthGuard, PermissionsGuard)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get('api/audit/events')
  @RequirePermission('audit:read')
  listEvents(
    @Req() req: AuthenticatedRequest,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.audit.findByOrg(req.user.orgId, {
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });
  }

  @Get('api/audit/events/resource/:resourceType/:resourceId')
  @RequirePermission('audit:read')
  listByResource(
    @Req() req: AuthenticatedRequest,
    @Param('resourceType') resourceType: string,
    @Param('resourceId') resourceId: string,
  ) {
    return this.audit.findByResource(resourceType, resourceId, req.user.orgId);
  }

  @Get('api/audit/events/actor/:actorId')
  @RequirePermission('audit:read')
  listByActor(
    @Req() req: AuthenticatedRequest,
    @Param('actorId') actorId: string,
    @Query('limit') limit?: string,
  ) {
    return this.audit.findByActor(actorId, req.user.orgId, limit ? parseInt(limit, 10) : 50);
  }

  @Get('api/audit/summary')
  @RequirePermission('audit:read')
  getSummary(
    @Req() req: AuthenticatedRequest,
    @Query('hours') hours?: string,
  ) {
    const windowHours = hours ? parseInt(hours, 10) : 24;
    return this.audit.getRecentCount(req.user.orgId, windowHours).then(recentCount => ({
      recentCount,
      windowHours,
    }));
  }
}
