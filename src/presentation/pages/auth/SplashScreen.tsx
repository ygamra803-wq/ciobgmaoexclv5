import { useEffect, useState, useRef } from 'react';
import {
  FileSpreadsheet,
  ShieldCheck,
  Table,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  MinusCircle,
  AlertTriangle,
} from 'lucide-react';
import {
  BOOT_MANIFEST,
  inspectBootEntity,
  type BootEntityItem,
  type BootEntityStatus,
  type StockSampleItem,
} from '../../../application/bootManifest';
import { Logger } from '../../../core/logger/LoggerService';

interface SplashScreenProps {
  onComplete: () => void;
}

interface EntityProgressState {
  status: BootEntityStatus;
  count: number;
  error?: string;
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const [entityStates, setEntityStates] = useState<Record<string, EntityProgressState>>(() => {
    const initial: Record<string, EntityProgressState> = {};
    for (const item of BOOT_MANIFEST) {
      initial[item.id] = { status: 'pending', count: 0 };
    }
    return initial;
  });

  const [stockSample, setStockSample] = useState<StockSampleItem[]>([]);
  const [currentEntityLabel, setCurrentEntityLabel] = useState<string>('Démarrage du système...');
  const [totalRecordsCount, setTotalRecordsCount] = useState<number>(0);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);

  // References to guarantee clean unmount & prevent double onComplete invocations
  const completedRef = useRef<boolean>(false);
  const safetyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const safeComplete = (reason: string) => {
    if (completedRef.current) return;
    completedRef.current = true;
    if (safetyTimeoutRef.current) {
      clearTimeout(safetyTimeoutRef.current);
      safetyTimeoutRef.current = null;
    }
    Logger.info(`[SplashScreen] Boot sequence completed: ${reason}`);
    onComplete();
  };

  // Skip button click handler: conscious user bypass with logging
  const handleDirectAccess = () => {
    Logger.info('[SplashScreen] User clicked "Accéder directement" (conscious bypass)');
    safeComplete('user_skip');
  };

  useEffect(() => {
    let isCancelled = false;

    // Safety timeout: 15s max to prevent any indefinite blocking
    safetyTimeoutRef.current = setTimeout(() => {
      if (!isCancelled && !completedRef.current) {
        Logger.warn('[SplashScreen] 15s safety timeout reached — proceeding with partial boot');
        setCurrentEntityLabel('Chargement partiel (délai de sécurité atteint)');
        safeComplete('timeout_fallback');
      }
    }, 15000);

    const runBootInspection = async () => {
      let accumulatedCount = 0;

      for (let i = 0; i < BOOT_MANIFEST.length; i++) {
        if (isCancelled || completedRef.current) break;

        const entity = BOOT_MANIFEST[i];
        setCurrentEntityLabel(`Indexation : ${entity.labelFr}...`);

        // Mark current entity as loading
        setEntityStates((prev) => ({
          ...prev,
          [entity.id]: { status: 'loading', count: 0 },
        }));

        // Yield to browser frame so UI re-renders loading state smoothly
        await new Promise((resolve) => setTimeout(resolve, 40));

        if (isCancelled || completedRef.current) break;

        try {
          const { count, sample } = inspectBootEntity(entity);
          accumulatedCount += count;

          if (entity.id === 'rawStock' && sample) {
            setStockSample(sample);
          }

          const status: BootEntityStatus = count > 0 ? 'ok' : 'empty';

          setEntityStates((prev) => ({
            ...prev,
            [entity.id]: { status, count },
          }));
        } catch (err) {
          Logger.error(`[SplashScreen] Error inspecting boot entity ${entity.id}`, err);
          setEntityStates((prev) => ({
            ...prev,
            [entity.id]: {
              status: 'error',
              count: 0,
              error: err instanceof Error ? err.message : 'Erreur',
            },
          }));
        }
      }

      if (!isCancelled && !completedRef.current) {
        setTotalRecordsCount(accumulatedCount);
        setIsCompleted(true);
        setCurrentEntityLabel(
          `Écosystème initialisé • ${accumulatedCount} enregistrement${accumulatedCount > 1 ? 's' : ''} indexé${accumulatedCount > 1 ? 's' : ''}`
        );

        // Brief delay (350ms) so user perceives the 100% progress and final counts
        setTimeout(() => {
          if (!isCancelled) {
            safeComplete('manifest_loaded');
          }
        }, 350);
      }
    };

    runBootInspection();

    return () => {
      isCancelled = true;
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
      }
    };
  }, []);

  // Compute progress strictly from completed entities (never arbitrary setInterval)
  const completedEntities = Object.values(entityStates).filter(
    (e) => e.status === 'ok' || e.status === 'empty' || e.status === 'error'
  ).length;

  const progress = Math.round((completedEntities / BOOT_MANIFEST.length) * 100);

  return (
    <div className="fixed inset-0 z-50 bg-slate-100 text-slate-900 flex flex-col items-center justify-between p-4 sm:p-8 select-none font-sans overflow-hidden">
      {/* Background Excel Grid Subtle Lines */}
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none bg-[radial-gradient(#107c41_1px,transparent_1px)] [background-size:20px_20px]" />
      <div className="absolute -top-32 -right-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Row */}
      <div className="w-full max-w-2xl flex justify-between items-center z-10">
        <div className="flex items-center gap-2 bg-white border border-slate-200 px-3.5 py-1.5 rounded-full shadow-xs">
          <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
          <span className="text-[11px] font-mono tracking-wide text-slate-700 font-bold">
            Classeur Virtuel GMAO • Modèle SSOT V2
          </span>
        </div>

        <button
          onClick={handleDirectAccess}
          className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-emerald-800 transition bg-white hover:bg-slate-50 border border-slate-200 px-3.5 py-1.5 rounded-full shadow-xs cursor-pointer font-medium"
          title="Passer directement à l'application"
        >
          <span>Accéder directement</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Center Excel Card & Loader */}
      <div className="w-full max-w-xl z-10 my-auto flex flex-col items-center text-center">
        {/* Main Light Card */}
        <div className="w-full bg-white border border-slate-200 p-5 sm:p-7 rounded-3xl shadow-xl relative overflow-hidden">
          {/* Top Excel Banner Stripe */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-600 via-green-500 to-emerald-700" />

          {/* Excel Icon */}
          <div className="relative inline-flex mb-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-700 text-white flex items-center justify-center shadow-lg shadow-emerald-700/20">
              <FileSpreadsheet className="w-8 h-8 stroke-[1.75]" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg bg-emerald-500 text-white flex items-center justify-center shadow-md">
              {isCompleted ? (
                <CheckCircle2 className="w-4 h-4 text-white stroke-[2.5]" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5 animate-spin stroke-[2.5]" />
              )}
            </div>
          </div>

          {/* Title & Subtitle */}
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            CIOB GMAO LIGHT
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 font-medium max-w-sm mx-auto">
            Chargement du Modèle Excel Twin & Indexation du Stock
          </p>

          {/* Mini Spreadsheet Simulation Grid — Real Data or Honest Empty Message */}
          <div className="mt-4 mb-3 border border-slate-200 rounded-xl overflow-hidden bg-slate-50/70 text-left text-[10.5px] font-mono shadow-inner">
            <div className="bg-slate-200/80 px-3 py-1.5 font-bold text-slate-700 border-b border-slate-200 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Table className="w-3.5 h-3.5 text-emerald-700" />
                <span>Feuille : Stock_Actuel</span>
              </span>
              <span className="text-[9.5px] text-emerald-700 font-sans font-semibold">
                Formule = Stock_Initial + Entrées − Sorties
              </span>
            </div>

            <div className="divide-y divide-slate-200/60 p-1">
              <div className="grid grid-cols-4 px-2 py-1 font-semibold text-slate-500 text-[9.5px] uppercase">
                <span>Réf</span>
                <span>Désignation</span>
                <span className="text-center">Init</span>
                <span className="text-right">Stock</span>
              </div>

              {stockSample.length > 0 ? (
                stockSample.map((row) => {
                  const isLow = row.stockActuel <= row.seuil && row.seuil > 0;
                  return (
                    <div
                      key={row.ref}
                      className="grid grid-cols-4 px-2 py-1 text-slate-700 bg-white/70 hover:bg-white transition-colors"
                    >
                      <span className="font-bold text-emerald-800 truncate">{row.ref}</span>
                      <span className="truncate" title={row.designation}>
                        {row.designation || '—'}
                      </span>
                      <span className="text-center text-slate-600">{row.stockInitial}</span>
                      <span
                        className={`text-right font-bold ${
                          isLow ? 'text-rose-600' : 'text-slate-900'
                        }`}
                      >
                        {row.stockActuel} {isLow && <span className="text-[8.5px]">(Alerte)</span>}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="py-2.5 px-3 text-center text-slate-500 font-sans text-xs bg-white/50">
                  <p className="font-semibold text-slate-600">Aucune donnée locale</p>
                  <p className="text-[10px] text-slate-400">Registre de stock vierge (Usine prête)</p>
                </div>
              )}
            </div>
          </div>

          {/* SSOT Manifest Verification Grid */}
          <div className="mb-4 border border-slate-200 rounded-xl overflow-hidden bg-slate-50/60 text-left text-[11px] shadow-inner max-h-40 sm:max-h-44 overflow-y-auto">
            <div className="sticky top-0 bg-slate-200/90 backdrop-blur-xs px-3 py-1 font-bold text-slate-700 border-b border-slate-200 flex items-center justify-between text-[10px]">
              <span>Table / Feuille SSOT</span>
              <span>Statut & Enregistrements</span>
            </div>

            <div className="divide-y divide-slate-200/50">
              {BOOT_MANIFEST.map((item) => {
                const state = entityStates[item.id] || { status: 'pending', count: 0 };
                return (
                  <div
                    key={item.id}
                    className="px-3 py-1 flex items-center justify-between hover:bg-white/60 transition-colors"
                  >
                    <div className="flex items-center gap-1.5 min-w-0 pr-2">
                      <span className="text-slate-700 font-medium truncate">{item.labelFr}</span>
                      <span className="text-[9.5px] font-mono text-slate-400 shrink-0">
                        ({item.sheetName})
                      </span>
                    </div>

                    <div className="shrink-0 flex items-center gap-1 text-[10.5px]">
                      {state.status === 'pending' && (
                        <span className="flex items-center gap-1 text-slate-400">
                          <MinusCircle className="w-3 h-3 text-slate-300" />
                          <span>En attente</span>
                        </span>
                      )}
                      {state.status === 'loading' && (
                        <span className="flex items-center gap-1 text-emerald-600 font-medium">
                          <RefreshCw className="w-3 h-3 animate-spin text-emerald-600" />
                          <span>Lecture...</span>
                        </span>
                      )}
                      {state.status === 'ok' && (
                        <span className="flex items-center gap-1 text-emerald-700 font-semibold font-mono">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>{state.count} enr.</span>
                        </span>
                      )}
                      {state.status === 'empty' && (
                        <span className="flex items-center gap-1 text-slate-500 font-mono">
                          <MinusCircle className="w-3 h-3 text-slate-400" />
                          <span>vide (0)</span>
                        </span>
                      )}
                      {state.status === 'error' && (
                        <span className="flex items-center gap-1 text-rose-600 font-semibold font-mono">
                          <AlertTriangle className="w-3 h-3 text-rose-500" />
                          <span>erreur</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Progress Bar & Status Text */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs font-mono font-medium">
              <span className="text-slate-700 truncate pr-2 text-left">{currentEntityLabel}</span>
              <span className="text-emerald-700 font-bold shrink-0">{progress}%</span>
            </div>

            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200 p-0.5">
              <div
                className="h-full bg-gradient-to-r from-emerald-600 via-green-600 to-emerald-500 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="w-full text-center z-10">
        <p className="text-[11px] font-mono text-slate-500 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Matrice de Calcul Client-Side • Excel Twin Architecture V2</span>
        </p>
      </div>
    </div>
  );
}
