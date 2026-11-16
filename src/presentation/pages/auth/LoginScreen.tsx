import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  Key,
  KeyRound,
  ArrowRight,
  Store,
  AlertTriangle,
  User,
  Eye,
  EyeOff,
  CheckCircle2,
  LogIn,
  Users,
  Wrench,
  Package,
  MapPin,
  FileKey,
  Lock,
  Building2,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { confirmAction } from '../../../utils/confirmAction';
import { SecurityService } from '../../../core/security/SecurityService';
import { storageService } from '../../../utils/storageService';
import {
  LicenseGateService,
  validateLicenseKeyPolicy,
} from '../../../core/security/LicenseGateService';
import { validatePasswordPolicy } from '../../../core/security/AuthService';

const ROLE_TILES = [
  {
    role: 'ADMIN',
    label: 'Administrateur',
    subLabel: 'Supervision & Sécurité',
    icon: ShieldCheck,
    activeClass: 'border-emerald-600 bg-emerald-50/70 ring-2 ring-emerald-500/20 text-emerald-950',
    iconClass: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
  {
    role: 'TECHNICIEN',
    label: 'Technicien',
    subLabel: 'PM, Pannes & PDR',
    icon: Wrench,
    activeClass: 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-500/20 text-blue-950',
    iconClass: 'bg-blue-100 text-blue-700 border-blue-200',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  {
    role: 'RESPONSABLE_MAGASIN',
    label: 'Magasin / RMG',
    subLabel: 'Stock & Mouvements',
    icon: Package,
    activeClass: 'border-amber-600 bg-amber-50/70 ring-2 ring-amber-500/20 text-amber-950',
    iconClass: 'bg-amber-100 text-amber-700 border-amber-200',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  {
    role: 'VIEWER',
    label: 'Observateur',
    subLabel: 'Consultation & KPIs',
    icon: Eye,
    activeClass: 'border-slate-600 bg-slate-100/80 ring-2 ring-slate-500/20 text-slate-950',
    iconClass: 'bg-slate-100 text-slate-700 border-slate-200',
    badgeClass: 'bg-slate-200 text-slate-800 border-slate-300',
  },
];

export default function LoginScreen() {
  const {
    login,
    getAvailableAccounts,
    isPinConfigured,
    isLicenseActive,
    licenseRecord,
    rememberedLicenseKey,
    setRememberedLicenseKey,
    activateLicenseAndAdmin,
    getCurrentSessionUser,
  } = useAuth();

  // Check if returning from a Quick Screen Lock to pre-select the locked operator's account
  const lockedAccountInit = useMemo(() => {
    try {
      const locked = SecurityService.getSessionSecure('gmao_screen_locked_account');
      if (locked) {
        SecurityService.removeSecure('gmao_screen_locked_account');
        return typeof locked === 'string' ? JSON.parse(locked) : locked;
      }
    } catch {
      // ignore
    }
    return null;
  }, []);

  const isSystemActivated = Boolean(
    isLicenseActive || (isPinConfigured ? isPinConfigured() : false)
  );

  // Dual-Key Login State (Key 1: Commercial License Key + Key 2: Account Password)
  const [selectedRole, setSelectedRole] = useState(() => lockedAccountInit?.role || 'ADMIN');
  const [selectedUserKey, setSelectedUserKey] = useState(
    () => lockedAccountInit?.username || 'admin'
  );
  const [username, setUsername] = useState(() => lockedAccountInit?.username || 'admin');
  const [licenseKey, setLicenseKey] = useState(() => rememberedLicenseKey || '');
  const [rememberLicenseOnDevice, setRememberLicenseOnDevice] = useState(() =>
    Boolean(rememberedLicenseKey)
  );
  const [password, setPassword] = useState('');
  const [showLicenseKey, setShowLicenseKey] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // First-Run Activation Wizard State (when !isSystemActivated)
  const [setupLicenseKey, setSetupLicenseKey] = useState('');
  const [setupLicenseConfirm, setSetupLicenseConfirm] = useState('');
  const [setupOrganization, setSetupOrganization] = useState('Atelier Industriel CIOB');
  const [setupAdminPassword, setSetupAdminPassword] = useState('');
  const [setupAdminConfirm, setSetupAdminConfirm] = useState('');
  const [setupRememberLicense, setSetupRememberLicense] = useState(false);

  const licenseFileInputRef = useRef<HTMLInputElement | null>(null);
  const setupLicenseFileInputRef = useRef<HTMLInputElement | null>(null);

  const [errorMsg, setErrorMsg] = useState<string | null>(() => {
    try {
      const idleMsg = SecurityService.getSessionSecure('gmao_session_idle_expired');
      if (idleMsg) {
        SecurityService.removeSecure('gmao_session_idle_expired');
        return typeof idleMsg === 'string' ? idleMsg : String(idleMsg);
      }
    } catch {
      // ignore
    }
    return null;
  });
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Sync remembered license key if updated externally
  useEffect(() => {
    if (rememberedLicenseKey && !licenseKey) {
      setLicenseKey(rememberedLicenseKey);
      setRememberLicenseOnDevice(true);
    }
  }, [rememberedLicenseKey]);

  // Active accounts from unified AuthService / AuthContext SSOT
  const accounts = useMemo(() => {
    const raw = getAvailableAccounts ? getAvailableAccounts(false) : [];
    if (Array.isArray(raw) && raw.length > 0) {
      return raw.filter((a) => a.isActive !== false);
    }
    return [
      {
        id: 'admin',
        code: 'admin',
        username: 'admin',
        name: 'Administrateur',
        role: 'ADMIN',
        titleFr: 'Administrateur Système',
        avatar: 'AD',
        badgeColor: 'emerald',
        isActive: true,
      },
      {
        id: 'magasinier',
        code: 'magasinier',
        username: 'magasinier',
        name: 'Responsable Magasin',
        role: 'RESPONSABLE_MAGASIN',
        titleFr: 'Responsable Magasin (RMG)',
        avatar: 'RM',
        badgeColor: 'amber',
        isActive: true,
      },
      {
        id: 'viewer',
        code: 'viewer',
        username: 'viewer',
        name: 'Observateur',
        role: 'VIEWER',
        titleFr: 'Observateur',
        avatar: 'OB',
        badgeColor: 'slate',
        isActive: true,
      },
    ];
  }, [getAvailableAccounts]);

  // Accounts filtered by currently selected Role Tile
  const roleAccounts = useMemo(() => {
    return accounts.filter((acc) => acc.role === selectedRole);
  }, [accounts, selectedRole]);

  // Currently selected account object
  const selectedAccount = useMemo(() => {
    return (
      accounts.find(
        (acc) =>
          acc.username === selectedUserKey ||
          acc.code === selectedUserKey ||
          acc.username?.toLowerCase() === username?.trim().toLowerCase() ||
          acc.code?.toLowerCase() === username?.trim().toLowerCase()
      ) || null
    );
  }, [accounts, selectedUserKey, username]);

  // Keep selected account in sync when switching Role Tile
  useEffect(() => {
    const matching = accounts.filter((acc) => acc.role === selectedRole);
    if (matching.length > 0) {
      const stillValid = matching.find(
        (a) => a.username === selectedUserKey || a.code === selectedUserKey
      );
      const target = stillValid || matching[0];
      setSelectedUserKey(target.username);
      setUsername(target.username);
    } else {
      setSelectedUserKey('');
      setUsername('');
    }
  }, [selectedRole, accounts]);

  // Current session user (if previously logged in or active in storage)
  const currentSession = useMemo(() => {
    return getCurrentSessionUser ? getCurrentSessionUser() : null;
  }, [getCurrentSessionUser]);

  // Live validation checks for First-Run Activation Wizard
  const activationChecks = useMemo(() => {
    let licenseValid = false;
    try {
      validateLicenseKeyPolicy(setupLicenseKey);
      licenseValid = true;
    } catch {
      licenseValid = false;
    }
    const licenseConfirmed =
      licenseValid && setupLicenseKey.trim() === setupLicenseConfirm.trim();

    let adminPassValid = false;
    try {
      validatePasswordPolicy(setupAdminPassword);
      adminPassValid = true;
    } catch {
      adminPassValid = false;
    }
    const adminPassConfirmed =
      adminPassValid && setupAdminPassword.trim() === setupAdminConfirm.trim();

    const secretsSeparated =
      Boolean(setupLicenseKey.trim()) &&
      Boolean(setupAdminPassword.trim()) &&
      setupLicenseKey.trim().toLowerCase() !== setupAdminPassword.trim().toLowerCase();

    return {
      licenseValid,
      licenseConfirmed,
      adminPassValid,
      adminPassConfirmed,
      secretsSeparated,
      allValid: licenseConfirmed && adminPassConfirmed && secretsSeparated,
    };
  }, [setupLicenseKey, setupLicenseConfirm, setupAdminPassword, setupAdminConfirm]);

  const handleSelectRole = (role: string) => {
    setSelectedRole(role);
    setPassword('');
    setErrorMsg(null);
  };

  const handleSelectAccount = (acc: any) => {
    if (acc.role && acc.role !== selectedRole) {
      setSelectedRole(acc.role);
    }
    setSelectedUserKey(acc.username);
    setUsername(acc.username);
    setPassword('');
    setErrorMsg(null);
  };

  // Load .lic / .json file into Login or Setup form
  const handleLicenseFileImport = async (
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'login' | 'setup'
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const content = await file.text();
      const parsed = LicenseGateService.parseLicenseFilePayload(content);
      setErrorMsg(null);
      if (target === 'setup') {
        setSetupLicenseKey(parsed.licenseKey);
        setSetupLicenseConfirm(parsed.licenseKey);
        if (parsed.organizationLabel) {
          setSetupOrganization(parsed.organizationLabel);
        }
        setSuccessMsg(`Fichier de licence "${file.name}" chargé avec succès.`);
      } else {
        setLicenseKey(parsed.licenseKey);
        setSuccessMsg(`Clé de licence importée depuis "${file.name}".`);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Fichier de licence invalide.');
    }
  };

  // First-Run Activation: Commercial License Key + Independent Admin Password
  const handleFirstRunActivation = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanLic = setupLicenseKey.trim();
    const cleanLicConfirm = setupLicenseConfirm.trim();
    const cleanAdminPass = setupAdminPassword.trim();
    const cleanAdminConfirm = setupAdminConfirm.trim();

    if (cleanLic !== cleanLicConfirm) {
      setErrorMsg('La confirmation de la clé de licence commerciale ne correspond pas.');
      return;
    }
    if (cleanAdminPass !== cleanAdminConfirm) {
      setErrorMsg('La confirmation du mot de passe Administrateur ne correspond pas.');
      return;
    }

    setIsLoading(true);
    try {
      await activateLicenseAndAdmin({
        licenseKey: cleanLic,
        adminPassword: cleanAdminPass,
        organizationLabel: setupOrganization.trim() || 'Atelier Industriel CIOB',
        rememberLicenseOnDevice: setupRememberLicense,
      });

      setLicenseKey(setupRememberLicense ? cleanLic : '');
      setRememberLicenseOnDevice(setupRememberLicense);
      setSetupLicenseKey('');
      setSetupLicenseConfirm('');
      setSetupAdminPassword('');
      setSetupAdminConfirm('');
      setSuccessMsg(
        'Licence commerciale activée et compte Administrateur (@admin) initialisé avec deux secrets distincts. Connectez-vous maintenant.'
      );
    } catch (err: any) {
      setErrorMsg(err?.message || "Échec de l'activation initiale.");
    } finally {
      setIsLoading(false);
    }
  };

  // Dual-Key AND Login: [Clé de licence] AND [Compte] AND [Mot de passe]
  const handleDualKeyLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanUser = username.trim();
    const cleanLic = licenseKey.trim();
    const cleanPass = password;

    if (!cleanLic) {
      setErrorMsg(
        'Authentification à double clé (AND) : veuillez saisir la clé de licence commerciale.'
      );
      return;
    }
    if (!cleanUser) {
      setErrorMsg('Veuillez sélectionner un compte actif pour ce rôle avant de vous connecter.');
      return;
    }
    if (!cleanPass) {
      setErrorMsg('Veuillez saisir le mot de passe du compte sélectionné.');
      return;
    }

    setIsLoading(true);
    try {
      await login(cleanUser, cleanPass, cleanLic);
      if (setRememberedLicenseKey) {
        setRememberedLicenseKey(cleanLic, rememberLicenseOnDevice);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Échec de connexion');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetApp = async () => {
    if (
      await confirmAction({
        title: "Réinitialiser l'application",
        message:
          "Voulez-vous vraiment réinitialiser l'application ? Toutes les données locales seront supprimées.",
        variant: 'danger',
      })
    ) {
      storageService.clearCache();
      localStorage.clear();
      sessionStorage.clear();
      window.location.reload();
    }
  };

  const getBadgeClass = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'RESPONSABLE_MAGASIN':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'TECHNICIEN':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-100 text-slate-800 flex items-center justify-center p-3 sm:p-6 font-sans relative overflow-hidden select-none">
      {/* Background Excel Grid Subtle Lines & Ambient Tones */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#107c41_1px,transparent_1px)] [background-size:20px_20px]" />
      <div className="absolute -top-32 -right-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-xl bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden z-10 flex flex-col my-4">
        {/* Top Header Banner */}
        <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-green-900 p-5 sm:p-6 text-white text-center relative shadow-xs">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <div className="flex items-center gap-2 bg-white/10 border border-white/20 px-3 py-1 rounded-full backdrop-blur-xs">
              <Store className="w-4 h-4 text-emerald-200" />
              <span className="text-[11px] font-mono font-bold text-white tracking-wide">
                CIOB GMAO NEXUS
              </span>
            </div>

            <div className="bg-white/15 border border-white/20 px-3 py-1 rounded-full flex items-center gap-1.5 backdrop-blur-xs">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-200" />
              <span className="text-[10px] font-mono font-bold text-white">
                {isSystemActivated && licenseRecord?.licenseKeyId
                  ? `Double Clé (AND) • ${licenseRecord.licenseKeyId}`
                  : 'Activation Licence & Sécurité (AND)'}
              </span>
            </div>
          </div>

          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-2">
            {isSystemActivated
              ? 'Portail à Double Clé (Licence + Compte)'
              : 'Activation Initiale de la Licence & Administrateur'}
          </h2>
          <p className="text-xs text-emerald-100 font-medium mt-0.5 max-w-md mx-auto">
            {isSystemActivated
              ? 'Exige conjointement la Clé de Licence Commerciale ET le Mot de Passe du compte actif (Logique AND)'
              : 'Séparation stricte : définissez votre Clé de Licence Commerciale et un Mot de Passe Administrateur distinct'}
          </p>
        </div>

        {/* Current / Previous Active Session Card */}
        {isSystemActivated && currentSession && (
          <div className="bg-slate-50 border-b border-slate-200 p-3.5 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-emerald-700 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                  {currentSession.avatar || 'US'}
                </div>
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full ring-2 ring-white" />
              </div>
              <div className="text-left min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-slate-800 truncate">
                    {currentSession.name || currentSession.username}
                  </span>
                  {currentSession.personnelId && (
                    <span className="text-[9.5px] font-mono font-bold px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200">
                      {currentSession.personnelId}
                    </span>
                  )}
                  <span
                    className={`text-[9.5px] px-1.5 py-0.2 rounded font-bold border ${getBadgeClass(
                      currentSession.role
                    )}`}
                  >
                    {currentSession.titleFr || currentSession.role}
                  </span>
                </div>
                <div className="text-[10.5px] text-slate-500 font-mono">
                  Session mémorisée sur ce poste
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (currentSession.role) {
                  setSelectedRole(currentSession.role);
                }
                setSelectedUserKey(currentSession.username || 'admin');
                setUsername(currentSession.username || 'admin');
                setErrorMsg(null);
              }}
              className="w-full sm:w-auto px-3.5 py-1.5 text-xs font-bold text-emerald-800 hover:text-emerald-900 bg-white hover:bg-emerald-50 border border-emerald-300 rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
            >
              <LogIn className="w-3.5 h-3.5 text-emerald-700" />
              <span>Choisir ce compte</span>
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-5 bg-white">
          {/* Error Message Box */}
          {errorMsg && (
            <div
              id="login-error-box"
              className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-700 text-xs animate-shake"
            >
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <div className="font-medium leading-relaxed">{errorMsg}</div>
            </div>
          )}

          {/* Success Message Box */}
          {successMsg && (
            <div
              id="login-success-box"
              className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-emerald-800 text-xs"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="font-medium leading-relaxed">{successMsg}</div>
            </div>
          )}

          {!isSystemActivated ? (
            /* =====================================================================
             * FIRST-RUN ACTIVATION WIZARD (Clé de licence commerciale + Mot de passe @admin)
             * ===================================================================== */
            <form onSubmit={handleFirstRunActivation} className="space-y-4">
              <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-4 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-xs text-emerald-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-700" />
                    <span>Initialisation Obligatoire à Double Secret (LOGIN-LICENSE-P0)</span>
                  </span>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                    AND Gate
                  </span>
                </div>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  Pour activer ce poste GMAO, renseignez votre{' '}
                  <b>Clé de Licence Commerciale</b> (ou code licence 6+ chiffres) ainsi qu&apos;un{' '}
                  <b>Mot de passe Administrateur (@admin)</b> strictement distinct. Aucun des deux
                  secrets ne peut remplacer l&apos;autre.
                </p>
              </div>

              {/* Hidden file input for .lic / .json in Setup */}
              <input
                ref={setupLicenseFileInputRef}
                type="file"
                accept=".lic,.json,.txt"
                onChange={(e) => handleLicenseFileImport(e, 'setup')}
                className="hidden"
              />

              {/* Organization Label */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider font-mono mb-1">
                  Atelier / Organisation (Licence)
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
                  <input
                    id="input-setup-organization"
                    type="text"
                    value={setupOrganization}
                    onChange={(e) => setSetupOrganization(e.target.value)}
                    placeholder="Ex: Atelier Industriel CIOB"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-4 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-600 focus:bg-white"
                  />
                </div>
              </div>

              {/* Secret 1: Commercial License Key */}
              <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-slate-800 uppercase font-mono flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Secret 1 : Clé de Licence Commerciale</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setupLicenseFileInputRef.current?.click()}
                    className="text-[10.5px] font-bold text-emerald-700 hover:text-emerald-900 bg-white border border-emerald-200 px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer shadow-2xs"
                  >
                    <FileKey className="w-3 h-3" />
                    <span>Charger .lic / .json</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="relative">
                    <input
                      id="input-setup-license-key"
                      type={showLicenseKey ? 'text' : 'password'}
                      value={setupLicenseKey}
                      onChange={(e) => {
                        setSetupLicenseKey(e.target.value);
                        if (errorMsg) setErrorMsg(null);
                      }}
                      placeholder="Clé licence (ex: CIOB-2026-9981 ou 6+ chiffres)"
                      className="w-full bg-white border border-slate-300 rounded-xl pl-3.5 pr-9 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-600"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLicenseKey(!showLicenseKey)}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      tabIndex={-1}
                    >
                      {showLicenseKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <div>
                    <input
                      id="input-setup-license-confirm"
                      type={showLicenseKey ? 'text' : 'password'}
                      value={setupLicenseConfirm}
                      onChange={(e) => {
                        setSetupLicenseConfirm(e.target.value);
                        if (errorMsg) setErrorMsg(null);
                      }}
                      placeholder="Confirmer la clé de licence..."
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                </div>
              </div>

              {/* Secret 2: Independent Admin Password */}
              <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-slate-800 uppercase font-mono flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-sky-700" />
                    <span>Secret 2 : Mot de Passe Administrateur (@admin)</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    Min. 8 car. (lettre + chiffre)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="relative">
                    <input
                      id="input-setup-admin-password"
                      type={showPassword ? 'text' : 'password'}
                      value={setupAdminPassword}
                      onChange={(e) => {
                        setSetupAdminPassword(e.target.value);
                        if (errorMsg) setErrorMsg(null);
                      }}
                      placeholder="Mot de passe @admin..."
                      className="w-full bg-white border border-slate-300 rounded-xl pl-3.5 pr-9 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-600"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <div>
                    <input
                      id="input-setup-admin-password-confirm"
                      type={showPassword ? 'text' : 'password'}
                      value={setupAdminConfirm}
                      onChange={(e) => {
                        setSetupAdminConfirm(e.target.value);
                        if (errorMsg) setErrorMsg(null);
                      }}
                      placeholder="Confirmer mot de passe @admin..."
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                </div>
              </div>

              {/* Live Security Invariant Checklist */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] space-y-1.5">
                <div className="flex items-center gap-2">
                  <CheckCircle2
                    className={`w-3.5 h-3.5 shrink-0 ${
                      activationChecks.licenseConfirmed ? 'text-emerald-600' : 'text-slate-300'
                    }`}
                  />
                  <span
                    className={
                      activationChecks.licenseConfirmed
                        ? 'text-slate-800 font-semibold'
                        : 'text-slate-500'
                    }
                  >
                    Clé de licence commerciale valide et confirmée (PBKDF2 600k + sel d&apos;installation)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2
                    className={`w-3.5 h-3.5 shrink-0 ${
                      activationChecks.adminPassConfirmed ? 'text-emerald-600' : 'text-slate-300'
                    }`}
                  />
                  <span
                    className={
                      activationChecks.adminPassConfirmed
                        ? 'text-slate-800 font-semibold'
                        : 'text-slate-500'
                    }
                  >
                    Mot de passe Administrateur robuste (8+ caractères, lettre + chiffre) et confirmé
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2
                    className={`w-3.5 h-3.5 shrink-0 ${
                      activationChecks.secretsSeparated ? 'text-emerald-600' : 'text-slate-300'
                    }`}
                  />
                  <span
                    className={
                      activationChecks.secretsSeparated
                        ? 'text-slate-800 font-semibold'
                        : 'text-slate-500'
                    }
                  >
                    Séparation stricte : la Clé de Licence est différente du Mot de Passe @admin
                  </span>
                </div>
              </div>

              {/* Optional Workshop Convenience Checkbox */}
              <label className="flex items-start gap-2.5 text-[11px] text-slate-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={setupRememberLicense}
                  onChange={(e) => setSetupRememberLicense(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                />
                <span>
                  Mémoriser la clé de licence sur ce poste d&apos;atelier (option de confort — réduit
                  la sécurité physique en cas d&apos;accès direct au navigateur ; le mot de passe du
                  compte reste toujours requis).
                </span>
              </label>

              <button
                type="submit"
                id="btn-setup-pin"
                disabled={isLoading || !activationChecks.allValid}
                className="w-full bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-bold py-3 px-4 rounded-xl text-xs transition shadow-md hover:shadow-lg flex items-center justify-center gap-2 group cursor-pointer disabled:opacity-50"
              >
                <span>
                  {isLoading
                    ? 'Activation cryptographique en cours...'
                    : 'Activer la Licence & Initialiser @admin'}
                </span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </form>
          ) : (
            /* =====================================================================
             * UNIFIED DUAL-KEY `AND` LOGIN GATE (Clé de licence + Compte + Mot de passe)
             * ===================================================================== */
            <form onSubmit={handleDualKeyLogin} className="space-y-4">
              {/* Hidden file input for .lic / .json in Login */}
              <input
                ref={licenseFileInputRef}
                type="file"
                accept=".lic,.json,.txt"
                onChange={(e) => handleLicenseFileImport(e, 'login')}
                className="hidden"
              />

              {/* STEP 1: Commercial License Key (Gate Key 1) */}
              <div className="p-3.5 rounded-2xl border border-emerald-200/90 bg-emerald-50/40 space-y-2.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <label
                    htmlFor="input-login-license-key"
                    className="text-[11px] font-bold text-emerald-950 uppercase tracking-wider font-mono flex items-center gap-1.5"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-emerald-700" />
                    <span>1. Clé de Licence Commerciale (Clé 1 / 2)</span>
                  </label>

                  <div className="flex items-center gap-2">
                    {licenseRecord?.licenseKeyId && (
                      <span className="text-[9.5px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                        {licenseRecord.licenseKeyId}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => licenseFileInputRef.current?.click()}
                      className="text-[10px] font-bold text-emerald-800 hover:text-emerald-950 bg-white border border-emerald-300 px-2 py-0.5 rounded-lg flex items-center gap-1 cursor-pointer shadow-2xs"
                    >
                      <FileKey className="w-3 h-3" />
                      <span>Fichier .lic</span>
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <KeyRound className="w-4 h-4 text-emerald-600 absolute left-3.5 top-3" />
                  <input
                    id="input-login-license-key"
                    type={showLicenseKey ? 'text' : 'password'}
                    value={licenseKey}
                    onChange={(e) => {
                      setLicenseKey(e.target.value);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    placeholder="Saisir la clé de licence commerciale (obligatoire)..."
                    className="w-full bg-white border border-emerald-300 rounded-xl pl-10 pr-10 py-2.5 text-xs font-mono text-slate-900 tracking-wider focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLicenseKey(!showLicenseKey)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                    tabIndex={-1}
                  >
                    {showLicenseKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <label className="flex items-center gap-2 text-[10.5px] text-slate-600 cursor-pointer">
                  <input
                    id="checkbox-remember-license"
                    type="checkbox"
                    checked={rememberLicenseOnDevice}
                    onChange={(e) => {
                      const next = e.target.checked;
                      setRememberLicenseOnDevice(next);
                      if (!next && setRememberedLicenseKey) {
                        setRememberedLicenseKey('', false);
                      }
                    }}
                    className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                  />
                  <span>
                    Mémoriser la clé de licence sur ce poste d&apos;atelier (réduit la sécurité
                    physique)
                  </span>
                </label>
              </div>

              {/* STEP 2: Role Tiles Selection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider font-mono flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-slate-500" />
                    <span>2. Choisir votre profil / rôle</span>
                  </label>
                  <span className="text-[10.5px] text-slate-400 font-mono">
                    {roleAccounts.length} compte(s) actif(s)
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {ROLE_TILES.map((tile) => {
                    const IconComp = tile.icon;
                    const isSelected = selectedRole === tile.role;
                    const count = accounts.filter((a) => a.role === tile.role).length;
                    return (
                      <button
                        key={tile.role}
                        type="button"
                        onClick={() => handleSelectRole(tile.role)}
                        className={`p-2.5 rounded-2xl border text-left transition flex flex-col justify-between gap-2 cursor-pointer relative ${
                          isSelected
                            ? tile.activeClass
                            : 'border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div
                            className={`w-7 h-7 rounded-lg border flex items-center justify-center ${tile.iconClass}`}
                          >
                            <IconComp className="w-3.5 h-3.5" />
                          </div>
                          <span
                            className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full border ${tile.badgeClass}`}
                            title={`${count} compte(s) actif(s)`}
                          >
                            {count}
                          </span>
                        </div>

                        <div>
                          <div className="text-[11.5px] font-bold text-slate-900 truncate">
                            {tile.label}
                          </div>
                          <div className="text-[9.5px] text-slate-500 truncate">{tile.subLabel}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Active Identity Selection under the chosen Role */}
              <div>
                {roleAccounts.length === 0 ? (
                  <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50/70 text-amber-900 text-xs space-y-1.5">
                    <div className="font-bold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Aucun compte actif pour ce rôle</span>
                    </div>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      L&apos;usine ne contient actuellement aucun compte de connexion actif pour le
                      profil <b>{ROLE_TILES.find((r) => r.role === selectedRole)?.label}</b>.
                      Connectez-vous en tant qu&apos;<b>Administrateur</b> puis ouvrez{' '}
                      <b>Utilisateurs &amp; Équipes</b> pour activer l&apos;accès d&apos;un
                      technicien.
                    </p>
                  </div>
                ) : (
                  <div
                    className={`grid gap-2 max-h-40 overflow-y-auto pr-0.5 ${
                      roleAccounts.length === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'
                    }`}
                  >
                    {roleAccounts.map((acc) => {
                      const isSelected =
                        selectedUserKey === acc.username ||
                        username.trim().toLowerCase() === acc.username?.toLowerCase();
                      return (
                        <button
                          key={acc.id || acc.username}
                          type="button"
                          onClick={() => handleSelectAccount(acc)}
                          className={`p-2.5 rounded-2xl border text-left transition flex items-center justify-between gap-2.5 cursor-pointer ${
                            isSelected
                              ? 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-500/20 shadow-xs'
                              : 'border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-xs text-slate-800 shrink-0">
                              {acc.avatar}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-bold text-slate-900 truncate">
                                  {acc.name}
                                </span>
                                {acc.personnelId && (
                                  <span className="text-[9.5px] font-mono font-bold px-1.5 py-0.2 rounded bg-blue-100/80 text-blue-800 border border-blue-200">
                                    {acc.personnelId}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono truncate mt-0.5">
                                <span>@{acc.username}</span>
                                {acc.id_zone && acc.id_zone !== 'ALL' && (
                                  <span className="inline-flex items-center gap-0.5 text-emerald-700 font-sans font-semibold">
                                    <MapPin className="w-2.5 h-2.5 shrink-0" />
                                    {acc.id_zone}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          {isSelected && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Username / Active Account Field */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="input-login-username"
                    className="block text-xs font-bold text-slate-600 uppercase tracking-wider font-mono"
                  >
                    Compte sélectionné (Identifiant)
                  </label>
                  {selectedAccount?.personnelId && (
                    <span className="text-[10px] font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      Matricule : {selectedAccount.personnelId}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    id="input-login-username"
                    type="text"
                    value={username}
                    onChange={(e) => {
                      const val = e.target.value;
                      setUsername(val);
                      setSelectedUserKey(val);
                      const matched = accounts.find(
                        (a) =>
                          a.username?.toLowerCase() === val.trim().toLowerCase() ||
                          a.code?.toLowerCase() === val.trim().toLowerCase()
                      );
                      if (matched && matched.role !== selectedRole) {
                        setSelectedRole(matched.role);
                      }
                      if (errorMsg) setErrorMsg(null);
                    }}
                    placeholder="Ex: admin, magasinier, tech-01"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 transition"
                  />
                </div>
              </div>

              {/* STEP 3: Operational Account Password (Gate Key 2) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="input-login-password"
                    className="block text-xs font-bold text-slate-600 uppercase tracking-wider font-mono"
                  >
                    3. Mot de Passe du Compte (Clé 2 / 2)
                  </label>
                  <span className="text-[10px] font-mono text-emerald-700 font-bold">
                    Requis avec la Clé de Licence (AND)
                  </span>
                </div>

                <div className="relative">
                  <Key className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    id="input-login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    placeholder="Saisir le mot de passe du compte..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-10 py-2.5 text-xs font-mono text-slate-900 tracking-wider focus:outline-none focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                id="btn-submit-credentials"
                disabled={isLoading || !username.trim() || !licenseKey.trim() || !password}
                className="w-full bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-bold py-3 px-4 rounded-xl text-xs transition shadow-md hover:shadow-lg flex items-center justify-center gap-2 group cursor-pointer mt-2 disabled:opacity-50"
              >
                <span>
                  {isLoading
                    ? 'Vérification Licence + Mot de passe...'
                    : selectedAccount
                      ? `Vérifier les 2 Clés & Connecter (${selectedAccount.name})`
                      : 'Vérifier les 2 Clés & Connecter'}
                </span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </form>
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col gap-2">
          <div className="text-center text-[11px] text-slate-500 font-mono">
            CIOB GMAO Nexus • Portail à Double Clé (Licence Commerciale AND Compte)
          </div>

          <button
            onClick={handleResetApp}
            className="text-[9px] text-slate-300 hover:text-rose-400 transition font-mono uppercase font-medium self-center"
          >
            Réinitialiser l&apos;application (Dépannage)
          </button>
        </div>
      </div>
    </div>
  );
}
