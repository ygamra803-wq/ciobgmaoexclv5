import { describe, it, expect, beforeEach } from 'vitest';
import {
  SHELL_OVERRIDE_STORAGE_KEY,
  parseShellQueryParam,
  detectAutoShell,
  resolveShellPolicy,
  setShellMode,
  clearShellOverride,
} from '../../core/shell/shellPolicy';
import { STORAGE_KEYS } from '../../infrastructure/persistence/storageKeys';

describe('ShellPolicy Engine (Single Source of Truth for Desktop vs Mobile Shell)', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear();
    }
    if (typeof window !== 'undefined' && window.history?.replaceState) {
      window.history.replaceState({}, '', '/');
    }
  });

  it('parses ?shell=mobile|desktop|auto query parameters accurately and ignores invalid values', () => {
    expect(parseShellQueryParam('?shell=mobile')).toBe('mobile');
    expect(parseShellQueryParam('?shell=desktop')).toBe('desktop');
    expect(parseShellQueryParam('?shell=AUTO')).toBe('auto');
    expect(parseShellQueryParam('?foo=1&shell=mobile&bar=2')).toBe('mobile');
    expect(parseShellQueryParam('?shell=tablet')).toBeNull();
    expect(parseShellQueryParam('')).toBeNull();
  });

  it('auto-detects mobile vs desktop from viewport width and pointer/touch capabilities', () => {
    // 1. Smartphone (narrow + coarse pointer + touch)
    expect(
      detectAutoShell({ innerWidth: 390, pointerCoarse: true, maxTouchPoints: 5 })
    ).toBe('mobile');

    // 2. Narrow responsive viewport (< 768px even with mouse in DevTools)
    expect(
      detectAutoShell({ innerWidth: 500, pointerCoarse: false, maxTouchPoints: 0 })
    ).toBe('mobile');

    // 3. Industrial touch tablet (width 900 < 1024 + coarse pointer)
    expect(
      detectAutoShell({ innerWidth: 900, pointerCoarse: true, maxTouchPoints: 5 })
    ).toBe('mobile');

    // 4. Compact desktop window (width 960 < 1024, fine pointer, 0 touch points) -> stays desktop
    expect(
      detectAutoShell({ innerWidth: 960, pointerCoarse: false, maxTouchPoints: 0 })
    ).toBe('desktop');

    // 5. Standard Desktop PC (1440px, fine pointer)
    expect(
      detectAutoShell({ innerWidth: 1440, pointerCoarse: false, maxTouchPoints: 0 })
    ).toBe('desktop');
  });

  it('enforces strict override precedence: ?shell query > localStorage > auto detection', () => {
    const mockStorage = new Map<string, string>();
    const storageAdapter = {
      getItem: (k: string) => mockStorage.get(k) ?? null,
    };

    // Case A: localStorage forces 'desktop' on a narrow phone viewport
    mockStorage.set(SHELL_OVERRIDE_STORAGE_KEY, 'desktop');
    const forcedDesktop = resolveShellPolicy({
      search: '',
      storage: storageAdapter,
      env: { innerWidth: 375, pointerCoarse: true, maxTouchPoints: 5 },
    });
    expect(forcedDesktop.mode).toBe('desktop');
    expect(forcedDesktop.resolved).toBe('desktop');
    expect(forcedDesktop.source).toBe('storage');

    // Case B: URL ?shell=mobile overrides localStorage 'desktop' even on a 1920px desktop monitor
    const urlForcesMobile = resolveShellPolicy({
      search: '?shell=mobile',
      storage: storageAdapter,
      env: { innerWidth: 1920, pointerCoarse: false, maxTouchPoints: 0 },
    });
    expect(urlForcesMobile.mode).toBe('mobile');
    expect(urlForcesMobile.resolved).toBe('mobile');
    expect(urlForcesMobile.source).toBe('query');

    // Case C: URL ?shell=desktop overrides localStorage 'mobile' on a 375px phone
    mockStorage.set(SHELL_OVERRIDE_STORAGE_KEY, 'mobile');
    const urlForcesDesktop = resolveShellPolicy({
      search: '?shell=desktop',
      storage: storageAdapter,
      env: { innerWidth: 375, pointerCoarse: true, maxTouchPoints: 5 },
    });
    expect(urlForcesDesktop.mode).toBe('desktop');
    expect(urlForcesDesktop.resolved).toBe('desktop');
    expect(urlForcesDesktop.source).toBe('query');
  });

  it('persists manual mode via setShellMode and resets via clearShellOverride', () => {
    const stateMobile = setShellMode('mobile');
    expect(stateMobile.mode).toBe('mobile');
    expect(stateMobile.resolved).toBe('mobile');
    expect(window.localStorage.getItem(SHELL_OVERRIDE_STORAGE_KEY)).toBe('mobile');
    expect(window.localStorage.getItem(STORAGE_KEYS.DEVICE_MODE)).toBe('mobile');

    const stateDesktop = setShellMode('desktop');
    expect(stateDesktop.mode).toBe('desktop');
    expect(stateDesktop.resolved).toBe('desktop');
    expect(window.localStorage.getItem(SHELL_OVERRIDE_STORAGE_KEY)).toBe('desktop');

    const cleared = clearShellOverride();
    expect(cleared.mode).toBe('auto');
    expect(window.localStorage.getItem(SHELL_OVERRIDE_STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem(STORAGE_KEYS.DEVICE_MODE)).toBe('auto');
  });
});
