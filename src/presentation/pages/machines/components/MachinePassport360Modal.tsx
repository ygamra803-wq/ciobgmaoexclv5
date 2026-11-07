import { useState, useMemo } from 'react';
import {
  X,
  Gauge,
  Wrench,
  Calendar,
  Layers,
  AlertTriangle,
  Printer,
  ShieldCheck,
  Info,
} from 'lucide-react';
import { useGmaoStore } from '../../../../store/useGmaoStore';
import { getMachineAssetClass } from '../../../../utils/activeMachines';
import { computeMachineHealthPassport } from '../../../../application/services/MachineHealthPassportService';
import { IMeterReading } from '../../../../types/meter';

interface MachinePassport360ModalProps {
  machine: any | null;
  onClose: () => void;
  onNavigateToPreventive?: (machineCode: string) => void;
  onNavigateToQuickSortie?: (machine: any) => void;
  onOpenQrSticker?: (machine: any) => void;
}

export default function MachinePassport360Modal({
  machine,
  onClose,
  onNavigateToPreventive,
  onNavigateToQuickSortie,
  onOpenQrSticker,
}: MachinePassport360ModalProps) {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'COMPTEURS' | 'BOM' | 'CORRECTIF' | 'PREVENTIF'>('OVERVIEW');

  const preventiveTasks = useGmaoStore((s) => s.preventiveTasks) || [];
  const preventiveExecutions = useGmaoStore((s) => s.preventiveExecutions) || [];
  const correctiveInterventions = useGmaoStore((s) => s.correctiveInterventions) || [];
  const sortiesExterne = useGmaoStore((s) => s.sortiesExterne) || [];
  const rawStock = useGmaoStore((s) => s.rawStock) || [];
  const machineElementsLedger = useGmaoStore((s) => s.machineElementsLedger) || [];
  const blueprints = useGmaoStore((s) => s.blueprints) || [];
  const generalSystemTypes = useGmaoStore((s) => s.generalSystemTypes) || [];
  const meterReadings: IMeterReading[] = useGmaoStore((s) => s.meterReadings) || [];

  const machineCode = String(
    machine?.id_machine_registered || machine?.id || machine?.code || ''
  ).trim();
  const machineCodeUpper = machineCode.toUpperCase();

  // Health & TCO Passport (12 Months)
  const healthPassport = useMemo(() => {
    if (!machine) {
      return {
        machineCode: '',
        designation: '',
        healthScore: 100,
        healthStatus: 'OPTIMAL' as const,
        correctiveCount12m: 0,
        preventiveCount12m: 0,
        externalCount12m: 0,
        correctivePdrCost12m: 0,
        preventiveTotalCost12m: 0,
        externalTotalCost12m: 0,
        totalMaintenanceCost12m: 0,
        totalDowntimeMinutes12m: 0,
        totalDowntimeHours12m: 0,
        recurrentOrganAlerts: [],
      };
    }
    return computeMachineHealthPassport({
      machine,
      correctiveInterventions,
      preventiveExecutions,
      sortiesExterne,
      stockItems: rawStock,
    });
  }, [machine, correctiveInterventions, preventiveExecutions, sortiesExterne, rawStock]);

  // Machine Meter History (supports both canonical machineId and legacy id_machine)
  const machineMeters = useMemo(() => {
    if (!machineCodeUpper) return [];
    return meterReadings
      .filter(
        (r) =>
          String(r.machineId || (r as any).id_machine || '')
            .trim()
            .toUpperCase() === machineCodeUpper
      )
      .sort(
        (a, b) =>
          new Date(b.createdAt || b.date_releve || 0).getTime() -
          new Date(a.createdAt || a.date_releve || 0).getTime()
      );
  }, [meterReadings, machineCodeUpper]);

  // Machine Corrective History
  const machineCorrective = useMemo(() => {
    if (!machineCodeUpper) return [];
    return (correctiveInterventions || [])
      .filter(
        (ci: any) =>
          String(ci.code_machine || ci.id_machine_registered || '')
            .trim()
            .toUpperCase() === machineCodeUpper
      )
      .sort((a: any, b: any) => {
        const dateA = new Date(a.date_cloture || a.date_demande || 0).getTime();
        const dateB = new Date(b.date_cloture || b.date_demande || 0).getTime();
        return dateB - dateA;
      });
  }, [correctiveInterventions, machineCodeUpper]);

  // Machine Preventive Tasks
  const machineTasks = useMemo(() => {
    if (!machineCodeUpper) return [];
    return (preventiveTasks || []).filter(
      (t: any) =>
        String(t.id_machine || t.code_machine || '')
          .trim()
          .toUpperCase() === machineCodeUpper
    );
  }, [preventiveTasks, machineCodeUpper]);

  // Machine Preventive Executions
  const machineExecutions = useMemo(() => {
    if (!machineCodeUpper) return [];
    return (preventiveExecutions || [])
      .filter(
        (ex: any) =>
          String(ex.machineCode || ex.id_machine || '')
            .trim()
            .toUpperCase() === machineCodeUpper
      )
      .sort(
        (a: any, b: any) =>
          new Date(b.executedAt || 0).getTime() - new Date(a.executedAt || 0).getTime()
      );
  }, [preventiveExecutions, machineCodeUpper]);

  // Machine Components & Elements Ledger
  const machineElements = useMemo(() => {
    if (!machineCodeUpper) return [];
    return (machineElementsLedger || []).filter(
      (el: any) =>
        String(el.id_machine_registered || el.id_machine || '')
          .trim()
          .toUpperCase() === machineCodeUpper
    );
  }, [machineElementsLedger, machineCodeUpper]);

  // Associated Blueprint
  const blueprint = useMemo(() => {
    if (!machine) return undefined;
    return (blueprints || []).find(
      (bp: any) =>
        bp.id_blueprint === machine.id_blueprint ||
        (machine.id_templates && bp.id_templates === machine.id_templates)
    );
  }, [blueprints, machine]);

  if (!machine) return null;

  const assetClass = getMachineAssetClass(machine);
  const sysTypeObj = generalSystemTypes.find(
    (t: any) => t.id === machine.id_general_system_type
  );

  // Current counter value & unit
  const currentMeterVal =
    machine.dernier_releve_compteur ??
    machine.compteur_heures ??
    machineMeters[0]?.valeur ??
    0;
  const meterUnit =
    machine.compteur_unite_defaut ||
    machine.unite_compteur ||
    machineMeters[0]?.unite ||
    'Heures';
  const lastMeterDate =
    machine.date_releve_compteur ||
    machine.date_dernier_releve ||
    machineMeters[0]?.date_releve ||
    'Non enregistrée';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[94vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-indigo-500/20 border border-indigo-400/40 text-indigo-300 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-800">
                  Dossier Technique 360°
                </span>
                <span className="font-mono text-base font-black text-white">
                  {machineCode}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  machine.status === 'ARCHIVEE' || machine.statut === 'Archivée'
                    ? 'bg-slate-700 text-slate-300'
                    : machine.status === 'ARRET' || machine.statut === 'En Panne'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                }`}>
                  {machine.status || machine.statut || 'EN_SERVICE'}
                </span>
              </div>
              <h2 className="text-sm sm:text-base font-bold text-slate-200 truncate mt-0.5">
                {machine.designation || 'Machine sans désignation'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onOpenQrSticker && (
              <button
                type="button"
                onClick={() => onOpenQrSticker(machine)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border border-slate-700"
                title="Imprimer Étiquette QR"
              >
                <Printer className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Étiquette QR</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
              title="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Vital KPI Strip */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs shrink-0">
          <div className="bg-white p-2.5 rounded-2xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Santé & Fiabilité 12M
            </span>
            <div className="flex items-center justify-between mt-0.5">
              <span className="text-base font-black font-mono text-slate-800">
                {healthPassport.healthScore}/100
              </span>
              <span className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold ${
                healthPassport.healthStatus === 'CRITIQUE_BER'
                  ? 'bg-rose-100 text-rose-800'
                  : healthPassport.healthStatus === 'SURVEILLANCE'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-emerald-100 text-emerald-800'
              }`}>
                {healthPassport.healthStatus}
              </span>
            </div>
          </div>

          <div className="bg-white p-2.5 rounded-2xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Coût Total TCO 12M
            </span>
            <div className="text-base font-black font-mono text-indigo-700 mt-0.5">
              {healthPassport.totalMaintenanceCost12m.toLocaleString('fr-FR')} <span className="text-xs font-sans font-normal text-slate-500">DH</span>
            </div>
          </div>

          <div className="bg-white p-2.5 rounded-2xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Heures d'Arrêt (Downtime)
            </span>
            <div className="text-base font-black font-mono text-amber-700 mt-0.5">
              {healthPassport.totalDowntimeHours12m} <span className="text-xs font-sans font-normal text-slate-500">heures</span>
            </div>
          </div>

          <div className="bg-white p-2.5 rounded-2xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Compteur d'Heures
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Gauge className="w-4 h-4 text-cyan-600 shrink-0" />
              <span className="text-base font-black font-mono text-cyan-800">
                {Number(currentMeterVal).toLocaleString('fr-FR')} <span className="text-[10px] font-sans font-normal text-slate-500">{meterUnit}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 border-b border-slate-200 bg-white flex gap-2 overflow-x-auto shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('OVERVIEW')}
            className={`py-3 px-3.5 text-xs font-bold border-b-2 flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'OVERVIEW'
                ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Info className="w-4 h-4" />
            <span>Vue Générale & Spécifications</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('COMPTEURS')}
            className={`py-3 px-3.5 text-xs font-bold border-b-2 flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'COMPTEURS'
                ? 'border-cyan-600 text-cyan-700 bg-cyan-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Gauge className="w-4 h-4" />
            <span>Compteurs & Horomètres ({machineMeters.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('BOM')}
            className={`py-3 px-3.5 text-xs font-bold border-b-2 flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'BOM'
                ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Organes & BOM ({machineElements.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('CORRECTIF')}
            className={`py-3 px-3.5 text-xs font-bold border-b-2 flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'CORRECTIF'
                ? 'border-rose-600 text-rose-700 bg-rose-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Wrench className="w-4 h-4" />
            <span>Historique Pannes ({machineCorrective.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('PREVENTIF')}
            className={`py-3 px-3.5 text-xs font-bold border-b-2 flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'PREVENTIF'
                ? 'border-blue-600 text-blue-700 bg-blue-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Préventif & Exécutions ({machineExecutions.length})</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-slate-700 text-xs">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'OVERVIEW' && (
            <div className="space-y-6">
              {/* Technical Identity Card */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  Caractéristiques Techniques & Emplacement
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block">Zone / Emplacement</span>
                    <span className="font-semibold text-slate-800">{machine.zone || machine.nom_zone || 'Atelier Principal'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block">Atelier / Ligne</span>
                    <span className="font-semibold text-slate-800">{machine.atelier || machine.ligne || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block">Famille</span>
                    <span className="font-semibold text-slate-800">{machine.famille || machine.nom_famille || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block">N° Série Fabricant</span>
                    <span className="font-mono font-semibold text-slate-800">{machine.numero_serie || machine.serial_number || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block">Modèle / Marque</span>
                    <span className="font-semibold text-slate-800">{machine.modele || machine.constructeur || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block">Date Mise en Service</span>
                    <span className="font-mono font-semibold text-slate-800">{machine.date_mise_en_service || machine.annee || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block">Classe d'Actif</span>
                    <span className="font-semibold text-slate-800">{assetClass === 'SYSTEM_GENERAL' ? 'Système Général (Usine)' : 'Machine Process'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block">Type Système</span>
                    <span className="font-semibold text-slate-800">{sysTypeObj?.nom || 'Standard'}</span>
                  </div>
                </div>
              </div>

              {/* BER Recurrent Organ Failure Alert Banner if any */}
              {healthPassport.recurrentOrganAlerts.length > 0 && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 space-y-2">
                  <div className="flex items-center gap-2 text-rose-800 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Alerte Récurrence d'Organes (Beyond Economical Repair - BER)</span>
                  </div>
                  <div className="space-y-1.5">
                    {healthPassport.recurrentOrganAlerts.map((al) => (
                      <div key={al.organKey} className="text-xs bg-white/80 p-2.5 rounded-xl border border-rose-200 flex items-start justify-between gap-3">
                        <div>
                          <span className="font-bold text-rose-950 block">{al.organLabel}</span>
                          <span className="text-[11px] text-slate-600">{al.recommendation}</span>
                        </div>
                        <span className="font-mono font-black text-rose-700 bg-rose-100 px-2 py-0.5 rounded text-[11px] shrink-0">
                          {al.count12m} pannes (12m)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Actions Footer */}
              <div className="flex items-center gap-3 pt-2">
                {onNavigateToQuickSortie && (
                  <button
                    type="button"
                    onClick={() => {
                      onNavigateToQuickSortie(machine);
                      onClose();
                    }}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-sm"
                  >
                    <Wrench className="w-4 h-4" />
                    <span>Sortie Rapide PDR pour cette Machine</span>
                  </button>
                )}
                {onNavigateToPreventive && (
                  <button
                    type="button"
                    onClick={() => {
                      onNavigateToPreventive(machineCode);
                      onClose();
                    }}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs flex items-center gap-2 transition cursor-pointer"
                  >
                    <Calendar className="w-4 h-4" />
                    <span>Voir Plan Préventif Dédié</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: COMPTEURS & HOROMETRES */}
          {activeTab === 'COMPTEURS' && (
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-cyan-50/70 border border-cyan-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-black tracking-wider text-cyan-800 block">
                    Horomètre de Bord Actuel
                  </span>
                  <div className="text-2xl font-black font-mono text-cyan-950 mt-0.5">
                    {Number(currentMeterVal).toLocaleString('fr-FR')} {meterUnit}
                  </div>
                  <span className="text-[11px] text-cyan-700 mt-1 block">
                    Dernière saisie : {lastMeterDate}
                  </span>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-cyan-600 text-white flex items-center justify-center">
                  <Gauge className="w-6 h-6" />
                </div>
              </div>

              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3">
                  Historique Chronologique des Relevés de Compteur ({machineMeters.length})
                </h4>
                {machineMeters.length === 0 ? (
                  <div className="p-6 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400">
                    Aucun relevé d'horomètre enregistré pour cet équipement.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-2xs">
                    {machineMeters.map((m) => (
                      <div key={m.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-cyan-100 text-cyan-800 flex items-center justify-center font-bold text-xs">
                            <Gauge className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-mono font-bold text-slate-800 text-sm">
                              {Number(m.valeur).toLocaleString('fr-FR')} {m.unite}
                            </span>
                            <div className="text-[10.5px] text-slate-500">
                              {m.date_releve} • Relevé par <span className="font-semibold text-slate-700">{m.releve_par}</span>
                            </div>
                          </div>
                        </div>
                        {m.delta !== undefined && m.delta > 0 && (
                          <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            +{m.delta} {m.unite}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: BOM & ORGANES */}
          {activeTab === 'BOM' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
                  Organes & Composants Enregistrés ({machineElements.length})
                </h4>
                {blueprint && (
                  <span className="text-[11px] font-mono text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200">
                    Blueprint : {blueprint.nom_blueprint || blueprint.code_blueprint}
                  </span>
                )}
              </div>

              {machineElements.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400">
                  Aucun organe spécifique rattaché à cette machine dans le registre BOM.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {machineElements.map((el: any) => (
                    <div key={el.id || el.id_element} className="p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-indigo-300 transition shadow-2xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 text-xs">{el.nom_element || el.designation}</span>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {el.nature || 'COMPOSANT'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Réf / Code : <span className="font-mono font-semibold text-slate-800">{el.ref || el.code_element || '—'}</span>
                      </div>
                      {el.observations && (
                        <div className="text-[10.5px] text-slate-600 bg-slate-50 p-2 rounded-xl">
                          {el.observations}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: HISTORIQUE PANNES & CORRECTIF */}
          {activeTab === 'CORRECTIF' && (
            <div className="space-y-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
                Interventions et Bons de Travail Correctifs ({machineCorrective.length})
              </h4>

              {machineCorrective.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400">
                  Aucun historique de panne ou d'intervention corrective pour cette machine.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-2xs">
                  {machineCorrective.map((ci: any) => (
                    <div key={ci.id} className="p-3.5 hover:bg-slate-50 transition space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-indigo-700">
                            {ci.num_bt || ci.id}
                          </span>
                          <span className="font-bold text-slate-900">{ci.panne || ci.anomalie || 'Dépannage'}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          ci.statut === 'CLOTURE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : ci.statut === 'EN_COURS'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {ci.statut || 'EN_COURS'}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-[11px] text-slate-500 flex-wrap">
                        <span>Date : <span className="font-semibold text-slate-700">{ci.date_cloture || ci.date_demande || '—'}</span></span>
                        <span>Technicien : <span className="font-semibold text-slate-700">{ci.technicien || ci.intervenant || '—'}</span></span>
                        {ci.duree_arret_heures && (
                          <span className="text-amber-700 font-semibold">Arrêt : {ci.duree_arret_heures}h</span>
                        )}
                        {ci.cout_total && (
                          <span className="text-emerald-700 font-bold font-mono">Coût : {ci.cout_total} DH</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: HISTORIQUE PREVENTIF */}
          {activeTab === 'PREVENTIF' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
                  Journal des Exécutions Préventives ({machineExecutions.length})
                </h4>
                <span className="text-xs text-slate-500">
                  {machineTasks.length} tâche(s) planifiée(s)
                </span>
              </div>

              {machineExecutions.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400">
                  Aucune exécution préventive enregistrée pour cette machine.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-2xs">
                  {machineExecutions.map((ex: any) => (
                    <div key={ex.id} className="p-3.5 hover:bg-slate-50 transition space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 text-xs">
                          {ex.taskTitle || ex.taskCode || ex.action_code || 'Visite Préventive'}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {ex.periodMonth || ex.executedAt?.slice(0, 10)}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-3">
                        <span>Réalisé par : <span className="font-semibold text-slate-700">{ex.technicianName || ex.technicien || '—'}</span></span>
                        {ex.duree_reelle && <span>Durée : {ex.duree_reelle}</span>}
                        {ex.anomalie_detectee && (
                          <span className="text-rose-600 font-bold flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" /> Anomalie constatée
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-400 font-mono">
            {machineCode} • Système GMAO Industrie v4
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs transition cursor-pointer"
          >
            Fermer le Dossier
          </button>
        </div>

      </div>
    </div>
  );
}
