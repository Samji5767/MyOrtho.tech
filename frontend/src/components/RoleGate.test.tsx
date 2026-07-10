import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { RoleGate } from './RoleGate';
import { useAuth } from '@/context/AuthContext';

vi.mock('@/context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

const mockUseAuth = vi.mocked(useAuth);

function makeUser(role: string) {
  return {
    id: 'u1',
    email: 'test@myortho.tech',
    name: 'Test User',
    role,
    orgId: 'org-1',
    isOnboarded: true,
  };
}

function renderGate(
  user: ReturnType<typeof makeUser> | null,
  gateProps: Partial<Omit<React.ComponentProps<typeof RoleGate>, 'children'>> = {},
) {
  mockUseAuth.mockReturnValue({
    user,
    status: user ? 'authenticated' : 'unauthenticated',
    refresh: vi.fn(),
    logout: vi.fn(),
  });
  return render(
    <RoleGate fallback={<span>fallback</span>} {...gateProps}>
      <span>children</span>
    </RoleGate>,
  );
}

describe('RoleGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Unauthenticated ──────────────────────────────────────────────────────

  describe('unauthenticated', () => {
    it('renders fallback when user is null', () => {
      renderGate(null, { permission: 'cases:read' });
      expect(screen.getByText('fallback')).toBeInTheDocument();
      expect(screen.queryByText('children')).not.toBeInTheDocument();
    });

    it('renders nothing (default fallback) when user is null and no fallback prop', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        status: 'unauthenticated',
        refresh: vi.fn(),
        logout: vi.fn(),
      });
      const { container } = render(
        <RoleGate permission="cases:read">
          <span>children</span>
        </RoleGate>,
      );
      expect(container).toBeEmptyDOMElement();
    });
  });

  // ─── super_admin wildcard ─────────────────────────────────────────────────

  describe('super_admin wildcard access', () => {
    it('renders children with a restrictive permission gate', () => {
      renderGate(makeUser('super_admin'), { permission: 'admin:org' });
      expect(screen.getByText('children')).toBeInTheDocument();
      expect(screen.queryByText('fallback')).not.toBeInTheDocument();
    });

    it('renders children with a restrictive roles gate', () => {
      renderGate(makeUser('super_admin'), { roles: ['admin'] });
      expect(screen.getByText('children')).toBeInTheDocument();
      expect(screen.queryByText('fallback')).not.toBeInTheDocument();
    });

    it('renders children when both permission and roles are set and would normally deny', () => {
      renderGate(makeUser('super_admin'), { permission: 'patients:delete', roles: ['admin'] });
      expect(screen.getByText('children')).toBeInTheDocument();
    });

    it('renders children with no gate props at all', () => {
      renderGate(makeUser('super_admin'));
      expect(screen.getByText('children')).toBeInTheDocument();
    });

    it('bypasses a roles list that excludes super_admin entirely', () => {
      renderGate(makeUser('super_admin'), { roles: ['lab_technician', 'lab_manager'] });
      expect(screen.getByText('children')).toBeInTheDocument();
    });

    it('bypasses patients:delete which no ordinary role possesses', () => {
      renderGate(makeUser('super_admin'), { permission: 'patients:delete' });
      expect(screen.getByText('children')).toBeInTheDocument();
    });

    it('bypasses cases:delete which no ordinary role possesses', () => {
      renderGate(makeUser('super_admin'), { permission: 'cases:delete' });
      expect(screen.getByText('children')).toBeInTheDocument();
    });

    it('bypasses admin:org which no ordinary role possesses', () => {
      renderGate(makeUser('super_admin'), { permission: 'admin:org' });
      expect(screen.getByText('children')).toBeInTheDocument();
    });
  });

  // ─── Permission gate ──────────────────────────────────────────────────────

  describe('permission gate', () => {
    it('renders children when role has the required permission', () => {
      renderGate(makeUser('orthodontist'), { permission: 'cases:approve' });
      expect(screen.getByText('children')).toBeInTheDocument();
    });

    it('renders fallback when role lacks the required permission', () => {
      renderGate(makeUser('executive'), { permission: 'patients:read' });
      expect(screen.getByText('fallback')).toBeInTheDocument();
      expect(screen.queryByText('children')).not.toBeInTheDocument();
    });

    it('renders fallback when admin tries patients:delete', () => {
      renderGate(makeUser('admin'), { permission: 'patients:delete' });
      expect(screen.getByText('fallback')).toBeInTheDocument();
    });

    it('renders children when lab_manager has manufacturing:manage', () => {
      renderGate(makeUser('lab_manager'), { permission: 'manufacturing:manage' });
      expect(screen.getByText('children')).toBeInTheDocument();
    });

    it('renders fallback when lab_technician lacks manufacturing:manage', () => {
      renderGate(makeUser('lab_technician'), { permission: 'manufacturing:manage' });
      expect(screen.getByText('fallback')).toBeInTheDocument();
    });

    it('renders fallback when resident tries cases:approve', () => {
      renderGate(makeUser('resident'), { permission: 'cases:approve' });
      expect(screen.getByText('fallback')).toBeInTheDocument();
    });

    it('renders children when clinical_director has cases:send_to_manufacturing', () => {
      renderGate(makeUser('clinical_director'), { permission: 'cases:send_to_manufacturing' });
      expect(screen.getByText('children')).toBeInTheDocument();
    });

    it('renders fallback when vp_manufacturing tries cases:approve', () => {
      renderGate(makeUser('vp_manufacturing'), { permission: 'cases:approve' });
      expect(screen.getByText('fallback')).toBeInTheDocument();
    });

    it('renders children when vp_clinical has audit:read', () => {
      renderGate(makeUser('vp_clinical'), { permission: 'audit:read' });
      expect(screen.getByText('children')).toBeInTheDocument();
    });

    it('renders fallback for unknown role regardless of permission', () => {
      renderGate(makeUser('unknown_role'), { permission: 'cases:read' });
      expect(screen.getByText('fallback')).toBeInTheDocument();
    });
  });

  // ─── Roles gate ───────────────────────────────────────────────────────────

  describe('roles gate', () => {
    it('renders children when user role is in allowed list', () => {
      renderGate(makeUser('admin'), { roles: ['admin', 'clinical_director'] });
      expect(screen.getByText('children')).toBeInTheDocument();
    });

    it('renders fallback when user role is not in allowed list', () => {
      renderGate(makeUser('lab_technician'), { roles: ['admin', 'clinical_director'] });
      expect(screen.getByText('fallback')).toBeInTheDocument();
    });

    it('renders children with a single-element roles array', () => {
      renderGate(makeUser('lab_manager'), { roles: ['lab_manager'] });
      expect(screen.getByText('children')).toBeInTheDocument();
    });

    it('renders fallback when roles array is empty', () => {
      renderGate(makeUser('admin'), { roles: [] });
      expect(screen.getByText('fallback')).toBeInTheDocument();
    });
  });

  // ─── No gate props ────────────────────────────────────────────────────────

  describe('no gate props', () => {
    it('renders children for any authenticated user when no permission or roles are required', () => {
      renderGate(makeUser('resident'));
      expect(screen.getByText('children')).toBeInTheDocument();
    });
  });

  // ─── Permission + roles combined ──────────────────────────────────────────

  describe('permission and roles combined', () => {
    it('renders fallback when role check passes but permission check fails', () => {
      // admin is in the roles list, but admin lacks patients:delete
      renderGate(makeUser('admin'), { roles: ['admin'], permission: 'patients:delete' });
      expect(screen.getByText('fallback')).toBeInTheDocument();
    });

    it('renders fallback when permission check would pass but role check fails first', () => {
      // orthodontist has cases:read, but is not in the roles list
      renderGate(makeUser('orthodontist'), { roles: ['admin'], permission: 'cases:read' });
      expect(screen.getByText('fallback')).toBeInTheDocument();
    });

    it('renders children when both role and permission checks pass', () => {
      renderGate(makeUser('clinical_director'), { roles: ['clinical_director', 'admin'], permission: 'cases:approve' });
      expect(screen.getByText('children')).toBeInTheDocument();
    });
  });
});
