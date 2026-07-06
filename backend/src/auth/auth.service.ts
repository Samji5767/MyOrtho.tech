import { Injectable, OnModuleInit, Logger, UnauthorizedException, Optional, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import Redis from 'ioredis';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { REDIS_CLIENT } from '../redis/redis.module';

const BCRYPT_ROUNDS = 12;
const COOKIE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 h
const JWT_ALGORITHM: jwt.Algorithm = 'HS256';

export interface AuthUserRow {
  id: string;
  email: string;
  password_hash: string;
  full_name: string | null;
  role: string;
  organization_id: string | null;
  is_onboarded: boolean;
  is_active: boolean;
}

export interface SessionPayload {
  sub: string;
  email: string;
  role: string;
  name: string;
  orgId: string | null;
  isOnboarded: boolean;
  /** JWT ID — unique per token; used for revocation via Redis blacklist */
  jti: string;
}

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);
  private readonly pool: Pool;
  private readonly jwtSecret: string;

  // In-memory rate limiter fallback (used when Redis is unavailable)
  private readonly loginAttemptsFallback = new Map<string, { count: number; resetAt: number }>();
  // In-memory token blacklist fallback (used when Redis is unavailable)
  private readonly tokenBlacklistFallback = new Set<string>();

  constructor(@Optional() @Inject(REDIS_CLIENT) private readonly redis: Redis | null) {
    this.pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('JWT_SECRET must be set to at least 32 characters in production.');
      }
      this.logger.warn('JWT_SECRET not set or too short — using insecure dev default. NEVER deploy without setting JWT_SECRET.');
      this.jwtSecret = 'dev-only-change-in-production';
    } else {
      this.jwtSecret = secret;
    }
  }

  async onModuleInit(): Promise<void> {
    await this.ensureSchema();
    await this.bootstrapAdmin();
  }

  get cookieMaxAgeMs(): number {
    return COOKIE_MAX_AGE_MS;
  }

  // ─── Token ────────────────────────────────────────────────────────────────

  signToken(payload: SessionPayload): string {
    const jti = payload.jti ?? crypto.randomUUID();
    return jwt.sign(
      { ...payload, jti },
      this.jwtSecret,
      { expiresIn: '24h', algorithm: JWT_ALGORITHM },
    );
  }

  async verifyToken(token: string): Promise<SessionPayload> {
    let decoded: SessionPayload;
    try {
      decoded = jwt.verify(token, this.jwtSecret, { algorithms: [JWT_ALGORITHM] }) as SessionPayload;
    } catch {
      throw new UnauthorizedException('Invalid or expired session');
    }

    // Check JWT blacklist — tokens are added on logout
    if (decoded.jti) {
      const blacklisted = await this.isTokenBlacklisted(decoded.jti);
      if (blacklisted) {
        throw new UnauthorizedException('Session has been revoked');
      }
    }

    return decoded;
  }

  /** Revoke a token by adding its jti to the Redis blacklist (or in-memory fallback). */
  async revokeToken(jti: string, expiresAt: number): Promise<void> {
    const ttlSeconds = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
    const key = `jti_blacklist:${jti}`;

    if (this.redis) {
      try {
        if (ttlSeconds > 0) {
          await this.redis.setex(key, ttlSeconds, '1');
        }
        return;
      } catch {
        // Fall through to in-memory
      }
    }
    this.tokenBlacklistFallback.add(jti);
  }

  private async isTokenBlacklisted(jti: string): Promise<boolean> {
    if (this.redis) {
      try {
        const val = await this.redis.get(`jti_blacklist:${jti}`);
        return val !== null;
      } catch {
        // Fall through to in-memory
      }
    }
    return this.tokenBlacklistFallback.has(jti);
  }

  // ─── Rate limiting ────────────────────────────────────────────────────────

  async checkRateLimit(ip: string): Promise<boolean> {
    const key = `login_ratelimit:${ip}`;
    const limit = 10;

    if (this.redis) {
      try {
        const count = await this.redis.incr(key);
        if (count === 1) {
          await this.redis.expire(key, 60);
        }
        return count <= limit;
      } catch {
        // Redis unavailable — fall through to in-memory
      }
    }

    const now = Date.now();
    const record = this.loginAttemptsFallback.get(ip);
    if (!record || record.resetAt < now) {
      this.loginAttemptsFallback.set(ip, { count: 1, resetAt: now + 60_000 });
      return true;
    }
    if (record.count >= limit) return false;
    record.count++;
    return true;
  }

  // ─── Database helpers ─────────────────────────────────────────────────────

  private async findByEmail(email: string): Promise<AuthUserRow | null> {
    const { rows } = await this.pool.query<AuthUserRow>(
      'SELECT * FROM auth_users WHERE email = $1 LIMIT 1',
      [email.toLowerCase().trim()],
    );
    return rows[0] ?? null;
  }

  // ─── Login ────────────────────────────────────────────────────────────────

  async login(email: string, password: string): Promise<SessionPayload> {
    const user = await this.findByEmail(email);

    if (!user) {
      await bcrypt.compare(password, '$2b$12$AAAAAAAAAAAAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
      throw new UnauthorizedException('Invalid email or password');
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) throw new UnauthorizedException('Invalid email or password');

    if (user.is_active === false) {
      throw new UnauthorizedException('Account is disabled');
    }

    await this.pool.query(
      'UPDATE auth_users SET last_login_at = now(), updated_at = now() WHERE id = $1',
      [user.id],
    );

    return this.toPayload(user);
  }

  // ─── Session user (by ID) ─────────────────────────────────────────────────

  async getUserById(id: string): Promise<SessionPayload | null> {
    const { rows } = await this.pool.query<AuthUserRow>(
      'SELECT * FROM auth_users WHERE id = $1 LIMIT 1',
      [id],
    );
    const user = rows[0];
    if (!user) return null;
    return this.toPayload(user);
  }

  // ─── Self-service registration ────────────────────────────────────────────

  async register(email: string, password: string, fullName: string, clinicName: string): Promise<SessionPayload> {
    const normalizedEmail = email.toLowerCase().trim();
    const existing = await this.findByEmail(normalizedEmail);
    if (existing) {
      throw new UnauthorizedException('An account with this email already exists');
    }

    // Wrap org + user creation in a single transaction so neither is orphaned on failure
    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const client = await this.pool.connect();
    let userId: string;
    let orgId: string | null;
    try {
      await client.query('BEGIN');
      const orgResult = await client.query<{ id: string }>(
        `INSERT INTO organizations (name, type, settings)
         VALUES ($1, 'clinic', '{}') RETURNING id`,
        [clinicName.trim()],
      );
      orgId = orgResult.rows[0]?.id ?? null;

      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO auth_users (email, password_hash, full_name, role, organization_id, is_onboarded)
         VALUES ($1, $2, $3, 'orthodontist', $4, false) RETURNING id`,
        [normalizedEmail, hash, fullName.trim(), orgId],
      );
      userId = rows[0].id;
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const user = await this.pool.query<AuthUserRow>('SELECT * FROM auth_users WHERE id = $1', [userId]);
    return this.toPayload(user.rows[0]);
  }

  // ─── Mark onboarded ───────────────────────────────────────────────────────

  async markOnboarded(userId: string): Promise<void> {
    await this.pool.query(
      'UPDATE auth_users SET is_onboarded = true, updated_at = now() WHERE id = $1',
      [userId],
    );
  }

  // ─── Bootstrap admin ──────────────────────────────────────────────────────

  private async ensureSchema(): Promise<void> {
    try {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS auth_users (
          id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
          email           text        UNIQUE NOT NULL,
          password_hash   text        NOT NULL,
          full_name       text,
          role            text        NOT NULL DEFAULT 'orthodontist',
          organization_id uuid        REFERENCES organizations(id) ON DELETE SET NULL,
          is_onboarded    boolean     NOT NULL DEFAULT false,
          created_at      timestamptz DEFAULT now(),
          updated_at      timestamptz DEFAULT now(),
          last_login_at   timestamptz
        );
        CREATE INDEX IF NOT EXISTS idx_auth_users_email ON auth_users(email);
      `);
    } catch (err) {
      this.logger.warn('Schema ensure skipped (may already exist):', String(err));
    }
  }

  private async bootstrapAdmin(): Promise<void> {
    const email = (process.env.MYORTHO_ADMIN_EMAIL ?? 'admin@myortho.tech').toLowerCase().trim();
    const password = process.env.MYORTHO_ADMIN_PASSWORD ?? 'adminadmin';
    const fullName = process.env.MYORTHO_ADMIN_NAME ?? 'Platform Admin';

    try {
      const existing = await this.findByEmail(email);
      if (existing) {
        this.logger.log(`Bootstrap: admin already exists — ${email}`);
        return;
      }

      let orgId: string | null = null;
      const orgResult = await this.pool.query<{ id: string }>(
        `SELECT id FROM organizations LIMIT 1`,
      );
      if (orgResult.rows[0]) {
        orgId = orgResult.rows[0].id;
      } else {
        const created = await this.pool.query<{ id: string }>(
          `INSERT INTO organizations (name, type, settings)
           VALUES ('MyOrtho', 'enterprise', '{}') RETURNING id`,
        );
        orgId = created.rows[0]?.id ?? null;
      }

      const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      await this.pool.query(
        `INSERT INTO auth_users
           (email, password_hash, full_name, role, organization_id, is_onboarded)
         VALUES ($1, $2, $3, 'super_admin', $4, true)`,
        [email, hash, fullName, orgId],
      );
      this.logger.log(`Bootstrap: admin created — ${email} (role: super_admin)`);
    } catch (err) {
      this.logger.error('Admin bootstrap error (non-fatal — will retry on next start):', err);
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private toPayload(user: AuthUserRow): SessionPayload {
    return {
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.full_name ?? user.email.split('@')[0],
      orgId: user.organization_id,
      isOnboarded: user.is_onboarded,
      jti: crypto.randomUUID(),
    };
  }
}
