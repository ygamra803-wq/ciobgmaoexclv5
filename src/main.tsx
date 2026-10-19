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

// 1. Run one-time SSOT storage migration before any hook reads storage
migrateStorageOnce();

// Initialize Enterprise Architecture DI Container and Error / Analytics Tracking
ServiceProvider.register();
errorTracker.init();

// Migration: If no Master PIN / Vault is set, ensure default users are using predictable passwords
if (!vaultService.isVaultExists() && !localStorage.getItem('gmao_migration_auth_v1')) {
  localStorage.removeItem('gmao_auth_accounts_v2'); // Force AuthService to re-init with 'admin'/'admin'
  localStorage.setItem('gmao_migration_auth_v1', 'true');
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

