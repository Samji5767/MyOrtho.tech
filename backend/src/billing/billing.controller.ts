import {
  Controller, Get, Post, Body, UseGuards, Req,
  Res, RawBodyRequest, HttpCode, HttpStatus,
  BadRequestException, ForbiddenException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { BillingService } from './billing.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller('api/billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('plans')
  getPlans() {
    return this.billing.getPlans();
  }

  @Get('subscription')
  @UseGuards(AuthGuard)
  async getSubscription(@Req() req: Request) {
    const orgId = (req as any).user?.orgId;
    if (!orgId) throw new ForbiddenException('No organization associated with your account');
    return this.billing.getSubscription(orgId);
  }

  @Post('checkout')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async createCheckout(
    @Req() req: Request,
    @Body() body: { interval?: 'monthly' | 'annual'; successUrl?: string; cancelUrl?: string },
  ) {
    const user = (req as any).user;
    if (!user?.orgId) throw new ForbiddenException('No organization associated with your account');
    if (!body.interval || !['monthly', 'annual'].includes(body.interval)) {
      throw new BadRequestException('interval must be "monthly" or "annual"');
    }
    const origin = (req.headers['origin'] as string) ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    return this.billing.createCheckoutSession({
      orgId: user.orgId,
      userId: user.sub,
      interval: body.interval,
      email: user.email,
      successUrl: body.successUrl ?? `${origin}/settings/billing?success=1`,
      cancelUrl: body.cancelUrl ?? `${origin}/settings/billing?canceled=1`,
    });
  }

  @Post('portal')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async createPortal(@Req() req: Request, @Body() body: { returnUrl?: string }) {
    const user = (req as any).user;
    if (!user?.orgId) throw new ForbiddenException('No organization associated with your account');
    const origin = (req.headers['origin'] as string) ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    return this.billing.createPortalSession(user.orgId, body.returnUrl ?? `${origin}/settings/billing`);
  }

  // Raw body required for Stripe signature verification
  @Post('webhook/stripe')
  @HttpCode(HttpStatus.OK)
  async stripeWebhook(@Req() req: RawBodyRequest<Request>, @Res() res: Response) {
    const sig = req.headers['stripe-signature'] as string;
    try {
      await this.billing.handleWebhook(req.rawBody ?? Buffer.alloc(0), sig);
      res.json({ received: true });
    } catch (err) {
      res.status(400).json({ error: String(err) });
    }
  }
}
