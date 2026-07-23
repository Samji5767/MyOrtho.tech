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
  // Stored as SHA-256(raw_token) — plaintext never written to DB
  verification_token_hash: string | null;
  verification_token_expires_at: Date | null;
  reset_token_hash: string | null;
  reset_token_expires_at: Date | null;
  // Set to now() on password reset; JWTs issued before this timestamp are rejected
  sessions_invalidated_at: Date | null;
}

export interface OnboardingPrefs {
  role?: string;
  displayRole?: string;
  orgName?: string;
  orgType?: string;
  numDoctors?: string;
  numClinics?: string;
  caseVolume?: string;
  primaryFlow?: string;
  cadLevel?: string;
  aiReadiness?: string;
  enableDemo?: boolean;
  primaryObjective?: string;
}

export interface SessionPayload {
  sub: string;
  email: string;
  role: string;
  name: string;
  orgId: string | null;
  /** Default workspace for the session — resolved from workspace_memberships at login time */
  workspaceId: string | null;
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

    // Re-query mutable account state every request.
    // This is the authoritative source of truth for:
    //   • is_active            — catches deactivated accounts
    //   • sessions_invalidated_at — rejects tokens issued before a password reset
    //   • email_verified_at    — overrides stale JWT claim after email verification
    //   • is_onboarded         — overrides stale JWT claim after onboarding completion
    const { rows } = await this.pool.query<{
      is_active: boolean;
      email_verified_at: Date | null;
      is_onboarded: boolean;
      sessions_invalidated_at: Date | null;
    }>(
      `SELECT is_active, email_verified_at, is_onboarded, sessions_invalidated_at
       FROM auth_users WHERE id = $1 LIMIT 1`,
      [decoded.sub],
    );
    const dbRow = rows[0];
    if (!dbRow || dbRow.is_active === false) {
      throw new UnauthorizedException('Account is disabled');
    }

    // Reject tokens issued before the last password reset
    if (dbRow.sessions_invalidated_at) {
      const iat = (decoded as any).iat as number | undefined;
      if (iat && iat * 1000 < new Date(dbRow.sessions_invalidated_at).getTime()) {
        throw new UnauthorizedException('Session has been revoked');
      }
    }

    // Override stale JWT claims with authoritative DB values
    decoded.isEmailVerified = dbRow.email_verified_at !== null;
    decoded.isOnboarded = dbRow.is_onboarded;

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
    return await this.toPayload(user);
  }

  // ─── Self-service registration ────────────────────────────────────────────

  async register(email: string, password: string, fullName: string, clinicName: string): Promise<SessionPayload> {
    const normalizedEmail = email.toLowerCase().trim();
    const existing = await this.findByEmail(normalizedEmail);
    if (existing) {
      throw new UnauthorizedException('An account with this email already exists');
    }

    // Wrap org + user + membership + workspace creation in one transaction
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

      if (orgId) {
        // Owner membership
        await client.query(
          `INSERT INTO organization_memberships (user_id, organization_id, role, is_owner)
           VALUES ($1, $2, 'orthodontist', true)
           ON CONFLICT (user_id, organization_id) DO NOTHING`,
          [userId, orgId],
        );

        // Default workspace
        const wsResult = await client.query<{ id: string }>(
          `INSERT INTO workspaces (organization_id, name, type, is_default, created_by)
           VALUES ($1, $2, 'default', true, $3)
           ON CONFLICT DO NOTHING RETURNING id`,
          [orgId, `${clinicName.trim()} Workspace`, userId],
        );
        const wsId = wsResult.rows[0]?.id;

        // Workspace membership
        if (wsId) {
          await client.query(
            `INSERT INTO workspace_memberships (user_id, workspace_id, role)
             VALUES ($1, $2, 'orthodontist')
             ON CONFLICT (user_id, workspace_id) DO NOTHING`,
            [userId, wsId],
          );
        }
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const user = await this.pool.query<AuthUserRow>('SELECT * FROM auth_users WHERE id = $1', [userId]);
    // Fire-and-forget verification email — registration succeeds even if SMTP is unconfigured
    this.sendVerificationEmail(userId).catch((err) =>
      this.logger.warn(`Could not send verification email to ${normalizedEmail}: ${err}`),
    );
    return this.toPayload(user.rows[0]);
  }

  // ─── Email verification ────────────────────────────────────────────────────

  async sendVerificationEmail(userId: string): Promise<void> {
    // Do not issue a new token if the account is already verified
    const checkResult = await this.pool.query<{ email_verified_at: Date | null }>(
      'SELECT email_verified_at FROM auth_users WHERE id = $1 LIMIT 1',
      [userId],
    );
    if (checkResult.rows[0]?.email_verified_at) {
      return; // Already verified — nothing to do
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_TTL_HOURS * 60 * 60 * 1000);

    const { rows } = await this.pool.query<{ email: string; full_name: string | null }>(
      `UPDATE auth_users
       SET verification_token_hash = $1, verification_token_expires_at = $2, updated_at = now()
       WHERE id = $3 AND email_verified_at IS NULL
       RETURNING email, full_name`,
      [tokenHash, expiresAt, userId],
    );
    if (!rows[0]) throw new BadRequestException('User not found or already verified');

    const { email, full_name } = rows[0];
    const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
    // Raw token goes into the email link only — never stored
    const link = `${appUrl}/verify-email?token=${rawToken}`;
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

    this.logger.log(`Verification email queued for ${email} (expires ${expiresAt.toISOString()})`);
  }

  async verifyEmail(rawToken: string): Promise<void> {
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const { rows } = await this.pool.query<{
      id: string;
      verification_token_expires_at: Date;
    }>(
      `SELECT id, verification_token_expires_at
       FROM auth_users
       WHERE verification_token_hash = $1 AND email_verified_at IS NULL
       LIMIT 1`,
      [tokenHash],
    );
    const row = rows[0];
    if (!row) throw new BadRequestException('Invalid or already-used verification link');
    if (new Date(row.verification_token_expires_at) < new Date()) {
      throw new BadRequestException('Verification link has expired. Please request a new one.');
    }

    await this.pool.query(
      `UPDATE auth_users
       SET email_verified_at = now(),
           verification_token_hash = NULL,
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

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);

    await this.pool.query(
      `UPDATE auth_users
       SET reset_token_hash = $1, reset_token_expires_at = $2, updated_at = now()
       WHERE id = $3`,
      [tokenHash, expiresAt, user.id],
    );

    const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
    const link = `${appUrl}/reset-password?token=${rawToken}`;
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

  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    if (newPassword.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }

    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
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
    // sessions_invalidated_at causes all JWTs issued before this moment to be rejected
    await this.pool.query(
      `UPDATE auth_users
       SET password_hash = $1,
           reset_token_hash = NULL,
           reset_token_expires_at = NULL,
           sessions_invalidated_at = now(),
           updated_at = now()
       WHERE id = $2`,
      [hash, row.id],
    );
  }

  // ─── Mark onboarded ───────────────────────────────────────────────────────

  async markOnboarded(userId: string, prefs?: OnboardingPrefs): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Update user role if the onboarding step selected a different one
      if (prefs?.role) {
        await client.query(
          'UPDATE auth_users SET role = $1, is_onboarded = true, updated_at = now() WHERE id = $2',
          [prefs.role, userId],
        );
      } else {
        await client.query(
          'UPDATE auth_users SET is_onboarded = true, updated_at = now() WHERE id = $1',
          [userId],
        );
      }

      // Update organization name/type from onboarding if provided
      if (prefs?.orgName || prefs?.orgType) {
        await client.query(
          `UPDATE organizations SET
             name       = COALESCE(NULLIF($1, ''), name),
             type       = COALESCE(NULLIF($2, ''), type),
             updated_at = now()
           WHERE id = (SELECT organization_id FROM auth_users WHERE id = $3)`,
          [prefs.orgName ?? '', prefs.orgType ?? '', userId],
        );
      }

      // Upsert onboarding profile preferences
      await client.query(
        `INSERT INTO user_onboarding_profiles
           (user_id, display_role, org_type, org_name, num_doctors, num_clinics,
            case_volume, primary_flow, cad_level, ai_readiness, enable_demo,
            primary_objective, completed_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now(),now())
         ON CONFLICT (user_id) DO UPDATE SET
           display_role      = EXCLUDED.display_role,
           org_type          = EXCLUDED.org_type,
           org_name          = EXCLUDED.org_name,
           num_doctors       = EXCLUDED.num_doctors,
           num_clinics       = EXCLUDED.num_clinics,
           case_volume       = EXCLUDED.case_volume,
           primary_flow      = EXCLUDED.primary_flow,
           cad_level         = EXCLUDED.cad_level,
           ai_readiness      = EXCLUDED.ai_readiness,
           enable_demo       = EXCLUDED.enable_demo,
           primary_objective = EXCLUDED.primary_objective,
           completed_at      = EXCLUDED.completed_at,
           updated_at        = now()`,
        [
          userId,
          prefs?.displayRole ?? null,
          prefs?.orgType ?? null,
          prefs?.orgName ?? null,
          prefs?.numDoctors ?? null,
          prefs?.numClinics ?? null,
          prefs?.caseVolume ?? null,
          prefs?.primaryFlow ?? null,
          prefs?.cadLevel ?? null,
          prefs?.aiReadiness ?? null,
          prefs?.enableDemo ?? false,
          prefs?.primaryObjective ?? null,
        ],
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async getOnboardingProfile(userId: string): Promise<OnboardingPrefs | null> {
    const { rows } = await this.pool.query<OnboardingPrefs & { completed_at: Date | null }>(
      `SELECT display_role, org_type, org_name, num_doctors, num_clinics,
              case_volume, primary_flow, cad_level, ai_readiness, enable_demo,
              primary_objective, completed_at
       FROM user_onboarding_profiles WHERE user_id = $1 LIMIT 1`,
      [userId],
    );
    return rows[0] ?? null;
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
          verification_token_hash         text        DEFAULT NULL,
          verification_token_expires_at   timestamptz DEFAULT NULL,
          reset_token_hash                text        DEFAULT NULL,
          reset_token_expires_at          timestamptz DEFAULT NULL,
          sessions_invalidated_at         timestamptz DEFAULT NULL,
          created_at                      timestamptz DEFAULT now(),
          updated_at                      timestamptz DEFAULT now(),
          last_login_at                   timestamptz
        );
        CREATE INDEX IF NOT EXISTS idx_auth_users_email ON auth_users(email);
        CREATE INDEX IF NOT EXISTS idx_auth_users_verification_token_hash
          ON auth_users (verification_token_hash) WHERE verification_token_hash IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_auth_users_reset_token_hash
          ON auth_users (reset_token_hash) WHERE reset_token_hash IS NOT NULL;
      `);
      // Idempotently add/rename columns when the table already exists (migration path)
      await this.pool.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='auth_users' AND column_name='email_verified_at')
            THEN ALTER TABLE auth_users ADD COLUMN email_verified_at timestamptz DEFAULT NULL; END IF;
          -- Handle rename: verification_token → verification_token_hash
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='auth_users' AND column_name='verification_token')
            AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='auth_users' AND column_name='verification_token_hash')
            THEN ALTER TABLE auth_users RENAME COLUMN verification_token TO verification_token_hash; END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='auth_users' AND column_name='verification_token_hash')
            THEN ALTER TABLE auth_users ADD COLUMN verification_token_hash text DEFAULT NULL; END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='auth_users' AND column_name='verification_token_expires_at')
            THEN ALTER TABLE auth_users ADD COLUMN verification_token_expires_at timestamptz DEFAULT NULL; END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='auth_users' AND column_name='reset_token_hash')
            THEN ALTER TABLE auth_users ADD COLUMN reset_token_hash text DEFAULT NULL; END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='auth_users' AND column_name='reset_token_expires_at')
            THEN ALTER TABLE auth_users ADD COLUMN reset_token_expires_at timestamptz DEFAULT NULL; END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='auth_users' AND column_name='sessions_invalidated_at')
            THEN ALTER TABLE auth_users ADD COLUMN sessions_invalidated_at timestamptz DEFAULT NULL; END IF;
        END
        $$;
      `);
      // Ensure membership + workspace tables exist (migration 070)
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS organization_memberships (
          id                uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id           uuid        NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
          organization_id   uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
          role              text        NOT NULL DEFAULT 'member',
          is_owner          boolean     NOT NULL DEFAULT false,
          invited_by        uuid        REFERENCES auth_users(id) ON DELETE SET NULL,
          created_at        timestamptz DEFAULT now(),
          updated_at        timestamptz DEFAULT now(),
          CONSTRAINT uq_org_membership UNIQUE (user_id, organization_id)
        );
        CREATE INDEX IF NOT EXISTS idx_org_memberships_user ON organization_memberships(user_id);
        CREATE INDEX IF NOT EXISTS idx_org_memberships_org  ON organization_memberships(organization_id);

        CREATE TABLE IF NOT EXISTS workspaces (
          id                uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
          organization_id   uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
          name              text        NOT NULL,
          type              text        NOT NULL DEFAULT 'default'
                                        CHECK (type IN ('default','clinical','lab','research')),
          is_default        boolean     NOT NULL DEFAULT false,
          settings          jsonb       DEFAULT '{}'::jsonb,
          created_by        uuid        REFERENCES auth_users(id) ON DELETE SET NULL,
          created_at        timestamptz DEFAULT now(),
          updated_at        timestamptz DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS idx_workspaces_org ON workspaces(organization_id);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_workspaces_default
          ON workspaces(organization_id) WHERE is_default = true;

        CREATE TABLE IF NOT EXISTS workspace_memberships (
          id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id         uuid        NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
          workspace_id    uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          role            text        NOT NULL DEFAULT 'member',
          created_at      timestamptz DEFAULT now(),
          CONSTRAINT uq_workspace_membership UNIQUE (user_id, workspace_id)
        );
        CREATE INDEX IF NOT EXISTS idx_workspace_memberships_user
          ON workspace_memberships(user_id);
        CREATE INDEX IF NOT EXISTS idx_workspace_memberships_workspace
          ON workspace_memberships(workspace_id);

        CREATE TABLE IF NOT EXISTS user_onboarding_profiles (
          id                uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id           uuid        NOT NULL UNIQUE REFERENCES auth_users(id) ON DELETE CASCADE,
          display_role      text,
          org_type          text,
          org_name          text,
          num_doctors       text,
          num_clinics       text,
          case_volume       text,
          primary_flow      text,
          cad_level         text,
          ai_readiness      text,
          enable_demo       boolean     DEFAULT false,
          primary_objective text,
          extra             jsonb       DEFAULT '{}'::jsonb,
          completed_at      timestamptz,
          created_at        timestamptz DEFAULT now(),
          updated_at        timestamptz DEFAULT now()
        );
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

  private async toPayload(user: AuthUserRow): Promise<SessionPayload> {
    // Resolve authoritative org from organization_memberships (Phase 4 model).
    // Falls back to auth_users.organization_id for users pre-dating the membership table.
    const memberResult = await this.pool.query<{ organization_id: string }>(
      `SELECT organization_id FROM organization_memberships
       WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1`,
      [user.id],
    );
    const resolvedOrgId = memberResult.rows[0]?.organization_id ?? user.organization_id ?? null;

    // Resolve default workspace from workspace_memberships
    let workspaceId: string | null = null;
    if (resolvedOrgId) {
      const wsResult = await this.pool.query<{ id: string }>(
        `SELECT wm.workspace_id AS id
         FROM workspace_memberships wm
         JOIN workspaces w ON w.id = wm.workspace_id
         WHERE wm.user_id = $1 AND w.organization_id = $2 AND w.is_default = true
         LIMIT 1`,
        [user.id, resolvedOrgId],
      );
      workspaceId = wsResult.rows[0]?.id ?? null;
    }

    return {
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.full_name ?? user.email.split('@')[0],
      orgId: resolvedOrgId,
      workspaceId,
      isOnboarded: user.is_onboarded,
      isEmailVerified: user.email_verified_at !== null,
      jti: crypto.randomUUID(),
    };
  }
}
