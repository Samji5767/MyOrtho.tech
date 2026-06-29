import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { SupplyChainService } from './supply-chain.service';

interface AuthUser { id: string; orgId: string | null }
function getUser(req: Request): { id: string; orgId: string } {
  const u = (req as Request & { user?: AuthUser }).user;
  if (!u?.orgId) throw new UnauthorizedException('No organization context');
  return { id: u.id, orgId: u.orgId };
}

@Controller('api/supply-chain')
@UseGuards(AuthGuard)
export class SupplyChainController {
  constructor(private readonly svc: SupplyChainService) {}

  @Get('vendors')
  listVendors(@Req() req: Request) { return this.svc.listVendors(getUser(req).orgId); }

  @Post('vendors')
  createVendor(@Req() req: Request, @Body() body: { name: string; contactName?: string; email?: string; phone?: string; website?: string; notes?: string }) {
    return this.svc.createVendor(getUser(req).orgId, body);
  }

  @Get('orders')
  listOrders(@Req() req: Request, @Query('status') status?: string) {
    return this.svc.listOrders(getUser(req).orgId, status);
  }

  @Post('orders')
  createOrder(
    @Req() req: Request,
    @Body() body: { vendorId: string; orderedAt?: string; expectedDate?: string; notes?: string; items: { description: string; quantity: number; unitPriceCents?: number; inventoryItemId?: string }[] },
  ) {
    const { id, orgId } = getUser(req);
    return this.svc.createOrder(orgId, id, body);
  }

  @Patch('orders/:orderId/status')
  updateStatus(@Req() req: Request, @Param('orderId') orderId: string, @Body() body: { status: string }) {
    return this.svc.updateOrderStatus(orderId, getUser(req).orgId, body.status);
  }
}
