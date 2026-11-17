import { useEffect, useState, useMemo, useRef, useCallback, useId, memo } from 'react';
import {
  BrainCircuit,
  Zap,
  Activity,
  CheckCircle2,
  ArrowRight,
  Layers,
  FileSpreadsheet,
} from 'lucide-react';

const CONFIG = {
  nodes: {
    count: 12,
    radius: 148,
    size: 12,
    inactiveOpacity: 0.3,
  },
  network: {
    lineWidth: 1.65,
    pulseSpeed: 1500,
    connectionThreshold: 190,
  },
  rings: {
    count: 4,
    speeds: [26, 19, 14, 10],
    opacities: [0.1, 0.14, 0.18, 0.24],
  },
  particles: {
    count: 18,
    maxSize: 3.2,
    minSize: 1.5,
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

interface ShowcasePhase {
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
            boxShadow: `0 0 ${particle.size * 5}px rgba(var(--color-accent-rgb, 5, 150, 105), 0.45)`,
            animation: `neuralFloat ${particle.duration}s ease-in-out infinite`,
            animationDelay: `${particle.delay}s`,
          }}
        />
      ))}
    </div>
  );
});
EnhancedParticles.displayName = 'EnhancedParticles';

const EnhancedOrbitRings = memo(({ isComplete }: { isComplete: boolean }) => (
  <>
    {Array.from({ length: CONFIG.rings.count }).map((_, i) => (
      <div
        key={i}
        className="absolute rounded-full transition-all duration-700 neural-reduced-static pointer-events-none"
        style={{
          inset: `-${34 + i * 14}px`,
          opacity: isComplete
            ? Math.min(CONFIG.rings.opacities[i] * 1.6, 0.45)
            : CONFIG.rings.opacities[i],
          border: `1.5px solid rgba(var(--color-accent-rgb, 5, 150, 105), ${
            isComplete ? 0.55 : 0.35
          })`,
          boxShadow: `0 0 ${10 + i * 4}px rgba(var(--color-accent-rgb, 5, 150, 105), 0.14)`,
          animation: `neuralRotate ${CONFIG.rings.speeds[i]}s linear infinite ${
            i % 2 === 0 ? '' : 'reverse'
          }`,
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
      className="absolute pointer-events-none"
      style={{
        top: `calc(50% + ${position.y}px)`,
        left: `calc(50% + ${position.x}px)`,
        transform: 'translate(-50%, -50%)',
      }}
    >
      {isActive && (
        <div
          className="absolute inset-[-18px] rounded-full animate-ping neural-reduced-static"
          style={{
            background:
              'radial-gradient(circle, rgba(var(--color-accent-rgb, 5, 150, 105), 0.34), transparent 70%)',
            animationDuration: '1.8s',
          }}
        />
      )}

      <div
        className="absolute inset-[-6px] rounded-full border transition-all duration-500 neural-reduced-static"
        style={{
          borderColor: isActive
            ? 'rgba(var(--color-accent-rgb, 5, 150, 105), 0.65)'
            : 'transparent',
          boxShadow: isActive
            ? '0 0 10px rgba(var(--color-accent-rgb, 5, 150, 105), 0.4)'
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
            ? '0 0 16px rgba(var(--color-accent-rgb, 5, 150, 105), 0.7)'
            : '0 0 4px rgba(var(--color-accent-rgb, 5, 150, 105), 0.22)',
          opacity: isActive ? 1 : CONFIG.nodes.inactiveOpacity,
          transform: isActive ? 'scale(1.25)' : 'scale(1)',
          border: `1.5px solid rgba(var(--color-accent-rgb, 5, 150, 105), ${
            isActive ? 0.9 : 0.35
          })`,
        }}
      >
        <div
          className="absolute inset-[3px] rounded-full bg-white"
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
          width: '520px',
          height: '520px',
        }}
      >
        <defs>
          <linearGradient id={connGradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop
              offset="0%"
              stopColor="rgb(var(--color-accent-rgb, 5, 150, 105))"
              stopOpacity="0.06"
            />
            <stop
              offset="50%"
              stopColor="rgb(var(--color-accent-rgb, 5, 150, 105))"
              stopOpacity="0.82"
            />
            <stop
              offset="100%"
              stopColor="rgb(var(--color-accent-rgb, 5, 150, 105))"
              stopOpacity="0.06"
            />
          </linearGradient>
          <radialGradient id={pulseGradId}>
            <stop
              offset="0%"
              stopColor="rgb(var(--color-accent-rgb, 5, 150, 105))"
              stopOpacity="1"
            />
            <stop
              offset="60%"
              stopColor="rgb(var(--color-accent-rgb, 5, 150, 105))"
              stopOpacity="0.5"
            />
            <stop
              offset="100%"
              stopColor="rgb(var(--color-accent-rgb, 5, 150, 105))"
              stopOpacity="0"
            />
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
          const opacity = bothActive ? 0.72 : isActive ? 0.42 : 0.16;
          const strokeWidth = bothActive
            ? CONFIG.network.lineWidth * 1.3
            : CONFIG.network.lineWidth;

          return (
            <g key={idx}>
              {isActive && (
                <line
                  x1={260 + nodePositions[from].x}
                  y1={260 + nodePositions[from].y}
                  x2={260 + nodePositions[to].x}
                  y2={260 + nodePositions[to].y}
                  stroke="rgb(var(--color-accent-rgb, 5, 150, 105))"
                  strokeWidth={strokeWidth + 2}
                  opacity={opacity * 0.25}
                  filter={`url(#${glowFilterId})`}
                />
              )}
              <line
                x1={260 + nodePositions[from].x}
                y1={260 + nodePositions[from].y}
                x2={260 + nodePositions[to].x}
                y2={260 + nodePositions[to].y}
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
          const x = 260 + from.x + (to.x - from.x) * pulse.progress;
          const y = 260 + from.y + (to.y - from.y) * pulse.progress;

          return (
            <g key={pulse.id}>
              <circle cx={x} cy={y} r={9} fill={`url(#${pulseGradId})`} opacity={0.55} />
              <circle
                cx={x}
                cy={y}
                r={3.2}
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
 * Pure visual brand showcase ("استعراض دخول") displayed before the operational
 * SSOT SplashScreen. Shares the exact industrial Excel-Twin background and visual
 * spirit of SplashScreen without fake progress bars or simulated loading messages.
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

  const phases: ShowcasePhase[] = useMemo(
    () => [
      { duration: 580 * durationMultiplier, icon: BrainCircuit },
      { duration: 640 * durationMultiplier, icon: Layers },
      { duration: 600 * durationMultiplier, icon: Zap },
      { duration: 540 * durationMultiplier, icon: Activity },
      { duration: 340 * durationMultiplier, icon: CheckCircle2 },
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

  const [activeNodes, setActiveNodes] = useState<Set<number>>(() => new Set([0, 3, 6, 9]));
  const [phaseIndex, setPhaseIndex] = useState(0);
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

  // Visual showcase icon & orbital animation progression until completion
  useEffect(() => {
    if (isComplete || isExiting) return;
    const currentPhase = phases[phaseIndex];
    if (!currentPhase) return;

    const timer = setTimeout(() => {
      if (phaseIndex < phases.length - 1) {
        setPhaseIndex((prev) => prev + 1);
      } else {
        setIsComplete(true);
        finishTimerRef.current = setTimeout(() => {
          triggerFinish();
        }, 260);
      }
    }, currentPhase.duration);

    return () => clearTimeout(timer);
  }, [phaseIndex, isComplete, isExiting, phases, triggerFinish]);

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

  const CurrentIcon = phases[phaseIndex]?.icon ?? BrainCircuit;

  return (
    <div
      role="region"
      aria-label="Présentation d'accueil CIOB GMAO Nexus"
      className={`${
        isFull
          ? 'fixed inset-0 z-[100] p-4 sm:p-8 justify-between'
          : 'relative w-full h-[calc(85vh-100px)] min-h-[500px] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 justify-center'
      } bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col items-center overflow-hidden select-none font-sans transition-all duration-300 ${
        isExiting ? 'opacity-0 scale-[1.015] pointer-events-none' : 'opacity-100 scale-100'
      }`}
    >
      {/* Background Excel Grid Subtle Lines & Ambient Orbs — Identical to SplashScreen */}
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none bg-[radial-gradient(#107c41_1px,transparent_1px)] [background-size:20px_20px]" />
      <div className="absolute -top-32 -right-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <EnhancedParticles />

      {/* Top Header Row — Matched to SplashScreen Architecture */}
      {isFull && (
        <div className="w-full max-w-2xl flex justify-between items-center z-30">
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3.5 py-1.5 rounded-full shadow-xs">
            <FileSpreadsheet className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            <span className="text-[11px] font-mono tracking-wide text-slate-700 dark:text-slate-200 font-bold">
              Classeur Virtuel GMAO • Jumeau Numérique
            </span>
          </div>

          {showSkipButton && (
            <button
              type="button"
              onClick={triggerFinish}
              className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 hover:text-emerald-800 dark:hover:text-emerald-300 transition bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 px-3.5 py-1.5 rounded-full shadow-xs cursor-pointer font-medium"
              title="Passer directement à l'inspection système"
            >
              <span>Passer l&apos;intro</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Center Animated Emblem & Brand Identity */}
      <div className="z-20 my-auto flex flex-col items-center justify-center text-center">
        <div
          className={`relative mb-12 sm:mb-14 ${
            !isFull ? 'scale-75' : 'scale-90 sm:scale-100'
          } neural-reduced-static`}
          style={{ animation: 'neuralFloat 5.5s ease-in-out infinite' }}
        >
          {isFull && (
            <>
              <div
                className="absolute inset-[-68px] blur-[80px] rounded-full animate-pulse neural-reduced-static pointer-events-none"
                style={{
                  background:
                    'radial-gradient(circle, rgba(var(--color-accent-rgb, 5, 150, 105), 0.22), transparent 70%)',
                  animationDuration: '3s',
                }}
              />
              <div
                className="absolute inset-[-40px] blur-[48px] rounded-full animate-pulse neural-reduced-static pointer-events-none"
                style={{
                  background:
                    'radial-gradient(circle, rgba(var(--color-accent-rgb, 5, 150, 105), 0.15), transparent 70%)',
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

          {/* Industrial Glass Emblem Card with Top Emerald Stripe */}
          <div
            className="relative bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl p-8 sm:p-9 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-xl transition-all duration-700 z-20 overflow-hidden"
            style={{
              boxShadow:
                'var(--shadow-glass), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
            }}
          >
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-600 via-green-500 to-emerald-700" />

            <CurrentIcon
              className={`h-20 w-20 sm:h-22 sm:w-22 transition-all duration-500 ${
                isComplete ? 'scale-110' : 'animate-pulse'
              } neural-reduced-static`}
              style={{
                color: 'var(--color-accent-600, #059669)',
                filter:
                  'drop-shadow(0 0 16px rgba(var(--color-accent-rgb, 5, 150, 105), 0.35))',
              }}
            />
            <div
              className="absolute inset-0 border rounded-3xl animate-ping opacity-25 neural-reduced-static pointer-events-none"
              style={{
                borderColor: 'rgba(var(--color-accent-rgb, 5, 150, 105), 0.4)',
                animationDuration: '3s',
              }}
            />
          </div>

          {nodePositions.map((pos, i) => (
            <EnhancedNeuralNode key={i} position={pos} isActive={activeNodes.has(i)} />
          ))}
        </div>

        {/* Clean Brand Title & Tagline (No Fake Progress Bar or Simulated Loading Strings) */}
        {isFull && (
          <div className="space-y-1.5 px-6">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              <span>{appName}</span>{' '}
              <span className="text-emerald-700 dark:text-emerald-400">
                {appAccent}
              </span>
            </h1>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 tracking-wide">
              {tagline}
            </p>
          </div>
        )}
      </div>

      {/* Footer Version Stamp — Matched to SplashScreen */}
      {isFull && (
        <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono z-20">
          {version}
        </div>
      )}
    </div>
  );
}

export default NeuralLoader;
