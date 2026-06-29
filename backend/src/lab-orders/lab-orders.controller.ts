import { Controller, Get, Post, Patch, Body, Param, UseGuards, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { LabOrdersService } from './lab-orders.service';

interface AuthUser { id: string; orgId: string | null }
function getUser(req: Request): { id: string; orgId: string } {
  const u = (req as Request & { user?: AuthUser }).user;
  if (!u?.orgId) throw new UnauthorizedException('No organization context');
  return { id: u.id, orgId: u.orgId };
}

@Controller('api')
@UseGuards(AuthGuard)
export class LabOrdersController {
  constructor(private readonly svc: LabOrdersService) {}

  @Get('cases/:caseId/lab-orders')
  list(@Req() req: Request, @Param('caseId') caseId: string) {
    return this.svc.listOrders(caseId, getUser(req).orgId);
  }

  @Post('cases/:caseId/lab-orders')
  create(
    @Req() req: Request,
    @Param('caseId') caseId: string,
    @Body() body: { labName?: string; priority?: string; dueDate?: string; specialInstructions?: string; items?: unknown[] },
  ) {
    return this.svc.createOrder(caseId, getUser(req).orgId, body as Parameters<LabOrdersService['createOrder']>[2]);
  }

  @Post('lab-orders/:orderId/submit')
  submit(@Req() req: Request, @Param('orderId') orderId: string) {
    return this.svc.submitOrder(orderId, getUser(req).orgId);
  }

  @Patch('lab-orders/:orderId/status')
  updateStatus(@Req() req: Request, @Param('orderId') orderId: string, @Body() body: { status: string }) {
    return this.svc.updateStatus(orderId, getUser(req).orgId, body.status);
  }

  @Post('lab-orders/:orderId/revisions')
  addRevision(@Req() req: Request, @Param('orderId') orderId: string, @Body() body: { reason: string }) {
    const { id, orgId } = getUser(req);
    return this.svc.addRevision(orderId, orgId, body.reason, id);
  }
}
