import { Controller, Get, Post, Body, Param, Query, UseGuards, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { InventoryService } from './inventory.service';

interface AuthUser { id: string; orgId: string | null }
function getUser(req: Request): { id: string; orgId: string } {
  const u = (req as Request & { user?: AuthUser }).user;
  if (!u?.orgId) throw new UnauthorizedException('No organization context');
  return { id: u.id, orgId: u.orgId };
}

@Controller('api/inventory')
@UseGuards(AuthGuard)
export class InventoryController {
  constructor(private readonly svc: InventoryService) {}

  @Get()
  listItems(@Req() req: Request, @Query('category') category?: string) {
    return this.svc.listItems(getUser(req).orgId, category);
  }

  @Get('low-stock')
  getLowStock(@Req() req: Request) {
    return this.svc.getLowStockItems(getUser(req).orgId);
  }

  @Post()
  createItem(
    @Req() req: Request,
    @Body() body: { name: string; sku?: string; category?: string; unit?: string; unitCostCents?: number; reorderThreshold?: number; notes?: string },
  ) {
    return this.svc.createItem(getUser(req).orgId, body);
  }

  @Get(':itemId/history')
  getHistory(@Req() req: Request, @Param('itemId') itemId: string) {
    return this.svc.getItemHistory(getUser(req).orgId, itemId);
  }

  @Post(':itemId/transactions')
  recordTransaction(
    @Req() req: Request,
    @Param('itemId') itemId: string,
    @Body() body: { transactionType: 'receipt' | 'usage' | 'adjustment' | 'waste'; quantityDelta: number; caseId?: string; notes?: string },
  ) {
    const { id, orgId } = getUser(req);
    return this.svc.recordTransaction(orgId, itemId, id, body);
  }
}
