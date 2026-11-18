import { Suspense, lazy, useState } from 'react';
import LoginScreen from './presentation/pages/auth/LoginScreen';
import SplashScreen from './presentation/pages/auth/SplashScreen';
import RequirePasswordChange from './presentation/pages/auth/RequirePasswordChange';
import ConfirmDialog from './presentation/components/common/ConfirmDialog';
import ErrorBoundary from './presentation/components/common/ErrorBoundary';
import { AppBootGuard } from './presentation/components/common/loaders/AppBootGuard';
import { NeuralWatermark } from './presentation/components/common/loaders/NeuralWatermark';
import { useAuth } from './context/AuthContext';

const AuthenticatedApp = lazy(() => import('./AuthenticatedApp'));

export default function App() {
  const { user: currentUser } = useAuth();
  const [showSplash, setShowSplash] = useState(true);

  if (showSplash) {
    return (
      <ErrorBoundary sectionName="Démarrage système" onReset={() => setShowSplash(false)}>
        <AppBootGuard>
          <SplashScreen onComplete={() => setShowSplash(false)} />
        </AppBootGuard>
      </ErrorBoundary>
    );
  }

  if (!currentUser) {
    return (
      <ErrorBoundary sectionName="Authentification">
        <LoginScreen />
        <ConfirmDialog />
      </ErrorBoundary>
    );
  }

  // SEC-P0.2: Mandatory password change gate. Operational modules are strictly blocked until resolved.
  if (currentUser.mustChangePassword) {
    return (
      <ErrorBoundary sectionName="Mise à jour mot de passe">
        <RequirePasswordChange />
        <ConfirmDialog />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <Suspense
        fallback={
          <div className="relative z-10 w-full min-h-screen overflow-hidden">
            <NeuralWatermark label="Chargement de l'espace GMAO..." />
          </div>
        }
      >
        <AuthenticatedApp />
      </Suspense>
    </ErrorBoundary>
  );
}
