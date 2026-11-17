import React, { useState, useEffect, useRef } from 'react';
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
  FileKey,
  Building2,
} from 'lucide-react';
import { storageService } from '../../../../utils/storageService';
import { SecurityService } from '../../../../core/security/SecurityService';
import { LicenseGateService } from '../../../../core/security/LicenseGateService';
import { useAuth } from '../../../../context/AuthContext';
import Action3DButton from '../../../components/common/Action3DButton';
import { SettingsSectionCard, SETTINGS_BUTTON_STYLES, SETTINGS_INPUT_CLASS } from './settingsUi';

/**
 * Admin Security, Commercial License Record (`ILicenseRecord`), Dual-Key Rotation, and RBAC matrix.
 */
export default function SettingsAdminTab({
  currentUser,
  isVaultUnlocked,
  isVaultExists,
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
  const auth = useAuth() || {};
  const licenseRecord = auth.licenseRecord || LicenseGateService.getLicenseRecord();
  const isLicenseActive = Boolean(
    auth.isLicenseActive ?? LicenseGateService.isLicenseActive()
  );

  // First-run activation state inside Settings (if not yet activated)
  const [initLicenseKey, setInitLicenseKey] = useState('');
  const [initAdminPass, setInitAdminPass] = useState('');
  const [initOrgLabel, setInitOrgLabel] = useState('Atelier Industriel CIOB');

  // License rotation state (requires current license key + current Admin password + new license key)
  const [adminPasswordForRotation, setAdminPasswordForRotation] = useState('');
  const [confirmNewLicenseKey, setConfirmNewLicenseKey] = useState('');
  const [organizationLabel, setOrganizationLabel] = useState(
    () => licenseRecord?.organizationLabel || 'Atelier Industriel CIOB'
  );
  const rotationFileInputRef = useRef<HTMLInputElement | null>(null);

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
    if (licenseRecord?.organizationLabel) {
      setOrganizationLabel(licenseRecord.organizationLabel);
    }
  }, [licenseRecord?.organizationLabel]);

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

  const handleLoadLicenseFileForRotation = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = LicenseGateService.parseLicenseFilePayload(text);
      setTempPin(parsed.licenseKey);
      setConfirmNewLicenseKey(parsed.licenseKey);
      if (parsed.organizationLabel) {
        setOrganizationLabel(parsed.organizationLabel);
      }
      showToast?.(`Nouvelle clé de licence chargée depuis "${file.name}".`, 'success');
    } catch (err: any) {
      showToast?.(err?.message || 'Fichier de licence invalide.', 'error');
    }
  };

  const handleConfirmVaultModal = async (e: React.FormEvent) => {
    e.preventDefault();
    const licenseKeyInput = vaultModal.masterPin.trim();
    if (!licenseKeyInput) {
      showToast?.('Veuillez saisir la clé de licence commerciale.', 'error');
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
          await updateUserPassword(vaultModal.targetUsername, newPass, licenseKeyInput);
          showToast?.(
            `Mot de passe de @${vaultModal.targetUsername} mis à jour (séparé de la clé de licence) !`,
            'success'
          );
          if (getAvailableAccounts) setAccountsList(getAvailableAccounts(true));
        }
      } else if (vaultModal.mode === 'switch_session') {
        if (switchSessionToUser) {
          await switchSessionToUser(vaultModal.targetUsername, licenseKeyInput);
          showToast?.(
            `Session basculée vers ${vaultModal.targetDisplayName || `@${vaultModal.targetUsername}`} (Clé de licence vérifiée)`,
            'success'
          );
        }
      } else if (vaultModal.mode === 'reset_vault') {
        if (handleResetAllAccounts) {
          await handleResetAllAccounts(licenseKeyInput);
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
      showToast?.(err?.message || 'Opération refusée.', 'error');
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
      {/* 1. Header Card - Commercial License Status & Dual-Key Gate Summary */}
      <SettingsSectionCard
        title={
          <span className="flex items-center gap-2 flex-wrap">
            <span>Licence Commerciale &amp; Sécurité à Double Clé (LOGIN-LICENSE-P0)</span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
              {isLicenseActive ? 'LICENCE ACTIVE (AND)' : 'ACTIVATION REQUISE'}
            </span>
          </span>
        }
        description="Séparation stricte des secrets : Clé de Licence Commerciale (installSalt + PBKDF2-SHA256) ≠ Mot de passe opérationnel des comptes."
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
                  isLicenseActive ? 'text-emerald-700' : 'text-amber-700'
                }`}
              >
                {licenseRecord?.licenseKeyId || 'Non activée'}
              </div>
            </div>
          </div>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80">
            <div className="text-[10px] uppercase font-bold text-slate-400 font-mono">
              Empreinte Licence (ID Public)
            </div>
            <div className="font-mono font-extrabold text-emerald-800 mt-0.5 truncate">
              {licenseRecord?.licenseKeyId || 'Aucune licence active'}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80">
            <div className="text-[10px] uppercase font-bold text-slate-400 font-mono">
              Atelier / Organisation
            </div>
            <div className="font-bold text-slate-800 mt-0.5 truncate">
              {licenseRecord?.organizationLabel || 'Non renseigné'}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80">
            <div className="text-[10px] uppercase font-bold text-slate-400 font-mono">
              Activée le / Dernier Accès
            </div>
            <div className="font-mono text-[11px] text-slate-700 mt-0.5 truncate">
              {licenseRecord?.activatedAt
                ? new Date(licenseRecord.activatedAt).toLocaleDateString('fr-FR')
                : '—'}{' '}
              •{' '}
              {licenseRecord?.lastAuthAt
                ? new Date(licenseRecord.lastAuthAt).toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '—'}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80">
            <div className="text-[10px] uppercase font-bold text-slate-400 font-mono">
              Dérivation Cryptographique
            </div>
            <div className="font-mono text-[11px] text-sky-800 font-bold mt-0.5 truncate">
              PBKDF2-SHA256 (600k) • Sel: {licenseRecord?.installSalt?.slice(0, 10) || '—'}…
            </div>
          </div>
        </div>
      </SettingsSectionCard>

      {/* 2. Initial License + Admin Setup (if not yet activated) */}
      {!isLicenseActive && !isVaultExists && (
        <SettingsSectionCard
          title="Activation Initiale — Clé de Licence Commerciale + Mot de Passe @admin"
          description="Définissez la Clé de Licence Commerciale et un Mot de Passe Administrateur strictement différent."
          icon={<ShieldAlert />}
          tone="warning"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              value={initOrgLabel}
              onChange={(e) => setInitOrgLabel(e.target.value)}
              placeholder="Atelier / Organisation"
              className={`${SETTINGS_INPUT_CLASS} font-mono bg-white`}
            />
            <input
              type="password"
              value={initLicenseKey}
              onChange={(e) => setInitLicenseKey(e.target.value)}
              placeholder="Clé de Licence Commerciale (6+ car.)"
              className={`${SETTINGS_INPUT_CLASS} font-mono font-bold bg-white`}
            />
            <input
              type="password"
              value={initAdminPass}
              onChange={(e) => setInitAdminPass(e.target.value)}
              placeholder="Mot de passe @admin (8+ car., lettre+chiffre)"
              className={`${SETTINGS_INPUT_CLASS} font-mono font-bold bg-white`}
            />
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={async () => {
                try {
                  if (auth.activateLicenseAndAdmin) {
                    await auth.activateLicenseAndAdmin({
                      licenseKey: initLicenseKey,
                      adminPassword: initAdminPass,
                      organizationLabel: initOrgLabel,
                    });
                    showToast?.(
                      'Licence commerciale activée et mot de passe Administrateur initialisé !',
                      'success'
                    );
                    setInitLicenseKey('');
                    setInitAdminPass('');
                    if (getAvailableAccounts) setAccountsList(getAvailableAccounts(true));
                  }
                } catch (err: any) {
                  showToast?.(err.message, 'error');
                }
              }}
              className={SETTINGS_BUTTON_STYLES.primary}
            >
              Activer Licence &amp; Compte @admin
            </button>
          </div>
        </SettingsSectionCard>
      )}

      {/* 3. System Accounts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Box A: Commercial License Rotation (Independent of Account Passwords) */}
        <SettingsSectionCard
          title="Rotation / Réactivation de la Clé de Licence Commerciale"
          description="Modifie uniquement la Clé de Licence Commerciale (Clé 1 / 2) et re-chiffre le coffre AES-256-GCM sans modifier les mots de passe des comptes."
          icon={<KeyRound />}
          headerRight={
            <>
              <input
                ref={rotationFileInputRef}
                type="file"
                accept=".lic,.json,.txt"
                onChange={handleLoadLicenseFileForRotation}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => rotationFileInputRef.current?.click()}
                className={SETTINGS_BUTTON_STYLES.secondary}
              >
                <FileKey className="w-3.5 h-3.5" />
                <span>Importer .lic / .json</span>
              </button>
            </>
          }
        >
          <div className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Clé de Licence Actuelle
                </label>
                <input
                  type="password"
                  value={currentMasterPin}
                  onChange={(e) => setCurrentMasterPin(e.target.value)}
                  placeholder="Clé de licence actuelle..."
                  className={`${SETTINGS_INPUT_CLASS} font-mono font-bold`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Mot de Passe @admin (Autorisation)
                </label>
                <input
                  type="password"
                  value={adminPasswordForRotation}
                  onChange={(e) => setAdminPasswordForRotation(e.target.value)}
                  placeholder="Mot de passe @admin actuel..."
                  className={`${SETTINGS_INPUT_CLASS} font-mono font-bold`}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Nouvelle Clé de Licence
                </label>
                <input
                  type="password"
                  value={tempPin}
                  onChange={(e) => setTempPin(e.target.value)}
                  placeholder="Nouvelle clé (6+ chiffres ou code)"
                  className={`${SETTINGS_INPUT_CLASS} font-mono font-bold`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Confirmer la Nouvelle Clé
                </label>
                <input
                  type="password"
                  value={confirmNewLicenseKey}
                  onChange={(e) => setConfirmNewLicenseKey(e.target.value)}
                  placeholder="Confirmer la nouvelle clé..."
                  className={`${SETTINGS_INPUT_CLASS} font-mono font-bold`}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Atelier / Organisation
                </label>
                <div className="relative">
                  <Building2 className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={organizationLabel}
                    onChange={(e) => setOrganizationLabel(e.target.value)}
                    placeholder="Atelier Industriel CIOB"
                    className={`${SETTINGS_INPUT_CLASS} pl-8`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Libellé du Rôle Administrateur
                </label>
                <input
                  type="text"
                  value={tempRole}
                  onChange={(e) => setTempRole(e.target.value)}
                  placeholder="Ex: Administrateur Système"
                  className={SETTINGS_INPUT_CLASS}
                />
              </div>
            </div>

            {/* Live License & Vault Cryptographic Telemetry */}
            <div className="p-3.5 bg-slate-50/70 border border-slate-200/80 rounded-2xl text-slate-600 font-mono text-[11px] space-y-2 overflow-hidden">
              <div className="flex items-center justify-between text-slate-800 border-b border-slate-200/80 pb-2 font-bold">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  GATE DOUBLE CLÉ — LICENCE AND COMPTE
                </span>
                <span className="text-[10px] bg-emerald-50 px-2.5 py-0.5 rounded-full text-emerald-700 border border-emerald-200">
                  PBKDF2 600k + AES-256-GCM
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <span className="text-slate-500">Empreinte Licence:</span>
                <span className="col-span-2 text-emerald-800 font-bold truncate select-all">
                  {licenseRecord?.licenseKeyId || 'Non configurée'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <span className="text-slate-500">Sel Installation:</span>
                <span className="col-span-2 text-sky-800 font-semibold truncate select-all">
                  {licenseRecord?.installSalt ||
                    SecurityService.getSecure('gmao_vault_salt_v2')?.substring(0, 24) ||
                    'Généré aléatoirement...'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <span className="text-slate-500">Ciphertext Vault:</span>
                <span className="col-span-2 text-slate-700 font-semibold truncate select-all">
                  {SecurityService.getSecure('gmao_vault_cipher_v2')?.substring(0, 32) ||
                    'Aucun — Vault verrouillé'}
                  ...
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1 pt-1.5 border-t border-slate-200/80">
                <span className="text-slate-500 font-bold">Statut Licence:</span>
                <span
                  className={`col-span-2 font-bold ${
                    isLicenseActive && isVaultUnlocked ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  {isLicenseActive
                    ? 'ACTIVE — Aucun secret en clair stocké'
                    : 'INACTIVE — Activation initiale requise'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={async () => {
                try {
                  if (!currentMasterPin.trim()) {
                    showToast?.('Veuillez saisir la clé de licence actuelle.', 'error');
                    return;
                  }
                  if (!adminPasswordForRotation.trim()) {
                    showToast?.(
                      'Veuillez saisir le mot de passe Administrateur (@admin) actuel.',
                      'error'
                    );
                    return;
                  }
                  if (!tempPin.trim()) {
                    showToast?.('Veuillez saisir la nouvelle clé de licence.', 'error');
                    return;
                  }
                  if (tempPin.trim() !== confirmNewLicenseKey.trim()) {
                    showToast?.(
                      'La confirmation de la nouvelle clé de licence ne correspond pas.',
                      'error'
                    );
                    return;
                  }
                  if (auth.rotateLicenseKey) {
                    const rotated = await auth.rotateLicenseKey({
                      currentLicenseKey: currentMasterPin.trim(),
                      adminPassword: adminPasswordForRotation.trim(),
                      newLicenseKey: tempPin.trim(),
                      organizationLabel: organizationLabel.trim(),
                    });
                    storageService.removeItem('gmao_admin_pin');
                    if (tempRole?.trim()) {
                      storageService.setItem('gmao_admin_role', tempRole.trim());
                    }
                    showToast?.(
                      `Clé de licence commerciale renouvelée (${rotated.licenseKeyId}) — les mots de passe des comptes restent inchangés !`,
                      'success'
                    );
                    setCurrentMasterPin('');
                    setAdminPasswordForRotation('');
                    setTempPin('');
                    setConfirmNewLicenseKey('');
                  }
                } catch (err: any) {
                  showToast?.(err.message || 'Échec de la rotation de licence.', 'error');
                }
              }}
              className={`w-full py-2.5 ${SETTINGS_BUTTON_STYLES.primary}`}
            >
              <Save className="w-4 h-4" />
              <span>Effectuer la Rotation de la Clé de Licence</span>
            </button>
          </div>
        </SettingsSectionCard>

        {/* Box B: Comptes Portail Système — Mots de Passe Indépendants */}
        <SettingsSectionCard
          title={`Comptes Portail Système (${systemAccounts.length})`}
          description="Mots de passe opérationnels (Clé 2 / 2) indépendants de la Clé de Licence Commerciale"
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
                        Mot de passe : •••••••• (PBKDF2-SHA256 distinct de la licence) — ID :{' '}
                        {(userAcc.id || 'ID-001').substring(0, 12)}
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
                Aucun compte système chargé.
              </div>
            )}
          </div>

          {/* Explicit Bridge Callout inside Box B */}
          <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs text-slate-800">
              <span className="font-bold block">
                Accès Techniciens Individuels ({activeTechAccountsCount} actif
                {activeTechAccountsCount > 1 ? 's' : ''})
              </span>
              <span className="text-[11px] text-slate-500">
                Les comptes techniciens sont rattachés aux fiches matricules (
                <code className="font-mono font-bold text-sky-800">TECH-0X</code>) sans contenir la
                clé de licence dans les exports RH.
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
        description="L'activation, la désactivation et la définition du mot de passe d'un technicien s'effectuent depuis sa fiche dans Équipe & Utilisateurs afin de préserver le lien personnelId."
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
                      title="Tester la vue de ce technicien (Validation par Clé de Licence)"
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
              Ouvrez <b>Équipe &amp; Utilisateurs</b> et cliquez sur l&apos;icône clé d&apos;un
              technicien pour activer son compte individuel.
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
                      'Basculement de Session Sécurisé (2FA Licence)'}
                    {vaultModal.mode === 'reset_vault' &&
                      'Réinitialiser le Coffre-Fort & la Licence'}
                  </h4>
                  <p
                    className={`text-[11px] ${
                      vaultModal.mode === 'reset_vault' ? 'text-rose-700' : 'text-slate-500'
                    }`}
                  >
                    Autorisation par Clé de Licence Commerciale (PBKDF2-SHA256)
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
                  <b>Attention :</b> Cette action réinitialise le coffre-fort chiffré, révoque la
                  licence locale et rétablit tous les comptes système aux valeurs d&apos;usine.
                </div>
              )}

              {vaultModal.mode === 'change_password' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nouveau mot de passe (min. 8 caractères, lettre + chiffre, distinct de la licence)
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
                  Clé de Licence Commerciale requise pour autoriser l&apos;opération
                </label>
                <input
                  type="password"
                  required
                  autoFocus={vaultModal.mode !== 'change_password'}
                  value={vaultModal.masterPin}
                  onChange={(e) =>
                    setVaultModal((prev) => ({
                      ...prev,
                      masterPin: e.target.value,
                    }))
                  }
                  placeholder="Saisir la clé de licence commerciale actuelle..."
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
