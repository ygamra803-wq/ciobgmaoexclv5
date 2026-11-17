import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import ErrorBoundary from './presentation/components/common/ErrorBoundary';
import { storageService } from './utils/storageService';
import { AuthProvider } from './context/AuthContext';
import { I18nProvider } from './i18n/I18nContext';
import { ServiceProvider } from './core/di/ServiceProvider';
import { Logger } from './core/logger/LoggerService';
import { errorTracker } from './services/ErrorTrackingService';
import { analytics } from './services/AnalyticsService';
import { migrateStorageOnce } from './infrastructure/persistence/migrateStorage';
import { vaultService } from './utils/vaultService';
import { STORAGE_KEYS } from './infrastructure/persistence/storageKeys';
import { SecurityService } from './core/security/SecurityService';

// Ensure visual attributes are initialized on root DOM element without crashing on restricted iframes
try {
  const initialAccent = storageService.getItem(STORAGE_KEYS.ACCENT_COLOR) || 'emerald';
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-accent', initialAccent);
  }
} catch (err) {
  Logger.warn('[Boot] Accent init skipped:', err, 'main');
}

// 1. Run one-time SSOT storage migration before any hook reads storage
try {
  migrateStorageOnce();
} catch (err) {
  Logger.warn('[Boot] Storage migration skipped:', err, 'main');
}

// Initialize Enterprise Architecture DI Container and Error / Analytics Tracking
try {
  ServiceProvider.register();
  errorTracker.init();
} catch (err) {
  Logger.warn('[Boot] ServiceProvider/errorTracker init notice:', err, 'main');
}

let hasRendered = false;
const renderApp = () => {
  if (hasRendered) return;
  hasRendered = true;

  try {
    analytics.track('app_started', 'system', { timestamp: Date.now() });
  } catch {
    // Non-blocking telemetry failure must never prevent UI mount
  }

  const rootElement = typeof document !== 'undefined' ? document.getElementById('root') : null;
  if (!rootElement) return;

  try {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <ErrorBoundary>
        <I18nProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </I18nProvider>
      </ErrorBoundary>
    );
  } catch (err) {
    Logger.error('[Boot] Critical React mount failure:', err, 'main');
    rootElement.innerHTML =
      '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0f172a;color:#f8fafc;font-family:sans-serif;padding:24px;text-align:center;"><div><h1 style="font-size:20px;font-weight:700;margin-bottom:8px;">CIOB GMAO Nexus</h1><p style="font-size:14px;color:#cbd5e1;">Erreur d’initialisation détectée. Veuillez recharger la page (Ctrl+Shift+R).</p></div></div>';
  }
};

// Fallback timer guarantees the UI mounts even if IndexedDB is blocked in a sandboxed iframe
const initFallbackTimer = setTimeout(renderApp, 500);

// Initialize key separation (IndexedDB non-extractable CryptoKey -> RAM secret) before rendering
SecurityService.init()
  .catch((err) => {
    Logger.warn('SecurityService keystore init notice:', err, 'SecurityService');
  })
  .finally(() => {
    clearTimeout(initFallbackTimer);
    renderApp();
  });

// Background initialization for storage migrations
storageService.init().catch((err) => {
  Logger.warn('Initialization notice:', err, 'storageService');
});

// Enregistrement du Service Worker pour le mode 100% Offline et PWA (uniquement en production)
try {
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    if (import.meta.env?.PROD) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/service-worker.js')
          .then((registration) => {
            Logger.info(`Service Worker enregistré: ${registration.scope}`, null, 'PWA');
          })
          .catch((error) => {
            Logger.warn('Erreur enregistrement Service Worker:', error, 'PWA');
          });
      });
    } else {
      // En développement, désinscrire tout Service Worker résiduel pouvant intercepter les modules Vite
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => {
          for (const registration of registrations) {
            registration.unregister().catch(() => {});
          }
        })
        .catch(() => {});
    }
  }
} catch {
  // Ignore blocked serviceWorker access in restricted iframes
}

