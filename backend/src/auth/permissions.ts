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
  | 'audit:read';

const ALL_PERMISSIONS: Permission[] = [
  'patients:read', 'patients:write', 'patients:delete',
  'cases:read', 'cases:write', 'cases:delete', 'cases:approve', 'cases:send_to_manufacturing',
  'analytics:read',
  'manufacturing:read', 'manufacturing:write', 'manufacturing:manage',
  'qa:approve',
  'admin:users', 'admin:settings', 'admin:org',
  'audit:read',
];

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  super_admin: ALL_PERMISSIONS,

  admin: [
    'patients:read', 'patients:write',
    'cases:read', 'cases:write', 'cases:approve', 'cases:send_to_manufacturing',
    'analytics:read',
    'manufacturing:read',
    'admin:users', 'admin:settings',
    'audit:read',
  ],

  clinical_director: [
    'patients:read',
    'cases:read', 'cases:write', 'cases:approve', 'cases:send_to_manufacturing',
    'analytics:read',
    'manufacturing:read',
    'audit:read',
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

export function hasPermission(role: string, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function getPermissions(role: string): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}
