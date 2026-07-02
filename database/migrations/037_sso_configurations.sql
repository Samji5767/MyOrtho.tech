-- Migration 037: SSO/SAML/OIDC provider configuration table
--
-- This table stores the configuration for identity provider (IdP) integrations.
-- The SSO flow itself is NOT implemented in this release — this migration creates
-- the schema foundation for a future SAML 2.0 or OIDC integration.
--
-- Extension points for implementation:
--   SAML 2.0: populate entity_id, sso_url, x509_certificate
--   OIDC:     populate client_id, client_secret_enc, discovery_url
--             (client_secret_enc must be encrypted via CryptoService before INSERT)
--
-- Status values:
--   'not_configured'  — no IdP credentials have been entered
--   'pending_verify'  — credentials entered, domain verification pending
--   'active'          — verified and in use
--   'disabled'        — previously active, now disabled

CREATE TABLE IF NOT EXISTS sso_configurations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Provider type
  provider         TEXT NOT NULL CHECK (provider IN ('saml', 'oidc', 'google', 'microsoft', 'okta', 'onelogin')),
  status           TEXT NOT NULL DEFAULT 'not_configured'
                     CHECK (status IN ('not_configured', 'pending_verify', 'active', 'disabled')),

  -- SAML 2.0 fields
  entity_id        TEXT,          -- IdP entity ID / issuer URL
  sso_url          TEXT,          -- IdP SSO endpoint (HTTP-POST or HTTP-Redirect binding)
  slo_url          TEXT,          -- IdP single logout endpoint (optional)
  x509_certificate TEXT,          -- PEM-encoded IdP signing certificate

  -- OIDC fields
  discovery_url    TEXT,          -- OIDC discovery document URL (.well-known/openid-configuration)
  client_id        TEXT,          -- OIDC client ID (not secret)
  client_secret_enc TEXT,         -- OIDC client secret — must be AES-256-GCM encrypted by CryptoService

  -- Domain binding
  email_domain     TEXT,          -- e.g. 'clinic.com' — logins matching this domain use SSO
  require_sso      BOOLEAN NOT NULL DEFAULT FALSE, -- if TRUE, password login is blocked for this domain

  -- Metadata
  display_name     TEXT,          -- Human-readable name shown on login page
  created_by       UUID REFERENCES profiles(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Only one active config per org per provider
  CONSTRAINT sso_one_active_per_provider UNIQUE (organization_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_sso_configurations_org ON sso_configurations (organization_id);
CREATE INDEX IF NOT EXISTS idx_sso_configurations_domain ON sso_configurations (email_domain)
  WHERE status = 'active';

ALTER TABLE sso_configurations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sso_configurations_org_isolation ON sso_configurations;
CREATE POLICY sso_configurations_org_isolation ON sso_configurations
  USING (organization_id = app_current_org_id());
