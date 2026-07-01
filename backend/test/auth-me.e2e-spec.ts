/**
 * E2E test for MeController / AuthController — covers both cookie and
 * Bearer-token auth paths, including the RC-1 fix that added Bearer support
 * to GET /api/me.
 */

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { AuthController, MeController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { PG_POOL } from '../src/database/database.module';
import { REDIS_CLIENT } from '../src/redis/redis.module';

const SECRET = 'test-secret-32-chars-minimum-ok!!';

// Minimal mock pool: login query returns one known user
function makeMockPool() {
  return {
    query: jest.fn((sql: string) => {
      if (/SELECT.*auth_users/i.test(sql) || /FROM auth_users/i.test(sql)) {
        return Promise.resolve({ rows: [{
          id: 'user-001',
          email: 'dr@clinic.com',
          full_name: 'Dr. Smith',
          role: 'orthodontist',
          organization_id: 'org-001',
          is_onboarded: true,
          password_hash: '$2b$12$eImiTXuWVxfM37uY4JANjQ==', // placeholder, login not tested here
        }] });
      }
      return Promise.resolve({ rows: [] });
    }),
  };
}

describe('Auth — /api/me and /api/auth/session (e2e)', () => {
  let app: INestApplication;
  let authService: AuthService;

  beforeAll(async () => {
    process.env.JWT_SECRET = SECRET;

    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController, MeController],
      providers: [
        AuthService,
        { provide: PG_POOL,      useValue: makeMockPool() },
        { provide: REDIS_CLIENT, useValue: null },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();

    authService = moduleRef.get(AuthService);
  });

  afterAll(async () => {
    await app.close();
  });

  function signTestToken() {
    return authService.signToken({
      sub: 'user-001',
      email: 'dr@clinic.com',
      role: 'orthodontist',
      name: 'Dr. Smith',
      orgId: 'org-001',
      isOnboarded: true,
    });
  }

  // ── /api/auth/session ──────────────────────────────────────────────────────

  it('GET /api/auth/session returns 401 with no credentials', async () => {
    await request(app.getHttpServer())
      .get('/api/auth/session')
      .expect(401);
  });

  it('GET /api/auth/session succeeds with Bearer token', async () => {
    const token = signTestToken();
    const res = await request(app.getHttpServer())
      .get('/api/auth/session')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.user.id).toBe('user-001');
    expect(res.body.user.email).toBe('dr@clinic.com');
    expect(res.body.user.role).toBe('orthodontist');
  });

  it('GET /api/auth/session succeeds with session cookie', async () => {
    const token = signTestToken();
    const res = await request(app.getHttpServer())
      .get('/api/auth/session')
      .set('Cookie', `mo_session=${token}`)
      .expect(200);
    expect(res.body.user.id).toBe('user-001');
  });

  // ── /api/me — RC-1 fix: Bearer token support ──────────────────────────────

  it('GET /api/me returns 401 with no credentials', async () => {
    await request(app.getHttpServer())
      .get('/api/me')
      .expect(401);
  });

  it('GET /api/me succeeds with Bearer token (RC-1 fix)', async () => {
    const token = signTestToken();
    const res = await request(app.getHttpServer())
      .get('/api/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.id).toBe('user-001');
    expect(res.body.email).toBe('dr@clinic.com');
    expect(res.body.orgId).toBe('org-001');
    expect(res.body.isOnboarded).toBe(true);
  });

  it('GET /api/me succeeds with session cookie', async () => {
    const token = signTestToken();
    const res = await request(app.getHttpServer())
      .get('/api/me')
      .set('Cookie', `mo_session=${token}`)
      .expect(200);
    expect(res.body.id).toBe('user-001');
  });

  it('GET /api/me returns 401 for a tampered token', async () => {
    const token = signTestToken();
    const tampered = token.slice(0, -5) + 'XXXXX';
    await request(app.getHttpServer())
      .get('/api/me')
      .set('Authorization', `Bearer ${tampered}`)
      .expect(401);
  });
});
