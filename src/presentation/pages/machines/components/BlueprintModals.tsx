import React from 'react';
import {
  FingerprintPattern,
  Info,
  Wrench,
  Calendar,
  AlertTriangle,
  X,
  Zap,
  Sparkles,
  CheckCircle2,
  Clock,
  Plus,
  Calculator,
} from 'lucide-react';
import SequentialCodePicker from '../../../components/common/SequentialCodePicker';
import { CubeIcon } from '../../../components/common/icons/CubeIcon';
import { LayersIcon } from '../../../components/common/icons/LayersIcon';
import {
  BlueprintPreventivePlanItem,
  BlueprintCommonFailureItem,
  BlueprintPdrItem,
} from '../../../../core/domain';
import { filterActiveMachines } from '../../../../utils/activeMachines';
import {
  BlueprintRecord,
  BlueprintComponentItem,
  BlueprintPartItem,
  BlueprintPreventiveDraft,
  BlueprintCommonFailureDraft,
  BlueprintApplyFeedback,
  BlueprintMachineRow,
  BlueprintPreventiveActionOption,
  BlueprintStockItemOption,
} from './BlueprintInspectModal';

export interface BlueprintFamilyOption {
  id_family: string;
  label_family?: string;
  libelle?: string;
}

export interface BlueprintTemplateOption {
  id_templates: string;
  id_family?: string;
  label_templates?: string;
  libelle?: string;
}

export interface BlueprintCompTemplateOption {
  id_comp_template: string;
  label_comp_template?: string;
  libelle?: string;
}

export interface BlueprintPartTypeOption {
  id_part_type: string;
  label_part_type?: string;
  libelle?: string;
}

export interface BlueprintPartDesignationOption {
  id_part_designation: string;
  label_part_designation?: string;
  label_part_type?: string;
}

const STATUS_OPTIONS = [
  { value: 'Approuvé', label: 'Approuvé' },
  { value: 'En Révision', label: 'En Révision' },
  { value: 'Archivé', label: 'Archivé' },
];

export interface BlueprintFormModalProps {
  showAddModal: boolean;
  toEdit: BlueprintRecord | null;
  setToEdit: React.Dispatch<React.SetStateAction<BlueprintRecord | null>>;
  form: BlueprintRecord;
  setForm: React.Dispatch<React.SetStateAction<BlueprintRecord>>;
  handleCloseModal: () => void;
  activeModalTab: string;
  setActiveModalTab: (tab: string) => void;
  setApplyFeedback: React.Dispatch<React.SetStateAction<BlueprintApplyFeedback | null>>;
  applyFeedback: BlueprintApplyFeedback | null;
  handleAddSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  handleEditSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  autoNextBlueprintId: string;
  takenBlueprintNumbers: Set<number>;
  families: BlueprintFamilyOption[];
  templates: BlueprintTemplateOption[];
  modalTemplates: BlueprintTemplateOption[];
  editModalTemplates: BlueprintTemplateOption[];
  compTemplates: BlueprintCompTemplateOption[];
  partTypes: BlueprintPartTypeOption[];
  partDesignations: BlueprintPartDesignationOption[];
  machines: BlueprintMachineRow[];
  stockItems: BlueprintStockItemOption[];
  preventiveActions: BlueprintPreventiveActionOption[];
  newCompItem: BlueprintComponentItem;
  setNewCompItem: React.Dispatch<React.SetStateAction<BlueprintComponentItem>>;
  newPartItem: BlueprintPartItem;
  setNewPartItem: React.Dispatch<React.SetStateAction<BlueprintPartItem>>;
  newPdrItem: BlueprintPdrItem;
  setNewPdrItem: React.Dispatch<React.SetStateAction<BlueprintPdrItem>>;
  newPreventiveItem: BlueprintPreventiveDraft;
  setNewPreventiveItem: React.Dispatch<React.SetStateAction<BlueprintPreventiveDraft>>;
  newCommonFailureItem: BlueprintCommonFailureDraft;
  setNewCommonFailureItem: React.Dispatch<React.SetStateAction<BlueprintCommonFailureDraft>>;
  handleExtractFromMachineHistory: (machineCode?: string, target?: 'add' | 'edit') => void;
  handleTriggerApplyPreventivePlan: (bp: BlueprintRecord) => void;
}

export function BlueprintFormModal({
  showAddModal,
  toEdit,
  setToEdit,
  form,
  setForm,
  handleCloseModal,
  activeModalTab,
  setActiveModalTab,
  setApplyFeedback,
  applyFeedback,
  handleAddSubmit,
  handleEditSubmit,
  autoNextBlueprintId,
  takenBlueprintNumbers,
  families,
  templates,
  modalTemplates,
  editModalTemplates,
  compTemplates,
  partTypes,
  partDesignations,
  machines,
  stockItems,
  preventiveActions,
  newCompItem,
  setNewCompItem,
  newPartItem,
  setNewPartItem,
  newPdrItem,
  setNewPdrItem,
  newPreventiveItem,
  setNewPreventiveItem,
  newCommonFailureItem,
  setNewCommonFailureItem,
  handleExtractFromMachineHistory,
  handleTriggerApplyPreventivePlan,
}: BlueprintFormModalProps) {
  if (!showAddModal && !toEdit) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center font-bold">
              <FingerprintPattern className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                {toEdit ? `Modifier Blueprint : ${toEdit.id_blueprint}` : 'Nouveau Blueprint (BOM 4-Tabs)'}
              </h3>
              <p className="text-xs text-slate-500">
                Nomenclature technique complète liant modèle d&apos;usine et composants réels.
              </p>
            </div>
          </div>
          <button
            onClick={handleCloseModal}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 6 Tabs Bar */}
        <div className="flex items-center gap-2 px-5 pt-3 border-b border-slate-200 bg-white overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveModalTab('specs')}
            className={`pb-2.5 px-3 text-xs font-bold flex items-center gap-2 border-b-2 transition ${
              activeModalTab === 'specs'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Info className="w-3.5 h-3.5" />
            <span>1. Infos & Spécifications (Loi)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveModalTab('components')}
            className={`pb-2.5 px-3 text-xs font-bold flex items-center gap-2 border-b-2 transition ${
              activeModalTab === 'components'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <CubeIcon className="w-3.5 h-3.5 text-emerald-600" />
            <span>
              2. Composants ({toEdit ? toEdit.components_theoriques?.length || 0 : form.components_theoriques?.length || 0})
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveModalTab('parts')}
            className={`pb-2.5 px-3 text-xs font-bold flex items-center gap-2 border-b-2 transition ${
              activeModalTab === 'parts'
                ? 'border-purple-600 text-purple-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <LayersIcon className="w-3.5 h-3.5 text-purple-600" />
            <span>
              3. Pièces & Visserie ({toEdit ? toEdit.parts_theoriques?.length || 0 : form.parts_theoriques?.length || 0})
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveModalTab('pdr')}
            className={`pb-2.5 px-3 text-xs font-bold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
              activeModalTab === 'pdr'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Wrench className="w-3.5 h-3.5 text-blue-600" />
            <span>
              4. PDR Consommables ({toEdit ? toEdit.pdr_theoriques?.length || 0 : form.pdr_theoriques?.length || 0})
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setApplyFeedback(null);
              setActiveModalTab('preventive');
            }}
            className={`pb-2.5 px-3 text-xs font-bold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
              activeModalTab === 'preventive'
                ? 'border-teal-600 text-teal-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-teal-600" />
            <span>
              5. Plan préventif du blueprint ({toEdit ? toEdit.preventivePlanItems?.length || 0 : form.preventivePlanItems?.length || 0})
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveModalTab('failures');
            }}
            className={`pb-2.5 px-3 text-xs font-bold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
              activeModalTab === 'failures'
                ? 'border-amber-600 text-amber-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span>
              6. Pannes fréquentes (DI) ({toEdit ? toEdit.commonFailures?.length || 0 : form.commonFailures?.length || 0})
            </span>
          </button>
        </div>

        <form onSubmit={toEdit ? handleEditSubmit : handleAddSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="p-5 overflow-y-auto flex-1 space-y-4 text-xs">
            {/* TAB 1: Specs */}
            {activeModalTab === 'specs' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Code Blueprint with SequentialCodePicker */}
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Code Blueprint (Auto / Unique)</label>
                    <SequentialCodePicker
                      prefix="BPT-"
                      currentCode={toEdit ? toEdit.id_blueprint : form.id_blueprint}
                      onChangeCode={(code: string) => {
                        if (toEdit) setToEdit({ ...toEdit, id_blueprint: code });
                        else setForm({ ...form, id_blueprint: code });
                      }}
                      autoGeneratedCode={autoNextBlueprintId}
                      takenNumbers={takenBlueprintNumbers}
                      disabled={!!toEdit}
                    />
                  </div>

                  {/* Libellé */}
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Libellé du Schéma / Plan *</label>
                    <input
                      type="text"
                      required
                      value={(toEdit ? toEdit.libelle : form.libelle) || ''}
                      onChange={(e) => {
                        if (toEdit) setToEdit({ ...toEdit, libelle: e.target.value });
                        else setForm({ ...form, libelle: e.target.value });
                      }}
                      placeholder="Ex: Plan Poupée Fixe & Broche"
                      className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Family Selection */}
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Famille Technologique *</label>
                    <select
                      value={(toEdit ? toEdit.id_family : form.id_family) || ''}
                      onChange={(e) => {
                        const newFam = e.target.value;
                        const tpls = templates.filter((t) => t.id_family === newFam);
                        const firstTpl = tpls[0]?.id_templates || '';
                        if (toEdit) {
                          setToEdit({ ...toEdit, id_family: newFam, id_templates: firstTpl });
                        } else {
                          setForm({ ...form, id_family: newFam, id_templates: firstTpl });
                        }
                      }}
                      className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
                    >
                      {families.length === 0 ? (
                        <option value="" disabled>
                          Aucune famille enregistrée
                        </option>
                      ) : (
                        families.map((f, idx) => (
                          <option key={`modal-fam-${f.id_family || idx}-${idx}`} value={f.id_family}>
                            {f.id_family} • {f.label_family || f.libelle}
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  {/* Template Selection */}
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Modèle Template de Base *</label>
                    <select
                      value={(toEdit ? toEdit.id_templates : form.id_templates) || ''}
                      onChange={(e) => {
                        if (toEdit) setToEdit({ ...toEdit, id_templates: e.target.value });
                        else setForm({ ...form, id_templates: e.target.value });
                      }}
                      className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
                    >
                      {(toEdit ? editModalTemplates : modalTemplates).length === 0 ? (
                        <option value="" disabled>
                          Aucun modèle enregistré pour cette famille
                        </option>
                      ) : (
                        (toEdit ? editModalTemplates : modalTemplates).map((t, idx) => (
                          <option key={`modal-tpl-${t.id_templates || idx}-${idx}`} value={t.id_templates}>
                            {t.id_templates} • {t.label_templates || t.libelle}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Ref Plan */}
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Réf Plan Dessin / DWG</label>
                    <input
                      type="text"
                      value={(toEdit ? toEdit.ref_plan : form.ref_plan) || ''}
                      onChange={(e) => {
                        if (toEdit) setToEdit({ ...toEdit, ref_plan: e.target.value });
                        else setForm({ ...form, ref_plan: e.target.value });
                      }}
                      placeholder="DWG-TR-001"
                      className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </div>

                  {/* Revision */}
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Révision</label>
                    <input
                      type="text"
                      value={(toEdit ? toEdit.revision : form.revision) || ''}
                      onChange={(e) => {
                        if (toEdit) setToEdit({ ...toEdit, revision: e.target.value });
                        else setForm({ ...form, revision: e.target.value });
                      }}
                      placeholder="Rev-A"
                      className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </div>

                  {/* Statut */}
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Statut</label>
                    <select
                      value={(toEdit ? toEdit.statut : form.statut) || 'Approuvé'}
                      onChange={(e) => {
                        if (toEdit) setToEdit({ ...toEdit, statut: e.target.value });
                        else setForm({ ...form, statut: e.target.value });
                      }}
                      className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900"
                    >
                      {STATUS_OPTIONS.map((st, idx) => (
                        <option key={`status-opt-${st.value}-${idx}`} value={st.value}>
                          {st.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Technical Specs box */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-indigo-600" />
                    <span>Paramètres & Spécifications Physiques (Puissance, Course, Moteur)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-500 font-medium mb-1">Puissance / Tonnage</label>
                      <input
                        type="text"
                        value={toEdit ? toEdit.specs?.puissance || '' : form.specs?.puissance || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (toEdit) setToEdit({ ...toEdit, specs: { ...toEdit.specs, puissance: val } });
                          else setForm({ ...form, specs: { ...form.specs, puissance: val } });
                        }}
                        placeholder="Ex: 200 Tonnes / 7.5 kW"
                        className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 font-medium mb-1">Course / Déplacement</label>
                      <input
                        type="text"
                        value={toEdit ? toEdit.specs?.course || '' : form.specs?.course || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (toEdit) setToEdit({ ...toEdit, specs: { ...toEdit.specs, course: val } });
                          else setForm({ ...form, specs: { ...form.specs, course: val } });
                        }}
                        placeholder="Ex: 850 mm"
                        className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: Components (Warehouse) */}
            {activeModalTab === 'components' && (
              <div className="space-y-4">
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="text-emerald-900 font-semibold text-xs">
                    Ajoutez les sous-ensembles constructeur issus des modèles de composants d&apos;entrepôt :
                  </div>
                </div>

                {/* Quick Add Row */}
                <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <select
                    value={newCompItem.id_component}
                    onChange={(e) => {
                      const id = e.target.value;
                      const found = compTemplates.find((ct) => ct.id_comp_template === id);
                      setNewCompItem({
                        id_component: id,
                        libelle: found?.label_comp_template || id,
                        qte: 1,
                      });
                    }}
                    className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs flex-1"
                  >
                    <option value="">Sélectionner un composant...</option>
                    {compTemplates.map((ct, idx) => (
                      <option key={`comp-tpl-${ct.id_comp_template || idx}-${idx}`} value={ct.id_comp_template}>
                        {ct.id_comp_template} • {ct.label_comp_template || ct.libelle}
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    min="1"
                    value={newCompItem.qte ?? 1}
                    onChange={(e) => setNewCompItem({ ...newCompItem, qte: Number(e.target.value) || 1 })}
                    placeholder="Qté"
                    className="h-8 w-16 px-2 text-center rounded-lg border border-slate-200 bg-white text-xs font-mono font-bold"
                  />

                  <button
                    type="button"
                    onClick={() => {
                      if (!newCompItem.id_component) return;
                      const item = { ...newCompItem };
                      if (toEdit) {
                        setToEdit({
                          ...toEdit,
                          components_theoriques: [...(toEdit.components_theoriques || []), item],
                        });
                      } else {
                        setForm({
                          ...form,
                          components_theoriques: [...(form.components_theoriques || []), item],
                        });
                      }
                      setNewCompItem({ id_component: '', libelle: '', qte: 1 });
                    }}
                    className="h-8 px-3 rounded-lg bg-emerald-600 text-white font-semibold text-xs hover:bg-emerald-700 transition"
                  >
                    Ajouter
                  </button>
                </div>

                {/* List */}
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                  {(toEdit ? toEdit.components_theoriques : form.components_theoriques)?.map((c, idx) => (
                    <div key={`form-comp-${c.id_component || idx}-${idx}`} className="p-2.5 flex items-center justify-between hover:bg-slate-50">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded text-[11px]">
                          {c.id_component}
                        </span>
                        <span className="font-semibold text-slate-800">{c.libelle}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-700">Qté: {c.qte}</span>
                        <button
                          type="button"
                          onClick={() => {
                            if (toEdit) {
                              setToEdit({
                                ...toEdit,
                                components_theoriques: (toEdit.components_theoriques || []).filter((_, i) => i !== idx),
                              });
                            } else {
                              setForm({
                                ...form,
                                components_theoriques: (form.components_theoriques || []).filter((_, i) => i !== idx),
                              });
                            }
                          }}
                          className="p-1 rounded text-rose-500 hover:bg-rose-50"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 3: Parts (Warehouse) */}
            {activeModalTab === 'parts' && (
              <div className="space-y-4">
                <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="text-purple-900 font-semibold text-xs">
                    Ajoutez la visserie et les pièces de structure d&apos;entrepôt :
                  </div>
                </div>

                {/* Quick Add Row */}
                <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <select
                    value={newPartItem.id_part}
                    onChange={(e) => {
                      const id = e.target.value;
                      const foundDes = partDesignations.find((pd) => pd.id_part_designation === id);
                      const foundType = partTypes.find((pt) => pt.id_part_type === id);
                      setNewPartItem({
                        id_part: id,
                        libelle:
                          foundDes?.label_part_designation ||
                          foundDes?.label_part_type ||
                          foundType?.label_part_type ||
                          foundType?.libelle ||
                          id,
                        qte: 1,
                      });
                    }}
                    className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs flex-1"
                  >
                    <option value="">Sélectionner une pièce...</option>
                    {partTypes.map((pt, idx) => (
                      <option key={`part-type-${pt.id_part_type || idx}-${idx}`} value={pt.id_part_type}>
                        {pt.id_part_type} • {pt.label_part_type || pt.libelle}
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    min="1"
                    value={newPartItem.qte ?? 1}
                    onChange={(e) => setNewPartItem({ ...newPartItem, qte: Number(e.target.value) || 1 })}
                    placeholder="Qté"
                    className="h-8 w-16 px-2 text-center rounded-lg border border-slate-200 bg-white text-xs font-mono font-bold"
                  />

                  <button
                    type="button"
                    onClick={() => {
                      if (!newPartItem.id_part) return;
                      const item = { ...newPartItem };
                      if (toEdit) {
                        setToEdit({
                          ...toEdit,
                          parts_theoriques: [...(toEdit.parts_theoriques || []), item],
                        });
                      } else {
                        setForm({
                          ...form,
                          parts_theoriques: [...(form.parts_theoriques || []), item],
                        });
                      }
                      setNewPartItem({ id_part: '', libelle: '', qte: 1 });
                    }}
                    className="h-8 px-3 rounded-lg bg-purple-600 text-white font-semibold text-xs hover:bg-purple-700 transition"
                  >
                    Ajouter
                  </button>
                </div>

                {/* List */}
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                  {(toEdit ? toEdit.parts_theoriques : form.parts_theoriques)?.map((p, idx) => (
                    <div key={`form-part-${p.id_part || idx}-${idx}`} className="p-2.5 flex items-center justify-between hover:bg-slate-50">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded text-[11px]">
                          {p.id_part}
                        </span>
                        <span className="font-semibold text-slate-800">{p.libelle}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-700">Qté: {p.qte}</span>
                        <button
                          type="button"
                          onClick={() => {
                            if (toEdit) {
                              setToEdit({
                                ...toEdit,
                                parts_theoriques: (toEdit.parts_theoriques || []).filter((_, i) => i !== idx),
                              });
                            } else {
                              setForm({
                                ...form,
                                parts_theoriques: (form.parts_theoriques || []).filter((_, i) => i !== idx),
                              });
                            }
                          }}
                          className="p-1 rounded text-rose-500 hover:bg-rose-50"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 4: PDR Consommables & Nexus Extraction */}
            {activeModalTab === 'pdr' && (
              <div className="space-y-4">
                {/* Nexus Extraction Tool Box */}
                <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="font-bold text-indigo-950 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      <span>Extraction Nexus (depuis l&apos;historique d&apos;une Machine)</span>
                    </div>
                    <div className="text-[11px] text-indigo-800 mt-0.5">
                      Remplissez automatiquement la liste des PDR à partir des mouvements réels d&apos;une machine.
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <select
                      id="nexus-mch-select"
                      disabled={filterActiveMachines(machines).length === 0}
                      className="h-8 px-2 rounded-lg border border-indigo-200 bg-white text-xs font-mono text-slate-800 disabled:opacity-50"
                    >
                      {filterActiveMachines(machines).length === 0 ? (
                        <option value="" disabled>
                          Aucune machine active enregistrée
                        </option>
                      ) : (
                        filterActiveMachines(machines).map((m, idx) => (
                          <option key={`nexus-mch-${m.id_machine_registered || idx}-${idx}`} value={m.id_machine_registered}>
                            {m.id_machine_registered}
                          </option>
                        ))
                      )}
                    </select>
                    <button
                      type="button"
                      disabled={filterActiveMachines(machines).length === 0}
                      onClick={() => {
                        const sel = (document.getElementById('nexus-mch-select') as HTMLSelectElement | null)?.value;
                        handleExtractFromMachineHistory(sel, toEdit ? 'edit' : 'add');
                      }}
                      className="h-8 px-3 rounded-lg bg-indigo-600 text-white font-semibold text-xs hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Extraire
                    </button>
                  </div>
                </div>

                {/* Manual PDR Add Row */}
                <div className="flex flex-wrap items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <select
                    value={newPdrItem.id_pdr}
                    onChange={(e) => {
                      const ref = e.target.value;
                      const found = stockItems.find((s) => s.ref === ref);
                      setNewPdrItem({
                        ...newPdrItem,
                        id_pdr: ref,
                        libelle: found?.designation || ref,
                      });
                    }}
                    className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs flex-1 min-w-[160px]"
                  >
                    <option value="">Sélectionner un article PDR...</option>
                    {stockItems.map((s, idx) => (
                      <option key={`pdr-stock-opt-${s.ref || s.id || idx}-${idx}`} value={s.ref}>
                        {s.ref} • {s.designation}
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    min="1"
                    value={newPdrItem.qte ?? 1}
                    onChange={(e) => setNewPdrItem({ ...newPdrItem, qte: Number(e.target.value) || 1 })}
                    placeholder="Qté"
                    className="h-8 w-16 px-2 text-center rounded-lg border border-slate-200 bg-white text-xs font-mono font-bold"
                  />

                  <select
                    value={newPdrItem.criticite || 'Haute'}
                    onChange={(e) => setNewPdrItem({ ...newPdrItem, criticite: e.target.value })}
                    className="h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-800"
                  >
                    <option value="Haute">Critique : Haute</option>
                    <option value="Moyenne">Critique : Moyenne</option>
                    <option value="Faible">Critique : Faible</option>
                  </select>

                  <select
                    value={newPdrItem.parent_component_key || ''}
                    onChange={(e) =>
                      setNewPdrItem({ ...newPdrItem, parent_component_key: e.target.value })
                    }
                    className="h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700"
                    title="Rattacher cette PDR à un Composant parent du Blueprint (BOM semi-hiérarchique)"
                  >
                    <option value="">Organe parent (Machine globale)</option>
                    {((toEdit ? toEdit.components_theoriques : form.components_theoriques) || []).map(
                      (c, idx) => {
                        const key = c.libelle || c.id_component || `comp-${idx}`;
                        return (
                          <option key={`pdr-parent-comp-${idx}`} value={key}>
                            Organe : {key}
                          </option>
                        );
                      }
                    )}
                  </select>

                  <button
                    type="button"
                    onClick={() => {
                      if (!newPdrItem.id_pdr) return;
                      const item: BlueprintPdrItem = {
                        ...newPdrItem,
                        ...(newPdrItem.parent_component_key
                          ? { parent_component_key: newPdrItem.parent_component_key }
                          : {}),
                      };
                      if (toEdit) {
                        setToEdit({
                          ...toEdit,
                          pdr_theoriques: [...(toEdit.pdr_theoriques || []), item],
                        });
                      } else {
                        setForm({
                          ...form,
                          pdr_theoriques: [...(form.pdr_theoriques || []), item],
                        });
                      }
                      setNewPdrItem({
                        id_pdr: '',
                        libelle: '',
                        qte: 1,
                        criticite: 'Haute',
                        parent_component_key: '',
                      });
                    }}
                    className="h-8 px-3 rounded-lg bg-blue-600 text-white font-semibold text-xs hover:bg-blue-700 transition"
                  >
                    Ajouter
                  </button>
                </div>

                {/* List */}
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                  {(toEdit ? toEdit.pdr_theoriques : form.pdr_theoriques)?.map((p, idx) => (
                    <div key={`form-pdr-${p.id_pdr || idx}-${idx}`} className="p-2.5 flex items-center justify-between hover:bg-slate-50">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded text-[11px]">
                          {p.id_pdr}
                        </span>
                        <span className="font-semibold text-slate-800">{p.libelle}</span>
                        {p.parent_component_key && (
                          <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono text-[10px] font-bold">
                            ↳ Organe: {p.parent_component_key}
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
                          {p.criticite || 'Moyenne'}
                        </span>
                        <span className="font-mono font-bold text-slate-700">Qté: {p.qte}</span>
                        <button
                          type="button"
                          onClick={() => {
                            if (toEdit) {
                              setToEdit({
                                ...toEdit,
                                pdr_theoriques: (toEdit.pdr_theoriques || []).filter((_, i) => i !== idx),
                              });
                            } else {
                              setForm({
                                ...form,
                                pdr_theoriques: (form.pdr_theoriques || []).filter((_, i) => i !== idx),
                              });
                            }
                          }}
                          className="p-1 rounded text-rose-500 hover:bg-rose-50"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 5: Plan préventif du blueprint */}
            {activeModalTab === 'preventive' && (() => {
              const targetObj = toEdit || form;
              const currentItems = Array.isArray(targetObj.preventivePlanItems)
                ? targetObj.preventivePlanItems
                : [];
              const activeLinkedMachines = filterActiveMachines(machines).filter(
                (m) => m.id_blueprint === targetObj.id_blueprint
              );
              return (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-xl bg-teal-50/80 border border-teal-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="font-bold text-teal-950 flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-teal-600" />
                        <span>Plan préventif du blueprint</span>
                      </div>
                      <div className="text-[11px] text-teal-800 mt-0.5">
                        Définissez les opérations préventives standards du modèle ({activeLinkedMachines.length} machine(s) active(s) liée(s)).
                      </div>
                    </div>

                    {toEdit && (
                      <button
                        type="button"
                        disabled={currentItems.length === 0 || activeLinkedMachines.length === 0}
                        onClick={() => handleTriggerApplyPreventivePlan(toEdit)}
                        className="h-8 px-3.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Appliquer aux machines actives liées ({activeLinkedMachines.length})</span>
                      </button>
                    )}
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

                  {/* Add Item Form */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                      <input
                        type="text"
                        list="bp-modal-comps-datalist"
                        value={newPreventiveItem.composant}
                        onChange={(e) => setNewPreventiveItem({ ...newPreventiveItem, composant: e.target.value })}
                        placeholder="Composant (ex: Broche, Courroie...)"
                        className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs sm:col-span-2"
                      />
                      <datalist id="bp-modal-comps-datalist">
                        {(targetObj.components_theoriques || []).map((c, idx) => (
                          <option key={`mod-dl-${idx}`} value={c.libelle || c.id_component} />
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
                          <option key={`mod-act-${act.code || idx}-${idx}`} value={act.code}>
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
                          <option key={`pm-pdr-opt-${s.ref || idx}-${idx}`} value={s.ref}>
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
                            component_ref:
                              compText !== 'Machine entière' ? compText : undefined,
                            action_code: newPreventiveItem.action_code || 'C',
                            frequence: newPreventiveItem.frequence || 'Mensuel',
                            duree_min: Number(newPreventiveItem.duree_min) || 15,
                            description: newPreventiveItem.description.trim(),
                            ...(newPreventiveItem.pdr_ref
                              ? { pdr_refs: [newPreventiveItem.pdr_ref] }
                              : {}),
                          };
                          if (toEdit) {
                            setToEdit({
                              ...toEdit,
                              preventivePlanItems: [...currentItems, item],
                            });
                          } else {
                            setForm({
                              ...form,
                              preventivePlanItems: [...currentItems, item],
                            });
                          }
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

                  {/* List */}
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                    {currentItems.length > 0 ? (
                      currentItems.map((item, idx) => (
                        <div
                          key={`form-pm-${item.id || idx}-${idx}`}
                          className="p-2.5 flex items-center justify-between hover:bg-slate-50 gap-2"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-bold text-teal-800 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200 text-[11px]">
                                {item.action_code || 'C'}
                              </span>
                              <span className="font-semibold text-slate-800">
                                {item.composant || 'Machine entière'}
                              </span>
                              <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold">
                                {item.frequence}
                              </span>
                              {Array.isArray(item.pdr_refs) && item.pdr_refs.length > 0 && (
                                <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-mono text-[10px] font-bold">
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
                              <p className="text-[11px] text-slate-500 mt-0.5 truncate">{item.description}</p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const nextItems = currentItems.filter((_, i) => i !== idx);
                              if (toEdit) {
                                setToEdit({
                                  ...toEdit,
                                  preventivePlanItems: nextItems,
                                });
                              } else {
                                setForm({
                                  ...form,
                                  preventivePlanItems: nextItems,
                                });
                              }
                            }}
                            className="p-1 rounded text-rose-500 hover:bg-rose-50 shrink-0"
                            title="Supprimer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="p-6 text-center text-slate-400">
                        Aucun élément préventif ajouté à ce Blueprint.
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* TAB 6: Pannes fréquentes du blueprint (DI Correctif) */}
            {activeModalTab === 'failures' && (() => {
              const targetObj = toEdit || form;
              const currentFailures = Array.isArray(targetObj.commonFailures)
                ? targetObj.commonFailures
                : [];
              return (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 flex items-center justify-between gap-3">
                    <div>
                      <div className="font-bold text-amber-950 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        <span>Pannes fréquentes du blueprint (Suggestions DI Correctif)</span>
                      </div>
                      <div className="text-[11px] text-amber-800 mt-0.5">
                        Définissez les pannes récurrentes et travaux recommandés pour pré-remplir les demandes d&apos;intervention (DI).
                      </div>
                    </div>
                  </div>

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
                          setNewCommonFailureItem({ ...newCommonFailureItem, urgence: e.target.value })
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
                          <option key={`mod-cf-pdr-${s.ref || idx}-${idx}`} value={s.ref}>
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
                          if (toEdit) {
                            setToEdit({
                              ...toEdit,
                              commonFailures: nextFailures,
                            });
                          } else {
                            setForm({
                              ...form,
                              commonFailures: nextFailures,
                            });
                          }
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

                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                    {currentFailures.length > 0 ? (
                      currentFailures.map((cf, idx) => (
                        <div
                          key={`form-cf-${cf.id || idx}-${idx}`}
                          className="p-2.5 flex items-center justify-between hover:bg-slate-50 gap-2"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 text-[11px]">
                                {cf.type_panne || 'M'}
                              </span>
                              <span className="font-semibold text-slate-800">{cf.title}</span>
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
                              <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                                {[cf.recommended_action, cf.description].filter(Boolean).join(' • ')}
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const nextFailures = currentFailures.filter((_, i) => i !== idx);
                              if (toEdit) {
                                setToEdit({
                                  ...toEdit,
                                  commonFailures: nextFailures,
                                });
                              } else {
                                setForm({
                                  ...form,
                                  commonFailures: nextFailures,
                                });
                              }
                            }}
                            className="p-1 rounded text-rose-500 hover:bg-rose-50 shrink-0"
                            title="Supprimer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="p-6 text-center text-slate-400">
                        Aucune panne fréquente ajoutée à ce Blueprint.
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Form Actions Footer */}
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
            <div className="text-[11px] text-slate-500">
              {activeModalTab !== 'preventive' ? 'Onglet suivant pour renseigner les pièces et le plan préventif' : 'Prêt à enregistrer'}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCloseModal}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 transition"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={
                  !(toEdit ? toEdit.id_family : form.id_family) ||
                  !(toEdit ? toEdit.id_templates : form.id_templates) ||
                  !(toEdit ? toEdit.libelle : form.libelle)?.trim()
                }
                className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out transition disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              >
                {toEdit ? 'Enregistrer Modifications' : 'Créer Blueprint BOM'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export interface BlueprintDeleteModalProps {
  toDelete: BlueprintRecord | null;
  setToDelete: React.Dispatch<React.SetStateAction<BlueprintRecord | null>>;
  blueprintMachineCountMap: Record<string, number>;
  onDeleteBlueprint: (id: string) => void;
}

export function BlueprintDeleteModal({
  toDelete,
  setToDelete,
  blueprintMachineCountMap,
  onDeleteBlueprint,
}: BlueprintDeleteModalProps) {
  if (!toDelete) return null;
  const linkedCount = blueprintMachineCountMap[toDelete.id_blueprint] || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-5 max-w-sm w-full space-y-4">
        <div className="flex items-center gap-3 text-rose-600">
          <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm">
              {linkedCount > 0 ? 'Suppression bloquée (Intégrité Référentielle)' : 'Supprimer ce Blueprint ?'}
            </h3>
            <div className="font-mono text-xs text-rose-600 font-bold">{toDelete.id_blueprint}</div>
          </div>
        </div>

        {linkedCount > 0 ? (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">
            Ce Blueprint est rattaché à <b>{linkedCount} machine(s)</b> du parc. Dissociez-le des machines concernées avant de pouvoir le supprimer afin d&apos;éviter des références orphelines.
          </p>
        ) : (
          <p className="text-xs text-slate-500">
            Cette action supprimera définitivement le schéma et la nomenclature (BOM) associée.
          </p>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            onClick={() => setToDelete(null)}
            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50"
          >
            {linkedCount > 0 ? 'Fermer' : 'Annuler'}
          </button>
          {linkedCount === 0 && (
            <button
              onClick={() => {
                onDeleteBlueprint(toDelete.id_blueprint);
                setToDelete(null);
              }}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out"
            >
              Confirmer Suppression
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export interface BlueprintFormulasModalProps {
  showFormulasModal: boolean;
  setShowFormulasModal: (show: boolean) => void;
}

export function BlueprintFormulasModal({
  showFormulasModal,
  setShowFormulasModal,
}: BlueprintFormulasModalProps) {
  if (!showFormulasModal) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden p-5 md:p-6 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base">Formules Excel — Blueprints Machines (BOM)</h3>
              <p className="text-xs text-slate-500">Formules miroir de l&apos;onglet Blueprint (Excel GMAO)</p>
            </div>
          </div>
          <button
            onClick={() => setShowFormulasModal(false)}
            className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3.5 max-h-[60vh] overflow-y-auto pr-1">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/90 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Formule C — Liaisons Clés (Famille & Template)</span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">LIAISON</span>
            </div>
            <div className="font-mono text-xs text-indigo-800 font-bold bg-white p-2 rounded-lg border border-indigo-100">
              =[@id_family] & [@id_templates]
            </div>
            <p className="text-[11px] text-slate-500">Rattachement hiérarchique direct du Blueprint aux tables parentes Familles et Templates.</p>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/90 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Formule D — Comptage Volets Nomenclature (BOM)</span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-teal-100 text-teal-800">COUNTA</span>
            </div>
            <div className="font-mono text-xs text-teal-800 font-bold bg-white p-2 rounded-lg border border-teal-100">
              =COUNTA(Specs) + COUNTA(Comps) + COUNTA(Parts) + COUNTA(PDR)
            </div>
            <p className="text-[11px] text-slate-500">Somme totale des éléments et spécifications documentés dans les 4 volets de la nomenclature.</p>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/90 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Formule E — Liaison Parc Machines Registered</span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">COUNTIF</span>
            </div>
            <div className="font-mono text-xs text-emerald-800 font-bold bg-white p-2 rounded-lg border border-emerald-100">
              =COUNTIF(Machines!G:G, [@id_blueprint])
            </div>
            <p className="text-[11px] text-slate-500">Nombre d&apos;équipements physiques dans le parc configurés avec ce Blueprint de référence.</p>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
          <span className="text-xs text-slate-400 font-medium">Modèle GMAO_Light_Template_V2</span>
          <button
            onClick={() => setShowFormulasModal(false)}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
