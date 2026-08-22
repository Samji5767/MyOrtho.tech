import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';

function makeService(rows: Record<string, unknown[]>): OrganizationsService {
  const pool = {
    query: jest.fn().mockImplementation((sql: string) => {
      // Route queries to the right fixture based on keywords in the SQL
      if (sql.includes('organization_memberships') && sql.includes('JOIN organizations')) {
        return Promise.resolve({ rows: rows.memberOrgs ?? [] });
      }
      if (sql.includes('organizations o WHERE o.id')) {
        return Promise.resolve({ rows: rows.orgDetail ?? [] });
      }
      if (sql.includes('organization_memberships') && sql.includes('user_id = $1 AND organization_id = $2')) {
        return Promise.resolve({ rows: rows.membership ?? [] });
      }
      if (sql.includes('auth_users') && sql.includes('WHERE om.organization_id')) {
        return Promise.resolve({ rows: rows.members ?? [] });
      }
      if (sql.includes('workspaces') && sql.includes('WHERE w.organization_id')) {
        return Promise.resolve({ rows: rows.workspaces ?? [] });
      }
      return Promise.resolve({ rows: [] });
    }),
  };
  return new (OrganizationsService as any)(pool);
}

const ORG_ROW = {
  id: 'org-1', name: 'Test Clinic', type: 'clinic',
  settings: {}, created_at: new Date(),
  member_count: '3', workspace_count: '1',
};

const MEMBERSHIP_ROW = { role: 'orthodontist', is_owner: true };
const MEMBER_ROW = { user_id: 'u-1', full_name: 'Dr Smith', email: 'smith@clinic.com', role: 'orthodontist', is_owner: true, created_at: new Date() };
const WORKSPACE_ROW = { id: 'ws-1', name: 'Test Workspace', type: 'default', is_default: true, created_at: new Date() };

describe('OrganizationsService', () => {
  describe('listMyOrganizations', () => {
    it('returns organizations the user belongs to', async () => {
      const svc = makeService({
        memberOrgs: [{ ...ORG_ROW, is_owner: true, role: 'orthodontist' }],
      });
      const result = await svc.listMyOrganizations('u-1');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('org-1');
      expect(result[0].isOwner).toBe(true);
    });

    it('returns empty array when user has no organizations', async () => {
      const svc = makeService({ memberOrgs: [] });
      const result = await svc.listMyOrganizations('u-1');
      expect(result).toEqual([]);
    });
  });

  describe('getOrganization', () => {
    it('returns org detail when user is a member', async () => {
      const svc = makeService({
        membership: [MEMBERSHIP_ROW],
        orgDetail: [ORG_ROW],
      });
      const result = await svc.getOrganization('u-1', 'org-1');
      expect(result.id).toBe('org-1');
      expect(result.memberCount).toBe(3);
      expect(result.isOwner).toBe(true);
    });

    it('throws ForbiddenException when user is not a member', async () => {
      const svc = makeService({ membership: [], orgDetail: [ORG_ROW] });
      await expect(svc.getOrganization('u-1', 'org-1')).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when org does not exist', async () => {
      const svc = makeService({ membership: [MEMBERSHIP_ROW], orgDetail: [] });
      await expect(svc.getOrganization('u-1', 'org-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getMembers', () => {
    it('returns member list when user is a member', async () => {
      const svc = makeService({ membership: [MEMBERSHIP_ROW], members: [MEMBER_ROW] });
      const result = await svc.getMembers('u-1', 'org-1');
      expect(result).toHaveLength(1);
      expect(result[0].email).toBe('smith@clinic.com');
      expect(result[0].isOwner).toBe(true);
    });

    it('throws ForbiddenException for non-members (IDOR guard)', async () => {
      const svc = makeService({ membership: [] });
      await expect(svc.getMembers('attacker', 'org-1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getWorkspaces', () => {
    it('returns workspace list when user is a member', async () => {
      const svc = makeService({ membership: [MEMBERSHIP_ROW], workspaces: [WORKSPACE_ROW] });
      const result = await svc.getWorkspaces('u-1', 'org-1');
      expect(result).toHaveLength(1);
      expect(result[0].isDefault).toBe(true);
    });

    it('throws ForbiddenException for non-members (IDOR guard)', async () => {
      const svc = makeService({ membership: [] });
      await expect(svc.getWorkspaces('attacker', 'org-1')).rejects.toThrow(ForbiddenException);
    });
  });
});
