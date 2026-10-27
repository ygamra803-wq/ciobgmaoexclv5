import { useState, useMemo } from 'react';
import {
  LayoutDashboard,
  Calendar,
  Wrench,
  User,
  Monitor,
  Smartphone,
  LogOut,
  QrCode,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  Send,
  Play,
  ShieldCheck,
  Package,
  X,
  ArrowRight,
  Layers,
} from 'lucide-react';
import { useAppShell } from '../../../core/shell/shellPolicy';
import {
  isTechnicianRole,
  buildTechnicianDashboardScope,
  getTechnicianDisplayName,
  getTechnicianBadgeLabel,
} from '../../../core/security/technicianScope';
import { filterActiveMachines } from '../../../utils/activeMachines';
import ShellModeSwitcher from '../common/ShellModeSwitcher';
import QRScannerModal from '../common/QRScannerModal';

interface MobileShellProps {
  currentUser: any;
  onLogout: () => void;
  setCurrentTab: (tab: string) => void;
  machines: any[];
  zones: any[];
  stockItems: any[];
  technicians: any[];
  preventiveTasks: any[];
  preventiveExecutions: any[];
  correctiveInterventions: any[];
  sortieDemands: any[];
  mouvements: any[];
  onMarkTaskDone: (id: string, validationData: any) => void;
  onAddDemandeIntervention: (data: any) => any;
  onStartLiveIntervention: (id: string) => void;
  onSubmitInterventionForValidation: (id: string, submissionData: any) => any;
  onOpenMachineQrModal?: (machineId: string) => void;
  showToast?: (msg: string, type?: string) => void;
}

type MobileTabId = 'today' | 'preventive' | 'corrective' | 'more';

export default function MobileShell({
  currentUser,
  onLogout,
  setCurrentTab,
  machines = [],
  zones = [],
  stockItems = [],
  technicians = [],
  preventiveTasks = [],
  preventiveExecutions = [],
  correctiveInterventions = [],
  sortieDemands = [],
  mouvements = [],
  onMarkTaskDone,
  onAddDemandeIntervention,
  onStartLiveIntervention,
  onSubmitInterventionForValidation,
  onOpenMachineQrModal,
  showToast,
}: MobileShellProps) {
  const { mode, resolved, setMode } = useAppShell();
  const isTech = isTechnicianRole(currentUser);

  const [activeTab, setActiveTab] = useState<MobileTabId>('today');
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);

  // Preventive filter & execution modal state
  const [prevFilter, setPrevFilter] = useState<'TODO' | 'OVERDUE' | 'CLARIFY' | 'ALL'>('TODO');
  const [selectedTaskForExec, setSelectedTaskForExec] = useState<any | null>(null);
  const [execNotes, setExecNotes] = useState('');
  const [execDuration, setExecDuration] = useState('20');
  const [execSpareRef, setExecSpareRef] = useState('');
  const [execSpareQty, setExecSpareQty] = useState('1');

  // Corrective filter, new DI modal & BT submission modal state
  const [corrFilter, setCorrFilter] = useState<'ACTIVE' | 'CLARIFY' | 'PENDING' | 'ALL'>('ACTIVE');
  const [showNewDiSheet, setShowNewDiSheet] = useState(false);
  const [diMachineId, setDiMachineId] = useState('');
  const [diAnomalie, setDiAnomalie] = useState('');
  const [diUrgence, setDiUrgence] = useState<'Mineure' | 'Majeure' | 'Critique (Arrêt)'>('Majeure');

  const [selectedBtForSubmit, setSelectedBtForSubmit] = useState<any | null>(null);
  const [btActionRealisee, setBtActionRealisee] = useState('');
  const [btSpareRef, setBtSpareRef] = useState('');
  const [btSpareQty, setBtSpareQty] = useState('1');

  const activeMachines = useMemo(() => filterActiveMachines(machines), [machines]);

  const techScope = useMemo(
    () =>
      buildTechnicianDashboardScope({
        user: currentUser,
        technicians,
        preventiveTasks,
        preventiveExecutions,
        correctiveInterventions,
        mouvements,
      }),
    [currentUser, technicians, preventiveTasks, preventiveExecutions, correctiveInterventions, mouvements]
  );

  // Pending Maker-Checker counts for Admin summary
  const adminPendingCounts = useMemo(() => {
    const prevCount = (preventiveExecutions || []).filter(
      (ex) => ex.validation_status === 'PENDING_VALIDATION'
    ).length;
    const corrCount = (correctiveInterventions || []).filter(
      (i) => i.validation_status === 'PENDING_VALIDATION' || i.statut === 'EN_ATTENTE_VALIDATION'
    ).length;
    const sortieCount = (sortieDemands || []).filter(
      (d) => d.validation_status === 'PENDING_VALIDATION'
    ).length;
    return {
      prevCount,
      corrCount,
      sortieCount,
      total: prevCount + corrCount + sortieCount,
    };
  }, [preventiveExecutions, correctiveInterventions, sortieDemands]);

  // Scoped Preventive List for Technician
  const filteredPreventiveTasks = useMemo(() => {
    if (prevFilter === 'OVERDUE') return techScope.overdueTasks;
    if (prevFilter === 'CLARIFY') {
      const clarifyTaskIds = new Set(
        (techScope.needsClarificationPreventive || []).map((ex: any) => String(ex.taskId))
      );
      return techScope.myPreventiveTasks.filter((t: any) => clarifyTaskIds.has(String(t.id)));
    }
    if (prevFilter === 'TODO') {
      return [...techScope.overdueTasks, ...techScope.todoTasks];
    }
    return techScope.myPreventiveTasks;
  }, [prevFilter, techScope]);

  // Scoped Corrective List for Technician
  const filteredCorrectiveItems = useMemo(() => {
    if (corrFilter === 'CLARIFY') return techScope.myNeedsClarificationBt || [];
    if (corrFilter === 'PENDING') return techScope.myPendingValidationBt || [];
    if (corrFilter === 'ACTIVE') return techScope.myActiveBt || [];
    return techScope.myInterventions || [];
  }, [corrFilter, techScope]);

  const handleQrScanResult = (scannedRaw: string) => {
    const clean = String(scannedRaw || '').trim();
    if (!clean) return;

    // Support URLs with ?qr_machine=CODE or direct machine codes
    let candidateCode = clean;
    try {
      if (clean.includes('qr_machine=')) {
        const u = new URL(clean, window.location.origin);
        candidateCode = u.searchParams.get('qr_machine') || clean;
      }
    } catch {
      // keep raw
    }

    const matchedMachine = machines.find(
      (m) =>
        String(m.id_machine_registered || '').toLowerCase() === candidateCode.toLowerCase() ||
        String(m.designation || m.nom || '').toLowerCase() === candidateCode.toLowerCase()
    );

    if (matchedMachine) {
      setIsQrScannerOpen(false);
      onOpenMachineQrModal?.(matchedMachine.id_machine_registered);
      return;
    }

    showToast?.(`Code scanné : ${candidateCode}`, 'info');
  };

  const handleOpenExecSheet = (task: any) => {
    setSelectedTaskForExec(task);
    setExecNotes(task.observations || '');
    setExecDuration(String(task.duree_estimee_min || 20));
    setExecSpareRef(task.pdr_ref || '');
    setExecSpareQty(String(task.pdr_quantite || 1));
  };

  const handleSubmitPreventiveExec = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTaskForExec) return;

    const sparesUsed: any[] = [];
    if (execSpareRef.trim()) {
      const matchedStock = stockItems.find(
        (s) => String(s.ref || '').toUpperCase() === execSpareRef.trim().toUpperCase()
      );
      sparesUsed.push({
        ref: execSpareRef.trim(),
        designation: matchedStock?.designation || execSpareRef.trim(),
        qty: Math.max(1, Number(execSpareQty) || 1),
        unit: matchedStock?.unite || 'pcs',
        unitPrice: Number(matchedStock?.prix || matchedStock?.prix_unitaire || 0),
      });
    }

    const techName =
      getTechnicianDisplayName(currentUser, technicians) ||
      currentUser?.name ||
      currentUser?.nom ||
      'Technicien';

    onMarkTaskDone(selectedTaskForExec.id, {
      date_realisation: new Date().toISOString().split('T')[0],
      executant: techName,
      id_technician: currentUser?.id_technician || currentUser?.id || '',
      submittedByRole: 'TECHNICIEN',
      submittedById: currentUser?.id_technician || currentUser?.id || 'tech',
      submittedByName: techName,
      durationMinutes: Math.max(1, Number(execDuration) || 20),
      notes: execNotes.trim() || 'Exécution terrain validée (MobileShell)',
      sparesUsed,
    });

    setSelectedTaskForExec(null);
    showToast?.(
      'Exécution préventive transmise pour validation responsable (Maker-Checker).',
      'success'
    );
  };

  const handleCreateMobileDi = (e: React.FormEvent) => {
    e.preventDefault();
    if (!diMachineId || !diAnomalie.trim()) return;

    const targetMachine = activeMachines.find(
      (m) => String(m.id_machine_registered) === String(diMachineId)
    );
    const targetZone = zones.find(
      (z) => String(z.id_zone) === String(targetMachine?.id_zone_default || targetMachine?.id_zone)
    );
    const techName =
      getTechnicianDisplayName(currentUser, technicians) ||
      currentUser?.name ||
      currentUser?.nom ||
      'Technicien';

    onAddDemandeIntervention({
      code_machine: targetMachine?.id_machine_registered || diMachineId,
      id_machine_registered: targetMachine?.id_machine_registered || diMachineId,
      nom_machine: targetMachine?.designation || targetMachine?.nom || diMachineId,
      id_zone: targetMachine?.id_zone_default || targetMachine?.id_zone || '',
      zone: targetZone?.nom_zone || targetZone?.libelle || targetMachine?.id_zone_default || '',
      anomalie: diAnomalie.trim(),
      urgence: diUrgence,
      demandeur: techName,
      intervenant: techName,
      id_technician: currentUser?.id_technician || currentUser?.id || '',
      categorie_panne: 'MECANIQUE',
    });

    setDiAnomalie('');
    setShowNewDiSheet(false);
    showToast?.("Demande d'intervention (DI) enregistrée sur le terrain.", 'success');
  };

  const handleOpenBtSubmitSheet = (bt: any) => {
    setSelectedBtForSubmit(bt);
    setBtActionRealisee(bt.action_realisee || bt.travail_a_faire || '');
    setBtSpareRef(bt.pdr_ref || '');
    setBtSpareQty(String(bt.pdr_quantite || 1));
  };

  const handleSubmitMobileBt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBtForSubmit || !btActionRealisee.trim()) return;

    const piecesProposees: any[] = [];
    if (btSpareRef.trim()) {
      const matchedStock = stockItems.find(
        (s) => String(s.ref || '').toUpperCase() === btSpareRef.trim().toUpperCase()
      );
      piecesProposees.push({
        source: 'STOCK_PDR',
        ref: btSpareRef.trim(),
        designation: matchedStock?.designation || btSpareRef.trim(),
        quantite: Math.max(1, Number(btSpareQty) || 1),
        unit: matchedStock?.unite || 'pcs',
      });
    }

    const techName =
      getTechnicianDisplayName(currentUser, technicians) ||
      currentUser?.name ||
      currentUser?.nom ||
      'Technicien';

    onSubmitInterventionForValidation(selectedBtForSubmit.id, {
      action_realisee: btActionRealisee.trim(),
      intervenant: techName,
      submitted_by_id: currentUser?.id_technician || currentUser?.id || 'tech',
      submitted_by_name: techName,
      pieces_proposees: piecesProposees,
      pdr_utilisee: piecesProposees.length > 0 ? 'OUI' : 'NON',
    });

    setSelectedBtForSubmit(null);
    showToast?.('Rapport BT transmis pour validation responsable (Maker-Checker).', 'success');
  };

  // ============================================================================
  // CASE 1: ADMIN / NON-TECHNICIAN ON RESOLVED === 'mobile'
  // Honest Mobile Gateway — No fake compressed 20-page desktop Admin suite
  // ============================================================================
  if (!isTech) {
    return (
      <div
        data-testid="mobile-shell-admin-gateway"
        className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-5 font-sans select-none"
      >
        {/* Top Bar */}
        <header className="flex items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-black">
              G4
            </div>
            <div>
              <div className="text-sm font-black tracking-tight flex items-center gap-2">
                <span>CIOB GMAO v4</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Shell: {resolved}
                </span>
              </div>
              <div className="text-[11px] text-slate-400">
                Session : {currentUser?.name || currentUser?.nom || 'Administrateur'} (ADMIN)
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="p-2.5 rounded-xl bg-slate-900 hover:bg-rose-950/60 text-slate-300 hover:text-rose-300 border border-slate-800 transition cursor-pointer"
            title="Déconnexion"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </header>

        {/* Center Honest Card */}
        <main className="my-auto py-6 space-y-5 max-w-md mx-auto w-full">
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Smartphone className="w-6 h-6" />
            </div>

            <div className="space-y-2">
              <h1 className="text-lg font-black tracking-tight text-white">
                Interface Mobile dédiée au Terrain
              </h1>
              <p className="text-xs text-slate-300 leading-relaxed">
                L'interface téléphone est conçue pour les techniciens d'intervention sur le terrain.
                Pour l'administration complète de l'usine (Parc Machines, Stock, Blueprints, Paramètres),
                utilisez le mode Bureau (Desktop).
              </p>
              <p
                dir="rtl"
                className="text-xs text-emerald-300/90 font-semibold leading-relaxed bg-emerald-950/40 border border-emerald-800/50 rounded-xl p-3"
              >
                واجهة الهاتف مخصّصة للميدان — لإدارة المصنع الكاملة استخدم وضع سطح المكتب.
              </p>
            </div>

            {/* Primary CTA: Force Desktop Mode */}
            <button
              type="button"
              data-testid="force-desktop-mode-btn"
              onClick={() => setMode('desktop')}
              className="w-full py-3.5 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-500/20 transition cursor-pointer"
            >
              <Monitor className="w-5 h-5" />
              <span>Forcer le mode Bureau (Desktop)</span>
            </button>

            {/* Quick Maker-Checker Radar Summary & Shortcuts */}
            <div className="pt-3 border-t border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">
                  File d'attente Maker-Checker (À valider)
                </span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-black bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  {adminPendingCounts.total} en attente
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setCurrentTab('preventive');
                    setMode('desktop');
                  }}
                  className="p-2.5 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 transition cursor-pointer"
                >
                  <div className="text-base font-black font-mono text-indigo-400">
                    {adminPendingCounts.prevCount}
                  </div>
                  <div className="text-[10px] text-slate-400 font-bold">Préventif</div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCurrentTab('corrective');
                    setMode('desktop');
                  }}
                  className="p-2.5 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 transition cursor-pointer"
                >
                  <div className="text-base font-black font-mono text-amber-400">
                    {adminPendingCounts.corrCount}
                  </div>
                  <div className="text-[10px] text-slate-400 font-bold">Correctif BT</div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCurrentTab('sortie');
                    setMode('desktop');
                  }}
                  className="p-2.5 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 transition cursor-pointer"
                >
                  <div className="text-base font-black font-mono text-teal-400">
                    {adminPendingCounts.sortieCount}
                  </div>
                  <div className="text-[10px] text-slate-400 font-bold">Bons PDR</div>
                </button>
              </div>
            </div>
          </div>

          {/* ShellPolicy Developer / Session Switcher */}
          <div className="text-slate-900">
            <ShellModeSwitcher />
          </div>
        </main>

        <footer className="text-center text-[11px] text-slate-500 font-mono pt-2 border-t border-slate-900">
          ShellPolicy • mode={mode} • resolved={resolved}
        </footer>
      </div>
    );
  }

  // ============================================================================
  // CASE 2: TECHNICIEN ON RESOLVED === 'mobile'
  // Dedicated 4-Tab Field Mobile Shell (Aujourd'hui | Préventif | Correctif | Plus)
  // ============================================================================
  const techDisplayName = getTechnicianDisplayName(currentUser, technicians);
  const techBadge = getTechnicianBadgeLabel(currentUser, technicians);
  const urgentPrevCount =
    techScope.overdueTasks.length + (techScope.needsClarificationPreventive?.length || 0);
  const activeCorrCount =
    techScope.myActiveBt.length + (techScope.myNeedsClarificationBt?.length || 0);

  return (
    <div
      data-testid="mobile-shell-technician"
      className="min-h-screen bg-slate-100 text-slate-900 flex flex-col justify-between pb-20 font-sans select-none"
    >
      {/* Top Field Bar */}
      <header className="sticky top-0 z-30 bg-slate-900 text-white px-4 py-3 shadow-md flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs flex items-center justify-center shrink-0 shadow-xs">
            TER
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-black truncate">{techDisplayName}</span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono text-[10px] font-bold shrink-0">
                {techBadge}
              </span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5">
              <span>Poste Terrain Mobile</span>
              <span>•</span>
              <span className="text-emerald-400">shell={resolved}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setIsQrScannerOpen(true)}
            className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
            title="Scanner QR Machine"
          >
            <QrCode className="w-4 h-4" />
            <span>QR</span>
          </button>
        </div>
      </header>

      {/* Main Tab View Content */}
      <main className="flex-1 p-3.5 space-y-4 max-w-lg mx-auto w-full">
        {/* TAB 1: AUJOURD'HUI (R5 Technician Dashboard Scope) */}
        {activeTab === 'today' && (
          <div data-testid="mobile-tab-today" className="space-y-4">
            {/* Hero Field Banner */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Semaine {techScope.currentWeekKey}
                  </span>
                  <h2 className="text-base font-black text-slate-900 mt-1">
                    Ma Journée de Terrain
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsQrScannerOpen(true)}
                  className="p-3 rounded-2xl bg-slate-900 text-white flex items-center gap-2 text-xs font-bold shadow-xs cursor-pointer"
                >
                  <QrCode className="w-4 h-4 text-emerald-400" />
                  <span>Scanner Équipement</span>
                </button>
              </div>

              {/* 2x2 Big Touch KPI Grid */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setPrevFilter('TODO');
                    setActiveTab('preventive');
                  }}
                  className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-200 text-left space-y-1 transition active:scale-98 cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase text-indigo-800">
                      Préventif à faire
                    </span>
                    <Calendar className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div className="text-2xl font-black font-mono text-indigo-950">
                    {techScope.overdueTasks.length + techScope.todoTasks.length}
                  </div>
                  <div className="text-[10px] font-mono text-indigo-700">
                    {techScope.overdueTasks.length} en retard
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCorrFilter('ACTIVE');
                    setActiveTab('corrective');
                  }}
                  className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200 text-left space-y-1 transition active:scale-98 cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase text-amber-900">
                      Mes BT Actifs
                    </span>
                    <Wrench className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="text-2xl font-black font-mono text-amber-950">
                    {techScope.myActiveBt.length}
                  </div>
                  <div className="text-[10px] font-mono text-amber-800">
                    {techScope.myPendingValidationBt.length} en attente val.
                  </div>
                </button>
              </div>

              {/* Clarification Alert Banner if Admin requested clarification */}
              {((techScope.needsClarificationPreventive?.length || 0) > 0 ||
                (techScope.myNeedsClarificationBt?.length || 0) > 0) && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-rose-900 text-xs font-bold">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>
                      {(techScope.needsClarificationPreventive?.length || 0) +
                        (techScope.myNeedsClarificationBt?.length || 0)}{' '}
                      rapport(s) à clarifier pour le responsable
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if ((techScope.needsClarificationPreventive?.length || 0) > 0) {
                        setPrevFilter('CLARIFY');
                        setActiveTab('preventive');
                      } else {
                        setCorrFilter('CLARIFY');
                        setActiveTab('corrective');
                      }
                    }}
                    className="px-2.5 py-1 rounded-lg bg-rose-600 text-white text-[11px] font-bold shrink-0 cursor-pointer"
                  >
                    Voir
                  </button>
                </div>
              )}
            </div>

            {/* Quick Priority Preventive List (Top 4) */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-indigo-600" />
                  <span>Urgences Préventives</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveTab('preventive')}
                  className="text-xs font-bold text-indigo-600 flex items-center gap-1 cursor-pointer"
                >
                  <span>Tout voir</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {techScope.overdueTasks.length === 0 && techScope.todoTasks.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-50 text-center text-xs text-slate-500">
                  Aucune tâche préventive en attente pour votre poste.
                </div>
              ) : (
                <div className="space-y-2">
                  {[...techScope.overdueTasks, ...techScope.todoTasks].slice(0, 4).map((task: any) => (
                    <div
                      key={task.id}
                      className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-black text-slate-900">
                            {task.id_machine || task.machine}
                          </span>
                          {task._scopeBucket === 'OVERDUE' && (
                            <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-mono text-[9px] font-bold">
                              RETARD
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-600 truncate">
                          {task.tache || task.intitule || task.organe || 'Inspection préventive'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleOpenExecSheet(task)}
                        className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold shrink-0 cursor-pointer"
                      >
                        Valider
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Active Corrective BTs */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <Wrench className="w-4 h-4 text-amber-600" />
                  <span>Interventions Correctives</span>
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowNewDiSheet(true);
                    setActiveTab('corrective');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 text-xs font-black flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Signaler DI</span>
                </button>
              </div>

              {techScope.myActiveBt.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-50 text-center text-xs text-slate-500">
                  Aucun Bon de Travail (BT) actif en cours.
                </div>
              ) : (
                <div className="space-y-2">
                  {techScope.myActiveBt.slice(0, 3).map((bt: any) => (
                    <div
                      key={bt.id}
                      className="p-3 rounded-xl border border-amber-200 bg-amber-50/40 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-black text-slate-900">
                            {bt.code_machine || bt.id_machine_registered}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-mono text-[9px] font-bold">
                            {bt.num_bt || bt.statut}
                          </span>
                        </div>
                        <div className="text-xs text-slate-600 truncate">
                          {bt.anomalie || bt.travail_a_faire}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('corrective');
                          handleOpenBtSubmitSheet(bt);
                        }}
                        className="px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold shrink-0 cursor-pointer"
                      >
                        Rapport
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: PRÉVENTIF (Scoped Cards + 1-Tap Maker-Checker Execution) */}
        {activeTab === 'preventive' && (
          <div data-testid="mobile-tab-preventive" className="space-y-3">
            <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-indigo-600" />
                  <span>Mes Tâches Préventives ({filteredPreventiveTasks.length})</span>
                </h2>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {[
                  { id: 'TODO', label: `À faire (${techScope.overdueTasks.length + techScope.todoTasks.length})` },
                  { id: 'OVERDUE', label: `Retard (${techScope.overdueTasks.length})` },
                  { id: 'CLARIFY', label: `À clarifier (${techScope.needsClarificationPreventive?.length || 0})` },
                  { id: 'ALL', label: `Toutes (${techScope.myPreventiveTasks.length})` },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setPrevFilter(f.id as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                      prevFilter === f.id
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {filteredPreventiveTasks.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <div className="text-sm font-bold text-slate-800">Aucune tâche dans ce filtre</div>
                <p className="text-xs text-slate-500">
                  Vos interventions préventives assignées apparaissent ici sous forme de cartes tactiles.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredPreventiveTasks.map((task: any) => {
                  const isOverdue = task._scopeBucket === 'OVERDUE';
                  const isDone = task._scopeBucket === 'DONE';
                  return (
                    <div
                      key={task.id}
                      className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-sm font-black text-slate-900">
                              {task.id_machine || task.machine}
                            </span>
                            {isOverdue && (
                              <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 font-mono text-[10px] font-bold">
                                EN RETARD
                              </span>
                            )}
                            {isDone && (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-mono text-[10px] font-bold">
                                TERMINÉ
                              </span>
                            )}
                            {task.validation_status === 'PENDING_VALIDATION' && (
                              <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 font-mono text-[10px] font-bold">
                                EN ATTENTE VAL.
                              </span>
                            )}
                          </div>
                          <div className="text-xs font-bold text-slate-800 mt-1">
                            {task.tache || task.intitule || 'Inspection préventive'}
                          </div>
                          {task.organe && (
                            <div className="text-[11px] text-slate-500">Organe : {task.organe}</div>
                          )}
                        </div>
                        <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-700 font-mono text-[10px] font-bold shrink-0">
                          {task.periodicite || 'Hebdo'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-2">
                        <span className="text-[11px] text-slate-500 font-mono">
                          Durée est. : {task.duree_estimee_min || 20} min
                        </span>
                        <button
                          type="button"
                          onClick={() => handleOpenExecSheet(task)}
                          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Exécuter / Soumettre</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: CORRECTIF (Scoped DI/BT Cards + Quick DI + BT Report Submission) */}
        {activeTab === 'corrective' && (
          <div data-testid="mobile-tab-corrective" className="space-y-3">
            <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                  <Wrench className="w-4 h-4 text-amber-600" />
                  <span>Correctif Terrain ({filteredCorrectiveItems.length})</span>
                </h2>
                <button
                  type="button"
                  onClick={() => setShowNewDiSheet(true)}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1 shadow-2xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nouvelle DI</span>
                </button>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {[
                  { id: 'ACTIVE', label: `Actifs (${techScope.myActiveBt.length})` },
                  { id: 'CLARIFY', label: `À clarifier (${techScope.myNeedsClarificationBt?.length || 0})` },
                  { id: 'PENDING', label: `En attente val. (${techScope.myPendingValidationBt?.length || 0})` },
                  { id: 'ALL', label: `Tous (${techScope.myInterventions.length})` },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setCorrFilter(f.id as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                      corrFilter === f.id
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {filteredCorrectiveItems.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center space-y-2">
                <Wrench className="w-8 h-8 text-slate-400 mx-auto" />
                <div className="text-sm font-bold text-slate-800">Aucune intervention dans ce filtre</div>
                <p className="text-xs text-slate-500">
                  Utilisez le bouton « Nouvelle DI » pour déclarer une anomalie sur une machine active.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredCorrectiveItems.map((item: any) => {
                  const status = String(item.statut || 'DEMANDE').toUpperCase();
                  const vStatus = String(item.validation_status || 'NONE').toUpperCase();
                  return (
                    <div
                      key={item.id}
                      className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-sm font-black text-slate-900">
                              {item.code_machine || item.id_machine_registered}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-mono text-[10px] font-bold">
                              {item.num_bt || item.id}
                            </span>
                            {vStatus === 'NEEDS_CLARIFICATION' && (
                              <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-mono text-[10px] font-bold">
                                À CLARIFIER
                              </span>
                            )}
                            {vStatus === 'PENDING_VALIDATION' && (
                              <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-mono text-[10px] font-bold">
                                EN ATTENTE VAL.
                              </span>
                            )}
                          </div>
                          <div className="text-xs font-bold text-slate-800 mt-1">
                            {item.anomalie || item.travail_a_faire || 'Anomalie signalée'}
                          </div>
                          {item.validation_note && (
                            <div className="mt-1.5 p-2 rounded-lg bg-rose-50 border border-rose-200 text-[11px] text-rose-900">
                              Note Admin : {item.validation_note}
                            </div>
                          )}
                        </div>
                        <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-700 font-mono text-[10px] font-bold shrink-0">
                          {status}
                        </span>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                        {(status === 'DEMANDE' || status === 'BT_PLANIFIE') && (
                          <button
                            type="button"
                            onClick={() => {
                              onStartLiveIntervention(item.id);
                              showToast?.('Intervention démarrée (EN_COURS).', 'info');
                            }}
                            className="px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                          >
                            <Play className="w-3.5 h-3.5" />
                            <span>Démarrer</span>
                          </button>
                        )}

                        {status !== 'CLOTURE' && vStatus !== 'PENDING_VALIDATION' && (
                          <button
                            type="button"
                            onClick={() => handleOpenBtSubmitSheet(item)}
                            className="px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Soumettre Rapport</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: PLUS / COMPTE (Identity + ShellPolicy Switcher + Force Desktop + Logout) */}
        {activeTab === 'more' && (
          <div data-testid="mobile-tab-more" className="space-y-4">
            {/* Technician Identity Card */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white font-black text-base flex items-center justify-center">
                  {techDisplayName.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-black text-slate-900">{techDisplayName}</div>
                  <div className="text-xs font-mono text-emerald-700 font-bold">
                    Matricule : {techBadge} • Rôle : TECHNICIEN
                  </div>
                </div>
              </div>
            </div>

            {/* ShellPolicy Switcher (Auto / Desktop / Mobile) */}
            <ShellModeSwitcher />

            {/* Force Desktop Button */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-2.5">
              <div className="text-xs font-bold text-slate-700">
                Besoin des tableaux complets sur grand écran ?
              </div>
              <button
                type="button"
                data-testid="tech-force-desktop-btn"
                onClick={() => setMode('desktop')}
                className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Monitor className="w-4 h-4 text-emerald-400" />
                <span>Forcer le mode Bureau (Desktop)</span>
              </button>
            </div>

            {/* Logout Button */}
            <button
              type="button"
              onClick={onLogout}
              className="w-full py-3.5 px-4 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Se déconnecter de la session</span>
            </button>
          </div>
        )}
      </main>

      {/* Bottom 4-Tab Field Navigation Bar */}
      <nav
        aria-label="Navigation Mobile Terrain"
        className="fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 px-2 py-1.5 grid grid-cols-4 gap-1 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]"
      >
        <button
          type="button"
          onClick={() => setActiveTab('today')}
          data-testid="mobile-nav-today"
          className={`py-2 rounded-xl flex flex-col items-center justify-center gap-0.5 transition cursor-pointer ${
            activeTab === 'today' ? 'text-emerald-700 bg-emerald-50 font-black' : 'text-slate-500'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[10px]">Aujourd'hui</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('preventive')}
          data-testid="mobile-nav-preventive"
          className={`py-2 rounded-xl flex flex-col items-center justify-center gap-0.5 relative transition cursor-pointer ${
            activeTab === 'preventive' ? 'text-indigo-700 bg-indigo-50 font-black' : 'text-slate-500'
          }`}
        >
          <Calendar className="w-5 h-5" />
          <span className="text-[10px]">Préventif</span>
          {urgentPrevCount > 0 && (
            <span className="absolute top-1 right-4 px-1.5 py-0.2 rounded-full bg-rose-600 text-white font-mono text-[9px] font-black">
              {urgentPrevCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('corrective')}
          data-testid="mobile-nav-corrective"
          className={`py-2 rounded-xl flex flex-col items-center justify-center gap-0.5 relative transition cursor-pointer ${
            activeTab === 'corrective' ? 'text-amber-700 bg-amber-50 font-black' : 'text-slate-500'
          }`}
        >
          <Wrench className="w-5 h-5" />
          <span className="text-[10px]">Correctif</span>
          {activeCorrCount > 0 && (
            <span className="absolute top-1 right-4 px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 font-mono text-[9px] font-black">
              {activeCorrCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('more')}
          data-testid="mobile-nav-more"
          className={`py-2 rounded-xl flex flex-col items-center justify-center gap-0.5 transition cursor-pointer ${
            activeTab === 'more' ? 'text-slate-900 bg-slate-100 font-black' : 'text-slate-500'
          }`}
        >
          <User className="w-5 h-5" />
          <span className="text-[10px]">Plus</span>
        </button>
      </nav>

      {/* SHEET 1: Preventive Task Maker-Checker Submission */}
      {selectedTaskForExec && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-3">
          <form
            onSubmit={handleSubmitPreventiveExec}
            className="w-full max-w-md bg-white rounded-3xl p-5 space-y-4 shadow-2xl border border-slate-200"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="font-mono text-xs font-black text-indigo-700">
                  {selectedTaskForExec.id_machine || selectedTaskForExec.machine}
                </span>
                <h3 className="text-sm font-black text-slate-900">
                  Valider l'exécution préventive
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTaskForExec(null)}
                className="p-1.5 rounded-xl bg-slate-100 text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Observations terrain
                </label>
                <textarea
                  rows={2}
                  value={execNotes}
                  onChange={(e) => setExecNotes(e.target.value)}
                  placeholder="RAS, contrôle conforme, graissage effectué..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Durée (minutes)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={execDuration}
                    onChange={(e) => setExecDuration(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Qté PDR (si utilisée)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={execSpareQty}
                    onChange={(e) => setExecSpareQty(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Référence PDR utilisée (optionnel — sans déduction immédiate)
                </label>
                <select
                  value={execSpareRef}
                  onChange={(e) => setExecSpareRef(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-mono bg-white"
                >
                  <option value="">— Aucune pièce utilisée —</option>
                  {stockItems.map((s) => (
                    <option key={s.ref} value={s.ref}>
                      {s.ref} — {s.designation} (Dispo: {s.stockActuel})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedTaskForExec(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-black flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Soumettre (Maker-Checker)</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SHEET 2: Quick New DI (Demande d'Intervention) */}
      {showNewDiSheet && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-3">
          <form
            onSubmit={handleCreateMobileDi}
            className="w-full max-w-md bg-white rounded-3xl p-5 space-y-4 shadow-2xl border border-slate-200"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-900">
                Signaler une Anomalie (Nouvelle DI)
              </h3>
              <button
                type="button"
                onClick={() => setShowNewDiSheet(false)}
                className="p-1.5 rounded-xl bg-slate-100 text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Équipement / Machine active *
                </label>
                <select
                  required
                  value={diMachineId}
                  onChange={(e) => setDiMachineId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-xs font-mono bg-white"
                >
                  <option value="">— Sélectionner un équipement —</option>
                  {activeMachines.map((m) => (
                    <option key={m.id_machine_registered} value={m.id_machine_registered}>
                      {m.id_machine_registered} — {m.designation || m.nom}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Description de l'anomalie *
                </label>
                <textarea
                  required
                  rows={2}
                  value={diAnomalie}
                  onChange={(e) => setDiAnomalie(e.target.value)}
                  placeholder="Bruit anormal, fuite d'air, arrêt capteur..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Urgence</label>
                <select
                  value={diUrgence}
                  onChange={(e) => setDiUrgence(e.target.value as any)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs bg-white"
                >
                  <option value="Mineure">Mineure</option>
                  <option value="Majeure">Majeure</option>
                  <option value="Critique (Arrêt)">Critique (Arrêt)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowNewDiSheet(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-4 py-2.5 rounded-xl bg-amber-500 text-slate-950 text-xs font-black"
              >
                Enregistrer la DI
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SHEET 3: Submit BT Report for Maker-Checker Validation */}
      {selectedBtForSubmit && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-3">
          <form
            onSubmit={handleSubmitMobileBt}
            className="w-full max-w-md bg-white rounded-3xl p-5 space-y-4 shadow-2xl border border-slate-200"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="font-mono text-xs font-black text-amber-700">
                  {selectedBtForSubmit.code_machine || selectedBtForSubmit.id_machine_registered} •{' '}
                  {selectedBtForSubmit.num_bt || selectedBtForSubmit.id}
                </span>
                <h3 className="text-sm font-black text-slate-900">
                  Rapport d'intervention (Maker-Checker)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBtForSubmit(null)}
                className="p-1.5 rounded-xl bg-slate-100 text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Travaux réalisés *
                </label>
                <textarea
                  required
                  rows={2}
                  value={btActionRealisee}
                  onChange={(e) => setBtActionRealisee(e.target.value)}
                  placeholder="Remplacement joint, réarmement thermique, essais concluants..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Pièce PDR utilisée (proposée pour validation Admin)
                </label>
                <select
                  value={btSpareRef}
                  onChange={(e) => setBtSpareRef(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-mono bg-white"
                >
                  <option value="">— Aucune pièce PDR —</option>
                  {stockItems.map((s) => (
                    <option key={s.ref} value={s.ref}>
                      {s.ref} — {s.designation} (Dispo: {s.stockActuel})
                    </option>
                  ))}
                </select>
              </div>

              {btSpareRef && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Quantité PDR
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={btSpareQty}
                    onChange={(e) => setBtSpareQty(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-mono"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedBtForSubmit(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-black flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Transmettre au Responsable</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Camera QR Scanner Modal */}
      <QRScannerModal
        isOpen={isQrScannerOpen}
        onClose={() => setIsQrScannerOpen(false)}
        onScan={handleQrScanResult}
      />
    </div>
  );
}
