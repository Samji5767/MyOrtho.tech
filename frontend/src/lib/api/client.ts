const BASE =
  typeof process !== 'undefined'
    ? (process.env.NEXT_PUBLIC_API_URL ?? '')
    : '';

const DEFAULT_TIMEOUT_MS = 30_000;
const CSRF_COOKIE = 'XSRF-TOKEN';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Read the CSRF token set by the backend (HttpOnly=false). */
function getCsrfToken(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${CSRF_COOKIE}=`));
  return match ? match.substring(CSRF_COOKIE.length + 1) : undefined;
}

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

async function request<T>(
  path: string,
  init?: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const method = (init?.method ?? 'GET').toUpperCase();
  const csrfHeaders: Record<string, string> = {};
  if (MUTATING_METHODS.has(method)) {
    const token = getCsrfToken();
    if (token) {
      csrfHeaders['X-CSRF-Token'] = token;
    }
  }

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      signal: controller.signal,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...csrfHeaders,
        ...(init?.headers ?? {}),
      },
    });
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError(408, 'Request timed out');
    }
    throw new ApiError(0, err instanceof Error ? err.message : 'Network error');
  }
  clearTimeout(timer);

  if (!res.ok) {
    // Redirect to login on auth failures (browser context only)
    if ((res.status === 401 || res.status === 403) && typeof window !== 'undefined') {
      const current = window.location.pathname + window.location.search;
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = `/login?next=${encodeURIComponent(current)}`;
      }
    }
    let msg = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) {
        msg = Array.isArray(body.message)
          ? body.message.join('; ')
          : String(body.message);
      }
    } catch { /* body may not be JSON */ }
    throw new ApiError(res.status, msg);
  }

  const text = await res.text();
  if (!text) return undefined as unknown as T;
  return JSON.parse(text) as T;
}

export const api = {
  get:    <T>(path: string, timeout?: number)               => request<T>(path, undefined, timeout),
  post:   <T>(path: string, body: object, timeout?: number) => request<T>(path, { method: 'POST',   body: JSON.stringify(body) }, timeout),
  put:    <T>(path: string, body: object, timeout?: number) => request<T>(path, { method: 'PUT',    body: JSON.stringify(body) }, timeout),
  patch:  <T>(path: string, body: object, timeout?: number) => request<T>(path, { method: 'PATCH',  body: JSON.stringify(body) }, timeout),
  delete: <T>(path: string, timeout?: number)               => request<T>(path, { method: 'DELETE' }, timeout),
};

/**
 * Ensure the XSRF-TOKEN cookie is set before a mutating request.
 * A GET to /api/health prompts the CSRF middleware to set the cookie when absent.
 * Without this, the first upload after a cold page load sends no CSRF header,
 * the backend returns 403 while the browser is still streaming the large body,
 * and HTTP/2 resets the stream — Safari reports this as "Load failed".
 */
async function ensureCsrfToken(): Promise<string | undefined> {
  if (typeof document === 'undefined') return undefined;
  const existing = getCsrfToken();
  if (existing) return existing;
  try {
    await fetch(`${BASE}/api/health`, { credentials: 'include' });
  } catch { /* proceed; server will re-seed the cookie on the next response */ }
  return getCsrfToken();
}

/** Multipart file upload — does NOT set Content-Type (browser sets boundary automatically). */
export async function uploadFile<T>(path: string, form: FormData, timeoutMs = 600_000): Promise<T> {
  // Initialise the CSRF cookie before sending a large body. If the cookie is absent
  // the backend would reject mid-stream, causing an HTTP/2 RST that Safari reports as
  // "Load failed" instead of a normal HTTP 403 error response.
  const csrfToken = await ensureCsrfToken();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      credentials: 'include',
      signal: controller.signal,
      headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : {},
      body: form,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError(408, 'Upload timed out');
    }
    throw new ApiError(0, 'Connection error — check your network and try again');
  }
  clearTimeout(timer);

  if (!res.ok) {
    let msg: string;
    if (res.status === 403) {
      msg = 'Session expired — please refresh the page and try again';
    } else if (res.status === 413) {
      msg = 'File is too large — maximum upload size is 500 MB';
    } else {
      msg = `HTTP ${res.status}`;
      try {
        const text = await res.text();
        if (text) {
          try {
            const body = JSON.parse(text) as { message?: string };
            if (body.message) msg = Array.isArray(body.message) ? body.message.join('; ') : String(body.message);
          } catch {
            msg = `HTTP ${res.status}: ${text.slice(0, 200)}`;
          }
        }
      } catch { /* swallow */ }
    }
    throw new ApiError(res.status, msg);
  }
  return res.json() as Promise<T>;
}
