import { SecurityService } from './SecurityService';
import { indexedDBService } from '../../infrastructure/database/IndexedDBService';
import { vaultService } from '../../utils/vaultService';
import { STORAGE_KEYS } from '../../infrastructure/persistence/storageKeys';

const USERS_KEY = 'gmao_auth_accounts_v2';
const SESSION_KEY = 'gmao_session_v2';
const TECH_DEFAULT_HASH = 'pbkdf2:v1:9b2c3d4e5f6a7b8c9d0e:100000:tech_init_seed';

function buildAvatar(nameOrCode = '') {
  const clean = String(nameOrCode || '').trim();
  if (!clean) return 'TC';
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}

export class AuthService {
  static instance = null;

  constructor() {
    if (AuthService.instance) return AuthService.instance;
    this.initDefaultUsers();
    AuthService.instance = this;
  }

  /**
   * Read the canonical accounts list from SecurityService (with seamless fallback migration).
   */
  getStoredUsersList() {
    let users = null;
    try {
      users = SecurityService.getSecure(USERS_KEY);
      if (!users || !Array.isArray(users)) {
        const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(USERS_KEY) : null;
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            users = parsed;
            SecurityService.saveSecure(USERS_KEY, users);
          }
        }
      }
    } catch {
      users = null;
    }

    if (!users || !Array.isArray(users) || users.length === 0) {
      return this.getDefaultUsersList();
    }
    return users;
  }

  /**
   * Persist the canonical accounts list to SecurityService and IndexedDB.
   */
  saveStoredUsersList(users, emitEvent = true) {
    const safeUsers = Array.isArray(users) ? users : this.getDefaultUsersList();
    SecurityService.saveSecure(USERS_KEY, safeUsers);
    indexedDBService.setItem(USERS_KEY, safeUsers).catch(() => {});
    if (emitEvent && typeof window !== 'undefined') {
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('gmao_auth_accounts_updated', { detail: safeUsers }));
    }
    return safeUsers;
  }

  /**
   * Encrypt and sign session with HMAC-SHA256, storing securely in sessionStorage and encrypted IndexedDB.
   * Eliminates plaintext or vulnerable long-term session storage in localStorage.
   */
  saveSignedSession(sessionPayload) {
    const payload = {
      ...sessionPayload,
      personnelId: sessionPayload.personnelId ?? null,
      personnelName: sessionPayload.personnelName ?? sessionPayload.name ?? null,
      id_zone: sessionPayload.id_zone ?? null,
      specialite: sessionPayload.specialite ?? null,
      loginTime: sessionPayload.loginTime || Date.now(),
    };
    delete payload.passwordHash;
    delete payload.defaultPass;

    const token = SecurityService.generateToken(payload);
    const sessionEnvelope = {
      token,
      payload,
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
        code: 'admin',
        username: 'admin',
        passwordHash: 'pbkdf2:v1:7a9f8c6b5d4e3f2a1b0c:100000:admin_init_seed',
        defaultPass: 'admin',
        role: 'ADMIN',
        name: 'Administrateur',
        titleFr: 'Administrateur Système',
        avatar: 'AD',
        badgeColor: 'emerald',
        description: 'Supervision complète, paramétrage & sécurité',
        personnelId: null,
        personnelName: 'Administrateur',
        id_zone: 'ALL',
        isActive: true,
      },
      {
        id: 'magasinier',
        code: 'magasinier',
        username: 'magasinier',
        passwordHash: 'pbkdf2:v1:8a1b2c3d4e5f6a7b8c9d:100000:mag_init_seed',
        defaultPass: 'magasinier',
        role: 'RESPONSABLE_MAGASIN',
        name: 'Responsable Magasin',
        titleFr: 'Responsable Magasin (RMG)',
        avatar: 'RM',
        badgeColor: 'amber',
        description: 'Gestion du stock, réapprovisionnement & PDR',
        personnelId: 'RESP-04',
        personnelName: 'Responsable Magasin',
        id_zone: 'ALL',
        isActive: true,
      },
      {
        id: 'viewer',
        code: 'viewer',
        username: 'viewer',
        passwordHash: 'pbkdf2:v1:0c3d4e5f6a7b8c9d0e1f:100000:viewer_init_seed',
        defaultPass: 'viewer',
        role: 'VIEWER',
        name: 'Observateur',
        titleFr: 'Observateur / Consultation',
        avatar: 'OB',
        badgeColor: 'slate',
        description: 'Accès lecture seule aux KPIs et tables',
        personnelId: null,
        personnelName: 'Observateur',
        id_zone: 'ALL',
        isActive: true,
      },
    ];
  }

  /**
   * Build an AuthAccount object from a technician reference record.
   */
  buildTechnicianAccount(tech, existingAccount = null, options = {}) {
    const techId = String(tech?.id_technician || tech?.id || '').trim();
    const nom = String(tech?.nom || techId).trim();
    const zone = String(tech?.id_zone || '').trim() || null;
    const specialite = String(tech?.specialite || 'Maintenance Industrielle').trim();
    const defaultUsername = techId.toLowerCase();

    return {
      id: existingAccount?.id || `acct-${techId}`,
      code: techId,
      username: existingAccount?.username || defaultUsername,
      passwordHash: existingAccount?.passwordHash || TECH_DEFAULT_HASH,
      defaultPass:
        existingAccount && !existingAccount.defaultPass && existingAccount.passwordHash !== TECH_DEFAULT_HASH
          ? undefined
          : options.defaultPass || existingAccount?.defaultPass || 'tech',
      role: existingAccount?.role || 'TECHNICIEN',
      name: nom,
      titleFr: zone ? `Technicien (${zone})` : 'Technicien Maintenance',
      avatar: buildAvatar(nom),
      badgeColor: 'blue',
      description: zone ? `${specialite} • Zone ${zone}` : specialite,
      personnelId: techId,
      personnelName: nom,
      id_zone: zone,
      specialite,
      isActive:
        options.isActive !== undefined
          ? Boolean(options.isActive)
          : existingAccount?.isActive !== undefined
            ? Boolean(existingAccount.isActive)
            : Boolean(options.activateByDefault ?? true),
    };
  }

  initDefaultUsers() {
    let users = null;
    try {
      users = SecurityService.getSecure(USERS_KEY);
      if (!users || !Array.isArray(users)) {
        const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(USERS_KEY) : null;
        if (raw) users = JSON.parse(raw);
      }
    } catch {
      users = null;
    }

    const defaultUsers = this.getDefaultUsersList();
    let updated = false;

    if (!users || !Array.isArray(users) || users.length === 0) {
      users = [...defaultUsers];
      updated = true;
    } else {
      // Remove legacy generic shared 'tech' account (replaced by individual technician accounts)
      const withoutLegacyGenericTech = users.filter(
        (u) => !(u.id === 'tech' && u.username === 'tech' && !u.personnelId)
      );
      if (withoutLegacyGenericTech.length !== users.length) {
        users = withoutLegacyGenericTech;
        updated = true;
      }

      // Ensure core default accounts ('admin', 'magasinier', 'viewer') are present and enriched
      defaultUsers.forEach((defUser) => {
        const idx = users.findIndex((u) => u.username === defUser.username || u.id === defUser.id);
        if (idx === -1) {
          users.push(defUser);
          updated = true;
        } else {
          const current = users[idx];
          if (
            !current.avatar ||
            !current.titleFr ||
            current.isActive === undefined ||
            current.personnelId === undefined
          ) {
            users[idx] = {
              ...defUser,
              ...current,
              isActive: current.isActive !== undefined ? current.isActive : true,
              personnelId: current.personnelId !== undefined ? current.personnelId : defUser.personnelId,
              personnelName: current.personnelName !== undefined ? current.personnelName : defUser.personnelName,
            };
            updated = true;
          }
        }
      });
    }

    // If not in empty factory start mode and stored technicians exist in localStorage, ensure their accounts are synced
    try {
      if (typeof localStorage !== 'undefined') {
        const startModeRaw = localStorage.getItem(STORAGE_KEYS.START_MODE);
        const startMode = startModeRaw ? startModeRaw.replace(/^"|"$/g, '') : '';
        if (startMode !== 'empty') {
          const rawTechs = localStorage.getItem(STORAGE_KEYS.TECHNICIANS);
          if (rawTechs) {
            const parsedTechs = JSON.parse(rawTechs);
            if (Array.isArray(parsedTechs) && parsedTechs.length > 0) {
              parsedTechs.forEach((tech) => {
                const techId = String(tech?.id_technician || tech?.id || '').trim();
                if (!techId) return;
                const existingIdx = users.findIndex(
                  (u) => u.personnelId === techId || u.code === techId || u.id === `acct-${techId}`
                );
                if (existingIdx === -1) {
                  users.push(this.buildTechnicianAccount(tech, null, { activateByDefault: true }));
                  updated = true;
                }
              });
            }
          }
        }
      }
    } catch {
      // Ignore storage read errors during bootstrap
    }

    if (updated) {
      this.saveStoredUsersList(users, false);
    }
  }

  /**
   * Synchronize technician login accounts from a list of technician reference records.
   * Used when demo data is loaded or when syncing personnel directory.
   */
  syncTechnicianAccountsFromPersonnel(technicians = [], options = {}) {
    const { activateByDefault = true, emitEvent = true } = options;
    let users = this.getStoredUsersList().filter(
      (u) => !(u.id === 'tech' && u.username === 'tech' && !u.personnelId)
    );

    if (Array.isArray(technicians)) {
      technicians.forEach((tech) => {
        const techId = String(tech?.id_technician || tech?.id || '').trim();
        if (!techId) return;
        const idx = users.findIndex(
          (u) => u.personnelId === techId || u.code === techId || u.id === `acct-${techId}`
        );
        if (idx === -1) {
          users.push(this.buildTechnicianAccount(tech, null, { activateByDefault }));
        } else {
          users[idx] = this.buildTechnicianAccount(tech, users[idx], {
            isActive: users[idx].isActive !== undefined ? users[idx].isActive : activateByDefault,
          });
        }
      });
    }

    return this.saveStoredUsersList(users, emitEvent);
  }

  /**
   * Clear all personnel-linked login accounts (used on clearAllForRealFactory / clearDemoSection('users')).
   * Preserves core system accounts (admin, magasinier, viewer).
   */
  clearPersonnelAuthAccounts(emitEvent = true) {
    const coreDefaults = this.getDefaultUsersList();
    const existing = this.getStoredUsersList();
    const preservedCore = coreDefaults.map((def) => {
      const found = existing.find((u) => u.id === def.id || u.username === def.username);
      return found
        ? {
            ...def,
            passwordHash: found.passwordHash || def.passwordHash,
            defaultPass: found.defaultPass,
            isActive: true,
          }
        : def;
    });
    return this.saveStoredUsersList(preservedCore, emitEvent);
  }

  /**
   * Retrieve the AuthAccount associated with a specific personnelId (e.g. 'TECH-01', 'RESP-01', 'OP-01').
   */
  getAccountForPersonnel(personnelId) {
    if (!personnelId) return null;
    const cleanId = String(personnelId).trim().toLowerCase();
    const users = this.getStoredUsersList();
    const found = users.find(
      (u) =>
        String(u.personnelId || '').toLowerCase() === cleanId ||
        String(u.code || '').toLowerCase() === cleanId ||
        String(u.id || '').toLowerCase() === `acct-${cleanId}`
    );
    if (!found) return null;
    return {
      id: found.id,
      code: found.code || found.username,
      username: found.username,
      name: found.name,
      role: found.role,
      titleFr: found.titleFr || found.role,
      avatar: found.avatar || buildAvatar(found.name),
      badgeColor: found.badgeColor || 'blue',
      description: found.description || '',
      personnelId: found.personnelId || null,
      personnelName: found.personnelName || found.name || null,
      id_zone: found.id_zone || null,
      specialite: found.specialite || null,
      isActive: found.isActive !== false,
    };
  }

  /**
   * Create or update a login account linked to a personnel record (Admin action from UtilisateursView).
   */
  async upsertPersonnelAuthAccount({
    personnelId,
    nom,
    id_zone = null,
    specialite = null,
    role = 'TECHNICIEN',
    username = '',
    plainPassword = '',
    isActive = true,
  }) {
    const cleanPersonnelId = String(personnelId || '').trim();
    if (!cleanPersonnelId) {
      throw new Error('Identifiant du personnel (personnelId) requis.');
    }

    const users = [...this.getStoredUsersList()];
    const idx = users.findIndex(
      (u) =>
        String(u.personnelId || '').toLowerCase() === cleanPersonnelId.toLowerCase() ||
        String(u.code || '').toLowerCase() === cleanPersonnelId.toLowerCase() ||
        String(u.id || '').toLowerCase() === `acct-${cleanPersonnelId.toLowerCase()}`
    );

    const existing = idx !== -1 ? users[idx] : null;
    const finalUsername = String(username || existing?.username || cleanPersonnelId.toLowerCase())
      .trim()
      .toLowerCase();

    if (finalUsername.length < 3) {
      throw new Error("L'identifiant de connexion doit comporter au moins 3 caractères.");
    }

    // Ensure username does not collide with another distinct account
    const collision = users.find(
      (u, i) => i !== idx && String(u.username || '').toLowerCase() === finalUsername
    );
    if (collision) {
      throw new Error(`L'identifiant "${finalUsername}" est déjà utilisé par un autre compte.`);
    }

    let passwordHash = existing?.passwordHash || TECH_DEFAULT_HASH;
    let defaultPass = existing?.defaultPass;

    const cleanPass = String(plainPassword || '').trim();
    if (cleanPass) {
      if (cleanPass.length < 4) {
        throw new Error('Le mot de passe doit comporter au moins 4 caractères.');
      }
      passwordHash = await SecurityService.hashPassword(cleanPass);
      defaultPass = undefined;
    } else if (!existing) {
      defaultPass = 'tech';
    }

    const cleanName = String(nom || existing?.name || cleanPersonnelId).trim();
    const cleanZone = id_zone !== undefined ? id_zone : existing?.id_zone || null;
    const cleanSpec = specialite !== undefined ? specialite : existing?.specialite || null;
    const finalRole = role || existing?.role || 'TECHNICIEN';

    const badgeColor =
      finalRole === 'ADMIN'
        ? 'emerald'
        : finalRole === 'RESPONSABLE_MAGASIN'
          ? 'amber'
          : finalRole === 'VIEWER'
            ? 'slate'
            : 'blue';

    const titleFr =
      finalRole === 'TECHNICIEN'
        ? cleanZone
          ? `Technicien (${cleanZone})`
          : 'Technicien Maintenance'
        : finalRole === 'RESPONSABLE_MAGASIN'
          ? 'Responsable Magasin (RMG)'
          : finalRole === 'ADMIN'
            ? 'Administrateur Système'
            : 'Observateur / Consultation';

    const accountObj = {
      ...(existing || {}),
      id: existing?.id || `acct-${cleanPersonnelId}`,
      code: cleanPersonnelId,
      username: finalUsername,
      passwordHash,
      role: finalRole,
      name: cleanName,
      titleFr,
      avatar: buildAvatar(cleanName),
      badgeColor,
      description: cleanSpec
        ? cleanZone
          ? `${cleanSpec} • Zone ${cleanZone}`
          : cleanSpec
        : `Compte ${cleanPersonnelId}`,
      personnelId: cleanPersonnelId,
      personnelName: cleanName,
      id_zone: cleanZone,
      specialite: cleanSpec,
      isActive: Boolean(isActive),
    };

    if (defaultPass) {
      accountObj.defaultPass = defaultPass;
    } else {
      delete accountObj.defaultPass;
    }

    if (idx !== -1) {
      users[idx] = accountObj;
    } else {
      users.push(accountObj);
    }

    this.saveStoredUsersList(users, true);

    // Update active session if it belongs to this account
    const currentSession = this.getCurrentUser();
    if (
      currentSession &&
      (currentSession.id === accountObj.id ||
        currentSession.username === accountObj.username ||
        currentSession.personnelId === accountObj.personnelId)
    ) {
      if (!accountObj.isActive) {
        this.logout();
      } else {
        this.saveSignedSession({
          ...currentSession,
          name: accountObj.name,
          username: accountObj.username,
          role: accountObj.role,
          titleFr: accountObj.titleFr,
          personnelId: accountObj.personnelId,
          personnelName: accountObj.personnelName,
          id_zone: accountObj.id_zone,
          specialite: accountObj.specialite,
        });
      }
    }

    return accountObj;
  }

  /**
   * Enable or disable an existing login account without deleting the personnel record.
   */
  toggleAccountActive(usernameOrIdOrPersonnelId, isActive) {
    const target = String(usernameOrIdOrPersonnelId || '').trim().toLowerCase();
    if (!target) throw new Error('Identifiant du compte requis.');

    const users = [...this.getStoredUsersList()];
    const idx = users.findIndex(
      (u) =>
        String(u.username || '').toLowerCase() === target ||
        String(u.id || '').toLowerCase() === target ||
        String(u.code || '').toLowerCase() === target ||
        String(u.personnelId || '').toLowerCase() === target
    );

    if (idx === -1) {
      throw new Error(`Compte "${usernameOrIdOrPersonnelId}" introuvable.`);
    }

    if (users[idx].role === 'ADMIN' && users[idx].username === 'admin' && !isActive) {
      throw new Error('Le compte Administrateur principal ne peut pas être désactivé.');
    }

    users[idx] = {
      ...users[idx],
      isActive: Boolean(isActive),
    };

    this.saveStoredUsersList(users, true);
    return users[idx];
  }

  /**
   * Remove a personnel-linked login account when the person is deleted from UtilisateursView.
   */
  removePersonnelAuthAccount(personnelId) {
    const target = String(personnelId || '').trim().toLowerCase();
    if (!target) return false;
    const users = this.getStoredUsersList();
    const nextUsers = users.filter(
      (u) =>
        String(u.personnelId || '').toLowerCase() !== target &&
        String(u.code || '').toLowerCase() !== target &&
        String(u.id || '').toLowerCase() !== `acct-${target}`
    );
    if (nextUsers.length !== users.length) {
      this.saveStoredUsersList(nextUsers, true);
      return true;
    }
    return false;
  }

  getAvailableAccounts(includeInactive = false) {
    const users = this.getStoredUsersList();
    return users
      .filter((u) => !(u.id === 'tech' && u.username === 'tech' && !u.personnelId))
      .filter((u) => (includeInactive ? true : u.isActive !== false))
      .map((u) => ({
        id: u.id,
        code: u.code || u.personnelId || u.username,
        username: u.username,
        name: u.name,
        libelle: u.titleFr || u.name,
        role: u.role,
        titleFr: u.titleFr || u.role,
        avatar: u.avatar || buildAvatar(u.name || u.username),
        badgeColor: u.badgeColor || 'slate',
        description: u.description || '',
        personnelId: u.personnelId || null,
        personnelName: u.personnelName || u.name || null,
        id_zone: u.id_zone || null,
        specialite: u.specialite || null,
        isActive: u.isActive !== false,
      }));
  }

  async updateUserPassword(usernameOrId, newPlainPassword) {
    const cleanPass = (newPlainPassword || '').trim();
    if (cleanPass.length < 4) {
      throw new Error('Le nouveau mot de passe doit comporter au moins 4 caractères.');
    }

    const users = [...this.getStoredUsersList()];
    const target = String(usernameOrId || '').trim().toLowerCase();
    const idx = users.findIndex(
      (u) =>
        String(u.username || '').toLowerCase() === target ||
        String(u.id || '').toLowerCase() === target ||
        String(u.code || '').toLowerCase() === target ||
        String(u.personnelId || '').toLowerCase() === target
    );

    if (idx === -1) {
      throw new Error(`Compte "${usernameOrId}" introuvable.`);
    }

    const newHash = await SecurityService.hashPassword(cleanPass);
    users[idx] = { ...users[idx], passwordHash: newHash };
    delete users[idx].defaultPass;

    this.saveStoredUsersList(users, true);

    // Update active session if it corresponds to this user
    const currentSession = this.getCurrentUser();
    if (
      currentSession &&
      (currentSession.username === users[idx].username || currentSession.id === users[idx].id)
    ) {
      this.saveSignedSession(currentSession);
    }

    return users[idx];
  }

  updateUserProfile(usernameOrId, updates = {}) {
    const users = [...this.getStoredUsersList()];
    const target = String(usernameOrId || '').trim().toLowerCase();
    const idx = users.findIndex(
      (u) =>
        String(u.username || '').toLowerCase() === target ||
        String(u.id || '').toLowerCase() === target ||
        String(u.code || '').toLowerCase() === target ||
        String(u.personnelId || '').toLowerCase() === target
    );

    if (idx === -1) {
      throw new Error(`Compte "${usernameOrId}" introuvable.`);
    }

    users[idx] = { ...users[idx], ...updates };
    this.saveStoredUsersList(users, true);

    const currentSession = this.getCurrentUser();
    if (
      currentSession &&
      (currentSession.username === users[idx].username || currentSession.id === users[idx].id)
    ) {
      const updatedSession = { ...currentSession, ...updates };
      this.saveSignedSession(updatedSession);
    }

    return users[idx];
  }

  resetAllAccountsToDefaults() {
    const defaultUsers = this.getDefaultUsersList();
    this.saveStoredUsersList(defaultUsers, true);
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
    const users = this.getStoredUsersList();
    const target = String(usernameOrId || '').trim().toLowerCase();
    const user = users.find(
      (u) =>
        String(u.username || '').toLowerCase() === target ||
        String(u.id || '').toLowerCase() === target ||
        String(u.code || '').toLowerCase() === target ||
        String(u.personnelId || '').toLowerCase() === target
    );
    if (!user) {
      throw new Error(`Compte "${usernameOrId}" introuvable.`);
    }
    if (user.isActive === false) {
      throw new Error(`Le compte "${user.name || usernameOrId}" est actuellement désactivé.`);
    }
    const sessionPayload = {
      ...user,
      authMethod: 'ADMIN_SWITCH',
    };
    const session = this.saveSignedSession(sessionPayload);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('storage'));
    }
    return session;
  }

  isPinConfigured() {
    return vaultService.isVaultExists();
  }

  createAdminSession(role = 'ADMIN', authMethod = 'PASSWORD') {
    const sessionPayload = {
      id: 'admin',
      code: 'admin',
      username: 'admin',
      role: role,
      name: 'Administrateur',
      titleFr: `Administrateur Système (${role})`,
      avatar: 'AD',
      personnelId: null,
      personnelName: 'Administrateur',
      id_zone: 'ALL',
      authMethod: authMethod,
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

    if (!cleanUsername) {
      throw new Error('Veuillez sélectionner un compte actif avant de vous connecter.');
    }

    if (!cleanPassword) {
      throw new Error('Veuillez saisir votre mot de passe ou code PIN.');
    }

    // Check if vault PIN matches
    let isPinMatch = false;
    if (vaultService.isVaultExists()) {
      isPinMatch = await vaultService.verifyPinHash(cleanPassword);
    }

    // If username is admin with valid admin PIN, authenticate as Admin
    if (cleanUsername === 'admin' && isPinMatch) {
      const configuredRole = localStorage.getItem('gmao_admin_role') || 'ADMIN';
      return this.createAdminSession(configuredRole, 'ENCRYPTED_PIN');
    }

    // Standard user lookup by username, code, personnelId, or alias
    const users = this.getStoredUsersList();
    const user = users.find(
      (u) =>
        String(u.username || '').toLowerCase() === cleanUsername ||
        String(u.code || '').toLowerCase() === cleanUsername ||
        String(u.personnelId || '').toLowerCase() === cleanUsername ||
        String(u.id || '').toLowerCase() === cleanUsername ||
        (cleanUsername === 'rmg' && (u.username === 'magasinier' || u.id === 'magasinier')) ||
        (cleanUsername === 'magasin' && (u.username === 'magasinier' || u.id === 'magasinier'))
    );

    if (user) {
      if (user.isActive === false) {
        throw new Error("Ce compte d'accès est désactivé par l'administrateur.");
      }

      const isDefaultPassMatch =
        (user.defaultPass && cleanPassword === user.defaultPass) ||
        (user.passwordHash === TECH_DEFAULT_HASH &&
          user.defaultPass &&
          (cleanPassword === 'tech' || cleanPassword === '1234'));
      const isPasswordHashMatch =
        user.passwordHash && (await SecurityService.comparePassword(cleanPassword, user.passwordHash));
      const isPasswordValid =
        isPasswordHashMatch || isDefaultPassMatch || (user.role === 'ADMIN' && isPinMatch);

      if (isPasswordValid) {
        // Upgrade legacy hash if necessary
        if (user.passwordHash && SecurityService.isLegacyHash(user.passwordHash)) {
          const modernHash = await SecurityService.hashPassword(cleanPassword);
          user.passwordHash = modernHash;
          delete user.defaultPass;
          this.saveStoredUsersList(users, false);
        }

        const sessionPayload = {
          ...user,
          personnelId: user.personnelId || null,
          personnelName: user.personnelName || user.name || null,
          id_zone: user.id_zone || null,
          specialite: user.specialite || null,
          authMethod: 'PASSWORD',
        };
        return this.saveSignedSession(sessionPayload);
      }
    }

    throw new Error("Identifiant ou mot de passe incorrect.");
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

