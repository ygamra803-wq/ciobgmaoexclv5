import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { z } from 'zod';
import { Container } from '../core/di/Container';
import { accessLogService } from '../utils/AccessLogService';
import { vaultService } from '../utils/vaultService';
import { SecurityService } from '../core/security/SecurityService';

const AuthContext = createContext(null);

const LoginSchema = z.object({
  username: z.string().min(3, "Nom d'utilisateur d'au moins 3 caractères requis").max(50, "Nom d'utilisateur trop long (max 50)").regex(/^[a-zA-Z0-9_-]+$/, "Le nom d'utilisateur contient des caractères invalides"),
  password: z.string().min(3, "Le mot de passe doit comporter au moins 3 caractères").max(128, "Mot de passe trop long (max 128)"),
  pin: z.string().min(3, "Le code PIN doit comporter au moins 3 caractères").max(10, "Le code PIN est trop long").regex(/^\d+$/, "Le code PIN doit comporter uniquement des chiffres").optional(),
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
    throw new Error(`Compte temporairement verrouillé (${remainingMinutes} min restantes). Trop de tentatives.`);
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
  const [user, setUser] = useState(null);
  const [isVaultExists, setIsVaultExists] = useState(() => vaultService.isVaultExists());
  const [isVaultUnlocked, setIsVaultUnlocked] = useState(false);
  const [accounts, setAccounts] = useState([]);

  // Resolve AuthService for legacy/storage compatibility
  const authService = Container.resolve('auth');

  // Check initial session
  useEffect(() => {
    const sessionUser = authService?.getCurrentUser();
    if (sessionUser) {
      setUser(sessionUser);
    }
    setIsVaultExists(vaultService.isVaultExists());
  }, [authService]);

  // Initialisation du Master PIN pour la première fois - crée le coffre chiffré AES-256-GCM
  const setupMasterPin = useCallback(async (pin) => {
    const cleanPin = (pin || '').trim();
    if (!cleanPin || cleanPin.length < 4) {
      throw new Error('Le Master PIN doit comporter au moins 4 chiffres.');
    }

    const [adminHash, magHash, techHash, viewHash] = await Promise.all([
      SecurityService.hashPassword(cleanPin),
      SecurityService.hashPassword(`${cleanPin}#mag`),
      SecurityService.hashPassword(`${cleanPin}#tech`),
      SecurityService.hashPassword(`${cleanPin}#view`),
    ]);

    const defaultAccounts = [
      {
        id: 'ID-ADMIN-001',
        code: 'admin',
        username: 'admin',
        libelle: 'Administrateur Système',
        name: 'Administrateur',
        role: 'ADMIN',
        titleFr: 'Administrateur Système',
        avatar: 'AD',
        badgeColor: 'emerald',
        passwordHash: adminHash,
        description: 'Supervision complète, paramétrage & sécurité'
      },
      {
        id: 'ID-MAG-001',
        code: 'magasinier',
        username: 'magasinier',
        libelle: 'Responsable Magasin (RMG)',
        name: 'Responsable Magasin',
        role: 'RESPONSABLE_MAGASIN',
        titleFr: 'Responsable Magasin (RMG)',
        avatar: 'RM',
        badgeColor: 'amber',
        passwordHash: magHash,
        description: 'Gestion du stock, réapprovisionnement & PDR'
      },
      {
        id: 'ID-TECH-001',
        code: 'tech',
        username: 'tech',
        libelle: 'Technicien Maintenance (TC)',
        name: 'Technicien Maintenance',
        role: 'TECHNICIEN',
        titleFr: 'Technicien Maintenance (TC)',
        avatar: 'TC',
        badgeColor: 'blue',
        passwordHash: techHash,
        description: 'Bons de sortie, pannes & interventions'
      },
      {
        id: 'ID-VIEW-001',
        code: 'viewer',
        username: 'viewer',
        libelle: 'Observateur / Consultation',
        name: 'Observateur',
        role: 'VIEWER',
        titleFr: 'Observateur / Consultation',
        avatar: 'OB',
        badgeColor: 'slate',
        passwordHash: viewHash,
        description: 'Accès lecture seule aux KPIs et tables'
      },
    ];

    const newVault = {
      version: 2,
      createdAt: new Date().toISOString(),
      accounts: defaultAccounts,
    };

    await vaultService.encryptVault(newVault, cleanPin);
    await vaultService.setPinHash(cleanPin);

    // Clean up any legacy unencrypted pin from localStorage
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('gmao_admin_pin');
    }

    setIsVaultExists(true);
    setIsVaultUnlocked(true);
    setAccounts(defaultAccounts.map(({ passwordHash: _passwordHash, ...rest }) => rest));

    return true;
  }, []);

  // Déchiffrement du coffre-fort avec le Master PIN
  const unlockVault = useCallback(async (pin) => {
    const cleanPin = (pin || '').trim();
    if (!cleanPin) throw new Error('Veuillez saisir le code Master PIN.');
    const vault = await vaultService.decryptVault(cleanPin);
    if (vault && Array.isArray(vault.accounts)) {
      setAccounts(vault.accounts.map(({ passwordHash: _passwordHash, ...rest }) => rest));
      setIsVaultUnlocked(true);
      await vaultService.setPinHash(cleanPin);
      return vault;
    }
    throw new Error('Structure du coffre-fort invalide.');
  }, []);

  // Verrouillage du coffre-fort
  const lockVault = useCallback(() => {
    vaultService.clearMasterPin?.();
    setIsVaultUnlocked(false);
    setAccounts([]);
    authService?.logout();
    setUser(null);
  }, [authService]);

  // Liste des comptes disponibles sans exposer les mots de passe
  const getAvailableAccounts = useCallback(() => {
    if (accounts.length > 0) {
      return accounts.map((acc) => ({
        id: acc.id,
        code: acc.code || acc.username,
        username: acc.username || acc.code,
        name: acc.name || acc.libelle,
        libelle: acc.libelle || acc.name,
        role: acc.role,
        titleFr: acc.titleFr || acc.role,
        avatar: acc.avatar || (acc.code || 'US').substring(0, 2).toUpperCase(),
        badgeColor: acc.badgeColor || 'slate',
        description: acc.description || '',
      }));
    }
    const legacyUsers = authService?.getAvailableAccounts() || [];
    return legacyUsers.map((acc) => ({
      id: acc.id,
      code: acc.username,
      username: acc.username,
      name: acc.name,
      libelle: acc.titleFr || acc.name,
      role: acc.role,
      titleFr: acc.titleFr || acc.role,
      avatar: acc.avatar || (acc.username || 'US').substring(0, 2).toUpperCase(),
      badgeColor: acc.badgeColor || 'slate',
      description: acc.description || '',
    }));
  }, [accounts, authService]);

  // Authentification système : supporte le 2FA (Code + Mot de passe + Master PIN)
  const login = useCallback(async (usernameOrParams, passwordParam, pinParam) => {
    const usernameRaw = (typeof usernameOrParams === 'object' && usernameOrParams !== null)
      ? (usernameOrParams.code || usernameOrParams.username || '')
      : (usernameOrParams || '');
    const passwordRaw = (typeof usernameOrParams === 'object' && usernameOrParams !== null)
      ? (usernameOrParams.password || '')
      : (passwordParam || '');
    const pinRaw = (typeof usernameOrParams === 'object' && usernameOrParams !== null)
      ? (usernameOrParams.pin || usernameOrParams.pinCode || '')
      : (pinParam || '');

    // 1. Zod Input Validation
    try {
      LoginSchema.parse({
        username: usernameRaw,
        password: passwordRaw,
        pin: pinRaw || undefined,
      });
    } catch (err) {
      throw new Error(`Validation des données : ${err.errors?.[0]?.message || 'Entrées invalides'}`, { cause: err });
    }

    const username = usernameRaw.trim().toLowerCase();
    const password = (passwordRaw || '').trim();
    const pin = (pinRaw || '').trim();

    // 2. Brute Force Rate Limiting Check
    checkRateLimit(username);

    try {
      // Case 1: Vault exists and PIN is provided -> 2FA Zero-Knowledge decryption
      if (vaultService.isVaultExists()) {
        let vault = null;

        // If user supplied PIN, decrypt vault with PIN
        if (pin) {
          try {
            vault = await vaultService.decryptVault(pin);
          } catch {
            recordFailedAttempt(username);
            throw new Error('Master PIN incorrect : échec du déchiffrement du coffre-fort (AES-GCM).');
          }
        }

        if (vault && Array.isArray(vault.accounts)) {
          // Look up account in decrypted vault
          const acc = vault.accounts.find(
            (a) =>
              (a.code && a.code.toLowerCase() === username) ||
              (a.username && a.username.toLowerCase() === username) ||
              (username === 'rmg' && (a.code === 'magasinier' || a.username === 'magasinier'))
          );

          if (!acc) {
            recordFailedAttempt(username);
            throw new Error(`Le compte "${username}" est introuvable dans le coffre-fort.`);
          }

          // Verify password with modern Web Crypto PBKDF2 (and legacy fallback)
          const isOk = acc.passwordHash && (await SecurityService.comparePassword(password, acc.passwordHash));
          if (!isOk) {
            recordFailedAttempt(username);
            throw new Error('Mot de passe incorrect.');
          }

          // Automatic seamless background upgrade if password was stored with legacy hash
          if (acc.passwordHash && SecurityService.isLegacyHash(acc.passwordHash) && pin) {
            try {
              const modernHash = await SecurityService.hashPassword(password);
              acc.passwordHash = modernHash;
              await vaultService.encryptVault(vault, pin);
            } catch {
              // Non-blocking background upgrade
            }
          }

          resetFailedAttempts(username);

          // Create session
          const sessionUser = {
            id: acc.id,
            code: acc.code || acc.username,
            username: acc.username || acc.code,
            name: acc.name || acc.libelle,
            role: acc.role,
            titleFr: acc.titleFr || acc.role,
            avatar: acc.avatar || (acc.code || 'US').substring(0, 2).toUpperCase(),
            badgeColor: acc.badgeColor || 'emerald',
            authMethod: 'VAULT_2FA',
            loginTime: Date.now(),
          };

          setUser(sessionUser);
          setIsVaultUnlocked(true);
          setAccounts(vault.accounts.map(({ passwordHash: _passwordHash, ...rest }) => rest));
          if (authService?.saveSignedSession) {
            authService.saveSignedSession(sessionUser);
          } else {
            sessionStorage.setItem('gmao_session_v2', JSON.stringify(sessionUser));
          }
          await accessLogService.recordLogin(sessionUser);
          return sessionUser;
        }
      }

      // Case 2: Standard authentication fallback
      const loggedInUser = await authService.login(username, password);
      resetFailedAttempts(username);
      setUser(loggedInUser);
      await accessLogService.recordLogin(loggedInUser);
      return loggedInUser;
    } catch (err) {
      recordFailedAttempt(username);
      throw err;
    }
  }, [authService]);

  // Authentification rapide par code PIN
  const loginWithPin = useCallback(async (pin) => {
    const cleanPin = (pin || '').trim();
    if (!cleanPin) throw new Error('Veuillez saisir le code PIN.');

    // Enforce rate limiting on PIN attempts
    const rateLimitKey = '__pin_login_attempts__';
    checkRateLimit(rateLimitKey);

    // If vault exists, try decrypting vault with PIN
    if (vaultService.isVaultExists()) {
      try {
        const vault = await vaultService.decryptVault(cleanPin);
        const adminAcc = vault.accounts.find((a) => a.role === 'ADMIN') || vault.accounts[0];
        const sessionUser = {
          id: adminAcc?.id || 'admin',
          code: adminAcc?.code || 'admin',
          username: adminAcc?.username || 'admin',
          name: adminAcc?.name || 'Administrateur',
          role: adminAcc?.role || 'ADMIN',
          titleFr: adminAcc?.titleFr || 'Administrateur Système',
          avatar: adminAcc?.avatar || 'AD',
          badgeColor: 'emerald',
          authMethod: 'VAULT_MASTER_PIN',
          loginTime: Date.now(),
        };
        setUser(sessionUser);
        setIsVaultUnlocked(true);
        setAccounts(vault.accounts.map(({ passwordHash: _passwordHash, ...rest }) => rest));
        if (authService?.saveSignedSession) {
          authService.saveSignedSession(sessionUser);
        } else {
          sessionStorage.setItem('gmao_session_v2', JSON.stringify(sessionUser));
        }
        await accessLogService.recordLogin(sessionUser);
        resetFailedAttempts(rateLimitKey);
        return sessionUser;
      } catch {
        recordFailedAttempt(rateLimitKey);
        throw new Error('Master PIN incorrect : échec du déchiffrement du coffre-fort.');
      }
    }

    // Fallback to authService PIN login with rate limiting
    try {
      const loggedInUser = await authService.loginWithPin(cleanPin);
      setUser(loggedInUser);
      await accessLogService.recordLogin(loggedInUser);
      resetFailedAttempts(rateLimitKey);
      return loggedInUser;
    } catch (err) {
      recordFailedAttempt(rateLimitKey);
      throw err;
    }
  }, [authService]);

  const logout = useCallback(() => {
    accessLogService.recordLogout();
    authService?.logout();
    setUser(null);
  }, [authService]);

  // Mise à jour du mot de passe d'un compte dans le coffre chiffré
  const updateUserPassword = useCallback(async (username, newPass, masterPin) => {
    const cleanPass = (newPass || '').trim();
    if (cleanPass.length < 4) {
      throw new Error('Le mot de passe doit comporter au moins 4 caractères.');
    }

    if (vaultService.isVaultExists()) {
      if (!masterPin) {
        throw new Error('Veuillez saisir le Master PIN pour déverrouiller et mettre à jour le coffre-fort.');
      }
      const vault = await vaultService.decryptVault(masterPin);
      const idx = vault.accounts.findIndex(
        (a) => (a.code && a.code.toLowerCase() === username.toLowerCase()) ||
               (a.username && a.username.toLowerCase() === username.toLowerCase()) ||
               a.id === username
      );
      if (idx === -1) {
        throw new Error(`Le compte "${username}" est introuvable dans le coffre-fort.`);
      }
      vault.accounts[idx].passwordHash = await SecurityService.hashPassword(cleanPass);
      await vaultService.encryptVault(vault, masterPin);
      setAccounts(vault.accounts.map(({ passwordHash: _passwordHash, ...rest }) => rest));
      return vault.accounts[idx];
    }

    // Fallback
    return authService?.updateUserPassword(username, cleanPass);
  }, [authService]);

  // Basculement de session 2FA
  const switchSessionToUser = useCallback(async (username, masterPin) => {
    if (vaultService.isVaultExists()) {
      if (!masterPin) {
        throw new Error('Veuillez saisir le Master PIN pour confirmer le basculement de session (2FA).');
      }
      const vault = await vaultService.decryptVault(masterPin);
      const acc = vault.accounts.find(
        (a) => (a.code && a.code.toLowerCase() === username.toLowerCase()) ||
               (a.username && a.username.toLowerCase() === username.toLowerCase()) ||
               a.id === username
      );
      if (!acc) throw new Error(`Le compte "${username}" est introuvable.`);

      const session = {
        id: acc.id,
        code: acc.code || acc.username,
        username: acc.username || acc.code,
        name: acc.name || acc.libelle,
        role: acc.role,
        titleFr: acc.titleFr || acc.role,
        avatar: acc.avatar || (acc.code || 'US').substring(0, 2).toUpperCase(),
        badgeColor: acc.badgeColor || 'slate',
        authMethod: 'VAULT_SWITCH_2FA',
        loginTime: Date.now(),
      };
      setUser(session);
      if (authService?.saveSignedSession) {
        authService.saveSignedSession(session);
      } else {
        sessionStorage.setItem('gmao_session_v2', JSON.stringify(session));
      }
      return session;
    }

    const newSession = authService?.switchSessionToUser(username);
    setUser(newSession);
    return newSession;
  }, [authService]);

  // Réinitialisation du coffre-fort et des comptes
  const resetAllAccountsToDefaults = useCallback(async (masterPin) => {
    if (vaultService.isVaultExists()) {
      if (!masterPin) {
        throw new Error('Veuillez saisir le Master PIN pour autoriser la réinitialisation.');
      }
      await vaultService.decryptVault(masterPin);
    }
    // Re-setup master pin or reset vault
    vaultService.clearMasterPin?.();
    localStorage.removeItem('gmao_vault_cipher_v2');
    localStorage.removeItem('gmao_vault_iv_v2');
    localStorage.removeItem('gmao_vault_pin_hash_v2');
    setIsVaultExists(false);
    setIsVaultUnlocked(false);
    setAccounts([]);
    if (authService?.resetAllAccountsToDefaults) {
      authService.resetAllAccountsToDefaults();
    }
    return true;
  }, [authService]);

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
        isPinConfigured: () => vaultService.isVaultExists() || authService?.isPinConfigured(),
        getCurrentSessionUser: () => user || authService?.getCurrentUser(),
        updateUserPassword,
        updateUserProfile: (username, updates) => authService?.updateUserProfile(username, updates),
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
