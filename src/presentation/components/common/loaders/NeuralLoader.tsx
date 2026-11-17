import {
  useEffect,
  useState,
  useMemo,
  useRef,
  useCallback,
  useId,
  memo,
  type ComponentType,
} from 'react';
import {
  LayoutDashboard,
  Package,
  Factory,
  Calendar,
  Wrench,
  Warehouse,
  MapPin,
  Users,
  GitBranch,
  BookOpen,
  Settings,
  Clock,
  Landmark,
  FileBarChart2,
  ShieldCheck,
  ArrowRight,
  FileSpreadsheet,
} from 'lucide-react';
import SortieEntreeIcon from '../SortieEntreeIcon';

const CONFIG = {
  nodes: {
    count: 16,
    radius: 156,
    size: 10,
  },
  network: {
    lineWidth: 1.35,
    pulseSpeed: 1300,
  },
  rings: {
    radiiOffsets: [34, 56, 78],
    speeds: [34, 26, 42],
  },
  particles: {
    count: 14,
    maxSize: 3,
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
  id: string;
  duration: number;
  icon: ComponentType<any>;
  colorHex: string;
  tintRgba: string;
  isDualMovement?: boolean;
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
  tone: 'emerald' | 'blue';
}

/**
 * Canonical 16-page icon sequence ordered exactly as specified,
 * paired with authentic Light Excel UI PageHeaderIcon colors from the codebase:
 *  1. dashboard            -> LayoutDashboard (blue-700   #1d4ed8)
 *  2. stock article        -> Package         (cyan-700   #0e7490)
 *  3. entri sortie rapide  -> SortieEntreeIcon(emerald-600 + rose-600)
 *  4. machine registered   -> Factory         (emerald-700 #047857)
 *  5. planning preventive  -> Calendar        (indigo-700 #4338ca)
 *  6. corrective           -> Wrench          (amber-700  #b45309)
 *  7. entrepot             -> Warehouse       (indigo-700 #4338ca)
 *  8. zone                 -> MapPin          (purple-700 #7e22ce)
 *  9. utilisateur          -> Users           (purple-700 #7e22ce)
 * 10. nexus                -> GitBranch       (emerald-700 #047857)
 * 11. guide                -> BookOpen        (amber-600  #d97706)
 * 12. setting              -> Settings        (sky-700    #0369a1)
 * 13. rapports vacation    -> Clock           (emerald-700 #047857)
 * 14. pilotage             -> Landmark        (emerald-700 #047857)
 * 15. rapports mensuel     -> FileBarChart2   (indigo-600 #4f46e5)
 * 16. validation           -> ShieldCheck     (rose-600   #e11d48)
 */
const CANONICAL_SHOWCASE_ICONS: ReadonlyArray<Omit<ShowcasePhase, 'duration'>> = [
  {
    id: 'dashboard',
    icon: LayoutDashboard,
    colorHex: '#1d4ed8',
    tintRgba: 'rgba(29, 78, 216, 0.14)',
  },
  {
    id: 'stock_article',
    icon: Package,
    colorHex: '#0e7490',
    tintRgba: 'rgba(14, 116, 144, 0.14)',
  },
  {
    id: 'entree_sortie_rapide',
    icon: SortieEntreeIcon,
    colorHex: '#059669',
    tintRgba: 'rgba(5, 150, 105, 0.14)',
    isDualMovement: true,
  },
  {
    id: 'machine_registered',
    icon: Factory,
    colorHex: '#047857',
    tintRgba: 'rgba(4, 120, 87, 0.14)',
  },
  {
    id: 'planning_preventive',
    icon: Calendar,
    colorHex: '#4338ca',
    tintRgba: 'rgba(67, 56, 202, 0.14)',
  },
  {
    id: 'corrective',
    icon: Wrench,
    colorHex: '#b45309',
    tintRgba: 'rgba(180, 83, 9, 0.14)',
  },
  {
    id: 'entrepot',
    icon: Warehouse,
    colorHex: '#4338ca',
    tintRgba: 'rgba(67, 56, 202, 0.14)',
  },
  {
    id: 'zone',
    icon: MapPin,
    colorHex: '#7e22ce',
    tintRgba: 'rgba(126, 34, 206, 0.14)',
  },
  {
    id: 'utilisateur',
    icon: Users,
    colorHex: '#7e22ce',
    tintRgba: 'rgba(126, 34, 206, 0.14)',
  },
  {
    id: 'nexus',
    icon: GitBranch,
    colorHex: '#047857',
    tintRgba: 'rgba(4, 120, 87, 0.14)',
  },
  {
    id: 'guide',
    icon: BookOpen,
    colorHex: '#d97706',
    tintRgba: 'rgba(217, 119, 6, 0.14)',
  },
  {
    id: 'setting',
    icon: Settings,
    colorHex: '#0369a1',
    tintRgba: 'rgba(3, 105, 161, 0.14)',
  },
  {
    id: 'rapports_vacation',
    icon: Clock,
    colorHex: '#047857',
    tintRgba: 'rgba(4, 120, 87, 0.14)',
  },
  {
    id: 'pilotage',
    icon: Landmark,
    colorHex: '#047857',
    tintRgba: 'rgba(4, 120, 87, 0.14)',
  },
  {
    id: 'rapports_mensuel',
    icon: FileBarChart2,
    colorHex: '#4f46e5',
    tintRgba: 'rgba(79, 70, 229, 0.14)',
  },
  {
    id: 'validation',
    icon: ShieldCheck,
    colorHex: '#e11d48',
    tintRgba: 'rgba(225, 29, 72, 0.14)',
  },
];

const LightExcelParticles = memo(({ count = CONFIG.particles.count }: { count?: number }) => {
  const particles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const seedA = ((i * 37 + 13) % 97) / 97;
        const seedB = ((i * 53 + 29) % 89) / 89;
        const seedC = ((i * 19 + 7) % 43) / 43;
        const isBlue = i % 3 === 0;
        return {
          left: `${(seedA * 90 + 5).toFixed(2)}%`,
          top: `${(seedB * 86 + 7).toFixed(2)}%`,
          size:
            CONFIG.particles.minSize +
            seedC * (CONFIG.particles.maxSize - CONFIG.particles.minSize),
          duration: 5 + seedA * 4,
          delay: seedB * 2.4,
          isBlue,
        };
      }),
    [count]
  );

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((particle, i) => (
        <div
          key={i}
          className="absolute rounded-full neural-reduced-static opacity-60"
          style={{
            left: particle.left,
            top: particle.top,
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            background: particle.isBlue
              ? 'radial-gradient(circle, rgba(37, 99, 235, 0.7), transparent)'
              : 'radial-gradient(circle, rgba(16, 124, 65, 0.75), transparent)',
            boxShadow: particle.isBlue
              ? `0 0 ${particle.size * 3.5}px rgba(37, 99, 235, 0.3)`
              : `0 0 ${particle.size * 3.5}px rgba(5, 150, 105, 0.35)`,
            animation: `neuralFloat ${particle.duration}s ease-in-out infinite`,
            animationDelay: `${particle.delay}s`,
          }}
        />
      ))}
    </div>
  );
});
LightExcelParticles.displayName = 'LightExcelParticles';

const LightExcelOrbitRings = memo(({ isComplete }: { isComplete: boolean }) => (
  <>
    {CONFIG.rings.radiiOffsets.map((offset, i) => {
      const isBlueRing = i === 1;
      const borderColor = isBlueRing
        ? `rgba(37, 99, 235, ${isComplete ? 0.28 : 0.16})`
        : `rgba(16, 124, 65, ${isComplete ? 0.34 : 0.18})`;

      return (
        <div
          key={i}
          className="absolute rounded-full transition-all duration-700 neural-reduced-static pointer-events-none"
          style={{
            inset: `-${offset}px`,
            border: `1px ${i === 0 ? 'dashed' : 'solid'} ${borderColor}`,
            animation: `neuralRotate ${CONFIG.rings.speeds[i]}s linear infinite ${
              i % 2 === 1 ? 'reverse' : ''
            }`,
          }}
        />
      );
    })}
  </>
));
LightExcelOrbitRings.displayName = 'LightExcelOrbitRings';

const LightExcelNode = memo(
  ({
    position,
    isVisited,
    isCurrentStep,
  }: {
    position: NodePosition;
    isVisited: boolean;
    isCurrentStep: boolean;
  }) => {
    return (
      <div
        className="absolute pointer-events-none"
        style={{
          top: `calc(50% + ${position.y}px)`,
          left: `calc(50% + ${position.x}px)`,
          transform: 'translate(-50%, -50%)',
        }}
      >
        {isCurrentStep && (
          <div
            className="absolute inset-[-11px] rounded-full animate-ping neural-reduced-static"
            style={{
              background:
                'radial-gradient(circle, rgba(16, 185, 129, 0.38), transparent 72%)',
              animationDuration: '1.6s',
            }}
          />
        )}

        <div
          className="relative rounded-full transition-all duration-500 flex items-center justify-center"
          style={{
            width: isCurrentStep ? '13px' : `${CONFIG.nodes.size}px`,
            height: isCurrentStep ? '13px' : `${CONFIG.nodes.size}px`,
            backgroundColor: isCurrentStep
              ? '#059669'
              : isVisited
                ? '#10b981'
                : '#ffffff',
            border: isCurrentStep
              ? '2px solid #ffffff'
              : isVisited
                ? '1.5px solid #047857'
                : '1.5px solid #cbd5e1',
            boxShadow: isCurrentStep
              ? '0 0 0 3px rgba(16, 185, 129, 0.25), 0 0 14px rgba(5, 150, 105, 0.55)'
              : isVisited
                ? '0 0 8px rgba(16, 185, 129, 0.35)'
                : '0 1px 2px rgba(15, 23, 42, 0.08)',
            transform: isCurrentStep ? 'scale(1.18)' : isVisited ? 'scale(1.04)' : 'scale(1)',
          }}
        >
          <span
            className="rounded-full transition-colors duration-300"
            style={{
              width: isCurrentStep ? '4px' : '3px',
              height: isCurrentStep ? '4px' : '3px',
              backgroundColor: isCurrentStep || isVisited ? '#ffffff' : '#94a3b8',
            }}
          />
        </div>
      </div>
    );
  }
);
LightExcelNode.displayName = 'LightExcelNode';

const LightExcelConstellation = memo(
  ({
    nodePositions,
    visitedCount,
    currentIndex,
    pulses,
  }: {
    nodePositions: NodePosition[];
    visitedCount: number;
    currentIndex: number;
    pulses: NeuralPulse[];
  }) => {
    const uid = useId().replace(/:/g, '');
    const activeGradId = `ciob-excel-active-${uid}`;
    const pulseEmeraldId = `ciob-excel-pulse-emerald-${uid}`;
    const pulseBlueId = `ciob-excel-pulse-blue-${uid}`;

    // Clean architectural geometry:
    // 1) Perimeter 16-gon linking adjacent module pins
    // 2) Harmonic 4-step cross chords linking opposing quadrants cleanly
    const connections = useMemo(() => {
      const conns: Array<{ from: number; to: number; kind: 'perimeter' | 'chord' }> = [];
      const n = nodePositions.length;
      for (let i = 0; i < n; i++) {
        conns.push({ from: i, to: (i + 1) % n, kind: 'perimeter' });
        if (i < n / 2) {
          conns.push({ from: i, to: (i + 4) % n, kind: 'chord' });
        }
      }
      return conns;
    }, [nodePositions.length]);

    return (
      <svg
        className="absolute inset-0 pointer-events-none"
        style={{
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '460px',
          height: '460px',
        }}
      >
        <defs>
          <linearGradient id={activeGradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#059669" stopOpacity="0.85" />
            <stop offset="50%" stopColor="#10b981" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#2563eb" stopOpacity="0.8" />
          </linearGradient>

          <radialGradient id={pulseEmeraldId}>
            <stop offset="0%" stopColor="#10b981" stopOpacity="1" />
            <stop offset="65%" stopColor="#059669" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#059669" stopOpacity="0" />
          </radialGradient>

          <radialGradient id={pulseBlueId}>
            <stop offset="0%" stopColor="#60a5fa" stopOpacity="1" />
            <stop offset="65%" stopColor="#2563eb" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
          </radialGradient>
        </defs>

        {connections.map(({ from, to, kind }, idx) => {
          const touchesCurrent = from === currentIndex || to === currentIndex;
          const bothVisited = from <= visitedCount && to <= visitedCount;
          const isPerimeter = kind === 'perimeter';

          const stroke = touchesCurrent
            ? `url(#${activeGradId})`
            : bothVisited && isPerimeter
              ? '#10b981'
              : '#94a3b8';

          const opacity = touchesCurrent
            ? 0.72
            : bothVisited
              ? isPerimeter
                ? 0.36
                : 0.16
              : isPerimeter
                ? 0.22
                : 0.11;

          const strokeWidth = touchesCurrent
            ? CONFIG.network.lineWidth * 1.3
            : isPerimeter
              ? CONFIG.network.lineWidth
              : 1;

          return (
            <line
              key={idx}
              x1={230 + nodePositions[from].x}
              y1={230 + nodePositions[from].y}
              x2={230 + nodePositions[to].x}
              y2={230 + nodePositions[to].y}
              stroke={stroke}
              strokeWidth={strokeWidth}
              opacity={opacity}
              strokeLinecap="round"
              style={{ transition: 'opacity 0.35s ease-out, stroke 0.35s ease-out' }}
            />
          );
        })}

        {pulses.map((pulse) => {
          if (pulse.fromNode >= nodePositions.length || pulse.toNode >= nodePositions.length) {
            return null;
          }
          const from = nodePositions[pulse.fromNode];
          const to = nodePositions[pulse.toNode];
          const x = 230 + from.x + (to.x - from.x) * pulse.progress;
          const y = 230 + from.y + (to.y - from.y) * pulse.progress;
          const isBlue = pulse.tone === 'blue';

          return (
            <g key={pulse.id}>
              <circle
                cx={x}
                cy={y}
                r={7}
                fill={`url(#${isBlue ? pulseBlueId : pulseEmeraldId})`}
                opacity={0.65}
              />
              <circle
                cx={x}
                cy={y}
                r={2.5}
                fill={isBlue ? '#3b82f6' : '#10b981'}
              />
            </g>
          );
        })}
      </svg>
    );
  }
);
LightExcelConstellation.displayName = 'LightExcelConstellation';

function renderPhaseIcon(
  phase: ShowcasePhase,
  animClass: string,
  extraScale = false
) {
  const Icon = phase.icon;
  if (phase.isDualMovement) {
    return (
      <Icon
        downColor="text-emerald-600 dark:text-emerald-400"
        upColor="text-rose-600 dark:text-rose-400"
        className={`h-16 w-16 sm:h-20 sm:w-20 ${animClass} ${
          extraScale ? 'scale-105' : ''
        }`}
      />
    );
  }
  return (
    <Icon
      className={`h-16 w-16 sm:h-20 sm:w-20 ${animClass} ${
        extraScale ? 'scale-105' : ''
      }`}
      style={{ color: phase.colorHex }}
    />
  );
}

/**
 * NeuralLoader
 * Mature Light Excel UI intro showcase displayed strictly before the operational
 * SSOT SplashScreen. Reveals the 16 canonical Level-1 and special page icons in
 * exact sequence with gradual crossfade transitions, authentic Light Excel UI
 * semantic colors, and an Emerald/Steel-Blue architectural constellation.
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
  // Unhurried showcase dwell in fullscreen (~460ms per icon) for clear gradual reveal
  const stepDurationMs = isFull ? 460 : 75;

  const phases: ShowcasePhase[] = useMemo(
    () =>
      CANONICAL_SHOWCASE_ICONS.map((item) => ({
        ...item,
        duration: stepDurationMs,
      })),
    [stepDurationMs]
  );

  const nodePositions = useMemo<NodePosition[]>(
    () =>
      Array.from({ length: CONFIG.nodes.count }, (_, i) => {
        const angleDeg = -90 + i * (360 / CONFIG.nodes.count);
        const angleRad = angleDeg * (Math.PI / 180);
        return {
          x: Math.cos(angleRad) * CONFIG.nodes.radius,
          y: Math.sin(angleRad) * CONFIG.nodes.radius,
          angle: angleDeg,
        };
      }),
    []
  );

  const [phaseIndex, setPhaseIndex] = useState(0);
  const [prevPhaseIndex, setPrevPhaseIndex] = useState<number | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [pulses, setPulses] = useState<NeuralPulse[]>([]);

  const completedRef = useRef(false);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

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

  // Gradual sequential 16-page icon progression
  useEffect(() => {
    if (isComplete || isExiting) return;
    const currentPhase = phases[phaseIndex];
    if (!currentPhase) return;

    const timer = setTimeout(() => {
      if (phaseIndex < phases.length - 1) {
        setPrevPhaseIndex(phaseIndex);
        setPhaseIndex((prev) => prev + 1);
      } else {
        setIsComplete(true);
        finishTimerRef.current = setTimeout(() => {
          triggerFinish();
        }, isFull ? 380 : 250);
      }
    }, currentPhase.duration);

    return () => clearTimeout(timer);
  }, [phaseIndex, isComplete, isExiting, phases, triggerFinish, isFull]);

  // Traveling Light Excel Emerald & Blue pulses along perimeter & chords
  useEffect(() => {
    if (isComplete || isExiting || nodePositions.length === 0) return;
    const pulseIntervals = new Set<ReturnType<typeof setInterval>>();
    const pulseTimeouts = new Set<ReturnType<typeof setTimeout>>();

    const interval = setInterval(() => {
      const fromNode = phaseIndex % CONFIG.nodes.count;
      const useChord = Math.random() > 0.45;
      const toNode = useChord
        ? (fromNode + 4) % CONFIG.nodes.count
        : (fromNode + 1) % CONFIG.nodes.count;

      const newPulse: NeuralPulse = {
        id: Date.now() + Math.random(),
        fromNode,
        toNode,
        progress: 0,
        tone: useChord ? 'blue' : 'emerald',
      };
      setPulses((prev) => [...prev.slice(-5), newPulse]);

      const stepTimer = setInterval(() => {
        setPulses((prev) =>
          prev.map((p) =>
            p.id === newPulse.id ? { ...p, progress: Math.min(p.progress + 0.065, 1) } : p
          )
        );
      }, 42);
      pulseIntervals.add(stepTimer);

      const cleanupTimer = setTimeout(() => {
        clearInterval(stepTimer);
        pulseIntervals.delete(stepTimer);
        pulseTimeouts.delete(cleanupTimer);
        setPulses((prev) => prev.filter((p) => p.id !== newPulse.id));
      }, CONFIG.network.pulseSpeed);
      pulseTimeouts.add(cleanupTimer);
    }, 520);

    return () => {
      clearInterval(interval);
      pulseIntervals.forEach(clearInterval);
      pulseTimeouts.forEach(clearTimeout);
    };
  }, [phaseIndex, isComplete, isExiting, nodePositions.length]);

  const currentPhase = phases[phaseIndex] ?? phases[0];
  const previousPhase = prevPhaseIndex !== null ? phases[prevPhaseIndex] : null;

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

      <LightExcelParticles />

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
          style={{ animation: 'neuralFloat 6s ease-in-out infinite' }}
        >
          {isFull && (
            <>
              {/* Soft Excel Emerald & Steel-Blue Ambient Halo */}
              <div
                className="absolute inset-[-64px] blur-[72px] rounded-full pointer-events-none"
                style={{
                  background:
                    'radial-gradient(circle, rgba(16, 185, 129, 0.16), rgba(37, 99, 235, 0.08) 58%, transparent 74%)',
                }}
              />
              {/* Subtle Adaptive Inner Glow Matching Current Module Icon */}
              <div
                className="absolute inset-[-28px] blur-[34px] rounded-full transition-colors duration-500 pointer-events-none"
                style={{
                  background: `radial-gradient(circle, ${currentPhase.tintRgba}, transparent 72%)`,
                }}
              />
            </>
          )}

          <LightExcelOrbitRings isComplete={isComplete} />
          <LightExcelConstellation
            nodePositions={nodePositions}
            visitedCount={phaseIndex}
            currentIndex={phaseIndex}
            pulses={pulses}
          />

          {/* Mature Light Excel White Card Emblem with Signature Top Emerald Stripe */}
          <div
            data-showcase-module={currentPhase.id}
            className="relative w-32 h-32 sm:w-36 sm:h-36 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-3xl border border-slate-200 dark:border-slate-700/80 shadow-xl flex items-center justify-center z-20 overflow-hidden transition-shadow duration-500"
            style={{
              boxShadow:
                '0 20px 45px -12px rgba(15, 23, 42, 0.12), 0 6px 18px -4px rgba(16, 124, 65, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.9)',
            }}
          >
            {/* Top Excel Banner Stripe (Identical to SplashScreen Card) */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-600 via-green-500 to-emerald-700" />

            {/* Subtle Spreadsheet Micro-Grid Inside Emblem */}
            <div
              className="absolute inset-0 opacity-[0.04] pointer-events-none"
              style={{
                backgroundImage:
                  'linear-gradient(to right, #0f172a 1px, transparent 1px), linear-gradient(to bottom, #0f172a 1px, transparent 1px)',
                backgroundSize: '14px 14px',
              }}
            />

            {/* Two-Layer Crossfade Icon Stage for Smooth Gradual Reveal */}
            <div className="relative w-20 h-20 sm:w-22 sm:h-22 flex items-center justify-center">
              {previousPhase && previousPhase.id !== currentPhase.id && (
                <div
                  key={`exit-${previousPhase.id}`}
                  className="absolute inset-0 flex items-center justify-center pointer-events-none"
                >
                  {renderPhaseIcon(previousPhase, 'neural-icon-exit')}
                </div>
              )}

              <div
                key={`enter-${currentPhase.id}`}
                className="absolute inset-0 flex items-center justify-center"
              >
                {renderPhaseIcon(currentPhase, 'neural-icon-enter', isComplete)}
              </div>
            </div>
          </div>

          {nodePositions.map((pos, i) => (
            <LightExcelNode
              key={i}
              position={pos}
              isVisited={i < phaseIndex}
              isCurrentStep={i === phaseIndex}
            />
          ))}
        </div>

        {/* Clean Brand Title & Tagline */}
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
