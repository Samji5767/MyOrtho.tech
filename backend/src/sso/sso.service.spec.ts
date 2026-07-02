import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SsoService } from './sso.service';
import { PG_POOL } from '../database/database.module';

const ORG_ID   = 'org-sso-test';
const BASE_URL = 'https://app.myortho.example';

function makePool(rows: unknown[] = []) {
  return { query: jest.fn().mockResolvedValue({ rows, rowCount: rows.length }) };
}

describe('SsoService.generateSpMetadata', () => {
  let svc: SsoService;
  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [SsoService, { provide: PG_POOL, useValue: makePool() }],
    }).compile();
    svc = mod.get(SsoService);
  });

  it('produces valid XML with EntityDescriptor and SPSSODescriptor', () => {
    const xml = svc.generateSpMetadata(BASE_URL);
    expect(xml).toContain('<?xml version="1.0"');
    expect(xml).toContain('<EntityDescriptor');
    expect(xml).toContain('<SPSSODescriptor');
    expect(xml).toContain('WantAssertionsSigned="true"');
    expect(xml).toContain('AuthnRequestsSigned="false"');
  });

  it('uses the base URL for entityID', () => {
    const xml = svc.generateSpMetadata(BASE_URL);
    expect(xml).toContain(`entityID="${BASE_URL}/api/sso"`);
  });

  it('includes the ACS URL for POST binding', () => {
    const xml = svc.generateSpMetadata(BASE_URL);
    expect(xml).toContain(`${BASE_URL}/api/sso/callback/saml`);
    expect(xml).toContain('HTTP-POST');
  });

  it('includes emailAddress NameIDFormat', () => {
    const xml = svc.generateSpMetadata(BASE_URL);
    expect(xml).toContain('emailAddress');
  });
});

describe('SsoService.getInitiateInfo', () => {
  let svc: SsoService;

  it('returns not-available when no config', async () => {
    const mod = await Test.createTestingModule({
      providers: [SsoService, { provide: PG_POOL, useValue: makePool([]) }],
    }).compile();
    svc = mod.get(SsoService);
    const info = await svc.getInitiateInfo(ORG_ID);
    expect(info.available).toBe(false);
    expect(info.note).toMatch(/not configured/i);
  });

  it('returns not-available when config is not active', async () => {
    const mod = await Test.createTestingModule({
      providers: [SsoService, { provide: PG_POOL, useValue: makePool([{
        id: '1', organization_id: ORG_ID, provider: 'saml', status: 'not_configured',
        email_domain: null, require_sso: false, display_name: null,
        entity_id: null, sso_url: null, discovery_url: null, client_id: null,
        created_at: new Date(), updated_at: new Date(),
      }]) }],
    }).compile();
    svc = mod.get(SsoService);
    const info = await svc.getInitiateInfo(ORG_ID);
    expect(info.available).toBe(false);
    expect(info.note).toMatch(/not active/i);
  });

  it('returns SAML sso_url when config is active saml', async () => {
    const mod = await Test.createTestingModule({
      providers: [SsoService, { provide: PG_POOL, useValue: makePool([{
        id: '2', organization_id: ORG_ID, provider: 'saml', status: 'active',
        email_domain: 'clinic.com', require_sso: true, display_name: 'Clinic IdP',
        entity_id: 'https://idp.clinic.com', sso_url: 'https://idp.clinic.com/sso',
        discovery_url: null, client_id: null,
        created_at: new Date(), updated_at: new Date(),
      }]) }],
    }).compile();
    svc = mod.get(SsoService);
    const info = await svc.getInitiateInfo(ORG_ID);
    expect(info.available).toBe(true);
    expect(info.provider).toBe('saml');
    expect(info.idpUrl).toBe('https://idp.clinic.com/sso');
  });

  it('returns not-available for OIDC (library not installed)', async () => {
    const mod = await Test.createTestingModule({
      providers: [SsoService, { provide: PG_POOL, useValue: makePool([{
        id: '3', organization_id: ORG_ID, provider: 'google', status: 'active',
        email_domain: 'clinic.com', require_sso: false, display_name: 'Google',
        entity_id: null, sso_url: null,
        discovery_url: 'https://accounts.google.com/.well-known/openid-configuration',
        client_id: 'client-abc',
        created_at: new Date(), updated_at: new Date(),
      }]) }],
    }).compile();
    svc = mod.get(SsoService);
    const info = await svc.getInitiateInfo(ORG_ID);
    expect(info.available).toBe(false);
    expect(info.provider).toBe('google');
    expect(info.note).toMatch(/openid-client/i);
  });
});

describe('SsoService.deleteConfiguration', () => {
  it('throws NotFoundException when provider not found', async () => {
    const mod = await Test.createTestingModule({
      providers: [SsoService, { provide: PG_POOL, useValue: { query: jest.fn().mockResolvedValue({ rowCount: 0 }) } }],
    }).compile();
    const svc = mod.get(SsoService);
    await expect(svc.deleteConfiguration(ORG_ID, 'saml')).rejects.toThrow(NotFoundException);
  });
});
