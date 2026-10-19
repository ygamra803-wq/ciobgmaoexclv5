import {
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Save,
  Users,
} from 'lucide-react';
import { vaultService } from '../../../utils/vaultService';
import { storageService } from '../../../utils/storageService';

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
}) {
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
                    if (getAvailableAccounts) setAccountsList(getAvailableAccounts());
                  }
                } catch (err) {
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
                } catch (err) {
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

        {/* Box B: Comptes Système — 2FA */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-md space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800">Comptes Système — Coffre Protégé</h4>
                <p className="text-xs text-slate-500">Authentification 2FA : Code d'accès + Mot de passe + Master PIN</p>
              </div>
            </div>
            <button
              onClick={handleResetAllAccounts}
              className="text-[11px] font-bold text-rose-600 hover:bg-rose-50 px-2.5 py-1.5 rounded-xl transition border border-rose-200 cursor-pointer"
            >
              Reset Vault
            </button>
          </div>

          <div className="space-y-3">
            {accountsList.map((userAcc) => (
              <div
                key={userAcc.id || userAcc.code || userAcc.username}
                className="p-3.5 rounded-2xl border border-slate-200/80 hover:border-indigo-200 bg-slate-50/50 hover:bg-indigo-50/30 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 text-white font-extrabold text-xs flex items-center justify-center font-mono shrink-0 shadow-xs">
                    {(userAcc.code || userAcc.username || 'US').substring(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-800 flex items-center gap-2 flex-wrap">
                      <span className="truncate">{userAcc.libelle || userAcc.name}</span>
                      <span className="text-[10px] font-mono text-slate-500">@{userAcc.code || userAcc.username}</span>
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
                    onClick={async () => {
                      const newPass = prompt(`Nouveau mot de passe pour @${userAcc.code || userAcc.username} (au moins 4 caractères) :`);
                      if (!newPass || newPass.trim().length < 4) return;
                      const pin = prompt('Master PIN requis pour déverrouiller et mettre à jour le coffre-fort :');
                      if (!pin) return;
                      try {
                        if (updateUserPassword) {
                          await updateUserPassword(userAcc.code || userAcc.username, newPass.trim(), pin.trim());
                          showToast(`Mot de passe de @${userAcc.code || userAcc.username} mis à jour dans le coffre chiffré !`, 'success');
                          if (getAvailableAccounts) setAccountsList(getAvailableAccounts());
                        }
                      } catch (err) {
                        showToast(err.message, 'error');
                      }
                    }}
                    className="px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-amber-500 hover:text-white text-slate-700 font-bold text-[11px] rounded-xl transition shadow-2xs cursor-pointer"
                  >
                    Changer Pass
                  </button>
                  <button
                    onClick={async () => {
                      const pin = prompt('Master PIN requis pour confirmer le basculement de session (2FA) :');
                      if (!pin) return;
                      try {
                        if (switchSessionToUser) {
                          await switchSessionToUser(userAcc.code || userAcc.username, pin.trim());
                          showToast(`Session -> @${userAcc.code || userAcc.username} — 2FA: Code + PIN`, 'success');
                        }
                      } catch (err) {
                        showToast(err.message, 'error');
                      }
                    }}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] rounded-xl transition shadow-2xs cursor-pointer"
                  >
                    Basculer (2FA)
                  </button>
                </div>
              </div>
            ))}

            {accountsList.length === 0 && (
              <div className="text-xs text-slate-400 text-center py-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                Coffre-fort verrouillé — Veuillez saisir le Master PIN pour charger les comptes déchiffrés.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
