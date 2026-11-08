import { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Save,
  Users,
  Wrench,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Lock,
  X,
} from 'lucide-react';
import { vaultService } from '../../../../utils/vaultService';
import { storageService } from '../../../../utils/storageService';

/**
 * Admin Security, Zero-Knowledge Vault, PIN management, and RBAC matrix.
 */
export default function SettingsAdminTab({
  currentUser,
  isVaultUnlocked,
  isVaultExists,
  masterPinSetup,
  setMasterPinSetup,
  setupMasterPin,
  showToast,
  getAvailableAccounts,
  setAccountsList,
  currentMasterPin,
  setCurrentMasterPin,
  tempPin,
  setTempPin,
  tempRole,
  setTempRole,
  handleResetAllAccounts,
  accountsList = [],
  updateUserPassword,
  switchSessionToUser,
  technicians = [],
  onNavigateToUsers,
}: any) {
  const [vaultModal, setVaultModal] = useState<{
    isOpen: boolean;
    mode: 'change_password' | 'switch_session' | 'reset_vault';
    targetUsername: string;
    targetDisplayName: string;
    newPassword: string;
    masterPin: string;
    submitting: boolean;
  }>({
    isOpen: false,
    mode: 'change_password',
    targetUsername: '',
    targetDisplayName: '',
    newPassword: '',
    masterPin: '',
    submitting: false,
  });

  useEffect(() => {
    if (!vaultModal.isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !vaultModal.submitting) {
        setVaultModal((prev) => ({ ...prev, isOpen: false, newPassword: '', masterPin: '' }));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [vaultModal.isOpen, vaultModal.submitting]);

  const closeVaultModal = () => {
    if (vaultModal.submitting) return;
    setVaultModal((prev) => ({ ...prev, isOpen: false, newPassword: '', masterPin: '' }));
  };

  const handleConfirmVaultModal = async (e: React.FormEvent) => {
    e.preventDefault();
    const pin = vaultModal.masterPin.trim();
    if (!pin) {
      showToast?.('Veuillez saisir votre Master PIN.', 'error');
      return;
    }

    setVaultModal((prev) => ({ ...prev, submitting: true }));
    try {
      if (vaultModal.mode === 'change_password') {
        const newPass = vaultModal.newPassword.trim();
        if (newPass.length < 8 || !/[a-zA-Z]/.test(newPass) || !/[0-9]/.test(newPass)) {
          showToast?.(
            'Le nouveau mot de passe doit contenir au moins 8 caractères (avec au moins une lettre et un chiffre).',
            'error'
          );
          setVaultModal((prev) => ({ ...prev, submitting: false }));
          return;
        }
        if (updateUserPassword) {
          await updateUserPassword(vaultModal.targetUsername, newPass, pin);
          showToast?.(
            `Mot de passe de @${vaultModal.targetUsername} mis à jour dans le coffre chiffré !`,
            'success'
          );
          if (getAvailableAccounts) setAccountsList(getAvailableAccounts(true));
        }
      } else if (vaultModal.mode === 'switch_session') {
        if (switchSessionToUser) {
          await switchSessionToUser(vaultModal.targetUsername, pin);
          showToast?.(
            `Session basculée vers ${vaultModal.targetDisplayName || `@${vaultModal.targetUsername}`} (2FA Master PIN validé)`,
            'success'
          );
        }
      } else if (vaultModal.mode === 'reset_vault') {
        if (handleResetAllAccounts) {
          await handleResetAllAccounts(pin);
        }
      }
      setVaultModal({
        isOpen: false,
        mode: 'change_password',
        targetUsername: '',
        targetDisplayName: '',
        newPassword: '',
        masterPin: '',
        submitting: false,
      });
    } catch (err: any) {
      showToast?.(err?.message || 'Opération refusée par le coffre-fort.', 'error');
      setVaultModal((prev) => ({ ...prev, submitting: false }));
    }
  };

  const systemAccounts = (accountsList || []).filter((acc: any) => {
    const roleUpper = String(acc?.role || '').toUpperCase();
    const codeLower = String(acc?.code || acc?.username || '').toLowerCase();
    if (codeLower === 'tech' && !acc?.personnelId) return false;
    return !acc?.personnelId && roleUpper !== 'TECHNICIEN';
  });

  const technicianAccounts = (accountsList || []).filter((acc: any) => {
    const roleUpper = String(acc?.role || '').toUpperCase();
    const codeLower = String(acc?.code || acc?.username || '').toLowerCase();
    if (codeLower === 'tech' && !acc?.personnelId) return false;
    return Boolean(acc?.personnelId) || roleUpper === 'TECHNICIEN';
  });

  const activeTechAccountsCount = technicianAccounts.filter(
    (acc: any) => acc?.isActive !== false
  ).length;
  const inactiveTechAccountsCount = technicianAccounts.filter(
    (acc: any) => acc?.isActive === false
  ).length;

  return (
    <div className="space-y-6 max-w-full overflow-hidden animate-in fade-in duration-200">
      {/* 1. Header Card - Info & Active User Status */}
      <div className="p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl border border-indigo-500/20 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shadow-inner shrink-0">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-lg font-bold flex items-center gap-2 flex-wrap">
                <span>Gestion du Compte Administrateur & Sécurité PIN — Vault Chiffré</span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  AES-256 + BCrypt — Aucun mot de passe dans le code
                </span>
              </h3>
              <p className="text-xs text-indigo-200/80 mt-1">
                Architecture Zero-Knowledge : le Master PIN est la clé cryptographique unique déchiffrant le coffre AES-256-GCM.
              </p>
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10 flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 rounded-xl bg-indigo-500 text-white font-extrabold text-xs flex items-center justify-center font-mono">
              {currentUser?.avatar || 'AD'}
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-indigo-300 font-bold">Session Active</div>
              <div className="text-xs font-bold text-white font-mono">{currentUser?.name || 'Administrateur'}</div>
              <div className="text-[10px] text-emerald-300 font-mono font-bold">
                {isVaultUnlocked ? '🟢 Vault Déverrouillé' : '🔒 Vault Verrouillé'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Master PIN Setup - Configuration initiale du coffre */}
      {!isVaultExists && (
        <div className="bg-amber-50 p-6 rounded-3xl border border-amber-200 shadow-md space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-600">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-800">Premier Lancement — Définir Master PIN</h4>
              <p className="text-xs text-amber-700">
                Aucun mot de passe dans le code — Définissez votre Master PIN (4 à 8 chiffres) qui servira de clé de chiffrement maîtresse.
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="password"
              value={masterPinSetup}
              onChange={(e) => setMasterPinSetup(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="Master PIN — 4 à 8 chiffres (ex: 1234)"
              className="flex-1 px-4 py-2.5 rounded-xl border border-amber-300 bg-white text-xs font-mono font-bold focus:border-amber-500 outline-none"
              maxLength={8}
            />
            <button
              onClick={async () => {
                try {
                  if (setupMasterPin) {
                    await setupMasterPin(masterPinSetup);
                    showToast('Master PIN configuré — Coffre-fort chiffré créé avec succès !', 'success');
                    setMasterPinSetup('');
                    if (getAvailableAccounts) setAccountsList(getAvailableAccounts(true));
                  }
                } catch (err: any) {
                  showToast(err.message, 'error');
                }
              }}
              className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs transition cursor-pointer shadow-sm"
            >
              Créer Vault Chiffré (AES-256)
            </button>
          </div>
        </div>
      )}

      {/* 3. System Accounts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Box A: Change PIN & Role & Cryptographic Engine */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-md space-y-5">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800">Master PIN — Clé Maîtresse Cryptographique</h4>
              <p className="text-xs text-slate-500">Architecture Zero-Knowledge : sans le PIN, les données au repos restent chiffrées et indéchiffrables.</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Master PIN Actuel (pour validation)</label>
              <input
                type="password"
                value={currentMasterPin}
                onChange={(e) => setCurrentMasterPin(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="Master PIN actuel — requis pour déchiffrer"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono font-bold focus:bg-white focus:border-indigo-500 outline-none transition"
                maxLength={8}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Nouveau Master PIN (4-8 chiffres)</label>
              <input
                type="password"
                value={tempPin}
                onChange={(e) => setTempPin(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="Nouveau Master PIN (ex: 5678)"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono font-bold focus:bg-white focus:border-indigo-500 outline-none transition"
                maxLength={8}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Libellé du Rôle Administrateur</label>
              <input
                type="text"
                value={tempRole}
                onChange={(e) => setTempRole(e.target.value)}
                placeholder="Ex: Gestionnaire Principal du Stock"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold focus:bg-white focus:border-indigo-500 outline-none transition"
              />
            </div>

            {/* Live Vault Engine — Sel dynamique et chiffrement AES */}
            <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl text-slate-400 font-mono text-[11px] space-y-2 overflow-hidden shadow-inner">
              <div className="flex items-center justify-between text-slate-300 border-b border-slate-800 pb-1.5 font-bold">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  VAULT CHIFFRÉ — PIN = KEY
                </span>
                <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-emerald-400">
                  AES-256-GCM + PBKDF2 100k + BCrypt
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <span className="text-slate-500">Sel Aléatoire:</span>
                <span className="col-span-2 text-indigo-400 truncate select-all">
                  {localStorage.getItem('gmao_vault_salt_v2')?.substring(0, 24) || 'Généré aléatoirement...'}...
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <span className="text-slate-500">Ciphertext:</span>
                <span className="col-span-2 text-amber-400 truncate select-all">
                  {localStorage.getItem('gmao_vault_cipher_v2')?.substring(0, 32) || 'Aucun — Vault verrouillé'}...
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1 pt-1.5 border-t border-slate-800/80">
                <span className="text-slate-500 font-bold">État du Coffre:</span>
                <span className={`col-span-2 font-bold ${isVaultUnlocked ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {isVaultUnlocked
                    ? 'Déverrouillé — Clé valide — En mémoire vive'
                    : 'Verrouillé — Données chiffrées au repos'}
                </span>
              </div>
            </div>

            <button
              onClick={async () => {
                try {
                  if (!currentMasterPin) {
                    showToast('Veuillez saisir le Master PIN actuel pour validation.', 'error');
                    return;
                  }
                  if (!tempPin || tempPin.length < 4) {
                    showToast('Le nouveau Master PIN doit comporter au moins 4 chiffres.', 'error');
                    return;
                  }
                  const res = await vaultService.changeMasterPin(currentMasterPin, tempPin);
                  storageService.removeItem('gmao_admin_pin');
                  storageService.setItem('gmao_admin_role', tempRole.trim());
                  showToast(res.message || 'Master PIN modifié — Coffre-fort re-chiffré avec la nouvelle clé !', 'success');
                  setCurrentMasterPin('');
                  setTempPin('');
                } catch (err: any) {
                  showToast(err.message, 'error');
                }
              }}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-xs transition shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>Changer Master PIN — Re-chiffrer Vault</span>
            </button>
          </div>
        </div>

        {/* Box B: Comptes Portail Système — 2FA */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-md space-y-5 flex flex-col justify-between">
          <div className="space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800">Comptes Portail Système ({systemAccounts.length})</h4>
                  <p className="text-xs text-slate-500">
                    Rôles globaux : Administrateur, Magasinier PDR, Consultateur (Viewer)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  setVaultModal({
                    isOpen: true,
                    mode: 'reset_vault',
                    targetUsername: '',
                    targetDisplayName: 'Coffre-Fort Complet',
                    newPassword: '',
                    masterPin: '',
                    submitting: false,
                  })
                }
                className="text-[11px] font-bold text-rose-600 hover:bg-rose-50 px-2.5 py-1.5 rounded-xl transition border border-rose-200 cursor-pointer"
              >
                Reset Vault
              </button>
            </div>

            <div className="space-y-3">
              {systemAccounts.map((userAcc: any) => {
                const accLogin = userAcc.code || userAcc.username;
                const accLabel = userAcc.libelle || userAcc.name || accLogin;
                return (
                  <div
                    key={userAcc.id || accLogin}
                    className="p-3.5 rounded-2xl border border-slate-200/80 hover:border-indigo-200 bg-slate-50/50 hover:bg-indigo-50/30 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-slate-900 text-white font-extrabold text-xs flex items-center justify-center font-mono shrink-0 shadow-xs">
                        {String(accLogin || 'US').substring(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-800 flex items-center gap-2 flex-wrap">
                          <span className="truncate">{accLabel}</span>
                          <span className="text-[10px] font-mono text-slate-500">@{accLogin}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-slate-200 text-slate-700">
                            {userAcc.role}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                          Mot de passe : •••••••• (Hash BCrypt dans le coffre chiffré) — ID : {(userAcc.id || 'ID-001').substring(0, 12)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={() =>
                          setVaultModal({
                            isOpen: true,
                            mode: 'change_password',
                            targetUsername: accLogin,
                            targetDisplayName: accLabel,
                            newPassword: '',
                            masterPin: '',
                            submitting: false,
                          })
                        }
                        className="px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-amber-500 hover:text-white text-slate-700 font-bold text-[11px] rounded-xl transition shadow-2xs cursor-pointer"
                      >
                        Changer Pass
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setVaultModal({
                            isOpen: true,
                            mode: 'switch_session',
                            targetUsername: accLogin,
                            targetDisplayName: `${accLabel} (@${accLogin})`,
                            newPassword: '',
                            masterPin: '',
                            submitting: false,
                          })
                        }
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] rounded-xl transition shadow-2xs cursor-pointer"
                      >
                        Basculer (2FA)
                      </button>
                    </div>
                  </div>
                );
              })}

              {systemAccounts.length === 0 && (
                <div className="text-xs text-slate-400 text-center py-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  Coffre-fort verrouillé — Veuillez saisir le Master PIN pour charger les comptes déchiffrés.
                </div>
              )}
            </div>
          </div>

          {/* Explicit Bridge Callout inside Box B */}
          <div className="p-3.5 rounded-2xl bg-purple-50/70 border border-purple-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs text-purple-950">
              <span className="font-bold block">Accès Techniciens Individuels ({activeTechAccountsCount} actif{activeTechAccountsCount > 1 ? 's' : ''})</span>
              <span className="text-[11px] text-purple-700">
                Les comptes techniciens sont rattachés aux fiches matricules (<code className="font-mono font-bold">TECH-0X</code>).
              </span>
            </div>
            {onNavigateToUsers && (
              <button
                type="button"
                onClick={onNavigateToUsers}
                className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold flex items-center gap-1.5 shrink-0 cursor-pointer shadow-2xs transition"
              >
                <span>Équipe & Utilisateurs</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 4. Section C — Comptes Techniciens Terrain (Liés au Référentiel Personnel) */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-md space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-50 border border-purple-200/80 flex items-center justify-center text-purple-700 shrink-0">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm font-bold text-slate-800">
                  Comptes Techniciens Terrain — Liés au Personnel (SSOT AuthService)
                </h4>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  {activeTechAccountsCount} actif{activeTechAccountsCount > 1 ? 's' : ''}
                </span>
                {inactiveTechAccountsCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-slate-600 border border-slate-200">
                    {inactiveTechAccountsCount} désactivé{inactiveTechAccountsCount > 1 ? 's' : ''}
                  </span>
                )}
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-50 text-purple-800 border border-purple-200">
                  {Array.isArray(technicians) ? technicians.length : 0} fiche(s) technicien
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                L&apos;activation, la désactivation et la définition du mot de passe d&apos;un technicien s&apos;effectuent depuis sa fiche dans <b>Équipe &amp; Utilisateurs</b> afin de préserver le lien <code className="font-mono">personnelId</code> (périmètre R4 « Mes Tâches »).
              </p>
            </div>
          </div>

          {onNavigateToUsers && (
            <button
              type="button"
              onClick={onNavigateToUsers}
              className="px-4 py-2 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-2 self-start md:self-auto shrink-0 cursor-pointer shadow-xs transition active:scale-95"
            >
              <span>Gérer les accès dans Équipe &amp; Utilisateurs</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {technicianAccounts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {technicianAccounts.map((techAcc: any) => {
              const isActive = techAcc.isActive !== false;
              const code = techAcc.personnelId || techAcc.id || techAcc.code;
              const loginId = techAcc.username || techAcc.code;
              return (
                <div
                  key={techAcc.id || loginId}
                  className={`p-3.5 rounded-2xl border transition flex items-center justify-between gap-3 ${
                    isActive
                      ? 'bg-slate-50/60 border-slate-200/90 hover:border-purple-200'
                      : 'bg-slate-100/60 border-slate-200/60 opacity-70'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-900 truncate">
                        {techAcc.personnelName || techAcc.name}
                      </span>
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-purple-100 text-purple-900 border border-purple-200">
                        {code}
                      </span>
                      {isActive ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                          Actif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-slate-200 text-slate-700">
                          <XCircle className="w-2.5 h-2.5 text-slate-500" />
                          Désactivé
                        </span>
                      )}
                    </div>
                    <div className="text-[10.5px] text-slate-500 font-mono mt-0.5 truncate">
                      Login: <b>@{loginId}</b>
                      {techAcc.id_zone ? ` • Zone: ${techAcc.id_zone}` : ''}
                    </div>
                  </div>

                  {isActive && switchSessionToUser && (
                    <button
                      type="button"
                      onClick={() =>
                        setVaultModal({
                          isOpen: true,
                          mode: 'switch_session',
                          targetUsername: loginId,
                          targetDisplayName: `${techAcc.personnelName || loginId} (${code})`,
                          newPassword: '',
                          masterPin: '',
                          submitting: false,
                        })
                      }
                      className="px-2.5 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-600 text-purple-800 hover:text-white border border-purple-200 text-[11px] font-bold transition shrink-0 cursor-pointer"
                      title="Tester la vue de ce technicien (2FA Master PIN)"
                    >
                      Basculer
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-5 rounded-2xl bg-slate-50 border border-dashed border-slate-200 text-center space-y-2">
            <p className="text-xs font-bold text-slate-700">
              Aucun compte de connexion technicien configuré (Mode Usine Vide ou accès non activés).
            </p>
            <p className="text-[11px] text-slate-500">
              Ouvrez <b>Équipe &amp; Utilisateurs</b> et cliquez sur l&apos;icône clé 🔑 d&apos;un technicien pour activer son compte individuel.
            </p>
          </div>
        )}
      </div>

      {/* Vault Cryptographic Action Modal (Replaces blocked window.prompt) */}
      {vaultModal.isOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={closeVaultModal}
        >
          <div
            className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={`px-5 py-4 border-b flex items-center justify-between ${
                vaultModal.mode === 'reset_vault'
                  ? 'bg-rose-50 border-rose-200'
                  : 'bg-slate-900 border-slate-800 text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    vaultModal.mode === 'reset_vault'
                      ? 'bg-rose-100 text-rose-700'
                      : 'bg-indigo-500/20 text-indigo-300 border border-indigo-400/30'
                  }`}
                >
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h4
                    className={`text-sm font-bold ${
                      vaultModal.mode === 'reset_vault' ? 'text-rose-950' : 'text-white'
                    }`}
                  >
                    {vaultModal.mode === 'change_password' &&
                      `Modifier le mot de passe (@${vaultModal.targetUsername})`}
                    {vaultModal.mode === 'switch_session' &&
                      'Basculement de Session Sécurisé (2FA)'}
                    {vaultModal.mode === 'reset_vault' &&
                      'Réinitialiser le Coffre-Fort Cryptographique'}
                  </h4>
                  <p
                    className={`text-[11px] ${
                      vaultModal.mode === 'reset_vault' ? 'text-rose-700' : 'text-slate-300'
                    }`}
                  >
                    Validation par clé maîtresse Master PIN (AES-256-GCM)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeVaultModal}
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  vaultModal.mode === 'reset_vault'
                    ? 'text-rose-600 hover:bg-rose-100'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmVaultModal} className="p-5 space-y-4">
              {vaultModal.mode === 'switch_session' && (
                <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-xs text-indigo-950">
                  Vous allez basculer votre session active vers{' '}
                  <b className="font-mono">{vaultModal.targetDisplayName}</b>.
                </div>
              )}

              {vaultModal.mode === 'reset_vault' && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 leading-relaxed">
                  <b>Attention :</b> Cette action réinitialise le coffre-fort chiffré et rétablit tous les comptes système aux valeurs d&apos;usine.
                </div>
              )}

              {vaultModal.mode === 'change_password' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nouveau mot de passe (min. 4 caractères)
                  </label>
                  <input
                    type="password"
                    required
                    minLength={4}
                    autoFocus
                    value={vaultModal.newPassword}
                    onChange={(e) =>
                      setVaultModal((prev) => ({ ...prev, newPassword: e.target.value }))
                    }
                    placeholder="Saisir le nouveau mot de passe..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono font-bold focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Master PIN requis pour autoriser l&apos;opération
                </label>
                <input
                  type="password"
                  required
                  autoFocus={vaultModal.mode !== 'change_password'}
                  maxLength={8}
                  value={vaultModal.masterPin}
                  onChange={(e) =>
                    setVaultModal((prev) => ({
                      ...prev,
                      masterPin: e.target.value.replace(/[^0-9]/g, ''),
                    }))
                  }
                  placeholder="Master PIN (4 à 8 chiffres)"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono font-bold focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeVaultModal}
                  disabled={vaultModal.submitting}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={vaultModal.submitting}
                  className={`px-4 py-2 rounded-xl text-white text-xs font-bold shadow-xs transition cursor-pointer ${
                    vaultModal.mode === 'reset_vault'
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  {vaultModal.submitting ? 'Validation...' : 'Confirmer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
