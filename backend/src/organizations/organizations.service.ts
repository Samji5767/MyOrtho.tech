import { Injectable, NotFoundException, ForbiddenException, Inject } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface OrganizationSummary {
  id: string;
  name: string;
  type: string;
  isOwner: boolean;
  role: string;
  createdAt: Date;
}

export interface OrganizationDetail extends OrganizationSummary {
  settings: Record<string, unknown>;
  memberCount: number;
  workspaceCount: number;
}

export interface OrganizationMember {
  userId: string;
  name: string | null;
  email: string;
  role: string;
  isOwner: boolean;
  joinedAt: Date;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  type: string;
  isDefault: boolean;
  createdAt: Date;
}

@Injectable()
export class OrganizationsService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /** Verify the calling user is a member of the given org. Throws ForbiddenException if not. */
  private async assertMember(userId: string, orgId: string): Promise<{ role: string; isOwner: boolean }> {
    const { rows } = await this.pool.query<{ role: string; is_owner: boolean }>(
      `SELECT role, is_owner FROM organization_memberships
       WHERE user_id = $1 AND organization_id = $2 LIMIT 1`,
      [userId, orgId],
    );
    if (!rows[0]) throw new ForbiddenException('You are not a member of this organization');
    return { role: rows[0].role, isOwner: rows[0].is_owner };
  }

  async listMyOrganizations(userId: string): Promise<OrganizationSummary[]> {
    const { rows } = await this.pool.query<{
      id: string; name: string; type: string;
      is_owner: boolean; role: string; created_at: Date;
    }>(
      `SELECT o.id, o.name, o.type, om.is_owner, om.role, o.created_at
       FROM organization_memberships om
       JOIN organizations o ON o.id = om.organization_id
       WHERE om.user_id = $1
       ORDER BY om.is_owner DESC, o.name ASC`,
      [userId],
    );
    return rows.map(r => ({
      id: r.id,
      name: r.name,
      type: r.type,
      isOwner: r.is_owner,
      role: r.role,
      createdAt: r.created_at,
    }));
  }

  async getOrganization(userId: string, orgId: string): Promise<OrganizationDetail> {
    const membership = await this.assertMember(userId, orgId);

    const { rows } = await this.pool.query<{
      id: string; name: string; type: string; settings: Record<string, unknown>;
      created_at: Date; member_count: string; workspace_count: string;
    }>(
      `SELECT
         o.id, o.name, o.type, o.settings, o.created_at,
         (SELECT count(*)::text FROM organization_memberships WHERE organization_id = o.id) AS member_count,
         (SELECT count(*)::text FROM workspaces WHERE organization_id = o.id) AS workspace_count
       FROM organizations o WHERE o.id = $1`,
      [orgId],
    );
    const row = rows[0];
    if (!row) throw new NotFoundException('Organization not found');

    return {
      id: row.id,
      name: row.name,
      type: row.type,
      settings: row.settings ?? {},
      isOwner: membership.isOwner,
      role: membership.role,
      createdAt: row.created_at,
      memberCount: parseInt(row.member_count, 10),
      workspaceCount: parseInt(row.workspace_count, 10),
    };
  }

  async getMembers(userId: string, orgId: string): Promise<OrganizationMember[]> {
    await this.assertMember(userId, orgId);

    const { rows } = await this.pool.query<{
      user_id: string; full_name: string | null; email: string;
      role: string; is_owner: boolean; created_at: Date;
    }>(
      `SELECT om.user_id, au.full_name, au.email, om.role, om.is_owner, om.created_at
       FROM organization_memberships om
       JOIN auth_users au ON au.id = om.user_id
       WHERE om.organization_id = $1
       ORDER BY om.is_owner DESC, au.full_name ASC`,
      [orgId],
    );
    return rows.map(r => ({
      userId: r.user_id,
      name: r.full_name,
      email: r.email,
      role: r.role,
      isOwner: r.is_owner,
      joinedAt: r.created_at,
    }));
  }

  async getWorkspaces(userId: string, orgId: string): Promise<WorkspaceSummary[]> {
    await this.assertMember(userId, orgId);

    const { rows } = await this.pool.query<{
      id: string; name: string; type: string; is_default: boolean; created_at: Date;
    }>(
      `SELECT w.id, w.name, w.type, w.is_default, w.created_at
       FROM workspaces w
       WHERE w.organization_id = $1
       ORDER BY w.is_default DESC, w.name ASC`,
      [orgId],
    );
    return rows.map(r => ({
      id: r.id,
      name: r.name,
      type: r.type,
      isDefault: r.is_default,
      createdAt: r.created_at,
    }));
  }
}
