import React from 'react';
import {
  Calculator,
  X,
  Hash,
  MapPin,
  Calendar,
  Layers,
  ShieldAlert,
  AlertTriangle,
  Check,
  Settings2,
  Archive,
  Trash2,
} from 'lucide-react';
import SequentialCodePicker from '../../../components/common/SequentialCodePicker';
import { transitionMachineLifecycle } from '../../../../utils/activeMachines';
import type { IGeneralSystemType, IMachine } from '../../../../types/domain';
import type { PreventiveTaskItem } from '../../../../types/store';

export interface EquipmentModalsProps {
  showFormulasModal: boolean;
  setShowFormulasModal: (v: boolean) => void;
  showEquipmentModal: boolean;
  setShowEquipmentModal: (v: boolean) => void;
  editingEquipment: IMachine | null;
  handleSaveEquipment: (e: React.FormEvent) => void;
  equipFormError: string;
  canCreate: boolean;
  openCreateTypeModal: () => void;
  equipForm: any;
  setEquipForm: React.Dispatch<React.SetStateAction<any>>;
  handleSelectFormSystemType: (typeId: string) => void;
  generalSystemTypes: IGeneralSystemType[];
  selectedFormSystemType: IGeneralSystemType | null;
  machines: IMachine[];
  normalizedZones: Array<{ id: string; name: string }>;
  activeTechnicians: Array<{ id: string; name: string; specialty: string }>;
  showTypeModal: boolean;
  setShowTypeModal: (v: boolean) => void;
  editingType: IGeneralSystemType | null;
  handleSaveSystemType: (e: React.FormEvent) => void;
  typeFormError: string;
  typeForm: { code: string; name: string };
  setTypeForm: React.Dispatch<React.SetStateAction<{ code: string; name: string }>>;
  archiveTarget: IMachine | null;
  setArchiveTarget: (m: IMachine | null) => void;
  archiveDependencies: {
    hasHistory?: boolean;
    total: number;
    mouvementsCount?: number;
    movementsCount?: number;
    preventiveCount: number;
    correctiveCount: number;
    [key: string]: unknown;
  } | null;
  preventiveTasks: PreventiveTaskItem[];
  handleUpdateMachine: (id: string, machine: IMachine) => void;
  showToast?: (message: string, type?: string) => void;
  confirmArchiveOrDelete: () => void;
}

export default function EquipmentModals({
  showFormulasModal,
  setShowFormulasModal,
  showEquipmentModal,
  setShowEquipmentModal,
  editingEquipment,
  handleSaveEquipment,
  equipFormError,
  canCreate,
  openCreateTypeModal,
  equipForm,
  setEquipForm,
  handleSelectFormSystemType,
  generalSystemTypes,
  selectedFormSystemType,
  machines,
  normalizedZones,
  activeTechnicians,
  showTypeModal,
  setShowTypeModal,
  editingType,
  handleSaveSystemType,
  typeFormError,
  typeForm,
  setTypeForm,
  archiveTarget,
  setArchiveTarget,
  archiveDependencies,
  preventiveTasks,
  handleUpdateMachine,
  showToast,
  confirmArchiveOrDelete,
}: EquipmentModalsProps) {
  return (
    <>
      {/* 4. MODAL: EXCEL FORMULAS & SYSTEM GENERAL ARCHITECTURE */}
      {showFormulasModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-5 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0">
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <span>Formules &amp; Architecture — Système Général</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                      SSOT MACHINES
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Règles de codification séquentielle, rattachement géographique et périmètre GMAO
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowFormulasModal(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-amber-300 transition">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                    <Hash className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span className="truncate">Auto-Code Équipement</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-100/80 text-amber-800 border border-amber-200 shrink-0">
                    Col. B
                  </span>
                </div>
                <div className="font-mono text-xs text-amber-900 font-bold bg-white p-2 rounded-lg border border-amber-100">
                  =[@Code_Type] &amp; &quot;-&quot; &amp; TEXT(MAX_SEQ+1, &quot;00&quot;)
                </div>
                <p className="text-[10.5px] text-slate-500 leading-tight">
                  Génère automatiquement AIR-01, AIR-02, SEC-01 selon le préfixe du système général choisi.
                </p>
              </div>

              <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-emerald-300 transition">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                    <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="truncate">Rattachement Zone Réelle</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-100/80 text-emerald-800 border border-emerald-200 shrink-0">
                    Col. E
                  </span>
                </div>
                <div className="font-mono text-xs text-emerald-800 font-bold bg-white p-2 rounded-lg border border-emerald-100">
                  =[@id_zone_default] → Zones!B:B
                </div>
                <p className="text-[10.5px] text-slate-500 leading-tight">
                  Chaque équipement d&apos;utilité est implanté dans une zone physique réelle de l&apos;usine.
                </p>
              </div>

              <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-indigo-300 transition">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                    <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span className="truncate">Éligibilité PM / BT / PDR</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-100/80 text-indigo-800 border border-indigo-200 shrink-0">
                    Col. G
                  </span>
                </div>
                <div className="font-mono text-xs text-indigo-800 font-bold bg-white p-2 rounded-lg border border-indigo-100">
                  =filterActiveMachines(machines)
                </div>
                <p className="text-[10.5px] text-slate-500 leading-tight">
                  Inclus dans les listes déroulantes de Maintenance Préventive, Bons de Travail et Sorties PDR.
                </p>
              </div>

              <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-purple-300 transition">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                    <Layers className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                    <span className="truncate">Isolation Nomenclature BOM</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-purple-100/80 text-purple-800 border border-purple-200 shrink-0">
                    Nexus
                  </span>
                </div>
                <div className="font-mono text-xs text-purple-800 font-bold bg-white p-2 rounded-lg border border-purple-100">
                  =filterProductionMachines(machines)
                </div>
                <p className="text-[10.5px] text-slate-500 leading-tight">
                  Exclu automatiquement des arbres Components/Parts et des Blueprints de lignes de production.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-400 font-medium">
                Source unique de vérité : STORAGE_KEYS.MACHINES + GENERAL_SYSTEM_TYPES
              </span>
              <button
                type="button"
                onClick={() => setShowFormulasModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. MODAL: CREATE / EDIT EQUIPMENT */}
      {showEquipmentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-slate-900 tracking-tight">
                    {editingEquipment
                      ? `Modifier l'Équipement ${editingEquipment.id_machine_registered}`
                      : 'Nouvel Équipement — Système Général'}
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Enregistré dans le référentiel central avec classe SYSTEM_GENERAL (éligible PM &amp; BT, hors BOM production)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEquipmentModal(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEquipment} className="p-6 space-y-4">
              {equipFormError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{equipFormError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-black uppercase text-slate-700">
                      Type de Système Général *
                    </label>
                    {canCreate && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowEquipmentModal(false);
                          openCreateTypeModal();
                        }}
                        className="text-[11px] font-bold text-indigo-600 hover:underline cursor-pointer"
                      >
                        + Nouveau type
                      </button>
                    )}
                  </div>
                  <select
                    value={equipForm.id_general_system_type}
                    onChange={(e) => handleSelectFormSystemType(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-xs font-bold text-slate-900 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                    required
                  >
                    <option value="">-- Sélectionner un type (AIR, SEC, EAU...) --</option>
                    {(generalSystemTypes || [])
                      .filter(
                        (t) =>
                          t.is_active !== false ||
                          t.id === equipForm.id_general_system_type
                      )
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          [{t.code}] {t.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  {!editingEquipment && selectedFormSystemType ? (
                    <SequentialCodePicker
                      prefix={selectedFormSystemType.code}
                      existingCodes={(machines || []).map((m) => m.id_machine_registered)}
                      value={equipForm.id_machine_registered}
                      onChange={(code) =>
                        setEquipForm((prev: any) => ({ ...prev, id_machine_registered: code }))
                      }
                      label="Code Équipement (Auto-dérivé) *"
                    />
                  ) : (
                    <div>
                      <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                        Code Équipement *
                      </label>
                      <input
                        type="text"
                        value={equipForm.id_machine_registered}
                        disabled={Boolean(editingEquipment)}
                        onChange={(e) =>
                          setEquipForm((prev: any) => ({
                            ...prev,
                            id_machine_registered: e.target.value.toUpperCase(),
                          }))
                        }
                        placeholder="Ex: AIR-01"
                        className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-100 font-mono text-xs font-black text-slate-900"
                        required
                      />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                  Désignation de l&apos;Équipement *
                </label>
                <input
                  type="text"
                  value={equipForm.designation}
                  onChange={(e) =>
                    setEquipForm((prev: any) => ({ ...prev, designation: e.target.value }))
                  }
                  placeholder="Ex: Compresseur à vis Atlas Copco GA37, Centrale Incendie Zone Nord..."
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-xs font-semibold text-slate-900 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                    Zone Géographique Réelle *
                  </label>
                  <select
                    value={equipForm.id_zone_default}
                    onChange={(e) =>
                      setEquipForm((prev: any) => ({ ...prev, id_zone_default: e.target.value }))
                    }
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-xs font-semibold text-slate-900 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                    required
                  >
                    <option value="">-- Sélectionner une zone --</option>
                    {normalizedZones.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.name} ({z.id})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                    Technicien / Responsable Affecté
                  </label>
                  <select
                    value={equipForm.technician}
                    onChange={(e) =>
                      setEquipForm((prev: any) => ({ ...prev, technician: e.target.value }))
                    }
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-xs font-semibold text-slate-900 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                  >
                    <option value="">-- Équipe générale / Non assigné --</option>
                    {activeTechnicians.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.id} — {t.specialty})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                    N° de Série (S/N)
                  </label>
                  <input
                    type="text"
                    value={equipForm.serial_number}
                    onChange={(e) =>
                      setEquipForm((prev: any) => ({ ...prev, serial_number: e.target.value }))
                    }
                    placeholder="Ex: SN-2025-884"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white font-mono text-xs text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                    Date Mise en Service
                  </label>
                  <input
                    type="date"
                    value={equipForm.date_mise_en_service}
                    onChange={(e) =>
                      setEquipForm((prev: any) => ({
                        ...prev,
                        date_mise_en_service: e.target.value,
                      }))
                    }
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white font-mono text-xs text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                    Statut Opérationnel
                  </label>
                  <select
                    value={equipForm.status}
                    onChange={(e) =>
                      setEquipForm((prev: any) => ({ ...prev, status: e.target.value }))
                    }
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-xs font-bold text-slate-900"
                  >
                    <option value="En Service">En Service</option>
                    <option value="En Maintenance">En Maintenance</option>
                    <option value="À l'Arrêt">À l&apos;Arrêt</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                    Compteur Actuel (Optionnel)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={equipForm.compteur_heures}
                    onChange={(e) =>
                      setEquipForm((prev: any) => ({
                        ...prev,
                        compteur_heures: Math.max(0, Number(e.target.value) || 0),
                      }))
                    }
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white font-mono text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                    Unité du Compteur
                  </label>
                  <select
                    value={equipForm.compteur_unite_defaut}
                    onChange={(e) =>
                      setEquipForm((prev: any) => ({
                        ...prev,
                        compteur_unite_defaut: e.target.value,
                      }))
                    }
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white font-mono text-xs font-bold text-slate-900"
                  >
                    <option value="HEURES">HEURES</option>
                    <option value="CYCLES">CYCLES</option>
                    <option value="KM">KM</option>
                    <option value="TONNES">TONNES</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEquipmentModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-xs transition cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>
                    {editingEquipment ? 'Enregistrer les modifications' : "Créer l'Équipement"}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. MODAL: CREATE / EDIT GENERAL SYSTEM TYPE */}
      {showTypeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-white border-b border-slate-200 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
                  <Settings2 className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-black text-slate-900">
                  {editingType
                    ? `Modifier le Type ${editingType.code}`
                    : 'Nouveau Type de Système Général'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowTypeModal(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSystemType} className="p-5 space-y-4">
              {typeFormError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700">
                  {typeFormError}
                </div>
              )}

              <div>
                <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                  Code Préfixe (2 à 6 lettres) *
                </label>
                <input
                  type="text"
                  maxLength={8}
                  value={typeForm.code}
                  onChange={(e) =>
                    setTypeForm((prev) => ({
                      ...prev,
                      code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''),
                    }))
                  }
                  placeholder="Ex: AIR, SEC, EAU, CVC, ELEC"
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white font-mono text-xs font-black uppercase text-slate-900"
                  required
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Servira de préfixe automatique pour les équipements (ex:{' '}
                  <span className="font-mono font-bold text-slate-600">
                    {typeForm.code || 'AIR'}-01
                  </span>
                  ).
                </p>
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                  Libellé du Système *
                </label>
                <input
                  type="text"
                  value={typeForm.name}
                  onChange={(e) => setTypeForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: Air comprimé, Sécurité incendie, Traitement d'eau..."
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-xs font-semibold text-slate-900"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowTypeModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white transition cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingType ? 'Mettre à jour' : 'Créer le Type'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. MODAL: ARCHIVE / DELETE CONFIRMATION */}
      {archiveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0">
                  <Archive className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {archiveDependencies?.hasHistory
                      ? `Archiver l'équipement ${archiveTarget.id_machine_registered} ?`
                      : `Supprimer / Archiver ${archiveTarget.id_machine_registered} ?`}
                  </h3>
                  <p className="text-xs text-slate-500">{archiveTarget.designation}</p>
                </div>
              </div>

              {archiveDependencies?.hasHistory ? (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
                  <p className="font-bold">
                    Cet équipement possède un historique opérationnel ({archiveDependencies.total}{' '}
                    enregistrement(s)) :
                  </p>
                  <ul className="list-disc list-inside text-[11px] opacity-90 font-mono">
                    <li>{archiveDependencies.mouvementsCount} mouvement(s) PDR</li>
                    <li>{archiveDependencies.preventiveCount} tâche(s) préventive(s)</li>
                    <li>{archiveDependencies.correctiveCount} intervention(s) corrective(s)</li>
                  </ul>
                  <p className="pt-1 font-semibold">
                    Conformément aux règles d&apos;intégrité GMAO, il sera placé en statut ARCHIVEE sans perte d&apos;historique.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-slate-600">
                  Cet équipement n&apos;a aucun historique d&apos;intervention ou de sortie PDR. Voulez-vous le retirer du référentiel ?
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setArchiveTarget(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
                >
                  Annuler
                </button>
                {!archiveDependencies?.hasHistory && (
                  <button
                    type="button"
                    onClick={() => {
                      const { updatedMachine } = transitionMachineLifecycle({
                        machine: archiveTarget,
                        targetStatus: 'ARCHIVEE',
                        preventiveTasks,
                      });
                      handleUpdateMachine(
                        archiveTarget.id_machine_registered,
                        updatedMachine
                      );
                      showToast?.(
                        `Équipement ${archiveTarget.id_machine_registered} archivé`,
                        'info'
                      );
                      setArchiveTarget(null);
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100 transition cursor-pointer"
                  >
                    Archiver seulement
                  </button>
                )}
                <button
                  type="button"
                  onClick={confirmArchiveOrDelete}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-700 text-white transition cursor-pointer"
                >
                  {archiveDependencies?.hasHistory ? (
                    <>
                      <Archive className="w-3.5 h-3.5" />
                      <span>Confirmer l&apos;Archivage</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Supprimer</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
