import {
  createElement,
  lazy,
  useEffect,
  useState,
  type ComponentType,
  type LazyExoticComponent,
  type ReactNode,
} from 'react';

const RELOAD_COOLDOWN_MS = 15_000;
const RETRY_DELAYS_MS = [300, 800];

function isDynamicImportError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? `${error.name} ${error.message}`
      : String(error || '');
  return (
    /Failed to fetch dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message) ||
    /error loading dynamically imported module/i.test(message) ||
    /Loading chunk [\w-]+ failed/i.test(message) ||
    /Loading CSS chunk [\w-]+ failed/i.test(message) ||
    /Unable to preload CSS/i.test(message)
  );
}

async function clearStaleCachesForRetry(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    if ('caches' in window && window.caches) {
      const keys = await window.caches.keys();
      await Promise.all((keys || []).map((k) => window.caches.delete(k).catch(() => false)));
    }
    if ('serviceWorker' in navigator && navigator.serviceWorker) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all((regs || []).map((r) => r.unregister().catch(() => false)));
    }
  } catch {
    // Ignore restricted cache/serviceWorker access inside sandboxed iframes
  }
}

function trySingleReloadRecovery(moduleKey: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const storageKey = `gmao_chunk_reload:${moduleKey}`;
    const lastReloadRaw = window.sessionStorage.getItem(storageKey);
    const now = Date.now();
    const lastReloadAt = lastReloadRaw ? Number(lastReloadRaw) : 0;

    if (!Number.isFinite(lastReloadAt) || now - lastReloadAt > RELOAD_COOLDOWN_MS) {
      window.sessionStorage.setItem(storageKey, String(now));
      window.location.reload();
      return true;
    }
  } catch {
    // Ignore sessionStorage restrictions
  }
  return false;
}

export async function importWithRetry<T>(
  factory: () => Promise<T>,
  moduleKey: string
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      return await factory();
    } catch (error) {
      lastError = error;
      if (!isDynamicImportError(error)) {
        throw error;
      }

      if (attempt < RETRY_DELAYS_MS.length) {
        await clearStaleCachesForRetry();
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
      }
    }
  }

  // If Vite dev server restarted or a new deploy invalidated chunk hashes while tab was idle,
  // perform a single guarded page reload to synchronize index.html and ?v= dependency hashes.
  if (trySingleReloadRecovery(moduleKey)) {
    return new Promise<T>(() => {
      // Keep fallback visible while the browser navigates on reload
    });
  }

  throw lastError;
}

export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  moduleKey: string
): LazyExoticComponent<T> {
  return lazy(() => importWithRetry(factory, moduleKey));
}

export interface RetryableLazyShellProps {
  retryNonce?: number;
  fallback?: ReactNode;
}

/**
 * Module-level retryable dynamic loader component.
 * Unlike React.lazy (which permanently caches a rejected Promise), incrementing `retryNonce`
 * triggers a fresh `importWithRetry` attempt when ErrorBoundary resets.
 */
export function createRetryableLazy<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  moduleKey: string
): ComponentType<RetryableLazyShellProps> {
  return function RetryableLazyComponent({
    retryNonce = 0,
    fallback = null,
  }: RetryableLazyShellProps) {
    const [loaded, setLoaded] = useState<{ Component: T | null; error: unknown }>({
      Component: null,
      error: null,
    });

    useEffect(() => {
      let active = true;

      importWithRetry(factory, moduleKey)
        .then((mod) => {
          if (!active) return;
          setLoaded({ Component: mod.default, error: null });
        })
        .catch((err) => {
          if (!active) return;
          setLoaded({ Component: null, error: err });
        });

      return () => {
        active = false;
      };
    }, [retryNonce]);

    if (loaded.error) {
      throw loaded.error;
    }

    if (!loaded.Component) {
      return createElement('div', { className: 'contents' }, fallback);
    }

    return createElement(loaded.Component);
  };
}
