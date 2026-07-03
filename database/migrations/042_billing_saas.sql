-- 042: SaaS billing — Stripe customer IDs, subscription plans, org subscription status
-- All operations are idempotent (IF NOT EXISTS / ON CONFLICT guards).
--
-- NOTE: subscription_plans and organization_subscriptions already exist from migration 004.
-- This migration adds missing columns and Stripe-specific fields to those tables
-- rather than recreating them.

-- ─── 1. Add Stripe fields to organizations ────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'stripe_customer_id'
  ) THEN
    ALTER TABLE organizations ADD COLUMN stripe_customer_id TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'billing_interval'
  ) THEN
    ALTER TABLE organizations ADD COLUMN billing_interval TEXT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_organizations_stripe_customer
  ON organizations(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- ─── 2. Extend subscription_plans (created by migration 004) ─────────────────
-- 004 schema: id uuid PK, name text, slug text UNIQUE, max_cases_per_month int,
--             price_usd_cents int, credits_included int, features jsonb, is_active bool, created_at

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_plans' AND column_name = 'stripe_price_id'
  ) THEN
    ALTER TABLE subscription_plans ADD COLUMN stripe_price_id TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_plans' AND column_name = 'trial_days'
  ) THEN
    ALTER TABLE subscription_plans ADD COLUMN trial_days INTEGER NOT NULL DEFAULT 14;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_plans' AND column_name = 'billing_interval'
  ) THEN
    ALTER TABLE subscription_plans ADD COLUMN billing_interval TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_plans' AND column_name = 'price_usd'
  ) THEN
    ALTER TABLE subscription_plans ADD COLUMN price_usd NUMERIC(10,2);
  END IF;
END $$;

-- Upsert the two SaaS plans (conflict on slug which is UNIQUE in migration 004)
INSERT INTO subscription_plans (name, slug, max_cases_per_month, price_usd_cents, credits_included, features, billing_interval, price_usd, trial_days)
VALUES
  ('MyOrtho Monthly', 'monthly', 9999, 5400,  999, '["Unlimited cases","AI segmentation","STL export","White-label branding","iOS companion access"]'::jsonb, 'monthly', 54.00, 14),
  ('MyOrtho Annual',  'annual',  9999, 49900, 999, '["Everything in Monthly","Save $149/year","Priority support","Custom subdomain"]'::jsonb,              'annual',  499.00, 14)
ON CONFLICT (slug) DO UPDATE
  SET name                = EXCLUDED.name,
      max_cases_per_month = EXCLUDED.max_cases_per_month,
      price_usd_cents     = EXCLUDED.price_usd_cents,
      features            = EXCLUDED.features,
      billing_interval    = EXCLUDED.billing_interval,
      price_usd           = EXCLUDED.price_usd,
      trial_days          = EXCLUDED.trial_days;

-- ─── 3. Extend organization_subscriptions (created by migration 004) ──────────
-- 004 schema: id uuid PK, organization_id uuid FK, plan_id uuid FK, status text,
--             current_period_start timestamptz, current_period_end timestamptz,
--             cases_this_period int, stripe_subscription_id text, created_at, updated_at
-- Missing: UNIQUE(organization_id), trial_ends_at, canceled_at

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organization_subscriptions' AND column_name = 'trial_ends_at'
  ) THEN
    ALTER TABLE organization_subscriptions ADD COLUMN trial_ends_at TIMESTAMPTZ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organization_subscriptions' AND column_name = 'canceled_at'
  ) THEN
    ALTER TABLE organization_subscriptions ADD COLUMN canceled_at TIMESTAMPTZ;
  END IF;
END $$;

-- Add UNIQUE constraint on organization_id so ON CONFLICT (organization_id) works
-- in the billing service's upsertSubscription helper.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'organization_subscriptions'::regclass
      AND contype = 'u'
      AND conname = 'uq_org_subscriptions_org'
  ) THEN
    ALTER TABLE organization_subscriptions
      ADD CONSTRAINT uq_org_subscriptions_org UNIQUE (organization_id);
  END IF;
END $$;

-- Extend status CHECK to include 'incomplete' (billing service uses this value)
-- We cannot ALTER a CHECK constraint in place, so we do this only if the column
-- does not already allow 'incomplete'.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid
    WHERE c.conrelid = 'organization_subscriptions'::regclass
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) LIKE '%incomplete%'
  ) THEN
    -- Drop and recreate the status check to widen it
    ALTER TABLE organization_subscriptions DROP CONSTRAINT IF EXISTS organization_subscriptions_status_check;
    ALTER TABLE organization_subscriptions
      ADD CONSTRAINT organization_subscriptions_status_check
      CHECK (status IN ('active', 'canceled', 'past_due', 'trialing', 'incomplete'));
  END IF;
END $$;
