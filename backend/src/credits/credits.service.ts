import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface CreditTransaction {
  id: string;
  orgId: string;
  amount: number;
  type: string;
  referenceId: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: Date;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  maxCasesPerMonth: number;
  priceUsdCents: number;
  creditsIncluded: number;
  features: string[];
}

export interface ActiveSubscription {
  id: string;
  planId: string;
  planName: string;
  planSlug: string;
  status: string;
  maxCasesPerMonth: number;
  priceUsdCents: number;
  creditsIncluded: number;
  casesThisPeriod: number;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
}

@Injectable()
export class CreditsService {
  private readonly logger = new Logger(CreditsService.name);

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  // ── Credit balance ──────────────────────────────────────────────────────────

  async getBalance(orgId: string): Promise<{ balance: number }> {
    const { rows } = await this.pool.query(
      `SELECT balance FROM organization_credits WHERE organization_id = $1`,
      [orgId],
    );
    return { balance: (rows[0]?.balance as number) ?? 0 };
  }

  async debit(
    orgId: string,
    amount: number,
    type: 'import_debit' | 'ai_job_debit',
    referenceId?: string,
    notes?: string,
    actorEmail?: string,
  ): Promise<void> {
    const client: PoolClient = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `UPDATE organization_credits
         SET balance = balance - $1, updated_at = now()
         WHERE organization_id = $2 AND balance >= $1
         RETURNING balance`,
        [amount, orgId],
      );
      if (!rows[0]) {
        throw new BadRequestException(
          `Insufficient credits — need ${amount}, please purchase more or upgrade your plan.`,
        );
      }
      await client.query(
        `INSERT INTO credit_transactions
           (organization_id, amount, type, reference_id, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [orgId, -amount, type, referenceId ?? null, notes ?? null, actorEmail ?? null],
      );
      await client.query('COMMIT');
      this.logger.log(`Debited ${amount} credits from org ${orgId} (${type})`);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async addCredits(
    orgId: string,
    amount: number,
    type: 'purchase' | 'plan_grant' | 'refund' | 'admin_grant',
    notes?: string,
    actorEmail?: string,
  ): Promise<{ balance: number }> {
    const client: PoolClient = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `INSERT INTO organization_credits (organization_id, balance)
         VALUES ($1, $2)
         ON CONFLICT (organization_id) DO UPDATE
           SET balance = organization_credits.balance + $2, updated_at = now()
         RETURNING balance`,
        [orgId, amount],
      );
      await client.query(
        `INSERT INTO credit_transactions
           (organization_id, amount, type, notes, created_by)
         VALUES ($1, $2, $3, $4, $5)`,
        [orgId, amount, type, notes ?? null, actorEmail ?? null],
      );
      await client.query('COMMIT');
      this.logger.log(`Added ${amount} credits to org ${orgId} (${type})`);
      return { balance: rows[0].balance as number };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async listTransactions(orgId: string, limit = 50): Promise<CreditTransaction[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM credit_transactions
       WHERE organization_id = $1
       ORDER BY created_at DESC LIMIT $2`,
      [orgId, limit],
    );
    return rows.map((r) => ({
      id: r.id as string,
      orgId: r.organization_id as string,
      amount: r.amount as number,
      type: r.type as string,
      referenceId: r.reference_id as string | null,
      notes: r.notes as string | null,
      createdBy: r.created_by as string | null,
      createdAt: r.created_at as Date,
    }));
  }

  // ── Subscription plans ──────────────────────────────────────────────────────

  async listPlans(): Promise<SubscriptionPlan[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM subscription_plans WHERE is_active = true ORDER BY price_usd_cents ASC`,
    );
    return rows.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      slug: r.slug as string,
      maxCasesPerMonth: r.max_cases_per_month as number,
      priceUsdCents: r.price_usd_cents as number,
      creditsIncluded: r.credits_included as number,
      features: r.features as string[],
    }));
  }

  async getActiveSubscription(orgId: string): Promise<ActiveSubscription | null> {
    const { rows } = await this.pool.query(
      `SELECT os.id, os.plan_id, os.status, os.cases_this_period,
              os.current_period_start, os.current_period_end,
              sp.name AS plan_name, sp.slug AS plan_slug,
              sp.max_cases_per_month, sp.price_usd_cents, sp.credits_included
       FROM organization_subscriptions os
       JOIN subscription_plans sp ON sp.id = os.plan_id
       WHERE os.organization_id = $1 AND os.status IN ('active','trialing')
       ORDER BY os.created_at DESC LIMIT 1`,
      [orgId],
    );
    if (!rows[0]) return null;
    const r = rows[0];
    return {
      id: r.id as string,
      planId: r.plan_id as string,
      planName: r.plan_name as string,
      planSlug: r.plan_slug as string,
      status: r.status as string,
      maxCasesPerMonth: r.max_cases_per_month as number,
      priceUsdCents: r.price_usd_cents as number,
      creditsIncluded: r.credits_included as number,
      casesThisPeriod: r.cases_this_period as number,
      currentPeriodStart: r.current_period_start as Date,
      currentPeriodEnd: r.current_period_end as Date,
    };
  }

  async activateSubscription(
    orgId: string,
    planSlug: string,
    actorEmail: string,
  ): Promise<ActiveSubscription> {
    const { rows: planRows } = await this.pool.query(
      `SELECT * FROM subscription_plans WHERE slug = $1 AND is_active = true`,
      [planSlug],
    );
    if (!planRows[0]) throw new NotFoundException(`Plan "${planSlug}" not found`);
    const plan = planRows[0];

    const client: PoolClient = await this.pool.connect();
    try {
      await client.query('BEGIN');
      // Cancel existing active subscription
      await client.query(
        `UPDATE organization_subscriptions
         SET status = 'canceled', updated_at = now()
         WHERE organization_id = $1 AND status IN ('active','trialing')`,
        [orgId],
      );
      // Create new subscription
      const { rows: subRows } = await client.query(
        `INSERT INTO organization_subscriptions
           (organization_id, plan_id, status, current_period_start, current_period_end)
         VALUES ($1, $2, 'active', now(), now() + interval '1 month')
         RETURNING *`,
        [orgId, plan.id],
      );
      // Grant plan credits
      await this.addCredits(
        orgId,
        plan.credits_included as number,
        'plan_grant',
        `${plan.name} plan activation`,
        actorEmail,
      );
      await client.query('COMMIT');
      this.logger.log(`Org ${orgId} activated plan ${planSlug} by ${actorEmail}`);
      return this.getActiveSubscription(orgId) as Promise<ActiveSubscription>;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
}
