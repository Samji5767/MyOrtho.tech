import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
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
import { LabShipmentsService } from './lab-shipments.service';

interface AuthUser { id: string; orgId: string | null }

function getUser(req: Request): { id: string; orgId: string } {
  const u = (req as Request & { user?: AuthUser }).user;
  if (!u?.orgId) throw new UnauthorizedException('No organization context');
  return { id: u.id, orgId: u.orgId };
}

@Controller('api/lab/shipments')
@UseGuards(AuthGuard, PermissionsGuard)
export class LabShipmentsController {
  constructor(private readonly svc: LabShipmentsService) {}

  @Get()
  @RequirePermission('manufacturing:read')
  list(@Req() req: Request, @Query('status') status?: string) {
    return this.svc.list(getUser(req).orgId, status);
  }

  @Post()
  @RequirePermission('manufacturing:write')
  @HttpCode(201)
  create(
    @Req() req: Request,
    @Body()
    body: {
      batchId?: string;
      courier?: string;
      trackingNumber?: string;
      carrierService?: string;
      estimatedDelivery?: string;
      recipientName?: string;
      recipientAddress?: string;
      notes?: string;
    },
  ) {
    const { id, orgId } = getUser(req);
    return this.svc.create(orgId, id, body);
  }

  @Get('history')
  @RequirePermission('manufacturing:read')
  getShipmentHistory(@Req() req: Request) {
    return this.svc.getShipmentHistory(getUser(req).orgId);
  }

  @Patch(':id/status')
  @RequirePermission('manufacturing:write')
  updateStatus(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    return this.svc.updateStatus(id, getUser(req).orgId, body.status);
  }

  @Patch(':id/tracking')
  @RequirePermission('manufacturing:write')
  addTracking(
    @Req() req: Request,
    @Param('id') id: string,
    @Body()
    body: {
      courier: string;
      trackingNumber: string;
      carrierService?: string;
      estimatedDelivery?: string;
    },
  ) {
    return this.svc.addTracking(id, getUser(req).orgId, body);
  }
}
