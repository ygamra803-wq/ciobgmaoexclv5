import {
  useEffect,
  useState,
  useMemo,
  useRef,
  useCallback,
  useId,
  memo,
} from 'react';
import { ArrowRight, FileSpreadsheet } from 'lucide-react';

const SVG_NS = 'http://www.w3.org/2000/svg';

const NEURAL_CORE_CONFIG = {
  nodeCount: 12,
  radius: 160,
  connectionThreshold: 200,
  maxConcurrentPulses: 10,
  ringSpeeds: [25, 20, 15, 12, 10] as const,
  ringOpacities: [0.12, 0.16, 0.2, 0.24, 0.28] as const,
  initialActiveNodes: [0, 2, 5, 7, 10] as const,
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

interface CoreNodeGeom {
  idx: number;
  x: number;
  y: number;
}

interface CoreEdgeGeom {
  from: number;
  to: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  dist: number;
}

interface ActiveSynapticPulse {
  fromIdx: number;
  toIdx: number;
  hopsLeft: number;
  from: CoreNodeGeom;
  to: CoreNodeGeom;
  start: number;
  duration: number;
  group: SVGGElement;
  tailGrad: SVGLinearGradientElement;
  trail: SVGLineElement;
  halo: SVGCircleElement;
  coreDot: SVGCircleElement;
  hotTip: SVGCircleElement;
}

/**
 * Canonical 16-module showcase sequence IDs (preserved for intro duration pacing
 * and showcase telemetry attribute `data-showcase-module`).
 */
const CANONICAL_SHOWCASE_MODULES: ReadonlyArray<string> = [
  'dashboard',
  'stock_article',
  'entree_sortie_rapide',
  'machine_registered',
  'planning_preventive',
  'corrective',
  'entrepot',
  'zone',
  'utilisateur',
  'nexus',
  'guide',
  'setting',
  'rapports_vacation',
  'pilotage',
  'rapports_mensuel',
  'validation',
];

/**
 * Precomputed 12-node Neural Core radial geometry & woven synaptic graph
 * (matches Neural Core — Light Mode spec: R=160, threshold=200).
 */
const CORE_GEOMETRY = (() => {
  const nodes: CoreNodeGeom[] = [];
  const adjacency: number[][] = Array.from(
    { length: NEURAL_CORE_CONFIG.nodeCount },
    () => []
  );

  for (let i = 0; i < NEURAL_CORE_CONFIG.nodeCount; i++) {
    const angle = (i * (360 / NEURAL_CORE_CONFIG.nodeCount) * Math.PI) / 180;
    nodes.push({
      idx: i,
      x: Math.cos(angle) * NEURAL_CORE_CONFIG.radius,
      y: Math.sin(angle) * NEURAL_CORE_CONFIG.radius,
    });
  }

  const edges: CoreEdgeGeom[] = [];
  const edgeDistMap = new Map<string, number>();

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dist = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
      if (dist < NEURAL_CORE_CONFIG.connectionThreshold) {
        adjacency[i].push(j);
        adjacency[j].push(i);
        edgeDistMap.set(`${i}-${j}`, dist);
        edgeDistMap.set(`${j}-${i}`, dist);
        edges.push({
          from: i,
          to: j,
          x1: 300 + nodes[i].x,
          y1: 300 + nodes[i].y,
          x2: 300 + nodes[j].x,
          y2: 300 + nodes[j].y,
          dist,
        });
      }
    }
  }

  return { nodes, edges, adjacency, edgeDistMap };
})();

const LightExcelParticles = memo(
  ({ count = NEURAL_CORE_CONFIG.particles.count }: { count?: number }) => {
    const particles = useMemo(
      () =>
        Array.from({ length: count }, (_, i) => {
          const seedA = ((i * 37 + 13) % 97) / 97;
          const seedB = ((i * 53 + 29) % 89) / 89;
          const seedC = ((i * 19 + 7) % 43) / 43;
          return {
            left: `${(seedA * 90 + 5).toFixed(2)}%`,
            top: `${(seedB * 86 + 7).toFixed(2)}%`,
            size:
              NEURAL_CORE_CONFIG.particles.minSize +
              seedC *
                (NEURAL_CORE_CONFIG.particles.maxSize -
                  NEURAL_CORE_CONFIG.particles.minSize),
            duration: 5 + seedA * 4,
            delay: seedB * 2.4,
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
              background: 'radial-gradient(circle, rgba(16, 185, 129, 0.7), transparent)',
              boxShadow: `0 0 ${particle.size * 3.5}px rgba(5, 150, 105, 0.35)`,
              animation: `neuralFloat ${particle.duration}s ease-in-out infinite`,
              animationDelay: `${particle.delay}s`,
            }}
          />
        ))}
      </div>
    );
  }
);
LightExcelParticles.displayName = 'LightExcelParticles';

/**
 * NeuralCoreEmblem
 * Exact reproduction of the Neural Core Light Mode element (cube, BrainCircuit icon,
 * 5 orbital rings, 12 multi-layer nodes, directional-gradient SVG lines, and 60fps
 * synaptic chain pulses) styled in CIOB GMAO Emerald Green.
 */
const NeuralCoreEmblem = memo(
  ({
    currentModuleId,
    isExiting,
  }: {
    currentModuleId: string;
    isExiting: boolean;
  }) => {
    const uid = useId().replace(/:/g, '');
    const pulseHeadGradId = `nc-pulse-head-${uid}`;
    const glowFilterId = `nc-glow-filter-${uid}`;
    const edgeGradPrefix = `nc-edge-grad-${uid}`;
    const tailGradPrefix = `nc-tail-grad-${uid}`;

    const svgDefsRef = useRef<SVGDefsElement | null>(null);
    const pulsesLayerRef = useRef<SVGGElement | null>(null);
    const nodeElsRef = useRef<Array<HTMLDivElement | null>>([]);
    const baseLineRefs = useRef<Array<SVGLineElement | null>>([]);
    const glowLineRefs = useRef<Array<SVGLineElement | null>>([]);

    useEffect(() => {
      if (isExiting) return;

      const activeNodes = new Set<number>(NEURAL_CORE_CONFIG.initialActiveNodes);
      const activePulses: ActiveSynapticPulse[] = [];
      const hitTimers = new Set<ReturnType<typeof setTimeout>>();
      let pulseCounter = 0;
      let rafId: number | null = null;
      let disposed = false;

      const syncNodeClasses = () => {
        for (let i = 0; i < CORE_GEOMETRY.nodes.length; i++) {
          const el = nodeElsRef.current[i];
          if (!el) continue;
          el.classList.toggle('active', activeNodes.has(i));
        }
      };

      const syncConnections = () => {
        for (let idx = 0; idx < CORE_GEOMETRY.edges.length; idx++) {
          const edge = CORE_GEOMETRY.edges[idx];
          const baseLine = baseLineRefs.current[idx];
          const glowLine = glowLineRefs.current[idx];
          if (!baseLine || !glowLine) continue;

          const a = activeNodes.has(edge.from);
          const b = activeNodes.has(edge.to);
          const both = a && b;
          const any = a || b;

          const opacity = both ? 0.92 : any ? 0.58 : 0.25;
          const width = both ? 3 : 2;

          baseLine.setAttribute('stroke-width', String(width));
          baseLine.setAttribute('opacity', String(opacity));

          glowLine.setAttribute('stroke-width', String(width + 3.5));
          glowLine.setAttribute('opacity', String(any ? opacity * 0.28 : 0));
        }
      };

      const triggerNodeHit = (idx: number) => {
        const el = nodeElsRef.current[idx];
        if (!el) return;

        if (!activeNodes.has(idx)) {
          activeNodes.add(idx);
          el.classList.add('active');
          syncConnections();
        }

        el.classList.remove('synapse-hit');
        void el.offsetWidth;
        el.classList.add('synapse-hit');

        const timer = setTimeout(() => {
          hitTimers.delete(timer);
          el.classList.remove('synapse-hit');
        }, 240);
        hitTimers.add(timer);
      };

      const spawnPulse = (
        fromIdx: number,
        toIdx?: number,
        hopsLeft = 2,
        prevIdx = -1
      ) => {
        if (disposed) return;
        const svgDefs = svgDefsRef.current;
        const pulsesLayer = pulsesLayerRef.current;
        if (!svgDefs || !pulsesLayer) return;
        if (activePulses.length >= NEURAL_CORE_CONFIG.maxConcurrentPulses) return;

        const neighbors = CORE_GEOMETRY.adjacency[fromIdx];
        if (!neighbors || neighbors.length === 0) return;

        let targetIdx = toIdx;
        if (targetIdx === undefined) {
          const preferred = neighbors.filter((n) => n !== prevIdx);
          const pool = preferred.length > 0 ? preferred : neighbors;
          targetIdx = pool[Math.floor(Math.random() * pool.length)];
        }

        const id = ++pulseCounter;
        const gradId = `${tailGradPrefix}-${id}`;
        const dist = CORE_GEOMETRY.edgeDistMap.get(`${fromIdx}-${targetIdx}`) || 120;

        const tailGrad = document.createElementNS(
          SVG_NS,
          'linearGradient'
        ) as SVGLinearGradientElement;
        tailGrad.setAttribute('id', gradId);
        tailGrad.setAttribute('gradientUnits', 'userSpaceOnUse');

        const stop0 = document.createElementNS(SVG_NS, 'stop');
        stop0.setAttribute('offset', '0%');
        stop0.setAttribute('stop-color', 'hsl(var(--nc-primary))');
        stop0.setAttribute('stop-opacity', '0');

        const stop1 = document.createElementNS(SVG_NS, 'stop');
        stop1.setAttribute('offset', '65%');
        stop1.setAttribute('stop-color', 'hsl(var(--nc-primary-deep))');
        stop1.setAttribute('stop-opacity', '0.95');

        const stop2 = document.createElementNS(SVG_NS, 'stop');
        stop2.setAttribute('offset', '100%');
        stop2.setAttribute('stop-color', '#ffffff');
        stop2.setAttribute('stop-opacity', '1');

        tailGrad.appendChild(stop0);
        tailGrad.appendChild(stop1);
        tailGrad.appendChild(stop2);
        svgDefs.appendChild(tailGrad);

        const group = document.createElementNS(SVG_NS, 'g') as SVGGElement;

        const trail = document.createElementNS(SVG_NS, 'line') as SVGLineElement;
        trail.setAttribute('stroke', `url(#${gradId})`);
        trail.setAttribute('stroke-width', '3.5');
        trail.setAttribute('stroke-linecap', 'round');
        trail.setAttribute('filter', `url(#${glowFilterId})`);

        const halo = document.createElementNS(SVG_NS, 'circle') as SVGCircleElement;
        halo.setAttribute('r', '12');
        halo.setAttribute('fill', `url(#${pulseHeadGradId})`);
        halo.setAttribute('opacity', '0.75');

        const coreDot = document.createElementNS(SVG_NS, 'circle') as SVGCircleElement;
        coreDot.setAttribute('r', '4');
        coreDot.setAttribute('fill', 'hsl(var(--nc-primary-deep))');
        coreDot.setAttribute('filter', `url(#${glowFilterId})`);

        const hotTip = document.createElementNS(SVG_NS, 'circle') as SVGCircleElement;
        hotTip.setAttribute('r', '1.8');
        hotTip.setAttribute('fill', '#ffffff');

        group.appendChild(trail);
        group.appendChild(halo);
        group.appendChild(coreDot);
        group.appendChild(hotTip);
        pulsesLayer.appendChild(group);

        activePulses.push({
          fromIdx,
          toIdx: targetIdx,
          hopsLeft,
          from: CORE_GEOMETRY.nodes[fromIdx],
          to: CORE_GEOMETRY.nodes[targetIdx],
          start: performance.now(),
          duration: dist * 5.2,
          group,
          tailGrad,
          trail,
          halo,
          coreDot,
          hotTip,
        });
      };

      syncNodeClasses();
      syncConnections();

      // Immediate opening synaptic sparks so pulses are alive on frame 1
      spawnPulse(0, undefined, 2);
      const secondSparkTimer = setTimeout(() => {
        hitTimers.delete(secondSparkTimer);
        spawnPulse(5, undefined, 2);
      }, 180);
      hitTimers.add(secondSparkTimer);

      // Node activation / deactivation cycle (480ms)
      const nodeCycleInterval = setInterval(() => {
        if (activeNodes.size < NEURAL_CORE_CONFIG.nodeCount) {
          let candidate: number;
          do {
            candidate = Math.floor(Math.random() * NEURAL_CORE_CONFIG.nodeCount);
          } while (activeNodes.has(candidate));
          activeNodes.add(candidate);
          nodeElsRef.current[candidate]?.classList.add('active');
        }

        if (Math.random() > 0.55 && activeNodes.size > 5) {
          const arr = Array.from(activeNodes);
          const drop = arr[Math.floor(Math.random() * arr.length)];
          activeNodes.delete(drop);
          nodeElsRef.current[drop]?.classList.remove('active');
        }

        syncConnections();
      }, 480);

      // Spawn a new synaptic chain pulse every 520ms from an active node
      const pulseSpawnInterval = setInterval(() => {
        const arr = Array.from(activeNodes);
        if (arr.length === 0) return;
        const startIdx = arr[Math.floor(Math.random() * arr.length)];
        spawnPulse(startIdx, undefined, 2);
      }, 520);

      // 60fps imperative SVG pulse loop
      const animatePulses = (now: number) => {
        if (disposed) return;

        for (let i = activePulses.length - 1; i >= 0; i--) {
          const p = activePulses[i];
          const t = Math.min(Math.max((now - p.start) / p.duration, 0), 1);

          const x1 = 300 + p.from.x;
          const y1 = 300 + p.from.y;
          const x2 = 300 + p.to.x;
          const y2 = 300 + p.to.y;

          const hx = x1 + (x2 - x1) * t;
          const hy = y1 + (y2 - y1) * t;

          const tailT = Math.max(0, t - 0.32);
          const tx = x1 + (x2 - x1) * tailT;
          const ty = y1 + (y2 - y1) * tailT;

          p.trail.setAttribute('x1', String(tx));
          p.trail.setAttribute('y1', String(ty));
          p.trail.setAttribute('x2', String(hx));
          p.trail.setAttribute('y2', String(hy));

          p.tailGrad.setAttribute('x1', String(tx));
          p.tailGrad.setAttribute('y1', String(ty));
          p.tailGrad.setAttribute('x2', String(hx));
          p.tailGrad.setAttribute('y2', String(hy));

          p.halo.setAttribute('cx', String(hx));
          p.halo.setAttribute('cy', String(hy));
          p.halo.setAttribute('r', String(10 + Math.sin(t * Math.PI * 3) * 3.5));

          p.coreDot.setAttribute('cx', String(hx));
          p.coreDot.setAttribute('cy', String(hy));
          p.coreDot.setAttribute('r', String(3.2 + Math.sin(t * Math.PI * 2) * 1.4));

          p.hotTip.setAttribute('cx', String(hx));
          p.hotTip.setAttribute('cy', String(hy));

          if (t >= 1) {
            triggerNodeHit(p.toIdx);
            if (p.hopsLeft > 0) {
              spawnPulse(p.toIdx, undefined, p.hopsLeft - 1, p.fromIdx);
              if (Math.random() > 0.65) {
                spawnPulse(p.toIdx, undefined, 0, p.fromIdx);
              }
            }

            p.group.remove();
            p.tailGrad.remove();
            activePulses.splice(i, 1);
          }
        }

        rafId = window.requestAnimationFrame(animatePulses);
      };

      rafId = window.requestAnimationFrame(animatePulses);

      return () => {
        disposed = true;
        if (rafId !== null) {
          window.cancelAnimationFrame(rafId);
        }
        clearInterval(nodeCycleInterval);
        clearInterval(pulseSpawnInterval);
        hitTimers.forEach((timer) => clearTimeout(timer));
        hitTimers.clear();
        for (const p of activePulses) {
          p.group.remove();
          p.tailGrad.remove();
        }
        activePulses.length = 0;
      };
    }, [isExiting, glowFilterId, pulseHeadGradId, tailGradPrefix]);

    return (
      <div className="nc-core">
        {/* 5 Concentric Orbital Rings */}
        {NEURAL_CORE_CONFIG.ringSpeeds.map((speed, i) => (
          <div
            key={i}
            className="nc-orbit-ring"
            style={{
              inset: `${-(40 + i * 12)}px`,
              opacity: NEURAL_CORE_CONFIG.ringOpacities[i],
              boxShadow: `0 0 ${12 + i * 4}px hsla(var(--nc-primary), 0.22), inset 0 0 ${
                8 + i * 2
              }px hsla(var(--nc-primary), 0.12)`,
              animation: `nc-spin ${speed}s linear ${
                i % 2 === 0 ? 'normal' : 'reverse'
              } infinite`,
            }}
          />
        ))}

        {/* Dual Ambient Core Aura */}
        <div className="nc-aura-outer" />
        <div className="nc-aura-inner" />

        {/* Woven Neural Web & Live Synaptic Pulses SVG */}
        <svg className="nc-svg" viewBox="0 0 600 600" aria-hidden="true">
          <defs ref={svgDefsRef}>
            <radialGradient id={pulseHeadGradId}>
              <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
              <stop offset="40%" stopColor="hsl(var(--nc-primary))" stopOpacity="0.95" />
              <stop offset="100%" stopColor="hsl(var(--nc-primary))" stopOpacity="0" />
            </radialGradient>

            <filter id={glowFilterId} x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="2.8" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {CORE_GEOMETRY.edges.map((edge) => (
              <linearGradient
                key={`grad-${edge.from}-${edge.to}`}
                id={`${edgeGradPrefix}-${edge.from}-${edge.to}`}
                gradientUnits="userSpaceOnUse"
                x1={edge.x1}
                y1={edge.y1}
                x2={edge.x2}
                y2={edge.y2}
              >
                <stop offset="0%" stopColor="hsl(var(--nc-primary))" stopOpacity="0.3" />
                <stop
                  offset="50%"
                  stopColor="hsl(var(--nc-primary-deep))"
                  stopOpacity="0.95"
                />
                <stop offset="100%" stopColor="hsl(var(--nc-primary))" stopOpacity="0.3" />
              </linearGradient>
            ))}
          </defs>

          <g>
            {CORE_GEOMETRY.edges.map((edge, idx) => (
              <g key={`edge-${edge.from}-${edge.to}`}>
                <line
                  ref={(el) => {
                    glowLineRefs.current[idx] = el;
                  }}
                  x1={edge.x1}
                  y1={edge.y1}
                  x2={edge.x2}
                  y2={edge.y2}
                  stroke="hsl(var(--nc-primary))"
                  filter={`url(#${glowFilterId})`}
                  className="nc-conn-line"
                />
                <line
                  ref={(el) => {
                    baseLineRefs.current[idx] = el;
                  }}
                  x1={edge.x1}
                  y1={edge.y1}
                  x2={edge.x2}
                  y2={edge.y2}
                  stroke={`url(#${edgeGradPrefix}-${edge.from}-${edge.to})`}
                  className="nc-conn-line"
                />
              </g>
            ))}
          </g>

          <g ref={pulsesLayerRef} />
        </svg>

        {/* Central Glass Cube with Ping & Exact Neural Brain-Circuit Icon */}
        <div className="nc-glass-cube" data-showcase-module={currentModuleId}>
          <div className="nc-cube-ping" />
          <svg
            className="nc-cube-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
            <path d="M9 13a4.5 4.5 0 0 0 3-4" />
            <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5" />
            <path d="M3.477 10.896a4 4 0 0 1 .585-.396" />
            <path d="M6 18a4 4 0 0 1-1.967-.516" />
            <path d="M12 13h4" />
            <path d="M12 18h6a2 2 0 0 1 2 2v1" />
            <path d="M12 8h8" />
            <path d="M16 8V5a2 2 0 0 1 2-2" />
            <circle cx="16" cy="13" r=".5" />
            <circle cx="18" cy="3" r=".5" />
            <circle cx="20" cy="21" r=".5" />
            <circle cx="20" cy="8" r=".5" />
          </svg>
        </div>

        {/* 12 Multi-Layer Neural Nodes */}
        {CORE_GEOMETRY.nodes.map((node, i) => (
          <div
            key={node.idx}
            ref={(el) => {
              nodeElsRef.current[i] = el;
            }}
            className={`nc-node-anchor${
              (NEURAL_CORE_CONFIG.initialActiveNodes as readonly number[]).includes(i)
                ? ' active'
                : ''
            }`}
            style={{
              left: `calc(50% + ${node.x}px)`,
              top: `calc(50% + ${node.y}px)`,
            }}
          >
            <div className="nc-node-ping-bg" />
            <div className="nc-node-glow-mid" />
            <div className="nc-node-spin-ring" />
            <div className="nc-node-sweep" />
            <div className="nc-node-ripple-1" />
            <div className="nc-node-ripple-2" />
            <div className="nc-node-dot">
              <div className="nc-node-dot-inner" />
              <div className="nc-node-dot-white" />
            </div>
          </div>
        ))}
      </div>
    );
  }
);
NeuralCoreEmblem.displayName = 'NeuralCoreEmblem';

/**
 * NeuralLoader
 * Intro showcase displayed strictly before the operational SSOT SplashScreen.
 * Renders the exact Emerald Green Neural Core emblem (glass cube, brain-circuit
 * icon, 5 orbital rings, 12 glowing neural nodes, and 60fps synaptic pulses).
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
  const stepDurationMs = isFull ? 460 : 75;

  const [phaseIndex, setPhaseIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

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

  // Sequential showcase pacing across the 16 canonical modules
  useEffect(() => {
    if (isComplete || isExiting) return;

    const timer = setTimeout(() => {
      if (phaseIndex < CANONICAL_SHOWCASE_MODULES.length - 1) {
        setPhaseIndex((prev) => prev + 1);
      } else {
        setIsComplete(true);
        finishTimerRef.current = setTimeout(() => {
          triggerFinish();
        }, isFull ? 380 : 250);
      }
    }, stepDurationMs);

    return () => clearTimeout(timer);
  }, [phaseIndex, isComplete, isExiting, stepDurationMs, triggerFinish, isFull]);

  const currentModuleId =
    CANONICAL_SHOWCASE_MODULES[phaseIndex] ?? CANONICAL_SHOWCASE_MODULES[0];

  return (
    <div
      role="region"
      aria-label="Présentation d'accueil CIOB GMAO Nexus"
      className={`${
        isFull
          ? 'fixed inset-0 z-[100] p-4 sm:p-8 justify-between'
          : 'relative w-full h-[calc(85vh-100px)] min-h-[500px] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 justify-center'
      } bg-[#f7f9fc] dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col items-center overflow-hidden select-none font-sans transition-all duration-300 ${
        isExiting ? 'opacity-0 scale-[1.015] pointer-events-none' : 'opacity-100 scale-100'
      }`}
    >
      {/* Background Excel Grid Subtle Lines & Ambient Orbs */}
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none bg-[radial-gradient(#107c41_1px,transparent_1px)] [background-size:20px_20px]" />
      <div className="absolute -top-32 -right-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-emerald-400/10 rounded-full blur-3xl pointer-events-none" />

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

      {/* Center Animated Neural Core Emblem & Brand Identity */}
      <div className="z-20 my-auto flex flex-col items-center justify-center text-center">
        <div
          className={`relative flex items-center justify-center ${
            !isFull
              ? 'w-[280px] h-[280px] scale-[0.72]'
              : 'w-[280px] h-[280px] sm:w-[360px] sm:h-[360px] scale-[0.76] sm:scale-95 md:scale-100 mb-4 sm:mb-6'
          }`}
        >
          <NeuralCoreEmblem
            currentModuleId={currentModuleId}
            isExiting={isExiting}
          />
        </div>

        {/* Clean Brand Title & Tagline */}
        {isFull && (
          <div className="space-y-1.5 px-6 relative z-30">
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
