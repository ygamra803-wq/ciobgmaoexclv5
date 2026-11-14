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
} from 'lucide-react';
import { useTranslation } from '../../../../i18n/I18nContext';

export interface AccessFormState {
  username: string;
  role: string;
  plainPassword: string;
  isActive: boolean;
}

export interface UtilisateursModalsProps {
  userToDelete: { id: string; nom?: string; source?: string } | null;
  setUserToDelete: (u: any) => void;
  confirmDelete: () => void;
  userForAccessModal: { id: string; nom?: string } | null;
  setUserForAccessModal: (u: any) => void;
  accessForm: AccessFormState;
  setAccessForm: React.Dispatch<React.SetStateAction<AccessFormState>>;
  accessError: string;
  accessSavedMsg: string;
  handleSaveAccessModal: (e: React.FormEvent) => void;
  showFormulasModal: boolean;
  setShowFormulasModal: (v: boolean) => void;
}

export default function UtilisateursModals({
  userToDelete,
  setUserToDelete,
  confirmDelete,
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
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-sm p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h4 className="text-sm font-black text-slate-900">{t('utilisateurs.modal.delete_title')}</h4>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                {t('utilisateurs.modal.delete_confirm_msg')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="flex-1 py-2 text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
              >
                {t('utilisateurs.buttons.cancel')}
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="flex-1 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out"
              >
                {t('utilisateurs.buttons.confirm_delete')}
              </button>
            </div>
          </div>
        </div>
      )}

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
                  <option value="RESPONSABLE_MAGASIN">Magasin / RMG (Stock &amp; Mouvements)</option>
                  <option value="VIEWER">Observateur (Lecture seule)</option>
                  <option value="ADMIN">Administrateur</option>
                </select>
              </div>

              {/* Password / PIN */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Nouveau mot de passe / Code PIN
                </label>
                <input
                  type="password"
                  value={accessForm.plainPassword}
                  onChange={(e) =>
                    setAccessForm((prev) => ({ ...prev, plainPassword: e.target.value }))
                  }
                  placeholder="Laisser vide pour conserver le mot de passe actuel (ou saisir min. 4 car.)"
                  className="w-full h-10 px-3 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-600 focus:bg-white transition"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Pour un nouveau compte sans mot de passe saisi, le code initial par défaut est <b>tech</b> (ou <b>1234</b>).
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
    </>
  );
}
