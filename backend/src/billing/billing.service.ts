import { Injectable, Logger, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';
import Stripe from 'stripe';

export const PLANS = {
  monthly: {
    id: 'monthly',
    name: 'Professional Monthly',
    interval: 'month' as const,
    price_cents: 5400,      // $54 / month
    price_usd: 54,
    description: 'Full platform access, billed monthly',
    features: [
      'Unlimited cases',
      'AI tooth segmentation',
      'STL export for printing',
      'White-label branding',
      'iOS companion app access',
      'Email support',
    ],
  },
  annual: {
    id: 'annual',
    name: 'Professional Annual',
    interval: 'year' as const,
    price_cents: 49900,     // $499 / year
    price_usd: 499,
    description: 'Full platform access, billed annually — save $149 vs monthly',
    features: [
      'Everything in Monthly',
      'Save $149/year',
      'Priority support',
      'Custom subdomain',
    ],
  },
};

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly stripe: Stripe | null;

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (key) {
      this.stripe = new Stripe(key, { apiVersion: '2026-06-24.dahlia' });
      this.logger.log('Stripe billing initialised');
    } else {
      this.stripe = null;
      this.logger.warn('STRIPE_SECRET_KEY not set — billing endpoints will return mock data');
    }
  }

  getPlans() {
    return Object.values(PLANS);
  }

  async getSubscription(orgId: string) {
    const { rows } = await this.pool.query(
      `SELECT os.*, sp.name AS plan_name
       FROM organization_subscriptions os
       LEFT JOIN subscription_plans sp ON sp.id = os.plan_id
       WHERE os.organization_id = $1
       ORDER BY os.created_at DESC
       LIMIT 1`,
      [orgId],
    );
    const sub = rows[0] ?? null;

    // Also check org's direct stripe_subscription_id column if present
    const { rows: orgRows } = await this.pool.query(
      `SELECT stripe_customer_id, billing_interval FROM organizations WHERE id = $1`,
      [orgId],
    ).catch(() => ({ rows: [] }));

    return {
      active: sub?.status === 'active' || sub?.status === 'trialing',
      status: sub?.status ?? 'none',
      interval: orgRows[0]?.billing_interval ?? null,
      planName: sub?.plan_name ?? null,
      currentPeriodEnd: sub?.current_period_end ?? null,
      stripeCustomerId: orgRows[0]?.stripe_customer_id ?? null,
      trialEnd: sub?.trial_end ?? null,
    };
  }

  async createCheckoutSession(opts: {
    orgId: string;
    userId: string;
    interval: 'monthly' | 'annual';
    successUrl: string;
    cancelUrl: string;
    email?: string;
  }) {
    const plan = PLANS[opts.interval];

    if (!this.stripe) {
      return {
        mock: true,
        url: opts.successUrl + '?session_id=mock_' + Date.now(),
        plan: plan.name,
      };
    }

    const priceId =
      opts.interval === 'annual'
        ? process.env.STRIPE_PRICE_ID_ANNUAL
        : process.env.STRIPE_PRICE_ID_MONTHLY;

    if (!priceId) {
      this.logger.warn(`STRIPE_PRICE_ID_${opts.interval.toUpperCase()} not set — returning mock`);
      return {
        mock: true,
        url: opts.successUrl + '?session_id=mock_' + Date.now(),
        plan: plan.name,
      };
    }

    // Retrieve or create Stripe customer
    let customerId = await this.getStripeCustomerId(opts.orgId);
    if (!customerId && opts.email) {
      const customer = await this.stripe.customers.create({
        email: opts.email,
        metadata: { org_id: opts.orgId, user_id: opts.userId },
      });
      customerId = customer.id;
      await this.saveStripeCustomerId(opts.orgId, customerId);
    }

    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId ?? undefined,
      customer_email: customerId ? undefined : opts.email,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 14,
        metadata: { org_id: opts.orgId, user_id: opts.userId, interval: opts.interval },
      },
      success_url: opts.successUrl + '?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: opts.cancelUrl,
      metadata: { org_id: opts.orgId, user_id: opts.userId, interval: opts.interval },
    });

    return { url: session.url, sessionId: session.id };
  }

  async createPortalSession(orgId: string, returnUrl: string) {
    if (!this.stripe) {
      return { mock: true, url: returnUrl };
    }

    const customerId = await this.getStripeCustomerId(orgId);
    if (!customerId) {
      return { error: 'No billing customer found. Subscribe first.' };
    }

    const session = await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    return { url: session.url };
  }

  async handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!this.stripe || !secret) {
      this.logger.warn('Webhook received but Stripe not configured — ignoring');
      return;
    }

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, secret);
    } catch (err) {
      this.logger.error('Webhook signature verification failed:', String(err));
      throw new Error('Invalid webhook signature');
    }

    this.logger.log(`Stripe webhook: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed':
        await this.onCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await this.onSubscriptionChanged(event.data.object as Stripe.Subscription);
        break;
      case 'invoice.payment_failed':
        await this.onPaymentFailed(event.data.object as Stripe.Invoice);
        break;
    }
  }

  private async onCheckoutCompleted(session: Stripe.Checkout.Session) {
    const orgId = session.metadata?.org_id;
    const interval = (session.metadata?.interval ?? 'monthly') as 'monthly' | 'annual';
    if (!orgId) return;

    const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
    if (customerId) await this.saveStripeCustomerId(orgId, customerId);

    const subscriptionId =
      typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;

    await this.upsertSubscription(orgId, {
      stripeSubscriptionId: subscriptionId ?? null,
      status: 'active',
      interval,
    });

    this.logger.log(`Subscription activated for org ${orgId} (${interval})`);
  }

  private async onSubscriptionChanged(sub: Stripe.Subscription) {
    const orgId = sub.metadata?.org_id;
    if (!orgId) return;

    const status =
      sub.status === 'active' ? 'active'
      : sub.status === 'trialing' ? 'trialing'
      : sub.status === 'past_due' ? 'past_due'
      : 'canceled';

    await this.upsertSubscription(orgId, {
      stripeSubscriptionId: sub.id,
      status,
      interval: (sub.metadata?.interval ?? 'monthly') as 'monthly' | 'annual',
      // current_period_end moved to subscription items in newer Stripe API versions
      currentPeriodEnd: new Date(((sub as any).current_period_end ?? sub.items?.data?.[0]?.current_period_end ?? 0) * 1000),
    });
  }

  private async onPaymentFailed(invoice: Stripe.Invoice) {
    const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
    if (!customerId) return;

    const { rows } = await this.pool.query(
      `SELECT id FROM organizations WHERE stripe_customer_id = $1 LIMIT 1`,
      [customerId],
    ).catch(() => ({ rows: [] }));

    const orgId = rows[0]?.id;
    if (!orgId) return;

    await this.pool.query(
      `UPDATE organization_subscriptions SET status = 'past_due', updated_at = now()
       WHERE organization_id = $1`,
      [orgId],
    ).catch(() => {});

    this.logger.warn(`Payment failed for org ${orgId}`);
  }

  private async upsertSubscription(
    orgId: string,
    data: {
      stripeSubscriptionId: string | null;
      status: string;
      interval: 'monthly' | 'annual';
      currentPeriodEnd?: Date;
    },
  ) {
    const planSlug = data.interval === 'annual' ? 'annual' : 'monthly';

    const { rows: planRows } = await this.pool.query(
      `SELECT id FROM subscription_plans WHERE id = $1 LIMIT 1`,
      [planSlug],
    ).catch(() => ({ rows: [] }));
    const planId = planRows[0]?.id ?? null;

    await this.pool.query(
      `INSERT INTO organization_subscriptions
         (organization_id, plan_id, status, stripe_subscription_id, current_period_start, current_period_end)
       VALUES ($1, $2, $3, $4, now(), $5)
       ON CONFLICT (organization_id)
       DO UPDATE SET
         plan_id = EXCLUDED.plan_id,
         status = EXCLUDED.status,
         stripe_subscription_id = EXCLUDED.stripe_subscription_id,
         current_period_end = COALESCE(EXCLUDED.current_period_end, organization_subscriptions.current_period_end),
         updated_at = now()`,
      [orgId, planId, data.status, data.stripeSubscriptionId, data.currentPeriodEnd ?? null],
    ).catch(err => this.logger.warn('upsertSubscription failed:', String(err)));

    // Keep org table in sync
    await this.pool.query(
      `UPDATE organizations SET billing_interval = $1, updated_at = now() WHERE id = $2`,
      [data.interval, orgId],
    ).catch(() => {});
  }

  private async getStripeCustomerId(orgId: string): Promise<string | null> {
    const { rows } = await this.pool.query(
      `SELECT stripe_customer_id FROM organizations WHERE id = $1`,
      [orgId],
    ).catch(() => ({ rows: [] }));
    return rows[0]?.stripe_customer_id ?? null;
  }

  private async saveStripeCustomerId(orgId: string, customerId: string) {
    await this.pool.query(
      `UPDATE organizations SET stripe_customer_id = $1, updated_at = now() WHERE id = $2`,
      [customerId, orgId],
    ).catch(() => {});
  }

  async startTrial(orgId: string) {
    const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    await this.upsertSubscription(orgId, {
      stripeSubscriptionId: null,
      status: 'trialing',
      interval: 'monthly',
      currentPeriodEnd: trialEnd,
    });
    return { trialEnd };
  }
}
