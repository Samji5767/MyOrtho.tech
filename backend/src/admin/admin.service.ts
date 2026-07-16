import { Injectable, Inject, ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../notifications/email.service';

@Injectable()
export class AdminService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly auditService: AuditService,
    private readonly emailService: EmailService,
  ) {}

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

  async updateUserRole(userId: string, role: string, actorId: string, actorEmail?: string) {
    const valid = ['super_admin', 'clinic_admin', 'orthodontist', 'dentist',
                   'treatment_planner', 'lab_technician', 'reviewer', 'read_only'];
    if (!valid.includes(role)) throw new Error(`Invalid role: ${role}`);
    const { rows } = await this.pool.query(
      `UPDATE auth_users SET role = $1 WHERE id = $2 RETURNING organization_id`,
      [role, userId],
    );
    await this.auditService.log({
      organizationId: rows[0]?.organization_id ?? null,
      actorId,
      actorEmail,
      resourceType: 'user',
      resourceId: userId,
      action: 'admin.user.role_changed',
      details: { newRole: role },
    });
    return { updated: true };
  }

  async setUserActive(userId: string, active: boolean, actorId: string, actorEmail?: string) {
    const { rows } = await this.pool.query(
      `UPDATE auth_users SET is_active = $1 WHERE id = $2 RETURNING organization_id`,
      [active, userId],
    );
    await this.auditService.log({
      organizationId: rows[0]?.organization_id ?? null,
      actorId,
      actorEmail,
      resourceType: 'user',
      resourceId: userId,
      action: active ? 'admin.user.activated' : 'admin.user.deactivated',
      details: { active },
    });
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

  async grantCredits(orgId: string, amount: number, grantedBy: string, notes?: string, actorEmail?: string) {
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
    await this.auditService.log({
      organizationId: orgId,
      actorId: grantedBy,
      actorEmail,
      resourceType: 'organization',
      resourceId: orgId,
      action: 'admin.credits.granted',
      details: { amount, notes },
    });
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
        dto.allowedOrgIds ?? null,
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
        `SELECT sp.slug, sp.name, sp.price_usd_cents, COUNT(os.id)::int AS subscriber_count
         FROM subscription_plans sp
         LEFT JOIN organization_subscriptions os ON os.plan_id = sp.id AND os.status = 'active'
         GROUP BY sp.id, sp.slug, sp.name, sp.price_usd_cents
         ORDER BY sp.price_usd_cents DESC`,
      ),
      this.pool.query(
        `SELECT COUNT(*)::int AS total_exports,
                COALESCE(SUM(unit_price_cents),0)::bigint AS total_revenue_cents
         FROM billing_usage_meters
         WHERE metric_type = 'case_export' AND metered_at >= now() - interval '30 days'`,
      ),
      this.pool.query(
        `SELECT COALESCE(SUM(sp.price_usd_cents),0)::bigint AS mrr_cents
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
        priceCents: r.price_usd_cents,
        subscriberCount: r.subscriber_count,
        mrrCents: r.price_usd_cents * r.subscriber_count,
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

  // ─── Pilot Operations Snapshot ──────────────────────────────────────────────

  async getPilotOpsSnapshot() {
    const [
      feedbackTotals,
      feedbackBySeverity,
      feedbackByCategory,
      feedbackByStatus,
      onboardingProgress,
      casesByStatus,
      recentActivity,
      demoCount,
    ] = await Promise.all([
      this.pool.query(
        `SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE status NOT IN ('resolved','wont_fix'))::int AS open,
           COUNT(*) FILTER (WHERE severity = 'critical' AND status NOT IN ('resolved','wont_fix'))::int AS open_critical,
           COUNT(*) FILTER (WHERE severity = 'high' AND status NOT IN ('resolved','wont_fix'))::int AS open_high
         FROM pilot_feedback`,
      ),
      this.pool.query(
        `SELECT severity, COUNT(*)::int AS count FROM pilot_feedback GROUP BY severity ORDER BY
           CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END`,
      ),
      this.pool.query(
        `SELECT category, COUNT(*)::int AS count FROM pilot_feedback
         WHERE status NOT IN ('resolved','wont_fix')
         GROUP BY category ORDER BY count DESC`,
      ),
      this.pool.query(
        `SELECT status, COUNT(*)::int AS count FROM pilot_feedback GROUP BY status`,
      ),
      this.pool.query(
        `SELECT
           o.id AS org_id, o.name AS org_name,
           COUNT(oc.step_key)::int AS completed_steps,
           COUNT(oc.step_key) FILTER (WHERE oc.completed_at IS NULL)::int AS pending_steps
         FROM organizations o
         LEFT JOIN onboarding_checklists oc ON oc.organization_id = o.id
         GROUP BY o.id, o.name
         ORDER BY completed_steps DESC, o.name`,
      ),
      this.pool.query(
        `SELECT status, COUNT(*)::int AS count FROM cases
         WHERE is_demo = false OR is_demo IS NULL
         GROUP BY status ORDER BY count DESC`,
      ),
      this.pool.query(
        `SELECT
           we.case_id, we.from_status, we.to_status, we.actor_role,
           we.created_at,
           au.email AS actor_email,
           o.name AS org_name
         FROM workflow_events we
         LEFT JOIN cases c ON c.id = we.case_id
         LEFT JOIN organizations o ON o.id = c.organization_id
         LEFT JOIN auth_users au ON au.id = we.actor_id
         WHERE we.created_at >= now() - interval '48 hours'
         ORDER BY we.created_at DESC
         LIMIT 25`,
      ),
      this.pool.query(
        `SELECT COUNT(*)::int AS count FROM cases WHERE is_demo = true`,
      ),
    ]);

    const fb = feedbackTotals.rows[0];
    return {
      generatedAt: new Date().toISOString(),
      feedback: {
        total: fb.total as number,
        open: fb.open as number,
        openCritical: fb.open_critical as number,
        openHigh: fb.open_high as number,
        bySeverity: Object.fromEntries(
          feedbackBySeverity.rows.map((r) => [r.severity as string, r.count as number]),
        ) as Record<string, number>,
        byCategory: Object.fromEntries(
          feedbackByCategory.rows.map((r) => [r.category as string, r.count as number]),
        ) as Record<string, number>,
        byStatus: Object.fromEntries(
          feedbackByStatus.rows.map((r) => [r.status as string, r.count as number]),
        ) as Record<string, number>,
      },
      onboarding: {
        orgs: onboardingProgress.rows.map((r) => ({
          orgId: r.org_id as string,
          orgName: r.org_name as string,
          completedSteps: r.completed_steps as number,
          pendingSteps: r.pending_steps as number,
        })),
      },
      cases: {
        byStatus: Object.fromEntries(
          casesByStatus.rows.map((r) => [r.status as string, r.count as number]),
        ) as Record<string, number>,
        demoCount: demoCount.rows[0].count as number,
      },
      recentActivity: recentActivity.rows.map((r) => ({
        caseId: r.case_id as string,
        fromStatus: r.from_status as string,
        toStatus: r.to_status as string,
        actorRole: r.actor_role as string,
        actorEmail: r.actor_email as string | null,
        orgName: r.org_name as string | null,
        createdAt: r.created_at as Date,
      })),
    };
  }

  // ─── Org-admin: invite & role management ────────────────────────────────────

  async inviteUser(orgId: string, email: string, role: string): Promise<{ message: string }> {
    const validRoles = ['admin', 'orthodontist', 'dentist', 'lab_manager', 'lab_technician', 'resident', 'executive', 'clinical_director', 'vp_clinical', 'vp_manufacturing'];
    if (!validRoles.includes(role)) throw new BadRequestException(`Invalid role: ${role}`);
    const existing = await this.pool.query(
      'SELECT id FROM auth_users WHERE email=$1 AND organization_id=$2',
      [email, orgId],
    );
    if (existing.rowCount && existing.rowCount > 0) {
      throw new ConflictException('User already exists in this organization');
    }
    await this.pool.query(
      `INSERT INTO auth_users (email, organization_id, role, full_name, password_hash)
       VALUES ($1, $2, $3, $1, 'INVITE_PENDING')
       ON CONFLICT (email, organization_id) DO NOTHING`,
      [email, orgId, role],
    );
    await this.emailService.send({
      to: email,
      subject: 'You have been invited to MyOrtho.tech',
      html: `<p>You have been invited to join <strong>MyOrtho.tech</strong> as <strong>${role}</strong>.</p><p>Please contact your administrator for login credentials.</p><p><em>MyOrtho.tech — Clinical Orthodontic Platform</em></p>`,
      text: `You have been invited to join MyOrtho.tech as ${role}. Contact your administrator for login credentials.`,
    });
    return { message: `Invitation queued for ${email}` };
  }

  async updateOrgUserRole(orgId: string, userId: string, role: string): Promise<{ id: string; role: string }> {
    const validRoles = ['admin', 'orthodontist', 'dentist', 'lab_manager', 'lab_technician', 'resident', 'executive'];
    if (!validRoles.includes(role)) throw new BadRequestException('Invalid role');
    const res = await this.pool.query(
      'UPDATE auth_users SET role=$1 WHERE id=$2 AND organization_id=$3 RETURNING id, role',
      [role, userId, orgId],
    );
    if (!res.rowCount) throw new NotFoundException('User not found');
    return { id: res.rows[0].id as string, role: res.rows[0].role as string };
  }

  // ─── Self-service org profile (admin / super_admin of own org) ───────────────

  async getMyOrg(orgId: string) {
    const { rows } = await this.pool.query(
      `SELECT id, name, type, settings, created_at FROM organizations WHERE id = $1`,
      [orgId],
    );
    if (!rows.length) throw new NotFoundException('Organization not found');
    const r = rows[0];
    const settings = (r.settings ?? {}) as Record<string, unknown>;
    return {
      id: r.id as string,
      name: r.name as string,
      type: r.type as string,
      email: (settings['email'] ?? '') as string,
      phone: (settings['phone'] ?? '') as string,
      website: (settings['website'] ?? '') as string,
      address: (settings['address'] ?? '') as string,
      city: (settings['city'] ?? '') as string,
      state: (settings['state'] ?? '') as string,
      postalCode: (settings['postalCode'] ?? '') as string,
      country: (settings['country'] ?? '') as string,
      timezone: (settings['timezone'] ?? 'UTC') as string,
      currency: (settings['currency'] ?? 'USD') as string,
      language: (settings['language'] ?? 'en') as string,
      createdAt: r.created_at as string,
    };
  }

  async updateMyOrg(
    orgId: string,
    dto: {
      name?: string;
      type?: string;
      email?: string;
      phone?: string;
      website?: string;
      address?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
      timezone?: string;
      currency?: string;
      language?: string;
    },
    actorId: string,
    actorEmail?: string,
  ) {
    const validTypes = ['clinic', 'lab', 'enterprise'];
    if (dto.type && !validTypes.includes(dto.type)) throw new BadRequestException('Invalid organization type');

    const { name, type, ...settingsFields } = dto;
    const settingsPatch = JSON.stringify(settingsFields);

    await this.pool.query(
      `UPDATE organizations
          SET name     = COALESCE($2, name),
              type     = COALESCE($3, type),
              settings = settings || $4::jsonb,
              updated_at = now()
        WHERE id = $1`,
      [orgId, name ?? null, type ?? null, settingsPatch],
    );

    await this.auditService.log({
      organizationId: orgId,
      actorId,
      actorEmail,
      resourceType: 'organization',
      resourceId: orgId,
      action: 'admin.org.profile_updated',
      details: { fields: Object.keys(dto) },
    });

    return this.getMyOrg(orgId);
  }
}
