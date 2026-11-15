import { useEffect, useState, useMemo, useRef, useCallback, useId, memo } from 'react';
import {
  BrainCircuit,
  Cpu,
  Zap,
  Activity,
  CheckCircle2,
  ArrowRight,
  Layers,
} from 'lucide-react';

const CONFIG = {
  nodes: {
    count: 12,
    radius: 152,
    size: 13,
    inactiveOpacity: 0.28,
  },
  network: {
    lineWidth: 1.75,
    glowIntensity: 12,
    pulseSpeed: 1600,
    connectionThreshold: 195,
  },
  rings: {
    count: 5,
    speeds: [26, 20, 15, 12, 9],
    opacities: [0.08, 0.11, 0.14, 0.18, 0.22],
  },
  particles: {
    count: 20,
    maxSize: 3.5,
    minSize: 1.5,
  },
  progress: {
    milestones: [25, 50, 75],
    smoothInterval: 50,
  },
} as const;

export interface NeuralLoaderProps {
  mode?: 'fullscreen' | 'section';
  appName?: string;
  appAccent?: string;
  tagline?: string;
  version?: string;
  showSkipButton?: boolean;
  onComplete?: () => void;
}

interface LoadingStage {
  text: string;
  progress: number;
  duration: number;
  icon: typeof BrainCircuit;
}

interface NodePosition {
  x: number;
  y: number;
  angle: number;
}

interface NeuralPulse {
  id: number;
  fromNode: number;
  toNode: number;
  progress: number;
}

const EnhancedParticles = memo(({ count = CONFIG.particles.count }: { count?: number }) => {
  const particles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const seedA = ((i * 37 + 13) % 97) / 97;
        const seedB = ((i * 53 + 29) % 89) / 89;
        const seedC = ((i * 19 + 7) % 43) / 43;
        return {
          left: `${(seedA * 92 + 4).toFixed(2)}%`,
          top: `${(seedB * 88 + 6).toFixed(2)}%`,
          size:
            CONFIG.particles.minSize +
            seedC * (CONFIG.particles.maxSize - CONFIG.particles.minSize),
          duration: 4.5 + seedA * 4.5,
          delay: seedB * 2.5,
        };
      }),
    [count]
  );

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((particle, i) => (
        <div
          key={i}
          className="absolute rounded-full neural-reduced-static"
          style={{
            left: particle.left,
            top: particle.top,
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            background:
              'radial-gradient(circle, rgb(var(--color-accent-rgb, 5, 150, 105)), transparent)',
            boxShadow: `0 0 ${particle.size * 6}px rgba(var(--color-accent-rgb, 5, 150, 105), 0.5)`,
            animation: `neuralFloat ${particle.duration}s ease-in-out infinite`,
            animationDelay: `${particle.delay}s`,
          }}
        />
      ))}
    </div>
  );
});
EnhancedParticles.displayName = 'EnhancedParticles';

const EnhancedNeuralGrid = memo(() => (
  <div className="absolute inset-0 opacity-35 dark:opacity-30 pointer-events-none">
    <div
      className="absolute inset-0 neural-reduced-static"
      style={{
        backgroundImage: `
          linear-gradient(rgba(var(--color-accent-rgb, 5, 150, 105), 0.11) 1.5px, transparent 1.5px),
          linear-gradient(90deg, rgba(var(--color-accent-rgb, 5, 150, 105), 0.11) 1.5px, transparent 1.5px)
        `,
        backgroundSize: '56px 56px',
        maskImage: 'radial-gradient(ellipse 85% 70% at 50% 50%, black 15%, transparent 74%)',
        WebkitMaskImage:
          'radial-gradient(ellipse 85% 70% at 50% 50%, black 15%, transparent 74%)',
        animation: 'neuralGridPulse 4s ease-in-out infinite',
      }}
    />
    <div
      className="absolute inset-0 neural-reduced-static"
      style={{
        backgroundImage: `
          radial-gradient(circle at 30% 38%, rgba(var(--color-accent-rgb, 5, 150, 105), 0.16) 0%, transparent 52%),
          radial-gradient(circle at 72% 62%, rgba(var(--color-accent-rgb, 5, 150, 105), 0.12) 0%, transparent 50%)
        `,
        animation: 'neuralGlowShift 6s ease-in-out infinite alternate',
      }}
    />
    <div
      className="absolute inset-0 opacity-25"
      style={{
        backgroundImage: `
          repeating-linear-gradient(
            45deg,
            transparent,
            transparent 40px,
            rgba(var(--color-accent-rgb, 5, 150, 105), 0.06) 40px,
            rgba(var(--color-accent-rgb, 5, 150, 105), 0.06) 41.5px
          )
        `,
      }}
    />
  </div>
));
EnhancedNeuralGrid.displayName = 'EnhancedNeuralGrid';

const EnhancedDataStreams = memo(() => {
  const streams = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => ({
        left: `${7 + i * 9.2}%`,
        duration: 2.6 + ((i * 17) % 10) * 0.25,
        delay: ((i * 13) % 7) * 0.35,
      })),
    []
  );

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20 dark:opacity-25">
      {streams.map((stream, i) => (
        <div
          key={i}
          className="absolute top-0 w-[1.5px] h-28 neural-reduced-static"
          style={{
            left: stream.left,
            background:
              'linear-gradient(to bottom, transparent, rgba(var(--color-accent-rgb, 5, 150, 105), 0.75), rgba(var(--color-accent-rgb, 5, 150, 105), 0.4), transparent)',
            boxShadow: '0 0 8px rgba(var(--color-accent-rgb, 5, 150, 105), 0.45)',
            animation: `neuralDataStream ${stream.duration}s linear infinite`,
            animationDelay: `${stream.delay}s`,
          }}
        />
      ))}
    </div>
  );
});
EnhancedDataStreams.displayName = 'EnhancedDataStreams';

const EnhancedScannerLine = memo(() => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-25">
    <div
      className="w-full h-[2px] relative neural-reduced-static"
      style={{
        background:
          'linear-gradient(to right, transparent, rgb(var(--color-accent-rgb, 5, 150, 105)), transparent)',
        boxShadow: '0 0 18px rgba(var(--color-accent-rgb, 5, 150, 105), 0.55)',
        animation: 'neuralScanline 4.8s linear infinite',
      }}
    />
  </div>
));
EnhancedScannerLine.displayName = 'EnhancedScannerLine';

const EnhancedOrbitRings = memo(({ isComplete }: { isComplete: boolean }) => (
  <>
    {Array.from({ length: CONFIG.rings.count }).map((_, i) => (
      <div
        key={i}
        className="absolute rounded-full transition-all duration-700 neural-reduced-static"
        style={{
          inset: `-${36 + i * 12}px`,
          opacity: isComplete ? Math.min(CONFIG.rings.opacities[i] * 1.8, 0.45) : CONFIG.rings.opacities[i],
          border: `1.5px solid rgba(var(--color-accent-rgb, 5, 150, 105), ${isComplete ? 0.55 : 0.35})`,
          boxShadow: `0 0 ${12 + i * 4}px rgba(var(--color-accent-rgb, 5, 150, 105), 0.16)`,
          animation: `spin ${CONFIG.rings.speeds[i]}s linear infinite ${
            i % 2 === 0 ? '' : 'reverse'
          }, neuralRingPulse ${CONFIG.rings.speeds[i] * 0.5}s ease-in-out infinite`,
          animationDelay: `${i * 0.18}s`,
        }}
      />
    ))}
  </>
));
EnhancedOrbitRings.displayName = 'EnhancedOrbitRings';

const EnhancedNeuralNode = memo(
  ({ position, isActive }: { position: NodePosition; isActive: boolean }) => (
    <div
      className="absolute"
      style={{
        top: `calc(50% + ${position.y}px)`,
        left: `calc(50% + ${position.x}px)`,
        transform: 'translate(-50%, -50%)',
      }}
    >
      {isActive && (
        <div
          className="absolute inset-[-20px] rounded-full animate-ping neural-reduced-static"
          style={{
            background:
              'radial-gradient(circle, rgba(var(--color-accent-rgb, 5, 150, 105), 0.38), transparent 70%)',
            animationDuration: '1.8s',
          }}
        />
      )}

      <div
        className="absolute inset-[-7px] rounded-full border transition-all duration-500 neural-reduced-static"
        style={{
          borderColor: isActive
            ? 'rgba(var(--color-accent-rgb, 5, 150, 105), 0.65)'
            : 'transparent',
          boxShadow: isActive
            ? '0 0 12px rgba(var(--color-accent-rgb, 5, 150, 105), 0.45)'
            : 'none',
          animation: isActive ? 'neuralRotate 3s linear infinite' : 'none',
        }}
      />

      <div
        className="relative rounded-full transition-all duration-500"
        style={{
          width: `${CONFIG.nodes.size}px`,
          height: `${CONFIG.nodes.size}px`,
          background: isActive
            ? 'radial-gradient(circle, var(--color-accent-500, #10b981), var(--color-accent-700, #047857))'
            : 'radial-gradient(circle, rgba(var(--color-accent-rgb, 5, 150, 105), 0.45), rgba(var(--color-accent-rgb, 5, 150, 105), 0.2))',
          boxShadow: isActive
            ? '0 0 18px rgba(var(--color-accent-rgb, 5, 150, 105), 0.75)'
            : '0 0 4px rgba(var(--color-accent-rgb, 5, 150, 105), 0.25)',
          opacity: isActive ? 1 : CONFIG.nodes.inactiveOpacity,
          transform: isActive ? 'scale(1.3)' : 'scale(1)',
          border: `1.5px solid rgba(var(--color-accent-rgb, 5, 150, 105), ${
            isActive ? 0.9 : 0.35
          })`,
        }}
      >
        <div
          className="absolute inset-[3.5px] rounded-full bg-white"
          style={{
            boxShadow: '0 0 4px rgba(255,255,255,0.9)',
          }}
        />
      </div>
    </div>
  )
);
EnhancedNeuralNode.displayName = 'EnhancedNeuralNode';

const NeuralNetwork = memo(
  ({
    nodePositions,
    activeNodes,
    pulses,
  }: {
    nodePositions: NodePosition[];
    activeNodes: Set<number>;
    pulses: NeuralPulse[];
  }) => {
    const uid = useId().replace(/:/g, '');
    const connGradId = `ciob-conn-${uid}`;
    const pulseGradId = `ciob-pulse-${uid}`;
    const glowFilterId = `ciob-glow-${uid}`;

    const connections = useMemo(() => {
      const conns: Array<{ from: number; to: number }> = [];
      for (let i = 0; i < nodePositions.length; i++) {
        for (let j = i + 1; j < nodePositions.length; j++) {
          const dx = nodePositions[i].x - nodePositions[j].x;
          const dy = nodePositions[i].y - nodePositions[j].y;
          if (Math.sqrt(dx * dx + dy * dy) < CONFIG.network.connectionThreshold) {
            conns.push({ from: i, to: j });
          }
        }
      }
      return conns;
    }, [nodePositions]);

    return (
      <svg
        className="absolute inset-0 pointer-events-none"
        style={{
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '540px',
          height: '540px',
        }}
      >
        <defs>
          <linearGradient id={connGradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgb(var(--color-accent-rgb, 5, 150, 105))" stopOpacity="0.05" />
            <stop offset="50%" stopColor="rgb(var(--color-accent-rgb, 5, 150, 105))" stopOpacity="0.85" />
            <stop offset="100%" stopColor="rgb(var(--color-accent-rgb, 5, 150, 105))" stopOpacity="0.05" />
          </linearGradient>
          <radialGradient id={pulseGradId}>
            <stop offset="0%" stopColor="rgb(var(--color-accent-rgb, 5, 150, 105))" stopOpacity="1" />
            <stop offset="60%" stopColor="rgb(var(--color-accent-rgb, 5, 150, 105))" stopOpacity="0.5" />
            <stop offset="100%" stopColor="rgb(var(--color-accent-rgb, 5, 150, 105))" stopOpacity="0" />
          </radialGradient>
          <filter id={glowFilterId}>
            <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {connections.map(({ from, to }, idx) => {
          const isActive = activeNodes.has(from) || activeNodes.has(to);
          const bothActive = activeNodes.has(from) && activeNodes.has(to);
          const opacity = bothActive ? 0.78 : isActive ? 0.45 : 0.18;
          const strokeWidth = bothActive
            ? CONFIG.network.lineWidth * 1.35
            : CONFIG.network.lineWidth;

          return (
            <g key={idx}>
              {isActive && (
                <line
                  x1={270 + nodePositions[from].x}
                  y1={270 + nodePositions[from].y}
                  x2={270 + nodePositions[to].x}
                  y2={270 + nodePositions[to].y}
                  stroke="rgb(var(--color-accent-rgb, 5, 150, 105))"
                  strokeWidth={strokeWidth + 2}
                  opacity={opacity * 0.28}
                  filter={`url(#${glowFilterId})`}
                />
              )}
              <line
                x1={270 + nodePositions[from].x}
                y1={270 + nodePositions[from].y}
                x2={270 + nodePositions[to].x}
                y2={270 + nodePositions[to].y}
                stroke={`url(#${connGradId})`}
                strokeWidth={strokeWidth}
                opacity={opacity}
                strokeLinecap="round"
                style={{ transition: 'opacity 0.4s ease-out' }}
              />
            </g>
          );
        })}

        {pulses.map((pulse) => {
          if (pulse.fromNode >= nodePositions.length || pulse.toNode >= nodePositions.length) {
            return null;
          }
          const from = nodePositions[pulse.fromNode];
          const to = nodePositions[pulse.toNode];
          const x = 270 + from.x + (to.x - from.x) * pulse.progress;
          const y = 270 + from.y + (to.y - from.y) * pulse.progress;

          return (
            <g key={pulse.id}>
              <circle cx={x} cy={y} r={10} fill={`url(#${pulseGradId})`} opacity={0.55} />
              <circle
                cx={x}
                cy={y}
                r={3.5}
                fill="rgb(var(--color-accent-rgb, 5, 150, 105))"
                filter={`url(#${glowFilterId})`}
              />
            </g>
          );
        })}
      </svg>
    );
  }
);
NeuralNetwork.displayName = 'NeuralNetwork';

/**
 * NeuralLoader
 * Introductory presentation splash layer ("système de présentation visuelle")
 * rendered strictly before the operational SSOT SplashScreen.
 * Adapts dynamically to Light (#FAFAF9) / Dark (.dark) and [data-accent="*"].
 */
export function NeuralLoader({
  mode = 'fullscreen',
  appName = 'CIOB',
  appAccent = 'GMAO NEXUS',
  tagline = 'Maintenance Industrielle & Jumeau Numérique',
  version = 'CIOB GMAO Nexus v5.0 • Architecture SSOT',
  showSkipButton = true,
  onComplete,
}: NeuralLoaderProps) {
  const isFull = mode === 'fullscreen';
  const durationMultiplier = isFull ? 1 : 0.45;

  const stages: LoadingStage[] = useMemo(
    () => [
      {
        text: 'Initialisation du Noyau Nexus...',
        progress: 20,
        duration: 580 * durationMultiplier,
        icon: BrainCircuit,
      },
      {
        text: 'Activation Jumeau Numérique...',
        progress: 48,
        duration: 640 * durationMultiplier,
        icon: Layers,
      },
      {
        text: 'Connexion Modules Parc & PDR...',
        progress: 75,
        duration: 600 * durationMultiplier,
        icon: Zap,
      },
      {
        text: 'Calibrage Moteur Analytique...',
        progress: 96,
        duration: 540 * durationMultiplier,
        icon: Activity,
      },
      {
        text: 'Présentation prête.',
        progress: 100,
        duration: 340 * durationMultiplier,
        icon: CheckCircle2,
      },
    ],
    [durationMultiplier]
  );

  const nodePositions = useMemo<NodePosition[]>(
    () =>
      Array.from({ length: CONFIG.nodes.count }, (_, i) => {
        const angleDeg = i * (360 / CONFIG.nodes.count);
        const angleRad = angleDeg * (Math.PI / 180);
        return {
          x: Math.cos(angleRad) * CONFIG.nodes.radius,
          y: Math.sin(angleRad) * CONFIG.nodes.radius,
          angle: angleDeg,
        };
      }),
    []
  );

  const [progress, setProgress] = useState(0);
  const [activeNodes, setActiveNodes] = useState<Set<number>>(() => new Set([0, 3, 6, 9]));
  const [stageIndex, setStageIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [pulses, setPulses] = useState<NeuralPulse[]>([]);

  const completedRef = useRef(false);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    return () => {
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
      if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
    };
  }, []);

  const triggerFinish = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    setIsExiting(true);
    exitTimerRef.current = setTimeout(() => {
      onCompleteRef.current?.();
    }, 280);
  }, []);

  // Skip via Escape / Enter
  useEffect(() => {
    if (!isFull) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        triggerFinish();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isFull, triggerFinish]);

  // Smooth progress interpolation toward current stage target
  useEffect(() => {
    if (isComplete || isExiting) return;
    const targetProgress = stages[stageIndex]?.progress ?? 100;
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= targetProgress) return prev;
        const delta = Math.max((targetProgress - prev) * 0.16, 1.2);
        return Math.min(prev + delta, targetProgress);
      });
    }, CONFIG.progress.smoothInterval);
    return () => clearInterval(interval);
  }, [stageIndex, isComplete, isExiting, stages]);

  // Stage progression & completion handoff
  useEffect(() => {
    if (isComplete || isExiting) return;
    const currentStage = stages[stageIndex];
    if (!currentStage) return;

    const timer = setTimeout(() => {
      if (stageIndex < stages.length - 1) {
        setStageIndex((prev) => prev + 1);
      } else {
        setProgress(100);
        setIsComplete(true);
        finishTimerRef.current = setTimeout(() => {
          triggerFinish();
        }, 260);
      }
    }, currentStage.duration);

    return () => clearTimeout(timer);
  }, [stageIndex, isComplete, isExiting, stages, triggerFinish]);

  // Dynamic neural node activation
  useEffect(() => {
    if (isComplete || isExiting) {
      setActiveNodes(new Set(Array.from({ length: CONFIG.nodes.count }, (_, i) => i)));
      return;
    }

    const interval = setInterval(() => {
      setActiveNodes((prev) => {
        const next = new Set(prev);
        if (next.size < CONFIG.nodes.count) {
          let candidate = 0;
          for (let attempt = 0; attempt < 8; attempt++) {
            const pick = Math.floor(Math.random() * CONFIG.nodes.count);
            if (!next.has(pick)) {
              candidate = pick;
              break;
            }
          }
          next.add(candidate);
        }
        if (Math.random() > 0.65 && next.size > 4) {
          const arr = Array.from(next);
          next.delete(arr[Math.floor(Math.random() * arr.length)]);
        }
        return next;
      });
    }, 340);

    return () => clearInterval(interval);
  }, [isComplete, isExiting]);

  // Traveling neural pulses across active links
  useEffect(() => {
    if (isComplete || isExiting || nodePositions.length === 0) return;
    const pulseIntervals = new Set<ReturnType<typeof setInterval>>();
    const pulseTimeouts = new Set<ReturnType<typeof setTimeout>>();

    const interval = setInterval(() => {
      const arr = Array.from(activeNodes);
      if (arr.length < 2) return;
      const fromNode = arr[Math.floor(Math.random() * arr.length)];
      let toNode = arr[Math.floor(Math.random() * arr.length)];
      if (toNode === fromNode) {
        toNode = arr[(arr.indexOf(fromNode) + 1) % arr.length];
      }

      const newPulse: NeuralPulse = {
        id: Date.now() + Math.random(),
        fromNode,
        toNode,
        progress: 0,
      };
      setPulses((prev) => [...prev.slice(-6), newPulse]);

      const stepTimer = setInterval(() => {
        setPulses((prev) =>
          prev.map((p) =>
            p.id === newPulse.id ? { ...p, progress: Math.min(p.progress + 0.06, 1) } : p
          )
        );
      }, 45);
      pulseIntervals.add(stepTimer);

      const cleanupTimer = setTimeout(() => {
        clearInterval(stepTimer);
        pulseIntervals.delete(stepTimer);
        pulseTimeouts.delete(cleanupTimer);
        setPulses((prev) => prev.filter((p) => p.id !== newPulse.id));
      }, CONFIG.network.pulseSpeed);
      pulseTimeouts.add(cleanupTimer);
    }, 650);

    return () => {
      clearInterval(interval);
      pulseIntervals.forEach(clearInterval);
      pulseTimeouts.forEach(clearTimeout);
    };
  }, [activeNodes, isComplete, isExiting, nodePositions.length]);

  const CurrentIcon = stages[stageIndex]?.icon ?? BrainCircuit;

  return (
    <div
      role="region"
      aria-label="Présentation d'accueil CIOB GMAO Nexus"
      className={`${
        isFull
          ? 'fixed inset-0 z-[100]'
          : 'relative w-full h-[calc(85vh-100px)] min-h-[500px] rounded-2xl border border-slate-200 dark:border-slate-800'
      } bg-[#FAFAF9]/95 dark:bg-slate-950/95 backdrop-blur-md text-slate-900 dark:text-slate-100 flex flex-col items-center justify-center overflow-hidden select-none font-sans transition-all duration-300 ${
        isExiting ? 'opacity-0 scale-[1.015] pointer-events-none' : 'opacity-100 scale-100'
      }`}
    >
      <EnhancedNeuralGrid />
      <EnhancedParticles />
      <EnhancedDataStreams />
      <EnhancedScannerLine />

      {/* Top Bar: Subtle Badge & Conscious Intro Bypass */}
      {isFull && (
        <div className="absolute top-4 left-4 right-4 sm:top-6 sm:left-8 sm:right-8 z-30 flex items-center justify-between gap-3">
          <div
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border backdrop-blur-md text-[11px] font-mono font-semibold text-slate-700 dark:text-slate-200"
            style={{
              background: 'var(--glass-bg)',
              borderColor: 'var(--glass-border)',
            }}
          >
            <span
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ backgroundColor: 'var(--color-accent-500, #10b981)' }}
            />
            <span>NEXUS CORE • INTRO</span>
          </div>

          {showSkipButton && (
            <button
              type="button"
              onClick={triggerFinish}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-xs font-medium text-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white transition cursor-pointer backdrop-blur-md shadow-xs"
              style={{
                background: 'var(--glass-bg)',
                borderColor: 'var(--glass-border)',
              }}
              title="Passer directement à l'inspection système"
            >
              <span>Passer l&apos;intro</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Central Neural Reactor Core */}
      <div
        className={`relative z-10 mb-14 sm:mb-16 ${
          !isFull ? 'scale-75' : 'scale-90 sm:scale-100'
        } neural-reduced-static`}
        style={{ animation: 'neuralFloat 5.5s ease-in-out infinite' }}
      >
        {isFull && (
          <>
            <div
              className="absolute inset-[-72px] blur-[90px] rounded-full animate-pulse neural-reduced-static"
              style={{
                background:
                  'radial-gradient(circle, rgba(var(--color-accent-rgb, 5, 150, 105), 0.28), transparent 70%)',
                animationDuration: '3s',
              }}
            />
            <div
              className="absolute inset-[-44px] blur-[52px] rounded-full animate-pulse neural-reduced-static"
              style={{
                background:
                  'radial-gradient(circle, rgba(var(--color-accent-rgb, 5, 150, 105), 0.18), transparent 70%)',
                animationDuration: '2.4s',
                animationDelay: '0.4s',
              }}
            />
          </>
        )}

        <EnhancedOrbitRings isComplete={isComplete} />
        <NeuralNetwork
          nodePositions={nodePositions}
          activeNodes={activeNodes}
          pulses={pulses}
        />

        {/* Glassmorphic Cube */}
        <div
          className="relative backdrop-blur-xl p-8 sm:p-9 rounded-3xl border transition-all duration-700 z-20"
          style={{
            background: 'var(--glass-bg)',
            borderColor: 'var(--glass-border)',
            boxShadow:
              'var(--shadow-glass), inset 0 1px 0 rgba(255, 255, 255, 0.45)',
          }}
        >
          <CurrentIcon
            className={`h-20 w-20 sm:h-22 sm:w-22 transition-all duration-500 ${
              isComplete ? 'scale-110' : 'animate-pulse'
            } neural-reduced-static`}
            style={{
              color: 'var(--color-accent-600, #059669)',
              filter:
                'drop-shadow(0 0 18px rgba(var(--color-accent-rgb, 5, 150, 105), 0.4))',
            }}
          />
          <div
            className="absolute inset-0 border rounded-3xl animate-ping opacity-30 neural-reduced-static pointer-events-none"
            style={{
              borderColor: 'rgba(var(--color-accent-rgb, 5, 150, 105), 0.45)',
              animationDuration: '3s',
            }}
          />
        </div>

        {nodePositions.map((pos, i) => (
          <EnhancedNeuralNode key={i} position={pos} isActive={activeNodes.has(i)} />
        ))}
      </div>

      {/* Title, Live Stage Readout & Progress Bar */}
      <div className="z-20 flex flex-col items-center gap-4 w-full max-w-md px-6">
        {isFull && (
          <div className="text-center space-y-1">
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              <span>{appName}</span>{' '}
              <span style={{ color: 'var(--color-accent-600, #059669)' }}>
                {appAccent}
              </span>
            </h1>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-[0.22em]">
              {tagline}
            </p>
          </div>
        )}

        <div className="h-7 flex items-center justify-center w-full">
          <p
            key={stageIndex}
            className="text-xs sm:text-sm font-mono text-center neural-stage-enter font-medium"
            style={{ color: 'var(--color-accent-700, #047857)' }}
          >
            <span className="opacity-60">&gt;</span>{' '}
            <span className="dark:text-slate-200">{stages[stageIndex]?.text}</span>
            <span
              className="inline-block w-1.5 h-3.5 ml-1.5 align-middle animate-pulse"
              style={{ backgroundColor: 'var(--color-accent-500, #10b981)' }}
            />
          </p>
        </div>

        <div className="w-full space-y-2.5">
          <div
            className="relative w-full h-2 rounded-full overflow-hidden backdrop-blur-sm border"
            style={{
              backgroundColor: 'rgba(var(--color-accent-rgb, 5, 150, 105), 0.1)',
              borderColor: 'rgba(var(--color-accent-rgb, 5, 150, 105), 0.2)',
            }}
          >
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-all duration-300 ease-out"
              style={{
                width: `${progress}%`,
                background:
                  'linear-gradient(90deg, var(--color-accent-600, #059669), var(--color-accent-500, #10b981))',
                boxShadow:
                  '0 0 16px rgba(var(--color-accent-rgb, 5, 150, 105), 0.5)',
              }}
            >
              <div
                className="absolute inset-0 w-1/3"
                style={{
                  background:
                    'linear-gradient(to right, transparent, rgba(255,255,255,0.6), transparent)',
                  animation: 'neuralScannerSweep 1.8s ease-in-out infinite',
                }}
              />
            </div>

            {CONFIG.progress.milestones.map((milestone) => (
              <div
                key={milestone}
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all duration-300"
                style={{ left: `${milestone}%` }}
              >
                <div
                  className="w-2 h-2 rounded-full transition-transform duration-300"
                  style={{
                    backgroundColor:
                      progress >= milestone
                        ? 'var(--color-accent-500, #10b981)'
                        : 'rgba(148, 163, 184, 0.55)',
                    boxShadow:
                      progress >= milestone
                        ? '0 0 8px rgba(var(--color-accent-rgb, 5, 150, 105), 0.7)'
                        : 'none',
                    transform: progress >= milestone ? 'scale(1.25)' : 'scale(1)',
                  }}
                />
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center text-[11px] font-mono tabular-nums">
            <span className="text-slate-600 dark:text-slate-400 font-semibold">
              {Math.round(progress)}%
            </span>
            <span
              className={`font-semibold transition-colors duration-300 ${
                isComplete ? '' : 'text-slate-500 dark:text-slate-400'
              }`}
              style={
                isComplete
                  ? { color: 'var(--color-accent-600, #059669)' }
                  : undefined
              }
            >
              {isComplete ? '✓ PRÊT POUR INDEXATION' : 'INITIALISATION NEXUS...'}
            </span>
          </div>
        </div>
      </div>

      {isFull && (
        <div className="absolute bottom-5 sm:bottom-7 text-[10px] font-mono text-slate-500 dark:text-slate-400 uppercase tracking-[0.18em] opacity-75 z-20">
          {version}
        </div>
      )}
    </div>
  );
}

export default NeuralLoader;
