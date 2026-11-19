import React from 'react';
import {
  CheckCircle2,
  X,
  AlertTriangle,
  Package,
  Trash2,
  Gauge,
} from 'lucide-react';
import PrintWorkOrderModal from './PrintWorkOrderModal';
import SystemGeneralRoundModal, {
  type RoundStockEntry,
  type RoundTaskCorrectivePayload,
  type RoundTaskEntry,
  type RoundTaskValidationPayload,
  type RoundZoneEntry,
} from './SystemGeneralRoundModal';
import { reconcileFieldClaim } from '../../../../core/security/validationReconciliation';
import { hasPreventiveExecutionAnomaly } from '../../../../application/services/MachineHealthPassportService';
import { resolvePreventiveLaborRate } from '../../../../domain/preventive/preventiveScheduleEngine';
import type {
  IMachine,
  IMouvement,
  ISortieDemand,
  IStockItem,
  ITechnician,
  IWarehouseItem,
} from '../../../../types/domain';
import type { PreventiveExecutionRecord } from '../../../../types/preventive';
import type { CorrectiveInterventionItem } from '../../../../types/store';

export interface TabMainPdrDraftItem {
  id_article: string;
  designation: string;
  reference: string;
  ref?: string;
  quantite: number;
  qty?: number;
  unite: string;
  prix_unitaire: number;
  source?: string;
}

export interface TabMainInventoryOption extends RoundStockEntry {
  isBomRecommended?: boolean;
  bomSourceLabel?: string;
}

export interface TabMainValidationFormState {
  date_realisation: string;
  technicien: string;
  duree_reelle: string;
  taux_horaire: number;
  observations: string;
  usedPDR: TabMainPdrDraftItem[];
  num_bon_saisi_par_tech: string;
  skipStockDeduction: boolean;
  createFollowUpDi: boolean;
  followUpDiAnomalie: string;
  mode_calcul_recurrence: string;
  compteur_releve: string | number;
  id_composant: string;
  nom_composant: string;
  id_part: string;
  nom_part: string;
}

export interface TabMainWarehouseComponentOption extends IWarehouseItem {
  nom_composant?: string;
  nom?: string;
  designation_part?: string;
}

export interface TabMainModalsProps {
  selectedTaskForValidation: RoundTaskEntry | null;
  setSelectedTaskForValidation: (task: RoundTaskEntry | null) => void;
  isTechUser: boolean;
  validationData: TabMainValidationFormState;
  setValidationData: React.Dispatch<React.SetStateAction<TabMainValidationFormState>>;
  handleConfirmValidation: (e: React.FormEvent) => void;
  validationMachineComponents: TabMainWarehouseComponentOption[];
  validationMachineParts: TabMainWarehouseComponentOption[];
  handleRemovePdrFromValidation: (idx: number) => void;
  newPdrItem: TabMainPdrDraftItem;
  setNewPdrItem: React.Dispatch<React.SetStateAction<TabMainPdrDraftItem>>;
  rankedValidationInventory: TabMainInventoryOption[];
  handleAddPdrToValidation: (item: TabMainPdrDraftItem) => void;
  stockItems: IStockItem[];
  storeMouvements: IMouvement[];
  storeCorrectiveInterventions: CorrectiveInterventionItem[];
  executions: PreventiveExecutionRecord[];
  storeSortieDemands: ISortieDemand[];
  selectedTaskForBT: RoundTaskEntry | null;
  setSelectedTaskForBT: (task: RoundTaskEntry | null) => void;
  btData: { description: string; priorite: string };
  setBtData: React.Dispatch<React.SetStateAction<{ description: string; priorite: string }>>;
  handleConfirmCorrective: (e: React.FormEvent) => void;
  selectedTaskForPrint: RoundTaskEntry | null;
  setSelectedTaskForPrint: (task: RoundTaskEntry | null) => void;
  showSystemGeneralRoundModal: boolean;
  setShowSystemGeneralRoundModal: (v: boolean) => void;
  scopedTasks: RoundTaskEntry[];
  machines: IMachine[];
  zones: RoundZoneEntry[];
  technicians: Array<ITechnician | string>;
  availableInventory: RoundStockEntry[];
  techDisplayName: string;
  onMarkTaskDone?: (taskId: string, payload: RoundTaskValidationPayload) => void;
  onCreateCorrective?: (task: RoundTaskEntry, payload: RoundTaskCorrectivePayload) => void;
  showToast?: (message: string, type?: 'success' | 'error' | 'warning' | 'info' | string) => void;
}

export default function TabMainModals({
  selectedTaskForValidation,
  setSelectedTaskForValidation,
  isTechUser,
  validationData,
  setValidationData,
  handleConfirmValidation,
  validationMachineComponents,
  validationMachineParts,
  handleRemovePdrFromValidation,
  newPdrItem,
  setNewPdrItem,
  rankedValidationInventory,
  handleAddPdrToValidation,
  stockItems,
  storeMouvements,
  storeCorrectiveInterventions,
  executions,
  storeSortieDemands,
  selectedTaskForBT,
  setSelectedTaskForBT,
  btData,
  setBtData,
  handleConfirmCorrective,
  selectedTaskForPrint,
  setSelectedTaskForPrint,
  showSystemGeneralRoundModal,
  setShowSystemGeneralRoundModal,
  scopedTasks,
  machines,
  zones,
  technicians,
  availableInventory,
  techDisplayName,
  onMarkTaskDone,
  onCreateCorrective,
  showToast,
}: TabMainModalsProps) {
  return (
    <>
      {/* ========================================================================= */}
      {/* MODAL 1: VALIDATION DE TÂCHE AVEC CONSOMMATION PDR & RÉCURRENCE AUTO */}
      {/* ========================================================================= */}
      {selectedTaskForValidation && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 space-y-5 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-200 flex items-center justify-center text-emerald-700">
                  <CheckCircle2 className="w-5 h-5 text-emerald-700" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {isTechUser
                      ? "Déclaration d'Exécution Préventive (Terrain)"
                      : "Validation d'Intervention Préventive"}
                  </h3>
                  <div className="flex items-center gap-2 flex-wrap mt-0.5">
                    <p className="text-xs text-slate-400">
                      {selectedTaskForValidation.id_machine} • {selectedTaskForValidation.composant} ({selectedTaskForValidation.action_code})
                    </p>
                    {(selectedTaskForValidation.id_composant || selectedTaskForValidation.nom_composant) && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                        Composant: {selectedTaskForValidation.nom_composant || selectedTaskForValidation.id_composant}
                      </span>
                    )}
                    {(selectedTaskForValidation.id_part || selectedTaskForValidation.nom_part) && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-teal-50 text-teal-800 border border-teal-200">
                        Part: {selectedTaskForValidation.nom_part || selectedTaskForValidation.id_part}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedTaskForValidation(null)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {(selectedTaskForValidation.validation_status === 'NEEDS_CLARIFICATION' ||
              selectedTaskForValidation.validation_status === 'REJECTED') && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs space-y-1">
                <div className="font-black text-rose-900 uppercase flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>
                    {selectedTaskForValidation.validation_status === 'NEEDS_CLARIFICATION'
                      ? 'Clarification demandée par le responsable'
                      : 'Exécution rejetée par le responsable'}
                  </span>
                </div>
                {Boolean(selectedTaskForValidation.validation_note) && (
                  <p className="text-rose-800 font-medium">
                    Motif : « {String(selectedTaskForValidation.validation_note)} »
                  </p>
                )}
              </div>
            )}

            <form onSubmit={handleConfirmValidation} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Date Réalisation :</label>
                  <input
                    type="date"
                    required
                    value={validationData.date_realisation}
                    onChange={(e) => setValidationData({ ...validationData, date_realisation: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="flex items-center justify-between font-bold text-slate-700 uppercase mb-1">
                    <span>Technicien Réalisateur :</span>
                    <span className="font-mono text-[10px] text-emerald-700 font-black">
                      Taux MO : {Number(validationData.taux_horaire || 35)} DH/h
                    </span>
                  </label>
                  <input
                    type="text"
                    required
                    readOnly={isTechUser}
                    list="validation-modal-tech-list"
                    value={validationData.technicien}
                    onChange={(e) => {
                      if (!isTechUser) {
                        const nextTech = e.target.value;
                        const nextRate = resolvePreventiveLaborRate(technicians, nextTech);
                        setValidationData({
                          ...validationData,
                          technicien: nextTech,
                          taux_horaire: nextRate,
                        });
                      }
                    }}
                    placeholder="Choisir ou saisir le technicien exécutant..."
                    className={`w-full px-3 py-2 border rounded-xl ${
                      isTechUser
                        ? 'bg-purple-50/70 border-purple-200 text-purple-900 font-bold cursor-not-allowed'
                        : 'bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-emerald-500'
                    }`}
                  />
                  {!isTechUser && (
                    <datalist id="validation-modal-tech-list">
                      {(technicians || []).map((tech: ITechnician | string, idx: number) => {
                        const fullName =
                          typeof tech === 'string'
                            ? tech.trim()
                            : tech?.nom
                            ? `${tech.nom} ${tech.prenom || ''}`.trim()
                            : String(tech?.id_technician || '').trim();
                        if (!fullName) return null;
                        return <option key={idx} value={fullName} />;
                      })}
                    </datalist>
                  )}
                </div>
              </div>

              {/* Mode Récurrence & Durée */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Durée Réelle Passée :</label>
                  <input
                    type="text"
                    value={validationData.duree_reelle}
                    onChange={(e) => setValidationData({ ...validationData, duree_reelle: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Calcul de la prochaine échéance :</label>
                  <select
                    value={validationData.mode_calcul_recurrence}
                    onChange={(e) => setValidationData({ ...validationData, mode_calcul_recurrence: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
                  >
                    <option value="FIXE">Calendrier Fixe (Garde la semaine annuelle)</option>
                    <option value="GLISSANT">Glissant (Calculé à partir de la date réelle)</option>
                  </select>
                </div>
              </div>

              {/* Meter Reading Input for COMPTEUR / HYBRIDE tasks */}
              {(selectedTaskForValidation.type_declencheur === 'COMPTEUR' ||
                selectedTaskForValidation.type_declencheur === 'HYBRIDE' ||
                Number(selectedTaskForValidation.compteur_seuil_intervalle || 0) > 0) && (() => {
                const machCode = String(selectedTaskForValidation.id_machine || '').trim().toUpperCase();
                const matchedMach = (machines || []).find(
                  (m: any) =>
                    String(m.id_machine_registered || m.code_machine || m.id || '')
                      .trim()
                      .toUpperCase() === machCode
                );
                const liveMachineMeter = Number(
                  matchedMach?.compteur_heures ??
                    selectedTaskForValidation.compteur_actuel ??
                    selectedTaskForValidation.dernier_releve ??
                    0
                );
                const targetMeter = Number(
                  selectedTaskForValidation.compteur_prochain_declenchement || 0
                );
                const meterUnit = selectedTaskForValidation.compteur_unite || 'Heures';
                const enteredMeter = Number(validationData.compteur_releve || 0);
                const isLowerThanMachine =
                  String(validationData.compteur_releve ?? '').trim() !== '' &&
                  Number.isFinite(enteredMeter) &&
                  enteredMeter < liveMachineMeter;

                return (
                  <div className="p-3 rounded-2xl bg-cyan-50/70 border border-cyan-200 space-y-2 text-xs">
                    <div className="flex items-center justify-between flex-wrap gap-1.5">
                      <label className="font-black text-cyan-950 uppercase flex items-center gap-1.5">
                        <Gauge className="w-4 h-4 text-cyan-700" />
                        <span>Relevé Compteur à l&apos;exécution ({meterUnit}) :</span>
                      </label>
                      <span className="font-mono text-[10.5px] font-bold text-cyan-800">
                        Index actuel : {liveMachineMeter} {meterUnit}
                        {targetMeter > 0 ? ` · Seuil : ${targetMeter} ${meterUnit}` : ''}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-center">
                      <input
                        type="number"
                        min={0}
                        step="any"
                        placeholder={`Ex: ${Math.max(liveMachineMeter, targetMeter || liveMachineMeter)}`}
                        value={validationData.compteur_releve ?? ''}
                        onChange={(e) =>
                          setValidationData({
                            ...validationData,
                            compteur_releve: e.target.value,
                          })
                        }
                        className="w-full px-3 py-1.5 bg-white border border-cyan-300 rounded-xl font-mono font-bold text-slate-900 focus:ring-2 focus:ring-cyan-500"
                      />
                      <span className="text-[10.5px] text-cyan-900">
                        {Number(selectedTaskForValidation.compteur_seuil_intervalle || 0) > 0
                          ? `Prochain seuil après validation : ${
                              (Number(validationData.compteur_releve) || liveMachineMeter) +
                              Number(selectedTaskForValidation.compteur_seuil_intervalle)
                            } ${meterUnit}`
                          : 'Synchronise automatiquement le compteur machine.'}
                      </span>
                    </div>
                    {isLowerThanMachine && (
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1.5 rounded-xl">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          Attention : le relevé saisi ({enteredMeter}) est inférieur au compteur machine actuel ({liveMachineMeter} {meterUnit}).
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* P1: Organe / Composant (Cycle de vie) & Localisation Part Structurelle */}
              {(validationMachineComponents.length > 0 ||
                validationMachineParts.length > 0 ||
                validationData.id_composant ||
                validationData.id_part) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 uppercase mb-1">
                      Organe / Composant rattaché (Carnet de vie) :
                    </label>
                    <select
                      value={validationData.id_composant || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        const found = validationMachineComponents.find(
                          (c) => String(c.id_warehouse_item || c.id) === val
                        );
                        setValidationData({
                          ...validationData,
                          id_composant: val,
                          nom_composant: found
                            ? String(found.designation || found.nom_composant || found.nom || val)
                            : '',
                        });
                      }}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl font-medium text-slate-800"
                    >
                      <option value="">-- Machine entière / Sans composant spécifique --</option>
                      {validationMachineComponents.map((c) => {
                        const cId = String(c.id_warehouse_item || c.id || '');
                        const cName = String(c.designation || c.nom_composant || c.nom || cId);
                        return (
                          <option key={cId} value={cId}>
                            {cId} · {cName}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 uppercase mb-1">
                      Part / Localisation Structurelle (Sans déstockage) :
                    </label>
                    <select
                      value={validationData.id_part || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        const found = validationMachineParts.find(
                          (p) => String(p.id_warehouse_item || p.id) === val
                        );
                        setValidationData({
                          ...validationData,
                          id_part: val,
                          nom_part: found
                            ? String(found.designation_part || found.designation || found.nom || val)
                            : '',
                        });
                      }}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl font-medium text-slate-800"
                    >
                      <option value="">-- Aucune localisation structurelle --</option>
                      {validationMachineParts.map((p) => {
                        const pId = String(p.id_warehouse_item || p.id || '');
                        const pName = String(p.designation_part || p.designation || p.nom || pId);
                        return (
                          <option key={pId} value={pId}>
                            {pId} · {pName}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
              )}

              {/* PDR Consumables Section */}
              <div className="bg-indigo-50/50 border border-indigo-200/70 rounded-2xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5 uppercase">
                    <Package className="w-4 h-4 text-indigo-600" />
                    <span>
                      {isTechUser
                        ? 'Pièces proposées (Déclaration terrain · Sans déstockage immédiat)'
                        : 'Pièces de rechange & consommables utilisés (Stock PDR · Tri BOM)'}
                    </span>
                  </span>
                  <span className="text-[11px] font-mono text-indigo-700 font-bold">
                    {validationData.usedPDR.length} pièce(s)
                  </span>
                </div>

                {/* Used PDR Items list */}
                {validationData.usedPDR.length > 0 && (
                  <div className="space-y-1 max-h-36 overflow-y-auto">
                    {validationData.usedPDR.map((pdr: TabMainPdrDraftItem, idx: number) => {
                      const matchedInv = rankedValidationInventory.find(
                        (i) =>
                          String(i.reference || i.ref || '').trim().toLowerCase() ===
                          String(pdr.reference || pdr.ref || '').trim().toLowerCase()
                      );
                      const availStock =
                        matchedInv !== undefined ? Number(matchedInv.stockActuel ?? 0) : null;
                      const isShort = availStock !== null && Number(pdr.quantite || 1) > availStock;

                      return (
                        <div
                          key={idx}
                          className={`bg-white p-2 rounded-xl border flex items-center justify-between gap-2 text-xs ${
                            isShort ? 'border-rose-300 bg-rose-50/40' : 'border-indigo-100'
                          }`}
                        >
                          <div className="min-w-0">
                            <span className="font-bold text-slate-800">{pdr.designation}</span>
                            <span className="text-[11px] text-slate-400 font-mono ml-2">
                              Réf: {pdr.reference} • Qte: {pdr.quantite} {pdr.unite}
                            </span>
                            {isShort && (
                              <span className="ml-2 inline-flex items-center gap-0.5 text-[10px] font-bold text-rose-700">
                                <AlertTriangle className="w-3 h-3" /> Stock dispo: {availStock}
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemovePdrFromValidation(idx)}
                            className="text-rose-500 hover:text-rose-700 p-1 shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Add Quick PDR from BOM-ranked inventory dropdown with Quantity & Stock Check */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-2 border-t border-indigo-100 text-xs">
                  <div className="sm:col-span-6">
                    <select
                      value={newPdrItem.reference}
                      onChange={(e) => {
                        const it = rankedValidationInventory.find(
                          (i) => i.reference === e.target.value || i.ref === e.target.value
                        );
                        if (it) {
                          const refCode = String(it.reference || it.ref || '');
                          setNewPdrItem({
                            id_article: String(it.id_article || `PDR-${refCode}`),
                            designation: it.designation,
                            reference: refCode,
                            quantite: Math.max(1, Number(newPdrItem.quantite || 1)),
                            unite: String(it.unite || 'pcs'),
                            prix_unitaire: Number(it.prix_unitaire || 0),
                            source: it.source,
                          });
                        } else {
                          setNewPdrItem({
                            id_article: '',
                            designation: '',
                            reference: '',
                            quantite: 1,
                            unite: 'Pièce',
                            prix_unitaire: 0,
                          });
                        }
                      }}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-800 font-medium"
                    >
                      <option value="">Sélectionner une pièce consommable (Stock PDR Magasin)...</option>
                      {rankedValidationInventory.map((item, idx) => (
                        <option key={idx} value={item.reference || item.ref}>
                          {item.isBomRecommended ? `★ [${item.bomSourceLabel}] ` : `[${item.source || 'STOCK'}] `}
                          {item.reference || item.ref} - {item.designation} (Stock: {item.stockActuel ?? 0})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <input
                      type="number"
                      min={1}
                      value={newPdrItem.quantite || 1}
                      onChange={(e) =>
                        setNewPdrItem({
                          ...newPdrItem,
                          quantite: Math.max(1, Number(e.target.value || 1)),
                        })
                      }
                      aria-label="Quantité PDR"
                      title="Quantité à consommer"
                      className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-xl font-mono font-bold text-center text-slate-800"
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <button
                      type="button"
                      onClick={() => handleAddPdrToValidation(newPdrItem)}
                      disabled={!newPdrItem.reference || !newPdrItem.designation}
                      className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl cursor-pointer"
                    >
                      + Ajouter PDR
                    </button>
                  </div>
                </div>

                {/* Optional N° Bon Magasin for field traceability */}
                <div className="pt-2 border-t border-indigo-100/80 grid grid-cols-1 sm:grid-cols-2 gap-2 items-center text-xs">
                  <label className="font-bold text-indigo-900">
                    N° Bon Magasin (Optionnel · Terrain) :
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: BS-2026-042"
                    value={validationData.num_bon_saisi_par_tech || ''}
                    onChange={(e) => {
                      const nextBon = e.target.value;
                      const rec = reconcileFieldClaim({
                        claimType: 'PREVENTIVE',
                        claimId: String(selectedTaskForValidation?.id || ''),
                        numBonSaisi: nextBon,
                        machineCode: selectedTaskForValidation?.id_machine,
                        proposedSpares: (validationData.usedPDR || []).map((p: TabMainPdrDraftItem) => ({
                          ref: p.reference || p.ref,
                          designation: p.designation,
                          qty: p.quantite || p.qty,
                        })),
                        stockItems,
                        mouvements: storeMouvements,
                        correctiveInterventions: storeCorrectiveInterventions,
                        preventiveExecutions: executions,
                        sortieDemands: storeSortieDemands,
                      });
                      setValidationData({
                        ...validationData,
                        num_bon_saisi_par_tech: nextBon,
                        skipStockDeduction: Boolean(rec?.exactMovementMatch),
                      });
                    }}
                    className="w-full px-2.5 py-1.5 bg-white border border-indigo-200 rounded-xl font-mono text-slate-800"
                  />
                </div>

                {!isTechUser && validationData.usedPDR.length > 0 && (
                  <label className="flex items-start gap-2 pt-2 border-t border-indigo-200/70 text-[11px] text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={Boolean(validationData.skipStockDeduction)}
                      onChange={(e) =>
                        setValidationData({
                          ...validationData,
                          skipStockDeduction: e.target.checked,
                        })
                      }
                      className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>
                      <strong className="font-bold text-slate-900">
                        ✅ Bon de sortie déjà déstocké au magasin
                      </strong>{' '}
                      — Imputer le coût PDR sur la machine sans créer de 2e mouvement de stock.
                    </span>
                  </label>
                )}
              </div>

              {/* Observations */}
              <div className="text-xs">
                <label className="block font-bold text-slate-700 uppercase mb-1">Compte-rendu &amp; Observations :</label>
                <textarea
                  rows={3}
                  value={validationData.observations}
                  onChange={(e) => {
                    const nextObs = e.target.value;
                    const hasAnom = hasPreventiveExecutionAnomaly({ notes: nextObs });
                    setValidationData({
                      ...validationData,
                      observations: nextObs,
                      ...(hasAnom && !validationData.createFollowUpDi
                        ? { createFollowUpDi: true, followUpDiAnomalie: nextObs }
                        : {}),
                    });
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {!isTechUser ? (
                <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-2 text-xs">
                  <label className="flex items-start gap-2 text-amber-950 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={Boolean(validationData.createFollowUpDi)}
                      onChange={(e) =>
                        setValidationData({
                          ...validationData,
                          createFollowUpDi: e.target.checked,
                          followUpDiAnomalie:
                            validationData.followUpDiAnomalie || validationData.observations || '',
                        })
                      }
                      className="mt-0.5 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                    />
                    <span>
                      <strong className="font-black">
                        Créer une DI corrective de suivi (Auto-DI sur anomalie préventive)
                      </strong>{' '}
                      — Génère automatiquement une Demande d&apos;Intervention liée à{' '}
                      <code className="font-mono font-bold">{selectedTaskForValidation.id_machine}</code>.
                    </span>
                  </label>
                  {validationData.createFollowUpDi && (
                    <input
                      type="text"
                      value={validationData.followUpDiAnomalie || ''}
                      onChange={(e) =>
                        setValidationData({
                          ...validationData,
                          followUpDiAnomalie: e.target.value,
                        })
                      }
                      placeholder="Description de l'anomalie corrective..."
                      className="w-full rounded-xl border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900"
                    />
                  )}
                </div>
              ) : (
                <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-2 text-xs">
                  <label className="flex items-start gap-2 text-amber-950 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={Boolean(validationData.createFollowUpDi)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        const currentObs = String(validationData.observations || '');
                        const hasTag = currentObs.toUpperCase().includes('[ANOMALIE');
                        setValidationData({
                          ...validationData,
                          createFollowUpDi: checked,
                          observations:
                            checked && !hasTag
                              ? `[ANOMALIE DÉTECTÉE] ${currentObs}`
                              : currentObs,
                          followUpDiAnomalie:
                            validationData.followUpDiAnomalie || currentObs || '',
                        });
                      }}
                      className="mt-0.5 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                    />
                    <span>
                      <strong className="font-black">
                        Signaler une anomalie pour DI corrective (Revue Responsable)
                      </strong>{' '}
                      — Pré-alerte le responsable pour ouvrir une DI sur{' '}
                      <code className="font-mono font-bold">{selectedTaskForValidation.id_machine}</code> lors de la validation.
                    </span>
                  </label>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedTaskForValidation(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2 text-xs font-black text-white rounded-xl shadow-xs cursor-pointer ${
                    isTechUser
                      ? 'bg-purple-600 hover:bg-purple-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {isTechUser
                    ? 'Soumettre pour Validation Responsable (Sans déstockage)'
                    : 'Confirmer la Réalisation & Auto-Reprogrammer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: DÉCLENCHEMENT BON DE TRAVAIL CORRECTIF SUITE À ANOMALIE */}
      {/* ========================================================================= */}
      {selectedTaskForBT && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-200 flex items-center justify-center text-amber-700">
                  <AlertTriangle className="w-5 h-5 text-amber-700" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Déclencher un Bon de Travail (BT)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Anomalie sur {selectedTaskForBT.id_machine} • {selectedTaskForBT.composant}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedTaskForBT(null)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmCorrective} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Description de l&apos;Anomalie :</label>
                <textarea
                  required
                  rows={4}
                  value={btData.description}
                  onChange={(e) => setBtData({ ...btData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500 font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Niveau de Priorité :</label>
                <select
                  value={btData.priorite}
                  onChange={(e) => setBtData({ ...btData, priorite: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
                >
                  <option value="Urgente">Urgente (Arrêt Machine)</option>
                  <option value="Haute">Haute</option>
                  <option value="Normale">Normale</option>
                  <option value="Basse">Basse</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedTaskForBT(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-black bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-xs"
                >
                  Créer le BT Correctif
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: IMPRESSION BON D'ORDRE DE TRAVAIL (OT) */}
      {/* ========================================================================= */}
      {selectedTaskForPrint && (
        <PrintWorkOrderModal
          task={selectedTaskForPrint}
          onClose={() => setSelectedTaskForPrint(null)}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: MODE RONDE — INSPECTION GROUPÉE SYSTÈME GÉNÉRAL */}
      {/* ========================================================================= */}
      <SystemGeneralRoundModal
        isOpen={showSystemGeneralRoundModal}
        onClose={() => setShowSystemGeneralRoundModal(false)}
        tasks={scopedTasks}
        machines={machines}
        zones={zones}
        technicians={technicians}
        stockItems={availableInventory}
        isTechUser={isTechUser}
        defaultTechName={techDisplayName}
        onMarkTaskDone={onMarkTaskDone}
        onCreateCorrective={onCreateCorrective}
        showToast={showToast}
      />
    </>
  );
}
