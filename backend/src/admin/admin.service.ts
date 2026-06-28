import { Injectable, Inject } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

@Injectable()
export class AdminService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async listUsers(opts: { limit?: number; offset?: number } = {}) {
    const limit = opts.limit ?? 100;
    const offset = opts.offset ?? 0;
    const { rows } = await this.pool.query(
      `SELECT u.id, u.email, u.full_name, u.role, u.is_onboarded, u.is_active,
              u.created_at, u.last_login_at,
              o.name AS organization_name, o.id AS organization_id
         FROM auth_users u
         LEFT JOIN organizations o ON o.id = u.organization_id
         ORDER BY u.created_at DESC
         LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    return rows;
  }

  async updateUserRole(userId: string, role: string) {
    const valid = ['super_admin', 'clinic_admin', 'orthodontist', 'dentist',
                   'treatment_planner', 'lab_technician', 'reviewer', 'read_only'];
    if (!valid.includes(role)) throw new Error(`Invalid role: ${role}`);
    await this.pool.query(
      `UPDATE auth_users SET role = $1 WHERE id = $2`,
      [role, userId],
    );
    return { updated: true };
  }

  async setUserActive(userId: string, active: boolean) {
    await this.pool.query(
      `UPDATE auth_users SET is_active = $1 WHERE id = $2`,
      [active, userId],
    );
    return { updated: true };
  }

  async listOrgs(opts: { limit?: number; offset?: number } = {}) {
    const limit = opts.limit ?? 100;
    const offset = opts.offset ?? 0;
    const { rows } = await this.pool.query(
      `SELECT o.id, o.name, o.type, o.created_at,
              COUNT(u.id)::int AS user_count,
              COALESCE(oc.balance, 0) AS credit_balance
         FROM organizations o
         LEFT JOIN auth_users u ON u.organization_id = o.id
         LEFT JOIN organization_credits oc ON oc.organization_id = o.id
         GROUP BY o.id, o.name, o.type, o.created_at, oc.balance
         ORDER BY o.created_at DESC
         LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    return rows;
  }

  async grantCredits(orgId: string, amount: number, grantedBy: string, notes?: string) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO organization_credits (organization_id, balance)
         VALUES ($1, $2)
         ON CONFLICT (organization_id)
         DO UPDATE SET balance = organization_credits.balance + $2, updated_at = now()`,
        [orgId, amount],
      );
      await client.query(
        `INSERT INTO credit_transactions
           (organization_id, amount, type, notes, created_by)
         VALUES ($1, $2, 'admin_grant', $3, $4)`,
        [orgId, amount, notes ?? `Admin grant by ${grantedBy}`, grantedBy],
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    return { granted: amount };
  }

  async listAuditEvents(opts: { limit?: number; offset?: number; orgId?: string } = {}) {
    const limit = opts.limit ?? 100;
    const offset = opts.offset ?? 0;
    if (opts.orgId) {
      const { rows } = await this.pool.query(
        `SELECT ae.*, u.full_name AS actor_name
           FROM audit_events ae
           LEFT JOIN auth_users u ON u.id = ae.actor_id
           WHERE ae.organization_id = $1
           ORDER BY ae.created_at DESC
           LIMIT $2 OFFSET $3`,
        [opts.orgId, limit, offset],
      );
      return rows;
    }
    const { rows } = await this.pool.query(
      `SELECT ae.*, u.full_name AS actor_name, o.name AS org_name
         FROM audit_events ae
         LEFT JOIN auth_users u ON u.id = ae.actor_id
         LEFT JOIN organizations o ON o.id = ae.organization_id
         ORDER BY ae.created_at DESC
         LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    return rows;
  }

  // ─── Feature flags ──────────────────────────────────────────────────────────

  async listFeatureFlags() {
    const { rows } = await this.pool.query(
      `SELECT id, flag_key, enabled, description, rollout_percentage, allowed_org_ids, created_at
       FROM feature_flags ORDER BY flag_key ASC`,
    );
    return rows.map(r => ({
      id: r.id,
      flagKey: r.flag_key,
      enabled: r.enabled,
      description: r.description ?? null,
      rolloutPercentage: r.rollout_percentage,
      allowedOrgIds: r.allowed_org_ids ?? [],
      createdAt: r.created_at,
    }));
  }

  async upsertFeatureFlag(
    flagKey: string,
    dto: { enabled?: boolean; description?: string; rolloutPercentage?: number; allowedOrgIds?: string[] },
  ) {
    const { rows } = await this.pool.query(
      `INSERT INTO feature_flags (flag_key, enabled, description, rollout_percentage, allowed_org_ids)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (flag_key) DO UPDATE SET
         enabled             = COALESCE($2, feature_flags.enabled),
         description         = COALESCE($3, feature_flags.description),
         rollout_percentage  = COALESCE($4, feature_flags.rollout_percentage),
         allowed_org_ids     = COALESCE($5, feature_flags.allowed_org_ids)
       RETURNING id, flag_key, enabled, description, rollout_percentage, allowed_org_ids, created_at`,
      [
        flagKey,
        dto.enabled ?? null,
        dto.description ?? null,
        dto.rolloutPercentage ?? null,
        dto.allowedOrgIds ? `{${dto.allowedOrgIds.map(id => `"${id}"`).join(',')}}` : null,
      ],
    );
    const r = rows[0];
    return {
      id: r.id,
      flagKey: r.flag_key,
      enabled: r.enabled,
      description: r.description ?? null,
      rolloutPercentage: r.rollout_percentage,
      allowedOrgIds: r.allowed_org_ids ?? [],
      createdAt: r.created_at,
    };
  }

  // ─── Revenue dashboard ───────────────────────────────────────────────────────

  async getRevenueDashboard() {
    const [sub, payg, mrr, topOrgs] = await Promise.all([
      this.pool.query(
        `SELECT sp.slug, sp.name, sp.price_cents, COUNT(os.id)::int AS subscriber_count
         FROM subscription_plans sp
         LEFT JOIN organization_subscriptions os ON os.plan_id = sp.id AND os.status = 'active'
         GROUP BY sp.id, sp.slug, sp.name, sp.price_cents
         ORDER BY sp.price_cents DESC`,
      ),
      this.pool.query(
        `SELECT COUNT(*)::int AS total_exports,
                COALESCE(SUM(amount_cents),0)::bigint AS total_revenue_cents
         FROM usage_events
         WHERE metric_type = 'case_export' AND recorded_at >= now() - interval '30 days'`,
      ),
      this.pool.query(
        `SELECT COALESCE(SUM(sp.price_cents),0)::bigint AS mrr_cents
         FROM organization_subscriptions os
         JOIN subscription_plans sp ON sp.id = os.plan_id
         WHERE os.status = 'active'`,
      ),
      this.pool.query(
        `SELECT o.name, oc.balance AS credits, COUNT(c.id)::int AS case_count
         FROM organizations o
         LEFT JOIN organization_credits oc ON oc.organization_id = o.id
         LEFT JOIN cases c ON c.organization_id = o.id
         GROUP BY o.id, o.name, oc.balance
         ORDER BY case_count DESC LIMIT 10`,
      ),
    ]);

    const mrrCents = Number(mrr.rows[0]?.mrr_cents ?? 0);
    return {
      mrrCents,
      arrCents: mrrCents * 12,
      paygRevenueCents: Number(payg.rows[0]?.total_revenue_cents ?? 0),
      totalExports: payg.rows[0]?.total_exports ?? 0,
      plans: sub.rows.map(r => ({
        slug: r.slug,
        name: r.name,
        priceCents: r.price_cents,
        subscriberCount: r.subscriber_count,
        mrrCents: r.price_cents * r.subscriber_count,
      })),
      topOrgs: topOrgs.rows,
    };
  }

  async getPlatformStats() {
    const [users, orgs, cases, credits] = await Promise.all([
      this.pool.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE is_active) ::int AS active FROM auth_users`),
      this.pool.query(`SELECT COUNT(*)::int AS total FROM organizations`),
      this.pool.query(`SELECT COUNT(*)::int AS total FROM cases`),
      this.pool.query(`SELECT COALESCE(SUM(balance), 0)::int AS total FROM organization_credits`),
    ]);
    return {
      users: users.rows[0],
      orgs: orgs.rows[0],
      cases: cases.rows[0],
      credits: credits.rows[0],
    };
  }
}
