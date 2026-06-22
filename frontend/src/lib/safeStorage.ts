function isAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const k = '__mo_test__';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

export const safeStorage = {
  get(key: string): string | null {
    if (!isAvailable()) return null;
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },

  set(key: string, value: string): boolean {
    if (!isAvailable()) return false;
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  },

  remove(key: string): boolean {
    if (!isAvailable()) return false;
    try {
      window.localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  },

  getJSON<T>(key: string): T | null {
    const raw = this.get(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },

  setJSON<T>(key: string, value: T): boolean {
    try {
      return this.set(key, JSON.stringify(value));
    } catch {
      return false;
    }
  },
};
