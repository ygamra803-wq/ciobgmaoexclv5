import { BrainCircuit } from 'lucide-react';

export interface NeuralWatermarkProps {
  /** Subtle optional operational status label beneath the glass cube */
  label?: string;
  /** Optional variant: 'contained' stays inside route viewport beneath Header/Sidebar */
  variant?: 'contained' | 'overlay';
  className?: string;
}

/**
 * NeuralWatermark
 * Glassmorphic centered loading watermark with ambient accent halo and 3 orbital rings.
 * Adapts automatically to Light (#FAFAF9) / Dark (.dark) and dynamic [data-accent="*"] tokens.
 * Positioned with z-20 inside the route container so Sticky Header (z-30) and Sidebar (z-40) stay accessible.
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
        variant === 'overlay' ? 'fixed inset-0 z-30' : 'absolute inset-0 z-20'
      } flex items-start justify-center pt-[min(24vh,210px)] pointer-events-none select-none bg-[#FAFAF9]/20 dark:bg-slate-950/25 backdrop-blur-[2px] ${className}`.trim()}
    >
      <div className="sticky top-[min(32vh,250px)] flex flex-col items-center gap-4">
        <div className="relative">
          {/* 1. Ambient Radial Halo */}
          <div
            className="absolute inset-[-10px] rounded-full blur-[54px] animate-pulse neural-reduced-static"
            style={{
              backgroundColor: 'rgba(var(--color-accent-rgb, 5, 150, 105), 0.24)',
            }}
          />

          {/* 2. Orbital Rings */}
          {/* Outer slow ring */}
          <div
            className="absolute inset-[-40px] rounded-full border animate-[spin_10s_linear_infinite] neural-reduced-static"
            style={{
              borderColor: 'rgba(var(--color-accent-rgb, 5, 150, 105), 0.14)',
            }}
          />

          {/* Middle ring with luminous primary orbit dot */}
          <div className="absolute inset-[-22px] rounded-full animate-[spin_3.2s_linear_infinite] neural-reduced-static">
            <div
              className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full"
              style={{
                backgroundColor: 'var(--color-accent-500, #10b981)',
                boxShadow: '0 0 12px var(--color-accent-500, #10b981)',
              }}
            />
          </div>

          {/* Inner counter-rotating ring with secondary trailing dot */}
          <div className="absolute inset-[-22px] rounded-full animate-[spin_4.2s_linear_infinite_reverse] neural-reduced-static">
            <div
              className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full blur-[0.5px]"
              style={{
                backgroundColor: 'rgba(var(--color-accent-rgb, 5, 150, 105), 0.72)',
              }}
            />
          </div>

          {/* 3. Glassmorphic Cube Container */}
          <div className="relative w-28 h-28 flex items-center justify-center">
            <div
              className="absolute inset-0 backdrop-blur-xl rounded-3xl border transition-colors duration-300"
              style={{
                background: 'var(--glass-bg)',
                borderColor: 'var(--glass-border)',
                boxShadow: 'var(--shadow-glass)',
              }}
            />

            {/* Subtle inner top specular edge */}
            <div className="absolute inset-[1px] rounded-[23px] bg-gradient-to-b from-white/50 dark:from-white/10 to-transparent pointer-events-none" />

            {/* 4. Pulsing Core Icon */}
            <BrainCircuit
              className="relative z-10 w-12 h-12 animate-pulse [animation-duration:2800ms] neural-reduced-static"
              style={{
                color: 'var(--color-accent-600, #059669)',
                filter:
                  'drop-shadow(0 0 12px rgba(var(--color-accent-rgb, 5, 150, 105), 0.35))',
              }}
            />
          </div>
        </div>

        {label && (
          <div
            className="px-3.5 py-1 rounded-full border backdrop-blur-md text-[11px] font-mono font-semibold tracking-wide text-slate-700 dark:text-slate-200"
            style={{
              background: 'var(--glass-bg)',
              borderColor: 'var(--glass-border)',
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
