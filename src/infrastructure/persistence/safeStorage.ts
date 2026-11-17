/**
 * Safe Web Storage accessor helpers.
 * Cross-origin sandboxed iframes (e.g. strict third-party cookie/storage policies)
 * throw `DOMException: SecurityError: Access is denied` on the mere evaluation of
 * `window.localStorage` or `window.sessionStorage` (even `typeof localStorage`).
 * Always resolve storage handles through these try/catch helpers.
 */

export function getSafeLocalStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    const ls = window.localStorage;
    return ls ?? null;
  } catch {
    return null;
  }
}

export function getSafeSessionStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    const ss = window.sessionStorage;
    return ss ?? null;
  } catch {
    return null;
  }
}

export function safeLocalGet(key: string): string | null {
  try {
    const ls = getSafeLocalStorage();
    return ls ? ls.getItem(key) : null;
  } catch {
    return null;
  }
}

export function safeLocalSet(key: string, value: string): boolean {
  try {
    const ls = getSafeLocalStorage();
    if (!ls) return false;
    ls.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function safeLocalRemove(key: string): boolean {
  try {
    const ls = getSafeLocalStorage();
    if (!ls) return false;
    ls.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function safeSessionGet(key: string): string | null {
  try {
    const ss = getSafeSessionStorage();
    return ss ? ss.getItem(key) : null;
  } catch {
    return null;
  }
}

export function safeSessionSet(key: string, value: string): boolean {
  try {
    const ss = getSafeSessionStorage();
    if (!ss) return false;
    ss.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function safeSessionRemove(key: string): boolean {
  try {
    const ss = getSafeSessionStorage();
    if (!ss) return false;
    ss.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
