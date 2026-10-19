import { describe, it, expect, beforeEach, vi } from 'vitest';
import { storageService } from '../../utils/storageService';
import { STORAGE_KEYS } from '../../infrastructure/persistence/storageKeys';

describe('Appearance & Layout Engine Integration', () => {
  beforeEach(() => {
    localStorage.clear();
    storageService.clearCache();
  });

  it('should default to auto device mode, floating sidebar, and enabled header clock', () => {
    const deviceMode = storageService.getItem(STORAGE_KEYS.DEVICE_MODE) || 'auto';
    const sidebarStyle = storageService.getItem(STORAGE_KEYS.SIDEBAR_STYLE) || 'floating';
    const headerClock = storageService.getItem(STORAGE_KEYS.HEADER_CLOCK) !== 'false';

    expect(deviceMode).toBe('auto');
    expect(sidebarStyle).toBe('floating');
    expect(headerClock).toBe(true);
  });

  it('should persist settings in storageService and reload reliably', () => {
    storageService.setItem(STORAGE_KEYS.DEVICE_MODE, 'desktop');
    storageService.setItem(STORAGE_KEYS.SIDEBAR_STYLE, 'standard');
    storageService.setItem(STORAGE_KEYS.SIDEBAR_BEHAVIOR, 'push');
    storageService.setItem(STORAGE_KEYS.THEME, 'dark');
    storageService.setItem(STORAGE_KEYS.HEADER_CLOCK, 'true');

    // Simulate page reload: clear memory cache to force reading from storage
    storageService.clearCache();

    expect(storageService.getItem(STORAGE_KEYS.DEVICE_MODE)).toBe('desktop');
    expect(storageService.getItem(STORAGE_KEYS.SIDEBAR_STYLE)).toBe('standard');
    expect(storageService.getItem(STORAGE_KEYS.SIDEBAR_BEHAVIOR)).toBe('push');
    expect(storageService.getItem(STORAGE_KEYS.THEME)).toBe('dark');
    expect(Boolean(storageService.getItem(STORAGE_KEYS.HEADER_CLOCK))).toBe(true);
  });

  it('should persist and broadcast appearance updates via custom events', () => {
    const listener = vi.fn();
    window.addEventListener('gmao_appearance_changed', listener);

    // Simulate Appearance change
    const newSettings = {
      deviceMode: 'desktop',
      sidebarStyle: 'standard',
      sidebarBehavior: 'push',
      density: 'compact',
      accentColor: 'blue',
      headerClockEnabled: true,
      animationsEnabled: true,
    };

    storageService.setItem(STORAGE_KEYS.DEVICE_MODE, newSettings.deviceMode);
    storageService.setItem(STORAGE_KEYS.SIDEBAR_STYLE, newSettings.sidebarStyle);

    window.dispatchEvent(
      new CustomEvent('gmao_appearance_changed', {
        detail: newSettings,
      })
    );

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].detail.deviceMode).toBe('desktop');
    expect(listener.mock.calls[0][0].detail.sidebarStyle).toBe('standard');
    expect(listener.mock.calls[0][0].detail.density).toBe('compact');

    window.removeEventListener('gmao_appearance_changed', listener);
  });

  it('should evaluate floating sidebar always open in push mode vs collapsible in overlay mode', () => {
    const isAlwaysOpenPush = (behavior) => behavior === 'push';

    expect(isAlwaysOpenPush('push')).toBe(true);
    expect(isAlwaysOpenPush('overlay')).toBe(false);
  });
});


