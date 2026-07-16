/**
 * Role-based permission map.
 *
 * This is the single source of truth for what each role can do.
 * Enforcement happens at the API layer via PermissionsGuard.
 * The frontend uses the same permission names for UI hiding (not enforcement).
 *
 * Permission format: "resource:action"
 *   resources: patients, cases, analytics, manufacturing, admin, audit
 *   actions:   read, write, delete, approve, manage
 *
 * Super Admin: wildcard access — passes every permission check automatically.
 * New permissions are automatically granted to super_admin without code changes.
 */

export type Permission =
  | 'patients:read'
  | 'patients:write'
  | 'patients:delete'
  | 'cases:read'
  | 'cases:write'
  | 'cases:delete'
  | 'cases:approve'
  | 'cases:send_to_manufacturing'
  | 'analytics:read'
  | 'manufacturing:read'
  | 'manufacturing:write'
  | 'manufacturing:manage'
  | 'qa:approve'
  | 'admin:users'
  | 'admin:settings'
  | 'admin:org'
  | 'audit:read'
  | 'integrations:read'
  | 'integrations:write'
  | 'knowledge:read'
  | 'knowledge:write'
  | 'mlops:read'
  | 'mlops:manage';

export const ALL_PERMISSIONS: Permission[] = [
  'patients:read', 'patients:write', 'patients:delete',
  'cases:read', 'cases:write', 'cases:delete', 'cases:approve', 'cases:send_to_manufacturing',
  'analytics:read',
  'manufacturing:read', 'manufacturing:write', 'manufacturing:manage',
  'qa:approve',
  'admin:users', 'admin:settings', 'admin:org',
  'audit:read',
  'integrations:read', 'integrations:write',
  'knowledge:read', 'knowledge:write',
  'mlops:read', 'mlops:manage',
];

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  // super_admin is intentionally absent: hasPermission() grants wildcard access for this role.
  // Listing ALL_PERMISSIONS here would require manual updates whenever a new permission is added;
  // the wildcard approach in hasPermission() eliminates that maintenance burden.

  admin: [
    'patients:read', 'patients:write',
    'cases:read', 'cases:write', 'cases:approve', 'cases:send_to_manufacturing',
    'analytics:read',
    'manufacturing:read',
    'admin:users', 'admin:settings',
    'audit:read',
    'integrations:read', 'integrations:write',
    'knowledge:read', 'knowledge:write',
    'mlops:read', 'mlops:manage',
  ],

  clinical_director: [
    'patients:read',
    'cases:read', 'cases:write', 'cases:approve', 'cases:send_to_manufacturing',
    'analytics:read',
    'manufacturing:read',
    'audit:read',
    'knowledge:read',
  ],

  orthodontist: [
    'patients:read', 'patients:write',
    'cases:read', 'cases:write', 'cases:approve',
    'analytics:read',
  ],

  dentist: [
    'patients:read',
    'cases:read', 'cases:write',
    'analytics:read',
  ],

  resident: [
    'patients:read',
    'cases:read',
    'analytics:read',
  ],

  lab_manager: [
    'cases:read',
    'manufacturing:read', 'manufacturing:write', 'manufacturing:manage',
    'qa:approve',
    'analytics:read',
    'audit:read',
    'knowledge:read', 'knowledge:write',
  ],

  lab_technician: [
    'cases:read',
    'manufacturing:read', 'manufacturing:write',
  ],

  vp_clinical: [
    'patients:read',
    'cases:read', 'cases:approve',
    'analytics:read',
    'audit:read',
  ],

  vp_manufacturing: [
    'cases:read', 'cases:send_to_manufacturing',
    'manufacturing:read', 'manufacturing:write', 'manufacturing:manage',
    'qa:approve',
    'analytics:read',
    'audit:read',
  ],

  executive: [
    'analytics:read',
    'audit:read',
  ],
};

/** Returns true if the given role possesses the given permission. */
export function hasPermission(role: string, permission: Permission): boolean {
  // super_admin has wildcard access — passes every permission check, including
  // permissions added in the future, without requiring any code changes here.
  if (role === 'super_admin') return true;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/** Returns the explicit permission list for a role (empty for super_admin; use hasPermission instead). */
export function getPermissions(role: string): Permission[] {
  if (role === 'super_admin') return [...ALL_PERMISSIONS];
  return ROLE_PERMISSIONS[role] ?? [];
}

/** Returns true when the given role has unrestricted platform access. */
export function isSuperAdmin(role: string): boolean {
  return role === 'super_admin';
}
