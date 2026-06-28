import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { AdminService } from './admin.service';

interface AuthUser { id: string; email: string; role: string; orgId: string | null }

function requireSuperAdmin(req: Request): AuthUser {
  const user = (req as Request & { user?: AuthUser }).user;
  if (!user) throw new ForbiddenException('Authentication required');
  if (user.role !== 'super_admin') throw new ForbiddenException('super_admin role required');
  return user;
}

@Controller('api/admin')
@UseGuards(AuthGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  getStats(@Req() req: Request) {
    requireSuperAdmin(req);
    return this.adminService.getPlatformStats();
  }

  @Get('users')
  listUsers(
    @Req() req: Request,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    requireSuperAdmin(req);
    return this.adminService.listUsers({
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Patch('users/:id/role')
  updateRole(
    @Req() req: Request,
    @Param('id') id: string,
    @Body('role') role: string,
  ) {
    requireSuperAdmin(req);
    return this.adminService.updateUserRole(id, role);
  }

  @Patch('users/:id/active')
  setActive(
    @Req() req: Request,
    @Param('id') id: string,
    @Body('active') active: boolean,
  ) {
    requireSuperAdmin(req);
    return this.adminService.setUserActive(id, active);
  }

  @Get('orgs')
  listOrgs(
    @Req() req: Request,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    requireSuperAdmin(req);
    return this.adminService.listOrgs({
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Post('orgs/:orgId/credits/grant')
  grantCredits(
    @Req() req: Request,
    @Param('orgId') orgId: string,
    @Body('amount') amount: number,
    @Body('notes') notes?: string,
  ) {
    const admin = requireSuperAdmin(req);
    return this.adminService.grantCredits(orgId, amount, admin.email, notes);
  }

  @Get('revenue')
  getRevenue(@Req() req: Request) {
    requireSuperAdmin(req);
    return this.adminService.getRevenueDashboard();
  }

  @Get('feature-flags')
  listFlags(@Req() req: Request) {
    requireSuperAdmin(req);
    return this.adminService.listFeatureFlags();
  }

  @Post('feature-flags/:key')
  upsertFlag(
    @Req() req: Request,
    @Param('key') key: string,
    @Body() dto: { enabled?: boolean; description?: string; rolloutPercentage?: number; allowedOrgIds?: string[] },
  ) {
    requireSuperAdmin(req);
    return this.adminService.upsertFeatureFlag(key, dto);
  }

  @Get('audit')
  listAudit(
    @Req() req: Request,
    @Query('orgId') orgId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    requireSuperAdmin(req);
    return this.adminService.listAuditEvents({
      orgId,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }
}
