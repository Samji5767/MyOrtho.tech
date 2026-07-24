import { UnauthorizedException } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.guard';

export type AccessScope =
  | { kind: 'workspace'; orgId: string; workspaceId: string }
  | { kind: 'org';       orgId: string };

const ORG_WIDE_ROLES = new Set(['super_admin', 'admin']);

/**
 * Derives the effective authorization scope from the authenticated user.
 * - Users with a workspace assignment get workspace-scoped access.
 * - Only super_admin and admin roles can operate without a workspace (org-wide).
 * - All other authenticated users without a workspace get 401.
 *
 * This is the single authoritative point for determining what data a user can
 * read or mutate. Services must receive an AccessScope and never derive their
 * own tenant filter from the raw user object.
 */
export function buildScope(user: AuthUser): AccessScope {
  if (user.workspaceId) {
    if (!user.orgId) throw new UnauthorizedException('No organization assigned');
    return { kind: 'workspace', orgId: user.orgId, workspaceId: user.workspaceId };
  }
  if (user.orgId && ORG_WIDE_ROLES.has(user.role)) {
    return { kind: 'org', orgId: user.orgId };
  }
  throw new UnauthorizedException(
    'No effective access scope — workspace assignment required for this role',
  );
}

/** Returns the appropriate column reference for scoping a query. */
export function scopeColumn(scope: AccessScope, tableAlias: string): string {
  return scope.kind === 'workspace'
    ? `${tableAlias}.workspace_id`
    : `${tableAlias}.organization_id`;
}

/** Returns the value to bind for a scope column predicate. */
export function scopeValue(scope: AccessScope): string {
  return scope.kind === 'workspace' ? scope.workspaceId : scope.orgId;
}
