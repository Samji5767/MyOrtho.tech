const BASE = '';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) msg = body.message;
    } catch { /* swallow */ }
    throw new ApiError(res.status, msg);
  }

  return res.json() as Promise<T>;
}

export const api = {
  get:    <T>(path: string)               => request<T>(path),
  post:   <T>(path: string, body: object) => request<T>(path, { method: 'POST',   body: JSON.stringify(body) }),
  put:    <T>(path: string, body: object) => request<T>(path, { method: 'PUT',    body: JSON.stringify(body) }),
  patch:  <T>(path: string, body: object) => request<T>(path, { method: 'PATCH',  body: JSON.stringify(body) }),
  delete: <T>(path: string)               => request<T>(path, { method: 'DELETE' }),
};

/** Multipart file upload — does NOT set Content-Type (browser sets boundary automatically). */
export async function uploadFile<T>(path: string, form: FormData): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    credentials: 'include',
    body: form,
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) msg = body.message;
    } catch { /* swallow */ }
    throw new ApiError(res.status, msg);
  }
  return res.json() as Promise<T>;
}
