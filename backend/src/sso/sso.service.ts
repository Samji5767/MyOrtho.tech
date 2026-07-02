import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export type SsoProvider = 'saml' | 'oidc' | 'google' | 'microsoft' | 'okta' | 'onelogin';
export type SsoStatus = 'not_configured' | 'pending_verify' | 'active' | 'disabled';

export interface SsoConfiguration {
  id: string;
  organizationId: string;
  provider: SsoProvider;
  status: SsoStatus;
  emailDomain: string | null;
  requireSso: boolean;
  displayName: string | null;
  // Credential fields are omitted from API responses
  entityId: string | null;
  ssoUrl: string | null;
  discoveryUrl: string | null;
  clientId: string | null;
  createdAt: string;
  updatedAt: string;
}

function format(r: Record<string, unknown>): SsoConfiguration {
  return {
    id:             r['id'] as string,
    organizationId: r['organization_id'] as string,
    provider:       r['provider'] as SsoProvider,
    status:         r['status'] as SsoStatus,
    emailDomain:    r['email_domain'] as string | null,
    requireSso:     r['require_sso'] as boolean,
    displayName:    r['display_name'] as string | null,
    entityId:       r['entity_id'] as string | null,
    ssoUrl:         r['sso_url'] as string | null,
    discoveryUrl:   r['discovery_url'] as string | null,
    clientId:       r['client_id'] as string | null,
    createdAt:      r['created_at'] as string,
    updatedAt:      r['updated_at'] as string,
  };
}

@Injectable()
export class SsoService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async getConfiguration(orgId: string): Promise<SsoConfiguration | null> {
    const { rows } = await this.pool.query(
      `SELECT id, organization_id, provider, status, email_domain, require_sso,
              display_name, entity_id, sso_url, discovery_url, client_id,
              created_at, updated_at
         FROM sso_configurations
        WHERE organization_id = $1
          AND status != 'disabled'
        ORDER BY status DESC, created_at DESC
        LIMIT 1`,
      [orgId],
    );
    return rows.length ? format(rows[0]) : null;
  }

  async getStatus(orgId: string): Promise<{
    configured: boolean;
    status: SsoStatus | 'not_configured';
    provider: SsoProvider | null;
    emailDomain: string | null;
    requireSso: boolean;
    note: string;
  }> {
    const config = await this.getConfiguration(orgId);
    if (!config) {
      return {
        configured: false,
        status: 'not_configured',
        provider: null,
        emailDomain: null,
        requireSso: false,
        note:
          'No SSO provider is configured for this organization. ' +
          'SSO/SAML/OIDC integration is not yet active. ' +
          'Contact your administrator to configure an identity provider.',
      };
    }
    return {
      configured: config.status === 'active',
      status: config.status,
      provider: config.provider,
      emailDomain: config.emailDomain,
      requireSso: config.requireSso,
      note:
        config.status === 'active'
          ? `SSO is active via ${config.provider} for domain ${config.emailDomain ?? '(all users)'}.`
          : `SSO is configured (${config.provider}) but not yet active — status: ${config.status}.`,
    };
  }

  async createConfiguration(
    orgId: string,
    userId: string,
    dto: {
      provider: SsoProvider;
      emailDomain?: string;
      displayName?: string;
      entityId?: string;
      ssoUrl?: string;
      discoveryUrl?: string;
      clientId?: string;
    },
  ): Promise<SsoConfiguration> {
    const { rows } = await this.pool.query(
      `INSERT INTO sso_configurations
         (organization_id, provider, status, email_domain, display_name,
          entity_id, sso_url, discovery_url, client_id, created_by)
       VALUES ($1, $2, 'not_configured', $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (organization_id, provider)
         DO UPDATE SET
           email_domain   = EXCLUDED.email_domain,
           display_name   = EXCLUDED.display_name,
           entity_id      = EXCLUDED.entity_id,
           sso_url        = EXCLUDED.sso_url,
           discovery_url  = EXCLUDED.discovery_url,
           client_id      = EXCLUDED.client_id,
           updated_at     = now()
       RETURNING id, organization_id, provider, status, email_domain, require_sso,
                 display_name, entity_id, sso_url, discovery_url, client_id,
                 created_at, updated_at`,
      [
        orgId,
        dto.provider,
        dto.emailDomain ?? null,
        dto.displayName ?? null,
        dto.entityId ?? null,
        dto.ssoUrl ?? null,
        dto.discoveryUrl ?? null,
        dto.clientId ?? null,
        userId,
      ],
    );
    return format(rows[0]);
  }

  async deleteConfiguration(orgId: string, provider: SsoProvider): Promise<void> {
    const { rowCount } = await this.pool.query(
      `DELETE FROM sso_configurations WHERE organization_id = $1 AND provider = $2`,
      [orgId, provider],
    );
    if (!rowCount) throw new NotFoundException(`No SSO configuration found for provider: ${provider}`);
  }

  /**
   * Generate SAML 2.0 Service Provider metadata XML.
   * The ACS URL and entity ID are derived from the provided base URL.
   * This XML must be provided to the Identity Provider during configuration.
   * NOTE: AuthnRequests are not signed (no SP private key configured).
   */
  generateSpMetadata(baseUrl: string): string {
    const entityId = `${baseUrl}/api/sso`;
    const acsUrl   = `${baseUrl}/api/sso/callback/saml`;
    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata"',
      `                  entityID="${entityId}">`,
      '  <SPSSODescriptor',
      '      AuthnRequestsSigned="false"',
      '      WantAssertionsSigned="true"',
      '      protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">',
      '    <NameIDFormat>',
      '      urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
      '    </NameIDFormat>',
      '    <AssertionConsumerService',
      '        Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"',
      `        Location="${acsUrl}"`,
      '        index="1"',
      '        isDefault="true"/>',
      '  </SPSSODescriptor>',
      '</EntityDescriptor>',
    ].join('\n');
  }

  /**
   * Returns SSO initiation information for the organization.
   * For SAML: the IdP SSO URL to redirect to.
   * For OIDC: a note that authorization URL construction requires openid-client.
   * Does NOT produce a signed SAML AuthnRequest (library not installed).
   */
  async getInitiateInfo(orgId: string): Promise<{
    available: boolean;
    provider: SsoProvider | null;
    idpUrl: string | null;
    note: string;
  }> {
    const config = await this.getConfiguration(orgId);
    if (!config) {
      return { available: false, provider: null, idpUrl: null, note: 'SSO not configured for this organization.' };
    }
    if (config.status !== 'active') {
      return {
        available: false,
        provider: config.provider,
        idpUrl: null,
        note: `SSO configuration exists (${config.provider}) but is not active — status: ${config.status}. Contact your administrator.`,
      };
    }
    if (config.provider === 'saml') {
      return {
        available: !!config.ssoUrl,
        provider: 'saml',
        idpUrl: config.ssoUrl,
        note: config.ssoUrl
          ? 'SAML IdP URL provided. Full AuthnRequest signing requires @node-saml/node-saml (not yet installed). Direct redirect without signed request only.'
          : 'SAML sso_url is not configured. Update SSO configuration with the IdP SSO endpoint.',
      };
    }
    // OIDC providers: google, microsoft, okta, onelogin, oidc
    return {
      available: false,
      provider: config.provider,
      idpUrl: config.discoveryUrl,
      note: 'OIDC authorization code flow requires openid-client library (not yet installed). discovery_url is provided for reference. Install openid-client to enable OIDC login.',
    };
  }
}
