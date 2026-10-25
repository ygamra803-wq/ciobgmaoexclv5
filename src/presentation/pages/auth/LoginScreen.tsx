import { useState, useMemo, useEffect } from 'react';
import {
  ShieldCheck,
  Key,
  ArrowRight,
  Store,
  AlertTriangle,
  User,
  Eye,
  EyeOff,
  CheckCircle2,
  Cpu,
  Hash,
  LogIn,
  Users,
  Wrench,
  Package,
  MapPin,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { confirmAction } from '../../../utils/confirmAction';

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
    loginWithPin,
    getAvailableAccounts,
    isPinConfigured,
    getCurrentSessionUser,
    setupMasterPin,
  } = useAuth();

  // Authentication mode: 'CREDENTIALS' | 'PIN_ENCRYPTED' | 'SETUP_PIN'
  const [authMode, setAuthMode] = useState(() =>
    !isPinConfigured() ? 'SETUP_PIN' : 'CREDENTIALS'
  );
  const [selectedRole, setSelectedRole] = useState('ADMIN');
  const [selectedUserKey, setSelectedUserKey] = useState('admin');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

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

  const hasConfiguredPin = isPinConfigured ? isPinConfigured() : false;

  const handleSelectRole = (role) => {
    setSelectedRole(role);
    setPassword('');
    setErrorMsg(null);
    if (role !== 'ADMIN' && authMode === 'PIN_ENCRYPTED') {
      setAuthMode('CREDENTIALS');
    }
  };

  // Sync selected user details into form
  const handleSelectAccount = (acc) => {
    if (acc.role && acc.role !== selectedRole) {
      setSelectedRole(acc.role);
    }
    setSelectedUserKey(acc.username);
    setUsername(acc.username);
    setPassword('');
    setErrorMsg(null);
  };

  // Standard Login
  const handleLoginCredentials = async (e) => {
    if (e) e.preventDefault();
    if (!username.trim()) {
      setErrorMsg('Veuillez sélectionner un compte actif pour ce rôle avant de vous connecter.');
      return;
    }
    if (!password) {
      setErrorMsg('Veuillez renseigner le mot de passe du compte sélectionné.');
      return;
    }
    setErrorMsg(null);
    setIsLoading(true);

    try {
      await login(username, password);
    } catch (err) {
      setErrorMsg(err.message || 'Échec de connexion');
    } finally {
      setIsLoading(false);
    }
  };

  // Encrypted PIN Login
  const handleLoginPin = async (e) => {
    if (e) e.preventDefault();
    if (!pinCode.trim()) {
      setErrorMsg('Veuillez saisir votre code PIN chiffré.');
      return;
    }
    setErrorMsg(null);
    setIsLoading(true);

    try {
      if (loginWithPin) {
        await loginWithPin(pinCode);
      } else {
        await login('admin', pinCode);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Code PIN chiffré invalide');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetupPin = async (e) => {
    if (e) e.preventDefault();
    if (!pinCode.trim() || pinCode.length < 4) {
      setErrorMsg('Le Master PIN doit comporter au moins 4 chiffres.');
      return;
    }
    setErrorMsg(null);
    setIsLoading(true);

    try {
      await setupMasterPin(pinCode);
      setAuthMode('CREDENTIALS');
      setErrorMsg('Master PIN configuré avec succès. Vous pouvez maintenant vous connecter.');
    } catch (err) {
      setErrorMsg(err.message || 'Échec de configuration du PIN');
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
      localStorage.clear();
      sessionStorage.clear();
      window.location.reload();
    }
  };

  const getBadgeClass = (role) => {
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
        {/* Top Header Banner - Excel Twin Industrial Aesthetic */}
        <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-green-900 p-5 sm:p-6 text-white text-center relative shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 bg-white/10 border border-white/20 px-3 py-1 rounded-full backdrop-blur-xs">
              <Store className="w-4 h-4 text-emerald-200" />
              <span className="text-[11px] font-mono font-bold text-white tracking-wide">
                CIOB GMAO LIGHT
              </span>
            </div>

            <div className="bg-white/15 border border-white/20 px-3 py-1 rounded-full flex items-center gap-1.5 backdrop-blur-xs">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-200" />
              <span className="text-[10px] font-mono font-bold text-white">
                Identité & Rôles GMAO
              </span>
            </div>
          </div>

          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-2">
            Authentification Sécurisée
          </h2>
          <p className="text-xs text-emerald-100 font-medium mt-0.5 max-w-md mx-auto">
            Choisissez votre rôle, sélectionnez votre compte nominatif et saisissez votre code d'accès
          </p>
        </div>

        {/* Current / Previous Active Session Card */}
        {currentSession && (
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

          {/* STEP 1: Role Tiles Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-slate-500" />
                <span>1. Choisir votre profil / rôle</span>
              </label>
              <span className="text-[10.5px] text-slate-400 font-mono">Étape 1 / 2</span>
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

          {/* STEP 2: Active Identity Selection under the chosen Role */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-500" />
                <span>
                  2. Sélectionner le compte actif (
                  {ROLE_TILES.find((r) => r.role === selectedRole)?.label})
                </span>
              </label>
              <span className="text-[10.5px] text-slate-400 font-mono">
                {roleAccounts.length} compte(s) actif(s)
              </span>
            </div>

            {roleAccounts.length === 0 ? (
              <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50/70 text-amber-900 text-xs space-y-1.5">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Aucun compte actif pour ce rôle</span>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  L'usine ne contient actuellement aucun compte de connexion actif pour le profil{' '}
                  <b>{ROLE_TILES.find((r) => r.role === selectedRole)?.label}</b>. Connectez-vous en
                  tant qu'<b>Administrateur</b> puis ouvrez <b>Utilisateurs & Équipes</b> pour
                  activer l'accès d'un technicien ou charger les données de démonstration.
                </p>
              </div>
            ) : (
              <div
                className={`grid gap-2 max-h-48 overflow-y-auto pr-0.5 ${
                  roleAccounts.length === 1
                    ? 'grid-cols-1'
                    : 'grid-cols-1 sm:grid-cols-2'
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

          {/* Authentication Mode Switcher (Credentials vs Encrypted PIN) */}
          <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
            <button
              type="button"
              id="tab-auth-credentials"
              onClick={() => {
                setAuthMode('CREDENTIALS');
                setErrorMsg(null);
              }}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                authMode === 'CREDENTIALS'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <User className="w-3.5 h-3.5 text-emerald-600" />
              <span>Identifiant & Mot de Passe</span>
            </button>

            <button
              type="button"
              id="tab-auth-pin"
              onClick={() => {
                setAuthMode('PIN_ENCRYPTED');
                setErrorMsg(null);
              }}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer relative ${
                authMode === 'PIN_ENCRYPTED'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Cpu className="w-3.5 h-3.5 text-emerald-600" />
              <span>Code PIN Chiffré</span>
              {hasConfiguredPin && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ml-0.5" />
              )}
            </button>
          </div>

          {/* Mode 1: Standard Username + Password */}
          {authMode === 'CREDENTIALS' ? (
            <form onSubmit={handleLoginCredentials} className="space-y-4">
              {/* Username / Active Account Field */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider font-mono">
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

              {/* Password Field */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider font-mono">
                    Mot de passe
                  </label>
                  {selectedRole === 'TECHNICIEN' && (
                    <span className="text-[10px] font-mono text-slate-400">
                      Démo par défaut : tech ou 1234
                    </span>
                  )}
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
                disabled={isLoading || !username.trim()}
                className="w-full bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-bold py-3 px-4 rounded-xl text-xs transition shadow-md hover:shadow-lg flex items-center justify-center gap-2 group cursor-pointer mt-2 disabled:opacity-50"
              >
                <span>
                  {isLoading
                    ? 'Connexion en cours...'
                    : selectedAccount
                      ? `Se Connecter (${selectedAccount.name})`
                      : 'Se Connecter'}
                </span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </form>
          ) : authMode === 'PIN_ENCRYPTED' ? (
            /* Mode 2: Encrypted PIN Login using Settings BCrypt Engine */
            <form onSubmit={handleLoginPin} className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Moteur BCrypt (Paramètres)</span>
                  </span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-mono font-bold">
                    {hasConfiguredPin ? 'PIN Personnalisé Configuré' : 'PIN Administrateur'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-normal">
                  Ce mode utilise l'algorithme BCrypt configuré dans l'onglet Paramètres pour
                  valider le code d'accès administrateur.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider font-mono mb-1.5">
                  Code PIN Chiffré
                </label>
                <div className="relative">
                  <Hash className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    id="input-login-pin"
                    type={showPassword ? 'text' : 'password'}
                    value={pinCode}
                    onChange={(e) => {
                      setPinCode(e.target.value);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    placeholder="Saisir votre code PIN..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-10 py-2.5 text-xs font-mono text-slate-900 tracking-widest focus:outline-none focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 transition"
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

              <button
                type="submit"
                id="btn-submit-pin"
                disabled={isLoading}
                className="w-full bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-bold py-3 px-4 rounded-xl text-xs transition shadow-md hover:shadow-lg flex items-center justify-center gap-2 group cursor-pointer mt-2 disabled:opacity-50"
              >
                <span>{isLoading ? 'Vérification du PIN...' : 'Valider & Déverrouiller'}</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </form>
          ) : (
            /* Mode 3: Initial PIN Setup */
            <form onSubmit={handleSetupPin} className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  <span className="font-bold text-emerald-800">Configuration Initiale</span>
                </div>
                <p className="text-xs text-emerald-700 leading-relaxed">
                  C'est votre première connexion. Veuillez définir un <b>Master PIN</b> (4 chiffres
                  minimum). Ce code servira à chiffrer vos données et sera également le mot de passe
                  du compte <b>admin</b>.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider font-mono mb-1.5">
                  Nouveau Master PIN
                </label>
                <div className="relative">
                  <Hash className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    id="input-setup-pin"
                    type={showPassword ? 'text' : 'password'}
                    value={pinCode}
                    onChange={(e) => {
                      setPinCode(e.target.value);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    placeholder="Choisir un code PIN (ex: 1234)..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-10 py-2.5 text-xs font-mono text-slate-900 tracking-widest focus:outline-none focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 transition"
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

              <button
                type="submit"
                id="btn-setup-pin"
                disabled={isLoading}
                className="w-full bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-bold py-3 px-4 rounded-xl text-xs transition shadow-md hover:shadow-lg flex items-center justify-center gap-2 group cursor-pointer mt-2 disabled:opacity-50"
              >
                <span>{isLoading ? 'Initialisation...' : 'Configurer & Continuer'}</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                type="button"
                onClick={() => setAuthMode('CREDENTIALS')}
                className="w-full text-center text-[10px] text-slate-400 hover:text-emerald-600 transition font-mono uppercase font-bold tracking-tighter"
              >
                Ignorer pour l'instant (Utiliser admin/admin)
              </button>
            </form>
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col gap-2">
          <div className="text-center text-[11px] text-slate-500 font-mono">
            CIOB GMAO Light • Entreprise Edition • Architecture 100% Offline
          </div>

          <button
            onClick={handleResetApp}
            className="text-[9px] text-slate-300 hover:text-rose-400 transition font-mono uppercase font-medium self-center"
          >
            Réinitialiser l'application (Dépannage)
          </button>
        </div>
      </div>
    </div>
  );
}

