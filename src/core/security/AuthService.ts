import { SecurityService } from './SecurityService';
import { clearClientServerSessionToken } from './serverSession';
import { Logger } from '../logger/LoggerService';
import { indexedDBService } from '../../infrastructure/database/IndexedDBService';
import { vaultService } from '../../utils/vaultService';
import { STORAGE_KEYS } from '../../infrastructure/persistence/storageKeys';
import { getSafeLocalStorage, getSafeSessionStorage } from '../../infrastructure/persistence/safeStorage';
import { storageService } from '../../utils/storageService';
import {
  LicenseGateService,
  validateLicenseKeyPolicy,
  looksLikeStoredVerifierOrHash,
  type ILicenseRecord,
} from './LicenseGateService';

const USERS_KEY = 'gmao_auth_accounts_v2';
const SESSION_KEY = 'gmao_session_v2';

export const PROHIBITED_BOOTSTRAP_PASSWORDS = new Set([
  'admin',
  'magasinier',
  'viewer',
  'tech',
  '1234',
]);

/**
 * SEC-HARDENING-P1 (Batch A) + LOGIN-LICENSE-P0: Unified password strength policy
 * - Rejects prohibited bootstrap passwords first
 * - Rejects pasted cryptographic hashes/verifiers (pbkdf2:v1:..., AG1:...)
 * - Minimum 8 characters
 * - Must contain at least one letter ([a-zA-Z]) and one digit ([0-9])
 */
export function validatePasswordPolicy(rawPassword: string): string {
  const cleanPass = String(rawPassword || '').trim();
  if (!cleanPass) {
    throw new Error('Veuillez saisir un mot de passe.');
  }
  if (looksLikeStoredVerifierOrHash(cleanPass)) {
    throw new Error(
      'Format de mot de passe invalide : les empreintes cryptographiques stockées ne peuvent pas être utilisées comme mot de passe.'
    );
  }
  if (PROHIBITED_BOOTSTRAP_PASSWORDS.has(cleanPass.toLowerCase())) {
    throw new Error(
      'Ce mot de passe fait partie des mots de passe par défaut interdits. Veuillez choisir un mot de passe sécurisé et robuste.'
    );
  }
  if (cleanPass.length < 8) {
    throw new Error(
      'Le nouveau mot de passe doit comporter au moins 8 caractères (avec au moins une lettre et un chiffre).'
    );
  }
  if (!/[a-zA-Z]/.test(cleanPass) || !/[0-9]/.test(cleanPass)) {
    throw new Error('Le mot de passe doit contenir au moins une lettre et un chiffre.');
  }
  return cleanPass;
}

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
  static _warnedDevBootstrap = false;
  static _volatileSessionStr: string | null = null;

  /**
   * Determine if running in a production environment
   */
  static isProductionMode(): boolean {
    return Boolean(
      import.meta.env.PROD ||
      (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production')
    );
  }

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
    } catch {
      users = null;
    }

    if (!users || !Array.isArray(users) || users.length === 0) {
      return this.getDefaultUsersList();
    }
    return users.map((u) => {
      if (!u || typeof u !== 'object') return u;
      const copy = { ...u };
      delete copy.defaultPass;
      return copy;
    });
  }

  /**
   * Persist the canonical accounts list to SecurityService and IndexedDB.
   */
  saveStoredUsersList(users, emitEvent = true) {
    const rawUsers = Array.isArray(users) ? users : this.getDefaultUsersList();
    const safeUsers = rawUsers.map((u) => {
      if (!u || typeof u !== 'object') return u;
      const copy = { ...u };
      delete copy.defaultPass;
      return copy;
    });
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

    // 1. Store actively in sessionStorage for the current tab / window session (with volatile fallback if blocked)
    AuthService._volatileSessionStr = envelopeStr;
    try {
      const ss = getSafeSessionStorage();
      if (ss) {
        ss.setItem(SESSION_KEY, envelopeStr);
      }
    } catch {
      // keep volatile session in memory when Web Storage is blocked
    }

    // 2. Persist securely in IndexedDB app_data store
    indexedDBService.setItem(SESSION_KEY, sessionEnvelope).catch(() => {});

    // 3. Remove any legacy unencrypted/vulnerable session from localStorage
    try {
      const ls = getSafeLocalStorage();
      if (ls) {
        ls.removeItem(SESSION_KEY);
      }
    } catch {
      // ignore storage errors
    }

    return payload;
  }

  getDefaultUsersList() {
    return [
      {
        id: 'admin',
        code: 'admin',
        username: 'admin',
        passwordHash: null,
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
        passwordHash: null,
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
        passwordHash: null,
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
  buildTechnicianAccount(
    tech: any,
    existingAccount: any = null,
    options: { isActive?: boolean; activateByDefault?: boolean } = {}
  ) {
    const techId = String(tech?.id_technician || tech?.id || '').trim();
    const nom = String(tech?.nom || techId).trim();
    const zone = String(tech?.id_zone || '').trim() || null;
    const specialite = String(tech?.specialite || 'Maintenance Industrielle').trim();
    const defaultUsername = techId.toLowerCase();

    return {
      id: existingAccount?.id || `acct-${techId}`,
      code: techId,
      username: existingAccount?.username || defaultUsername,
      passwordHash:
        existingAccount?.passwordHash && !String(existingAccount.passwordHash).includes('_init_seed')
          ? existingAccount.passwordHash
          : null,
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

  /**
   * Build an AuthAccount object from an operations/supervisor reference record (e.g. RESP-01, RESP-02).
   */
  buildOperationAccount(
    op: any,
    existingAccount: any = null,
    options: { isActive?: boolean; activateByDefault?: boolean } = {}
  ) {
    const opId = String(op?.id_operation || op?.id || '').trim();
    const nom = String(op?.nom || opId).trim();
    const zone = String(op?.id_zone || 'ALL').trim() || 'ALL';
    const templateIds: string[] = Array.isArray(op?.template_ids)
      ? op.template_ids.map((v: any) => String(v).trim().toUpperCase())
      : Array.isArray(op?.templates)
      ? op.templates.map((v: any) => String(v).trim().toUpperCase())
      : [];
    const inferredRole =
      existingAccount?.role ||
      (templateIds.includes('RMG') && !templateIds.includes('RMT')
        ? 'RESPONSABLE_MAGASIN'
        : 'RESPONSABLE_MAINTENANCE');
    const specialite = String(
      op?.template_label || op?.specialite || (inferredRole === 'RESPONSABLE_MAGASIN' ? 'Gestion Magasin' : 'Responsable Maintenance')
    ).trim();

    return {
      id: existingAccount?.id || `acct-${opId}`,
      code: opId,
      username: existingAccount?.username || opId.toLowerCase(),
      passwordHash:
        existingAccount?.passwordHash && !String(existingAccount.passwordHash).includes('_init_seed')
          ? existingAccount.passwordHash
          : null,
      role: inferredRole,
      name: nom,
      titleFr: specialite,
      avatar: buildAvatar(nom),
      badgeColor: inferredRole === 'RESPONSABLE_MAGASIN' ? 'amber' : 'indigo',
      description: zone && zone !== 'ALL' ? `${specialite} • Zone ${zone}` : specialite,
      personnelId: opId,
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

    // If not in empty factory start mode and stored technicians/operations exist in localStorage, ensure their accounts are synced
    try {
      const ls = getSafeLocalStorage();
      if (ls) {
        const startModeRaw = ls.getItem(STORAGE_KEYS.START_MODE);
        const startMode = startModeRaw ? startModeRaw.replace(/^"|"$/g, '') : '';
        if (startMode !== 'empty') {
          const rawTechs = ls.getItem(STORAGE_KEYS.TECHNICIANS);
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
          const rawOps = ls.getItem(STORAGE_KEYS.OPERATIONS);
          if (rawOps) {
            const parsedOps = JSON.parse(rawOps);
            if (Array.isArray(parsedOps) && parsedOps.length > 0) {
              parsedOps.forEach((op) => {
                const opId = String(op?.id_operation || op?.id || '').trim();
                if (!opId) return;
                const existingIdx = users.findIndex(
                  (u) => u.personnelId === opId || u.code === opId || u.id === `acct-${opId}`
                );
                if (existingIdx === -1) {
                  users.push(this.buildOperationAccount(op, null, { activateByDefault: true }));
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
  syncTechnicianAccountsFromPersonnel(
    technicians: any[] = [],
    options: { activateByDefault?: boolean; emitEvent?: boolean } = {}
  ) {
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
   * Synchronize operation/supervisor login accounts (e.g. RESP-01, RESP-02) from personnel records.
   */
  syncOperationAccountsFromPersonnel(
    operations: any[] = [],
    options: { activateByDefault?: boolean; emitEvent?: boolean } = {}
  ) {
    const { activateByDefault = true, emitEvent = true } = options;
    const users = this.getStoredUsersList().filter(
      (u) => !(u.id === 'tech' && u.username === 'tech' && !u.personnelId)
    );

    if (Array.isArray(operations)) {
      operations.forEach((op) => {
        const opId = String(op?.id_operation || op?.id || '').trim();
        if (!opId) return;
        const idx = users.findIndex(
          (u) => u.personnelId === opId || u.code === opId || u.id === `acct-${opId}`
        );
        if (idx === -1) {
          users.push(this.buildOperationAccount(op, null, { activateByDefault }));
        } else {
          users[idx] = this.buildOperationAccount(op, users[idx], {
            isActive: users[idx].isActive !== undefined ? users[idx].isActive : activateByDefault,
          });
        }
      });
    }

    return this.saveStoredUsersList(users, emitEvent);
  }

  /**
   * Returns auth accounts formatted for synchronization with server `dbState.authAccounts`.
   */
  getServerSyncAuthAccounts() {
    return this.getStoredUsersList()
      .filter((u) => !(u.id === 'tech' && u.username === 'tech' && !u.personnelId))
      .map((u) => ({
        id: u.id,
        code: u.code || u.personnelId || u.username,
        username: u.username,
        passwordHash: u.passwordHash,
        role: u.role,
        name: u.name,
        personnelId: u.personnelId || null,
        personnelName: u.personnelName || u.name || null,
        id_zone: u.id_zone || null,
        specialite: u.specialite || null,
        isActive: u.isActive !== false,
      }));
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

    let passwordHash =
      existing?.passwordHash && !String(existing.passwordHash).includes('_init_seed')
        ? existing.passwordHash
        : null;

    const cleanPass = String(plainPassword || '').trim();
    if (cleanPass) {
      validatePasswordPolicy(cleanPass);
      passwordHash = await SecurityService.hashPassword(cleanPass);
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

    delete accountObj.defaultPass;

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
    const cleanPass = validatePasswordPolicy(newPlainPassword);

    if (LicenseGateService.isLicenseActive()) {
      const matchesLicense = await LicenseGateService.verifyLicenseKey(cleanPass, {
        touchLastAuth: false,
      });
      if (matchesLicense) {
        throw new Error(
          "Séparation des secrets obligatoire : le mot de passe d'un compte ne peut pas être identique à la clé de licence commerciale."
        );
      }
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
      this.saveSignedSession({
        ...currentSession,
        mustChangePassword: false,
      });
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
    LicenseGateService.clearLicenseRecord();
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

  getLicenseRecord(): ILicenseRecord | null {
    return LicenseGateService.getLicenseRecord();
  }

  /**
   * Returns true if and only if BOTH:
   * 1. An ACTIVE commercial license record (`ILicenseRecord`) exists, AND
   * 2. The primary `admin` account has a real initialized passwordHash (not `_init_seed`).
   */
  isLicenseActivated(): boolean {
    if (!LicenseGateService.isLicenseActive()) return false;
    const users = this.getStoredUsersList();
    const adminAcc = users.find(
      (u) =>
        String(u.username || '').toLowerCase() === 'admin' ||
        String(u.id || '').toLowerCase() === 'admin'
    );
    const storedHash = String(adminAcc?.passwordHash || '').trim();
    return Boolean(storedHash) && !storedHash.includes('_init_seed');
  }

  isPinConfigured() {
    return this.isLicenseActivated();
  }

  /**
   * LOGIN-LICENSE-P0: First-run activation of Commercial License Key + Independent Admin Password.
   * Strictly enforces `licenseKey !== adminPassword` and never copies the license key into `admin.passwordHash`.
   */
  async activateLicenseAndAdmin(params: {
    licenseKey: string;
    adminPassword: string;
    organizationLabel?: string;
    seatsHint?: string;
    rememberLicenseOnDevice?: boolean;
  }): Promise<{ licenseRecord: ILicenseRecord; adminAccount: any }> {
    const cleanLicenseKey = validateLicenseKeyPolicy(params.licenseKey);
    const cleanAdminPass = validatePasswordPolicy(params.adminPassword);

    if (cleanLicenseKey.toLowerCase() === cleanAdminPass.toLowerCase()) {
      throw new Error(
        'Séparation des secrets obligatoire : la clé de licence commerciale et le mot de passe Administrateur doivent être strictement différents.'
      );
    }

    const licenseRecord = await LicenseGateService.activateLicense({
      licenseKey: cleanLicenseKey,
      organizationLabel: params.organizationLabel,
      seatsHint: params.seatsHint,
    });

    const adminHash = await SecurityService.hashPassword(cleanAdminPass);
    const storedUsers = [...this.getStoredUsersList()];
    let adminAccount = null;

    const updatedUsers = storedUsers.map((u) => {
      if (
        String(u.username || '').toLowerCase() === 'admin' ||
        String(u.id || '').toLowerCase() === 'admin'
      ) {
        const nextAdmin = {
          ...u,
          passwordHash: adminHash,
          isActive: true,
        };
        delete nextAdmin.defaultPass;
        adminAccount = nextAdmin;
        return nextAdmin;
      }
      return u;
    });

    this.saveStoredUsersList(updatedUsers, true);

    const newVault = {
      version: 2,
      createdAt: new Date().toISOString(),
      licenseKeyId: licenseRecord.licenseKeyId,
      accounts: updatedUsers,
    };

    await vaultService.encryptVault(newVault, cleanLicenseKey);
    await vaultService.setPinHash(cleanLicenseKey);
    SecurityService.removeSecure('gmao_admin_pin');

    LicenseGateService.setRememberedLicenseKey(
      cleanLicenseKey,
      Boolean(params.rememberLicenseOnDevice)
    );

    return { licenseRecord, adminAccount };
  }

  /**
   * LOGIN-LICENSE-P0: Rotate the commercial license key after verifying both
   * the current license key AND the current Admin account password.
   * Account passwords remain untouched.
   */
  async rotateLicenseKeyWithAdminAuth(params: {
    currentLicenseKey: string;
    adminPassword: string;
    newLicenseKey: string;
    organizationLabel?: string;
    seatsHint?: string;
  }): Promise<ILicenseRecord> {
    const cleanCurrentKey = String(params.currentLicenseKey || '').trim();
    const cleanAdminPass = String(params.adminPassword || '').trim();
    const cleanNewKey = validateLicenseKeyPolicy(params.newLicenseKey);

    if (!cleanCurrentKey || !cleanAdminPass) {
      throw new Error(
        'Veuillez saisir la clé de licence actuelle ainsi que le mot de passe Administrateur pour autoriser la rotation.'
      );
    }

    if (cleanNewKey.toLowerCase() === cleanAdminPass.toLowerCase()) {
      throw new Error(
        'Séparation des secrets obligatoire : la nouvelle clé de licence ne peut pas être identique au mot de passe Administrateur.'
      );
    }

    const users = this.getStoredUsersList();
    const adminAcc = users.find(
      (u) =>
        String(u.username || '').toLowerCase() === 'admin' ||
        String(u.id || '').toLowerCase() === 'admin'
    );
    const adminHash = String(adminAcc?.passwordHash || '').trim();
    if (!adminHash || adminHash.includes('_init_seed')) {
      throw new Error("Le compte Administrateur n'est pas initialisé.");
    }

    const isAdminPassValid = await SecurityService.comparePassword(cleanAdminPass, adminHash);
    if (!isAdminPassValid) {
      throw new Error('Mot de passe Administrateur incorrect.');
    }

    // Also ensure the new license key does not match any other active user's password
    for (const u of users) {
      const h = String(u.passwordHash || '').trim();
      if (h && !h.includes('_init_seed')) {
        const collides = await SecurityService.comparePassword(cleanNewKey, h);
        if (collides) {
          throw new Error(
            `Séparation des secrets obligatoire : la nouvelle clé de licence ne peut pas être identique au mot de passe du compte "${u.username}".`
          );
        }
      }
    }

    const rotatedRecord = await LicenseGateService.rotateLicenseKey({
      currentLicenseKey: cleanCurrentKey,
      newLicenseKey: cleanNewKey,
      organizationLabel: params.organizationLabel,
      seatsHint: params.seatsHint,
    });

    const newVault = {
      version: 2,
      createdAt: new Date().toISOString(),
      licenseKeyId: rotatedRecord.licenseKeyId,
      accounts: users,
    };
    await vaultService.encryptVault(newVault, cleanNewKey);
    await vaultService.setPinHash(cleanNewKey);

    return rotatedRecord;
  }

  createAdminSession(role = 'ADMIN', authMethod = 'DUAL_KEY_AND') {
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

  /**
   * LOGIN-LICENSE-P0: PIN-only login is strictly prohibited.
   * Authentication requires `[Clé de licence] AND [Mot de passe du compte]`.
   */
  async loginWithPin(_pin?: string): Promise<never> {
    throw new Error(
      "Authentification à clé unique désactivée (LOGIN-LICENSE-P0) : la connexion nécessite obligatoirement la clé de licence commerciale ET le mot de passe du compte (logique AND)."
    );
  }

  /**
   * LOGIN-LICENSE-P0: Strict Dual-Key `AND` Authentication Gate.
   * Requires:
   * 1. Active `ILicenseRecord` on the installation
   * 2. Valid `licenseKey` matching `ILicenseRecord.licenseVerifier` (PBKDF2-SHA256)
   * 3. Valid `username` + `password` matching the active account's `passwordHash` (PBKDF2-SHA256)
   */
  async login(username: string, password: string, licenseKey?: string) {
    const cleanUsername = String(username || '').trim().toLowerCase();
    const cleanPassword = String(password || '').trim();
    const cleanLicenseKey = String(licenseKey || '').trim();

    if (!cleanUsername) {
      throw new Error('Veuillez sélectionner un compte actif avant de vous connecter.');
    }

    if (!cleanPassword) {
      throw new Error('Veuillez saisir le mot de passe du compte.');
    }

    // 1. Always reject prohibited bootstrap passwords immediately in all environments
    if (PROHIBITED_BOOTSTRAP_PASSWORDS.has(cleanPassword.toLowerCase())) {
      throw new Error(
        'Les mots de passe par défaut interdits (admin, magasinier, viewer, tech, 1234) sont désactivés dans tous les environnements. Veuillez utiliser un mot de passe personnel sécurisé.'
      );
    }

    // 2. Reject pass-the-hash / pasted cryptographic verifier or hash strings
    if (
      looksLikeStoredVerifierOrHash(cleanPassword) ||
      looksLikeStoredVerifierOrHash(cleanLicenseKey)
    ) {
      throw new Error(
        "Format d'authentification invalide : les empreintes cryptographiques stockées (hash/verifier) ne peuvent pas être utilisées pour ouvrir une session."
      );
    }

    // 3. Require an ACTIVE commercial license on this installation
    if (!LicenseGateService.isLicenseActive()) {
      throw new Error(
        "Licence système non activée. Veuillez compléter l'activation initiale (Clé de licence commerciale + Mot de passe Administrateur)."
      );
    }

    // 4. Require the second key (Clé de licence commerciale) — zero password-only or PIN-only path
    if (!cleanLicenseKey) {
      throw new Error(
        'Authentification à double clé requise (AND) : la clé de licence commerciale ET le mot de passe du compte sont obligatoires.'
      );
    }

    // 5. Lookup target account by username, code, personnelId, or alias
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

    if (!user) {
      throw new Error(
        "Échec d'authentification : clé de licence, identifiant ou mot de passe incorrect."
      );
    }

    if (user.isActive === false) {
      throw new Error("Ce compte d'accès est désactivé par l'administrateur.");
    }

    const storedHash = String(user.passwordHash || '').trim();
    const hasValidRealHash = Boolean(storedHash) && !storedHash.includes('_init_seed');

    if (!hasValidRealHash) {
      throw new Error(
        "Ce compte n'est pas encore initialisé. Veuillez définir un mot de passe sécurisé pour ce compte."
      );
    }

    // 6. Evaluate BOTH secrets independently (Strict AND: License Key AND Account Password)
    const [isLicenseValid, isPasswordHashMatch] = await Promise.all([
      LicenseGateService.verifyLicenseKey(cleanLicenseKey),
      SecurityService.comparePassword(cleanPassword, storedHash),
    ]);

    if (!isLicenseValid || !isPasswordHashMatch) {
      throw new Error(
        "Échec d'authentification : clé de licence, identifiant ou mot de passe incorrect."
      );
    }

    // Upgrade legacy SHA-256 hash to full PBKDF2-SHA256 (600,000 iterations) if needed
    if (SecurityService.isLegacyHash(storedHash) || user.defaultPass) {
      const modernHash = await SecurityService.hashPassword(cleanPassword);
      user.passwordHash = modernHash;
      delete user.defaultPass;
      this.saveStoredUsersList(users, false);
    }

    const activeLicense = LicenseGateService.getLicenseRecord();
    const sessionPayload = {
      ...user,
      personnelId: user.personnelId || null,
      personnelName: user.personnelName || user.name || null,
      id_zone: user.id_zone || null,
      specialite: user.specialite || null,
      authMethod: 'DUAL_KEY_AND',
      licenseKeyId: activeLicense?.licenseKeyId || null,
      mustChangePassword: false,
    };
    return this.saveSignedSession(sessionPayload);
  }

  logout() {
    AuthService._volatileSessionStr = null;
    clearClientServerSessionToken();
    SecurityService.removeSecure(SESSION_KEY);
    indexedDBService.removeItem(SESSION_KEY).catch(() => {});
  }

  getCurrentUser() {
    try {
      // 1. Read active signed session from sessionStorage first (or volatile fallback if blocked)
      const ss = getSafeSessionStorage();
      let sessionStr: string | null = null;
      if (ss) {
        try {
          sessionStr = ss.getItem(SESSION_KEY);
        } catch {
          sessionStr = null;
        }
      }
      if (!sessionStr && !ss) {
        sessionStr = AuthService._volatileSessionStr;
      }

      // 2. Migration fallback: Check if old localStorage session exists, migrate it, then remove from localStorage
      if (!sessionStr) {
        const ls = getSafeLocalStorage();
        if (ls) {
          try {
            const legacyLocalStr = ls.getItem(SESSION_KEY);
            if (legacyLocalStr) {
              sessionStr = legacyLocalStr;
              AuthService._volatileSessionStr = legacyLocalStr;
              ls.removeItem(SESSION_KEY);
              if (ss) {
                ss.setItem(SESSION_KEY, sessionStr);
              }
            }
          } catch {
            // ignore storage errors
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

