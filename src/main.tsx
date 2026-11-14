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

// Ensure visual attributes are initialized on root DOM element
const initialAccent = storageService.getItem(STORAGE_KEYS.ACCENT_COLOR) || 'emerald';
if (typeof document !== 'undefined') {
  document.documentElement.setAttribute('data-accent', initialAccent);
}

// 1. Run one-time SSOT storage migration before any hook reads storage
migrateStorageOnce();

// Initialize Enterprise Architecture DI Container and Error / Analytics Tracking
ServiceProvider.register();
errorTracker.init();

// Migration: If no Master PIN / Vault is set, ensure default users are using predictable passwords
const authMigratedFlag = storageService.getItem(STORAGE_KEYS.MIGRATION_AUTH_V1);
if (!vaultService.isVaultExists() && authMigratedFlag !== true && authMigratedFlag !== 'true') {
  SecurityService.removeSecure(STORAGE_KEYS.AUTH_ACCOUNTS); // Force AuthService to re-init with 'admin'/'admin'
  storageService.setItem(STORAGE_KEYS.MIGRATION_AUTH_V1, true);
}

analytics.track('app_started', 'system', { timestamp: Date.now() });

const rootElement = document.getElementById('root');
if (rootElement) {
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
}


// Background initialization for storage migrations
storageService.init().catch((err) => {
  Logger.warn('Initialization notice:', err, 'storageService');
});

// Enregistrement du Service Worker pour le mode 100% Offline et PWA
if ('serviceWorker' in navigator && import.meta.env.PROD) {
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
}

