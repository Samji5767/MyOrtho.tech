import { Injectable, OnModuleInit, Logger, UnauthorizedException } from '@nestjs/common';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';

const BCRYPT_ROUNDS = 12;
const COOKIE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 h

export interface AuthUserRow {
  id: string;
  email: string;
  password_hash: string;
  full_name: string | null;
  role: string;
  organization_id: string | null;
  is_onboarded: boolean;
}

export interface SessionPayload {
  sub: string;
  email: string;
  role: string;
  name: string;
  orgId: string | null;
  isOnboarded: boolean;
}

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);
  private readonly pool: Pool;
  private readonly jwtSecret: string;

  // Simple in-memory rate limiter: max 10 login attempts per IP per minute
  private readonly loginAttempts = new Map<string, { count: number; resetAt: number }>();

  constructor() {
    this.pool = new Pool({ connectionString: process.env.DATABASE_URL });
    this.jwtSecret = process.env.JWT_SECRET || 'dev-only-change-in-production';
    if (!process.env.JWT_SECRET) {
      this.logger.warn('JWT_SECRET not set — using insecure dev default. Set JWT_SECRET in .env for production.');
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
    return jwt.sign(payload, this.jwtSecret, { expiresIn: '24h' });
  }

  verifyToken(token: string): SessionPayload {
    try {
      return jwt.verify(token, this.jwtSecret) as SessionPayload;
    } catch {
      throw new UnauthorizedException('Invalid or expired session');
    }
  }

  // ─── Rate limiting ────────────────────────────────────────────────────────

  checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const record = this.loginAttempts.get(ip);
    if (!record || record.resetAt < now) {
      this.loginAttempts.set(ip, { count: 1, resetAt: now + 60_000 });
      return true;
    }
    if (record.count >= 10) return false;
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
      // Constant-time fake compare to prevent username enumeration
      await bcrypt.compare(password, '$2b$12$invalidhashplaceholder.......');
      throw new UnauthorizedException('Invalid email or password');
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) throw new UnauthorizedException('Invalid email or password');

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

      // Ensure at least one org exists for the admin
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
    };
  }
}
