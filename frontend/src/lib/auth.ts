// Auth API helpers.
// BASE is empty in production Docker builds (no ARG at build time), so all paths
// are relative and nginx /api/ proxy handles routing. In local dev, set
// NEXT_PUBLIC_API_URL=http://localhost:4000 in .env so the dev server reaches
// the backend directly (no nginx in local dev).
const BASE =
  typeof process !== 'undefined'
    ? (process.env.NEXT_PUBLIC_API_URL ?? '')
    : '';

function getCsrfToken(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.split('; ').find((c) => c.startsWith('XSRF-TOKEN='));
  return match ? match.substring('XSRF-TOKEN='.length) : undefined;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  orgId: string | null;
  isOnboarded: boolean;
  isEmailVerified: boolean;
}

export async function fetchSession(): Promise<AuthUser | null> {
  try {
    const res = await fetch(`${BASE}/api/auth/session`, {
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
    const csrf = getCsrfToken();
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRF-Token': csrf } : {}) },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json() as { user?: AuthUser; message?: string; error?: string };
    if (!res.ok) return { error: data.message ?? data.error ?? 'Login failed' };
    return { user: data.user! };
  } catch {
    return { error: 'Network error — could not reach the server' };
  }
}

export async function register(
  email: string,
  password: string,
  fullName: string,
  clinicName: string,
): Promise<{ user: AuthUser } | { error: string }> {
  try {
    const csrf = getCsrfToken();
    const res = await fetch(`${BASE}/api/auth/register`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRF-Token': csrf } : {}) },
      body: JSON.stringify({ email, password, fullName, clinicName }),
    });
    const data = await res.json() as { user?: AuthUser; message?: string; error?: string };
    if (!res.ok) return { error: data.message ?? data.error ?? 'Registration failed' };
    return { user: data.user! };
  } catch {
    return { error: 'Network error — could not reach the server' };
  }
}

export async function verifyEmail(token: string): Promise<{ ok: true } | { error: string }> {
  try {
    const csrf = getCsrfToken();
    const res = await fetch(`${BASE}/api/auth/verify-email?token=${encodeURIComponent(token)}`, {
      method: 'POST',
      credentials: 'include',
      headers: csrf ? { 'X-CSRF-Token': csrf } : {},
    });
    const data = await res.json() as { ok?: boolean; message?: string; error?: string };
    if (!res.ok) return { error: data.message ?? data.error ?? 'Verification failed' };
    return { ok: true };
  } catch {
    return { error: 'Network error — could not reach the server' };
  }
}

export async function resendVerification(): Promise<{ ok: true } | { error: string }> {
  try {
    const csrf = getCsrfToken();
    const res = await fetch(`${BASE}/api/auth/resend-verification`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRF-Token': csrf } : {}) },
    });
    const data = await res.json() as { ok?: boolean; message?: string; error?: string };
    if (!res.ok) return { error: data.message ?? data.error ?? 'Failed to resend verification email' };
    return { ok: true };
  } catch {
    return { error: 'Network error — could not reach the server' };
  }
}

export async function forgotPassword(email: string): Promise<{ ok: true } | { error: string }> {
  try {
    const csrf = getCsrfToken();
    const res = await fetch(`${BASE}/api/auth/forgot-password`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRF-Token': csrf } : {}) },
      body: JSON.stringify({ email }),
    });
    const data = await res.json() as { ok?: boolean; message?: string; error?: string };
    if (!res.ok) return { error: data.message ?? data.error ?? 'Request failed' };
    return { ok: true };
  } catch {
    return { error: 'Network error — could not reach the server' };
  }
}

export async function resetPassword(token: string, password: string): Promise<{ ok: true } | { error: string }> {
  try {
    const csrf = getCsrfToken();
    const res = await fetch(`${BASE}/api/auth/reset-password`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRF-Token': csrf } : {}) },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json() as { ok?: boolean; message?: string; error?: string };
    if (!res.ok) return { error: data.message ?? data.error ?? 'Password reset failed' };
    return { ok: true };
  } catch {
    return { error: 'Network error — could not reach the server' };
  }
}

export async function logout(): Promise<void> {
  try {
    const csrf = getCsrfToken();
    await fetch(`${BASE}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: csrf ? { 'X-CSRF-Token': csrf } : {},
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
