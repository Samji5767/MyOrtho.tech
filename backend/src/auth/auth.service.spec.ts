import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { AuthService, SessionPayload } from './auth.service';

const SECRET = 'testsecret-32-chars-min-for-tests!!';

// Default DB row returned by the mock pool for verifyToken queries.
// All mutable fields are present so the extended query in verifyToken() succeeds.
const DEFAULT_ACTIVE_ROW = {
  is_active: true,
  email_verified_at: new Date(),
  is_onboarded: true,
  sessions_invalidated_at: null,
};

function makeService(poolOverride?: object): AuthService {
  process.env.JWT_SECRET = SECRET;
  const mockPool = poolOverride ?? {
    query: jest.fn().mockResolvedValue({ rows: [DEFAULT_ACTIVE_ROW] }),
  };
  // Constructor: (pool, redis, emailService). Pass null for both optional deps in unit tests.
  return new (AuthService as any)(mockPool, null, null);
}

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    service = makeService();
  });

  // ─── signToken / verifyToken ───────────────────────────────────────────────

  describe('signToken / verifyToken', () => {
    const payload: SessionPayload = {
      sub: 'user-id-1',
      email: 'dr@clinic.com',
      role: 'orthodontist',
      name: 'Dr Smith',
      orgId: 'org-1',
      workspaceId: null,
      isOnboarded: true,
      isEmailVerified: true,
      jti: 'test-jti-12345',
    };

    it('signs a JWT and verifies it back successfully', async () => {
      const token = service.signToken(payload);
      expect(typeof token).toBe('string');
      const verified = await service.verifyToken(token);
      expect(verified.sub).toBe(payload.sub);
      expect(verified.email).toBe(payload.email);
      expect(verified.orgId).toBe(payload.orgId);
    });

    it('throws UnauthorizedException for a tampered token', async () => {
      const token = service.signToken(payload);
      const tampered = token.slice(0, -5) + 'XXXXX';
      await expect(service.verifyToken(tampered)).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for an expired token', async () => {
      const expired = jwt.sign({ ...payload, exp: Math.floor(Date.now() / 1000) - 1 }, SECRET);
      await expect(service.verifyToken(expired)).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for a token signed with a different secret', async () => {
      const wrongToken = jwt.sign(payload, 'totally-different-secret-!!!!!!!!!!!');
      await expect(service.verifyToken(wrongToken)).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when the account is deactivated', async () => {
      const inactivePool = {
        query: jest.fn().mockResolvedValue({ rows: [{ ...DEFAULT_ACTIVE_ROW, is_active: false }] }),
      };
      const svc = makeService(inactivePool);
      const token = svc.signToken(payload);
      await expect(svc.verifyToken(token)).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when the user row is missing from the DB', async () => {
      const missingPool = {
        query: jest.fn().mockResolvedValue({ rows: [] }),
      };
      const svc = makeService(missingPool);
      const token = svc.signToken(payload);
      await expect(svc.verifyToken(token)).rejects.toThrow(UnauthorizedException);
    });

    it('overrides stale isEmailVerified=true in JWT when DB shows unverified', async () => {
      const unverifiedPool = {
        query: jest.fn().mockResolvedValue({
          rows: [{ ...DEFAULT_ACTIVE_ROW, email_verified_at: null }],
        }),
      };
      const svc = makeService(unverifiedPool);
      // Sign a token that claims email is verified
      const token = svc.signToken({ ...payload, isEmailVerified: true });
      const verified = await svc.verifyToken(token);
      // DB says unverified — JWT claim must be overridden
      expect(verified.isEmailVerified).toBe(false);
    });

    it('overrides stale isEmailVerified=false in JWT when DB shows verified', async () => {
      const verifiedPool = {
        query: jest.fn().mockResolvedValue({
          rows: [{ ...DEFAULT_ACTIVE_ROW, email_verified_at: new Date() }],
        }),
      };
      const svc = makeService(verifiedPool);
      // Sign a token that claims email is NOT verified (stale token from before verification)
      const token = svc.signToken({ ...payload, isEmailVerified: false });
      const verified = await svc.verifyToken(token);
      // DB says verified — JWT claim must be overridden
      expect(verified.isEmailVerified).toBe(true);
    });

    it('overrides stale isOnboarded in JWT when DB has a different value', async () => {
      const notOnboardedPool = {
        query: jest.fn().mockResolvedValue({
          rows: [{ ...DEFAULT_ACTIVE_ROW, is_onboarded: false }],
        }),
      };
      const svc = makeService(notOnboardedPool);
      const token = svc.signToken({ ...payload, isOnboarded: true });
      const verified = await svc.verifyToken(token);
      expect(verified.isOnboarded).toBe(false);
    });
  });

  // ─── sessions_invalidated_at (password-reset revocation) ──────────────────

  describe('sessions_invalidated_at', () => {
    const payload: SessionPayload = {
      sub: 'user-id-2',
      email: 'dr@clinic.com',
      role: 'orthodontist',
      name: 'Dr Jones',
      orgId: 'org-2',
      workspaceId: null,
      isOnboarded: true,
      isEmailVerified: true,
      jti: 'revoke-test-jti',
    };

    it('accepts a token issued after sessions_invalidated_at', async () => {
      const pastDate = new Date(Date.now() - 60_000); // 1 minute ago
      const pool = {
        query: jest.fn().mockResolvedValue({
          rows: [{ ...DEFAULT_ACTIVE_ROW, sessions_invalidated_at: pastDate }],
        }),
      };
      const svc = makeService(pool);
      // Token issued NOW (after pastDate) — should be accepted
      const token = svc.signToken(payload);
      await expect(svc.verifyToken(token)).resolves.toBeDefined();
    });

    it('rejects a token issued before sessions_invalidated_at', async () => {
      // Issue the token first (its iat will be ~now)
      process.env.JWT_SECRET = SECRET;
      const svc0 = makeService();
      const token = svc0.signToken(payload);

      // Now simulate a password reset that happened AFTER the token was issued
      const futureInvalidation = new Date(Date.now() + 5_000); // 5 seconds in the future
      const pool = {
        query: jest.fn().mockResolvedValue({
          rows: [{ ...DEFAULT_ACTIVE_ROW, sessions_invalidated_at: futureInvalidation }],
        }),
      };
      const svc = makeService(pool);
      await expect(svc.verifyToken(token)).rejects.toThrow(UnauthorizedException);
    });
  });

  // ─── checkRateLimit ────────────────────────────────────────────────────────

  describe('checkRateLimit (in-memory fallback)', () => {
    it('allows up to 10 requests per IP within a minute', async () => {
      const ip = '192.168.1.1';
      for (let i = 0; i < 10; i++) {
        expect(await service.checkRateLimit(ip)).toBe(true);
      }
    });

    it('blocks the 11th request from the same IP', async () => {
      const ip = '10.0.0.1';
      for (let i = 0; i < 10; i++) {
        await service.checkRateLimit(ip);
      }
      expect(await service.checkRateLimit(ip)).toBe(false);
    });

    it('allows a different IP while one is rate-limited', async () => {
      const blocked = '172.16.0.1';
      const allowed = '172.16.0.2';
      for (let i = 0; i < 10; i++) await service.checkRateLimit(blocked);
      await service.checkRateLimit(blocked); // now blocked
      expect(await service.checkRateLimit(allowed)).toBe(true);
    });

    it('resets the counter after the window expires', async () => {
      const ip = '1.2.3.4';
      // Exhaust the window
      for (let i = 0; i < 10; i++) await service.checkRateLimit(ip);
      expect(await service.checkRateLimit(ip)).toBe(false);

      // Manually fast-forward the reset timestamp in the in-memory map
      const map = (service as any).loginAttemptsFallback as Map<string, { count: number; resetAt: number }>;
      const record = map.get(ip)!;
      record.resetAt = Date.now() - 1; // expired

      expect(await service.checkRateLimit(ip)).toBe(true);
    });
  });

  // ─── verifyEmail token security ───────────────────────────────────────────

  describe('verifyEmail token security', () => {
    it('only stores the SHA-256 hash, not the raw token', async () => {
      let storedHash: string | undefined;
      const pool = {
        query: jest.fn().mockImplementation((sql: string, params: unknown[]) => {
          // Capture what gets stored
          if (sql.includes('verification_token_hash') && sql.includes('UPDATE')) {
            storedHash = params[0] as string;
          }
          if (sql.includes('SELECT email_verified_at')) {
            return Promise.resolve({ rows: [{ email_verified_at: null }] });
          }
          return Promise.resolve({ rows: [{ email: 'x@x.com', full_name: null }] });
        }),
      };
      const svc = makeService(pool);
      await svc.sendVerificationEmail('user-id-1');

      expect(storedHash).toBeDefined();
      // A SHA-256 hex digest is always 64 chars
      expect(storedHash).toHaveLength(64);
      // Must be hex only
      expect(storedHash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('rejects an invalid (random) verification token', async () => {
      const pool = {
        query: jest.fn().mockResolvedValue({ rows: [] }), // token not found
      };
      const svc = makeService(pool);
      const fakeToken = crypto.randomBytes(32).toString('hex');
      await expect(svc.verifyEmail(fakeToken)).rejects.toThrow(BadRequestException);
    });

    it('rejects an expired verification token', async () => {
      const pool = {
        query: jest.fn().mockResolvedValue({
          rows: [{
            id: 'user-1',
            verification_token_expires_at: new Date(Date.now() - 1000), // 1 second ago
          }],
        }),
      };
      const svc = makeService(pool);
      await expect(svc.verifyEmail('any-token')).rejects.toThrow(BadRequestException);
    });

    it('does not send verification email to an already-verified account', async () => {
      let emailSent = false;
      const pool = {
        query: jest.fn().mockResolvedValue({
          rows: [{ email_verified_at: new Date() }], // already verified
        }),
      };
      const svc = makeService(pool);
      // If send is called it would throw because emailService is null
      // The method should return early without sending
      await expect(svc.sendVerificationEmail('user-id')).resolves.toBeUndefined();
      expect(emailSent).toBe(false);
    });
  });

  // ─── resetPassword token security ─────────────────────────────────────────

  describe('resetPassword token security', () => {
    it('rejects a reset token that does not exist', async () => {
      const pool = {
        query: jest.fn().mockResolvedValue({ rows: [] }),
      };
      const svc = makeService(pool);
      await expect(svc.resetPassword('bad-token', 'newpassword1')).rejects.toThrow(BadRequestException);
    });

    it('rejects an expired reset token', async () => {
      const pool = {
        query: jest.fn().mockResolvedValue({
          rows: [{ id: 'user-1', reset_token_expires_at: new Date(Date.now() - 1000) }],
        }),
      };
      const svc = makeService(pool);
      await expect(svc.resetPassword('expired-token', 'newpassword1')).rejects.toThrow(BadRequestException);
    });

    it('rejects a password shorter than 8 characters', async () => {
      const svc = makeService();
      await expect(svc.resetPassword('any-token', 'short')).rejects.toThrow(BadRequestException);
    });

    it('sets sessions_invalidated_at after successful password reset', async () => {
      let invalidatedAtSet = false;
      const pool = {
        query: jest.fn().mockImplementation((sql: string) => {
          // Check sessions_invalidated_at first: the UPDATE contains both
          // 'reset_token_hash = NULL' and 'sessions_invalidated_at = now()',
          // so this branch must come before the SELECT branch.
          if (sql.includes('sessions_invalidated_at')) {
            invalidatedAtSet = true;
            return Promise.resolve({ rows: [] });
          }
          if (sql.includes('reset_token_hash')) {
            return Promise.resolve({
              rows: [{ id: 'user-1', reset_token_expires_at: new Date(Date.now() + 60_000) }],
            });
          }
          return Promise.resolve({ rows: [] });
        }),
      };
      const svc = makeService(pool);
      await svc.resetPassword('valid-token', 'newpassword123');
      expect(invalidatedAtSet).toBe(true);
    });
  });

  // ─── workspace membership re-validation ───────────────────────────────────

  describe('workspace membership re-validation', () => {
    const wsPayload: SessionPayload = {
      sub: 'user-ws-1',
      email: 'ws@clinic.com',
      role: 'orthodontist',
      name: 'Dr Workspace',
      orgId: 'org-ws-1',
      workspaceId: 'ws-001',
      isOnboarded: true,
      isEmailVerified: true,
      jti: 'ws-jti-001',
    };

    it('nullifies workspaceId in payload when membership is revoked', async () => {
      const pool = {
        query: jest.fn().mockImplementation((sql: string) => {
          if (sql.includes('workspace_memberships')) {
            return Promise.resolve({ rows: [] }); // membership removed
          }
          return Promise.resolve({ rows: [DEFAULT_ACTIVE_ROW] });
        }),
      };
      const svc = makeService(pool);
      const token = svc.signToken(wsPayload);
      const verified = await svc.verifyToken(token);
      expect(verified.workspaceId).toBeNull();
    });

    it('preserves workspaceId when membership is still valid', async () => {
      const pool = {
        query: jest.fn().mockImplementation((sql: string) => {
          if (sql.includes('workspace_memberships')) {
            return Promise.resolve({ rows: [{ '?column?': 1 }] }); // membership active
          }
          return Promise.resolve({ rows: [DEFAULT_ACTIVE_ROW] });
        }),
      };
      const svc = makeService(pool);
      const token = svc.signToken(wsPayload);
      const verified = await svc.verifyToken(token);
      expect(verified.workspaceId).toBe('ws-001');
    });

    it('skips workspace membership check when token carries no workspaceId', async () => {
      let wsQueryCalled = false;
      const pool = {
        query: jest.fn().mockImplementation((sql: string) => {
          if (sql.includes('workspace_memberships')) wsQueryCalled = true;
          return Promise.resolve({ rows: [DEFAULT_ACTIVE_ROW] });
        }),
      };
      const svc = makeService(pool);
      const noWsPayload: SessionPayload = { ...wsPayload, workspaceId: null, jti: 'no-ws-jti' };
      const token = svc.signToken(noWsPayload);
      await svc.verifyToken(token);
      expect(wsQueryCalled).toBe(false);
    });

    it('workspace membership query binds user sub and workspaceId', async () => {
      const queryCalls: Array<[string, unknown[]]> = [];
      const pool = {
        query: jest.fn().mockImplementation((sql: string, params: unknown[]) => {
          queryCalls.push([sql, params]);
          if (sql.includes('workspace_memberships')) {
            return Promise.resolve({ rows: [{ '?column?': 1 }] });
          }
          return Promise.resolve({ rows: [DEFAULT_ACTIVE_ROW] });
        }),
      };
      const svc = makeService(pool);
      const token = svc.signToken(wsPayload);
      await svc.verifyToken(token);

      const wsCall = queryCalls.find(([sql]) => sql.includes('workspace_memberships'));
      expect(wsCall).toBeDefined();
      const [, wsParams] = wsCall!;
      expect(wsParams[0]).toBe('user-ws-1');   // user sub
      expect(wsParams[1]).toBe('ws-001');        // workspaceId
    });
  });

  // ─── login() ──────────────────────────────────────────────────────────────

  describe('login()', () => {
    const DUMMY_HASH = '$2b$12$AAAAAAAAAAAAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const userRow = {
      id: 'login-user-1',
      email: 'dr@clinic.com',
      password_hash: DUMMY_HASH,
      full_name: 'Dr Login',
      role: 'orthodontist',
      organization_id: 'org-login-1',
      is_onboarded: true,
      is_active: true,
      email_verified_at: new Date(),
      verification_token_hash: null,
      verification_token_expires_at: null,
      reset_token_hash: null,
      reset_token_expires_at: null,
      sessions_invalidated_at: null,
    };

    it('throws UnauthorizedException for an unrecognised email', async () => {
      const pool = { query: jest.fn().mockResolvedValue({ rows: [] }) };
      const svc = makeService(pool);
      await expect(svc.login('ghost@nowhere.com', 'anypassword')).rejects.toThrow(UnauthorizedException);
    }, 10_000);

    it('throws UnauthorizedException for a wrong password', async () => {
      const pool = { query: jest.fn().mockResolvedValue({ rows: [userRow] }) };
      const svc = makeService(pool);
      await expect(svc.login('dr@clinic.com', 'wrong-password')).rejects.toThrow(UnauthorizedException);
    }, 10_000);

    it('throws UnauthorizedException for an inactive account', async () => {
      const inactiveRow = { ...userRow, is_active: false };
      const pool = { query: jest.fn().mockResolvedValue({ rows: [inactiveRow] }) };
      const compareSpy = jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
      try {
        const svc = makeService(pool);
        await expect(svc.login('dr@clinic.com', 'password123')).rejects.toThrow(UnauthorizedException);
      } finally {
        compareSpy.mockRestore();
      }
    });

    it('returns a SessionPayload on valid credentials', async () => {
      const compareSpy = jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
      try {
        const pool = {
          query: jest.fn()
            .mockResolvedValueOnce({ rows: [userRow] })                          // findByEmail
            .mockResolvedValueOnce({ rows: [] })                                  // UPDATE last_login_at
            .mockResolvedValueOnce({ rows: [{ organization_id: 'org-login-1' }] }) // toPayload: org
            .mockResolvedValueOnce({ rows: [] }),                                 // toPayload: workspace
        };
        const svc = makeService(pool);
        const result = await svc.login('dr@clinic.com', 'password123');
        expect(result.sub).toBe('login-user-1');
        expect(result.email).toBe('dr@clinic.com');
        expect(result.orgId).toBe('org-login-1');
        expect(result.isEmailVerified).toBe(true);
      } finally {
        compareSpy.mockRestore();
      }
    });
  });

  // ─── register() ───────────────────────────────────────────────────────────

  describe('register() - duplicate email rejection', () => {
    it('throws UnauthorizedException when the email is already taken', async () => {
      const existingRow = {
        id: 'existing-user', email: 'taken@clinic.com',
        password_hash: '$2b$12$xxx', full_name: null, role: 'orthodontist',
        organization_id: null, is_onboarded: false, is_active: true,
        email_verified_at: null, verification_token_hash: null,
        verification_token_expires_at: null, reset_token_hash: null,
        reset_token_expires_at: null, sessions_invalidated_at: null,
      };
      const pool = { query: jest.fn().mockResolvedValue({ rows: [existingRow] }) };
      const svc = makeService(pool);
      await expect(
        svc.register('taken@clinic.com', 'password123', 'Dr Test', 'Test Clinic'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ─── forgotPassword() ─────────────────────────────────────────────────────

  describe('forgotPassword() - enumeration prevention', () => {
    it('returns undefined when the email does not exist', async () => {
      const pool = { query: jest.fn().mockResolvedValue({ rows: [] }) };
      const svc = makeService(pool);
      await expect(svc.forgotPassword('nobody@example.com')).resolves.toBeUndefined();
    });

    it('returns undefined when the account is inactive', async () => {
      const pool = {
        query: jest.fn().mockResolvedValue({
          rows: [{ id: 'u1', email: 'inactive@clinic.com', is_active: false, full_name: null, organization_id: null }],
        }),
      };
      const svc = makeService(pool);
      await expect(svc.forgotPassword('inactive@clinic.com')).resolves.toBeUndefined();
    });

    it('swallows SMTP delivery failures so callers get no enumeration signal', async () => {
      const throwingEmailService = {
        send: jest.fn().mockRejectedValue(new Error('SMTP connection refused')),
      };
      const pool = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [{ id: 'u1', email: 'real@clinic.com', is_active: true, full_name: 'Dr Real', organization_id: null }] })
          .mockResolvedValueOnce({ rows: [] }), // UPDATE reset_token_hash
      };
      process.env.JWT_SECRET = SECRET;
      const svc = new (AuthService as any)(pool, null, throwingEmailService);
      await expect(svc.forgotPassword('real@clinic.com')).resolves.toBeUndefined();
    });
  });

  // ─── sendVerificationEmail() ──────────────────────────────────────────────

  describe('sendVerificationEmail() - email delivery failure propagates', () => {
    it('rejects when emailService.send() throws (allows resend endpoint to return 500)', async () => {
      const throwingEmailService = {
        send: jest.fn().mockRejectedValue(new Error('SMTP unavailable')),
      };
      const pool = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [{ email_verified_at: null }] }) // check verified
          .mockResolvedValueOnce({ rows: [{ email: 'dr@clinic.com', full_name: 'Dr Test' }] }), // UPDATE token
      };
      process.env.JWT_SECRET = SECRET;
      const svc = new (AuthService as any)(pool, null, throwingEmailService);
      await expect(svc.sendVerificationEmail('user-id-abc')).rejects.toThrow('SMTP unavailable');
    });
  });

  // ─── verifyEmail() - single-use ───────────────────────────────────────────

  describe('verifyEmail() - single-use token enforcement', () => {
    it('rejects the same token on second use (token nullified after first verification)', async () => {
      const rawToken = crypto.randomBytes(32).toString('hex');
      let remainingUses = 1;
      const pool = {
        query: jest.fn().mockImplementation((sql: string) => {
          if (sql.includes('email_verified_at IS NULL') && sql.includes('verification_token_hash')) {
            if (remainingUses-- > 0) {
              return Promise.resolve({
                rows: [{ id: 'user-1', verification_token_expires_at: new Date(Date.now() + 60_000) }],
              });
            }
            return Promise.resolve({ rows: [] }); // second call: already cleared
          }
          return Promise.resolve({ rows: [] }); // UPDATE SET email_verified_at
        }),
      };
      const svc = makeService(pool);
      await expect(svc.verifyEmail(rawToken)).resolves.toBeUndefined();
      await expect(svc.verifyEmail(rawToken)).rejects.toThrow(BadRequestException);
    });
  });
});
