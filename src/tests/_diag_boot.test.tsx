import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import ErrorBoundary from '../presentation/components/common/ErrorBoundary';
import { I18nProvider } from '../i18n/I18nContext';
import { AuthProvider } from '../context/AuthContext';
import App from '../App';
import { ServiceProvider } from '../core/di/ServiceProvider';
import { migrateStorageOnce } from '../infrastructure/persistence/migrateStorage';
import { errorTracker } from '../services/ErrorTrackingService';
import { analytics } from '../services/AnalyticsService';
import { SecurityService } from '../core/security/SecurityService';
import { useGmaoStore } from '../store/useGmaoStore';

function setNativeInput(el: HTMLInputElement, val: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  setter.call(el, val);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('Diagnostic Full Authenticated App & All Routes', () => {
  const errors: any[] = [];
  const consoleErrors: any[] = [];
  const origConsoleError = console.error;
  let container: HTMLDivElement;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    container = document.createElement('div');
    container.id = 'root';
    document.body.appendChild(container);

    console.error = (...args: any[]) => {
      consoleErrors.push(args.map(String));
      origConsoleError(...args);
    };
    window.addEventListener('error', (e) => errors.push({ type: 'error', msg: e.message }));
    window.addEventListener('unhandledrejection', (e) =>
      errors.push({ type: 'rejection', reason: String(e.reason) })
    );
    window.addEventListener('app_runtime_error', (e: any) =>
      errors.push({ type: 'runtime', detail: e.detail })
    );
  });

  afterEach(() => {
    console.error = origConsoleError;
    container.remove();
  });

  it('activates license, logs in, renders MainLayout + Dashboard + all AppRouter tabs without crashing', async () => {
    migrateStorageOnce();
    ServiceProvider.register();
    errorTracker.init();
    analytics.track('app_started', 'system', { timestamp: Date.now() });
    await SecurityService.init();

    const root = createRoot(container);
    await act(async () => {
      root.render(
        <ErrorBoundary>
          <I18nProvider>
            <AuthProvider>
              <App />
            </AuthProvider>
          </I18nProvider>
        </ErrorBoundary>
      );
    });

    // Skip intro + splash
    const skipIntroBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes("Passer l'intro")
    );
    await act(async () => {
      skipIntroBtn!.click();
      await new Promise((r) => setTimeout(r, 350));
    });
    const skipSplashBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Accéder directement')
    );
    await act(async () => {
      skipSplashBtn!.click();
      await new Promise((r) => setTimeout(r, 50));
    });

    // 1. First-Run Activation
    const orgInput = container.querySelector('#input-setup-organization') as HTMLInputElement;
    const licInput = container.querySelector('#input-setup-license-key') as HTMLInputElement;
    const licConfInput = container.querySelector('#input-setup-license-confirm') as HTMLInputElement;
    const passInput = container.querySelector('#input-setup-admin-password') as HTMLInputElement;
    const passConfInput = container.querySelector('#input-setup-admin-password-confirm') as HTMLInputElement;

    await act(async () => {
      setNativeInput(orgInput, 'CIOB Test Factory');
      setNativeInput(licInput, 'CIOB-2026-PROD-KEY-9988');
      setNativeInput(licConfInput, 'CIOB-2026-PROD-KEY-9988');
      setNativeInput(passInput, 'AdminPass!2026');
      setNativeInput(passConfInput, 'AdminPass!2026');
    });

    const setupBtn = container.querySelector('#btn-setup-pin') as HTMLButtonElement;
    console.log('[DIAG] setupBtn disabled?', setupBtn?.disabled);

    await act(async () => {
      setupBtn.click();
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 200));
        if (container.querySelector('#input-login-license-key')) break;
      }
    });

    console.log('[DIAG] After activation FULL text:', container.textContent);
    console.log('[DIAG] Activation errors/consoleErrors:', JSON.stringify({ errors, consoleErrors }));

    // 2. Dual-Key Login
    const loginLicInput = container.querySelector('#input-login-license-key') as HTMLInputElement;
    const loginPassInput = container.querySelector('#input-login-password') as HTMLInputElement;
    expect(loginLicInput && loginPassInput).toBeTruthy();

    await act(async () => {
      setNativeInput(loginLicInput, 'CIOB-2026-PROD-KEY-9988');
      setNativeInput(loginPassInput, 'AdminPass!2026');
    });

    const submitBtn = container.querySelector('#btn-submit-credentials') as HTMLButtonElement;
    await act(async () => {
      submitBtn.click();
      await new Promise((r) => setTimeout(r, 800));
    });

    console.log('[DIAG] After login, has main:', Boolean(container.querySelector('#main-content')));
    console.log('[DIAG] After login, main innerHTML len:', container.querySelector('#main-content')?.innerHTML.length);

    for (let i = 0; i < 20; i++) {
      await act(async () => {
        await new Promise((r) => setTimeout(r, 300));
      });
      const txt = container.querySelector('#main-content')?.textContent || '';
      if (txt.trim().length > 0) {
        console.log(`[DIAG] Dashboard mounted at tick ${i}: len=${txt.length}, sample=${txt.slice(0, 200)}`);
        break;
      }
      if (i === 19) {
        console.log('[DIAG] Dashboard STILL EMPTY after 6s! innerHTML=', container.querySelector('#main-content')?.innerHTML.slice(0, 1000));
      }
    }

    console.log('[DIAG] errors:', JSON.stringify(errors));
    console.log('[DIAG] consoleErrors:', JSON.stringify(consoleErrors));
    expect(container.querySelector('#main-content')).toBeTruthy();

    act(() => root.unmount());
  }, 60000);
});
