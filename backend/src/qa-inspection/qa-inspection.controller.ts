import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  HttpCode,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { QaInspectionService, CreateQaInspectionDto, UpdateQaInspectionDto } from './qa-inspection.service';

interface AuthUser {
  id: string;
  orgId: string | null;
}

function getUser(req: Request): { id: string; orgId: string } {
  const u = (req as Request & { user?: AuthUser }).user;
  if (!u?.orgId) throw new UnauthorizedException('No organization context');
  return { id: u.id, orgId: u.orgId };
}

@Controller('api/qa-inspections')
@UseGuards(AuthGuard, PermissionsGuard)
export class QaInspectionController {
  constructor(private readonly svc: QaInspectionService) {}

  @Get()
  @RequirePermission('manufacturing:read')
  list(@Req() req: Request, @Query('status') status?: string) {
    return this.svc.list(getUser(req).orgId, status);
  }

  @Post()
  @RequirePermission('manufacturing:write')
  @HttpCode(201)
  create(@Req() req: Request, @Body() dto: CreateQaInspectionDto) {
    const { id, orgId } = getUser(req);
    return this.svc.create(orgId, id, dto);
  }

  @Patch(':id')
  @RequirePermission('manufacturing:write')
  update(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateQaInspectionDto) {
    return this.svc.update(id, getUser(req).orgId, dto);
  }

  @Post(':id/approve')
  @RequirePermission('qa:approve')
  @HttpCode(200)
  approve(@Req() req: Request, @Param('id') id: string) {
    const { id: userId, orgId } = getUser(req);
    return this.svc.approve(id, orgId, userId);
  }

  @Post(':id/reject')
  @RequirePermission('manufacturing:write')
  @HttpCode(200)
  reject(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { notes?: string },
  ) {
    return this.svc.reject(id, getUser(req).orgId, body.notes);
  }
}
