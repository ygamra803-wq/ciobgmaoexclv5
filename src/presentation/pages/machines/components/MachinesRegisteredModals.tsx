import CustomSelect from '../../../components/common/CustomSelect';
import { HubIcon } from '../../../components/common/icons/HubIcon';
import { CategoryIcon } from '../../../components/common/icons/CategoryIcon';
import {
  Activity,
  AlertTriangle,
  Calculator,
  Calendar,
  Clock,
  Factory,
  FileText,
  Gauge,
  Hash,
  MapPin,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import PreventiveService from '../../../../application/services/PreventiveService';
import {
  filterActiveMachines,
  getMachineAssetClass,
  isArchivedMachine,
} from '../../../../utils/activeMachines';
import {
  ASSET_HIERARCHY_LEVEL_LABELS,
  evaluateParentArchivePolicy,
  wouldCreateHierarchyCycle,
  type AssetHierarchyLevel,
} from '../../../../utils/assetHierarchy';
import { buildMachineActivityLedger } from '../../../../application/services/MachineHealthPassportService';
import { dataIntegrityService } from '../../../../services/dataIntegrityService';

import type {
  IBlueprint,
  IMachine,
  IMachineFamily,
  IMachineTemplate,
  IMouvement,
  ISortieDemand,
  ITechnician,
  IWarehouseItem,
  IZone,
} from '../../../../types/domain';
import type {
  CorrectiveInterventionItem,
  MachineElement,
  PreventiveTaskItem,
  SortieExterneItem,
} from '../../../../types/store';
import type { PreventiveExecutionRecord } from '../../../../types/preventive';

export interface MachinesRegisteredModalsProps {
  toEdit: IMachine | null;
  setToEdit: (val: IMachine | null) => void;
  toDelete: IMachine | null;
  setToDelete: (val: IMachine | null) => void;
  showFormulasModal: boolean;
  setShowFormulasModal: (val: boolean) => void;
  preventiveMachine: IMachine | null;
  setPreventiveMachine: (val: IMachine | null) => void;
  machines: IMachine[];
  families: IMachineFamily[];
  templates: IMachineTemplate[];
  blueprints: IBlueprint[];
  zones: IZone[];
  technicians: ITechnician[];
  preventiveTasks: PreventiveTaskItem[];
  preventiveExecutions: PreventiveExecutionRecord[];
  correctiveInterventions: CorrectiveInterventionItem[];
  mouvements: IMouvement[];
  machineElementsLedger: MachineElement[];
  sortiesExterne: SortieExterneItem[];
  sortieDemands: ISortieDemand[];
  warehouseItems: IWarehouseItem[];
  onUpdateMachine: (id: string, data: Partial<IMachine>) => void;
  onDeleteMachine: (id: string) => void;
  navigateToEquipmentForMachine: (machineId?: string) => void;
  onNavigateToPreventive?: (machineId?: string) => void;
  getMachineSerialNumber: (m: IMachine) => string;
  getMachineCommissioningDate: (m: IMachine) => string;
  getZoneByRef: (ref?: string | null, zonesList?: IZone[]) => IZone | null | undefined;
}

export function MachinesRegisteredModals({
  toEdit,
  setToEdit,
  toDelete,
  setToDelete,
  showFormulasModal,
  setShowFormulasModal,
  preventiveMachine,
  setPreventiveMachine,
  machines,
  families,
  templates,
  blueprints,
  zones,
  technicians,
  preventiveTasks,
  preventiveExecutions,
  correctiveInterventions,
  mouvements,
  machineElementsLedger,
  sortiesExterne,
  sortieDemands,
  warehouseItems,
  onUpdateMachine,
  onDeleteMachine,
  navigateToEquipmentForMachine,
  onNavigateToPreventive,
  getMachineSerialNumber,
  getMachineCommissioningDate,
  getZoneByRef,
}: MachinesRegisteredModalsProps) {
  return (
    <>
      {/* MODAL: MODIFIER MACHINE */}
      {toEdit && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200">
                  <Factory className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">Modifier Machine Registered</h3>
                  <p className="text-[11px] text-slate-500 font-mono">{toEdit.id_machine_registered}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setToEdit(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const isSysGen = getMachineAssetClass(toEdit) === 'SYSTEM_GENERAL';
                if (isSysGen && !toEdit.id_general_system_type) {
                  return;
                }
                const normalizedEdit = {
                  ...toEdit,
                  asset_class: isSysGen ? ('SYSTEM_GENERAL' as const) : ('PRODUCTION' as const),
                  id_general_system_type: isSysGen ? toEdit.id_general_system_type || '' : '',
                };
                onUpdateMachine(toEdit.id_machine_registered, normalizedEdit);
                setToEdit(null);
              }}
              className="space-y-4"
            >
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/90 flex items-center justify-between gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-xs font-bold">
                  <Factory className="w-3.5 h-3.5" />
                  <span>Machine de Production</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const targetCode = toEdit.id_machine_registered;
                    setToEdit(null);
                    navigateToEquipmentForMachine(targetCode);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold transition cursor-pointer"
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                  <span>Gérer dans Équipements ➔</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                    Code Machine (B)
                  </label>
                  <input
                    type="text"
                    value={toEdit.id_machine_registered}
                    disabled
                    className="w-full h-10 px-3 rounded-xl bg-slate-100 text-slate-500 text-xs font-mono font-bold border border-slate-200"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                    Désignation de la Machine (C)
                  </label>
                  <input
                    type="text"
                    value={toEdit.designation}
                    onChange={(e) => setToEdit({ ...toEdit, designation: e.target.value })}
                    required
                    placeholder="Ex: Compresseur Atlas Copco / Extincteur CO2"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1 flex items-center justify-between">
                    <span>Famille (D)</span>
                    {getMachineAssetClass(toEdit) === 'SYSTEM_GENERAL' && (
                      <span className="text-[10px] font-normal text-amber-700 lowercase italic">(optionnel)</span>
                    )}
                  </label>
                  <CustomSelect
                    value={toEdit.id_family || ''}
                    onChange={(val) => {
                      const relTpl = templates.filter((t) => t.id_family === val);
                      setToEdit({
                        ...toEdit,
                        id_family: val,
                        id_templates: val ? relTpl[0]?.id_templates || '' : '',
                      });
                    }}
                    options={[
                      ...(getMachineAssetClass(toEdit) === 'SYSTEM_GENERAL'
                        ? [{ value: '', label: '— Aucune Famille (Système Général) —' }]
                        : []),
                      ...families.map((f) => ({ value: f.id_family, label: `${f.libelle} (${f.id_family})` })),
                    ]}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1 flex items-center justify-between">
                    <span>Template Modèle (E)</span>
                    {getMachineAssetClass(toEdit) === 'SYSTEM_GENERAL' && (
                      <span className="text-[10px] font-normal text-amber-700 lowercase italic">(optionnel)</span>
                    )}
                  </label>
                  <CustomSelect
                    value={toEdit.id_templates || ''}
                    onChange={(val) => setToEdit({ ...toEdit, id_templates: val })}
                    options={[
                      ...(getMachineAssetClass(toEdit) === 'SYSTEM_GENERAL'
                        ? [{ value: '', label: '— Aucun Template (Optionnel) —' }]
                        : []),
                      ...templates
                        .filter((t) => !toEdit.id_family || t.id_family === toEdit.id_family)
                        .map((t) => ({ value: t.id_templates, label: `${t.libelle} (${t.id_templates})` })),
                    ]}
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <FileText className="w-3 h-3 text-cyan-600" />
                    <span>Blueprint / Schéma Machine</span>
                  </span>
                  <span className="text-[10px] font-normal text-slate-400 lowercase italic">(optionnel)</span>
                </label>
                <CustomSelect
                  value={toEdit.id_blueprint || ''}
                  onChange={(val) => setToEdit({ ...toEdit, id_blueprint: val })}
                  options={[
                    { value: '', label: '— Non sélectionné (Optionnel) —' },
                    ...blueprints
                      .filter(
                        (b) =>
                          (!toEdit.id_templates || b.id_templates === toEdit.id_templates) &&
                          (!toEdit.id_family || b.id_family === toEdit.id_family)
                      )
                      .map((b) => ({
                        value: b.id_blueprint,
                        label: `${b.id_blueprint} • ${b.libelle || b.ref_plan || ''} ${b.revision ? `(${b.revision})` : ''}`,
                      })),
                  ]}
                />
              </div>

              <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-indigo-50/40 border border-indigo-100">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Rôle Opérationnel
                  </label>
                  <CustomSelect
                    value={toEdit.asset_level === 'LINE' ? 'LINE' : 'MACHINE'}
                    onChange={(val) =>
                      setToEdit({
                        ...toEdit,
                        asset_level: (val === 'LINE' ? 'LINE' : 'MACHINE') as AssetHierarchyLevel,
                      })
                    }
                    options={(Object.keys(ASSET_HIERARCHY_LEVEL_LABELS) as AssetHierarchyLevel[]).map(
                      (lvl) => ({
                        value: lvl,
                        label: ASSET_HIERARCHY_LEVEL_LABELS[lvl],
                      })
                    )}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Rattachement Ligne / Machine Mère
                  </label>
                  <CustomSelect
                    value={toEdit.parent_id ?? toEdit.id_parent ?? ''}
                    onChange={(val) => {
                      const nextParent = val ? String(val).trim().toUpperCase() : null;
                      if (
                        nextParent &&
                        wouldCreateHierarchyCycle(
                          machines,
                          toEdit.id_machine_registered,
                          nextParent
                        )
                      ) {
                        return;
                      }
                      setToEdit({
                        ...toEdit,
                        parent_id: nextParent,
                        id_parent: nextParent,
                      });
                    }}
                    options={[
                      { value: '', label: '— Machine indépendante (Aucune ligne mère) —' },
                      ...filterActiveMachines(machines)
                        .filter(
                          (cand) =>
                            cand.id_machine_registered !== toEdit.id_machine_registered &&
                            !wouldCreateHierarchyCycle(
                              machines,
                              toEdit.id_machine_registered,
                              cand.id_machine_registered
                            )
                        )
                        .map((cand) => ({
                          value: cand.id_machine_registered,
                          label: `${cand.id_machine_registered} • ${cand.designation}`,
                        })),
                    ]}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1 flex items-center gap-1">
                    <Hash className="w-3 h-3 text-slate-500" />
                    <span>N° de Série (N° Série)</span>
                  </label>
                  <input
                    type="text"
                    value={toEdit.serial_number ?? getMachineSerialNumber(toEdit)}
                    onChange={(e) => setToEdit({ ...toEdit, serial_number: e.target.value })}
                    placeholder="Ex: SN-2023-MCH01"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-mono font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-500" />
                    <span>Mise en Service</span>
                  </label>
                  <input
                    type="date"
                    value={toEdit.date_mise_en_service ?? getMachineCommissioningDate(toEdit)}
                    onChange={(e) => setToEdit({ ...toEdit, date_mise_en_service: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1 flex items-center gap-1">
                    <Gauge className="w-3 h-3 text-indigo-600" />
                    <span>Compteur Principal (Horomètre)</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={toEdit.compteur_heures ?? toEdit.dernier_releve_compteur ?? ''}
                    onChange={(e) =>
                      setToEdit({
                        ...toEdit,
                        compteur_heures: Number(e.target.value) || 0,
                        dernier_releve_compteur: Number(e.target.value) || 0,
                        date_releve_compteur: new Date().toISOString().split('T')[0],
                      })
                    }
                    placeholder="Ex: 4500 (Heures)"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-mono font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                    <span>Unité par Défaut</span>
                  </label>
                  <select
                    value={toEdit.compteur_unite_defaut || 'Heures'}
                    onChange={(e) =>
                      setToEdit({
                        ...toEdit,
                        compteur_unite_defaut: e.target.value,
                      })
                    }
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="Heures">Heures (Horomètre)</option>
                    <option value="Cycles">Cycles (Production)</option>
                    <option value="Km">Km (Engins mobiles)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                    Secteur / Zone Réelle (F)
                  </label>
                  <CustomSelect
                    value={
                      getZoneByRef(toEdit.id_zone_default, zones)?.id_zone ||
                      getZoneByRef(toEdit.id_zone_default, zones)?.code_zone ||
                      toEdit.id_zone_default
                    }
                    onChange={(val) => setToEdit({ ...toEdit, id_zone_default: val })}
                    options={zones.map((z) => {
                      const idZ = z.id_zone || z.code_zone || z.code;
                      const codeZ = z.code_zone || z.code || z.id_zone;
                      const showDual = idZ && codeZ && idZ !== codeZ;
                      return {
                        value: idZ,
                        label: `${z.code_zone ? z.code_zone + ' • ' : ''}${z.libelle}${showDual ? ` (${idZ})` : ''}`,
                      };
                    })}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                    Technicien Responsable (G)
                  </label>
                  <CustomSelect
                    value={toEdit.technician}
                    onChange={(val) => setToEdit({ ...toEdit, technician: val })}
                    options={technicians
                      .filter(
                        (t) =>
                          (t.is_active !== false &&
                            t.actif !== false &&
                            String(t.statut || '').toUpperCase() !== 'ARCHIVE') ||
                          t.id_technician === toEdit.technician ||
                          t.nom === toEdit.technician
                      )
                      .map((t) => {
                        const isTechArchived =
                          t.is_active === false ||
                          t.actif === false ||
                          String(t.statut || '').toUpperCase() === 'ARCHIVE';
                        return {
                          value: t.id_technician,
                          label: `${t.nom} (${t.id_technician})${isTechArchived ? ' — Archivé' : ''}`,
                        };
                      })}
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  Statut Opérationnel / Cycle de Vie (H)
                </label>
                <CustomSelect
                  value={isArchivedMachine(toEdit) ? 'ARCHIVEE' : toEdit.status || 'En Service'}
                  onChange={(val) =>
                    setToEdit({
                      ...toEdit,
                      status: val,
                      is_active: val !== 'ARCHIVEE',
                      actif: val !== 'ARCHIVEE',
                      archived: val === 'ARCHIVEE',
                    })
                  }
                  options={[
                    { value: 'En Service', label: 'En Service (ACTIVE — Opérationnel)' },
                    { value: 'En Maintenance', label: 'En Maintenance (ACTIVE)' },
                    { value: 'En Panne', label: 'En Panne (ACTIVE)' },
                    { value: 'Arrêt', label: 'Arrêt Machine (STOPPED / INACTIVE)' },
                    { value: 'ARCHIVEE', label: 'Archivée (ARCHIVED — Gammes PM suspendues)' },
                  ]}
                />
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setToEdit(null)}
                  className="flex-1 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 h-10 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out cursor-pointer"
                >
                  Enregistrer Modifications
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: SUPPRIMER MACHINE */}
      {toDelete && (() => {
        const deps = dataIntegrityService.getMachineDependencies(toDelete.id_machine_registered, {
          preventiveTasks,
          preventiveExecutions,
          correctiveInterventions,
          mouvements,
          machineElementsLedger,
          sortiesExterne,
          sortieDemands,
          warehouseItems,
        });
        const parentPolicy = evaluateParentArchivePolicy(toDelete.id_machine_registered, machines);
        const willSoftArchive = !deps.canHardDelete || parentPolicy.hasActiveChildren;

        return (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-4 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex flex-col items-center text-center">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 ${
                    willSoftArchive ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-600'
                  }`}
                >
                  {willSoftArchive ? <RotateCcw className="w-6 h-6" /> : <Trash2 className="w-6 h-6" />}
                </div>
                <h3 className="font-bold text-base text-slate-900">
                  {willSoftArchive ? 'Archiver la Machine (Historique Protégé)' : 'Supprimer Définitivement la Machine ?'}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Équipement ciblé :{' '}
                  <b className="font-mono text-slate-900">{toDelete.id_machine_registered}</b> ({toDelete.designation})
                </p>

                {parentPolicy.hasActiveChildren && (
                  <div className="mt-3 w-full text-left text-[11px] text-indigo-950 bg-indigo-50 border border-indigo-200 rounded-2xl p-3 space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-indigo-900">
                      <AlertTriangle className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span>Politique Hiérarchique Parent ({parentPolicy.activeChildrenIds.length} enfant(s) actif(s))</span>
                    </div>
                    <p className="text-[10.5px] text-indigo-800">
                      {parentPolicy.warningMessage}
                    </p>
                  </div>
                )}

                {willSoftArchive ? (
                  <div className="mt-3 w-full text-left text-[11px] text-amber-950 bg-amber-50 border border-amber-200 rounded-2xl p-3 space-y-2">
                    <div className="font-bold flex items-center gap-1.5 text-amber-900">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Cette machine possède {deps.total} liaison(s) active(s) ou historiques :</span>
                    </div>
                    <ul className="list-disc list-inside space-y-0.5 text-amber-800 font-medium pl-1">
                      {deps.preventiveCount > 0 && <li>{deps.preventiveCount} tâche(s) préventive(s) planifiée(s)</li>}
                      {deps.preventiveExecutionsCount > 0 && <li>{deps.preventiveExecutionsCount} exécution(s) préventive(s)</li>}
                      {deps.correctiveCount > 0 && <li>{deps.correctiveCount} intervention(s) corrective(s) (DI/BT)</li>}
                      {deps.movementsCount > 0 && <li>{deps.movementsCount} mouvement(s) de stock PDR</li>}
                      {deps.bomCount > 0 && <li>{deps.bomCount} élément(s) de nomenclature BOM</li>}
                      {deps.warehouseCount > 0 && <li>{deps.warehouseCount} organe(s) d&apos;entrepôt rattaché(s)</li>}
                      {deps.externalSortiesCount > 0 && <li>{deps.externalSortiesCount} dossier(s) de bobinage externe</li>}
                      {deps.sortieDemandsCount > 0 && <li>{deps.sortieDemandsCount} demande(s) de sortie PDR</li>}
                    </ul>
                    <p className="text-[10.5px] text-amber-800 pt-1 border-t border-amber-200/70">
                      Conformément à la règle <b>Safe Archive</b>, la machine passera en statut <b>ARCHIVEE</b>, ses gammes préventives seront suspendues automatiquement, et son historique restera intact.
                    </p>
                  </div>
                ) : (
                  <div className="mt-3 w-full text-[11px] text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-2xl p-2.5">
                    Aucune dépendance historique détectée (0 BT, 0 PM, 0 mouvement, 0 BOM). Cet équipement sera <b>supprimé définitivement</b> du référentiel.
                  </div>
                )}
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setToDelete(null)}
                  className="flex-1 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDeleteMachine(toDelete.id_machine_registered);
                    setToDelete(null);
                  }}
                  className={`flex-1 h-10 rounded-xl text-white text-xs font-bold transition shadow-md cursor-pointer ${
                    willSoftArchive ? 'bg-amber-600 hover:bg-amber-700' : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {willSoftArchive ? 'Archiver la Machine' : 'Supprimer Définitivement'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Excel Formulas Preview Modal */}
      {showFormulasModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-5 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-700 shrink-0">
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <span>Formules Excel Miroir — Machines Enregistrées</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Liaisons D → G
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Formules et dépendances relationnelles de la feuille Machines_Registered
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowFormulasModal(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer shrink-0"
                title="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-cyan-300 transition">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                    <HubIcon className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                    <span className="truncate">Liaison Famille (Col. D)</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-100/80 text-cyan-800 border border-cyan-200 shrink-0">
                    Liaison D
                  </span>
                </div>
                <div className="font-mono text-xs text-cyan-800 font-bold bg-white p-2 rounded-lg border border-cyan-100">
                  =[@id_family] → Family!B:B
                </div>
                <p className="text-[10.5px] text-slate-500 leading-tight">
                  Liaison relationnelle vers la catégorie parentale de l&apos;équipement dans la feuille Familles.
                </p>
              </div>

              <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-amber-300 transition">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                    <CategoryIcon className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span className="truncate">Liaison Template (Col. E)</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-100/80 text-amber-800 border border-amber-200 shrink-0">
                    Liaison E
                  </span>
                </div>
                <div className="font-mono text-xs text-amber-800 font-bold bg-white p-2 rounded-lg border border-amber-100">
                  =[@id_templates] → Template!B:B
                </div>
                <p className="text-[10.5px] text-slate-500 leading-tight">
                  Association du modèle de référence technique pour l&apos;unification des composants.
                </p>
              </div>

              <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-purple-300 transition">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                    <MapPin className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                    <span className="truncate">Liaison Zone Défaut (Col. F)</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-purple-100/80 text-purple-800 border border-purple-200 shrink-0">
                    Liaison F
                  </span>
                </div>
                <div className="font-mono text-xs text-purple-800 font-bold bg-white p-2 rounded-lg border border-purple-100">
                  =[@id_zone_default] → Zone!B:B
                </div>
                <p className="text-[10.5px] text-slate-500 leading-tight">
                  Emplacement physique par défaut et secteur géographique de fonctionnement de la machine.
                </p>
              </div>

              <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-rose-300 transition">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                    <Activity className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <span className="truncate">Interventions & Sorties</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-rose-100/80 text-rose-800 border border-rose-200 shrink-0">
                    Traçabilité
                  </span>
                </div>
                <div className="font-mono text-xs text-rose-800 font-bold bg-white p-2 rounded-lg border border-rose-100">
                  =COUNTIF(Mvt[Machine], [@id_machine])
                </div>
                <p className="text-[10.5px] text-slate-500 leading-tight">
                  Compteur dynamique de toutes les pièces et sorties de stock consommées par l&apos;équipement.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-400 font-medium">
                Conforme à 100% avec le fichier Excel modèle <span className="font-mono text-slate-600">GMAO_Light_Template_V2</span>
              </span>
              <button
                onClick={() => setShowFormulasModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CARNET DE SANTÉ & PLAN PRÉVENTIF DE LA MACHINE */}
      {preventiveMachine && (() => {
        const profile = PreventiveService.getMachinePreventiveProfile(preventiveMachine.id_machine_registered);
        const machineLedger = buildMachineActivityLedger({
          machineOrId: preventiveMachine,
          machines,
          correctiveInterventions,
          preventiveExecutions,
          sortiesExterne,
          machineElementsLedger,
          warehouseItems,
        });
        const healthColor =
          profile.health_status === 'Optimale'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
            : profile.health_status === 'Moyenne'
            ? 'bg-amber-50 text-amber-800 border-amber-300'
            : 'bg-rose-50 text-rose-800 border-rose-300';

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-50/90 to-purple-50/50 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-black text-slate-900 tracking-tight">
                        Carnet Préventif & Suivi Technique
                      </h3>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${healthColor}`}>
                        Santé : {profile.health_status} ({profile.compliance_rate}%)
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-mono">
                      {preventiveMachine.id_machine_registered} • <span className="font-sans font-medium text-slate-700">{preventiveMachine.designation}</span>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setPreventiveMachine(null)}
                  className="w-8 h-8 rounded-xl bg-white/80 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer shrink-0"
                  title="Fermer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Taux Conformité</span>
                    <span className="text-xl font-black text-indigo-700 font-mono mt-0.5 block">{profile.compliance_rate}%</span>
                    <span className="text-[10px] text-slate-500">{profile.fait_tasks} / {profile.total_tasks} tâches faites</span>
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Prochaine Échéance</span>
                    <span className="text-base font-bold text-slate-800 font-mono mt-0.5 block truncate">
                      {profile.prochaine_intervention?.semaine || 'N/A'}
                    </span>
                    <span className="text-[10px] text-slate-500 truncate block">
                      {profile.prochaine_intervention?.date || 'Plan à jour'}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Tâches en Retard</span>
                    <span className={`text-xl font-black font-mono mt-0.5 block ${profile.retard_tasks > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {profile.retard_tasks}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {profile.retard_tasks > 0 ? 'Action requise' : 'Aucun retard'}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Coût Préventif Cumulé</span>
                    <span className="text-base font-black text-emerald-700 font-mono mt-0.5 block">
                      {Number(profile.cout_total_preventif || 0).toFixed(2)} DH
                    </span>
                    <span className="text-[10px] text-slate-500">Main d&apos;œuvre & PDR</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-indigo-600" />
                      <span>Gammes et Tâches de Maintenance Planifiées ({profile.tasks.length})</span>
                    </h4>
                  </div>

                  {profile.tasks.length === 0 ? (
                    <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-500 space-y-2">
                      <ShieldCheck className="w-8 h-8 text-slate-400 mx-auto" />
                      <p className="font-semibold">Aucun plan préventif n&apos;est encore configuré pour cet équipement.</p>
                      <p className="text-xs text-slate-400">Rendez-vous dans le module Maintenance Préventive &gt; Conception Plan pour programmer ses opérations.</p>
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-100 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200">
                          <tr>
                            <th className="py-2.5 px-3">Organe / Composant</th>
                            <th className="py-2.5 px-2.5 text-center">Action</th>
                            <th className="py-2.5 px-2.5">Fréquence</th>
                            <th className="py-2.5 px-2.5">Responsable</th>
                            <th className="py-2.5 px-2.5">Prochaine Échéance</th>
                            <th className="py-2.5 px-2.5 text-center">Statut</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {profile.tasks.map((t) => (
                            <tr key={t.id} className="hover:bg-indigo-50/30 transition">
                              <td className="py-2.5 px-3">
                                <div className="font-bold text-slate-800">{t.composant}</div>
                                <div className="text-[10px] text-slate-400 font-mono">{t.code}</div>
                              </td>
                              <td className="py-2.5 px-2.5 text-center">
                                <span className="px-2 py-0.5 rounded font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px]">
                                  {t.action_code}
                                </span>
                              </td>
                              <td className="py-2.5 px-2.5 font-medium text-slate-700">{t.frequence}</td>
                              <td className="py-2.5 px-2.5 text-slate-600">{t.responsable || 'Technicien GMAO'}</td>
                              <td className="py-2.5 px-2.5 font-mono text-slate-800 font-semibold">
                                {t.prochaine_echeance || 'Calendrier'}
                              </td>
                              <td className="py-2.5 px-2.5 text-center">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    t.etat === 'Fait'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : t.etat === 'En retard'
                                      ? 'bg-rose-100 text-rose-800'
                                      : 'bg-blue-100 text-blue-800'
                                  }`}
                                >
                                  {t.etat}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="space-y-2 pt-3 border-t border-slate-200/80" data-testid="b2-carnet-activity-ledger">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <Activity className="w-4 h-4 text-emerald-600" />
                      <span>Journal d&apos;Activité & Audit de la Machine ({machineLedger.length})</span>
                    </h4>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                      Vérité validée (BT • Préventif • Bobinage • BOM • Cycle de vie)
                    </span>
                  </div>

                  {machineLedger.length === 0 ? (
                    <div className="p-5 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-500">
                      Aucun événement officiel validé enregistré sur cet équipement.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {machineLedger.slice(0, 15).map((ev) => {
                        const badgeStyle =
                          ev.type === 'CORRECTIVE_BT'
                            ? 'bg-rose-50 text-rose-800 border-rose-200'
                            : ev.type === 'PREVENTIVE_EXECUTION'
                            ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                            : ev.type === 'EXTERNAL_BOBINAGE'
                            ? 'bg-amber-50 text-amber-900 border-amber-300'
                            : ev.type === 'BOM_COMPONENT'
                            ? 'bg-teal-50 text-teal-800 border-teal-200'
                            : 'bg-slate-200 text-slate-800 border-slate-300';

                        return (
                          <div
                            key={ev.id}
                            className="p-3 rounded-xl bg-slate-50/80 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                          >
                            <div className="min-w-0 space-y-0.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${badgeStyle}`}>
                                  {ev.typeLabelFr}
                                </span>
                                <span className="font-bold text-slate-900">{ev.title}</span>
                              </div>
                              <p className="text-[11px] text-slate-600">
                                {ev.details}
                                {ev.actor ? ` • Par: ${ev.actor}` : ''}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 font-mono text-[11px]">
                              {ev.cost !== undefined && ev.cost > 0 && (
                                <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                                  {ev.cost.toLocaleString('fr-FR')} DH
                                </span>
                              )}
                              <span className="text-slate-500 font-bold">{ev.dateYMD}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const machId = preventiveMachine.id_machine_registered;
                    setPreventiveMachine(null);
                    if (onNavigateToPreventive) {
                      onNavigateToPreventive(machId);
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Ouvrir la Matrice de Maintenance (S1 - S52)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPreventiveMachine(null)}
                  className="px-4 py-2 rounded-xl bg-white hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold transition cursor-pointer"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
