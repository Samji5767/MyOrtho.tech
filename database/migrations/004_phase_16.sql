-- ============================================================================
-- Migration 004: Phase 16 — Blue Sky Bio parity
--
-- 16A: (no schema changes — scan file served from existing scans table)
-- 16B: tooth_notation preference stored in organizations.settings JSON
-- 16C: Credit wallet + subscription tiers (PostgreSQL-native, no Supabase)
--
-- Safe to re-run: all statements use IF NOT EXISTS / ON CONFLICT DO UPDATE.
-- Run after: 001_auth_users.sql, 002_vps_core_schema.sql, 003_phases_15d_15e_15f.sql
-- ============================================================================

-- ─── 16C: Credit Wallet ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS organization_credits (
    id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id uuid        REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    balance         int         NOT NULL DEFAULT 0 CHECK (balance >= 0),
    updated_at      timestamptz DEFAULT now(),
    UNIQUE (organization_id)
);

CREATE TABLE IF NOT EXISTS credit_transactions (
    id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id uuid        REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    amount          int         NOT NULL,  -- positive = credit, negative = debit
    type            text        NOT NULL CHECK (type IN (
                                    'purchase', 'plan_grant',
                                    'import_debit', 'ai_job_debit',
                                    'refund', 'admin_grant')),
    reference_id    text,
    notes           text,
    created_by      text,
    created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_txn_org     ON credit_transactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_credit_txn_created ON credit_transactions(created_at);

-- ─── 16C: Subscription Plans ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS subscription_plans (
    id                   uuid    PRIMARY KEY DEFAULT uuid_generate_v4(),
    name                 text    NOT NULL,
    slug                 text    NOT NULL,
    max_cases_per_month  int     NOT NULL,
    price_usd_cents      int     NOT NULL,  -- e.g. 29900 = $299.00
    credits_included     int     NOT NULL DEFAULT 50,
    features             jsonb   NOT NULL DEFAULT '[]',
    is_active            boolean NOT NULL DEFAULT true,
    created_at           timestamptz DEFAULT now(),
    UNIQUE (slug)
);

INSERT INTO subscription_plans (name, slug, max_cases_per_month, price_usd_cents, credits_included, features)
VALUES
  ('Starter',      'starter',    25,  29900,  50,
   '["Up to 25 cases/month","50 STL import credits","AI segmentation","Basic analytics"]'::jsonb),
  ('Professional', 'pro',       100,  49900, 150,
   '["Up to 100 cases/month","150 STL import credits","AI segmentation","Advanced analytics","Priority support"]'::jsonb),
  ('Enterprise',   'enterprise', 260,  69900, 500,
   '["Up to 260 cases/month","500 STL import credits","AI segmentation","Enterprise analytics","Dedicated support","Multi-location"]'::jsonb)
ON CONFLICT (slug) DO UPDATE
  SET name                = EXCLUDED.name,
      max_cases_per_month = EXCLUDED.max_cases_per_month,
      price_usd_cents     = EXCLUDED.price_usd_cents,
      credits_included    = EXCLUDED.credits_included,
      features            = EXCLUDED.features;

CREATE TABLE IF NOT EXISTS organization_subscriptions (
    id                      uuid    PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id         uuid    REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    plan_id                 uuid    REFERENCES subscription_plans(id) NOT NULL,
    status                  text    NOT NULL DEFAULT 'active'
                                    CHECK (status IN ('active','canceled','past_due','trialing')),
    current_period_start    timestamptz NOT NULL DEFAULT now(),
    current_period_end      timestamptz NOT NULL DEFAULT (now() + interval '1 month'),
    cases_this_period       int     NOT NULL DEFAULT 0,
    stripe_subscription_id  text,
    created_at              timestamptz DEFAULT now(),
    updated_at              timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_sub_org    ON organization_subscriptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_sub_status ON organization_subscriptions(status);
