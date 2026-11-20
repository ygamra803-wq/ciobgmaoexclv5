import React from 'react';
import {
  AlertTriangle,
  Key,
  X,
  Check,
  Unlock,
  Lock,
  Calculator,
  Wrench,
  ClipboardList,
  Crown,
  MapPin,
  ArrowRightLeft,
} from 'lucide-react';
import { useTranslation } from '../../../../i18n/I18nContext';

import type { PersonnelWorkloadMetrics } from '../../../../application/services/PersonnelWorkloadService';

export interface AccessFormState {
  username: string;
  role: string;
  plainPassword: string;
  isActive: boolean;
}

export interface UtilisateursModalsProps {
  userToDelete: { id: string; nom?: string; source?: string } | null;
  userToDeleteWorkload?: PersonnelWorkloadMetrics | null;
  setUserToDelete: (u: any) => void;
  confirmDelete: () => void;
  onOpenReassign?: (u: { id: string; nom?: string; source?: string }) => void;
  userToReassign?: { id: string; nom?: string } | null;
  userToReassignWorkload?: PersonnelWorkloadMetrics | null;
  setUserToReassign?: (u: any) => void;
  reassignTargetId?: string;
  setReassignTargetId?: (id: string) => void;
  reassignScopes?: {
    includeMachines: boolean;
    includeOpenBts: boolean;
    includeActivePm: boolean;
  };
  setReassignScopes?: React.Dispatch<
    React.SetStateAction<{
      includeMachines: boolean;
      includeOpenBts: boolean;
      includeActivePm: boolean;
    }>
  >;
  activeTechniciansForReassign?: Array<{
    id: string;
    nom: string;
    specialite?: string;
    id_zone?: string;
    assignedCount: number;
  }>;
  handleSubmitReassign?: (e: React.FormEvent) => void;
  userForAccessModal: { id: string; nom?: string } | null;
  setUserForAccessModal: (u: any) => void;
  accessForm: AccessFormState;
  setAccessForm: React.Dispatch<React.SetStateAction<AccessFormState>>;
  accessError: string | null;
  accessSavedMsg: string | null;
  handleSaveAccessModal: (e: React.FormEvent) => void;
  showFormulasModal: boolean;
  setShowFormulasModal: (v: boolean) => void;
}

export default function UtilisateursModals({
  userToDelete,
  userToDeleteWorkload,
  setUserToDelete,
  confirmDelete,
  onOpenReassign,
  userToReassign,
  userToReassignWorkload,
  setUserToReassign,
  reassignTargetId = '',
  setReassignTargetId,
  reassignScopes = { includeMachines: true, includeOpenBts: true, includeActivePm: true },
  setReassignScopes,
  activeTechniciansForReassign = [],
  handleSubmitReassign,
  userForAccessModal,
  setUserForAccessModal,
  accessForm,
  setAccessForm,
  accessError,
  accessSavedMsg,
  handleSaveAccessModal,
  showFormulasModal,
  setShowFormulasModal,
}: UtilisateursModalsProps) {
  const { t } = useTranslation();

  return (
    <>
      {/* Delete Confirmation Modal */}
      {userToDelete && (() => {
        const hasWorkload = Boolean(
          userToDeleteWorkload &&
            (userToDeleteWorkload.assignedMachinesCount > 0 ||
              userToDeleteWorkload.openCorrectiveCount > 0 ||
              userToDeleteWorkload.activePreventiveTasksCount > 0 ||
              userToDeleteWorkload.activeExternalSortiesCount > 0)
        );
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="text-center">
                <h4 className="text-sm font-black text-slate-900">{t('utilisateurs.modal.delete_title')}</h4>
                <p className="text-[11px] font-mono font-bold text-indigo-700 mt-1">
                  {userToDelete.id} • {userToDelete.nom || ''}
                </p>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  {t('utilisateurs.modal.delete_confirm_msg')}
                </p>
              </div>

              {hasWorkload && userToDeleteWorkload && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1.5">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Charge opérationnelle active détectée :</span>
                  </div>
                  <ul className="list-disc list-inside text-[11px] font-mono space-y-0.5">
                    {userToDeleteWorkload.assignedMachinesCount > 0 && (
                      <li>
                        {userToDeleteWorkload.assignedMachinesCount} machine(s) affectée(s)
                        {userToDeleteWorkload.assignedMachineCodes.length > 0 &&
                          ` (${userToDeleteWorkload.assignedMachineCodes.slice(0, 4).join(', ')}${
                            userToDeleteWorkload.assignedMachineCodes.length > 4 ? '…' : ''
                          })`}
                      </li>
                    )}
                    {userToDeleteWorkload.openCorrectiveCount > 0 && (
                      <li>{userToDeleteWorkload.openCorrectiveCount} BT correctif(s) ouvert(s)</li>
                    )}
                    {userToDeleteWorkload.activePreventiveTasksCount > 0 && (
                      <li>{userToDeleteWorkload.activePreventiveTasksCount} tâche(s) PM active(s)</li>
                    )}
                    {userToDeleteWorkload.activeExternalSortiesCount > 0 && (
                      <li>{userToDeleteWorkload.activeExternalSortiesCount} sortie(s) externe(s) en cours</li>
                    )}
                  </ul>
                  <p className="text-[10.5px] font-medium pt-0.5 text-amber-800">
                    La fiche sera archivée (soft-delete) pour préserver l&apos;historique KPI et son accès GMAO sera désactivé. Pensez à réaffecter les BT ouverts et machines.
                  </p>
                </div>
              )}

              {hasWorkload && userToDelete.id.startsWith('TECH-') && onOpenReassign && (
                <button
                  type="button"
                  onClick={() => {
                    const target = userToDelete;
                    setUserToDelete(null);
                    onOpenReassign(target);
                  }}
                  className="w-full py-2 px-3 text-xs font-bold text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Réaffecter la charge vers un autre technicien d&apos;abord</span>
                </button>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setUserToDelete(null)}
                  className="flex-1 py-2 text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                >
                  {t('utilisateurs.buttons.cancel')}
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  className="flex-1 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out cursor-pointer"
                >
                  {hasWorkload ? 'Archiver & Désactiver' : t('utilisateurs.buttons.confirm_delete')}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Admin Account Access & Password Modal (R1/R2 Individual Identity) */}
      {userForAccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-white border-b border-slate-200 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    Accès &amp; Connexion GMAO
                  </h3>
                  <p className="text-[11px] text-slate-500 font-mono">
                    {userForAccessModal.id} • {userForAccessModal.nom}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setUserForAccessModal(null)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAccessModal} className="p-5 space-y-4">
              {accessError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{accessError}</span>
                </div>
              )}
              {accessSavedMsg && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{accessSavedMsg}</span>
                </div>
              )}

              {/* Account Active Toggle */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    Autoriser la connexion à l&apos;application
                  </div>
                  <div className="text-[10.5px] text-slate-500 mt-0.5">
                    Désactiver retire le compte de l&apos;écran de connexion sans supprimer la fiche personnel.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setAccessForm((prev) => ({ ...prev, isActive: !prev.isActive }))
                  }
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
                    accessForm.isActive
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                      : 'bg-slate-200 text-slate-700 border-slate-300'
                  }`}
                >
                  {accessForm.isActive ? (
                    <>
                      <Unlock className="w-3.5 h-3.5" />
                      <span>Actif</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-3.5 h-3.5" />
                      <span>Désactivé</span>
                    </>
                  )}
                </button>
              </div>

              {/* Login Identifier */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Identifiant de connexion
                </label>
                <input
                  type="text"
                  required
                  value={accessForm.username}
                  onChange={(e) =>
                    setAccessForm((prev) => ({ ...prev, username: e.target.value }))
                  }
                  placeholder="Ex: tech-01, rachid..."
                  className="w-full h-10 px-3 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-600 focus:bg-white transition"
                />
              </div>

              {/* Role Lens */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Rôle applicatif (Lentille GMAO)
                </label>
                <select
                  value={accessForm.role}
                  onChange={(e) =>
                    setAccessForm((prev) => ({ ...prev, role: e.target.value }))
                  }
                  className="w-full h-10 px-3 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-600 focus:bg-white transition"
                >
                  <option value="TECHNICIEN">Technicien (Exécution PM, Pannes &amp; PDR)</option>
                  <option value="OPERATEUR">Opérateur Ligne (Signalement DI / Pannes)</option>
                  <option value="RESPONSABLE_MAGASIN">Magasin / RMG (Stock &amp; Mouvements)</option>
                  <option value="RESPONSABLE_MAINTENANCE">Responsable Maintenance (Validation &amp; Parc)</option>
                  <option value="VIEWER">Observateur (Lecture seule)</option>
                  <option value="ADMIN">Administrateur</option>
                </select>
              </div>

              {/* Password */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Nouveau mot de passe
                </label>
                <input
                  type="password"
                  value={accessForm.plainPassword}
                  onChange={(e) =>
                    setAccessForm((prev) => ({ ...prev, plainPassword: e.target.value }))
                  }
                  placeholder="Laisser vide pour conserver l'actuel (ou min. 8 car. à l'activation)"
                  className="w-full h-10 px-3 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-600 focus:bg-white transition"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Min. 8 caractères (au moins 1 lettre et 1 chiffre), différent de la clé de licence. Obligatoire à la première activation.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setUserForAccessModal(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition cursor-pointer shadow-sm"
                >
                  Enregistrer l&apos;accès
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Excel Formulas Preview Modal */}
      {showFormulasModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-5 space-y-4 animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 shrink-0">
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <span>{t('utilisateurs.formulas.title')}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                      {t('utilisateurs.formulas.badge')}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    {t('utilisateurs.formulas.subtitle')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowFormulasModal(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer shrink-0"
                title={t('utilisateurs.buttons.close')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content: 4 Formula Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Auto-ID Technicien */}
              <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-blue-300 transition">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                    <Wrench className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="truncate">{t('utilisateurs.formulas.tech_id_title')}</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-100/80 text-blue-800 border border-blue-200 shrink-0">
                    {t('utilisateurs.formulas.tech_id_sheet')}
                  </span>
                </div>
                <div className="font-mono text-xs text-blue-800 font-bold bg-white p-2 rounded-lg border border-blue-100">
                  =&quot;TECH-&quot; &amp; TEXT(COUNTIF(Tech[ID],&quot;TECH-*&quot;)+1, &quot;00&quot;)
                </div>
                <p className="text-[10.5px] text-slate-500 leading-tight">
                  {t('utilisateurs.formulas.tech_id_desc')}
                </p>
              </div>

              {/* Auto-ID Opérateur */}
              <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-emerald-300 transition">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                    <ClipboardList className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="truncate">{t('utilisateurs.formulas.op_id_title')}</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-100/80 text-emerald-800 border border-emerald-200 shrink-0">
                    {t('utilisateurs.formulas.op_id_sheet')}
                  </span>
                </div>
                <div className="font-mono text-xs text-emerald-800 font-bold bg-white p-2 rounded-lg border border-emerald-100">
                  =&quot;OP-&quot; &amp; TEXT(COUNTIF(Op[Type],&quot;OPERATEUR&quot;)+1, &quot;00&quot;)
                </div>
                <p className="text-[10.5px] text-slate-500 leading-tight">
                  {t('utilisateurs.formulas.op_id_desc')}
                </p>
              </div>

              {/* Auto-ID Responsable */}
              <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-purple-300 transition">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                    <Crown className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                    <span className="truncate">{t('utilisateurs.formulas.resp_id_title')}</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-purple-100/80 text-purple-800 border border-purple-200 shrink-0">
                    {t('utilisateurs.formulas.resp_id_sheet')}
                  </span>
                </div>
                <div className="font-mono text-xs text-purple-800 font-bold bg-white p-2 rounded-lg border border-purple-100">
                  =&quot;RESP-&quot; &amp; TEXT(COUNTIF(Op[Type],&quot;RESPONSABLE&quot;)+1, &quot;00&quot;)
                </div>
                <p className="text-[10.5px] text-slate-500 leading-tight">
                  {t('utilisateurs.formulas.resp_id_desc')}
                </p>
              </div>

              {/* Liaison Zone & Templates */}
              <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-amber-300 transition">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                    <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span className="truncate">{t('utilisateurs.formulas.zone_link_title')}</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-100/80 text-amber-800 border border-amber-200 shrink-0">
                    {t('utilisateurs.formulas.zone_link_col')}
                  </span>
                </div>
                <div className="font-mono text-xs text-amber-800 font-bold bg-white p-2 rounded-lg border border-amber-100">
                  =[@id_zone] → Zone!B:B
                </div>
                <p className="text-[10.5px] text-slate-500 leading-tight">
                  {t('utilisateurs.formulas.zone_link_desc')}
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-400 font-medium">
                {t('utilisateurs.formulas.footer_note')}
              </span>
              <button
                onClick={() => setShowFormulasModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out cursor-pointer"
              >
                {t('utilisateurs.buttons.close')}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 1-Click Technician Workload Reassignment Modal */}
      {userToReassign && setUserToReassign && handleSubmitReassign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-white border-b border-slate-200 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700">
                  <ArrowRightLeft className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    Réaffecter la charge terrain
                  </h3>
                  <p className="text-[11px] text-slate-500 font-mono">
                    De {userToReassign.id} • {userToReassign.nom}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setUserToReassign(null)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitReassign} className="p-5 space-y-4">
              {userToReassignWorkload && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs flex flex-wrap items-center gap-2 font-mono">
                  <span className="font-sans font-bold text-slate-600">Charge active :</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                    {userToReassignWorkload.assignedMachinesCount} machine(s)
                  </span>
                  <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-bold">
                    {userToReassignWorkload.openCorrectiveCount} BT ouv.
                  </span>
                  <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold">
                    {userToReassignWorkload.activePreventiveTasksCount} PM actifs
                  </span>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Technicien remplaçant (actif)
                </label>
                <select
                  required
                  value={reassignTargetId}
                  onChange={(e) => setReassignTargetId?.(e.target.value)}
                  className="w-full h-10 px-3 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                >
                  <option value="">— Sélectionner un technicien actif —</option>
                  {activeTechniciansForReassign
                    .filter((t) => t.id !== userToReassign.id)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nom} ({t.id}){t.id_zone ? ` • Zone ${t.id_zone}` : ''} • Charge actuelle : {t.assignedCount}
                      </option>
                    ))}
                </select>
                {activeTechniciansForReassign.filter((t) => t.id !== userToReassign.id).length === 0 && (
                  <p className="text-[11px] text-amber-700 mt-1.5 font-medium">
                    Aucun autre technicien actif disponible pour reprendre la charge.
                  </p>
                )}
              </div>

              {setReassignScopes && (
                <div className="space-y-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    Périmètre du transfert (historique clôturé préservé)
                  </div>
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={reassignScopes.includeMachines}
                      onChange={(e) =>
                        setReassignScopes((prev) => ({
                          ...prev,
                          includeMachines: e.target.checked,
                        }))
                      }
                      className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300"
                    />
                    <span>Transférer les machines actives affectées ({userToReassignWorkload?.assignedMachinesCount ?? 0})</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={reassignScopes.includeOpenBts}
                      onChange={(e) =>
                        setReassignScopes((prev) => ({
                          ...prev,
                          includeOpenBts: e.target.checked,
                        }))
                      }
                      className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300"
                    />
                    <span>Transférer les BT correctifs ouverts ({userToReassignWorkload?.openCorrectiveCount ?? 0})</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={reassignScopes.includeActivePm}
                      onChange={(e) =>
                        setReassignScopes((prev) => ({
                          ...prev,
                          includeActivePm: e.target.checked,
                        }))
                      }
                      className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300"
                    />
                    <span>Transférer les tâches PM actives ({userToReassignWorkload?.activePreventiveTasksCount ?? 0})</span>
                  </label>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setUserToReassign(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={!reassignTargetId}
                  className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 rounded-xl transition cursor-pointer shadow-sm"
                >
                  Transférer la charge
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
