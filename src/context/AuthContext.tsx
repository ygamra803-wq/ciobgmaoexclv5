import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { z } from 'zod';
import { Container } from '../core/di/Container';
import { accessLogService } from '../utils/AccessLogService';
import { vaultService } from '../utils/vaultService';
import { SecurityService } from '../core/security/SecurityService';

const AuthContext = createContext(null);

const LoginSchema = z.object({
  username: z
    .string()
    .min(2, "Nom d'utilisateur requis")
    .max(50, "Nom d'utilisateur trop long (max 50)")
    .regex(/^[a-zA-Z0-9_.-]+$/, "Le nom d'utilisateur contient des caractères invalides"),
  password: z
    .string()
    .min(3, 'Le mot de passe doit comporter au moins 3 caractères')
    .max(128, 'Mot de passe trop long (max 128)'),
  pin: z
    .string()
    .min(3, 'Le code PIN doit comporter au moins 3 caractères')
    .max(10, 'Le code PIN est trop long')
    .regex(/^\d+$/, 'Le code PIN doit comporter uniquement des chiffres')
    .optional(),
});

function getStoredAttempts() {
  try {
    if (typeof sessionStorage !== 'undefined') {
      const saved = sessionStorage.getItem('gmao_login_attempts');
      if (saved) {
        return new Map(Object.entries(JSON.parse(saved)));
      }
    }
  } catch {
    // ignore
  }
  return new Map();
}

function persistAttempts(map) {
  try {
    if (typeof sessionStorage !== 'undefined') {
      const obj = Object.fromEntries(map.entries());
      sessionStorage.setItem('gmao_login_attempts', JSON.stringify(obj));
    }
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

  const [user, setUser] = useState(null);
  const [isVaultExists, setIsVaultExists] = useState(() => vaultService.isVaultExists());
  const [isVaultUnlocked, setIsVaultUnlocked] = useState(false);
  const [accounts, setAccounts] = useState(() => authService?.getAvailableAccounts(true) || []);

  const refreshAccountsState = useCallback(() => {
    if (authService?.getAvailableAccounts) {
      setAccounts(authService.getAvailableAccounts(true));
    }
  }, [authService]);

  // Check initial session & subscribe to account updates
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

    if (typeof window !== 'undefined') {
      window.addEventListener('gmao_auth_accounts_updated', handleAccountsChange);
      window.addEventListener('storage', handleAccountsChange);
      return () => {
        window.removeEventListener('gmao_auth_accounts_updated', handleAccountsChange);
        window.removeEventListener('storage', handleAccountsChange);
      };
    }
  }, [authService, refreshAccountsState]);

  // Initialisation du Master PIN pour la première fois - synchronise avec la source unique AuthService
  const setupMasterPin = useCallback(
    async (pin) => {
      const cleanPin = (pin || '').trim();
      if (!cleanPin || cleanPin.length < 4) {
        throw new Error('Le Master PIN doit comporter au moins 4 chiffres.');
      }

      const adminHash = await SecurityService.hashPassword(cleanPin);
      const storedUsers = authService?.getStoredUsersList
        ? [...authService.getStoredUsersList()]
        : [];

      const updatedUsers = storedUsers.map((u) => {
        if (u.username === 'admin' || u.role === 'ADMIN') {
          const nextAdmin = { ...u, passwordHash: adminHash };
          delete nextAdmin.defaultPass;
          return nextAdmin;
        }
        return u;
      });

      if (authService?.saveStoredUsersList) {
        authService.saveStoredUsersList(updatedUsers, true);
      }

      const newVault = {
        version: 2,
        createdAt: new Date().toISOString(),
        accounts: updatedUsers,
      };

      await vaultService.encryptVault(newVault, cleanPin);
      await vaultService.setPinHash(cleanPin);

      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('gmao_admin_pin');
      }

      setIsVaultExists(true);
      setIsVaultUnlocked(true);
      refreshAccountsState();

      return true;
    },
    [authService, refreshAccountsState]
  );

  // Déchiffrement du coffre-fort avec le Master PIN
  const unlockVault = useCallback(
    async (pin) => {
      const cleanPin = (pin || '').trim();
      if (!cleanPin) throw new Error('Veuillez saisir le code Master PIN.');
      const vault = await vaultService.decryptVault(cleanPin);
      if (vault) {
        setIsVaultUnlocked(true);
        await vaultService.setPinHash(cleanPin);
        refreshAccountsState();
        return vault;
      }
      throw new Error('Structure du coffre-fort invalide.');
    },
    [refreshAccountsState]
  );

  // Verrouillage du coffre-fort
  const lockVault = useCallback(() => {
    vaultService.clearMasterPin?.();
    setIsVaultUnlocked(false);
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

  // Authentification système unifiée (supporte compte individuel + mot de passe ou Master PIN)
  const login = useCallback(
    async (usernameOrParams, passwordParam, pinParam) => {
      const usernameRaw =
        typeof usernameOrParams === 'object' && usernameOrParams !== null
          ? usernameOrParams.code || usernameOrParams.username || ''
          : usernameOrParams || '';
      const passwordRaw =
        typeof usernameOrParams === 'object' && usernameOrParams !== null
          ? usernameOrParams.password || ''
          : passwordParam || '';
      const pinRaw =
        typeof usernameOrParams === 'object' && usernameOrParams !== null
          ? usernameOrParams.pin || usernameOrParams.pinCode || ''
          : pinParam || '';

      try {
        LoginSchema.parse({
          username: String(usernameRaw || '').trim(),
          password: String(passwordRaw || '').trim(),
          pin: pinRaw ? String(pinRaw).trim() : undefined,
        });
      } catch (err) {
        throw new Error(
          `Validation des données : ${err.errors?.[0]?.message || 'Entrées invalides'}`,
          { cause: err }
        );
      }

      const username = String(usernameRaw || '').trim().toLowerCase();
      const password = String(passwordRaw || '').trim();
      const pin = String(pinRaw || '').trim();

      checkRateLimit(username);

      try {
        if (pin && vaultService.isVaultExists()) {
          try {
            await vaultService.decryptVault(pin);
            setIsVaultUnlocked(true);
          } catch {
            recordFailedAttempt(username);
            throw new Error(
              'Master PIN incorrect : échec du déchiffrement du coffre-fort (AES-GCM).'
            );
          }
        }

        const loggedInUser = await authService.login(username, password);
        resetFailedAttempts(username);
        setUser(loggedInUser);
        refreshAccountsState();
        await accessLogService.recordLogin(loggedInUser);
        return loggedInUser;
      } catch (err) {
        recordFailedAttempt(username);
        throw err;
      }
    },
    [authService, refreshAccountsState]
  );

  // Authentification rapide par code PIN (Administrateur)
  const loginWithPin = useCallback(
    async (pin) => {
      const cleanPin = (pin || '').trim();
      if (!cleanPin) throw new Error('Veuillez saisir le code PIN.');

      const rateLimitKey = '__pin_login_attempts__';
      checkRateLimit(rateLimitKey);

      try {
        const loggedInUser = await authService.loginWithPin(cleanPin);
        setUser(loggedInUser);
        setIsVaultUnlocked(true);
        refreshAccountsState();
        await accessLogService.recordLogin(loggedInUser);
        resetFailedAttempts(rateLimitKey);
        return loggedInUser;
      } catch (err) {
        recordFailedAttempt(rateLimitKey);
        throw err;
      }
    },
    [authService, refreshAccountsState]
  );

  const logout = useCallback(() => {
    accessLogService.recordLogout();
    authService?.logout();
    setUser(null);
  }, [authService]);

  const updateUserPassword = useCallback(
    async (username, newPass, masterPin) => {
      const cleanPass = (newPass || '').trim();
      if (cleanPass.length < 4) {
        throw new Error('Le mot de passe doit comporter au moins 4 caractères.');
      }

      if (vaultService.isVaultExists() && masterPin) {
        await vaultService.decryptVault(masterPin);
      }

      const updated = await authService?.updateUserPassword(username, cleanPass);
      refreshAccountsState();
      return updated;
    },
    [authService, refreshAccountsState]
  );

  const switchSessionToUser = useCallback(
    async (username, masterPin) => {
      if (vaultService.isVaultExists() && masterPin) {
        await vaultService.decryptVault(masterPin);
      }
      const newSession = authService?.switchSessionToUser(username);
      setUser(newSession);
      return newSession;
    },
    [authService]
  );

  const resetAllAccountsToDefaults = useCallback(
    async (masterPin) => {
      if (vaultService.isVaultExists()) {
        if (!masterPin) {
          throw new Error('Veuillez saisir le Master PIN pour autoriser la réinitialisation.');
        }
        await vaultService.decryptVault(masterPin);
      }
      vaultService.clearMasterPin?.();
      localStorage.removeItem('gmao_vault_cipher_v2');
      localStorage.removeItem('gmao_vault_iv_v2');
      localStorage.removeItem('gmao_vault_pin_hash_v2');
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

  return (
    <AuthContext.Provider
      value={{
        user,
        currentUser: user,
        accounts,
        isVaultExists,
        isVaultUnlocked,
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
        isPinConfigured: () => vaultService.isVaultExists() || authService?.isPinConfigured(),
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
        verifyPasswordBCrypt: (pass, hash) => SecurityService.comparePassword(pass || '', hash || ''),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

export default AuthContext;

