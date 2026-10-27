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
  X,
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
import TodayTab from './mobile/TodayTab';
import PreventiveTab, { type MobilePrevFilter } from './mobile/PreventiveTab';
import CorrectiveTab, { type MobileCorrFilter } from './mobile/CorrectiveTab';

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
  activeLiveInterventionId?: string | null;
  onMarkTaskDone: (id: string, validationData: any) => void;
  onAddDemandeIntervention: (data: any) => any;
  onStartLiveIntervention: (id: string) => void;
  onSubmitInterventionForValidation: (id: string, submissionData: any) => any;
  onOpenMachineQrModal?: (machineId: string) => void;
  showToast?: (msg: string, type?: string) => void;
  toast?: { message: string; type?: string } | null;
  setToast?: (t: any) => void;
}

export type MobileTabId = 'today' | 'preventive' | 'corrective' | 'more';

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
  activeLiveInterventionId = null,
  onMarkTaskDone,
  onAddDemandeIntervention,
  onStartLiveIntervention,
  onSubmitInterventionForValidation,
  onOpenMachineQrModal,
  showToast,
  toast,
  setToast,
}: MobileShellProps) {
  const { mode, resolved, setMode } = useAppShell();
  const isTech = isTechnicianRole(currentUser);

  const [activeTab, setActiveTab] = useState<MobileTabId>('today');
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);

  // Cross-tab navigation intents from TodayTab
  const [prevInitialFilter, setPrevInitialFilter] = useState<MobilePrevFilter>('TODO');
  const [prevTaskToExecute, setPrevTaskToExecute] = useState<any | null>(null);

  const [corrInitialFilter, setCorrInitialFilter] = useState<MobileCorrFilter>('ACTIVE');
  const [corrOpenNewDi, setCorrOpenNewDi] = useState(false);
  const [corrBtToSubmit, setCorrBtToSubmit] = useState<any | null>(null);

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

  const handleQrScanResult = (scannedRaw: string) => {
    const clean = String(scannedRaw || '').trim();
    if (!clean) return;

    // Support URLs with ?machine_qr=CODE, ?qr_machine=CODE, or direct machine codes
    let candidateCode = clean;
    try {
      if (clean.includes('machine_qr=') || clean.includes('qr_machine=')) {
        const u = new URL(clean, window.location.origin);
        candidateCode =
          u.searchParams.get('machine_qr') || u.searchParams.get('qr_machine') || clean;
      }
    } catch {
      // keep raw
    }

    const normCandidate = candidateCode.trim().toLowerCase();
    const matchedMachine = machines.find(
      (m) =>
        String(m.id_machine_registered || m.id || m.code || '').trim().toLowerCase() ===
          normCandidate ||
        String(m.designation || m.nom || '').trim().toLowerCase() === normCandidate
    );

    if (matchedMachine) {
      setIsQrScannerOpen(false);
      onOpenMachineQrModal?.(
        matchedMachine.id_machine_registered || matchedMachine.id || matchedMachine.code
      );
      return;
    }

    showToast?.(`Code scanné : ${candidateCode}`, 'info');
  };

  // ============================================================================
  // CASE 1: ADMIN / NON-TECHNICIAN ON RESOLVED === 'mobile'
  // Honest Mobile Gateway — Untouched in this round
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
  // Deepened 4-Tab Field Mobile Shell (Aujourd'hui | Préventif | Correctif | Plus)
  // ============================================================================
  const techDisplayName = getTechnicianDisplayName(currentUser, technicians);
  const techBadge = getTechnicianBadgeLabel(currentUser, technicians);

  const overduePrevCount = techScope.overdueTasks?.length || 0;
  const clarifyPrevCount = techScope.needsClarificationPreventive?.length || 0;
  const urgentPrevCount = overduePrevCount + clarifyPrevCount;

  const openCorrCount = techScope.openCorrective?.length || 0;
  const clarifyCorrCount = techScope.needsClarificationCorrective?.length || 0;
  const activeCorrCount = openCorrCount + clarifyCorrCount;

  const totalClarifyCount = clarifyPrevCount + clarifyCorrCount;

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
            data-testid="header-qr-scan-btn"
            className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
            title="Scanner QR Machine"
          >
            <QrCode className="w-4 h-4" />
            <span>QR</span>
          </button>
        </div>
      </header>

      {/* Mobile Toast Notification Banner */}
      {toast?.message && (
        <div className="sticky top-14 z-40 px-3.5 pt-2 max-w-lg mx-auto w-full">
          <div
            className={`p-3 rounded-2xl shadow-lg border flex items-center justify-between gap-2 text-xs font-bold ${
              toast.type === 'error'
                ? 'bg-rose-950 text-white border-rose-700'
                : 'bg-slate-900 text-emerald-300 border-slate-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{toast.message}</span>
            </div>
            {setToast && (
              <button
                type="button"
                onClick={() => setToast(null)}
                className="p-1 rounded-lg hover:bg-white/10 text-slate-300 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Tab View Content */}
      <main className="flex-1 p-3.5 space-y-4 max-w-lg mx-auto w-full">
        {/* TAB 1: AUJOURD'HUI (R5 Technician Dashboard Scope) */}
        {activeTab === 'today' && (
          <TodayTab
            techScope={techScope}
            activeMachines={activeMachines}
            activeLiveInterventionId={activeLiveInterventionId}
            onOpenQrScanner={() => setIsQrScannerOpen(true)}
            onOpenMachineQrModal={onOpenMachineQrModal}
            onNavigateToPreventive={(filter = 'TODO', taskToExecute = null) => {
              setPrevInitialFilter(filter);
              setPrevTaskToExecute(taskToExecute);
              setActiveTab('preventive');
            }}
            onNavigateToCorrective={(filter = 'ACTIVE', options = {}) => {
              setCorrInitialFilter(filter);
              setCorrOpenNewDi(Boolean(options.openNewDi));
              setCorrBtToSubmit(options.btToSubmit || null);
              setActiveTab('corrective');
            }}
            onStartLiveIntervention={onStartLiveIntervention}
            showToast={showToast}
          />
        )}

        {/* TAB 2: PRÉVENTIF (R4 Scoped + Maker-Checker Submission) */}
        {activeTab === 'preventive' && (
          <PreventiveTab
            currentUser={currentUser}
            technicians={technicians}
            techScope={techScope}
            stockItems={stockItems}
            initialFilter={prevInitialFilter}
            initialTaskToExecute={prevTaskToExecute}
            onClearInitialTask={() => setPrevTaskToExecute(null)}
            onMarkTaskDone={onMarkTaskDone}
            onOpenMachineQrModal={onOpenMachineQrModal}
            showToast={showToast}
          />
        )}

        {/* TAB 3: CORRECTIF (Field DI/BT + Maker-Checker Submission) */}
        {activeTab === 'corrective' && (
          <CorrectiveTab
            currentUser={currentUser}
            technicians={technicians}
            techScope={techScope}
            machines={machines}
            zones={zones}
            stockItems={stockItems}
            activeLiveInterventionId={activeLiveInterventionId}
            initialFilter={corrInitialFilter}
            initialOpenNewDi={corrOpenNewDi}
            initialBtToSubmit={corrBtToSubmit}
            onClearInitialIntent={() => {
              setCorrOpenNewDi(false);
              setCorrBtToSubmit(null);
            }}
            onAddDemandeIntervention={onAddDemandeIntervention}
            onStartLiveIntervention={onStartLiveIntervention}
            onSubmitInterventionForValidation={onSubmitInterventionForValidation}
            onOpenMachineQrModal={onOpenMachineQrModal}
            showToast={showToast}
          />
        )}

        {/* TAB 4: PLUS / COMPTE (Identity + ShellModeSwitcher + Force Desktop + Logout) */}
        {activeTab === 'more' && (
          <div data-testid="mobile-tab-more" className="space-y-4">
            {/* Technician Identity Card */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between gap-3">
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

              {/* Maker-Checker Status Summary for Technician */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-center">
                <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-200">
                  <div className="text-base font-black font-mono text-purple-900">
                    {(techScope.pendingValidationPreventive?.length || 0) +
                      (techScope.pendingValidationCorrective?.length || 0)}
                  </div>
                  <div className="text-[10px] font-bold text-purple-700">
                    En attente validation Admin
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200">
                  <div className="text-base font-black font-mono text-rose-900">
                    {totalClarifyCount}
                  </div>
                  <div className="text-[10px] font-bold text-rose-700">
                    Rapports à clarifier
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
              data-testid="tech-mobile-logout-btn"
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
          className={`py-2 rounded-xl flex flex-col items-center justify-center gap-0.5 relative transition cursor-pointer ${
            activeTab === 'today' ? 'text-emerald-700 bg-emerald-50 font-black' : 'text-slate-500'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[10px]">Aujourd'hui</span>
          {totalClarifyCount > 0 && (
            <span className="absolute top-1 right-4 px-1.5 py-0.2 rounded-full bg-rose-600 text-white font-mono text-[9px] font-black">
              !
            </span>
          )}
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

      {/* QR Scanner Modal */}
      <QRScannerModal
        isOpen={isQrScannerOpen}
        onClose={() => setIsQrScannerOpen(false)}
        onScan={handleQrScanResult}
      />
    </div>
  );
}
