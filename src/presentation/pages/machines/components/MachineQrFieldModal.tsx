import { useState, useEffect, useMemo } from 'react';
import {
  QrCode,
  Printer,
  Smartphone,
  Wrench,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  X,
  Copy,
  Check,
  MapPin,
  Factory,
  Clock,
  Layers,
  Package,
  ExternalLink,
  Hash,
} from 'lucide-react';
import { networkConfigService } from '../../../../services/networkConfigService';
import { useGmaoStore } from '../../../../store/useGmaoStore';
import { useAuth } from '../../../../context/AuthContext';
import { isTechnicianRole, getTechnicianDisplayName } from '../../../../core/security/technicianScope';
import { getMachineAssetClass } from '../../../../utils/activeMachines';

interface MachineQrFieldModalProps {
  machine: any | null;
  initialMode?: 'ETIQUETTE' | 'FICHE_TERRAIN';
  onClose: () => void;
  onNavigateToPreventive?: (machineCode: string) => void;
  onNavigateToQuickSortie?: (machine: any) => void;
  showToast?: (msg: string, type?: string) => void;
}

export default function MachineQrFieldModal({
  machine,
  initialMode = 'ETIQUETTE',
  onClose,
  onNavigateToPreventive,
  onNavigateToQuickSortie,
  showToast,
}: MachineQrFieldModalProps) {
  const { user } = useAuth();
  const isTechUser = isTechnicianRole(user);

  const technicians = useGmaoStore((s) => s.technicians) || [];
  const preventiveTasks = useGmaoStore((s) => s.preventiveTasks) || [];
  const correctiveInterventions = useGmaoStore((s) => s.correctiveInterventions) || [];
  const warehouseItems = useGmaoStore((s) => s.warehouseItems) || [];
  const machineElementsLedger = useGmaoStore((s) => s.machineElementsLedger) || [];
  const blueprints = useGmaoStore((s) => s.blueprints) || [];
  const generalSystemTypes = useGmaoStore((s) => s.generalSystemTypes) || [];
  const handleAddDemandeIntervention = useGmaoStore((s) => s.handleAddDemandeIntervention);
  const handleMarkTaskDone = useGmaoStore((s) => s.handleMarkTaskDone);

  const [mode, setMode] = useState<'ETIQUETTE' | 'FICHE_TERRAIN'>(initialMode);
  const [activeFieldTab, setActiveFieldTab] = useState<'SIGNALER_DI' | 'PREVENTIF_DU' | 'HISTORIQUE_BOM'>(
    'SIGNALER_DI'
  );
  const [hostBaseUrl, setHostBaseUrl] = useState<string>(() => {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return window.location.origin;
    }
    return 'http://192.168.1.100:3000';
  });
  const [copiedUrl, setCopiedUrl] = useState(false);

  // DI quick form state
  const defaultRequester = useMemo(
    () => getTechnicianDisplayName(user, technicians) || user?.name || user?.nom || 'Opérateur Terrain',
    [user, technicians]
  );
  const [diAnomalie, setDiAnomalie] = useState('');
  const [diTravail, setDiTravail] = useState('');
  const [diPriorite, setDiPriorite] = useState<'URGENTE' | 'HAUTE' | 'NORMALE'>('HAUTE');
  const [diArretMachine, setDiArretMachine] = useState<'OUI' | 'NON'>('NON');
  const [diDemandeur, setDiDemandeur] = useState(defaultRequester);
  const [diSuccessMsg, setDiSuccessMsg] = useState('');

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode, machine?.id_machine_registered]);

  useEffect(() => {
    let mounted = true;
    networkConfigService
      .fetchNetworkHostInfo()
      .then((info) => {
        if (mounted && info?.urls?.desktop) {
          setHostBaseUrl(info.urls.desktop);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  if (!machine) return null;

  const machineCode = String(
    machine.id_machine_registered || machine.id || machine.code || ''
  ).trim();
  const assetClass = getMachineAssetClass(machine);
  const sysTypeObj = generalSystemTypes.find(
    (t: any) => t.id === machine.id_general_system_type
  );

  const qrUrl = `${hostBaseUrl.replace(/\/+$/, '')}/?machine_qr=${encodeURIComponent(
    machineCode
  )}`;
  const qrMatrix = useMemo(
    () => networkConfigService.generateQrMatrix(qrUrl),
    [qrUrl]
  );

  // Machine Preventive Tasks
  const machineTasks = useMemo(() => {
    const codeUpper = machineCode.toUpperCase();
    return (preventiveTasks || []).filter(
      (t: any) => String(t.id_machine || t.code_machine || '').trim().toUpperCase() === codeUpper
    );
  }, [preventiveTasks, machineCode]);

  const dueTasks = useMemo(
    () =>
      machineTasks.filter(
        (t: any) => t.etat !== 'Fait' && t.validation_status !== 'PENDING_VALIDATION'
      ),
    [machineTasks]
  );

  // Last 5 Corrective Interventions on this machine
  const recentCorrective = useMemo(() => {
    const codeUpper = machineCode.toUpperCase();
    return (correctiveInterventions || [])
      .filter((ci: any) => String(ci.code_machine || '').trim().toUpperCase() === codeUpper)
      .slice(0, 5);
  }, [correctiveInterventions, machineCode]);

  // Machine BOM & Attached Components/Parts
  const machineComponentsAndBom = useMemo(() => {
    const codeUpper = machineCode.toUpperCase();
    const whAttached = (warehouseItems || []).filter(
      (w: any) =>
        String(w.id_machine_registered || w.id_machine || '').trim().toUpperCase() === codeUpper
    );
    const ledgerAttached = (machineElementsLedger || []).filter(
      (el: any) => String(el.id_machine || '').trim().toUpperCase() === codeUpper
    );
    const bpMatch = (blueprints || []).find(
      (bp: any) =>
        bp.id_blueprint === machine.id_blueprint ||
        (machine.id_templates && bp.id_templates === machine.id_templates)
    );
    return {
      whAttached,
      ledgerAttached,
      blueprint: bpMatch || null,
    };
  }, [warehouseItems, machineElementsLedger, blueprints, machine, machineCode]);

  const handleCopyUrl = () => {
    navigator.clipboard?.writeText(qrUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleSubmitQuickDi = (e: React.FormEvent) => {
    e.preventDefault();
    if (!diAnomalie.trim()) return;

    if (typeof handleAddDemandeIntervention === 'function') {
      handleAddDemandeIntervention({
        code_machine: machineCode,
        nom_machine: machine.designation || machineCode,
        zone: machine.id_zone_default || machine.id_zone || 'Atelier',
        anomalie: diAnomalie.trim(),
        travail_a_faire:
          diTravail.trim() ||
          `Diagnostic et remise en état sur ${machineCode} (${diAnomalie.trim()})`,
        priorite: diPriorite,
        arret_machine: diArretMachine,
        demandeur: diDemandeur || defaultRequester,
        source: 'QR_TERRAIN_MOBILE',
      });
    }

    setDiSuccessMsg(`Demande d'Intervention enregistrée pour ${machineCode} !`);
    setDiAnomalie('');
    setDiTravail('');
    showToast?.(`DI créée via Fiche QR Terrain (${machineCode})`, 'success');
    setTimeout(() => setDiSuccessMsg(''), 4000);
  };

  const handleQuickCompleteTask = (task: any) => {
    if (typeof handleMarkTaskDone !== 'function') return;
    const shouldSubmitForValidation = isTechUser;

    handleMarkTaskDone(task.id, {
      date_realisation: new Date().toISOString().split('T')[0],
      technicien: defaultRequester,
      duree_reelle: task.duree_estimee || '15 min',
      taux_horaire: 35,
      observations: `[SCAN QR TERRAIN] Contrôle préventif ${task.action_code || 'C'} (${
        task.composant || 'Équipement'
      }) exécuté et conforme sur ${machineCode}.`,
      usedPDR: [],
      submitForValidation: shouldSubmitForValidation,
      validation_status: shouldSubmitForValidation ? 'PENDING_VALIDATION' : 'APPROVED',
      submitted_by_id: user?.personnelId || user?.id || '',
      submitted_by_name: defaultRequester,
      validated_by_id: shouldSubmitForValidation ? undefined : user?.id || 'admin',
      validated_by_name: shouldSubmitForValidation ? undefined : defaultRequester,
    });

    showToast?.(
      shouldSubmitForValidation
        ? `Tâche ${task.composant} soumise pour validation responsable (Maker-Checker).`
        : `Tâche ${task.composant} validée avec succès !`,
      'success'
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/65 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Top Modal Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 flex items-center justify-center shrink-0">
              <QrCode className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-black tracking-tight truncate">
                  Passeport QR Offline & Fiche Terrain
                </h3>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-200 border border-cyan-400/30">
                  {machineCode}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 truncate">{machine.designation}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Mode Switcher */}
            <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700 text-xs">
              <button
                type="button"
                onClick={() => setMode('ETIQUETTE')}
                className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  mode === 'ETIQUETTE'
                    ? 'bg-cyan-500 text-slate-950 shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Étiquette QR</span>
              </button>
              <button
                type="button"
                onClick={() => setMode('FICHE_TERRAIN')}
                className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  mode === 'FICHE_TERRAIN'
                    ? 'bg-emerald-500 text-slate-950 shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Fiche Mobile</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
              title="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ===================================================================== */}
        {/* MODE 1: ÉTIQUETTE QR INDUSTRIELLE (IMPRESSION OFFLINE LAN) */}
        {/* ===================================================================== */}
        {mode === 'ETIQUETTE' ? (
          <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-xs">
            {/* Printable Sticker Container */}
            <div className="mx-auto max-w-md bg-white rounded-3xl border-2 border-slate-900 p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between pb-3 border-b-2 border-slate-900">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 block">
                    CIOB GMAO v4 • IDENTIFICATION ACTIF
                  </span>
                  <span className="text-xl font-black font-mono text-slate-950 tracking-tight">
                    {machineCode}
                  </span>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase border ${
                    assetClass === 'SYSTEM_GENERAL'
                      ? 'bg-amber-50 text-amber-900 border-amber-300'
                      : 'bg-emerald-50 text-emerald-900 border-emerald-300'
                  }`}
                >
                  {assetClass === 'SYSTEM_GENERAL'
                    ? sysTypeObj
                      ? `SYS • ${sysTypeObj.code || sysTypeObj.name}`
                      : 'Système Général'
                    : 'Production'}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-4">
                {/* Offline Deterministic SVG QR Code */}
                <div className="p-2.5 bg-white rounded-2xl border-2 border-slate-900 shrink-0 shadow-xs">
                  <svg
                    viewBox={`0 0 ${qrMatrix.length} ${qrMatrix.length}`}
                    className="w-32 h-32"
                    shapeRendering="crispEdges"
                    aria-label={`QR Code ${machineCode}`}
                  >
                    <rect width={qrMatrix.length} height={qrMatrix.length} fill="#ffffff" />
                    {qrMatrix.map((row, rIdx) =>
                      row.map((cell, cIdx) =>
                        cell ? (
                          <rect
                            key={`${rIdx}-${cIdx}`}
                            x={cIdx}
                            y={rIdx}
                            width={1}
                            height={1}
                            fill="#0f172a"
                          />
                        ) : null
                      )
                    )}
                  </svg>
                </div>

                {/* Metadata */}
                <div className="flex-1 space-y-2 text-center sm:text-left min-w-0">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">
                      Désignation Équipement
                    </span>
                    <span className="text-sm font-black text-slate-900 block leading-snug">
                      {machine.designation}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-[9.5px] font-bold text-slate-400 uppercase block">
                        Zone / Secteur
                      </span>
                      <span className="font-mono font-bold text-slate-800 text-xs flex items-center justify-center sm:justify-start gap-1">
                        <MapPin className="w-3 h-3 text-purple-600 shrink-0" />
                        {machine.id_zone_default || machine.id_zone || 'Atelier'}
                      </span>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-[9.5px] font-bold text-slate-400 uppercase block">
                        Statut
                      </span>
                      <span className="font-bold text-emerald-800 text-xs">
                        {machine.status || 'En Service'}
                      </span>
                    </div>
                  </div>

                  <div className="text-[10px] text-slate-500 font-medium pt-1">
                    Scannez sur le Wi-Fi usine pour déclarer une DI, valider le préventif ou voir le BOM.
                  </div>
                </div>
              </div>

              <div className="pt-2.5 border-t border-slate-200 flex items-center justify-between gap-2 text-[10px] font-mono text-slate-500">
                <span className="truncate">{qrUrl}</span>
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-sans font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  {copiedUrl ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedUrl ? 'Copié' : 'Copier'}</span>
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setMode('FICHE_TERRAIN')}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-2 shadow-xs transition cursor-pointer"
              >
                <Smartphone className="w-4 h-4" />
                <span>Simuler le Scan Terrain (Ouvrir Fiche Mobile)</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white font-black text-xs flex items-center gap-2 shadow-xs transition cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimer l&apos;Étiquette QR</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* ===================================================================== */
          /* MODE 2: FICHE TERRAIN MOBILE (3 ACTIONS RAPIDES) */
          /* ===================================================================== */
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden text-xs">
            {/* 3 Quick Action Tabs */}
            <div className="grid grid-cols-3 gap-1.5 p-3 bg-slate-100 border-b border-slate-200 shrink-0">
              <button
                type="button"
                onClick={() => setActiveFieldTab('SIGNALER_DI')}
                className={`py-2.5 px-2 rounded-xl font-black text-xs flex flex-col sm:flex-row items-center justify-center gap-1.5 transition cursor-pointer ${
                  activeFieldTab === 'SIGNALER_DI'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-rose-50 border border-slate-200/80'
                }`}
              >
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>1. Signaler Panne (DI)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveFieldTab('PREVENTIF_DU')}
                className={`py-2.5 px-2 rounded-xl font-black text-xs flex flex-col sm:flex-row items-center justify-center gap-1.5 transition cursor-pointer ${
                  activeFieldTab === 'PREVENTIF_DU'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-indigo-50 border border-slate-200/80'
                }`}
              >
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>2. Préventif ({dueTasks.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveFieldTab('HISTORIQUE_BOM')}
                className={`py-2.5 px-2 rounded-xl font-black text-xs flex flex-col sm:flex-row items-center justify-center gap-1.5 transition cursor-pointer ${
                  activeFieldTab === 'HISTORIQUE_BOM'
                    ? 'bg-teal-700 text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-teal-50 border border-slate-200/80'
                }`}
              >
                <Layers className="w-4 h-4 shrink-0" />
                <span>3. Pannes & BOM</span>
              </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {/* TAB 1: SIGNALER UNE PANNE (NOUVELLE DI) */}
              {activeFieldTab === 'SIGNALER_DI' && (
                <form onSubmit={handleSubmitQuickDi} className="space-y-3.5">
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Factory className="w-4 h-4 text-slate-600" />
                      <span className="font-bold text-slate-900">
                        Équipement pré-rempli : <b className="font-mono text-rose-700">{machineCode}</b>
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200 font-mono text-[10.5px] font-bold">
                      Zone: {machine.id_zone_default || machine.id_zone || 'Atelier'}
                    </span>
                  </div>

                  {diSuccessMsg && (
                    <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 font-bold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{diSuccessMsg}</span>
                    </div>
                  )}

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 uppercase block mb-1">
                      Anomalie / Symptôme constaté *
                    </label>
                    <input
                      type="text"
                      required
                      value={diAnomalie}
                      onChange={(e) => setDiAnomalie(e.target.value)}
                      placeholder="Ex: Bruit anormal roulement, fuite hydraulique, arrêt capteur..."
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:border-rose-500 outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 uppercase block mb-1">
                        Urgence / Priorité
                      </label>
                      <select
                        value={diPriorite}
                        onChange={(e) => setDiPriorite(e.target.value as any)}
                        className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-bold"
                      >
                        <option value="URGENTE">🔴 URGENTE</option>
                        <option value="HAUTE">🟠 HAUTE</option>
                        <option value="NORMALE">🔵 NORMALE</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-700 uppercase block mb-1">
                        Machine à l&apos;arrêt ?
                      </label>
                      <select
                        value={diArretMachine}
                        onChange={(e) => setDiArretMachine(e.target.value as any)}
                        className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-bold"
                      >
                        <option value="NON">NON (En marche dégradée)</option>
                        <option value="OUI">OUI (Arrêt de production)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 uppercase block mb-1">
                      Observations / Travail demandé
                    </label>
                    <textarea
                      rows={2}
                      value={diTravail}
                      onChange={(e) => setDiTravail(e.target.value)}
                      placeholder="Précisions pour l'équipe de maintenance..."
                      className="w-full p-3 rounded-xl border border-slate-200 bg-white text-xs focus:border-rose-500 outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-2">
                    {onNavigateToQuickSortie && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onNavigateToQuickSortie(machine);
                        }}
                        className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <Wrench className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Sortie PDR Directe</span>
                      </button>
                    )}

                    <button
                      type="submit"
                      className="ml-auto px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs shadow-md flex items-center gap-2 cursor-pointer"
                    >
                      <AlertTriangle className="w-4 h-4" />
                      <span>Envoyer la Demande d&apos;Intervention (DI)</span>
                    </button>
                  </div>
                </form>
              )}

              {/* TAB 2: EXÉCUTER LES TÂCHES PRÉVENTIVES DUES */}
              {activeFieldTab === 'PREVENTIF_DU' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 uppercase text-[11px] tracking-wider">
                      Opérations Préventives sur {machineCode} ({machineTasks.length})
                    </span>
                    {onNavigateToPreventive && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onNavigateToPreventive(machineCode);
                        }}
                        className="text-xs font-bold text-indigo-700 hover:text-indigo-900 flex items-center gap-1 cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Ouvrir Planning Complet</span>
                      </button>
                    )}
                  </div>

                  {machineTasks.length === 0 ? (
                    <div className="p-6 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-500">
                      Aucune gamme préventive planifiée sur {machineCode}.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {machineTasks.map((t: any) => {
                        const isDone = t.etat === 'Fait';
                        const isPending = t.validation_status === 'PENDING_VALIDATION';
                        return (
                          <div
                            key={t.id}
                            className="p-3 rounded-2xl border border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-2xs"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded font-mono font-bold bg-indigo-50 text-indigo-800 border border-indigo-200 text-[10.5px]">
                                  {t.action_code || 'C'}
                                </span>
                                <span className="font-bold text-slate-900">{t.composant}</span>
                                <span className="text-[10px] font-mono text-slate-500">
                                  ({t.frequence || 'Mensuel'})
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                {t.consigne || t.type_intervention || 'Contrôle préventif standard'}
                              </p>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                              {isPending ? (
                                <span className="px-2.5 py-1 rounded-xl bg-purple-50 text-purple-800 border border-purple-200 font-bold text-[10.5px]">
                                  En attente validation
                                </span>
                              ) : isDone ? (
                                <span className="px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-[10.5px] flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Fait</span>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleQuickCompleteTask(t)}
                                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Valider Conforme</span>
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

              {/* TAB 3: DERNIÈRES PANNES & ORGANES / BOM */}
              {activeFieldTab === 'HISTORIQUE_BOM' && (
                <div className="space-y-4">
                  {/* Last 5 Breakdowns */}
                  <div className="space-y-2">
                    <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-rose-600" />
                      <span>5 Dernières Interventions Correctives ({recentCorrective.length})</span>
                    </h4>
                    {recentCorrective.length === 0 ? (
                      <div className="p-4 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400">
                        Aucun historique de panne enregistré sur {machineCode}.
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {recentCorrective.map((ci: any, idx: number) => (
                          <div
                            key={ci.id || idx}
                            className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-bold text-rose-700">
                                  {ci.num_bt || ci.id}
                                </span>
                                <span className="font-bold text-slate-900 truncate">
                                  {ci.anomalie || ci.travail_a_faire}
                                </span>
                              </div>
                              {ci.action_realisee && (
                                <p className="text-[10.5px] text-slate-500 truncate">
                                  Action: {ci.action_realisee}
                                </p>
                              )}
                            </div>
                            <span className="font-mono text-[10px] text-slate-500 shrink-0">
                              {ci.date_demande || ci.date_fin || '—'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Attached Components & BOM */}
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-teal-600" />
                      <span>
                        Organes Rattachés & Nomenclature BOM (
                        {machineComponentsAndBom.whAttached.length +
                          machineComponentsAndBom.ledgerAttached.length}
                        )
                      </span>
                    </h4>

                    {machineComponentsAndBom.whAttached.length === 0 &&
                    machineComponentsAndBom.ledgerAttached.length === 0 ? (
                      <div className="p-4 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400">
                        {assetClass === 'SYSTEM_GENERAL'
                          ? 'Équipement Système Général autonome (pas de nomenclature organes de production).'
                          : 'Aucun organe ou élément BOM rattaché pour le moment.'}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {machineComponentsAndBom.whAttached.map((w: any) => (
                          <div
                            key={w.id_warehouse_item || w.id}
                            className="p-2.5 rounded-xl bg-teal-50/50 border border-teal-200/80 flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <div className="font-mono font-bold text-teal-900 text-[11px] flex items-center gap-1">
                                <Hash className="w-3 h-3 text-teal-600" />
                                <span>{w.code || w.id_warehouse_item}</span>
                              </div>
                              <div className="font-semibold text-slate-800 truncate">
                                {w.designation}
                              </div>
                            </div>
                            <span className="px-2 py-0.5 rounded bg-white text-teal-800 border border-teal-200 text-[10px] font-bold shrink-0">
                              {w.status || 'En service'}
                            </span>
                          </div>
                        ))}

                        {machineComponentsAndBom.ledgerAttached.map((el: any) => (
                          <div
                            key={el.id_element_instance}
                            className="p-2.5 rounded-xl bg-blue-50/50 border border-blue-200/80 flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <div className="font-mono font-bold text-blue-900 text-[11px]">
                                {el.code_element || el.id_element_instance}
                              </div>
                              <div className="font-semibold text-slate-800 truncate">
                                {el.designation_element}
                              </div>
                            </div>
                            <span className="px-2 py-0.5 rounded bg-white text-blue-800 border border-blue-200 text-[10px] font-mono shrink-0">
                              BOM
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
