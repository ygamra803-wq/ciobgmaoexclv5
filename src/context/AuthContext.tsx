import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { z } from 'zod';
import { Container } from '../core/di/Container';
import { accessLogService } from '../utils/AccessLogService';
import { vaultService } from '../utils/vaultService';
import { SecurityService } from '../core/security/SecurityService';
import { validatePasswordPolicy } from '../core/security/AuthService';
import {
  LicenseGateService,
  type ILicenseRecord,
} from '../core/security/LicenseGateService';
import {
  clearClientServerSessionToken,
  getClientServerSessionToken,
} from '../core/security/serverSession';
import {
  authenticateServerSession,
  ensureFreshServerSession,
  revokeServerSession,
} from '../core/security/serverSessionClient';

const AuthContext = createContext<any>(null);

const LoginSchema = z.object({
  username: z
    .string()
    .min(3, "Nom d'utilisateur d'au moins 3 caractères")
    .max(50, "Nom d'utilisateur trop long (max 50)")
    .regex(/^[a-zA-Z0-9_.-]+$/, "Le nom d'utilisateur contient des caractères invalides"),
  password: z
    .string()
    .min(3, 'Le mot de passe doit comporter au moins 3 caractères')
    .max(128, 'Mot de passe trop long (max 128)'),
  licenseKey: z
    .string()
    .min(
      1,
      'Authentification à double clé requise (AND) : la clé de licence commerciale est obligatoire'
    )
    .max(128, 'La clé de licence est trop longue'),
});

function getStoredAttempts() {
  try {
    const saved = SecurityService.getSessionSecure('gmao_login_attempts');
    if (saved && typeof saved === 'object') {
      return new Map(Object.entries(saved));
    }
  } catch {
    // ignore
  }
  return new Map();
}

function persistAttempts(map) {
  try {
    const obj = Object.fromEntries(map.entries());
    SecurityService.saveSessionSecure('gmao_login_attempts', obj);
  } catch {
    // ignore
  }
}

const loginAttemptsMap = getStoredAttempts(); // username -> { count, lockUntil }
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

function checkRateLimit(username) {
  const record = loginAttemptsMap.get(username);
  if (!record) return;
  if (record.lockUntil && Date.now() < record.lockUntil) {
    const remainingMinutes = Math.ceil((record.lockUntil - Date.now()) / 60000);
    throw new Error(
      `Compte temporairement verrouillé (${remainingMinutes} min restantes). Trop de tentatives.`
    );
  }
  if (record.lockUntil && Date.now() >= record.lockUntil) {
    loginAttemptsMap.delete(username);
    persistAttempts(loginAttemptsMap);
  }
}

function recordFailedAttempt(username) {
  const record = loginAttemptsMap.get(username) || { count: 0, lockUntil: null };
  record.count += 1;
  if (record.count >= MAX_LOGIN_ATTEMPTS) {
    record.lockUntil = Date.now() + LOCKOUT_DURATION_MS;
  }
  loginAttemptsMap.set(username, record);
  persistAttempts(loginAttemptsMap);
}

function resetFailedAttempts(username) {
  loginAttemptsMap.delete(username);
  persistAttempts(loginAttemptsMap);
}

export const AuthProvider = ({ children }) => {
  const authService = Container.resolve('auth');

  const [user, setUser] = useState(() => authService?.getCurrentUser() || null);
  const [isVaultExists, setIsVaultExists] = useState(() => vaultService.isVaultExists());
  const [isVaultUnlocked, setIsVaultUnlocked] = useState(false);
  const [licenseRecord, setLicenseRecord] = useState<ILicenseRecord | null>(() =>
    LicenseGateService.getLicenseRecord()
  );
  const [isLicenseActive, setIsLicenseActive] = useState<boolean>(() =>
    Boolean(
      authService?.isLicenseActivated
        ? authService.isLicenseActivated()
        : LicenseGateService.isLicenseActive()
    )
  );
  const [rememberedLicenseKey, setRememberedLicenseKeyState] = useState<string>(() =>
    LicenseGateService.getRememberedLicenseKey()
  );
  const [accounts, setAccounts] = useState(() => authService?.getAvailableAccounts(true) || []);
  const [serverSessionError, setServerSessionError] = useState<string | null>(null);

  const refreshAccountsState = useCallback(() => {
    if (authService?.getAvailableAccounts) {
      setAccounts(authService.getAvailableAccounts(true));
    }
    setLicenseRecord(LicenseGateService.getLicenseRecord());
    setIsLicenseActive(
      Boolean(
        authService?.isLicenseActivated
          ? authService.isLicenseActivated()
          : LicenseGateService.isLicenseActive()
      )
    );
    setRememberedLicenseKeyState(LicenseGateService.getRememberedLicenseKey());
  }, [authService]);

  // Check initial session & subscribe to account/license updates
  useEffect(() => {
    const sessionUser = authService?.getCurrentUser();
    if (sessionUser) {
      setUser(sessionUser);
    }
    setIsVaultExists(vaultService.isVaultExists());
    refreshAccountsState();

    const handleAccountsChange = () => {
      refreshAccountsState();
      const latestSession = authService?.getCurrentUser();
      setUser(latestSession || null);
    };

    const handleServerSessionRejected = (e: any) => {
      const msg =
        e?.detail?.error || e?.detail?.message || 'Session serveur LAN expirée ou refusée.';
      setServerSessionError(msg);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('gmao_auth_accounts_updated', handleAccountsChange);
      window.addEventListener('gmao_license_record_updated', handleAccountsChange);
      window.addEventListener('storage', handleAccountsChange);
      window.addEventListener('gmao:server_session_expired', handleServerSessionRejected);
      window.addEventListener('gmao:server_session_rejected', handleServerSessionRejected);
      return () => {
        window.removeEventListener('gmao_auth_accounts_updated', handleAccountsChange);
        window.removeEventListener('gmao_license_record_updated', handleAccountsChange);
        window.removeEventListener('storage', handleAccountsChange);
        window.removeEventListener('gmao:server_session_expired', handleServerSessionRejected);
        window.removeEventListener('gmao:server_session_rejected', handleServerSessionRejected);
      };
    }
  }, [authService, refreshAccountsState]);

  // Proactive silent server session refresh (SEC-LAN-P2: refreshes within 25 min of exp)
  useEffect(() => {
    if (!user || typeof window === 'undefined') return;

    const runProactiveRefresh = () => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
      if (!getClientServerSessionToken()) return;
      void ensureFreshServerSession();
    };

    runProactiveRefresh();
    const intervalId = window.setInterval(runProactiveRefresh, 60 * 1000);
    window.addEventListener('focus', runProactiveRefresh);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', runProactiveRefresh);
    };
  }, [user]);

  /**
   * LOGIN-LICENSE-P0: First-Run Activation of Commercial License Key + Independent Admin Password.
   */
  const activateLicenseAndAdmin = useCallback(
    async (params: {
      licenseKey: string;
      adminPassword: string;
      organizationLabel?: string;
      seatsHint?: string;
      rememberLicenseOnDevice?: boolean;
    }) => {
      if (!authService?.activateLicenseAndAdmin) {
        throw new Error("Service d'activation de licence indisponible.");
      }
      const res = await authService.activateLicenseAndAdmin(params);
      setIsVaultExists(true);
      setIsVaultUnlocked(true);
      refreshAccountsState();
      return res;
    },
    [authService, refreshAccountsState]
  );

  /**
   * LOGIN-LICENSE-P0: Rotate the Commercial License Key (requires current license key + current Admin password).
   */
  const rotateLicenseKey = useCallback(
    async (params: {
      currentLicenseKey: string;
      adminPassword: string;
      newLicenseKey: string;
      organizationLabel?: string;
      seatsHint?: string;
    }) => {
      if (!authService?.rotateLicenseKeyWithAdminAuth) {
        throw new Error('Service de rotation de licence indisponible.');
      }
      const rotated = await authService.rotateLicenseKeyWithAdminAuth(params);
      setIsVaultExists(true);
      setIsVaultUnlocked(true);
      refreshAccountsState();
      return rotated;
    },
    [authService, refreshAccountsState]
  );

  /**
   * Legacy setupMasterPin wrapper:
   * Strictly rejects single-key setup (`LOGIN-LICENSE-P0`) unless an independent `adminPassword` is provided.
   */
  const setupMasterPin = useCallback(
    async (licenseKeyOrPin: string, adminPassword?: string, organizationLabel?: string) => {
      if (!adminPassword) {
        throw new Error(
          'Initialisation à clé unique interdite (LOGIN-LICENSE-P0) : veuillez fournir à la fois la clé de licence commerciale ET un mot de passe Administrateur distinct.'
        );
      }
      await activateLicenseAndAdmin({
        licenseKey: licenseKeyOrPin,
        adminPassword,
        organizationLabel,
      });
      return true;
    },
    [activateLicenseAndAdmin]
  );

  // Déchiffrement du coffre-fort avec la clé de licence
  const unlockVault = useCallback(
    async (licenseKey) => {
      const cleanKey = (licenseKey || '').trim();
      if (!cleanKey) throw new Error('Veuillez saisir la clé de licence commerciale.');
      const isValidLic = await LicenseGateService.verifyLicenseKey(cleanKey, {
        touchLastAuth: false,
      });
      if (!isValidLic) {
        throw new Error('Clé de licence commerciale incorrecte.');
      }
      if (vaultService.isVaultExists()) {
        try {
          const vault = await vaultService.decryptVault(cleanKey);
          if (vault) {
            setIsVaultUnlocked(true);
            await vaultService.setPinHash(cleanKey);
            refreshAccountsState();
            return vault;
          }
        } catch {
          // Vault may have been initialized prior to rotation
        }
      }
      setIsVaultUnlocked(true);
      refreshAccountsState();
      return true;
    },
    [refreshAccountsState]
  );

  // Verrouillage du coffre-fort
  const lockVault = useCallback(() => {
    vaultService.clearMasterPin?.();
    setIsVaultUnlocked(false);
    void revokeServerSession();
    setServerSessionError(null);
    authService?.logout();
    setUser(null);
  }, [authService]);

  // Liste canonique des comptes disponibles (par défaut uniquement les comptes actifs pour l'écran de connexion)
  const getAvailableAccounts = useCallback(
    (includeInactive = false) => {
      const list = authService?.getAvailableAccounts
        ? authService.getAvailableAccounts(includeInactive)
        : accounts.filter((a) => (includeInactive ? true : a.isActive !== false));

      return list.map((acc) => ({
        id: acc.id,
        code: acc.code || acc.personnelId || acc.username,
        username: acc.username || acc.code,
        name: acc.name || acc.libelle,
        libelle: acc.libelle || acc.titleFr || acc.name,
        role: acc.role,
        titleFr: acc.titleFr || acc.role,
        avatar: acc.avatar || (acc.name || acc.username || 'US').substring(0, 2).toUpperCase(),
        badgeColor: acc.badgeColor || 'slate',
        description: acc.description || '',
        personnelId: acc.personnelId || null,
        personnelName: acc.personnelName || acc.name || null,
        id_zone: acc.id_zone || null,
        specialite: acc.specialite || null,
        isActive: acc.isActive !== false,
      }));
    },
    [accounts, authService]
  );

  /**
   * LOGIN-LICENSE-P0: Unified Dual-Key `AND` Login.
   * Requires `username`, `password`, AND `licenseKey` (also accepts `pin` alias in params object).
   */
  const login = useCallback(
    async (usernameOrParams, passwordParam?: string, licenseKeyParam?: string) => {
      const usernameRaw =
        typeof usernameOrParams === 'object' && usernameOrParams !== null
          ? usernameOrParams.code || usernameOrParams.username || ''
          : usernameOrParams || '';
      const passwordRaw =
        typeof usernameOrParams === 'object' && usernameOrParams !== null
          ? usernameOrParams.password || ''
          : passwordParam || '';
      const licenseKeyRaw =
        typeof usernameOrParams === 'object' && usernameOrParams !== null
          ? usernameOrParams.licenseKey ||
            usernameOrParams.pin ||
            usernameOrParams.pinCode ||
            ''
          : licenseKeyParam || '';

      try {
        LoginSchema.parse({
          username: String(usernameRaw || '').trim(),
          password: String(passwordRaw || '').trim(),
          licenseKey: String(licenseKeyRaw || '').trim(),
        });
      } catch (err: any) {
        const detail =
          err?.issues?.[0]?.message || err?.errors?.[0]?.message || 'Entrées invalides';
        throw new Error(`Validation des données : ${detail}`, { cause: err });
      }

      const username = String(usernameRaw || '').trim().toLowerCase();
      const password = String(passwordRaw || '').trim();
      const licenseKey = String(licenseKeyRaw || '').trim();

      checkRateLimit(username);

      try {
        const loggedInUser = await authService.login(username, password, licenseKey);

        if (vaultService.isVaultExists()) {
          try {
            await vaultService.decryptVault(licenseKey);
            setIsVaultUnlocked(true);
          } catch {
            // Vault decryption is non-fatal once LicenseGateService PBKDF2 verifier succeeded
          }
        }

        resetFailedAttempts(username);
        setUser(loggedInUser);
        refreshAccountsState();
        await accessLogService.recordLogin(loggedInUser);

        // Obtain server-issued HMAC session token (never falls back to header-only ADMIN on 401/403)
        const actorIdentifier = String(
          loggedInUser?.personnelId ||
            loggedInUser?.code ||
            loggedInUser?.id ||
            loggedInUser?.username ||
            username
        ).trim();
        const serverAuth = await authenticateServerSession(actorIdentifier, password);
        if (serverAuth?.success) {
          setServerSessionError(null);
        } else if (serverAuth && serverAuth.offline === false) {
          setServerSessionError(serverAuth.error || 'Session serveur LAN refusée.');
        }

        return loggedInUser;
      } catch (err) {
        recordFailedAttempt(username);
        throw err;
      }
    },
    [authService, refreshAccountsState]
  );

  // LOGIN-LICENSE-P0: PIN-only login is strictly prohibited
  const loginWithPin = useCallback(
    async (pin?: string) => {
      const rateLimitKey = '__pin_login_attempts__';
      checkRateLimit(rateLimitKey);
      try {
        return await authService.loginWithPin(pin);
      } catch (err) {
        recordFailedAttempt(rateLimitKey);
        throw err;
      }
    },
    [authService]
  );

  const logout = useCallback(() => {
    accessLogService.recordLogout();
    void revokeServerSession();
    setServerSessionError(null);
    authService?.logout();
    setUser(null);
  }, [authService]);

  const updateUserPassword = useCallback(
    async (username, newPass, licenseKey) => {
      const cleanPass = validatePasswordPolicy(newPass);

      if (LicenseGateService.isLicenseActive()) {
        if (!licenseKey || !String(licenseKey).trim()) {
          throw new Error(
            'Veuillez saisir la clé de licence commerciale pour autoriser la modification du mot de passe.'
          );
        }
        const isValidLic = await LicenseGateService.verifyLicenseKey(licenseKey, {
          touchLastAuth: false,
        });
        if (!isValidLic) {
          throw new Error('Clé de licence commerciale incorrecte.');
        }
      }

      if (vaultService.isVaultExists() && licenseKey) {
        await vaultService.decryptVault(licenseKey).catch(() => {});
      }

      const updated = await authService?.updateUserPassword(username, cleanPass);
      const latestSession = authService?.getCurrentUser();
      if (latestSession) {
        setUser(latestSession);
      }
      refreshAccountsState();
      if (getClientServerSessionToken()) {
        import('../services/serverSyncService')
          .then(({ serverSyncService }) => serverSyncService.scheduleAutoPush(undefined, 250))
          .catch(() => {});
      }
      return updated;
    },
    [authService, refreshAccountsState]
  );

  const switchSessionToUser = useCallback(
    async (username, licenseKey) => {
      if (LicenseGateService.isLicenseActive() && licenseKey) {
        const isValidLic = await LicenseGateService.verifyLicenseKey(licenseKey, {
          touchLastAuth: false,
        });
        if (!isValidLic) {
          throw new Error('Clé de licence commerciale incorrecte.');
        }
      }
      // Clear any higher-privilege server session token when switching profiles locally
      clearClientServerSessionToken();
      setServerSessionError(null);
      const newSession = authService?.switchSessionToUser(username);
      setUser(newSession);
      return newSession;
    },
    [authService]
  );

  const resetAllAccountsToDefaults = useCallback(
    async (licenseKey) => {
      if (LicenseGateService.isLicenseActive()) {
        if (!licenseKey) {
          throw new Error(
            'Veuillez saisir la clé de licence commerciale pour autoriser la réinitialisation.'
          );
        }
        const isValidLic = await LicenseGateService.verifyLicenseKey(licenseKey, {
          touchLastAuth: false,
        });
        if (!isValidLic) {
          throw new Error('Clé de licence commerciale incorrecte.');
        }
      }
      vaultService.clearMasterPin?.();
      SecurityService.removeSecure('gmao_vault_cipher_v2');
      SecurityService.removeSecure('gmao_vault_iv_v2');
      SecurityService.removeSecure('gmao_vault_pin_hash_v2');
      setIsVaultExists(false);
      setIsVaultUnlocked(false);
      if (authService?.resetAllAccountsToDefaults) {
        authService.resetAllAccountsToDefaults();
      }
      refreshAccountsState();
      return true;
    },
    [authService, refreshAccountsState]
  );

  const upsertPersonnelAuthAccount = useCallback(
    async (params) => {
      const res = await authService?.upsertPersonnelAuthAccount(params);
      refreshAccountsState();
      return res;
    },
    [authService, refreshAccountsState]
  );

  const toggleAccountActive = useCallback(
    (usernameOrIdOrPersonnelId, isActive) => {
      const res = authService?.toggleAccountActive(usernameOrIdOrPersonnelId, isActive);
      refreshAccountsState();
      return res;
    },
    [authService, refreshAccountsState]
  );

  const removePersonnelAuthAccount = useCallback(
    (personnelId) => {
      const res = authService?.removePersonnelAuthAccount(personnelId);
      refreshAccountsState();
      return res;
    },
    [authService, refreshAccountsState]
  );

  const getAccountForPersonnel = useCallback(
    (personnelId) => {
      return authService?.getAccountForPersonnel(personnelId) || null;
    },
    [authService, accounts]
  );

  const setRememberedLicenseKey = useCallback(
    (key: string, remember: boolean) => {
      LicenseGateService.setRememberedLicenseKey(key, remember);
      setRememberedLicenseKeyState(LicenseGateService.getRememberedLicenseKey());
    },
    []
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        currentUser: user,
        accounts,
        isVaultExists,
        isVaultUnlocked,
        licenseRecord,
        isLicenseActive,
        rememberedLicenseKey,
        setRememberedLicenseKey,
        activateLicenseAndAdmin,
        rotateLicenseKey,
        serverSessionError,
        isServerSessionActive: Boolean(getClientServerSessionToken()),
        setupMasterPin,
        unlockVault,
        lockVault,
        login,
        loginWithPin,
        logout,
        getAvailableAccounts,
        getAccountForPersonnel,
        upsertPersonnelAuthAccount,
        toggleAccountActive,
        removePersonnelAuthAccount,
        isPinConfigured: () =>
          Boolean(
            authService?.isLicenseActivated
              ? authService.isLicenseActivated()
              : LicenseGateService.isLicenseActive()
          ),
        getCurrentSessionUser: () => user || authService?.getCurrentUser(),
        updateUserPassword,
        updateUserProfile: (username, updates) => {
          const res = authService?.updateUserProfile(username, updates);
          refreshAccountsState();
          return res;
        },
        resetAllAccountsToDefaults,
        switchSessionToUser,
        hashPassword: (pass) => SecurityService.hashPassword(pass || ''),
        verifyPassword: (pass, hash) => SecurityService.comparePassword(pass || '', hash || ''),
        hashPasswordBCrypt: (pass) => SecurityService.hashPassword(pass || ''),
        verifyPasswordBCrypt: (pass, hash) =>
          SecurityService.comparePassword(pass || '', hash || ''),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

export default AuthContext;


