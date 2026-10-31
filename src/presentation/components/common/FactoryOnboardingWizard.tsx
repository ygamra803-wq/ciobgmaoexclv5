import React, { useState, useMemo } from 'react';
import {
  Factory,
  MapPin,
  Flame,
  Wrench,
  UserCheck,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Plus,
  X,
  Sparkles,
  Calendar,
} from 'lucide-react';
import { useGmaoStore } from '../../../store/useGmaoStore';
import { filterActiveMachines } from '../../../utils/activeMachines';

export const ONBOARDING_DISMISSED_KEY = 'gmao_onboarding_dismissed_v1';

export interface FactoryOnboardingStatus {
  zonesCount: number;
  generalSystemTypesCount: number;
  activeMachinesCount: number;
  techniciansCount: number;
  step1ZonesDone: boolean;
  step2SysTypesOptionalDone: boolean;
  step3MachineDone: boolean;
  step4TechnicianDone: boolean;
  isMinimumComplete: boolean;
  isDismissed: boolean;
  shouldAutoShow: boolean;
  completedMandatoryCount: number;
}

/**
 * C4 — Pure evaluator for Empty Factory Onboarding readiness & auto-visibility.
 * - Minimum operational baseline: >= 1 Zone, >= 1 Active Machine (PRODUCTION or SYSTEM_GENERAL), >= 1 Technician.
 * - Step 2 (General System Types) and Step 5 (First SEC / Preventive Round) are optional / skippable.
 * - Never auto-shows once `isMinimumComplete` is true or once the admin dismisses it (`isDismissed`).
 * - Never injects demo data silently (AGENTS.md Rule #2).
 */
export function evaluateFactoryOnboardingStatus(params: {
  zones?: any[];
  generalSystemTypes?: any[];
  machines?: any[];
  technicians?: any[];
  startMode?: string | null;
  dismissedFlag?: string | boolean | null;
}): FactoryOnboardingStatus {
  const zonesCount = Array.isArray(params.zones) ? params.zones.length : 0;
  const generalSystemTypesCount = Array.isArray(params.generalSystemTypes)
    ? params.generalSystemTypes.filter((t) => t && t.is_active !== false).length
    : 0;
  const activeMachines = filterActiveMachines(params.machines || []);
  const activeMachinesCount = activeMachines.length;
  const techniciansCount = Array.isArray(params.technicians)
    ? params.technicians.filter(
        (t) => t && t.is_active !== false && String(t.statut || '').toUpperCase() !== 'ARCHIVE'
      ).length
    : 0;

  const step1ZonesDone = zonesCount >= 1;
  const step2SysTypesOptionalDone = generalSystemTypesCount >= 1;
  const step3MachineDone = activeMachinesCount >= 1;
  const step4TechnicianDone = techniciansCount >= 1;

  const isMinimumComplete = step1ZonesDone && step3MachineDone && step4TechnicianDone;
  const isDismissed =
    params.dismissedFlag === true ||
    String(params.dismissedFlag || '').toLowerCase() === 'true';

  const isEmptyFactoryContext =
    String(params.startMode || '').toLowerCase() === 'empty' || activeMachinesCount === 0;

  const shouldAutoShow = !isDismissed && !isMinimumComplete && isEmptyFactoryContext;

  const completedMandatoryCount =
    (step1ZonesDone ? 1 : 0) + (step3MachineDone ? 1 : 0) + (step4TechnicianDone ? 1 : 0);

  return {
    zonesCount,
    generalSystemTypesCount,
    activeMachinesCount,
    techniciansCount,
    step1ZonesDone,
    step2SysTypesOptionalDone,
    step3MachineDone,
    step4TechnicianDone,
    isMinimumComplete,
    isDismissed,
    shouldAutoShow,
    completedMandatoryCount,
  };
}

interface FactoryOnboardingWizardProps {
  onNavigateToZones?: () => void;
  onNavigateToMachines?: () => void;
  onNavigateToUsers?: () => void;
  onNavigateToPreventive?: () => void;
  showToast?: (msg: string, type?: string) => void;
  forceOpen?: boolean;
  onCloseForceOpen?: () => void;
}

export default function FactoryOnboardingWizard({
  onNavigateToZones,
  onNavigateToMachines,
  onNavigateToUsers,
  onNavigateToPreventive,
  showToast,
  forceOpen = false,
  onCloseForceOpen,
}: FactoryOnboardingWizardProps) {
  const zones = useGmaoStore((s) => s.zones);
  const setZones = useGmaoStore((s) => s.setZones);
  const generalSystemTypes = useGmaoStore((s) => s.generalSystemTypes);
  const handleAddGeneralSystemType = useGmaoStore((s) => s.handleAddGeneralSystemType);
  const machines = useGmaoStore((s) => s.machines);
  const setMachines = useGmaoStore((s) => s.setMachines);
  const technicians = useGmaoStore((s) => s.technicians);
  const setTechnicians = useGmaoStore((s) => s.setTechnicians);

  const [dismissedFlag, setDismissedFlag] = useState<boolean>(() => {
    try {
      return localStorage.getItem(ONBOARDING_DISMISSED_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const startMode = useMemo(() => {
    try {
      return localStorage.getItem('gmao_start_mode');
    } catch {
      return null;
    }
  }, []);

  const status = useMemo(
    () =>
      evaluateFactoryOnboardingStatus({
        zones,
        generalSystemTypes,
        machines,
        technicians,
        startMode,
        dismissedFlag,
      }),
    [zones, generalSystemTypes, machines, technicians, startMode, dismissedFlag]
  );

  // Determine initial active step based on first incomplete step
  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4 | 5>(() => {
    if (!status.step1ZonesDone) return 1;
    if (!status.step3MachineDone) return 3;
    if (!status.step4TechnicianDone) return 4;
    return 5;
  });

  // Step 1 form state (Zone)
  const [zoneCode, setZoneCode] = useState('');
  const [zoneName, setZoneName] = useState('');

  // Step 2 form state (General System Type - optional)
  const [sysCode, setSysCode] = useState('SYS-SEC');
  const [sysName, setSysName] = useState('Sécurité Incendie & Extincteurs');

  // Step 3 form state (Machine)
  const [machineCode, setMachineCode] = useState('');
  const [machineName, setMachineName] = useState('');
  const [machineAssetClass, setMachineAssetClass] = useState<'PRODUCTION' | 'SYSTEM_GENERAL'>(
    'PRODUCTION'
  );
  const [machineZone, setMachineZone] = useState('');
  const [machineSysType, setMachineSysType] = useState('SYS-SEC');

  // Step 4 form state (Technician)
  const [techId, setTechId] = useState('');
  const [techName, setTechName] = useState('');
  const [techSpec, setTechSpec] = useState('Électromécanique');

  const isVisible = forceOpen || status.shouldAutoShow;
  if (!isVisible) return null;

  const handleDismiss = () => {
    try {
      localStorage.setItem(ONBOARDING_DISMISSED_KEY, 'true');
    } catch {
      // ignore storage errors
    }
    setDismissedFlag(true);
    onCloseForceOpen?.();
    showToast?.(
      "Assistant de configuration initiale fermé. Vous pouvez le rouvrir à tout moment depuis l'en-tête du tableau de bord.",
      'info'
    );
  };

  const handleAddQuickZone = (e: React.FormEvent) => {
    e.preventDefault();
    const code = zoneCode.trim().toUpperCase();
    const name = zoneName.trim() || code;
    if (!code) return;

    const exists = (zones || []).some(
      (z: any) => String(z.id_zone || '').trim().toUpperCase() === code
    );
    if (exists) {
      showToast?.(`La zone ${code} existe déjà.`, 'warning');
      return;
    }

    setZones((prev: any[]) => [
      ...(prev || []),
      {
        id_zone: code,
        nom_zone: name,
        description: `Zone créée via l'assistant d'initialisation usine`,
      },
    ]);
    setZoneCode('');
    setZoneName('');
    if (!machineZone) setMachineZone(code);
    showToast?.(`Zone « ${code} — ${name} » enregistrée.`, 'success');
    setActiveStep(2);
  };

  const handleAddQuickSysType = (e: React.FormEvent) => {
    e.preventDefault();
    const code = sysCode.trim().toUpperCase();
    const name = sysName.trim() || code;
    if (!code) return;
    handleAddGeneralSystemType({ code, name });
    setMachineSysType(code);
    showToast?.(`Type Système Général « ${code} » activé.`, 'success');
    setActiveStep(3);
  };

  const handleAddQuickMachine = (e: React.FormEvent) => {
    e.preventDefault();
    const code = machineCode.trim().toUpperCase();
    const name = machineName.trim() || code;
    if (!code) return;

    const exists = (machines || []).some(
      (m: any) =>
        String(m.id_machine_registered || m.id || m.code || '')
          .trim()
          .toUpperCase() === code
    );
    if (exists) {
      showToast?.(`L'équipement ${code} existe déjà.`, 'warning');
      return;
    }

    const selectedZone =
      machineZone || (zones && zones[0]?.id_zone) || 'Z-PROD';

    const newMachine = {
      id: code,
      id_machine_registered: code,
      code_machine: code,
      designation: name,
      nom: name,
      id_zone_default: selectedZone,
      id_zone: selectedZone,
      asset_class: machineAssetClass,
      system_type_code:
        machineAssetClass === 'SYSTEM_GENERAL' ? machineSysType || 'SYS-SEC' : undefined,
      status: 'En Service',
      statut: 'En Service',
      lifecycle_state: 'ACTIVE',
      is_active: true,
      created_at: new Date().toISOString(),
    };

    setMachines((prev: any[]) => [...(prev || []), newMachine]);
    setMachineCode('');
    setMachineName('');
    showToast?.(
      `Équipement « ${code} — ${name} » (${machineAssetClass}) enregistré.`,
      'success'
    );
    setActiveStep(4);
  };

  const handleAddQuickTechnician = (e: React.FormEvent) => {
    e.preventDefault();
    const name = techName.trim();
    if (!name) return;
    const code =
      techId.trim().toUpperCase() ||
      `TECH-${String((technicians || []).length + 1).padStart(2, '0')}`;

    const exists = (technicians || []).some(
      (t: any) =>
        String(t.id_technician || t.id || '').trim().toUpperCase() === code
    );
    if (exists) {
      showToast?.(`Le matricule ${code} existe déjà.`, 'warning');
      return;
    }

    const defaultZone = (zones && zones[0]?.id_zone) || 'Z-PROD';
    setTechnicians((prev: any[]) => [
      ...(prev || []),
      {
        id: code,
        id_technician: code,
        nom: name,
        specialite: techSpec || 'Maintenance Générale',
        role: 'Technicien',
        id_zone: defaultZone,
        is_active: true,
        actif: true,
      },
    ]);
    setTechId('');
    setTechName('');
    showToast?.(`Technicien « ${name} (${code}) » enregistré.`, 'success');
    setActiveStep(5);
  };

  const steps = [
    {
      num: 1 as const,
      title: '1. Zones Usine',
      done: status.step1ZonesDone,
      badge: `${status.zonesCount} zone(s)`,
      icon: MapPin,
      optional: false,
    },
    {
      num: 2 as const,
      title: '2. Système Général',
      done: status.step2SysTypesOptionalDone,
      badge: 'Optionnel',
      icon: Flame,
      optional: true,
    },
    {
      num: 3 as const,
      title: '3. Premier Équipement',
      done: status.step3MachineDone,
      badge: `${status.activeMachinesCount} machine(s)`,
      icon: Factory,
      optional: false,
    },
    {
      num: 4 as const,
      title: '4. Technicien / Compte',
      done: status.step4TechnicianDone,
      badge: `${status.techniciansCount} tech(s)`,
      icon: UserCheck,
      optional: false,
    },
    {
      num: 5 as const,
      title: '5. Ronde SEC / Préventif',
      done: status.isMinimumComplete,
      badge: 'Optionnel',
      icon: Calendar,
      optional: true,
    },
  ];

  return (
    <div
      data-testid="c4-factory-onboarding-wizard"
      className="bg-white rounded-3xl border-2 border-indigo-200/90 shadow-[0_12px_32px_-8px_rgba(79,70,229,0.12)] p-5 md:p-6 space-y-5"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-black text-slate-900">
                Assistant de Démarrage Usine Vierge (C4 — Onboarding Réel)
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-indigo-50 text-indigo-900 border border-indigo-200">
                Socle minimum : {status.completedMandatoryCount} / 3 complété(s)
              </span>
              {status.isMinimumComplete && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                  Prêt pour l&apos;exploitation
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Configuration séquentielle directe dans les tables officielles (zéro donnée démo injectée). Vous pouvez passer une étape ou fermer cet assistant à tout moment.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleDismiss}
            data-testid="c4-onboarding-dismiss-btn"
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            <span>{status.isMinimumComplete ? 'Terminer & Masquer' : 'Ignorer / Fermer'}</span>
          </button>
        </div>
      </div>

      {/* Stepper Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {steps.map((st) => {
          const Icon = st.icon;
          const isCurrent = activeStep === st.num;
          return (
            <button
              key={st.num}
              type="button"
              onClick={() => setActiveStep(st.num)}
              className={`p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between gap-1.5 ${
                isCurrent
                  ? 'bg-indigo-50/90 border-indigo-400 shadow-2xs'
                  : st.done
                  ? 'bg-emerald-50/60 border-emerald-200 hover:bg-emerald-50'
                  : 'bg-slate-50/80 border-slate-200/80 hover:bg-slate-100/70'
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <Icon
                  className={`w-4 h-4 ${
                    isCurrent
                      ? 'text-indigo-700'
                      : st.done
                      ? 'text-emerald-600'
                      : 'text-slate-400'
                  }`}
                />
                {st.done ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <span className="text-[10px] font-mono font-bold text-slate-400">
                    {st.optional ? 'OPT' : 'REQ'}
                  </span>
                )}
              </div>
              <div className="text-xs font-black text-slate-900 truncate">{st.title}</div>
              <div className="text-[10px] font-mono font-bold text-slate-500">{st.badge}</div>
            </button>
          );
        })}
      </div>

      {/* Step Body */}
      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90">
        {activeStep === 1 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  Étape 1 — Créer au moins une Zone d&apos;implantation réelle
                </h3>
                <p className="text-[11px] text-slate-600">
                  Les machines et techniciens sont rattachés à une zone (ex: ATELIER-01, CHAUFFERIE, SEC-INCENDIE).
                </p>
              </div>
              {onNavigateToZones && (
                <button
                  type="button"
                  onClick={onNavigateToZones}
                  className="text-xs font-bold text-indigo-700 hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>Ouvrir Référentiel Zones</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <form onSubmit={handleAddQuickZone} className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <input
                type="text"
                value={zoneCode}
                onChange={(e) => setZoneCode(e.target.value)}
                placeholder="Code Zone (ex: Z-PROD-01)"
                className="px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
              />
              <input
                type="text"
                value={zoneName}
                onChange={(e) => setZoneName(e.target.value)}
                placeholder="Nom de la zone (ex: Atelier Pressage)"
                className="px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-indigo-600"
              />
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="flex-1 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Ajouter la Zone</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveStep(2)}
                  className="px-3 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  Suivant →
                </button>
              </div>
            </form>
          </div>
        )}

        {activeStep === 2 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  Étape 2 (Optionnelle) — Types Système Général (Utilités / Sécurité)
                </h3>
                <p className="text-[11px] text-slate-600">
                  Permet d&apos;isoler les équipements de sécurité/utilités (extincteurs, compresseurs, TGBT) du calcul MTBF production.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveStep(3)}
                className="text-xs font-bold text-slate-600 hover:text-slate-900 underline cursor-pointer"
              >
                Passer cette étape →
              </button>
            </div>

            <form onSubmit={handleAddQuickSysType} className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <input
                type="text"
                value={sysCode}
                onChange={(e) => setSysCode(e.target.value)}
                placeholder="Code Type (ex: SYS-SEC)"
                className="px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
              />
              <input
                type="text"
                value={sysName}
                onChange={(e) => setSysName(e.target.value)}
                placeholder="Libellé (ex: Sécurité Incendie)"
                className="px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-indigo-600"
              />
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="flex-1 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Activer ce Type</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveStep(3)}
                  className="px-3 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  Passer →
                </button>
              </div>
            </form>
          </div>
        )}

        {activeStep === 3 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  Étape 3 — Enregistrer au moins une Machine (PRODUCTION ou SYSTEM_GENERAL)
                </h3>
                <p className="text-[11px] text-slate-600">
                  Toutes les listes déroulantes (BT, Préventif, Sorties PDR) utilisent exclusivement les machines actives enregistrées.
                </p>
              </div>
              {onNavigateToMachines && (
                <button
                  type="button"
                  onClick={onNavigateToMachines}
                  className="text-xs font-bold text-indigo-700 hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>Ouvrir Parc Machines</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <form onSubmit={handleAddQuickMachine} className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
              <input
                type="text"
                value={machineCode}
                onChange={(e) => setMachineCode(e.target.value)}
                placeholder="Code (ex: PRESSE-01)"
                className="px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
              />
              <input
                type="text"
                value={machineName}
                onChange={(e) => setMachineName(e.target.value)}
                placeholder="Désignation (ex: Presse 250T)"
                className="px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-indigo-600"
              />
              <select
                value={machineAssetClass}
                onChange={(e) =>
                  setMachineAssetClass(e.target.value as 'PRODUCTION' | 'SYSTEM_GENERAL')
                }
                aria-label="Classe d'équipement"
                className="px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
              >
                <option value="PRODUCTION">PRODUCTION</option>
                <option value="SYSTEM_GENERAL">SYSTEM_GENERAL</option>
              </select>
              <select
                value={machineZone || (zones && zones[0]?.id_zone) || ''}
                onChange={(e) => setMachineZone(e.target.value)}
                aria-label="Zone par défaut"
                className="px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-indigo-600"
              >
                {(zones || []).length === 0 ? (
                  <option value="Z-PROD">Z-PROD (Par défaut)</option>
                ) : (
                  (zones || []).map((z: any) => (
                    <option key={z.id_zone} value={z.id_zone}>
                      {z.id_zone} — {z.nom_zone || z.id_zone}
                    </option>
                  ))
                )}
              </select>
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="flex-1 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Ajouter</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveStep(4)}
                  className="px-3 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  Suivant →
                </button>
              </div>
            </form>
          </div>
        )}

        {activeStep === 4 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  Étape 4 — Ajouter au moins un Technicien ou lier un Compte
                </h3>
                <p className="text-[11px] text-slate-600">
                  Permet d&apos;assigner les rondes préventives et les bons de travail (Maker-Checker).
                </p>
              </div>
              {onNavigateToUsers && (
                <button
                  type="button"
                  onClick={onNavigateToUsers}
                  className="text-xs font-bold text-indigo-700 hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>Gérer Comptes & Profils</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <form
              onSubmit={handleAddQuickTechnician}
              className="grid grid-cols-1 sm:grid-cols-4 gap-2.5"
            >
              <input
                type="text"
                value={techId}
                onChange={(e) => setTechId(e.target.value)}
                placeholder="Matricule (ex: TECH-01)"
                className="px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
              />
              <input
                type="text"
                value={techName}
                onChange={(e) => setTechName(e.target.value)}
                placeholder="Nom & Prénom du technicien"
                className="px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-indigo-600"
              />
              <input
                type="text"
                value={techSpec}
                onChange={(e) => setTechSpec(e.target.value)}
                placeholder="Spécialité (ex: Électromécanique)"
                className="px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-indigo-600"
              />
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="flex-1 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Ajouter Tech</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveStep(5)}
                  className="px-3 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  Suivant →
                </button>
              </div>
            </form>
          </div>
        )}

        {activeStep === 5 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  Étape 5 (Optionnelle) — Planifier votre première Ronde SEC ou Gamme Préventive
                </h3>
              </div>
              <p className="text-[11px] text-slate-600">
                Votre référentiel de base ({status.zonesCount} zone(s), {status.activeMachinesCount} machine(s), {status.techniciansCount} technicien(s)) est prêt. Vous pouvez maintenant planifier une première ronde préventive / sécurité (SEC) ou fermer cet assistant.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {onNavigateToPreventive && (
                <button
                  type="button"
                  onClick={onNavigateToPreventive}
                  className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>Ouvrir Maintenance Préventive</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleDismiss}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Terminer & Masquer</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
