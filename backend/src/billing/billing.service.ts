import { BadRequestException, Inject, Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import type { Pool } from 'pg';
import Stripe from 'stripe';
import { PG_POOL } from '../database/database.module';

const PAYG_EXPORT_COST_CENTS = 199; // $1.99 per export for non-subscribers

export interface UsageSummary {
  organizationId: string;
  planSlug: string;
  planName: string;
  priceUsdCents: number;
  isUnlimited: boolean;
  status: string;
  casesThisPeriod: number;
  maxCasesPerMonth: number;
  creditBalance: number;
  currentPeriodEnd: string | null;
  paygExportCostCents: number;
}

export interface Invoice {
  invoiceId: string;
  date: string;
  organizationId: string;
  planName: string;
  priceUsdCents: number;
  status: string;
  lineItems: { description: string; quantity: number; unitPriceCents: number; totalCents: number }[];
  subtotalCents: number;
  totalCents: number;
}

export interface RevenueDashboard {
  activeMrrCents: number;
  activeArrCents: number;
  activeSubscriptions: number;
  subscriptionsByPlan: Record<string, number>;
  totalCreditsGranted: number;
  totalCreditsConsumed: number;
  organizations: number;
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly stripe: Stripe | null;

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {
    const key = process.env.STRIPE_SECRET_KEY;
    this.stripe = key
      ? new Stripe(key, { apiVersion: '2026-06-24.dahlia' })
      : null;
    if (!key) {
      this.logger.warn('STRIPE_SECRET_KEY not set — Stripe features disabled');
    }
  }

  private get stripeClient(): Stripe {
    if (!this.stripe) {
      throw new InternalServerErrorException('Stripe is not configured. Set STRIPE_SECRET_KEY.');
    }
    return this.stripe;
  }

  async listPlans(): Promise<Array<{
    slug: string; name: string; priceUsdCents: number;
    isUnlimited: boolean; maxCasesPerMonth: number | null;
  }>> {
    const { rows } = await this.pool.query(
      `SELECT slug, name, price_usd_cents, is_unlimited, max_cases_per_month
       FROM subscription_plans WHERE is_active=true ORDER BY price_usd_cents ASC`,
    );
    return rows.map(r => ({
      slug:               r['slug'] as string,
      name:               r['name'] as string,
      priceUsdCents:      r['price_usd_cents'] as number,
      isUnlimited:        r['is_unlimited'] as boolean,
      maxCasesPerMonth:   r['max_cases_per_month'] as number | null,
    }));
  }

  async calculateUsageSummary(orgId: string): Promise<UsageSummary> {
    const subRow = await this.pool.query(
      `SELECT os.status, os.cases_this_period, os.current_period_end,
              sp.slug, sp.name, sp.price_usd_cents, sp.max_cases_per_month, sp.is_unlimited
       FROM organization_subscriptions os
       JOIN subscription_plans sp ON sp.id = os.plan_id
       WHERE os.organization_id = $1 AND os.status = 'active'
       ORDER BY os.created_at DESC LIMIT 1`,
      [orgId],
    );
    const { rows: credRows } = await this.pool.query(
      `SELECT balance FROM organization_credits WHERE organization_id = $1`,
      [orgId],
    );
    const sub = subRow.rows[0];
    const creditBalance = (credRows[0]?.balance as number) ?? 0;
    return {
      organizationId: orgId,
      planSlug: sub?.slug ?? 'none',
      planName: sub?.name ?? 'No active plan',
      priceUsdCents: sub?.price_usd_cents ?? 0,
      isUnlimited: sub?.is_unlimited ?? false,
      status: sub?.status ?? 'none',
      casesThisPeriod: sub?.cases_this_period ?? 0,
      maxCasesPerMonth: sub?.max_cases_per_month ?? 0,
      creditBalance,
      currentPeriodEnd: sub?.current_period_end ?? null,
      paygExportCostCents: PAYG_EXPORT_COST_CENTS,
    };
  }

  async createSubscription(orgId: string, planSlug: string, _customBasePrice?: number): Promise<{ subscriptionId: string }> {
    const { rows: planRows } = await this.pool.query(
      `SELECT id FROM subscription_plans WHERE slug = $1 AND is_active = true`,
      [planSlug],
    );
    if (!planRows[0]) throw new BadRequestException(`Unknown plan slug: ${planSlug}`);
    const planId = planRows[0].id as string;

    await this.pool.query(
      `UPDATE organization_subscriptions SET status = 'canceled' WHERE organization_id = $1 AND status = 'active'`,
      [orgId],
    );
    const { rows } = await this.pool.query(
      `INSERT INTO organization_subscriptions
         (organization_id, plan_id, status, current_period_start, current_period_end)
       VALUES ($1, $2, 'active', now(), now() + interval '1 month')
       RETURNING id`,
      [orgId, planId],
    );
    return { subscriptionId: rows[0].id as string };
  }

  async recordUsage(orgId: string, metricType: string, quantity: number, _caseId?: string): Promise<{ recorded: boolean }> {
    if (metricType === 'case_export') {
      const summary = await this.calculateUsageSummary(orgId);
      if (!summary.isUnlimited && summary.status !== 'active') {
        const cost = quantity * PAYG_EXPORT_COST_CENTS;
        const { rows } = await this.pool.query(
          `UPDATE organization_credits
           SET balance = balance - $2, updated_at = now()
           WHERE organization_id = $1 AND balance >= $2
           RETURNING balance`,
          [orgId, cost],
        );
        if (!rows[0]) throw new BadRequestException('Insufficient credit balance for export');
        await this.pool.query(
          `INSERT INTO credit_transactions (organization_id, amount, type, notes)
           VALUES ($1, $2, 'ai_job_debit', $3)`,
          [orgId, -cost, `PAYG export × ${quantity}`],
        );
      }
      if (summary.status === 'active') {
        await this.pool.query(
          `UPDATE organization_subscriptions
           SET cases_this_period = cases_this_period + $2
           WHERE organization_id = $1 AND status = 'active'`,
          [orgId, quantity],
        );
      }
    }
    return { recorded: true };
  }

  async processPaymentRecovery(orgId: string): Promise<{ recovered: boolean }> {
    await this.pool.query(
      `UPDATE organization_subscriptions
       SET status = 'active', updated_at = now()
       WHERE organization_id = $1 AND status = 'past_due'`,
      [orgId],
    );
    return { recovered: true };
  }

  async generateInvoice(orgId: string): Promise<Invoice> {
    const summary = await this.calculateUsageSummary(orgId);
    const lineItems = summary.status === 'active'
      ? [{ description: `${summary.planName} subscription`, quantity: 1, unitPriceCents: summary.priceUsdCents, totalCents: summary.priceUsdCents }]
      : [];
    const subtotal = lineItems.reduce((a, b) => a + b.totalCents, 0);
    return {
      invoiceId: `INV-${orgId.slice(0, 8).toUpperCase()}-${Date.now()}`,
      date: new Date().toISOString(),
      organizationId: orgId,
      planName: summary.planName,
      priceUsdCents: summary.priceUsdCents,
      status: summary.status === 'active' ? 'paid' : 'unpaid',
      lineItems,
      subtotalCents: subtotal,
      totalCents: subtotal,
    };
  }

  // ─── Stripe: checkout session ─────────────────────────────────────────────

  async createCheckoutSession(
    orgId: string,
    successUrl: string,
    cancelUrl: string,
  ): Promise<{ url: string; sessionId: string }> {
    const priceId = process.env.STRIPE_PRICE_ID_UNLIMITED;
    if (!priceId) {
      throw new InternalServerErrorException('STRIPE_PRICE_ID_UNLIMITED is not set');
    }
    const session = await this.stripeClient.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { orgId },
      subscription_data: { metadata: { orgId } },
    });
    return { url: session.url!, sessionId: session.id };
  }

  // ─── Stripe: webhook handler ───────────────────────────────────────────────

  async handleStripeWebhook(rawBody: Buffer, signature: string): Promise<void> {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new InternalServerErrorException('STRIPE_WEBHOOK_SECRET is not set');
    }
    let event: Stripe.Event;
    try {
      event = this.stripeClient.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err) {
      throw new BadRequestException(`Stripe webhook signature verification failed: ${String(err)}`);
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const orgId = session.metadata?.orgId;
        if (!orgId || session.mode !== 'subscription') break;
        const stripeSubId = session.subscription as string;
        // Copy orgId to subscription metadata for future events
        await this.stripeClient.subscriptions.update(stripeSubId, { metadata: { orgId } });
        await this.activateSubscriptionForOrg(orgId, stripeSubId);
        break;
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const orgId = sub.metadata?.orgId;
        if (!orgId) break;
        const status = sub.status === 'active' ? 'active'
          : sub.status === 'past_due' ? 'past_due'
          : 'canceled';
        await this.pool.query(
          `UPDATE organization_subscriptions
           SET status = $2, updated_at = now()
           WHERE organization_id = $1 AND stripe_subscription_id = $3`,
          [orgId, status, sub.id],
        );
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const orgId = sub.metadata?.orgId;
        if (!orgId) break;
        await this.pool.query(
          `UPDATE organization_subscriptions
           SET status = 'canceled', updated_at = now()
           WHERE organization_id = $1 AND stripe_subscription_id = $2`,
          [orgId, sub.id],
        );
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        // subscription field location varies across Stripe API versions
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const subId = (invoice as any).subscription as string | null ?? null;
        if (!subId) break;
        await this.pool.query(
          `UPDATE organization_subscriptions
           SET status = 'past_due', updated_at = now()
           WHERE stripe_subscription_id = $1`,
          [subId],
        );
        break;
      }
      default:
        this.logger.debug(`Unhandled Stripe event: ${event.type}`);
    }
  }

  private async activateSubscriptionForOrg(orgId: string, stripeSubId: string): Promise<void> {
    const { rows: planRows } = await this.pool.query(
      `SELECT id FROM subscription_plans WHERE slug = 'unlimited_professional' AND is_active = true`,
    );
    if (!planRows[0]) return;
    const planId = planRows[0].id as string;
    // Cancel any existing active subscription
    await this.pool.query(
      `UPDATE organization_subscriptions SET status = 'canceled' WHERE organization_id = $1 AND status = 'active'`,
      [orgId],
    );
    await this.pool.query(
      `INSERT INTO organization_subscriptions
         (organization_id, plan_id, status, stripe_subscription_id, current_period_start, current_period_end)
       VALUES ($1, $2, 'active', $3, now(), now() + interval '1 month')`,
      [orgId, planId, stripeSubId],
    );
  }

  async getRevenueAnalytics(): Promise<RevenueDashboard> {
    const { rows: subRows } = await this.pool.query(
      `SELECT sp.slug, sp.price_usd_cents, COUNT(os.id) as count
       FROM organization_subscriptions os
       JOIN subscription_plans sp ON sp.id = os.plan_id
       WHERE os.status = 'active'
       GROUP BY sp.slug, sp.price_usd_cents`,
    );
    const { rows: credRows } = await this.pool.query(
      `SELECT
         SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as granted,
         SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as consumed
       FROM credit_transactions`,
    );
    const { rows: orgRows } = await this.pool.query(`SELECT COUNT(*) as count FROM organizations`);

    const subscriptionsByPlan: Record<string, number> = {};
    let mrrCents = 0;
    let activeSubs = 0;
    for (const row of subRows) {
      subscriptionsByPlan[row.slug as string] = Number(row.count);
      mrrCents += (row.price_usd_cents as number) * Number(row.count);
      activeSubs += Number(row.count);
    }
    return {
      activeMrrCents: mrrCents,
      activeArrCents: mrrCents * 12,
      activeSubscriptions: activeSubs,
      subscriptionsByPlan,
      totalCreditsGranted: Number(credRows[0]?.granted ?? 0),
      totalCreditsConsumed: Number(credRows[0]?.consumed ?? 0),
      organizations: Number(orgRows[0]?.count ?? 0),
    };
  }
}
