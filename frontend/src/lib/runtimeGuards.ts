export function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

export function safeQueryParam(search: string, key: string): string | null {
  try {
    if (!isBrowser()) return null;
    return new URLSearchParams(search).get(key);
  } catch {
    return null;
  }
}

export function safeParseJSON<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== 'string') return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function safeString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

export function safeNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export async function safeAsync<T>(
  fn: () => Promise<T>,
  fallback: T
): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}
