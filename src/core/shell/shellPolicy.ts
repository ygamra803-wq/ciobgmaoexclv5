import { useState, useEffect, useCallback } from 'react';
import { STORAGE_KEYS } from '../../infrastructure/persistence/storageKeys';

export const SHELL_OVERRIDE_STORAGE_KEY = 'gmao_shell_override';
export const SHELL_POLICY_CHANGED_EVENT = 'gmao_shell_policy_changed';

export type ShellMode = 'auto' | 'desktop' | 'mobile';
export type ResolvedShell = 'desktop' | 'mobile';
export type ShellOverrideSource = 'query' | 'storage' | 'default';

export interface ShellEnvironmentSnapshot {
  innerWidth: number;
  pointerCoarse: boolean;
  maxTouchPoints: number;
}

export interface ShellPolicyState {
  mode: ShellMode;
  resolved: ResolvedShell;
  source: ShellOverrideSource;
}

export function isValidShellMode(value: unknown): value is ShellMode {
  return value === 'auto' || value === 'desktop' || value === 'mobile';
}

/**
 * 1) Parse ?shell=mobile | ?shell=desktop | ?shell=auto from URL query string
 */
export function parseShellQueryParam(search?: string): ShellMode | null {
  const rawSearch =
    typeof search === 'string'
      ? search
      : typeof window !== 'undefined' && window.location
      ? window.location.search
      : '';

  if (!rawSearch) return null;
  try {
    const params = new URLSearchParams(rawSearch.startsWith('?') ? rawSearch : `?${rawSearch}`);
    const val = params.get('shell')?.trim().toLowerCase();
    if (isValidShellMode(val)) {
      return val;
    }
  } catch {
    // ignore malformed query strings
  }
  return null;
}

/**
 * 2) Read persisted override from localStorage ('gmao_shell_override', fallback to canonical DEVICE_MODE)
 */
export function readShellOverrideFromStorage(
  storage?: Pick<Storage, 'getItem'> | null
): ShellMode | null {
  const targetStorage =
    storage !== undefined
      ? storage
      : typeof window !== 'undefined' && window.localStorage
      ? window.localStorage
      : null;

  if (!targetStorage) return null;

  try {
    const rawPrimary = targetStorage.getItem(SHELL_OVERRIDE_STORAGE_KEY)?.trim().toLowerCase();
    if (isValidShellMode(rawPrimary)) {
      return rawPrimary;
    }
    const rawLegacy = targetStorage.getItem(STORAGE_KEYS.DEVICE_MODE)?.trim().toLowerCase();
    if (isValidShellMode(rawLegacy)) {
      return rawLegacy;
    }
  } catch {
    // ignore storage errors
  }
  return null;
}

/**
 * Capture current browser viewport & pointer capabilities without relying on User-Agent alone.
 */
export function getBrowserShellEnvironment(): ShellEnvironmentSnapshot {
  if (typeof window === 'undefined') {
    return {
      innerWidth: 1440,
      pointerCoarse: false,
      maxTouchPoints: 0,
    };
  }

  let pointerCoarse = false;
  try {
    if (typeof window.matchMedia === 'function') {
      pointerCoarse = window.matchMedia('(pointer: coarse)').matches;
    }
  } catch {
    pointerCoarse = false;
  }

  const maxTouchPoints =
    typeof navigator !== 'undefined' && typeof navigator.maxTouchPoints === 'number'
      ? navigator.maxTouchPoints
      : 0;

  return {
    innerWidth: typeof window.innerWidth === 'number' ? window.innerWidth : 1440,
    pointerCoarse,
    maxTouchPoints,
  };
}

/**
 * Deterministic auto-resolution from viewport + input pointer fidelity:
 * - Narrow phone/responsive viewport (< 768px) -> 'mobile'
 * - Touch/coarse tablet or field terminal (< 1024px with coarse pointer or touch points) -> 'mobile'
 * - Fine pointer + wide viewport -> 'desktop'
 */
export function detectAutoShell(env?: Partial<ShellEnvironmentSnapshot>): ResolvedShell {
  const snapshot: ShellEnvironmentSnapshot = {
    ...getBrowserShellEnvironment(),
    ...(env || {}),
  };

  const isNarrowPhone = snapshot.innerWidth < 768;
  const isTouchTabletOrHandheld =
    snapshot.innerWidth < 1024 && (snapshot.pointerCoarse || snapshot.maxTouchPoints > 0);

  if (isNarrowPhone || isTouchTabletOrHandheld) {
    return 'mobile';
  }
  return 'desktop';
}

/**
 * Resolve effective ShellPolicy with strict precedence:
 * a) URL query string (?shell=mobile|desktop|auto)
 * b) localStorage ('gmao_shell_override')
 * c) Default ('auto')
 */
export function resolveShellPolicy(options?: {
  search?: string;
  storage?: Pick<Storage, 'getItem'> | null;
  env?: Partial<ShellEnvironmentSnapshot>;
}): ShellPolicyState {
  const queryMode = parseShellQueryParam(options?.search);
  if (queryMode) {
    return {
      mode: queryMode,
      resolved: queryMode === 'auto' ? detectAutoShell(options?.env) : queryMode,
      source: 'query',
    };
  }

  const storageMode = readShellOverrideFromStorage(options?.storage);
  if (storageMode) {
    return {
      mode: storageMode,
      resolved: storageMode === 'auto' ? detectAutoShell(options?.env) : storageMode,
      source: 'storage',
    };
  }

  return {
    mode: 'auto',
    resolved: detectAutoShell(options?.env),
    source: 'default',
  };
}

function cleanUrlShellQueryParamIfPresent(): void {
  if (typeof window === 'undefined' || !window.location || !window.history?.replaceState) return;
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has('shell')) {
      url.searchParams.delete('shell');
      const nextUrl = `${url.pathname}${url.search}${url.hash}`;
      window.history.replaceState({}, '', nextUrl);
    }
  } catch {
    // ignore URL errors in test environments
  }
}

function notifyShellPolicyChanged(state: ShellPolicyState): void {
  if (typeof window === 'undefined') return;
  try {
    document.documentElement?.setAttribute('data-device-mode', state.mode);
    document.documentElement?.setAttribute('data-resolved-shell', state.resolved);
  } catch {
    // ignore DOM attribute errors
  }

  window.dispatchEvent(
    new CustomEvent(SHELL_POLICY_CHANGED_EVENT, {
      detail: state,
    })
  );

  window.dispatchEvent(
    new CustomEvent('gmao_appearance_changed', {
      detail: {
        deviceMode: state.mode,
      },
    })
  );
}

/**
 * Persist manual shell mode ('auto' | 'desktop' | 'mobile') in localStorage
 * and notify all mounted listeners immediately.
 */
export function setShellMode(mode: ShellMode): ShellPolicyState {
  const validMode: ShellMode = isValidShellMode(mode) ? mode : 'auto';
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(SHELL_OVERRIDE_STORAGE_KEY, validMode);
      window.localStorage.setItem(STORAGE_KEYS.DEVICE_MODE, validMode);
    } catch {
      // ignore quota errors
    }
  }

  // If the URL had a conflicting ?shell= query param, clean it so manual button takes immediate effect
  cleanUrlShellQueryParamIfPresent();

  const nextState = resolveShellPolicy();
  notifyShellPolicyChanged(nextState);
  return nextState;
}

/**
 * Clear manual shell override back to 'auto' and strip ?shell= from URL.
 */
export function clearShellOverride(): ShellPolicyState {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(SHELL_OVERRIDE_STORAGE_KEY);
      window.localStorage.setItem(STORAGE_KEYS.DEVICE_MODE, 'auto');
    } catch {
      // ignore storage errors
    }
  }

  cleanUrlShellQueryParamIfPresent();

  const nextState = resolveShellPolicy();
  notifyShellPolicyChanged(nextState);
  return nextState;
}

/**
 * React Hook: useAppShell()
 * Single Source of Truth for App Shell decision ('desktop' vs 'mobile').
 */
export function useAppShell() {
  const [policy, setPolicy] = useState<ShellPolicyState>(() => resolveShellPolicy());

  const refreshPolicy = useCallback(() => {
    setPolicy((prev) => {
      const next = resolveShellPolicy();
      if (
        prev.mode === next.mode &&
        prev.resolved === next.resolved &&
        prev.source === next.source
      ) {
        return prev;
      }
      return next;
    });
  }, []);

  useEffect(() => {
    refreshPolicy();

    const handleResize = () => {
      refreshPolicy();
    };

    const handleShellChanged = () => {
      refreshPolicy();
    };

    const handleAppearanceChanged = (e: Event) => {
      const customEvent = e as CustomEvent;
      const incomingMode = customEvent?.detail?.deviceMode;
      if (isValidShellMode(incomingMode)) {
        try {
          window.localStorage.setItem(SHELL_OVERRIDE_STORAGE_KEY, incomingMode);
        } catch {
          // ignore
        }
      }
      refreshPolicy();
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('popstate', handleResize);
    window.addEventListener(SHELL_POLICY_CHANGED_EVENT, handleShellChanged);
    window.addEventListener('gmao_appearance_changed', handleAppearanceChanged);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('popstate', handleResize);
      window.removeEventListener(SHELL_POLICY_CHANGED_EVENT, handleShellChanged);
      window.removeEventListener('gmao_appearance_changed', handleAppearanceChanged);
    };
  }, [refreshPolicy]);

  const setMode = useCallback((nextMode: ShellMode) => {
    const nextState = setShellMode(nextMode);
    setPolicy(nextState);
  }, []);

  const clearOverride = useCallback(() => {
    const nextState = clearShellOverride();
    setPolicy(nextState);
  }, []);

  return {
    mode: policy.mode,
    resolved: policy.resolved,
    source: policy.source,
    setMode,
    clearOverride,
  };
}
