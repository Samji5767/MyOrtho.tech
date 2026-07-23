import { Injectable, OnModuleInit, Logger, UnauthorizedException, BadRequestException, Optional, Inject } from '@nestjs/common';
import type { Pool } from 'pg';
import Redis from 'ioredis';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { REDIS_CLIENT } from '../redis/redis.module';
import { PG_POOL } from '../database/database.module';
import { EmailService } from '../notifications/email.service';

const BCRYPT_ROUNDS = 12;
const COOKIE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 h
const JWT_ALGORITHM: jwt.Algorithm = 'HS256';

const VERIFICATION_TOKEN_TTL_HOURS = 24;
const RESET_TOKEN_TTL_MINUTES = 15;

export interface AuthUserRow {
  id: string;
  email: string;
  password_hash: string;
  full_name: string | null;
  role: string;
  organization_id: string | null;
  is_onboarded: boolean;
  is_active: boolean;
  email_verified_at: Date | null;
  verification_token: string | null;
  verification_token_expires_at: Date | null;
  reset_token_hash: string | null;
  reset_token_expires_at: Date | null;
}

export interface SessionPayload {
  sub: string;
  email: string;
  role: string;
  name: string;
  orgId: string | null;
  isOnboarded: boolean;
  isEmailVerified: boolean;
  /** JWT ID — unique per token; used for revocation via Redis blacklist */
  jti: string;
}

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);
  private readonly jwtSecret: string;

  // In-memory rate limiter fallback (used when Redis is unavailable)
  private readonly loginAttemptsFallback = new Map<string, { count: number; resetAt: number }>();
  // In-memory token blacklist fallback (used when Redis is unavailable)
  private readonly tokenBlacklistFallback = new Set<string>();

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    @Optional() @Inject(REDIS_CLIENT) private readonly redis: Redis | null,
    @Optional() private readonly emailService: EmailService | null,
  ) {
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

    // Verify account is still active — catches deactivated accounts even within a valid token window
    const { rows } = await this.pool.query<{ is_active: boolean }>(
      'SELECT is_active FROM auth_users WHERE id = $1 LIMIT 1',
      [decoded.sub],
    );
    if (!rows[0] || rows[0].is_active === false) {
      throw new UnauthorizedException('Account is disabled');
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
    // Fire-and-forget verification email — registration still succeeds even if SMTP is unconfigured
    this.sendVerificationEmail(userId).catch((err) =>
      this.logger.warn(`Could not send verification email to ${normalizedEmail}: ${err}`),
    );
    return this.toPayload(user.rows[0]);
  }

  // ─── Email verification ────────────────────────────────────────────────────

  async sendVerificationEmail(userId: string): Promise<void> {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_TTL_HOURS * 60 * 60 * 1000);

    const { rows } = await this.pool.query<{ email: string; full_name: string | null }>(
      `UPDATE auth_users
       SET verification_token = $1, verification_token_expires_at = $2, updated_at = now()
       WHERE id = $3
       RETURNING email, full_name`,
      [token, expiresAt, userId],
    );
    if (!rows[0]) throw new BadRequestException('User not found');

    const { email, full_name } = rows[0];
    const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
    const link = `${appUrl}/verify-email?token=${token}`;
    const name = full_name ?? email.split('@')[0];

    await this.emailService?.send({
      to: email,
      subject: 'Verify your MyOrtho.tech email address',
      html: `
        <p>Hi ${name},</p>
        <p>Welcome to MyOrtho.tech. Please verify your email address by clicking the link below:</p>
        <p><a href="${link}">Verify Email Address</a></p>
        <p>This link expires in ${VERIFICATION_TOKEN_TTL_HOURS} hours.</p>
        <p>If you did not create an account, you can safely ignore this email.</p>
      `,
      text: `Verify your email: ${link}\n\nThis link expires in ${VERIFICATION_TOKEN_TTL_HOURS} hours.`,
    });

    this.logger.log(`Verification email queued for ${email} (token expires ${expiresAt.toISOString()})`);
  }

  async verifyEmail(token: string): Promise<void> {
    const { rows } = await this.pool.query<{ id: string; verification_token_expires_at: Date }>(
      `SELECT id, verification_token_expires_at
       FROM auth_users
       WHERE verification_token = $1 AND email_verified_at IS NULL
       LIMIT 1`,
      [token],
    );
    const row = rows[0];
    if (!row) throw new BadRequestException('Invalid or already-used verification link');
    if (new Date(row.verification_token_expires_at) < new Date()) {
      throw new BadRequestException('Verification link has expired. Please request a new one.');
    }

    await this.pool.query(
      `UPDATE auth_users
       SET email_verified_at = now(),
           verification_token = NULL,
           verification_token_expires_at = NULL,
           updated_at = now()
       WHERE id = $1`,
      [row.id],
    );
  }

  // ─── Password reset ────────────────────────────────────────────────────────

  async forgotPassword(email: string): Promise<void> {
    const user = await this.findByEmail(email);
    // Always respond the same way regardless of whether the email exists (prevents enumeration)
    if (!user || !user.is_active) return;

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);

    await this.pool.query(
      `UPDATE auth_users
       SET reset_token_hash = $1, reset_token_expires_at = $2, updated_at = now()
       WHERE id = $3`,
      [tokenHash, expiresAt, user.id],
    );

    const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
    const link = `${appUrl}/reset-password?token=${token}`;
    const name = user.full_name ?? user.email.split('@')[0];

    await this.emailService?.send({
      to: user.email,
      subject: 'Reset your MyOrtho.tech password',
      html: `
        <p>Hi ${name},</p>
        <p>We received a request to reset your MyOrtho.tech password.</p>
        <p><a href="${link}">Reset Password</a></p>
        <p>This link expires in ${RESET_TOKEN_TTL_MINUTES} minutes and can only be used once.</p>
        <p>If you did not request a password reset, please ignore this email — your password will not change.</p>
      `,
      text: `Reset your password: ${link}\n\nThis link expires in ${RESET_TOKEN_TTL_MINUTES} minutes.`,
    });
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    if (newPassword.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const { rows } = await this.pool.query<{ id: string; reset_token_expires_at: Date }>(
      `SELECT id, reset_token_expires_at
       FROM auth_users
       WHERE reset_token_hash = $1
       LIMIT 1`,
      [tokenHash],
    );
    const row = rows[0];
    if (!row) throw new BadRequestException('Invalid or already-used reset link');
    if (new Date(row.reset_token_expires_at) < new Date()) {
      throw new BadRequestException('Reset link has expired. Please request a new one.');
    }

    const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.pool.query(
      `UPDATE auth_users
       SET password_hash = $1,
           reset_token_hash = NULL,
           reset_token_expires_at = NULL,
           updated_at = now()
       WHERE id = $2`,
      [hash, row.id],
    );
  }

  // ─── Mark onboarded ───────────────────────────────────────────────────────

  async markOnboarded(userId: string): Promise<void> {
    await this.pool.query(
      'UPDATE auth_users SET is_onboarded = true, updated_at = now() WHERE id = $1',
      [userId],
    );
  }

  // ─── Update profile ────────────────────────────────────────────────────────

  async updateProfile(userId: string, name: string): Promise<void> {
    await this.pool.query(
      'UPDATE auth_users SET full_name = $1, updated_at = now() WHERE id = $2',
      [name.trim(), userId],
    );
  }

  // ─── Bootstrap admin ──────────────────────────────────────────────────────

  private async ensureSchema(): Promise<void> {
    try {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS auth_users (
          id                              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
          email                           text        UNIQUE NOT NULL,
          password_hash                   text        NOT NULL,
          full_name                       text,
          role                            text        NOT NULL DEFAULT 'orthodontist',
          organization_id                 uuid        REFERENCES organizations(id) ON DELETE SET NULL,
          is_onboarded                    boolean     NOT NULL DEFAULT false,
          is_active                       boolean     NOT NULL DEFAULT true,
          email_verified_at               timestamptz DEFAULT NULL,
          verification_token              text        DEFAULT NULL,
          verification_token_expires_at   timestamptz DEFAULT NULL,
          reset_token_hash                text        DEFAULT NULL,
          reset_token_expires_at          timestamptz DEFAULT NULL,
          created_at                      timestamptz DEFAULT now(),
          updated_at                      timestamptz DEFAULT now(),
          last_login_at                   timestamptz
        );
        CREATE INDEX IF NOT EXISTS idx_auth_users_email ON auth_users(email);
        CREATE INDEX IF NOT EXISTS idx_auth_users_verification_token
          ON auth_users (verification_token) WHERE verification_token IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_auth_users_reset_token_hash
          ON auth_users (reset_token_hash) WHERE reset_token_hash IS NOT NULL;
      `);
      // Idempotently add new columns when table already exists (migration path)
      await this.pool.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='auth_users' AND column_name='email_verified_at')
            THEN ALTER TABLE auth_users ADD COLUMN email_verified_at timestamptz DEFAULT NULL; END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='auth_users' AND column_name='verification_token')
            THEN ALTER TABLE auth_users ADD COLUMN verification_token text DEFAULT NULL; END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='auth_users' AND column_name='verification_token_expires_at')
            THEN ALTER TABLE auth_users ADD COLUMN verification_token_expires_at timestamptz DEFAULT NULL; END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='auth_users' AND column_name='reset_token_hash')
            THEN ALTER TABLE auth_users ADD COLUMN reset_token_hash text DEFAULT NULL; END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='auth_users' AND column_name='reset_token_expires_at')
            THEN ALTER TABLE auth_users ADD COLUMN reset_token_expires_at timestamptz DEFAULT NULL; END IF;
        END
        $$;
      `);
    } catch (err) {
      this.logger.warn('Schema ensure skipped (may already exist):', String(err));
    }
  }

  private async bootstrapAdmin(): Promise<void> {
    const email = (process.env.MYORTHO_ADMIN_EMAIL ?? '').toLowerCase().trim();
    const password = process.env.MYORTHO_ADMIN_PASSWORD ?? '';
    const fullName = process.env.MYORTHO_ADMIN_NAME ?? 'Platform Admin';

    if (!email || !password || password.length < 12) {
      this.logger.error(
        'Bootstrap: MYORTHO_ADMIN_EMAIL must be set and MYORTHO_ADMIN_PASSWORD must be at least 12 characters. ' +
        'Admin account will not be created. Set both env vars and restart.',
      );
      return;
    }

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
           (email, password_hash, full_name, role, organization_id, is_onboarded, email_verified_at)
         VALUES ($1, $2, $3, 'super_admin', $4, true, now())`,
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
      isEmailVerified: user.email_verified_at !== null,
      jti: crypto.randomUUID(),
    };
  }
}
