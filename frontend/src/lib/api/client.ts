const BASE =
  typeof process !== 'undefined'
    ? (process.env.NEXT_PUBLIC_API_URL ?? '')
    : '';

const DEFAULT_TIMEOUT_MS = 30_000;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  init?: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      signal: controller.signal,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
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

/** Multipart file upload — does NOT set Content-Type (browser sets boundary automatically). */
export async function uploadFile<T>(path: string, form: FormData, timeoutMs = 600_000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      credentials: 'include',
      signal: controller.signal,
      body: form,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError(408, 'Upload timed out');
    }
    throw new ApiError(0, err instanceof Error ? err.message : 'Network error');
  }
  clearTimeout(timer);

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
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
    throw new ApiError(res.status, msg);
  }
  return res.json() as Promise<T>;
}
