import { Controller, Get, Post, Body, UseGuards, Req, ForbiddenException, BadRequestException } from '@nestjs/common';
import { BillingService } from './billing.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller('billing')
@UseGuards(AuthGuard)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post('meter')
  async recordUsage(@Req() req, @Body() body: { metricType: any, quantity: number, caseId?: string }) {
    const orgId = req.user.organizationId;
    if (!orgId) {
      throw new ForbiddenException('User is not associated with an organization');
    }
    const { metricType, quantity, caseId } = body;
    if (!metricType || quantity === undefined) {
      throw new BadRequestException('metricType and quantity are required');
    }
    if (!['case_export', 'api_call', 'resin_print_ml', 'storage_gb'].includes(metricType)) {
      throw new BadRequestException('Invalid metricType');
    }
    return this.billingService.recordUsage(orgId, metricType, quantity, caseId);
  }

  @Get('summary')
  async getUsageSummary(@Req() req) {
    const orgId = req.user.organizationId;
    if (!orgId) {
      throw new ForbiddenException('User is not associated with an organization');
    }
    return this.billingService.calculateUsageSummary(orgId);
  }

  @Post('subscription')
  async createSubscription(@Req() req, @Body() body: { planTier: string, customBasePrice?: number }) {
    const orgId = req.user.organizationId;
    if (!orgId) {
      throw new ForbiddenException('User is not associated with an organization');
    }
    const { planTier, customBasePrice } = body;
    if (!planTier) {
      throw new BadRequestException('planTier is required');
    }
    return this.billingService.createSubscription(orgId, planTier, customBasePrice);
  }

  @Post('recovery')
  async triggerPaymentRecovery(@Req() req) {
    const orgId = req.user.organizationId;
    if (!orgId) {
      throw new ForbiddenException('User is not associated with an organization');
    }
    return this.billingService.processPaymentRecovery(orgId);
  }

  @Get('invoice')
  async getInvoice(@Req() req) {
    const orgId = req.user.organizationId;
    if (!orgId) {
      throw new ForbiddenException('User is not associated with an organization');
    }
    return this.billingService.generateInvoice(orgId);
  }

  @Get('analytics')
  async getRevenueAnalytics(@Req() req) {
    // In production, enforce System Admin role check
    return this.billingService.getRevenueAnalytics();
  }

  @Get('plans')
  async listPlans() {
    return this.billingService.listPlans();
  }
}
