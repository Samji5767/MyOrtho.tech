'use client';

import { useAuth } from '@/context/AuthContext';

// Permission map — mirrors backend/src/auth/permissions.ts
// Keep in sync with the backend; the frontend uses this for UI hiding only,
// not enforcement (enforcement is always at the API layer).
type Permission =
  | 'patients:read' | 'patients:write' | 'patients:delete'
  | 'cases:read' | 'cases:write' | 'cases:delete' | 'cases:approve' | 'cases:send_to_manufacturing'
  | 'analytics:read'
  | 'manufacturing:read' | 'manufacturing:write' | 'manufacturing:manage'
  | 'admin:users' | 'admin:settings' | 'admin:org'
  | 'audit:read';

// super_admin is intentionally absent — isSuperAdmin() grants wildcard access.
const ROLE_PERMISSIONS: Record<string, Permission[]> = {
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
    'analytics:read',
    'audit:read',
  ],
  executive: [
    'analytics:read',
    'audit:read',
  ],
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
 * super_admin bypasses all permission and role checks — wildcard access.
 *
 * Usage:
 *   <RoleGate permission="cases:approve">
 *     <ApproveButton />
 *   </RoleGate>
 *
 *   <RoleGate roles={["admin", "clinical_director"]}>
 *     <AdminWidget />
 *   </RoleGate>
 */
export function RoleGate({ permission, roles, children, fallback = null }: RoleGateProps) {
  const { user } = useAuth();

  if (!user) return <>{fallback}</>;

  // super_admin has unrestricted platform access — bypasses all gates.
  if (user.role === 'super_admin') return <>{children}</>;

  if (roles && !roles.includes(user.role)) return <>{fallback}</>;
  if (permission && !hasPermission(user.role, permission)) return <>{fallback}</>;

  return <>{children}</>;
}
