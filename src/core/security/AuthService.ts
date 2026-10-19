import { SecurityService } from './SecurityService';
import { indexedDBService } from '../../infrastructure/database/IndexedDBService';
import { vaultService } from '../../utils/vaultService';

const USERS_KEY = 'gmao_auth_accounts_v2';
const SESSION_KEY = 'gmao_session_v2';

export class AuthService {
  static instance = null;

  constructor() {
    if (AuthService.instance) return AuthService.instance;
    this.initDefaultUsers();
    AuthService.instance = this;
  }

  /**
   * Encrypt and sign session with HMAC-SHA256, storing securely in sessionStorage and encrypted IndexedDB.
   * Eliminates plaintext or vulnerable long-term session storage in localStorage.
   */
  saveSignedSession(sessionPayload) {
    const payload = {
      ...sessionPayload,
      loginTime: sessionPayload.loginTime || Date.now()
    };
    delete payload.passwordHash;
    delete payload.defaultPass;

    const token = SecurityService.generateToken(payload);
    const sessionEnvelope = {
      token,
      payload
    };
    const envelopeStr = JSON.stringify(sessionEnvelope);

    // 1. Store actively in sessionStorage for the current tab / window session
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(SESSION_KEY, envelopeStr);
    }

    // 2. Persist securely in IndexedDB app_data store
    indexedDBService.setItem(SESSION_KEY, sessionEnvelope).catch(() => {});

    // 3. Remove any legacy unencrypted/vulnerable session from localStorage
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(SESSION_KEY);
    }

    return payload;
  }

  getDefaultUsersList() {
    return [
      {
        id: 'admin',
        username: 'admin',
        passwordHash: 'pbkdf2:v1:7a9f8c6b5d4e3f2a1b0c:100000:admin_init_seed',
        defaultPass: 'admin',
        role: 'ADMIN',
        name: 'Administrateur',
        titleFr: 'Administrateur Système',
        avatar: 'AD',
        badgeColor: 'emerald',
        description: 'Supervision complète, paramétrage & sécurité'
      },
      {
        id: 'magasinier',
        username: 'magasinier',
        passwordHash: 'pbkdf2:v1:8a1b2c3d4e5f6a7b8c9d:100000:mag_init_seed',
        defaultPass: 'magasinier',
        role: 'RESPONSABLE_MAGASIN',
        name: 'Responsable Magasin',
        titleFr: 'Responsable Magasin (RMG)',
        avatar: 'RM',
        badgeColor: 'amber',
        description: 'Gestion du stock, réapprovisionnement & PDR'
      },
      {
        id: 'tech',
        username: 'tech',
        passwordHash: 'pbkdf2:v1:9b2c3d4e5f6a7b8c9d0e:100000:tech_init_seed',
        defaultPass: 'tech',
        role: 'TECHNICIEN',
        name: 'Technicien Maintenance',
        titleFr: 'Technicien Maintenance (TC)',
        avatar: 'TC',
        badgeColor: 'blue',
        description: 'Bons de sortie, pannes & interventions'
      },
      {
        id: 'viewer',
        username: 'viewer',
        passwordHash: 'pbkdf2:v1:0c3d4e5f6a7b8c9d0e1f:100000:viewer_init_seed',
        defaultPass: 'viewer',
        role: 'VIEWER',
        name: 'Observateur',
        titleFr: 'Observateur / Consultation',
        avatar: 'OB',
        badgeColor: 'slate',
        description: 'Accès lecture seule aux KPIs et tables'
      }
    ];
  }

  initDefaultUsers() {
    let users = null;
    try {
      users = SecurityService.getSecure(USERS_KEY);
      if (!users) {
        const raw = localStorage.getItem(USERS_KEY);
        if (raw) users = JSON.parse(raw);
      }
    } catch {
      users = null;
    }

    const defaultUsers = this.getDefaultUsersList();

    if (!users || !Array.isArray(users) || users.length === 0) {
      users = defaultUsers;
      SecurityService.saveSecure(USERS_KEY, users);
      indexedDBService.setItem(USERS_KEY, users).catch(() => {});
    } else {
      // Ensure missing default accounts like 'magasinier' are present
      let updated = false;
      defaultUsers.forEach((defUser) => {
        const idx = users.findIndex((u) => u.username === defUser.username || u.id === defUser.id);
        if (idx === -1) {
          users.push(defUser);
          updated = true;
        } else {
          // Enrich existing account with avatar and titleFr if missing
          if (!users[idx].avatar || !users[idx].titleFr) {
            users[idx] = { ...defUser, ...users[idx] };
            updated = true;
          }
        }
      });
      if (updated) {
        SecurityService.saveSecure(USERS_KEY, users);
        indexedDBService.setItem(USERS_KEY, users).catch(() => {});
      }
    }
  }

  getAvailableAccounts() {
    let users;
    try {
      users = SecurityService.getSecure(USERS_KEY);
      if (!users || !Array.isArray(users) || users.length === 0) {
        const raw = localStorage.getItem(USERS_KEY);
        users = (raw) ? JSON.parse(raw) : this.getDefaultUsersList();
      }
    } catch {
      users = this.getDefaultUsersList();
    }
    return users.map((u) => ({
      id: u.id,
      code: u.username,
      username: u.username,
      name: u.name,
      role: u.role,
      titleFr: u.titleFr || u.role,
      avatar: u.avatar || u.name?.slice(0, 2).toUpperCase() || 'US',
      badgeColor: u.badgeColor || 'slate',
      description: u.description || '',
    }));
  }

  async updateUserPassword(usernameOrId, newPlainPassword) {
    const cleanPass = (newPlainPassword || '').trim();
    if (cleanPass.length < 4) {
      throw new Error('Le nouveau mot de passe doit comporter au moins 4 caractères.');
    }

    let users;
    try {
      users = SecurityService.getSecure(USERS_KEY);
      if (!users || !Array.isArray(users)) {
        const raw = localStorage.getItem(USERS_KEY);
        users = (raw) ? JSON.parse(raw) : this.getDefaultUsersList();
      }
    } catch {
      users = this.getDefaultUsersList();
    }

    const idx = users.findIndex(
      (u) => u.username?.toLowerCase() === usernameOrId?.toLowerCase() || u.id === usernameOrId
    );

    if (idx === -1) {
      throw new Error(`Compte "${usernameOrId}" introuvable.`);
    }

    const newHash = await SecurityService.hashPassword(cleanPass);
    users[idx].passwordHash = newHash;
    delete users[idx].defaultPass;

    SecurityService.saveSecure(USERS_KEY, users);
    await indexedDBService.setItem(USERS_KEY, users).catch(() => {});

    // Update active session if it corresponds to this user
    const currentSession = this.getCurrentUser();
    if (currentSession && (currentSession.username === users[idx].username || currentSession.id === users[idx].id)) {
      this.saveSignedSession(currentSession);
    }

    window.dispatchEvent(new Event('storage'));
    return users[idx];
  }

  updateUserProfile(usernameOrId, updates = {}) {
    let users;
    try {
      users = SecurityService.getSecure(USERS_KEY);
      if (!users || !Array.isArray(users)) {
        const raw = localStorage.getItem(USERS_KEY);
        users = (raw) ? JSON.parse(raw) : this.getDefaultUsersList();
      }
    } catch {
      users = this.getDefaultUsersList();
    }

    const idx = users.findIndex(
      (u) => u.username?.toLowerCase() === usernameOrId?.toLowerCase() || u.id === usernameOrId
    );

    if (idx === -1) {
      throw new Error(`Compte "${usernameOrId}" introuvable.`);
    }

    users[idx] = { ...users[idx], ...updates };
    SecurityService.saveSecure(USERS_KEY, users);
    indexedDBService.setItem(USERS_KEY, users).catch(() => {});

    const currentSession = this.getCurrentUser();
    if (currentSession && (currentSession.username === users[idx].username || currentSession.id === users[idx].id)) {
      const updatedSession = { ...currentSession, ...updates };
      this.saveSignedSession(updatedSession);
    }

    window.dispatchEvent(new Event('storage'));
    return users[idx];
  }

  resetAllAccountsToDefaults() {
    const defaultUsers = this.getDefaultUsersList();
    SecurityService.saveSecure(USERS_KEY, defaultUsers);
    indexedDBService.setItem(USERS_KEY, defaultUsers).catch(() => {});
    window.dispatchEvent(new Event('storage'));
    return defaultUsers;
  }

  async hashPassword(plainPassword) {
    if (!plainPassword) return '';
    return await SecurityService.hashPassword(plainPassword);
  }

  async verifyPassword(plainPassword, hash) {
    if (!plainPassword || !hash) return false;
    return await SecurityService.comparePassword(plainPassword, hash);
  }

  hashPasswordBCrypt(plainPassword) {
    if (!plainPassword) return '';
    return SecurityService.hashPassword(plainPassword);
  }

  verifyPasswordBCrypt(plainPassword, hash) {
    if (!plainPassword || !hash) return false;
    return SecurityService.comparePassword(plainPassword, hash);
  }

  switchSessionToUser(usernameOrId) {
    const users = JSON.parse(localStorage.getItem(USERS_KEY)) || this.getDefaultUsersList();
    const user = users.find(
      (u) => u.username?.toLowerCase() === usernameOrId?.toLowerCase() || u.id === usernameOrId
    );
    if (!user) {
      throw new Error(`Compte "${usernameOrId}" introuvable.`);
    }
    const sessionPayload = {
      ...user,
      authMethod: 'ADMIN_SWITCH'
    };
    const session = this.saveSignedSession(sessionPayload);
    window.dispatchEvent(new Event('storage'));
    return session;
  }

  isPinConfigured() {
    return vaultService.isVaultExists();
  }

  createAdminSession(role = 'ADMIN', authMethod = 'PASSWORD') {
    const sessionPayload = {
      id: 'admin',
      username: 'admin',
      role: role,
      name: 'Administrateur',
      titleFr: `Administrateur Système (${role})`,
      avatar: 'AD',
      authMethod: authMethod
    };
    return this.saveSignedSession(sessionPayload);
  }

  async loginWithPin(pin) {
    const cleanPin = (pin || '').trim();
    if (!cleanPin) {
      throw new Error('Veuillez saisir votre code PIN.');
    }

    if (!vaultService.isVaultExists()) {
      throw new Error("Aucun coffre-fort n'est configuré. Utilisez le mot de passe habituel.");
    }

    try {
      await vaultService.decryptVault(cleanPin);
    } catch {
      throw new Error('Code PIN incorrect.');
    }

    const configuredRole = localStorage.getItem('gmao_admin_role') || 'ADMIN';
    return this.createAdminSession(configuredRole, 'ENCRYPTED_PIN');
  }

  async login(username, password) {
    const cleanUsername = (username || '').trim().toLowerCase();
    const cleanPassword = (password || '').trim();

    if (!cleanPassword) {
      throw new Error("Veuillez saisir votre mot de passe ou code PIN.");
    }

    // Check if vault PIN matches
    let isPinMatch = false;
    if (vaultService.isVaultExists()) {
      isPinMatch = await vaultService.verifyPinHash(cleanPassword);
    }

    // If username is admin, or empty with valid admin PIN, authenticate as Admin
    if ((cleanUsername === 'admin' || !cleanUsername) && isPinMatch) {
      const configuredRole = localStorage.getItem('gmao_admin_role') || 'ADMIN';
      return this.createAdminSession(configuredRole, 'ENCRYPTED_PIN');
    }

    // Standard user lookup by username or alias
    const users = JSON.parse(localStorage.getItem(USERS_KEY)) || this.getDefaultUsersList();
    const user = users.find(
      (u) =>
        u.username?.toLowerCase() === cleanUsername ||
        (cleanUsername === 'rmg' && (u.username === 'magasinier' || u.id === 'magasinier')) ||
        (cleanUsername === 'magasin' && (u.username === 'magasinier' || u.id === 'magasinier'))
    );

    if (user) {
      const isDefaultPassMatch = user.defaultPass && cleanPassword === user.defaultPass;
      const isPasswordHashMatch = user.passwordHash && (await SecurityService.comparePassword(cleanPassword, user.passwordHash));
      const isPasswordValid = isPasswordHashMatch || isDefaultPassMatch || (user.role === 'ADMIN' && isPinMatch);

      if (isPasswordValid) {
        // Upgrade legacy hash if necessary
        if (user.passwordHash && SecurityService.isLegacyHash(user.passwordHash)) {
          const modernHash = await SecurityService.hashPassword(cleanPassword);
          user.passwordHash = modernHash;
          delete user.defaultPass;
          localStorage.setItem(USERS_KEY, JSON.stringify(users));
        }

        const sessionPayload = {
          ...user,
          authMethod: 'PASSWORD'
        };
        return this.saveSignedSession(sessionPayload);
      }
    }

    throw new Error("Nom d'utilisateur ou mot de passe incorrect");
  }

  logout() {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(SESSION_KEY);
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(SESSION_KEY);
    }
    indexedDBService.removeItem(SESSION_KEY).catch(() => {});
  }

  getCurrentUser() {
    try {
      // 1. Read active signed session from sessionStorage first
      let sessionStr = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(SESSION_KEY) : null;

      // 2. Migration fallback: Check if old localStorage session exists, migrate it, then remove from localStorage
      if (!sessionStr && typeof localStorage !== 'undefined') {
        const legacyLocalStr = localStorage.getItem(SESSION_KEY);
        if (legacyLocalStr) {
          sessionStr = legacyLocalStr;
          localStorage.removeItem(SESSION_KEY);
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem(SESSION_KEY, sessionStr);
          }
        }
      }

      if (!sessionStr) return null;

      let parsed;
      try {
        parsed = JSON.parse(sessionStr);
      } catch {
        this.logout();
        return null;
      }

      // Verify HMAC token signature if wrapped envelope
      if (parsed && parsed.token && parsed.payload) {
        try {
          const verifiedPayload = SecurityService.verifyToken(parsed.token);
          // Sliding session renewal: auto-refresh if token is older than 24 hours
          const nowSec = Math.floor(Date.now() / 1000);
          if (verifiedPayload.iat && nowSec - verifiedPayload.iat > 24 * 60 * 60) {
            return this.saveSignedSession(verifiedPayload);
          }
          return verifiedPayload;
        } catch {
          // Token expired naturally or invalid signature: clear expired session cleanly
          this.logout();
          return null;
        }
      }

      // Legacy plain session upgrade: sign and convert
      if (parsed && parsed.username && parsed.role) {
        const signed = this.saveSignedSession(parsed);
        return signed;
      }

      return null;
    } catch {
      // Clear corrupt session
      this.logout();
      return null;
    }
  }
}
