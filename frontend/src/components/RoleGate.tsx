'use client';

import { useAuth } from '@/context/AuthContext';

// Permission map — mirrors backend/src/auth/permissions.ts
type Permission =
  | 'patients:read' | 'patients:write' | 'patients:delete'
  | 'cases:read' | 'cases:write' | 'cases:delete' | 'cases:approve' | 'cases:send_to_manufacturing'
  | 'analytics:read'
  | 'manufacturing:read' | 'manufacturing:write' | 'manufacturing:manage'
  | 'admin:users' | 'admin:settings' | 'admin:org'
  | 'audit:read';

const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  super_admin:        ['patients:read','patients:write','patients:delete','cases:read','cases:write','cases:delete','cases:approve','cases:send_to_manufacturing','analytics:read','manufacturing:read','manufacturing:write','manufacturing:manage','admin:users','admin:settings','admin:org','audit:read'],
  admin:              ['patients:read','patients:write','patients:delete','cases:read','cases:write','cases:delete','cases:approve','cases:send_to_manufacturing','analytics:read','manufacturing:read','manufacturing:write','manufacturing:manage','admin:users','admin:settings','admin:org','audit:read'],
  clinical_director:  ['patients:read','patients:write','cases:read','cases:write','cases:delete','cases:approve','cases:send_to_manufacturing','analytics:read','manufacturing:read','audit:read'],
  orthodontist:       ['patients:read','patients:write','cases:read','cases:write','cases:approve','cases:send_to_manufacturing','analytics:read','manufacturing:read'],
  dentist:            ['patients:read','patients:write','cases:read','cases:write'],
  resident:           ['patients:read','cases:read','cases:write'],
  lab_manager:        ['cases:read','manufacturing:read','manufacturing:write','manufacturing:manage'],
  lab_technician:     ['cases:read','manufacturing:read','manufacturing:write'],
  vp_clinical:        ['patients:read','cases:read','cases:approve','analytics:read','audit:read'],
  vp_manufacturing:   ['cases:read','manufacturing:read','manufacturing:write','manufacturing:manage','analytics:read'],
  executive:          ['analytics:read','audit:read'],
};

function hasPermission(role: string, permission: Permission): boolean {
  return (ROLE_PERMISSIONS[role] ?? []).includes(permission);
}

interface RoleGateProps {
  permission?: Permission;
  roles?: string[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Shows `children` only when the current user has the required permission
 * (or one of the listed roles). Shows `fallback` (default: nothing) otherwise.
 *
 * Usage:
 *   <RoleGate permission="cases:approve">
 *     <ApproveButton />
 *   </RoleGate>
 */
export function RoleGate({ permission, roles, children, fallback = null }: RoleGateProps) {
  const { user } = useAuth();

  if (!user) return <>{fallback}</>;

  if (roles && !roles.includes(user.role)) return <>{fallback}</>;
  if (permission && !hasPermission(user.role, permission)) return <>{fallback}</>;

  return <>{children}</>;
}
