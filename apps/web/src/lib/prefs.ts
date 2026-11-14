// Safe wrappers: storage can throw (private mode, blocked cookies) or be absent (SSR), so every call falls back.
export function readPref<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writePref(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: the preference lasts for this page view only */
  }
}

export function writeCookie(name: string, value: string, days = 365): void {
  try {
    document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${days * 86400}; samesite=lax`;
  } catch {
    /* cookies blocked */
  }
}
