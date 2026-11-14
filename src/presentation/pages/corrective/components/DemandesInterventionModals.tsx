import React from 'react';
import { Flame, X, Wrench, BookOpen, Check } from 'lucide-react';
import { useI18n } from '../../../../i18n/I18nContext';
import type {
  IBlueprintCommonFailureItem,
  IStockItem,
  IWarehouseItem,
} from '../../../../types/domain';
import type { CorrectiveInterventionItem } from '../../../../types/store';
import type { TechnicianSuitabilityEvaluation } from '../../../../domain/workforce/workforceCapacityService';
import type { SpareReservationEvaluation } from '../../../../domain/stock/stockReservationService';

export interface DemandesNewFormState {
  code_machine: string;
  id_composant: string;
  nom_composant: string;
  id_part: string;
  nom_part: string;
  pdr_ref: string;
  pdr_quantite: number;
  demandeur: string;
  priorite: string;
  type_panne: string;
  anomalie: string;
  travail_a_faire: string;
  arret_machine: boolean;
}

export interface DemandesConvertFormState {
  num_bt: string;
  intervenant: string;
  priorite: string;
  travail_a_faire: string;
  duree_prevue_mins: number;
  pdr_ref: string;
  pdr_quantite: number;
  allowWaitPdrOnConflict: boolean;
}

export interface DemandesMachineOption {
  id: string;
  id_machine_registered: string;
  code: string;
  id_blueprint: string;
  zone: string;
  designation: string;
  totalInterventions: number;
}

export interface DemandesTechnicianOption {
  id_technician: string;
  nom: string;
  name: string;
  role: string;
  isCorrective?: boolean;
}

export interface DemandesWarehousePartOption extends IWarehouseItem {
  nom_composant?: string;
  nom?: string;
  designation_part?: string;
}

export interface DemandesRankedStockItem {
  id?: string | number;
  ref?: string;
  reference?: string;
  code_article?: string;
  id_article?: string;
  code?: string;
  designation?: string;
  nom?: string;
  stockActuel?: number;
  stock_actuel?: number;
  stockInitial?: number;
  quantite?: number;
  qte?: number;
  seuil?: number;
  unite?: string;
  prixUnitaire?: number;
  prix_unitaire?: number;
  emplacement?: string;
  categorie?: string;
  famille?: string;
  isBomRecommended?: boolean;
  bomPriority?: 1 | 2 | 3;
  bomSourceLabel?: string;
  bomReason?: string;
}

export interface DemandesReservationEvalSummary {
  canAllocateAll: boolean;
  evaluations: SpareReservationEvaluation[];
  conflicts: SpareReservationEvaluation[];
}

export interface DemandesInterventionModalsProps {
  showCreateModal: boolean;
  setShowCreateModal: (v: boolean) => void;
  handleCreateSubmit: (e: React.FormEvent) => void;
  newForm: DemandesNewFormState;
  setNewForm: React.Dispatch<React.SetStateAction<DemandesNewFormState>>;
  allMachineOptions: DemandesMachineOption[];
  blueprintCommonFailures: IBlueprintCommonFailureItem[];
  selectedMachineBlueprintId: string;
  handleApplyBlueprintCommonFailure: (cf: IBlueprintCommonFailureItem) => void;
  machineComponents: DemandesWarehousePartOption[];
  machineParts: DemandesWarehousePartOption[];
  rankedStockItems: DemandesRankedStockItem[];
  panneCategories: Record<string, string[]>;
  availableCategories: string[];
  anomaliesForSelectedCategory: string[];
  getActionsForPanne: (panne: string) => string[];
  showTravauxSelector: boolean;
  setShowTravauxSelector: (v: boolean) => void;
  travauxSearchTerm: string;
  setTravauxSearchTerm: (v: string) => void;
  filteredStandardTravaux: string[];
  showToast?: (msg: string, type?: 'success' | 'error' | 'warning' | 'info' | string) => void;
  showConvertModal: CorrectiveInterventionItem | null;
  setShowConvertModal: (di: CorrectiveInterventionItem | null) => void;
  handleConvertSubmit: (e: React.FormEvent) => void;
  convertForm: DemandesConvertFormState;
  setConvertForm: React.Dispatch<React.SetStateAction<DemandesConvertFormState>>;
  allTechnicianOptions: DemandesTechnicianOption[];
  selectedConvertTechEval: TechnicianSuitabilityEvaluation | null;
  convertTechEvaluations: TechnicianSuitabilityEvaluation[];
  stockItems: IStockItem[];
  convertReservationEval: DemandesReservationEvalSummary | null;
}

export default function DemandesInterventionModals({
  showCreateModal,
  setShowCreateModal,
  handleCreateSubmit,
  newForm,
  setNewForm,
  allMachineOptions,
  blueprintCommonFailures,
  selectedMachineBlueprintId,
  handleApplyBlueprintCommonFailure,
  machineComponents,
  machineParts,
  rankedStockItems,
  panneCategories,
  availableCategories,
  anomaliesForSelectedCategory,
  getActionsForPanne,
  showTravauxSelector,
  setShowTravauxSelector,
  travauxSearchTerm,
  setTravauxSearchTerm,
  filteredStandardTravaux,
  showToast,
  showConvertModal,
  setShowConvertModal,
  handleConvertSubmit,
  convertForm,
  setConvertForm,
  allTechnicianOptions,
  selectedConvertTechEval,
  convertTechEvaluations,
  stockItems,
  convertReservationEval,
}: DemandesInterventionModalsProps) {
  const { t } = useI18n();

  return (
    <>
      {/* MODAL 1: Nouvelle Demande d'Intervention (DI) */}
      {showCreateModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
        >
          <div
            className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-5 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-300/80 flex items-center justify-center text-amber-700 shadow-xs">
                  <Flame className="w-5 h-5 text-amber-700" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight">
                    Nouvelle Demande d&apos;Intervention (DI)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Signalement immédiat d&apos;une anomalie par la production
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="w-8 h-8 rounded-full border border-slate-200 bg-white hover:bg-slate-100 text-slate-500 flex items-center justify-center cursor-pointer shadow-2xs"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4 overflow-y-auto text-xs">
              {/* Machine Selection */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Machine Concernée <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={newForm.code_machine}
                  onChange={(e) => setNewForm({ ...newForm, code_machine: e.target.value, id_composant: '', id_part: '' })}
                  className="w-full py-2 px-3 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-amber-400 focus:outline-hidden"
                >
                  {allMachineOptions.length > 0 ? (
                    allMachineOptions.map((m) => {
                      const code = m.code || m.id_machine_registered || m.id;
                      return (
                        <option key={code} value={code}>
                          {code} {m.zone ? `(${m.zone})` : ''} - {m.totalInterventions ? `${m.totalInterventions} interventions` : 'Parc'}
                        </option>
                      );
                    })
                  ) : (
                    <option value="" disabled>
                      -- Aucune machine active enregistrée dans le Parc --
                    </option>
                  )}
                </select>
              </div>

              {/* Pannes fréquentes du blueprint (BP-5) */}
              {blueprintCommonFailures.length > 0 && (
                <div className="p-3 rounded-2xl bg-indigo-50/70 border border-indigo-200/80 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-indigo-950 flex items-center gap-1.5">
                      <Wrench className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Pannes fréquentes du blueprint ({selectedMachineBlueprintId})</span>
                    </span>
                    <span className="text-[10px] font-mono font-bold text-indigo-700 bg-white px-2 py-0.5 rounded border border-indigo-200">
                      Cliquer pour pré-remplir
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {blueprintCommonFailures.map((cf, idx) => (
                      <button
                        key={cf.id || idx}
                        type="button"
                        onClick={() => handleApplyBlueprintCommonFailure(cf)}
                        className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-indigo-100/80 text-indigo-950 border border-indigo-200 hover:border-indigo-400 font-semibold text-[11px] cursor-pointer transition shadow-2xs text-left flex items-center gap-1.5"
                        title={
                          [cf.description, cf.recommended_action]
                            .filter(Boolean)
                            .join(' • ') || cf.title
                        }
                      >
                        {cf.type_panne && (
                          <span className="px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-800 border border-indigo-200 font-mono font-bold text-[10px]">
                            {cf.type_panne}
                          </span>
                        )}
                        <span>{cf.title}</span>
                        {cf.urgence && (
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9.5px] font-mono font-bold ${
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
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Entrepôt: Composants (Cycle de Vie) & Localisation Part Structurelle (Sans déstockage) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-2xl bg-amber-50/50 border border-amber-200/60">
                <div>
                  <label className="block text-[10.5px] font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
                    <span>Organe / Composant (Cycle de vie)</span>
                    <span className="text-[10px] text-amber-700 font-mono font-bold">
                      {machineComponents.length} détectés
                    </span>
                  </label>
                  <select
                    value={newForm.id_composant}
                    onChange={(e) => {
                      const val = e.target.value;
                      const found = machineComponents.find(
                        (c) => String(c.id_warehouse_item || c.id) === val
                      );
                      setNewForm({
                        ...newForm,
                        id_composant: val,
                        nom_composant: found
                          ? String(found.designation || found.nom_composant || found.nom || val)
                          : '',
                      });
                    }}
                    className="w-full py-1.5 px-2.5 text-xs font-medium rounded-xl border border-slate-200 bg-white focus:border-amber-400 focus:outline-hidden"
                  >
                    <option value="">-- Machine Globale / Sans composant --</option>
                    {machineComponents.map((c) => {
                      const id = String(c.id_warehouse_item || c.id || '');
                      const name = String(c.designation || c.nom_composant || c.nom || id);
                      return (
                        <option key={id} value={id}>
                          {name} ({c.status || c.statut || 'En Service'})
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-[10.5px] font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
                    <span>Part / Localisation Structurelle</span>
                    <span className="text-[10px] text-amber-700 font-mono font-bold">
                      {machineParts.length} sites (Sans déstockage)
                    </span>
                  </label>
                  <select
                    value={newForm.id_part}
                    onChange={(e) => {
                      const val = e.target.value;
                      const found = machineParts.find(
                        (p) => String(p.id_warehouse_item || p.id) === val
                      );
                      setNewForm({
                        ...newForm,
                        id_part: val,
                        nom_part: found
                          ? String(found.designation_part || found.designation || found.nom || val)
                          : '',
                      });
                    }}
                    className="w-full py-1.5 px-2.5 text-xs font-medium rounded-xl border border-slate-200 bg-white focus:border-amber-400 focus:outline-hidden"
                  >
                    <option value="">-- Aucune localisation structurelle --</option>
                    {machineParts.map((p) => {
                      const id = String(p.id_warehouse_item || p.id || '');
                      const name = String(p.designation_part || p.designation || id);
                      return (
                        <option key={id} value={id}>
                          {name}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {/* Pièce Consommable PDR (Stock Actuel — Classée par BOM) */}
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10.5px] font-bold text-slate-700 uppercase tracking-wider">
                    Pièce PDR Consommable (Stock Actuel · Tri BOM)
                  </label>
                  <span className="text-[10px] font-mono text-slate-500">
                    {rankedStockItems.some((s) => s.isBomRecommended)
                      ? '★ BOM Recommandée en tête'
                      : 'Magasin Central'}
                  </span>
                </div>
                <div className="flex gap-2">
                  <select
                    value={newForm.pdr_ref}
                    onChange={(e) => setNewForm({ ...newForm, pdr_ref: e.target.value })}
                    className="flex-1 py-1.5 px-2.5 text-xs font-medium rounded-xl border border-slate-200 bg-white focus:border-amber-400 focus:outline-hidden"
                  >
                    <option value="">-- Aucune PDR consommable requise --</option>
                    {rankedStockItems.map((s) => {
                      const itemRef = String(s.ref || s.reference || s.id_article || s.code || '');
                      return (
                        <option key={itemRef || String(s.id ?? '')} value={itemRef}>
                          {s.isBomRecommended ? `★ [${s.bomSourceLabel}] ` : ''}
                          {itemRef} - {s.designation || s.nom || ''} (Dispo: {s.stockActuel ?? s.stock_actuel ?? 0} {s.unite || 'U'})
                        </option>
                      );
                    })}
                  </select>
                  {newForm.pdr_ref && (
                    <input
                      type="number"
                      min="1"
                      value={newForm.pdr_quantite}
                      onChange={(e) => setNewForm({ ...newForm, pdr_quantite: Math.max(1, Number(e.target.value) || 1) })}
                      placeholder="Qté"
                      className="w-16 py-1.5 px-2 text-xs font-bold text-center rounded-xl border border-slate-200 bg-white focus:border-amber-400 focus:outline-hidden font-mono"
                    />
                  )}
                </div>
              </div>

              {/* Type Panne & Anomalie Autocomplete */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Type Panne (Base de données)
                  </label>
                  <select
                    value={newForm.type_panne}
                    onChange={(e) => {
                      const cat = e.target.value;
                      const firstAnom = panneCategories[cat]?.[0] || '';
                      setNewForm({ ...newForm, type_panne: cat, anomalie: firstAnom });
                    }}
                    className="w-full py-2 px-3 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-amber-400 focus:outline-hidden"
                  >
                    {availableCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat} ({panneCategories[cat]?.length || 0} anomalies)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Anomalie Détectée
                  </label>
                  <select
                    value={newForm.anomalie}
                    onChange={(e) => setNewForm({ ...newForm, anomalie: e.target.value })}
                    className="w-full py-2 px-3 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-amber-400 focus:outline-hidden"
                  >
                    <option value="">{t('corrective.common.unspecified', '— Non spécifiée —')}</option>
                    {newForm.anomalie && !anomaliesForSelectedCategory.includes(newForm.anomalie) && (
                      <option value={newForm.anomalie}>{newForm.anomalie}</option>
                    )}
                    {anomaliesForSelectedCategory.map((anom) => (
                      <option key={anom} value={anom}>
                        {anom}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Demandeur & Urgence */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Service Demandeur
                  </label>
                  <input
                    type="text"
                    value={newForm.demandeur}
                    onChange={(e) => setNewForm({ ...newForm, demandeur: e.target.value })}
                    placeholder="Ex: Production, Chef d'Atelier, Qualité"
                    className="w-full py-2 px-3 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-amber-400 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Niveau d&apos;Urgence
                  </label>
                  <select
                    value={newForm.priorite}
                    onChange={(e) => setNewForm({ ...newForm, priorite: e.target.value })}
                    className="w-full py-2 px-3 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-amber-400 focus:outline-hidden"
                  >
                    <option value="HAUTE">HAUTE (Urgent - Arrêt Imminent)</option>
                    <option value="MOYENNE">MOYENNE (Normal - Sous 24h)</option>
                    <option value="BASSE">BASSE (Prévisionnel)</option>
                  </select>
                </div>
              </div>

              {/* Arrêt Machine Checkbox */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50/60 border border-amber-200">
                <input
                  type="checkbox"
                  id="arretMachineCheck"
                  checked={newForm.arret_machine}
                  onChange={(e) => setNewForm({ ...newForm, arret_machine: e.target.checked })}
                  className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300 cursor-pointer"
                />
                <label htmlFor="arretMachineCheck" className="font-bold text-slate-800 text-xs cursor-pointer">
                  La machine est à l&apos;arrêt complet (Ligne bloquée)
                </label>
              </div>

              {/* Travail à faire */}
              <div>
                <div className="flex items-center justify-between mb-1 flex-wrap gap-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Description de la Panne / Travail Souhaité
                  </label>

                  <div className="flex items-center gap-2">
                    {getActionsForPanne(newForm.anomalie).length > 0 && (
                      <span className="text-[10px] font-bold text-amber-700">
                        {getActionsForPanne(newForm.anomalie).length} actions recommandées
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => setShowTravauxSelector(!showTravauxSelector)}
                      className="px-2 py-0.5 rounded-lg border border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-900 font-bold text-[10.5px] transition flex items-center gap-1 cursor-pointer shadow-2xs"
                    >
                      <BookOpen className="w-3 h-3 text-blue-600" />
                      <span>{showTravauxSelector ? 'Fermer catalogue' : 'Choisir parmi les 114 travaux standard'}</span>
                    </button>
                  </div>
                </div>

                {/* Searchable Standard Travaux Dropdown */}
                {showTravauxSelector && (
                  <div className="mb-2 p-2.5 rounded-xl bg-blue-50/70 border border-blue-200 space-y-2 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10.5px] font-black uppercase tracking-wider text-blue-900">
                        Catalogue des 114 Travaux Standard d&apos;Atelier (Cliquer pour insérer) :
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowTravauxSelector(false)}
                        className="text-slate-400 hover:text-slate-600 text-xs"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <input
                      type="text"
                      value={travauxSearchTerm}
                      onChange={(e) => setTravauxSearchTerm(e.target.value)}
                      placeholder="Filtrer parmi les 114 travaux (ex: démonter, huile, moteur, graissage...)"
                      className="w-full py-1.5 px-2.5 text-xs rounded-lg border border-blue-200 bg-white focus:outline-hidden focus:border-blue-400"
                    />

                    <div className="max-h-36 overflow-y-auto space-y-1 pr-1 divide-y divide-blue-100">
                      {filteredStandardTravaux.map((trv, tIdx) => (
                        <div
                          key={tIdx}
                          onClick={() => {
                            setNewForm((prev) => ({
                              ...prev,
                              travail_a_faire: prev.travail_a_faire ? `${prev.travail_a_faire}\n${trv}` : trv,
                            }));
                            setShowTravauxSelector(false);
                            showToast?.('Travail standard inséré !', 'success');
                          }}
                          className="pt-1.5 pb-1 px-1.5 text-[11px] text-slate-800 hover:bg-blue-100/70 rounded-md cursor-pointer transition flex items-start justify-between gap-2"
                        >
                          <span className="font-medium leading-relaxed">{trv}</span>
                          <span className="text-[9.5px] font-mono text-blue-600 font-bold shrink-0 mt-0.5">+ Insérer</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <textarea
                  rows={3}
                  value={newForm.travail_a_faire}
                  onChange={(e) => setNewForm({ ...newForm, travail_a_faire: e.target.value })}
                  placeholder="Ex: Vérifier le bobinage moteur, changer le fusible ou réaligner la courroie..."
                  className="w-full py-2 px-3 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-amber-400 focus:outline-hidden"
                />

                {/* Quick Action Badges for Selected Panne */}
                {getActionsForPanne(newForm.anomalie).length > 0 && (
                  <div className="mt-2 p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/80 space-y-1.5">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-900 block">
                      Actions standard pour « {newForm.anomalie} » (Cliquer pour insérer) :
                    </span>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                      {getActionsForPanne(newForm.anomalie).map((act, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setNewForm((prev) => ({
                              ...prev,
                              travail_a_faire: prev.travail_a_faire ? `${prev.travail_a_faire}\n${act}` : act,
                            }));
                          }}
                          className="px-2 py-1 rounded-lg bg-white hover:bg-amber-100 text-amber-950 border border-amber-300 font-medium text-[10.5px] cursor-pointer transition shadow-2xs text-left"
                        >
                          + {act}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 font-bold text-xs text-slate-700 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={!newForm.code_machine || allMachineOptions.length === 0}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white font-bold text-xs transition cursor-pointer shadow-md shadow-amber-600/25 active:scale-95"
                >
                  Enregistrer la Demande (DI)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Convertir en Bon de Travail (BT) */}
      {showConvertModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
        >
          <div
            className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-blue-500/10 via-blue-500/5 to-transparent p-5 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-300/80 flex items-center justify-center text-blue-700 shadow-xs">
                  <Wrench className="w-5 h-5 text-blue-700" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight">
                    Générer le Bon de Travail (BT)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Machine : <b>{showConvertModal.code_machine}</b> • Anomalie : <b>{showConvertModal.anomalie}</b>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowConvertModal(null)}
                className="w-8 h-8 rounded-full border border-slate-200 bg-white hover:bg-slate-100 text-slate-500 flex items-center justify-center cursor-pointer shadow-2xs"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConvertSubmit} className="p-6 space-y-4 overflow-y-auto text-xs">
              {/* N° BT */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Numéro du Bon de Travail (BT) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={convertForm.num_bt}
                  onChange={(e) => setConvertForm({ ...convertForm, num_bt: e.target.value })}
                  placeholder="Ex: BT-0001"
                  className="w-full py-2 px-3 text-xs font-mono font-bold rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-400 focus:outline-hidden"
                />
              </div>

              {/* Affectation Technicien + Habilitations & Capacité Poste */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Affecter un Intervenant / Technicien
                  </label>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-500">Durée estimée (min):</span>
                    <input
                      type="number"
                      min={15}
                      max={480}
                      step={15}
                      value={convertForm.duree_prevue_mins}
                      onChange={(e) =>
                        setConvertForm({
                          ...convertForm,
                          duree_prevue_mins: Math.max(15, Number(e.target.value) || 90),
                        })
                      }
                      className="w-16 py-0.5 px-1.5 rounded border border-slate-300 font-mono text-[11px] text-center"
                    />
                  </div>
                </div>
                <select
                  value={convertForm.intervenant}
                  onChange={(e) => setConvertForm({ ...convertForm, intervenant: e.target.value })}
                  className="w-full py-2 px-3 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-400 focus:outline-hidden"
                >
                  <option value="">
                    {allTechnicianOptions.length > 0
                      ? '-- Sélectionner un intervenant --'
                      : '-- Aucun technicien enregistré (Non assigné) --'}
                  </option>
                  {allTechnicianOptions.map((tech) => (
                    <option key={tech.nom || tech.name} value={tech.nom || tech.name}>
                      {tech.nom || tech.name} {tech.role ? `(${tech.role})` : ''}
                    </option>
                  ))}
                </select>

                {selectedConvertTechEval && (
                  <div
                    className={`p-2.5 rounded-xl border text-[11px] space-y-1 ${
                      !selectedConvertTechEval.isHabilitationCompliant ||
                      selectedConvertTechEval.wouldExceedShiftCapacity
                        ? 'bg-amber-50 border-amber-300 text-amber-950'
                        : 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span>
                        Habilitations &amp; Capacité Poste ({selectedConvertTechEval.shift}) :
                      </span>
                      <span className="font-mono">
                        Charge : {selectedConvertTechEval.workload.totalAssignedMinutes} /{' '}
                        {selectedConvertTechEval.workload.capacityMinutes} min (
                        {selectedConvertTechEval.projectedUtilizationPct}% après affectation)
                      </span>
                    </div>
                    <div className="text-[10.5px] flex items-center justify-between gap-2">
                      <span>{selectedConvertTechEval.recommendationLabelFr}</span>
                      {convertTechEvaluations[0] &&
                        convertTechEvaluations[0].technicianName !== convertForm.intervenant && (
                          <button
                            type="button"
                            onClick={() =>
                              setConvertForm({
                                ...convertForm,
                                intervenant: convertTechEvaluations[0].technicianName,
                              })
                            }
                            className="px-2 py-0.5 rounded bg-blue-600 text-white font-bold text-[10px] cursor-pointer shrink-0"
                          >
                            Choisir recommandé ({convertTechEvaluations[0].technicianName})
                          </button>
                        )}
                    </div>
                  </div>
                )}
              </div>

              {/* Réservation Préalable PDR (Stock Réservé vs Disponible) */}
              <div className="p-3 rounded-2xl bg-purple-50/60 border border-purple-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-purple-950">
                    Réservation Préalable PDR (Stock Réservé vs Disponible)
                  </span>
                  <span className="text-[10px] font-mono text-purple-700">
                    Anti-conflit inter-machines
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="sm:col-span-2">
                    <select
                      value={convertForm.pdr_ref}
                      onChange={(e) =>
                        setConvertForm({
                          ...convertForm,
                          pdr_ref: e.target.value,
                          allowWaitPdrOnConflict: false,
                        })
                      }
                      className="w-full py-1.5 px-2.5 rounded-xl border border-purple-200 bg-white text-xs font-medium"
                    >
                      <option value="">-- Aucune pièce réservée à l&apos;avance --</option>
                      {stockItems.map((st) => (
                        <option key={st.ref} value={st.ref}>
                          {st.ref} — {st.designation} (Physique: {st.stockActuel ?? st.stockInitial ?? 0})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <input
                      type="number"
                      min={1}
                      disabled={!convertForm.pdr_ref}
                      value={convertForm.pdr_quantite}
                      onChange={(e) =>
                        setConvertForm({
                          ...convertForm,
                          pdr_quantite: Math.max(1, Number(e.target.value) || 1),
                        })
                      }
                      className="w-full py-1.5 px-2.5 rounded-xl border border-purple-200 bg-white font-mono font-bold text-xs text-center disabled:opacity-50"
                      placeholder="Qté"
                    />
                  </div>
                </div>

                {convertReservationEval && convertReservationEval.evaluations[0] && (
                  <div
                    className={`p-2.5 rounded-xl border text-[11px] space-y-1.5 ${
                      convertReservationEval.canAllocateAll
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        : 'bg-rose-50 border-rose-300 text-rose-950'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 font-mono font-bold">
                      <span>
                        Physique: {convertReservationEval.evaluations[0].stockPhysique}{' '}
                        {convertReservationEval.evaluations[0].unit}
                      </span>
                      <span>
                        Déjà Réservé: {convertReservationEval.evaluations[0].reservedByOtherClaimsQty}{' '}
                        {convertReservationEval.evaluations[0].unit}
                      </span>
                      <span className="underline">
                        Disponible Net: {convertReservationEval.evaluations[0].stockDisponible}{' '}
                        {convertReservationEval.evaluations[0].unit}
                      </span>
                    </div>
                    <p className="text-[10.5px] leading-snug">
                      {convertReservationEval.evaluations[0].conflictMessageFr}
                    </p>
                    {!convertReservationEval.canAllocateAll && (
                      <label className="flex items-center gap-2 pt-1 font-bold text-rose-900 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={convertForm.allowWaitPdrOnConflict}
                          onChange={(e) =>
                            setConvertForm({
                              ...convertForm,
                              allowWaitPdrOnConflict: e.target.checked,
                            })
                          }
                          className="rounded border-rose-400 text-rose-600"
                        />
                        <span>
                          Créer le BT en statut « EN_ATTENTE_PDR » sans doubler la réservation
                        </span>
                      </label>
                    )}
                  </div>
                )}
              </div>

              {/* Instructions de Travail */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Travail à Faire (Suggestions d&apos;Atelier)
                  </label>
                  {getActionsForPanne(String(showConvertModal.anomalie || '')).length > 0 && (
                    <span className="text-[10px] font-bold text-blue-700">
                      {getActionsForPanne(String(showConvertModal.anomalie || '')).length} actions recommandées
                    </span>
                  )}
                </div>
                <textarea
                  rows={3}
                  value={convertForm.travail_a_faire}
                  onChange={(e) => setConvertForm({ ...convertForm, travail_a_faire: e.target.value })}
                  placeholder="Ex: Démonter vis sans fin, vérifier circuit de commande, changer roulement..."
                  className="w-full py-2 px-3 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-400 focus:outline-hidden"
                />

                {/* Quick Action Badges for Selected Panne in Convert Modal */}
                {getActionsForPanne(String(showConvertModal.anomalie || '')).length > 0 && (
                  <div className="mt-2 p-2.5 rounded-xl bg-blue-50/70 border border-blue-200/80 space-y-1.5">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-900 block">
                      Actions types pour « {showConvertModal.anomalie} » :
                    </span>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                      {getActionsForPanne(String(showConvertModal.anomalie || '')).map((act, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setConvertForm((prev) => ({
                              ...prev,
                              travail_a_faire: prev.travail_a_faire ? `${prev.travail_a_faire}\n${act}` : act,
                            }));
                          }}
                          className="px-2 py-1 rounded-lg bg-white hover:bg-blue-100 text-blue-950 border border-blue-300 font-medium text-[10.5px] cursor-pointer transition shadow-2xs text-left"
                        >
                          + {act}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowConvertModal(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 font-bold text-xs text-slate-700 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition cursor-pointer shadow-md shadow-blue-600/25 active:scale-95 flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Valider et Créer le BT</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
