-- 042: SaaS billing — Stripe customer IDs, subscription plans, org subscription status
-- All operations are idempotent (IF NOT EXISTS / ON CONFLICT guards).

-- Add Stripe customer ID and billing interval to organizations
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
    ALTER TABLE organizations ADD COLUMN billing_interval TEXT CHECK (billing_interval IN ('monthly', 'annual'));
  END IF;
END $$;

-- Subscription plans table (source of truth for pricing)
CREATE TABLE IF NOT EXISTS subscription_plans (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  interval      TEXT NOT NULL CHECK (interval IN ('monthly', 'annual')),
  price_usd     NUMERIC(10, 2) NOT NULL,
  stripe_price_id TEXT,
  trial_days    INTEGER NOT NULL DEFAULT 14,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Upsert canonical plans — safe to re-run
INSERT INTO subscription_plans (id, name, interval, price_usd, trial_days)
VALUES
  ('monthly', 'MyOrtho Monthly', 'monthly', 54.00, 14),
  ('annual',  'MyOrtho Annual',  'annual',  499.00, 14)
ON CONFLICT (id) DO UPDATE
  SET name      = EXCLUDED.name,
      price_usd = EXCLUDED.price_usd,
      interval  = EXCLUDED.interval;

-- Organization subscriptions table
CREATE TABLE IF NOT EXISTS organization_subscriptions (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id       UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id               TEXT REFERENCES subscription_plans(id),
  status                TEXT NOT NULL DEFAULT 'trialing'
                          CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'incomplete')),
  stripe_subscription_id TEXT,
  current_period_start  TIMESTAMPTZ,
  current_period_end    TIMESTAMPTZ,
  trial_ends_at         TIMESTAMPTZ,
  canceled_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_subscriptions_org ON organization_subscriptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_subscriptions_status ON organization_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_organizations_stripe_customer ON organizations(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
