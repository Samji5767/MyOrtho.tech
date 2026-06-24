// Auth API helpers — same-origin relative paths so nginx /api/ proxy handles routing.

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  orgId: string | null;
  isOnboarded: boolean;
}

export async function fetchSession(): Promise<AuthUser | null> {
  try {
    const res = await fetch(`/api/auth/session`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json() as { user: AuthUser };
    return data.user;
  } catch {
    return null;
  }
}

export async function login(email: string, password: string): Promise<{ user: AuthUser } | { error: string }> {
  try {
    const res = await fetch(`/api/auth/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json() as { user?: AuthUser; message?: string; error?: string };
    if (!res.ok) return { error: data.message ?? data.error ?? 'Login failed' };
    return { user: data.user! };
  } catch {
    return { error: 'Network error — could not reach the server' };
  }
}

export async function logout(): Promise<void> {
  try {
    await fetch(`/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
  } catch {
    // ignore network errors on logout
  }
}

export function roleLabel(role: string): string {
  const map: Record<string, string> = {
    super_admin:       'Super Admin',
    admin:             'Admin',
    orthodontist:      'Orthodontist',
    dentist:           'Dentist',
    resident:          'Resident',
    lab_technician:    'Lab Tech',
    lab_manager:       'Lab Manager',
    clinical_director: 'Clinical Director',
    vp_clinical:       'VP Clinical',
    vp_manufacturing:  'VP Manufacturing',
    executive:         'Executive',
  };
  return map[role] ?? role;
}

export function roleTone(role: string): 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  if (role === 'super_admin' || role === 'admin') return 'danger';
  if (role === 'clinical_director' || role === 'vp_clinical') return 'primary';
  if (role === 'orthodontist' || role === 'dentist' || role === 'resident') return 'success';
  if (role === 'lab_technician' || role === 'lab_manager') return 'warning';
  if (role === 'executive' || role.startsWith('vp_')) return 'info';
  return 'neutral';
}
