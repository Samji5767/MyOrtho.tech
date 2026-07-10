import { ForbiddenException, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  hasPermission,
  getPermissions,
  ROLE_PERMISSIONS,
  type Permission,
} from './permissions';
import { PermissionsGuard } from './permissions.guard';
import { PERMISSION_KEY } from './require-permission.decorator';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ALL_PERMISSIONS: Permission[] = [
  'patients:read', 'patients:write', 'patients:delete',
  'cases:read', 'cases:write', 'cases:delete', 'cases:approve', 'cases:send_to_manufacturing',
  'analytics:read',
  'manufacturing:read', 'manufacturing:write', 'manufacturing:manage',
  'admin:users', 'admin:settings', 'admin:org',
  'audit:read',
];

const ALL_ROLES = Object.keys(ROLE_PERMISSIONS);

// ─── hasPermission ─────────────────────────────────────────────────────────────

describe('hasPermission', () => {
  it('returns false for unknown role', () => {
    expect(hasPermission('unknown_role', 'patients:read')).toBe(false);
  });

  it('returns false for empty-string role', () => {
    expect(hasPermission('', 'patients:read')).toBe(false);
  });

  it('returns false when role is undefined (cast)', () => {
    expect(hasPermission(undefined as unknown as string, 'patients:read')).toBe(false);
  });

  describe('super_admin has every permission', () => {
    ALL_PERMISSIONS.forEach((perm) => {
      it(`super_admin: ${perm}`, () => {
        expect(hasPermission('super_admin', perm)).toBe(true);
      });
    });
  });

  describe('admin', () => {
    const granted: Permission[] = [
      'patients:read', 'patients:write',
      'cases:read', 'cases:write', 'cases:approve', 'cases:send_to_manufacturing',
      'analytics:read', 'manufacturing:read',
      'admin:users', 'admin:settings',
      'audit:read',
    ];
    const denied: Permission[] = ['patients:delete', 'cases:delete', 'manufacturing:write', 'manufacturing:manage', 'admin:org'];

    granted.forEach((p) => it(`admin GRANTED ${p}`, () => expect(hasPermission('admin', p)).toBe(true)));
    denied.forEach((p) => it(`admin DENIED ${p}`, () => expect(hasPermission('admin', p)).toBe(false)));
  });

  describe('clinical_director', () => {
    const granted: Permission[] = [
      'patients:read',
      'cases:read', 'cases:write', 'cases:approve', 'cases:send_to_manufacturing',
      'analytics:read', 'manufacturing:read',
      'audit:read',
    ];
    const denied: Permission[] = [
      'patients:write', 'patients:delete',
      'cases:delete',
      'manufacturing:write', 'manufacturing:manage',
      'admin:users', 'admin:settings', 'admin:org',
    ];

    granted.forEach((p) => it(`clinical_director GRANTED ${p}`, () => expect(hasPermission('clinical_director', p)).toBe(true)));
    denied.forEach((p) => it(`clinical_director DENIED ${p}`, () => expect(hasPermission('clinical_director', p)).toBe(false)));
  });

  describe('orthodontist', () => {
    const granted: Permission[] = [
      'patients:read', 'patients:write',
      'cases:read', 'cases:write', 'cases:approve',
      'analytics:read',
    ];
    const denied: Permission[] = [
      'patients:delete',
      'cases:delete', 'cases:send_to_manufacturing',
      'manufacturing:read', 'manufacturing:write', 'manufacturing:manage',
      'admin:users', 'admin:settings', 'admin:org',
      'audit:read',
    ];

    granted.forEach((p) => it(`orthodontist GRANTED ${p}`, () => expect(hasPermission('orthodontist', p)).toBe(true)));
    denied.forEach((p) => it(`orthodontist DENIED ${p}`, () => expect(hasPermission('orthodontist', p)).toBe(false)));
  });

  describe('dentist', () => {
    const granted: Permission[] = ['patients:read', 'cases:read', 'cases:write', 'analytics:read'];
    const denied: Permission[] = [
      'patients:write', 'patients:delete',
      'cases:delete', 'cases:approve', 'cases:send_to_manufacturing',
      'manufacturing:read', 'manufacturing:write', 'manufacturing:manage',
      'admin:users', 'admin:settings', 'admin:org',
      'audit:read',
    ];

    granted.forEach((p) => it(`dentist GRANTED ${p}`, () => expect(hasPermission('dentist', p)).toBe(true)));
    denied.forEach((p) => it(`dentist DENIED ${p}`, () => expect(hasPermission('dentist', p)).toBe(false)));
  });

  describe('resident', () => {
    const granted: Permission[] = ['patients:read', 'cases:read', 'analytics:read'];
    const denied: Permission[] = [
      'patients:write', 'patients:delete',
      'cases:write', 'cases:delete', 'cases:approve', 'cases:send_to_manufacturing',
      'manufacturing:read', 'manufacturing:write', 'manufacturing:manage',
      'admin:users', 'admin:settings', 'admin:org',
      'audit:read',
    ];

    granted.forEach((p) => it(`resident GRANTED ${p}`, () => expect(hasPermission('resident', p)).toBe(true)));
    denied.forEach((p) => it(`resident DENIED ${p}`, () => expect(hasPermission('resident', p)).toBe(false)));
  });

  describe('lab_manager', () => {
    const granted: Permission[] = [
      'cases:read',
      'manufacturing:read', 'manufacturing:write', 'manufacturing:manage',
      'analytics:read',
      'audit:read',
    ];
    const denied: Permission[] = [
      'patients:read', 'patients:write', 'patients:delete',
      'cases:write', 'cases:delete', 'cases:approve', 'cases:send_to_manufacturing',
      'admin:users', 'admin:settings', 'admin:org',
    ];

    granted.forEach((p) => it(`lab_manager GRANTED ${p}`, () => expect(hasPermission('lab_manager', p)).toBe(true)));
    denied.forEach((p) => it(`lab_manager DENIED ${p}`, () => expect(hasPermission('lab_manager', p)).toBe(false)));
  });

  describe('lab_technician', () => {
    const granted: Permission[] = ['cases:read', 'manufacturing:read', 'manufacturing:write'];
    const denied: Permission[] = [
      'patients:read', 'patients:write', 'patients:delete',
      'cases:write', 'cases:delete', 'cases:approve', 'cases:send_to_manufacturing',
      'manufacturing:manage',
      'analytics:read',
      'admin:users', 'admin:settings', 'admin:org',
      'audit:read',
    ];

    granted.forEach((p) => it(`lab_technician GRANTED ${p}`, () => expect(hasPermission('lab_technician', p)).toBe(true)));
    denied.forEach((p) => it(`lab_technician DENIED ${p}`, () => expect(hasPermission('lab_technician', p)).toBe(false)));
  });

  describe('vp_clinical', () => {
    const granted: Permission[] = [
      'patients:read',
      'cases:read', 'cases:approve',
      'analytics:read',
      'audit:read',
    ];
    const denied: Permission[] = [
      'patients:write', 'patients:delete',
      'cases:write', 'cases:delete', 'cases:send_to_manufacturing',
      'manufacturing:read', 'manufacturing:write', 'manufacturing:manage',
      'admin:users', 'admin:settings', 'admin:org',
    ];

    granted.forEach((p) => it(`vp_clinical GRANTED ${p}`, () => expect(hasPermission('vp_clinical', p)).toBe(true)));
    denied.forEach((p) => it(`vp_clinical DENIED ${p}`, () => expect(hasPermission('vp_clinical', p)).toBe(false)));
  });

  describe('vp_manufacturing', () => {
    const granted: Permission[] = [
      'cases:read', 'cases:send_to_manufacturing',
      'manufacturing:read', 'manufacturing:write', 'manufacturing:manage',
      'analytics:read',
      'audit:read',
    ];
    const denied: Permission[] = [
      'patients:read', 'patients:write', 'patients:delete',
      'cases:write', 'cases:delete', 'cases:approve',
      'admin:users', 'admin:settings', 'admin:org',
    ];

    granted.forEach((p) => it(`vp_manufacturing GRANTED ${p}`, () => expect(hasPermission('vp_manufacturing', p)).toBe(true)));
    denied.forEach((p) => it(`vp_manufacturing DENIED ${p}`, () => expect(hasPermission('vp_manufacturing', p)).toBe(false)));
  });

  describe('executive', () => {
    const granted: Permission[] = ['analytics:read', 'audit:read'];
    const denied: Permission[] = [
      'patients:read', 'patients:write', 'patients:delete',
      'cases:read', 'cases:write', 'cases:delete', 'cases:approve', 'cases:send_to_manufacturing',
      'manufacturing:read', 'manufacturing:write', 'manufacturing:manage',
      'admin:users', 'admin:settings', 'admin:org',
    ];

    granted.forEach((p) => it(`executive GRANTED ${p}`, () => expect(hasPermission('executive', p)).toBe(true)));
    denied.forEach((p) => it(`executive DENIED ${p}`, () => expect(hasPermission('executive', p)).toBe(false)));
  });

  it('no role has duplicate permissions in their list', () => {
    ALL_ROLES.forEach((role) => {
      const perms = ROLE_PERMISSIONS[role];
      const unique = new Set(perms);
      expect(unique.size).toBe(perms.length);
    });
  });
});

// ─── getPermissions ────────────────────────────────────────────────────────────

describe('getPermissions', () => {
  it('returns empty array for unknown role', () => {
    expect(getPermissions('unknown')).toEqual([]);
  });

  it('returns empty array for empty-string role', () => {
    expect(getPermissions('')).toEqual([]);
  });

  it('super_admin has all 16 permissions', () => {
    expect(getPermissions('super_admin')).toHaveLength(ALL_PERMISSIONS.length);
    ALL_PERMISSIONS.forEach((p) => expect(getPermissions('super_admin')).toContain(p));
  });

  it('executive has exactly analytics:read and audit:read', () => {
    const perms = getPermissions('executive');
    expect(perms).toHaveLength(2);
    expect(perms).toContain('analytics:read');
    expect(perms).toContain('audit:read');
  });

  it('result for every known role is consistent with ROLE_PERMISSIONS', () => {
    ALL_ROLES.forEach((role) => {
      expect(getPermissions(role)).toEqual(ROLE_PERMISSIONS[role]);
    });
  });

  it('returns a reference (not a copy) — callers should not mutate', () => {
    const perms = getPermissions('executive');
    expect(perms).toBe(ROLE_PERMISSIONS['executive']);
  });
});

// ─── PermissionsGuard ─────────────────────────────────────────────────────────

function makeContext(opts: {
  requiredPermission?: Permission;
  user?: { id: string; email: string; role: string; name: string; orgId: string | null } | null;
}): ExecutionContext {
  const reflector = {
    getAllAndOverride: jest.fn(() => opts.requiredPermission),
  };

  const request: Record<string, unknown> = { user: opts.user };

  return {
    getHandler: jest.fn(() => ({})),
    getClass: jest.fn(() => ({})),
    switchToHttp: jest.fn(() => ({
      getRequest: () => request,
    })),
    // PermissionsGuard only uses these three; the rest are unused
  } as unknown as ExecutionContext;
}

function makeGuard(required?: Permission): { guard: PermissionsGuard; reflector: jest.Mocked<Reflector> } {
  const reflector = {
    getAllAndOverride: jest.fn(() => required),
  } as unknown as jest.Mocked<Reflector>;
  const guard = new PermissionsGuard(reflector as Reflector);
  return { guard, reflector };
}

describe('PermissionsGuard.canActivate', () => {
  it('returns true when no permission decorator is present', () => {
    const { guard } = makeGuard(undefined);
    const ctx = makeContext({ requiredPermission: undefined, user: null });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('throws ForbiddenException when user is missing from request', () => {
    const { guard } = makeGuard('patients:read');
    const ctx = makeContext({ requiredPermission: 'patients:read', user: undefined });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(ctx)).toThrow('Authentication required');
  });

  it('throws ForbiddenException when user is explicitly null', () => {
    const { guard } = makeGuard('patients:read');
    const ctx = makeContext({ requiredPermission: 'patients:read', user: null });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('returns true when user role has the required permission', () => {
    const { guard } = makeGuard('patients:read');
    const ctx = makeContext({
      requiredPermission: 'patients:read',
      user: { id: 'u1', email: 'doc@org.com', role: 'orthodontist', name: 'Doc', orgId: 'org-1' },
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('throws ForbiddenException when user role lacks the required permission', () => {
    const { guard } = makeGuard('admin:org');
    const ctx = makeContext({
      requiredPermission: 'admin:org',
      user: { id: 'u2', email: 'lab@org.com', role: 'lab_technician', name: 'Lab', orgId: 'org-1' },
    });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(ctx)).toThrow("Role 'lab_technician' does not have permission 'admin:org'");
  });

  it('throws ForbiddenException when user has an unknown role', () => {
    const { guard } = makeGuard('cases:read');
    const ctx = makeContext({
      requiredPermission: 'cases:read',
      user: { id: 'u3', email: 'x@org.com', role: 'hacker', name: 'X', orgId: 'org-1' },
    });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('executive cannot access patients:read', () => {
    const { guard } = makeGuard('patients:read');
    const ctx = makeContext({
      requiredPermission: 'patients:read',
      user: { id: 'u4', email: 'exec@org.com', role: 'executive', name: 'Exec', orgId: 'org-1' },
    });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('super_admin can access admin:org', () => {
    const { guard } = makeGuard('admin:org');
    const ctx = makeContext({
      requiredPermission: 'admin:org',
      user: { id: 'u5', email: 'sa@org.com', role: 'super_admin', name: 'SA', orgId: null },
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('admin cannot delete patients (patients:delete)', () => {
    const { guard } = makeGuard('patients:delete');
    const ctx = makeContext({
      requiredPermission: 'patients:delete',
      user: { id: 'u6', email: 'admin@org.com', role: 'admin', name: 'Admin', orgId: 'org-1' },
    });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('resident cannot approve cases (cases:approve)', () => {
    const { guard } = makeGuard('cases:approve');
    const ctx = makeContext({
      requiredPermission: 'cases:approve',
      user: { id: 'u7', email: 'res@org.com', role: 'resident', name: 'Res', orgId: 'org-1' },
    });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('lab_technician cannot manage manufacturing (manufacturing:manage)', () => {
    const { guard } = makeGuard('manufacturing:manage');
    const ctx = makeContext({
      requiredPermission: 'manufacturing:manage',
      user: { id: 'u8', email: 'tech@org.com', role: 'lab_technician', name: 'Tech', orgId: 'org-1' },
    });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('vp_clinical can approve cases', () => {
    const { guard } = makeGuard('cases:approve');
    const ctx = makeContext({
      requiredPermission: 'cases:approve',
      user: { id: 'u9', email: 'vpc@org.com', role: 'vp_clinical', name: 'VPC', orgId: 'org-1' },
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('vp_manufacturing cannot approve cases', () => {
    const { guard } = makeGuard('cases:approve');
    const ctx = makeContext({
      requiredPermission: 'cases:approve',
      user: { id: 'u10', email: 'vpm@org.com', role: 'vp_manufacturing', name: 'VPM', orgId: 'org-1' },
    });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('uses reflector with PERMISSION_KEY and both handler + class contexts', () => {
    const handler = jest.fn();
    const cls = jest.fn();
    const reflector = {
      getAllAndOverride: jest.fn(() => undefined),
    } as unknown as jest.Mocked<Reflector>;
    const guard = new PermissionsGuard(reflector as Reflector);

    const ctx = {
      getHandler: jest.fn(() => handler),
      getClass: jest.fn(() => cls),
      switchToHttp: jest.fn(() => ({ getRequest: () => ({}) })),
    } as unknown as ExecutionContext;

    guard.canActivate(ctx);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(PERMISSION_KEY, [handler, cls]);
  });

  // Org isolation: guard trusts the JWT user.orgId — it does not enforce org scoping itself.
  // Org scoping is enforced at the service layer (WHERE organization_id = $N).
  // This test documents that the guard only checks role, not orgId.
  it('allows access regardless of orgId value (org scoping is service-layer concern)', () => {
    const { guard } = makeGuard('patients:read');
    const ctxNullOrg = makeContext({
      requiredPermission: 'patients:read',
      user: { id: 'u11', email: 'doc@org.com', role: 'orthodontist', name: 'Doc', orgId: null },
    });
    expect(guard.canActivate(ctxNullOrg)).toBe(true);
  });
});
