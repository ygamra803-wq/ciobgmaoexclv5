import React from 'react';
import {
  FingerprintPattern,
  Info,
  Wrench,
  Calendar,
  AlertTriangle,
  X,
  CheckCircle2,
  Clock,
  Plus,
  Trash2,
} from 'lucide-react';
import { CubeIcon } from '../../../components/common/icons/CubeIcon';
import { LayersIcon } from '../../../components/common/icons/LayersIcon';
import {
  BlueprintPreventivePlanItem,
  BlueprintCommonFailureItem,
  BlueprintPdrItem,
} from '../../../../core/domain';
import { filterActiveMachines } from '../../../../utils/activeMachines';

export interface BlueprintSpecs {
  puissance?: string;
  course?: string;
  moteur?: string;
  dimensions?: string;
  [key: string]: string | undefined;
}

export interface BlueprintComponentItem {
  id_component: string;
  libelle?: string;
  qte?: number;
}

export interface BlueprintPartItem {
  id_part: string;
  libelle?: string;
  qte?: number;
}

export interface BlueprintRecord {
  id_blueprint: string;
  libelle?: string;
  id_family?: string;
  id_templates?: string;
  ref_plan?: string;
  revision?: string;
  statut?: string;
  type_schema?: string;
  description?: string;
  specs?: BlueprintSpecs;
  components_theoriques?: BlueprintComponentItem[];
  parts_theoriques?: BlueprintPartItem[];
  pdr_theoriques?: BlueprintPdrItem[];
  preventivePlanItems?: BlueprintPreventivePlanItem[];
  commonFailures?: BlueprintCommonFailureItem[];
  [key: string]: unknown;
}

export interface BlueprintPreventiveDraft {
  composant: string;
  action_code: string;
  frequence: string;
  duree_min: number;
  description: string;
  pdr_ref: string;
}

export interface BlueprintCommonFailureDraft {
  title: string;
  type_panne: string;
  urgence: string;
  recommended_action: string;
  description: string;
  pdr_ref: string;
  urgency?: string;
}

export interface BlueprintApplyFeedback {
  type: 'success' | 'warning' | 'info';
  message: string;
}

export interface BlueprintMachineRow {
  id_machine_registered?: string;
  code_machine?: string;
  id?: string;
  id_machine?: string;
  code?: string;
  id_blueprint?: string;
  status?: string;
  statut?: string;
  is_active?: boolean;
  actif?: boolean;
  [key: string]: unknown;
}

export interface BlueprintPreventiveActionOption {
  code: string;
  libelle: string;
}

export interface BlueprintStockItemOption {
  id?: string;
  ref: string;
  designation?: string;
}

export interface BlueprintInspectModalProps {
  selectedInspectBlueprint: BlueprintRecord | null;
  setSelectedInspectBlueprint: React.Dispatch<React.SetStateAction<BlueprintRecord | null>>;
  inspectActiveTab: string;
  setInspectActiveTab: (tab: string) => void;
  setApplyFeedback: React.Dispatch<React.SetStateAction<BlueprintApplyFeedback | null>>;
  applyFeedback: BlueprintApplyFeedback | null;
  machines: BlueprintMachineRow[];
  blueprintDerivedTasksCountMap: Record<string, number>;
  handleTriggerApplyPreventivePlan: (bp: BlueprintRecord) => void;
  newPreventiveItem: BlueprintPreventiveDraft;
  setNewPreventiveItem: React.Dispatch<React.SetStateAction<BlueprintPreventiveDraft>>;
  preventiveActions: BlueprintPreventiveActionOption[];
  stockItems: BlueprintStockItemOption[];
  onUpdateBlueprint: (id: string, updated: BlueprintRecord) => void;
  newCommonFailureItem: BlueprintCommonFailureDraft;
  setNewCommonFailureItem: React.Dispatch<React.SetStateAction<BlueprintCommonFailureDraft>>;
}

export function BlueprintInspectModal({
  selectedInspectBlueprint,
  setSelectedInspectBlueprint,
  inspectActiveTab,
  setInspectActiveTab,
  setApplyFeedback,
  applyFeedback,
  machines,
  blueprintDerivedTasksCountMap,
  handleTriggerApplyPreventivePlan,
  newPreventiveItem,
  setNewPreventiveItem,
  preventiveActions,
  stockItems,
  onUpdateBlueprint,
  newCommonFailureItem,
  setNewCommonFailureItem,
}: BlueprintInspectModalProps) {
  if (!selectedInspectBlueprint) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Drawer Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center font-bold">
              <FingerprintPattern className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-indigo-700 text-sm">
                  {selectedInspectBlueprint.id_blueprint}
                </span>
                <span className="text-xs text-slate-400">•</span>
                <span className="text-xs font-mono text-slate-600 font-semibold">
                  {selectedInspectBlueprint.ref_plan || 'SANS-REF'}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  {selectedInspectBlueprint.statut}
                </span>
              </div>
              <h3 className="font-bold text-slate-900 text-base">{selectedInspectBlueprint.libelle}</h3>
            </div>
          </div>
          <button
            onClick={() => setSelectedInspectBlueprint(null)}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 6 Tabs Bar */}
        <div className="flex items-center gap-2 px-5 pt-3 border-b border-slate-200 bg-white overflow-x-auto">
          <button
            onClick={() => setInspectActiveTab('specs')}
            className={`pb-2.5 px-3 text-xs font-bold flex items-center gap-2 border-b-2 transition ${
              inspectActiveTab === 'specs'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Info className="w-3.5 h-3.5" />
            <span>1. Spécifications & Loi</span>
          </button>
          <button
            onClick={() => setInspectActiveTab('components')}
            className={`pb-2.5 px-3 text-xs font-bold flex items-center gap-2 border-b-2 transition ${
              inspectActiveTab === 'components'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <CubeIcon className="w-3.5 h-3.5 text-emerald-600" />
            <span>2. Composants ({selectedInspectBlueprint.components_theoriques?.length || 0})</span>
          </button>
          <button
            onClick={() => setInspectActiveTab('parts')}
            className={`pb-2.5 px-3 text-xs font-bold flex items-center gap-2 border-b-2 transition ${
              inspectActiveTab === 'parts'
                ? 'border-purple-600 text-purple-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <LayersIcon className="w-3.5 h-3.5 text-purple-600" />
            <span>3. Pièces & Visserie ({selectedInspectBlueprint.parts_theoriques?.length || 0})</span>
          </button>
          <button
            onClick={() => setInspectActiveTab('pdr')}
            className={`pb-2.5 px-3 text-xs font-bold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
              inspectActiveTab === 'pdr'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Wrench className="w-3.5 h-3.5 text-blue-600" />
            <span>4. PDR Consommables ({selectedInspectBlueprint.pdr_theoriques?.length || 0})</span>
          </button>
          <button
            onClick={() => {
              setApplyFeedback(null);
              setInspectActiveTab('preventive');
            }}
            className={`pb-2.5 px-3 text-xs font-bold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
              inspectActiveTab === 'preventive'
                ? 'border-teal-600 text-teal-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-teal-600" />
            <span>5. Plan préventif du blueprint ({(selectedInspectBlueprint.preventivePlanItems || []).length})</span>
          </button>
          <button
            onClick={() => {
              setInspectActiveTab('failures');
            }}
            className={`pb-2.5 px-3 text-xs font-bold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
              inspectActiveTab === 'failures'
                ? 'border-amber-600 text-amber-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span>6. Pannes fréquentes (DI) ({(selectedInspectBlueprint.commonFailures || []).length})</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4 text-xs">
          {inspectActiveTab === 'specs' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Famille</div>
                  <div className="text-xs font-bold text-cyan-700 mt-0.5">
                    {selectedInspectBlueprint.id_family}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Modèle Template</div>
                  <div className="text-xs font-bold text-amber-700 mt-0.5">
                    {selectedInspectBlueprint.id_templates}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Type Schéma</div>
                  <div className="text-xs font-bold text-slate-800 mt-0.5">
                    {selectedInspectBlueprint.type_schema}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Révision</div>
                  <div className="text-xs font-bold font-mono text-slate-800 mt-0.5">
                    {selectedInspectBlueprint.revision || 'Rev-A'}
                  </div>
                </div>
              </div>

              {/* Technical Specs Details */}
              <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-100 space-y-2">
                <h4 className="font-bold text-indigo-900 text-xs">Spécifications & Paramètres Constructeur</h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500">Puissance / Force :</span>{' '}
                    <b className="text-slate-800">{selectedInspectBlueprint.specs?.puissance || 'Non spécifié'}</b>
                  </div>
                  <div>
                    <span className="text-slate-500">Course / Capacité :</span>{' '}
                    <b className="text-slate-800">{selectedInspectBlueprint.specs?.course || 'Standard'}</b>
                  </div>
                  <div>
                    <span className="text-slate-500">Motorisation :</span>{' '}
                    <b className="text-slate-800">{selectedInspectBlueprint.specs?.moteur || 'Standard'}</b>
                  </div>
                  <div>
                    <span className="text-slate-500">Encombrement (LxPxH) :</span>{' '}
                    <b className="text-slate-800">{selectedInspectBlueprint.specs?.dimensions || 'Non mesuré'}</b>
                  </div>
                </div>
              </div>

              {/* Description */}
              {selectedInspectBlueprint.description && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 leading-relaxed">
                  <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">Notes & Description</div>
                  {selectedInspectBlueprint.description}
                </div>
              )}
            </div>
          )}

          {inspectActiveTab === 'components' && (
            <div className="space-y-3">
              <div className="text-xs text-slate-500">
                Sous-ensembles majeurs et composants d&apos;entrepôt rattachés au schéma :
              </div>
              {(selectedInspectBlueprint.components_theoriques?.length || 0) > 0 ? (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                  {selectedInspectBlueprint.components_theoriques?.map((c, idx) => (
                    <div key={`inspect-comp-${c.id_component || idx}-${idx}`} className="p-3 flex items-center justify-between hover:bg-slate-50 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[11px]">
                          {c.id_component}
                        </span>
                        <span className="font-semibold text-slate-800">{c.libelle || c.id_component}</span>
                      </div>
                      <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                        Qté : {c.qte || 1}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl">
                  Aucun composant majeur spécifié pour ce Blueprint.
                </div>
              )}
            </div>
          )}

          {inspectActiveTab === 'parts' && (
            <div className="space-y-3">
              <div className="text-xs text-slate-500">
                Visserie, fixations et pièces d&apos;assemblage magasin requises :
              </div>
              {(selectedInspectBlueprint.parts_theoriques?.length || 0) > 0 ? (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                  {selectedInspectBlueprint.parts_theoriques?.map((p, idx) => (
                    <div key={`inspect-part-${p.id_part || idx}-${idx}`} className="p-3 flex items-center justify-between hover:bg-slate-50 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 text-[11px]">
                          {p.id_part}
                        </span>
                        <span className="font-semibold text-slate-800">{p.libelle || p.id_part}</span>
                      </div>
                      <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                        Qté : {p.qte || 1}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl">
                  Aucune pièce d&apos;entrepôt spécifiée.
                </div>
              )}
            </div>
          )}

          {inspectActiveTab === 'pdr' && (
            <div className="space-y-3">
              <div className="text-xs text-slate-500">
                Pièces de Rechange (PDR) consommables et organes d&apos;usure préventifs :
              </div>
              {(selectedInspectBlueprint.pdr_theoriques?.length || 0) > 0 ? (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                  {selectedInspectBlueprint.pdr_theoriques?.map((p, idx) => (
                    <div key={`inspect-pdr-${p.id_pdr || idx}-${idx}`} className="p-3 flex items-center justify-between hover:bg-slate-50 text-xs">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 text-[11px]">
                          {p.id_pdr}
                        </span>
                        <span className="font-semibold text-slate-800">{p.libelle || p.id_pdr}</span>
                        {(p.parent_component_key || p.parent_component_code) && (
                          <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono text-[10px] font-bold">
                            ↳ Organe: {p.parent_component_key || p.parent_component_code}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            p.criticite === 'Haute'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          Critique : {p.criticite || 'Moyenne'}
                        </span>
                        <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                          Qté : {p.qte || 1}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl">
                  Aucune PDR théorique renseignée.
                </div>
              )}
            </div>
          )}

          {inspectActiveTab === 'preventive' && (() => {
            const currentItems = Array.isArray(selectedInspectBlueprint.preventivePlanItems)
              ? selectedInspectBlueprint.preventivePlanItems
              : [];
            const activeLinkedMachines = filterActiveMachines(machines).filter(
              (m) => m.id_blueprint === selectedInspectBlueprint.id_blueprint
            );
            const totalLinkedMachines = (machines || []).filter(
              (m) => m.id_blueprint === selectedInspectBlueprint.id_blueprint
            );
            const derivedTasksCount =
              blueprintDerivedTasksCountMap[selectedInspectBlueprint.id_blueprint] || 0;
            return (
              <div className="space-y-4">
                <div className="p-3.5 rounded-xl bg-teal-50/80 border border-teal-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-teal-950 text-xs flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-teal-600" />
                      <span>Plan préventif du blueprint</span>
                    </h4>
                    <p className="text-[11px] text-teal-800 mt-0.5">
                      Gamme préventive standard associée au modèle ({activeLinkedMachines.length} machine(s) active(s) sur {totalLinkedMachines.length} liée(s)).
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={currentItems.length === 0 || activeLinkedMachines.length === 0}
                    onClick={() => handleTriggerApplyPreventivePlan(selectedInspectBlueprint)}
                    className="h-8 px-3.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Appliquer aux machines actives liées ({activeLinkedMachines.length})</span>
                  </button>
                </div>

                {/* 3-KPI Summary Strip for Blueprint Preventive Status */}
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-600">Machines actives liées</span>
                    <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-900">
                      {activeLinkedMachines.length}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-teal-50/60 border border-teal-200/80 flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-teal-900">Items du plan (BOM)</span>
                    <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-white border border-teal-200 text-teal-800">
                      {currentItems.length}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-indigo-50/60 border border-indigo-200/80 flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-indigo-900">Tâches PM dérivées</span>
                    <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-white border border-indigo-200 text-indigo-800">
                      {derivedTasksCount}
                    </span>
                  </div>
                </div>

                {applyFeedback && (
                  <div
                    className={`p-3 rounded-xl text-xs font-semibold border ${
                      applyFeedback.type === 'success'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : applyFeedback.type === 'warning'
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-sky-50 text-sky-800 border-sky-200'
                    }`}
                  >
                    {applyFeedback.message}
                  </div>
                )}

                {/* Add Preventive Plan Item Row */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <input
                      type="text"
                      list="bp-inspect-comps-datalist"
                      value={newPreventiveItem.composant}
                      onChange={(e) => setNewPreventiveItem({ ...newPreventiveItem, composant: e.target.value })}
                      placeholder="Composant (ex: Broche, Courroie...)"
                      className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs sm:col-span-2"
                    />
                    <datalist id="bp-inspect-comps-datalist">
                      {(selectedInspectBlueprint.components_theoriques || []).map((c, idx) => (
                        <option key={`insp-dl-${idx}`} value={c.libelle || c.id_component} />
                      ))}
                    </datalist>

                    <select
                      value={newPreventiveItem.action_code}
                      onChange={(e) => setNewPreventiveItem({ ...newPreventiveItem, action_code: e.target.value })}
                      className="h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold"
                    >
                      {(preventiveActions && preventiveActions.length > 0
                        ? preventiveActions
                        : [
                            { code: 'C', libelle: 'Contrôle' },
                            { code: 'N', libelle: 'Nettoyage' },
                            { code: 'G', libelle: 'Graissage' },
                            { code: 'V', libelle: 'Vérification' },
                            { code: 'R', libelle: 'Révision' },
                            { code: 'S', libelle: 'Serrage' },
                            { code: 'L', libelle: 'Lubrification' },
                          ]
                      ).map((act, idx) => (
                        <option key={`insp-act-${act.code || idx}-${idx}`} value={act.code}>
                          {act.code} • {act.libelle}
                        </option>
                      ))}
                    </select>

                    <select
                      value={newPreventiveItem.frequence}
                      onChange={(e) => setNewPreventiveItem({ ...newPreventiveItem, frequence: e.target.value })}
                      className="h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold"
                    >
                      <option value="Hebdo">Hebdo</option>
                      <option value="Bi-hebdo">Bi-hebdo</option>
                      <option value="Mensuel">Mensuel</option>
                      <option value="Trimestriel">Trimestriel</option>
                      <option value="Semestriel">Semestriel</option>
                      <option value="Annuel">Annuel</option>
                    </select>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={newPreventiveItem.description}
                      onChange={(e) => setNewPreventiveItem({ ...newPreventiveItem, description: e.target.value })}
                      placeholder="Consigne / Description de l'opération..."
                      className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs flex-1 min-w-[160px]"
                    />
                    <select
                      value={newPreventiveItem.pdr_ref || ''}
                      onChange={(e) => setNewPreventiveItem({ ...newPreventiveItem, pdr_ref: e.target.value })}
                      className="h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 max-w-[180px]"
                      title="PDR consommable recommandée lors de cette opération préventive"
                    >
                      <option value="">PDR suggérée (optionnel)</option>
                      {stockItems.map((s, idx) => (
                        <option key={`insp-pm-pdr-opt-${s.ref || idx}-${idx}`} value={s.ref}>
                          {s.ref} • {s.designation}
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <input
                        type="number"
                        min="1"
                        value={newPreventiveItem.duree_min}
                        onChange={(e) =>
                          setNewPreventiveItem({
                            ...newPreventiveItem,
                            duree_min: Number(e.target.value) || 15,
                          })
                        }
                        placeholder="Min"
                        className="h-8 w-16 px-2 text-center rounded-lg border border-slate-200 bg-white text-xs font-mono font-bold"
                      />
                      <span className="text-[11px] text-slate-500">min</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!newPreventiveItem.frequence) return;
                        const compText = newPreventiveItem.composant.trim() || 'Machine entière';
                        const item: BlueprintPreventivePlanItem = {
                          id: `BPP-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                          composant: compText,
                          component_ref: compText !== 'Machine entière' ? compText : undefined,
                          action_code: newPreventiveItem.action_code || 'C',
                          frequence: newPreventiveItem.frequence || 'Mensuel',
                          duree_min: Number(newPreventiveItem.duree_min) || 15,
                          description: newPreventiveItem.description.trim(),
                          ...(newPreventiveItem.pdr_ref
                            ? { pdr_refs: [newPreventiveItem.pdr_ref] }
                            : {}),
                        };
                        const nextItems = [...currentItems, item];
                        const updatedBp: BlueprintRecord = {
                          ...selectedInspectBlueprint,
                          preventivePlanItems: nextItems,
                        };
                        setSelectedInspectBlueprint(updatedBp);
                        onUpdateBlueprint(updatedBp.id_blueprint, updatedBp);
                        setNewPreventiveItem({
                          composant: '',
                          action_code: 'C',
                          frequence: 'Mensuel',
                          duree_min: 15,
                          description: '',
                          pdr_ref: '',
                        });
                      }}
                      className="h-8 px-3 rounded-lg bg-teal-600 text-white font-semibold text-xs hover:bg-teal-700 transition flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Ajouter</span>
                    </button>
                  </div>
                </div>

                {/* Items List */}
                {currentItems.length > 0 ? (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                    {currentItems.map((item, idx) => (
                      <div
                        key={`inspect-pm-${item.id || idx}-${idx}`}
                        className="p-3 flex items-center justify-between hover:bg-slate-50 text-xs gap-2"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200 text-[11px]">
                              {item.action_code || 'C'}
                            </span>
                            <span className="font-bold text-slate-800">
                              {item.composant || 'Machine entière'}
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold">
                              {item.frequence}
                            </span>
                            {Array.isArray(item.pdr_refs) && item.pdr_refs.length > 0 && (
                              <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 font-mono text-[10px] font-bold">
                                PDR: {item.pdr_refs.join(', ')}
                              </span>
                            )}
                            {item.duree_min && (
                              <span className="font-mono text-[11px] text-slate-500">
                                {item.duree_min} min
                              </span>
                            )}
                          </div>
                          {item.description && (
                            <p className="text-[11px] text-slate-500 mt-1 truncate">{item.description}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const nextItems = currentItems.filter((_, i) => i !== idx);
                            const updatedBp: BlueprintRecord = {
                              ...selectedInspectBlueprint,
                              preventivePlanItems: nextItems,
                            };
                            setSelectedInspectBlueprint(updatedBp);
                            onUpdateBlueprint(updatedBp.id_blueprint, updatedBp);
                          }}
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition shrink-0"
                          title="Supprimer cet élément du plan"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl">
                    Aucun élément dans le plan préventif de ce Blueprint.
                  </div>
                )}
              </div>
            );
          })()}

          {inspectActiveTab === 'failures' && (() => {
            const currentFailures = Array.isArray(selectedInspectBlueprint.commonFailures)
              ? selectedInspectBlueprint.commonFailures
              : [];
            return (
              <div className="space-y-4">
                <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 flex items-center justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-amber-950 text-xs flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span>Pannes fréquentes du blueprint (Suggestions DI Correctif)</span>
                    </h4>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      Pannes et travaux types proposés automatiquement lors de la création d&apos;une DI sur toute machine active rattachée à ce Blueprint.
                    </p>
                  </div>
                </div>

                {/* Add Common Failure Row */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <input
                      type="text"
                      value={newCommonFailureItem.title}
                      onChange={(e) =>
                        setNewCommonFailureItem({ ...newCommonFailureItem, title: e.target.value })
                      }
                      placeholder="Titre / Symptôme (ex: Échauffement palier broche)"
                      className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs sm:col-span-2"
                    />
                    <select
                      value={newCommonFailureItem.type_panne}
                      onChange={(e) =>
                        setNewCommonFailureItem({ ...newCommonFailureItem, type_panne: e.target.value })
                      }
                      className="h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold"
                    >
                      <option value="M">M • Mécanique</option>
                      <option value="E">E • Électrique</option>
                      <option value="H">H • Hydraulique</option>
                      <option value="P">P • Pneumatique</option>
                    </select>
                    <select
                      value={newCommonFailureItem.urgence}
                      onChange={(e) =>
                        setNewCommonFailureItem({
                          ...newCommonFailureItem,
                          urgency: e.target.value,
                          urgence: e.target.value,
                        })
                      }
                      className="h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold"
                    >
                      <option value="HAUTE">Urgence : HAUTE</option>
                      <option value="MOYENNE">Urgence : MOYENNE</option>
                      <option value="BASSE">Urgence : BASSE</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={newCommonFailureItem.recommended_action}
                      onChange={(e) =>
                        setNewCommonFailureItem({
                          ...newCommonFailureItem,
                          recommended_action: e.target.value,
                        })
                      }
                      placeholder="Travail suggéré (ex: Contrôler jeu et remplacer roulement)"
                      className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs sm:col-span-2"
                    />
                    <select
                      value={newCommonFailureItem.pdr_ref}
                      onChange={(e) =>
                        setNewCommonFailureItem({ ...newCommonFailureItem, pdr_ref: e.target.value })
                      }
                      className="h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs"
                    >
                      <option value="">PDR associée (optionnel)</option>
                      {stockItems.map((s, idx) => (
                        <option key={`insp-cf-pdr-${s.ref || idx}-${idx}`} value={s.ref}>
                          {s.ref} • {s.designation}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newCommonFailureItem.description}
                      onChange={(e) =>
                        setNewCommonFailureItem({
                          ...newCommonFailureItem,
                          description: e.target.value,
                        })
                      }
                      placeholder="Description complémentaire / cause..."
                      className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!newCommonFailureItem.title.trim()) return;
                        const item: BlueprintCommonFailureItem = {
                          id: `BPF-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                          title: newCommonFailureItem.title.trim(),
                          type_panne: newCommonFailureItem.type_panne || 'M',
                          urgence: newCommonFailureItem.urgence || 'HAUTE',
                          recommended_action: newCommonFailureItem.recommended_action.trim(),
                          description: newCommonFailureItem.description.trim(),
                          pdr_ref: newCommonFailureItem.pdr_ref || undefined,
                        };
                        const nextFailures = [...currentFailures, item];
                        const updatedBp: BlueprintRecord = {
                          ...selectedInspectBlueprint,
                          commonFailures: nextFailures,
                        };
                        setSelectedInspectBlueprint(updatedBp);
                        onUpdateBlueprint(updatedBp.id_blueprint, updatedBp);
                        setNewCommonFailureItem({
                          title: '',
                          type_panne: 'M',
                          urgence: 'HAUTE',
                          recommended_action: '',
                          description: '',
                          pdr_ref: '',
                        });
                      }}
                      className="h-8 px-3 rounded-lg bg-amber-600 text-white font-semibold text-xs hover:bg-amber-700 transition flex items-center gap-1 shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Ajouter</span>
                    </button>
                  </div>
                </div>

                {/* Failures List */}
                {currentFailures.length > 0 ? (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                    {currentFailures.map((cf, idx) => (
                      <div
                        key={`inspect-cf-${cf.id || idx}-${idx}`}
                        className="p-3 flex items-center justify-between hover:bg-slate-50 text-xs gap-2"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[11px]">
                              {cf.type_panne || 'M'}
                            </span>
                            <span className="font-bold text-slate-900">{cf.title}</span>
                            {cf.urgence && (
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                                  cf.urgence === 'HAUTE'
                                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                    : cf.urgence === 'BASSE'
                                    ? 'bg-slate-100 text-slate-600'
                                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                                }`}
                              >
                                {cf.urgence}
                              </span>
                            )}
                            {cf.pdr_ref && (
                              <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-mono text-[10px] font-bold">
                                PDR: {cf.pdr_ref}
                              </span>
                            )}
                          </div>
                          {(cf.recommended_action || cf.description) && (
                            <p className="text-[11px] text-slate-600 mt-1 truncate">
                              {[cf.recommended_action, cf.description].filter(Boolean).join(' • ')}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const nextFailures = currentFailures.filter((_, i) => i !== idx);
                            const updatedBp: BlueprintRecord = {
                              ...selectedInspectBlueprint,
                              commonFailures: nextFailures,
                            };
                            setSelectedInspectBlueprint(updatedBp);
                            onUpdateBlueprint(updatedBp.id_blueprint, updatedBp);
                          }}
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition shrink-0"
                          title="Supprimer cette panne fréquente"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl">
                    Aucune panne fréquente enregistrée sur ce Blueprint.
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
          <button
            onClick={() => setSelectedInspectBlueprint(null)}
            className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
