import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { BackgroundJobsService } from './background-jobs.service';

interface AuthUser { id: string; orgId: string | null }
function getUser(req: Request): { id: string; orgId: string } {
  const u = (req as Request & { user?: AuthUser }).user;
  if (!u?.orgId) throw new UnauthorizedException('No organization context');
  return { id: u.id, orgId: u.orgId };
}

@Controller('api/background-jobs')
@UseGuards(AuthGuard)
export class BackgroundJobsController {
  constructor(private readonly svc: BackgroundJobsService) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @RequirePermission('admin:settings')
  list(
    @Req() req: Request,
    @Query('status') status?: string,
    @Query('jobType') jobType?: string,
    @Query('limit') limit?: string,
  ) {
    const { orgId } = getUser(req);
    return this.svc.list(orgId, { status, jobType, limit: limit ? parseInt(limit, 10) : 100 });
  }

  @Get('stats')
  @UseGuards(PermissionsGuard)
  @RequirePermission('admin:settings')
  stats(@Req() req: Request) {
    const { orgId } = getUser(req);
    return this.svc.getStats(orgId);
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('admin:settings')
  get(@Req() req: Request, @Param('id') id: string) {
    const { orgId } = getUser(req);
    return this.svc.get(id, orgId);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermission('admin:settings')
  enqueue(@Req() req: Request, @Body() body: Record<string, unknown>) {
    const { id, orgId } = getUser(req);
    return this.svc.enqueue(orgId, id, {
      jobType: body['jobType'] as string,
      payloadJson: body['payloadJson'] as Record<string, unknown> | undefined,
      priority: body['priority'] as number | undefined,
      maxAttempts: body['maxAttempts'] as number | undefined,
      runAt: body['runAt'] as string | undefined,
    });
  }

  @Post(':id/cancel')
  @UseGuards(PermissionsGuard)
  @RequirePermission('admin:settings')
  cancel(@Req() req: Request, @Param('id') id: string) {
    const { orgId } = getUser(req);
    return this.svc.cancel(id, orgId);
  }
}
