import {
  Controller, Get, Post, Body, UseGuards, Req, Headers,
  ForbiddenException, BadRequestException, HttpCode, HttpStatus,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { SkipThrottle } from '@nestjs/throttler';
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

  /** Create a Stripe Checkout Session for the Unlimited Professional plan. */
  @Post('checkout')
  async createCheckout(
    @Req() req,
    @Body() body: { successUrl?: string; cancelUrl?: string },
  ) {
    const orgId = req.user.organizationId;
    if (!orgId) throw new ForbiddenException('No organization context');
    const origin = (req.headers?.origin as string | undefined) ?? 'http://localhost:3000';
    const successUrl = body.successUrl ?? `${origin}/settings/billing?checkout=success`;
    const cancelUrl  = body.cancelUrl  ?? `${origin}/settings/billing?checkout=canceled`;
    return this.billingService.createCheckoutSession(orgId, successUrl, cancelUrl);
  }

  /**
   * Stripe webhook — receives raw body for signature verification.
   * No auth guard. Throttle skipped (Stripe IPs are high-frequency).
   */
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
