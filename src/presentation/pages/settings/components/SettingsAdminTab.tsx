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
import { SecurityService } from '../../../../core/security/SecurityService';
import Action3DButton from '../../../components/common/Action3DButton';
import { SettingsSectionCard, SETTINGS_BUTTON_STYLES, SETTINGS_INPUT_CLASS } from './settingsUi';

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
    <div className="space-y-6 max-w-full overflow-hidden">
      {/* 1. Header Card - Info & Active User Status */}
      <SettingsSectionCard
        title={
          <span className="flex items-center gap-2 flex-wrap">
            <span>Gestion du Compte Administrateur &amp; Sécurité PIN — Vault Chiffré</span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
              AES-256 + BCrypt
            </span>
          </span>
        }
        description="Architecture Zero-Knowledge : le Master PIN est la clé cryptographique unique déchiffrant le coffre AES-256-GCM."
        icon={<ShieldCheck />}
        headerRight={
          <div className="bg-slate-50/80 px-3.5 py-2 rounded-2xl border border-slate-200/90 flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-full bg-sky-800 text-white font-extrabold text-xs flex items-center justify-center font-mono shadow-xs">
              {currentUser?.avatar || 'AD'}
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                Session Active
              </div>
              <div className="text-xs font-extrabold text-slate-900 font-mono">
                {currentUser?.name || 'Administrateur'}
              </div>
              <div
                className={`text-[10px] font-mono font-bold ${
                  isVaultUnlocked ? 'text-emerald-700' : 'text-amber-700'
                }`}
              >
                {isVaultUnlocked ? 'Vault Déverrouillé' : 'Vault Verrouillé'}
              </div>
            </div>
          </div>
        }
      >
        <div className="text-xs text-slate-600 flex flex-wrap items-center justify-between gap-2 bg-slate-50/70 px-4 py-3 rounded-xl border border-slate-200/80">
          <span>
            Aucun mot de passe en clair n&apos;est stocké dans le code ou la base locale.
          </span>
          <span className="font-mono text-[11px] text-slate-500">
            Chiffrement : AES-256-GCM • Dérivation : PBKDF2 (100 000 itérations)
          </span>
        </div>
      </SettingsSectionCard>

      {/* 2. Master PIN Setup - Configuration initiale du coffre */}
      {!isVaultExists && (
        <SettingsSectionCard
          title="Premier Lancement — Définir Master PIN"
          description="Aucun mot de passe dans le code — Définissez votre Master PIN (4 à 8 chiffres) qui servira de clé de chiffrement maîtresse."
          icon={<ShieldAlert />}
          tone="warning"
        >
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="password"
              value={masterPinSetup}
              onChange={(e) => setMasterPinSetup(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="Master PIN — 4 à 8 chiffres (ex: 1234)"
              className={`${SETTINGS_INPUT_CLASS} flex-1 font-mono font-bold bg-white`}
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
              className={SETTINGS_BUTTON_STYLES.primary}
            >
              Créer Vault Chiffré (AES-256)
            </button>
          </div>
        </SettingsSectionCard>
      )}

      {/* 3. System Accounts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Box A: Change PIN & Role & Cryptographic Engine */}
        <SettingsSectionCard
          title="Master PIN — Clé Maîtresse Cryptographique"
          description="Architecture Zero-Knowledge : sans le PIN, les données au repos restent chiffrées et indéchiffrables."
          icon={<KeyRound />}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Master PIN Actuel (pour validation)
              </label>
              <input
                type="password"
                value={currentMasterPin}
                onChange={(e) => setCurrentMasterPin(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="Master PIN actuel — requis pour déchiffrer"
                className={`${SETTINGS_INPUT_CLASS} font-mono font-bold`}
                maxLength={8}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Nouveau Master PIN (4-8 chiffres)
              </label>
              <input
                type="password"
                value={tempPin}
                onChange={(e) => setTempPin(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="Nouveau Master PIN (ex: 5678)"
                className={`${SETTINGS_INPUT_CLASS} font-mono font-bold`}
                maxLength={8}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Libellé du Rôle Administrateur
              </label>
              <input
                type="text"
                value={tempRole}
                onChange={(e) => setTempRole(e.target.value)}
                placeholder="Ex: Gestionnaire Principal du Stock"
                className={SETTINGS_INPUT_CLASS}
              />
            </div>

            {/* Live Vault Engine */}
            <div className="p-3.5 bg-slate-50/70 border border-slate-200/80 rounded-2xl text-slate-600 font-mono text-[11px] space-y-2 overflow-hidden">
              <div className="flex items-center justify-between text-slate-800 border-b border-slate-200/80 pb-2 font-bold">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  VAULT CHIFFRÉ — PIN = KEY
                </span>
                <span className="text-[10px] bg-emerald-50 px-2.5 py-0.5 rounded-full text-emerald-700 border border-emerald-200">
                  AES-256-GCM + PBKDF2 100k + BCrypt
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <span className="text-slate-500">Sel Aléatoire:</span>
                <span className="col-span-2 text-sky-800 font-semibold truncate select-all">
                  {SecurityService.getSecure('gmao_vault_salt_v2')?.substring(0, 24) ||
                    'Généré aléatoirement...'}
                  ...
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <span className="text-slate-500">Ciphertext:</span>
                <span className="col-span-2 text-slate-700 font-semibold truncate select-all">
                  {SecurityService.getSecure('gmao_vault_cipher_v2')?.substring(0, 32) ||
                    'Aucun — Vault verrouillé'}
                  ...
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1 pt-1.5 border-t border-slate-200/80">
                <span className="text-slate-500 font-bold">État du Coffre:</span>
                <span
                  className={`col-span-2 font-bold ${
                    isVaultUnlocked ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
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
              className={`w-full py-2.5 ${SETTINGS_BUTTON_STYLES.primary}`}
            >
              <Save className="w-4 h-4" />
              <span>Changer Master PIN — Re-chiffrer Vault</span>
            </button>
          </div>
        </SettingsSectionCard>

        {/* Box B: Comptes Portail Système — 2FA */}
        <SettingsSectionCard
          title={`Comptes Portail Système (${systemAccounts.length})`}
          description="Rôles globaux : Administrateur, Magasinier PDR, Consultateur (Viewer)"
          icon={<Users />}
          headerRight={
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
              className={SETTINGS_BUTTON_STYLES.dangerSoft}
            >
              Reset Vault
            </button>
          }
          bodyClassName="p-5 flex flex-col justify-between space-y-5"
        >
          <div className="space-y-3">
            {systemAccounts.map((userAcc: any) => {
              const accLogin = userAcc.code || userAcc.username;
              const accLabel = userAcc.libelle || userAcc.name || accLogin;
              return (
                <div
                  key={userAcc.id || accLogin}
                  className="p-3.5 rounded-xl border border-slate-200/90 hover:border-slate-300 bg-slate-50/50 hover:bg-white transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-slate-100 text-sky-800 border border-slate-200 font-extrabold text-xs flex items-center justify-center font-mono shrink-0">
                      {String(accLogin || 'US').substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-800 flex items-center gap-2 flex-wrap">
                        <span className="truncate">{accLabel}</span>
                        <span className="text-[10px] font-mono text-slate-500">@{accLogin}</span>
                        <span className="text-[9px] px-2 py-0.5 rounded-full font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          {userAcc.role}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                        Mot de passe : •••••••• (Hash BCrypt dans le coffre chiffré) — ID : {(userAcc.id || 'ID-001').substring(0, 12)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
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
                      className={SETTINGS_BUTTON_STYLES.secondary}
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
                      className={SETTINGS_BUTTON_STYLES.primary}
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

          {/* Explicit Bridge Callout inside Box B */}
          <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs text-slate-800">
              <span className="font-bold block">Accès Techniciens Individuels ({activeTechAccountsCount} actif{activeTechAccountsCount > 1 ? 's' : ''})</span>
              <span className="text-[11px] text-slate-500">
                Les comptes techniciens sont rattachés aux fiches matricules (<code className="font-mono font-bold text-sky-800">TECH-0X</code>).
              </span>
            </div>
            {onNavigateToUsers && (
              <button
                type="button"
                onClick={onNavigateToUsers}
                className={SETTINGS_BUTTON_STYLES.secondary}
              >
                <span>Équipe &amp; Utilisateurs</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </SettingsSectionCard>
      </div>

      {/* 4. Section C — Comptes Techniciens Terrain */}
      <SettingsSectionCard
        title={
          <span className="flex items-center gap-2 flex-wrap">
            <span>Comptes Techniciens Terrain — Liés au Personnel (SSOT AuthService)</span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
              {activeTechAccountsCount} actif{activeTechAccountsCount > 1 ? 's' : ''}
            </span>
            {inactiveTechAccountsCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-slate-600 border border-slate-200">
                {inactiveTechAccountsCount} désactivé{inactiveTechAccountsCount > 1 ? 's' : ''}
              </span>
            )}
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-sky-800 border border-slate-200">
              {Array.isArray(technicians) ? technicians.length : 0} fiche(s) technicien
            </span>
          </span>
        }
        description="L'activation, la désactivation et la définition du mot de passe d'un technicien s'effectuent depuis sa fiche dans Équipe & Utilisateurs afin de préserver le lien personnelId (périmètre R4 « Mes Tâches »)."
        icon={<Wrench />}
        headerRight={
          onNavigateToUsers ? (
            <button
              type="button"
              onClick={onNavigateToUsers}
              className={SETTINGS_BUTTON_STYLES.primary}
            >
              <span>Gérer les accès dans Équipe &amp; Utilisateurs</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : undefined
        }
      >
        {technicianAccounts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {technicianAccounts.map((techAcc: any) => {
              const isActive = techAcc.isActive !== false;
              const code = techAcc.personnelId || techAcc.id || techAcc.code;
              const loginId = techAcc.username || techAcc.code;
              return (
                <div
                  key={techAcc.id || loginId}
                  className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                    isActive
                      ? 'bg-white border-slate-200/90 hover:border-slate-300 shadow-2xs'
                      : 'bg-slate-50 border-slate-200/60 opacity-70'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-900 truncate">
                        {techAcc.personnelName || techAcc.name}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-100 text-sky-800 border border-slate-200">
                        {code}
                      </span>
                      {isActive ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                          Actif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-slate-100 text-slate-600">
                          <XCircle className="w-2.5 h-2.5 text-slate-400" />
                          Désactivé
                        </span>
                      )}
                    </div>
                    <div className="text-[10.5px] text-slate-500 font-mono mt-1 truncate">
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
                      className={SETTINGS_BUTTON_STYLES.secondary}
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
          <div className="p-6 rounded-2xl bg-slate-50/70 border border-dashed border-slate-200 text-center space-y-2">
            <p className="text-xs font-bold text-slate-700">
              Aucun compte de connexion technicien configuré (Mode Usine Vide ou accès non activés).
            </p>
            <p className="text-[11px] text-slate-500">
              Ouvrez <b>Équipe &amp; Utilisateurs</b> et cliquez sur l&apos;icône clé d&apos;un technicien pour activer son compte individuel.
            </p>
          </div>
        )}
      </SettingsSectionCard>

      {/* Vault Cryptographic Action Modal */}
      {vaultModal.isOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={closeVaultModal}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200/90 shadow-2xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={`px-5 py-4 border-b flex items-center justify-between gap-3 ${
                vaultModal.mode === 'reset_vault'
                  ? 'bg-rose-50/50 border-rose-100'
                  : 'bg-white border-slate-100 text-slate-900'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Lock
                  className={`w-5 h-5 shrink-0 ${
                    vaultModal.mode === 'reset_vault' ? 'text-rose-600' : 'text-sky-700'
                  }`}
                />
                <div className="min-w-0">
                  <h4
                    className={`text-sm font-extrabold truncate ${
                      vaultModal.mode === 'reset_vault' ? 'text-rose-950' : 'text-slate-900'
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
                      vaultModal.mode === 'reset_vault' ? 'text-rose-700' : 'text-slate-500'
                    }`}
                  >
                    Validation par clé maîtresse Master PIN (AES-256-GCM)
                  </p>
                </div>
              </div>
              <Action3DButton
                variant="circle"
                color={vaultModal.mode === 'reset_vault' ? 'rose' : 'slate'}
                icon={X}
                onClick={closeVaultModal}
                title="Fermer"
                ariaLabel="Fermer"
                className="!w-8 !h-8"
              />
            </div>

            <form onSubmit={handleConfirmVaultModal} className="p-5 space-y-4">
              {vaultModal.mode === 'switch_session' && (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900">
                  Vous allez basculer votre session active vers{' '}
                  <b className="font-mono text-sky-800">{vaultModal.targetDisplayName}</b>.
                </div>
              )}

              {vaultModal.mode === 'reset_vault' && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 leading-relaxed">
                  <b>Attention :</b> Cette action réinitialise le coffre-fort chiffré et rétablit tous les comptes système aux valeurs d&apos;usine.
                </div>
              )}

              {vaultModal.mode === 'change_password' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nouveau mot de passe (min. 8 caractères, lettre + chiffre)
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    autoFocus
                    value={vaultModal.newPassword}
                    onChange={(e) =>
                      setVaultModal((prev) => ({ ...prev, newPassword: e.target.value }))
                    }
                    placeholder="Saisir le nouveau mot de passe..."
                    className={`${SETTINGS_INPUT_CLASS} font-mono font-bold`}
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
                  className={`${SETTINGS_INPUT_CLASS} font-mono font-bold`}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeVaultModal}
                  disabled={vaultModal.submitting}
                  className={SETTINGS_BUTTON_STYLES.secondary}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={vaultModal.submitting}
                  className={
                    vaultModal.mode === 'reset_vault'
                      ? SETTINGS_BUTTON_STYLES.danger
                      : SETTINGS_BUTTON_STYLES.primary
                  }
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
