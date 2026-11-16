import { BrainCircuit } from 'lucide-react';

export interface NeuralWatermarkProps {
  /** Subtle optional operational status label beneath the glass cube */
  label?: string;
  /** Optional variant: 'contained' fills route viewport, 'overlay' covers viewport */
  variant?: 'contained' | 'overlay';
  className?: string;
}

/**
 * NeuralWatermark
 * Animated glassmorphic page-loading watermark driven by explicit CSS @keyframes
 * in src/styles/watermark.css (Sea Blue in Light mode, Muted Gold in Dark mode).
 */
export function NeuralWatermark({
  label,
  variant = 'contained',
  className = '',
}: NeuralWatermarkProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label || 'Chargement de la vue en cours'}
      className={`${
        variant === 'overlay' ? 'fixed inset-0 z-40' : 'absolute inset-0 z-40'
      } flex items-start justify-center pt-[min(24vh,210px)] backdrop-blur-[2px] pointer-events-none select-none ${className}`.trim()}
      style={{ backgroundColor: 'var(--wm-backdrop)' }}
    >
      <div className="sticky top-[min(32vh,250px)] flex flex-col items-center gap-4">
        {/* Explicit 112x112 reactor core ensures symmetric circular orbits */}
        <div className="relative w-28 h-28 flex items-center justify-center">
          {/* 1. Ambient Pulsing Aura */}
          <div className="wm-aura absolute -inset-4 rounded-full" />

          {/* 2. Slow Outer Orbit + 3rd Secondary Atom */}
          <div className="wm-orbit-outer absolute -inset-10 rounded-full">
            <div className="wm-atom-secondary absolute top-1/2 -right-1 -translate-y-1/2 w-1.5 h-1.5 rounded-full" />
          </div>

          {/* 3. Fast Middle Orbit + Primary Luminous Atom */}
          <div className="wm-orbit-fast absolute -inset-5 rounded-full">
            <div className="wm-atom-primary absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full" />
          </div>

          {/* 4. Counter-Rotating Reverse Orbit + Anti-Atom */}
          <div className="wm-orbit-reverse absolute -inset-5 rounded-full">
            <div className="wm-atom-secondary absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full" />
          </div>

          {/* 5. Frosted Glass Cube */}
          <div className="wm-glass-cube relative w-28 h-28 rounded-3xl flex items-center justify-center">
            {/* 6. Pulsing Glowing Core Icon */}
            <BrainCircuit className="wm-icon-pulse relative z-10 w-12 h-12" />
          </div>
        </div>

        {label && (
          <div
            className="px-3.5 py-1 rounded-full text-[11px] font-mono font-semibold tracking-wide text-slate-700 dark:text-slate-200 backdrop-blur-md"
            style={{
              backgroundColor: 'var(--wm-glass-bg)',
              border: '1px solid var(--wm-glass-border)',
              boxShadow: 'var(--wm-glass-shadow)',
            }}
          >
            {label}
          </div>
        )}
      </div>
    </div>
  );
}

export default NeuralWatermark;
