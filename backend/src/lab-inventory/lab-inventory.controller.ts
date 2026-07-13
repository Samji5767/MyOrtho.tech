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
import { LabInventoryService } from './lab-inventory.service';

interface AuthUser { id: string; orgId: string | null }

function getUser(req: Request): { id: string; orgId: string } {
  const u = (req as Request & { user?: AuthUser }).user;
  if (!u?.orgId) throw new UnauthorizedException('No organization context');
  return { id: u.id, orgId: u.orgId };
}

@Controller('api/lab/inventory')
@UseGuards(AuthGuard, PermissionsGuard)
export class LabInventoryController {
  constructor(private readonly svc: LabInventoryService) {}

  @Get('items')
  @RequirePermission('manufacturing:read')
  listItems(@Req() req: Request, @Query('category') category?: string) {
    return this.svc.listItems(getUser(req).orgId, category);
  }

  @Post('items')
  @RequirePermission('manufacturing:write')
  @HttpCode(201)
  createItem(
    @Req() req: Request,
    @Body()
    body: {
      name: string;
      sku?: string;
      category?: string;
      unit?: string;
      unitCostCents?: number;
      reorderThreshold?: number;
      quantityOnHand?: number;
      notes?: string;
    },
  ) {
    return this.svc.createItem(getUser(req).orgId, body);
  }

  @Patch('items/:id')
  @RequirePermission('manufacturing:write')
  updateItem(
    @Req() req: Request,
    @Param('id') id: string,
    @Body()
    body: Partial<{
      name: string;
      sku: string;
      category: string;
      unit: string;
      unitCostCents: number;
      reorderThreshold: number;
      notes: string;
    }>,
  ) {
    return this.svc.updateItem(id, getUser(req).orgId, body);
  }

  @Post('transactions')
  @RequirePermission('manufacturing:write')
  @HttpCode(201)
  recordTransaction(
    @Req() req: Request,
    @Body()
    body: {
      itemId: string;
      transactionType: 'receipt' | 'usage' | 'adjustment' | 'waste';
      quantityDelta: number;
      caseId?: string;
      notes?: string;
    },
  ) {
    const { id, orgId } = getUser(req);
    return this.svc.recordTransaction(orgId, id, body);
  }

  @Get('alerts')
  @RequirePermission('manufacturing:read')
  getReorderAlerts(@Req() req: Request) {
    return this.svc.getReorderAlerts(getUser(req).orgId);
  }
}
