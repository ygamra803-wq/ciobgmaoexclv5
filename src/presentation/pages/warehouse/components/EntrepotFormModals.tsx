import React from 'react';
import { Plus, Layers, Edit2, Check, X, Zap } from 'lucide-react';
import { CubeIcon } from '../../../components/common/icons/CubeIcon';
import { LayersIcon } from '../../../components/common/icons/LayersIcon';
import { isComponentNature, isPartNature } from '../../../../core/domain/EntrepotItem';
import { filterProductionMachines, filterActiveMachines } from '../../../../utils/activeMachines';
import { MaterialPolicyTag } from '../../../../types/domain';

export interface EntrepotFormModalsProps {
  showAddModal: boolean;
  onCloseAddModal: () => void;
  addForm: Record<string, any>;
  setAddForm: React.Dispatch<React.SetStateAction<any>>;
  onSubmitAdd: (e: React.FormEvent) => void;
  onAddNatureSwitch: (newNature: string) => void;
  onAddFamilyChange: (newFam: string) => void;
  onAddFamilyPrefixChange: (newPrefix: string) => void;
  onAddTemplateChange: (newTpl: string) => void;
  onAddTypeChange: (newType: string) => void;
  onAddDiagChange: (newDiag: string) => void;
  onCascadeFamilyPrefixUpdate: (familyId: string, prefix: string) => void;

  toEdit: Record<string, any> | null;
  onCloseEditModal: () => void;
  editForm: Record<string, any>;
  setEditForm: React.Dispatch<React.SetStateAction<any>>;
  onSubmitEdit: (e: React.FormEvent) => void;

  families: any[];
  templates: any[];
  availableAddTemplates: any[];
  types: any[];
  diagnostics: any[];
  availableAddDiags: any[];
  familyComponentCodes: Record<string, string>;
  zones: any[];
  machines: any[];
  activeTechnicians: any[];
  t: (key: string) => string;
}

export const EntrepotFormModals: React.FC<EntrepotFormModalsProps> = ({
  showAddModal,
  onCloseAddModal,
  addForm,
  setAddForm,
  onSubmitAdd,
  onAddNatureSwitch,
  onAddFamilyChange,
  onAddFamilyPrefixChange,
  onAddTemplateChange,
  onAddTypeChange,
  onAddDiagChange,
  onCascadeFamilyPrefixUpdate,
  toEdit,
  onCloseEditModal,
  editForm,
  setEditForm,
  onSubmitEdit,
  families,
  templates,
  availableAddTemplates,
  types,
  diagnostics,
  availableAddDiags,
  familyComponentCodes,
  zones,
  machines,
  activeTechnicians,
  t,
}) => {
  return (
    <>
      {/* ADD MODAL (Dual Twin Architecture) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-white">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 font-bold">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    {t('entrepot.modal.add_component_title')}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {t('entrepot.modal.nature')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onCloseAddModal}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={onSubmitAdd} className="p-4 sm:p-5 space-y-4 text-xs">
              {/* Nature Selector (Dual Twin Toggle) */}
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1.5">
                  {t('entrepot.modal.nature')} *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => onAddNatureSwitch('COMPONENT')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                      isComponentNature(addForm.nature)
                        ? 'bg-blue-50 text-blue-700 border-blue-300 ring-2 ring-blue-500/20'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <CubeIcon className="w-3.5 h-3.5" />
                    <span>{t('entrepot.modal.nature_component')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onAddNatureSwitch('PART')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                      isPartNature(addForm.nature)
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-300 ring-2 ring-indigo-500/20'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <LayersIcon className="w-3.5 h-3.5" />
                    <span>{t('entrepot.modal.nature_part')}</span>
                  </button>
                </div>
              </div>

              {/* Code & Designation */}
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    {t('entrepot.modal.code_element')} *
                  </label>
                  <input
                    type="text"
                    value={addForm.id_warehouse_item}
                    onChange={(e) =>
                      setAddForm({ ...addForm, id_warehouse_item: e.target.value.toUpperCase() })
                    }
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:border-teal-500 outline-none"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    {t('entrepot.modal.designation')} *
                  </label>
                  <input
                    type="text"
                    value={addForm.designation}
                    onChange={(e) => setAddForm({ ...addForm, designation: e.target.value })}
                    placeholder="Ex: Moteur Triphasé 5.5kW"
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:border-teal-500 outline-none"
                    required
                  />
                </div>
              </div>

              {/* Dynamic Classification according to Nature */}
              {isComponentNature(addForm.nature) ? (
                <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 space-y-2.5">
                  <div className="text-[10px] font-bold text-blue-700 uppercase tracking-wider flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5" />
                      <span>{t('entrepot.modal.family')}</span>
                    </div>
                    {addForm.id_family && familyComponentCodes[addForm.id_family] ? (
                      <span className="px-2 py-0.5 rounded-md text-[9.5px] font-mono font-bold bg-blue-100 text-blue-800 border border-blue-200">
                        {familyComponentCodes[addForm.id_family]}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md text-[9.5px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                        Nouveau
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10.5px] font-semibold text-slate-700 block mb-1">
                        {t('entrepot.modal.family')} *
                      </label>
                      <select
                        value={addForm.id_family}
                        onChange={(e) => onAddFamilyChange(e.target.value)}
                        className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-medium focus:border-blue-500 outline-none"
                      >
                        {families.map((f) => (
                          <option key={f.id_family} value={f.id_family}>
                            {f.libelle} ({f.id_family})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10.5px] font-semibold text-slate-700 block mb-1">
                        {t('entrepot.modal.code_element')} *
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={addForm.family_prefix || ''}
                          onChange={(e) => onAddFamilyPrefixChange(e.target.value)}
                          placeholder="Ex: EXT, MOT, POM..."
                          className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-mono font-bold text-blue-900 focus:border-blue-500 outline-none uppercase"
                        />
                        {familyComponentCodes[addForm.id_family] && (
                          <span
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200"
                            title="OK"
                          >
                            ✓
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="text-[10.5px] font-semibold text-slate-700 block mb-1">
                        {t('entrepot.modal.template')}
                      </label>
                      <select
                        value={addForm.id_templates}
                        onChange={(e) => onAddTemplateChange(e.target.value)}
                        className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs focus:border-blue-500 outline-none"
                      >
                        <option value="">-- {t('entrepot.filters.all_templates')} --</option>
                        {availableAddTemplates.map((tObj) => (
                          <option key={tObj.id_templates} value={tObj.id_templates}>
                            {tObj.libelle}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="text-[10.5px] text-slate-500 bg-white/70 p-2 rounded-lg border border-blue-100/70 flex items-center justify-between gap-2 flex-wrap">
                    <span className="leading-tight">
                      Code auto-généré : <b className="text-blue-700 font-bold font-mono">{addForm.id_warehouse_item || '...'}</b>
                    </span>
                    {addForm.id_family && addForm.family_prefix && (
                      <button
                        type="button"
                        onClick={() => {
                          onCascadeFamilyPrefixUpdate(addForm.id_family, addForm.family_prefix);
                        }}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold text-blue-800 bg-blue-100 hover:bg-blue-200 border border-blue-300 transition cursor-pointer"
                      >
                        <Zap className="w-3 h-3 text-blue-600" />
                        <span>Mettre à jour</span>
                      </button>
                    )}
                  </div>

                  {/* Spécifications Plaque Signalétique & Mode Réparation (P3) */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1.5 border-t border-blue-200/60">
                    <div className="col-span-2 sm:col-span-1">
                      <label className="text-[10px] font-semibold text-slate-600 block mb-1">
                        Mode Réparation
                      </label>
                      <select
                        value={addForm.mode_reparation_defaut || 'NON_DEFINI'}
                        onChange={(e) => setAddForm({ ...addForm, mode_reparation_defaut: e.target.value })}
                        className="w-full h-8 px-1.5 rounded-lg border border-slate-200 bg-white text-[11px] font-semibold"
                      >
                        <option value="NON_DEFINI">Non défini</option>
                        <option value="REBOBINAGE_EXTERNE">Rebobinage Ext.</option>
                        <option value="REVISION_ATELIER">Révision Atelier</option>
                        <option value="ECHANGE_STANDARD">Échange Std.</option>
                        <option value="GARANTIE">Garantie</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 block mb-1">
                        Tension (U)
                      </label>
                      <input
                        type="text"
                        placeholder="230/400V"
                        value={addForm.tension_nominale || ''}
                        onChange={(e) => setAddForm({ ...addForm, tension_nominale: e.target.value })}
                        className="w-full h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 block mb-1">
                        Courant (A)
                      </label>
                      <input
                        type="text"
                        placeholder="8.8A"
                        value={addForm.courant_nominal_a || ''}
                        onChange={(e) => setAddForm({ ...addForm, courant_nominal_a: e.target.value })}
                        className="w-full h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 block mb-1">
                        Protection (IP)
                      </label>
                      <input
                        type="text"
                        placeholder="IP55"
                        value={addForm.indice_protection || ''}
                        onChange={(e) => setAddForm({ ...addForm, indice_protection: e.target.value })}
                        className="w-full h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 block mb-1">
                        Fixation
                      </label>
                      <input
                        type="text"
                        placeholder="B3, B5..."
                        value={addForm.type_fixation || ''}
                        onChange={(e) => setAddForm({ ...addForm, type_fixation: e.target.value })}
                        className="w-full h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 space-y-2.5">
                  <div className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <CubeIcon className="w-3.5 h-3.5" />
                      <span>{t('entrepot.modal.type')}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-md text-[9.5px] font-mono font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                      Réf: {addForm.id_warehouse_item || 'PART-01'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10.5px] font-semibold text-slate-700 block mb-1">
                        {t('entrepot.modal.type')} *
                      </label>
                      <select
                        value={addForm.id_type}
                        onChange={(e) => onAddTypeChange(e.target.value)}
                        className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs focus:border-indigo-500 outline-none font-semibold"
                      >
                        {types.map((tObj) => (
                          <option key={tObj.id_type} value={tObj.id_type}>
                            {tObj.libelle} ({tObj.id_type})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10.5px] font-semibold text-slate-700 block mb-1">
                        {t('entrepot.modal.diag')}
                      </label>
                      <select
                        value={addForm.id_diag}
                        onChange={(e) => onAddDiagChange(e.target.value)}
                        className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs focus:border-indigo-500 outline-none"
                      >
                        <option value="">-- {t('entrepot.modal.diag')} --</option>
                        {availableAddDiags.map((d) => {
                          const dId = d.id_part || d.ref || d.id_diag || d.id;
                          const dLabel = d.designation || d.libelle || dId;
                          return (
                            <option key={dId} value={dId}>
                              {dId} - {dLabel}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>
                  {/* Spécifications Atelier (P2 + P3): Matière, Plan, Brut, Traitement Thermique */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-indigo-200/60">
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 block mb-1">
                        Matière / Nuance
                      </label>
                      <input
                        type="text"
                        placeholder="ex: 42CrMo4"
                        value={addForm.matiere_nuance || ''}
                        onChange={(e) => setAddForm({ ...addForm, matiere_nuance: e.target.value })}
                        className="w-full h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 block mb-1">
                        Réf. Plan Usinage
                      </label>
                      <input
                        type="text"
                        placeholder="ex: PLN-MEC-204"
                        value={addForm.ref_plan || ''}
                        onChange={(e) => setAddForm({ ...addForm, ref_plan: e.target.value })}
                        className="w-full h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 block mb-1">
                        Dimensions Brut
                      </label>
                      <input
                        type="text"
                        placeholder="ex: Ø60 x 240 mm"
                        value={addForm.dimensions_brut || ''}
                        onChange={(e) => setAddForm({ ...addForm, dimensions_brut: e.target.value })}
                        className="w-full h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 block mb-1">
                        Traitement Thermique
                      </label>
                      <input
                        type="text"
                        placeholder="ex: Trempé 58 HRC"
                        value={addForm.traitement_thermique || ''}
                        onChange={(e) => setAddForm({ ...addForm, traitement_thermique: e.target.value })}
                        className="w-full h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Location & Rattachement */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    {t('entrepot.modal.rattachement')}
                  </label>
                  <select
                    value={addForm.rattachement_type}
                    onChange={(e) => {
                      const nextType = e.target.value;
                      setAddForm({
                        ...addForm,
                        rattachement_type: nextType,
                        id_zone:
                          nextType === 'ZONE'
                            ? addForm.id_zone || zones[0]?.id_zone || ''
                            : addForm.id_zone,
                      });
                    }}
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:border-teal-500 outline-none"
                  >
                    <option value="MACHINE">{t('entrepot.modal.machine')}</option>
                    <option value="ZONE">{t('entrepot.modal.zone')}</option>
                    <option value="ENTREPOT">{t('entrepot.modal.location')}</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">{t('entrepot.modal.status')}</label>
                  <select
                    value={addForm.status}
                    onChange={(e) => setAddForm({ ...addForm, status: e.target.value })}
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:border-teal-500 outline-none"
                  >
                    <option value="En stock (Disponible)">{t('entrepot.filters.in_stock')}</option>
                    <option value="En service">{t('entrepot.filters.in_service')}</option>
                    <option value="En révision / Externe">{t('entrepot.filters.under_revision')}</option>
                    <option value="Hors service">Hors Service</option>
                  </select>
                </div>
              </div>

              {addForm.rattachement_type === 'MACHINE' ? (
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    {t('entrepot.modal.machine')}
                  </label>
                  <select
                    value={addForm.id_machine_registered}
                    onChange={(e) =>
                      setAddForm({ ...addForm, id_machine_registered: e.target.value })
                    }
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-mono font-bold text-purple-800 focus:border-teal-500 outline-none"
                  >
                    <option value="">-- {t('entrepot.modal.machine')} --</option>
                    {(isComponentNature(addForm.nature)
                      ? filterProductionMachines(machines)
                      : filterActiveMachines(machines)
                    ).map((m) => (
                      <option key={m.id_machine_registered} value={m.id_machine_registered}>
                        {m.id_machine_registered} - {m.designation}
                      </option>
                    ))}
                  </select>
                </div>
              ) : addForm.rattachement_type === 'ZONE' ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      {t('entrepot.modal.zone')} *
                    </label>
                    <select
                      value={addForm.id_zone}
                      onChange={(e) => setAddForm({ ...addForm, id_zone: e.target.value })}
                      className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-mono font-bold text-amber-800 focus:border-teal-500 outline-none"
                      required
                    >
                      <option value="">-- {t('entrepot.modal.zone')} --</option>
                      {zones.map((z) => (
                        <option key={z.id_zone} value={z.id_zone}>
                          {z.id_zone} - {z.libelle}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        {t('entrepot.modal.location')}
                      </label>
                      <input
                        type="text"
                        value={addForm.emplacement}
                        onChange={(e) => setAddForm({ ...addForm, emplacement: e.target.value })}
                        placeholder="Ex: Z-ATELIER-01"
                        className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-mono focus:border-teal-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        {t('entrepot.modal.initial_stock')}
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={addForm.stockInitial}
                        onChange={(e) => setAddForm({ ...addForm, stockInitial: e.target.value })}
                        className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-mono font-bold focus:border-teal-500 outline-none"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      {t('entrepot.modal.location')}
                    </label>
                    <input
                      type="text"
                      value={addForm.emplacement}
                      onChange={(e) => setAddForm({ ...addForm, emplacement: e.target.value })}
                      placeholder="Ex: E-MAG-A01"
                      className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-mono focus:border-teal-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      {t('entrepot.modal.initial_stock')}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={addForm.stockInitial}
                      onChange={(e) => setAddForm({ ...addForm, stockInitial: e.target.value })}
                      className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-mono font-bold focus:border-teal-500 outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Responsable & Remarques */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    {t('entrepot.modal.responsible')}
                  </label>
                  <select
                    value={addForm.technician}
                    onChange={(e) => setAddForm({ ...addForm, technician: e.target.value })}
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs focus:border-teal-500 outline-none"
                  >
                    <option value="">-- {t('entrepot.modal.responsible')} --</option>
                    {activeTechnicians.map((tech) => (
                      <option key={tech.id_technician || tech.nom} value={tech.nom}>
                        {tech.nom} ({tech.id_technician})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    {t('entrepot.modal.threshold')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={addForm.seuil}
                    onChange={(e) => setAddForm({ ...addForm, seuil: e.target.value })}
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-mono focus:border-teal-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  {t('entrepot.modal.notes')}
                </label>
                <textarea
                  rows={2}
                  value={addForm.remarques}
                  onChange={(e) => setAddForm({ ...addForm, remarques: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs focus:border-teal-500 outline-none"
                />
              </div>

              {/* Politique de Maintenance (POLICY-TAGS) */}
              <div className="bg-slate-50/90 p-3 rounded-2xl border border-slate-200/90">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-800 uppercase tracking-wider block">
                    Politique de Maintenance & Orientation Organe (`POLICY-TAGS`)
                  </label>
                  <span className="text-[9.5px] font-mono text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                    {isComponentNature(addForm.nature) ? 'COMPOSANT' : 'PART'}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 mb-2">
                  {isComponentNature(addForm.nature)
                    ? 'Pour un organe COMPOSANT : orientation standard REPAIRABLE (révision / rebobinage externe ou atelier) et REPLACING (remplacement).'
                    : 'Pour une PART magasin : orientation REPAIRABLE (rectification), REPLACING (remplacement), ou MODIFYING (adaptation atelier).'}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {(
                    isComponentNature(addForm.nature)
                      ? (['REPAIRABLE', 'REPLACING'] as MaterialPolicyTag[])
                      : (['REPAIRABLE', 'REPLACING', 'MODIFYING'] as MaterialPolicyTag[])
                  ).map((tag) => {
                    const active = (addForm.policy_tags || []).includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          const prev = addForm.policy_tags || [];
                          const next = active ? prev.filter((tagItem: string) => tagItem !== tag) : [...prev, tag];
                          if (next.length === 0) return;
                          setAddForm({ ...addForm, policy_tags: next });
                        }}
                        className={`p-2 rounded-xl border text-left transition cursor-pointer text-xs ${
                          active
                            ? 'bg-slate-900 text-white border-slate-900 font-bold shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10.5px]">{tag}</span>
                          {active && <span className="text-amber-400 text-[10px]">● Actif</span>}
                        </div>
                        <div className={`text-[9.5px] mt-0.5 ${active ? 'text-slate-300' : 'text-slate-500'}`}>
                          {tag === 'REPAIRABLE' && 'Réparable / Révisable'}
                          {tag === 'REPLACING' && 'Remplacement Neuf'}
                          {tag === 'MODIFYING' && 'Usinage / Adaptation'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onCloseAddModal}
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold cursor-pointer"
                >
                  {t('entrepot.buttons.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-black text-white font-bold transition shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>{t('entrepot.buttons.save')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {toEdit && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-white">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 font-bold">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    {t('entrepot.modal.edit_title')} : {toEdit.id_warehouse_item}
                  </h3>
                  <p className="text-xs text-slate-500">{t('entrepot.modal.designation')}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onCloseEditModal}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={onSubmitEdit} className="p-4 sm:p-5 space-y-4 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  {t('entrepot.modal.designation')} *
                </label>
                <input
                  type="text"
                  value={editForm.designation}
                  onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })}
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:border-blue-500 outline-none"
                  required
                />
              </div>

              {/* Dynamic Classification in Edit Modal */}
              {isComponentNature(toEdit?.nature || editForm.nature) ? (
                <div className="grid grid-cols-2 gap-2.5 p-2.5 bg-blue-50/40 rounded-xl border border-blue-100">
                  <div>
                    <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
                      {t('entrepot.modal.family')}
                    </label>
                    <select
                      value={editForm.id_family}
                      onChange={(e) => {
                        const nextFam = e.target.value;
                        const relTpl = templates.filter((tObj) => tObj.id_family === nextFam);
                        setEditForm({
                          ...editForm,
                          id_family: nextFam,
                          id_templates: relTpl[0]?.id_templates || '',
                        });
                      }}
                      className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold focus:border-blue-500 outline-none"
                    >
                      {families.map((f) => (
                        <option key={f.id_family} value={f.id_family}>
                          {f.libelle} ({f.id_family})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
                      {t('entrepot.modal.template')}
                    </label>
                    <select
                      value={editForm.id_templates}
                      onChange={(e) => setEditForm({ ...editForm, id_templates: e.target.value })}
                      className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs focus:border-blue-500 outline-none"
                    >
                      <option value="">-- {t('entrepot.filters.all_templates')} --</option>
                      {(editForm.id_family
                        ? templates.filter((tObj) => tObj.id_family === editForm.id_family)
                        : templates
                      ).map((tObj) => (
                        <option key={tObj.id_templates} value={tObj.id_templates}>
                          {tObj.libelle}
                        </option>
                      ))}
                    </select>
                  </div>
                  {/* Spécifications Plaque Signalétique & Mode Réparation (P3) */}
                  <div className="col-span-2 grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1.5 border-t border-blue-200/60">
                    <div className="col-span-2 sm:col-span-1">
                      <label className="text-[10px] font-semibold text-slate-600 block mb-1">
                        Mode Réparation
                      </label>
                      <select
                        value={editForm.mode_reparation_defaut || 'NON_DEFINI'}
                        onChange={(e) => setEditForm({ ...editForm, mode_reparation_defaut: e.target.value })}
                        className="w-full h-8 px-1.5 rounded-lg border border-slate-200 bg-white text-[11px] font-semibold"
                      >
                        <option value="NON_DEFINI">Non défini</option>
                        <option value="REBOBINAGE_EXTERNE">Rebobinage Ext.</option>
                        <option value="REVISION_ATELIER">Révision Atelier</option>
                        <option value="ECHANGE_STANDARD">Échange Std.</option>
                        <option value="GARANTIE">Garantie</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 block mb-1">
                        Tension (U)
                      </label>
                      <input
                        type="text"
                        placeholder="230/400V"
                        value={editForm.tension_nominale || ''}
                        onChange={(e) => setEditForm({ ...editForm, tension_nominale: e.target.value })}
                        className="w-full h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 block mb-1">
                        Courant (A)
                      </label>
                      <input
                        type="text"
                        placeholder="8.8A"
                        value={editForm.courant_nominal_a || ''}
                        onChange={(e) => setEditForm({ ...editForm, courant_nominal_a: e.target.value })}
                        className="w-full h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 block mb-1">
                        Protection (IP)
                      </label>
                      <input
                        type="text"
                        placeholder="IP55"
                        value={editForm.indice_protection || ''}
                        onChange={(e) => setEditForm({ ...editForm, indice_protection: e.target.value })}
                        className="w-full h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 block mb-1">
                        Fixation
                      </label>
                      <input
                        type="text"
                        placeholder="B3, B5..."
                        value={editForm.type_fixation || ''}
                        onChange={(e) => setEditForm({ ...editForm, type_fixation: e.target.value })}
                        className="w-full h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5 p-2.5 bg-indigo-50/40 rounded-xl border border-indigo-100">
                  <div>
                    <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
                      {t('entrepot.modal.type')}
                    </label>
                    <select
                      value={editForm.id_type}
                      onChange={(e) => {
                        const nextType = e.target.value;
                        const relDiags = diagnostics.filter((d) => d.id_type === nextType);
                        const firstDiag = relDiags[0];
                        const nextDiagId = firstDiag
                          ? firstDiag.id_part || firstDiag.ref || firstDiag.id_diag || firstDiag.id || ''
                          : '';
                        setEditForm({
                          ...editForm,
                          id_type: nextType,
                          id_diag: nextDiagId,
                        });
                      }}
                      className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold focus:border-indigo-500 outline-none"
                    >
                      {types.map((tObj) => (
                        <option key={tObj.id_type} value={tObj.id_type}>
                          {tObj.libelle} ({tObj.id_type})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
                      {t('entrepot.modal.diag')}
                    </label>
                    <select
                      value={editForm.id_diag}
                      onChange={(e) => {
                        const nextDiag = e.target.value;
                        const diagObj = diagnostics.find(
                          (d) => (d.id_part || d.ref || d.id_diag || d.id) === nextDiag
                        );
                        setEditForm({
                          ...editForm,
                          id_diag: nextDiag,
                          designation: diagObj
                            ? diagObj.designation || diagObj.libelle || editForm.designation
                            : editForm.designation,
                          matiere_nuance: diagObj?.matiere_nuance || editForm.matiere_nuance || '',
                          ref_plan: diagObj?.ref_plan || editForm.ref_plan || '',
                          dimensions_brut: diagObj?.dimensions_brut || editForm.dimensions_brut || '',
                          traitement_thermique: diagObj?.traitement_thermique || editForm.traitement_thermique || '',
                        });
                      }}
                      className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs focus:border-indigo-500 outline-none"
                    >
                      <option value="">-- {t('entrepot.modal.diag')} --</option>
                      {(editForm.id_type
                        ? diagnostics.filter((d) => d.id_type === editForm.id_type)
                        : diagnostics
                      ).map((d) => {
                        const dId = d.id_part || d.ref || d.id_diag || d.id;
                        const dLabel = d.designation || d.libelle || dId;
                        return (
                          <option key={dId} value={dId}>
                            {dId} - {dLabel}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  {/* Spécifications Atelier (P2 + P3) */}
                  <div className="col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1.5 border-t border-indigo-200/60">
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 block mb-1">
                        Matière / Nuance
                      </label>
                      <input
                        type="text"
                        placeholder="ex: 42CrMo4"
                        value={editForm.matiere_nuance || ''}
                        onChange={(e) => setEditForm({ ...editForm, matiere_nuance: e.target.value })}
                        className="w-full h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 block mb-1">
                        Réf. Plan Usinage
                      </label>
                      <input
                        type="text"
                        placeholder="ex: PLN-MEC-204"
                        value={editForm.ref_plan || ''}
                        onChange={(e) => setEditForm({ ...editForm, ref_plan: e.target.value })}
                        className="w-full h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 block mb-1">
                        Dimensions Brut
                      </label>
                      <input
                        type="text"
                        placeholder="ex: Ø60 x 240 mm"
                        value={editForm.dimensions_brut || ''}
                        onChange={(e) => setEditForm({ ...editForm, dimensions_brut: e.target.value })}
                        className="w-full h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 block mb-1">
                        Traitement Thermique
                      </label>
                      <input
                        type="text"
                        placeholder="ex: Trempé 58 HRC"
                        value={editForm.traitement_thermique || ''}
                        onChange={(e) => setEditForm({ ...editForm, traitement_thermique: e.target.value })}
                        className="w-full h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    {t('entrepot.modal.rattachement')}
                  </label>
                  <select
                    value={editForm.rattachement_type}
                    onChange={(e) => {
                      const nextType = e.target.value;
                      setEditForm({
                        ...editForm,
                        rattachement_type: nextType,
                        id_zone:
                          nextType === 'ZONE'
                            ? editForm.id_zone || zones[0]?.id_zone || ''
                            : editForm.id_zone,
                      });
                    }}
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:border-blue-500 outline-none"
                  >
                    <option value="MACHINE">{t('entrepot.modal.machine')}</option>
                    <option value="ZONE">{t('entrepot.modal.zone')}</option>
                    <option value="ENTREPOT">{t('entrepot.modal.location')}</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">{t('entrepot.modal.status')}</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:border-blue-500 outline-none"
                  >
                    <option value="En service">{t('entrepot.filters.in_service')}</option>
                    <option value="En stock (Disponible)">{t('entrepot.filters.in_stock')}</option>
                    <option value="En révision / Externe">{t('entrepot.filters.under_revision')}</option>
                    <option value="Hors service">Hors Service</option>
                  </select>
                </div>
              </div>

              {editForm.rattachement_type === 'MACHINE' ? (
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    {t('entrepot.modal.machine')}
                  </label>
                  <select
                    value={editForm.id_machine_registered}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        id_machine_registered: e.target.value,
                      })
                    }
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-mono font-bold text-purple-800 focus:border-blue-500 outline-none"
                  >
                    <option value="">-- {t('entrepot.modal.machine')} --</option>
                    {(isComponentNature(toEdit?.nature || editForm.nature)
                      ? filterProductionMachines(machines)
                      : filterActiveMachines(machines)
                    ).map((m) => (
                      <option key={m.id_machine_registered} value={m.id_machine_registered}>
                        {m.id_machine_registered} - {m.designation}
                      </option>
                    ))}
                  </select>
                </div>
              ) : editForm.rattachement_type === 'ZONE' ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      {t('entrepot.modal.zone')} *
                    </label>
                    <select
                      value={editForm.id_zone}
                      onChange={(e) => setEditForm({ ...editForm, id_zone: e.target.value })}
                      className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-mono font-bold text-amber-800 focus:border-blue-500 outline-none"
                      required
                    >
                      <option value="">-- {t('entrepot.modal.zone')} --</option>
                      {zones.map((z) => (
                        <option key={z.id_zone} value={z.id_zone}>
                          {z.id_zone} - {z.libelle}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        {t('entrepot.modal.location')}
                      </label>
                      <input
                        type="text"
                        value={editForm.emplacement}
                        onChange={(e) => setEditForm({ ...editForm, emplacement: e.target.value })}
                        className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-mono focus:border-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        {t('entrepot.modal.initial_stock')}
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={editForm.stockInitial}
                        onChange={(e) => setEditForm({ ...editForm, stockInitial: e.target.value })}
                        className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-mono font-bold focus:border-blue-500 outline-none"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      {t('entrepot.modal.location')}
                    </label>
                    <input
                      type="text"
                      value={editForm.emplacement}
                      onChange={(e) => setEditForm({ ...editForm, emplacement: e.target.value })}
                      className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-mono focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      {t('entrepot.modal.initial_stock')}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editForm.stockInitial}
                      onChange={(e) => setEditForm({ ...editForm, stockInitial: e.target.value })}
                      className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-mono font-bold focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    {t('entrepot.modal.responsible')}
                  </label>
                  <select
                    value={editForm.technician}
                    onChange={(e) => setEditForm({ ...editForm, technician: e.target.value })}
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs focus:border-blue-500 outline-none"
                  >
                    <option value="">-- {t('entrepot.modal.responsible')} --</option>
                    {activeTechnicians.map((tech) => (
                      <option key={tech.id_technician || tech.nom} value={tech.nom}>
                        {tech.nom} ({tech.id_technician})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    {t('entrepot.modal.threshold')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editForm.seuil}
                    onChange={(e) => setEditForm({ ...editForm, seuil: e.target.value })}
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-mono focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  {t('entrepot.modal.notes')}
                </label>
                <textarea
                  rows={2}
                  value={editForm.remarques}
                  onChange={(e) => setEditForm({ ...editForm, remarques: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs focus:border-blue-500 outline-none"
                />
              </div>

              {/* Politique de Maintenance (POLICY-TAGS) */}
              <div className="bg-slate-50/90 p-3 rounded-2xl border border-slate-200/90">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-800 uppercase tracking-wider block">
                    Politique de Maintenance & Orientation Organe (`POLICY-TAGS`)
                  </label>
                  <span className="text-[9.5px] font-mono text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                    {isComponentNature(toEdit?.nature || editForm.nature) ? 'COMPOSANT' : 'PART'}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 mb-2">
                  {isComponentNature(toEdit?.nature || editForm.nature)
                    ? 'Pour un organe COMPOSANT : orientation standard REPAIRABLE (révision / rebobinage externe ou atelier) et REPLACING (remplacement).'
                    : 'Pour une PART magasin : orientation REPAIRABLE (rectification), REPLACING (remplacement), ou MODIFYING (adaptation atelier).'}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {(
                    isComponentNature(toEdit?.nature || editForm.nature)
                      ? (['REPAIRABLE', 'REPLACING'] as MaterialPolicyTag[])
                      : (['REPAIRABLE', 'REPLACING', 'MODIFYING'] as MaterialPolicyTag[])
                  ).map((tag) => {
                    const active = (editForm.policy_tags || []).includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          const prev = editForm.policy_tags || [];
                          const next = active ? prev.filter((tagItem: string) => tagItem !== tag) : [...prev, tag];
                          if (next.length === 0) return;
                          setEditForm({ ...editForm, policy_tags: next });
                        }}
                        className={`p-2 rounded-xl border text-left transition cursor-pointer text-xs ${
                          active
                            ? 'bg-slate-900 text-white border-slate-900 font-bold shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10.5px]">{tag}</span>
                          {active && <span className="text-amber-400 text-[10px]">● Actif</span>}
                        </div>
                        <div className={`text-[9.5px] mt-0.5 ${active ? 'text-slate-300' : 'text-slate-500'}`}>
                          {tag === 'REPAIRABLE' && 'Réparable / Révisable'}
                          {tag === 'REPLACING' && 'Remplacement Neuf'}
                          {tag === 'MODIFYING' && 'Usinage / Adaptation'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onCloseEditModal}
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold cursor-pointer"
                >
                  {t('entrepot.buttons.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-black text-white font-bold transition shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>{t('entrepot.buttons.save')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
