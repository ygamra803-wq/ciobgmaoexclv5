import { useState, type ReactNode } from 'react';
import { NeuralLoader } from './NeuralLoader';

export interface AppBootGuardProps {
  children: ReactNode;
  /** Allows bypassing the intro presentation directly when needed (e.g. unit tests) */
  skipIntro?: boolean;
}

/**
 * AppBootGuard
 * Layer 1 visual intro presentation shown strictly BEFORE the operational
 * SSOT SplashScreen (which runs live entity manifest inspection untouched).
 */
export function AppBootGuard({ children, skipIntro = false }: AppBootGuardProps) {
  const [isIntroActive, setIsIntroActive] = useState(!skipIntro);

  if (isIntroActive) {
    return (
      <NeuralLoader
        mode="fullscreen"
        appName="CIOB"
        appAccent="GMAO NEXUS"
        tagline="Maintenance Industrielle & Jumeau Numérique"
        version="CIOB GMAO Nexus v5.0 • Architecture SSOT"
        onComplete={() => setIsIntroActive(false)}
      />
    );
  }

  return <div className="neural-fade-in min-h-screen">{children}</div>;
}

export default AppBootGuard;
