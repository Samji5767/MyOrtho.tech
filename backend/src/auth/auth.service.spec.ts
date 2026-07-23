import { UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { AuthService, SessionPayload } from './auth.service';

const SECRET = 'testsecret-32-chars-min-for-tests!!';

function makeService(poolOverride?: object): AuthService {
  process.env.JWT_SECRET = SECRET;
  // Default mock pool: user is active; individual tests can override.
  const mockPool = poolOverride ?? {
    query: jest.fn().mockResolvedValue({ rows: [{ is_active: true }] }),
  };
  // AuthService constructor: (pool, redis). Pass null for redis — no Redis in unit tests.
  return new (AuthService as any)(mockPool, null);
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
        query: jest.fn().mockResolvedValue({ rows: [{ is_active: false }] }),
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
});
