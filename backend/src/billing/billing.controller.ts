import {
  Controller, Get, Post, Body, UseGuards, Req, Headers,
  ForbiddenException, BadRequestException, HttpCode, HttpStatus,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { SkipThrottle } from '@nestjs/throttler';
import { BillingService } from './billing.service';
import { AuthGuard } from '../auth/auth.guard';

function getOrgId(req: Request): string {
  const user = (req as Request & { user?: { orgId?: string; role?: string } }).user;
  if (!user?.orgId) throw new ForbiddenException('User is not associated with an organization');
  return user.orgId;
}

function getUser(req: Request): { orgId: string; role: string } {
  const user = (req as Request & { user?: { orgId?: string; role?: string } }).user;
  if (!user?.orgId) throw new ForbiddenException('User is not associated with an organization');
  return { orgId: user.orgId, role: user.role ?? '' };
}

@Controller('billing')
@UseGuards(AuthGuard)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post('meter')
  async recordUsage(@Req() req: Request, @Body() body: { metricType: any, quantity: number, caseId?: string }) {
    const orgId = getOrgId(req);
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
  async getUsageSummary(@Req() req: Request) {
    return this.billingService.calculateUsageSummary(getOrgId(req));
  }

  @Post('subscription')
  async createSubscription(@Req() req: Request, @Body() body: { planTier: string, customBasePrice?: number }) {
    const orgId = getOrgId(req);
    const { planTier, customBasePrice } = body;
    if (!planTier) {
      throw new BadRequestException('planTier is required');
    }
    return this.billingService.createSubscription(orgId, planTier, customBasePrice);
  }

  @Post('recovery')
  async triggerPaymentRecovery(@Req() req: Request) {
    return this.billingService.processPaymentRecovery(getOrgId(req));
  }

  @Get('invoice')
  async getInvoice(@Req() req: Request) {
    return this.billingService.generateInvoice(getOrgId(req));
  }

  @Get('analytics')
  async getRevenueAnalytics(@Req() req: Request) {
    const { role } = getUser(req);
    if (role !== 'super_admin' && role !== 'admin') {
      throw new ForbiddenException('Platform revenue analytics requires admin role');
    }
    return this.billingService.getRevenueAnalytics();
  }

  @Get('plans')
  async listPlans() {
    return this.billingService.listPlans();
  }

  /** Create a Stripe Checkout Session for the Unlimited Professional plan. */
  @Post('checkout')
  async createCheckout(
    @Req() req: Request,
    @Body() body: { successUrl?: string; cancelUrl?: string },
  ) {
    const orgId = getOrgId(req);
    const origin = ((req as any).headers?.origin as string | undefined) ?? 'http://localhost:3000';
    const successUrl = body.successUrl ?? `${origin}/settings/billing?checkout=success`;
    const cancelUrl  = body.cancelUrl  ?? `${origin}/settings/billing?checkout=canceled`;
    return this.billingService.createCheckoutSession(orgId, successUrl, cancelUrl);
  }
}

/**
 * Stripe webhook controller — intentionally NOT guarded by AuthGuard.
 * Stripe sends no JWT; signature verification is done inside the service.
 */
@Controller('billing')
export class BillingWebhookController {
  constructor(private readonly billingService: BillingService) {}

  @Post('webhook/stripe')
  @SkipThrottle()
  @HttpCode(HttpStatus.OK)
  async stripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    if (!req.rawBody) {
      throw new BadRequestException('Raw body required for webhook signature verification');
    }
    await this.billingService.handleStripeWebhook(req.rawBody, signature);
    return { received: true };
  }
}
