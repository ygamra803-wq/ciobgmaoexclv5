import { STORAGE_KEYS } from '../infrastructure/persistence/storageKeys';
import { storageService } from '../utils/storageService';
import { DataGateway } from '../application/DataGateway';
import { useGmaoStore } from '../store/useGmaoStore';
import { networkConfigService } from './networkConfigService';
import { SecurityService } from '../core/security/SecurityService';
import { AuthService } from '../core/security/AuthService';
import {
  getClientServerSessionToken,
  setClientServerSessionToken,
  clearClientServerSessionToken,
} from '../core/security/serverSession';
import {
  authenticateServerSession as clientAuthenticateServerSession,
  refreshServerSession as clientRefreshServerSession,
  ensureFreshServerSession as clientEnsureFreshServerSession,
  revokeServerSession as clientRevokeServerSession,
} from '../core/security/serverSessionClient';

export interface ServerStateSummary {
  version?: number;
  updatedAt: string | null;
  machinesCount: number;
  stockCount: number;
  preventiveCount: number;
  correctiveCount: number;
  movementsCount: number;
  zonesCount: number;
  totalItems: number;
}

export interface ServerAuditEntry {
  id: string;
  timestamp: string;
  version: number;
  actor: string;
  action: string;
  entity: string;
  summary: string;
}

export interface ConflictDetectionResult {
  hasConflict: boolean;
  reason?: 'SERVER_NEWER' | 'DATA_DIVERGENCE';
  localSummary: ServerStateSummary;
  serverSummary: ServerStateSummary;
  serverState: Record<string, any>;
}

export interface OperationalSyncStatusSnapshot {
  lastSyncAt: string | null;
  lastServerVersion: number | null;
  localModifiedAt: string | null;
  lastSyncStatus: 'IDLE' | 'SUCCESS' | 'ERROR' | 'CONFLICT';
  lastSyncError: string | null;
  lastSyncAttemptAt: string | null;
  hasUnresolvedConflict: boolean;
  unresolvedConflict: ConflictDetectionResult | null;
}

const LAST_SYNC_AT_KEY = 'gmao_last_server_sync_at';
const LAST_SERVER_VERSION_KEY = 'gmao_last_server_version';
const LOCAL_MODIFIED_AT_KEY = 'gmao_local_modified_at';
export const PENDING_DELETED_IDS_KEY = 'gmao_pending_deleted_ids_v1';

let autoPushTimer: ReturnType<typeof setTimeout> | null = null;
let autoPushInFlight = false;

let lastSyncStatusState: 'IDLE' | 'SUCCESS' | 'ERROR' | 'CONFLICT' = 'IDLE';
let lastSyncErrorState: string | null = null;
let lastSyncAttemptAtState: string | null = null;
let lastUnresolvedConflictState: ConflictDetectionResult | null = null;

const resolveSessionUser = (): Record<string, any> | null => {
  try {
    const parsed = SecurityService.getSessionSecure('gmao_session_v2');
    if (parsed && typeof parsed === 'object') {
      if (parsed.payload && typeof parsed.payload === 'object') {
        return parsed.payload;
      }
      return parsed;
    }
    const activeUser = storageService.getItem('gmao_active_user');
    if (activeUser && typeof activeUser === 'object') {
      return activeUser;
    }
  } catch {
    // ignore
  }
  return null;
};

export const getActiveActorId = (): string => {
  const user = resolveSessionUser();
  if (!user) return '';
  return String(user.personnelId || user.code || user.id || user.username || '').trim();
};

export const getActiveActorName = (): string => {
  const user = resolveSessionUser();
  if (user) {
    return user.nom || user.name || user.username || user.role || 'operator';
  }
  return '';
};

export const getActiveActorRole = (): string => {
  const user = resolveSessionUser();
  if (user && typeof user.role === 'string' && user.role.trim()) {
    return user.role.trim().toUpperCase();
  }
  return 'VIEWER';
};


const buildClientAuthHeaders = (
  extra: Record<string, string> = {},
  roleOverride?: string
): Record<string, string> => {
  const actorId = getActiveActorId();
  const actorName = getActiveActorName();
  const actorRole = roleOverride || getActiveActorRole();
  const serverToken = getClientServerSessionToken();
  return {
    'x-gmao-client-origin': 'gmao-web-client',
    ...(actorId ? { 'x-gmao-actor-id': actorId } : {}),
    ...(actorName ? { 'x-gmao-actor': actorName } : {}),
    ...(actorRole ? { 'x-gmao-role': actorRole } : {}),
    ...(serverToken
      ? {
          Authorization: `Bearer ${serverToken}`,
          'X-GMAO-SESSION': serverToken,
        }
      : {}),
    ...extra,
  };
};

export const serverSyncService = {
  getServerSessionToken(): string {
    return getClientServerSessionToken();
  },

  setServerSessionToken(token: string): void {
    setClientServerSessionToken(token);
  },

  clearServerSessionToken(): void {
    clearClientServerSessionToken();
  },

  /**
   * Authenticates against POST /api/gmao/auth/login to obtain a server-signed HMAC session token.
   * Never falls back to header-only ADMIN privileges if the server returns 401/403.
   */
  authenticateServerSession(identifier: string, password: string) {
    return clientAuthenticateServerSession(identifier, password);
  },

  /**
   * Rotates and refreshes the active server session token before expiry via /api/gmao/auth/refresh.
   */
  refreshServerSession() {
    return clientRefreshServerSession();
  },

  /**
   * Silently refreshes the session token if within `marginSeconds` of `exp`.
   */
  ensureFreshServerSession(marginSeconds?: number) {
    return clientEnsureFreshServerSession(marginSeconds);
  },

  /**
   * Revokes the active server session token on logout and clears local token storage.
   */
  revokeServerSession(): Promise<void> {
    return clientRevokeServerSession();
  },
  getLastSyncAt(): string | null {
    return storageService.getItem(LAST_SYNC_AT_KEY) || null;
  },

  setLastSyncAt(isoTimestamp: string): void {
    storageService.setItem(LAST_SYNC_AT_KEY, isoTimestamp);
  },

  getLastServerVersion(): number | null {
    const raw = storageService.getItem(LAST_SERVER_VERSION_KEY);
    const num = Number(raw);
    return Number.isFinite(num) && num > 0 ? num : null;
  },

  setLastServerVersion(version: number | undefined): void {
    if (typeof version === 'number' && Number.isFinite(version) && version > 0) {
      storageService.setItem(LAST_SERVER_VERSION_KEY, version);
    }
  },

  getLocalModifiedAt(): string | null {
    return storageService.getItem(LOCAL_MODIFIED_AT_KEY) || null;
  },

  markLocalModified(): string {
    const now = new Date().toISOString();
    storageService.setItem(LOCAL_MODIFIED_AT_KEY, now);
    return now;
  },

  getPendingDeletedIdsByEntity(): Record<string, string[]> {
    const raw = storageService.getItem(PENDING_DELETED_IDS_KEY);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return {};
    }
    const clean: Record<string, string[]> = {};
    for (const [entity, ids] of Object.entries(raw)) {
      if (Array.isArray(ids) && ids.length > 0) {
        const filtered = Array.from(
          new Set(ids.map((id) => String(id ?? '').trim()).filter(Boolean))
        );
        if (filtered.length > 0) {
          clean[entity] = filtered;
        }
      }
    }
    return clean;
  },

  recordDeletedEntityIds(entity: string, ids: Array<string | number>): void {
    const cleanEntity = String(entity || '').trim();
    if (!cleanEntity || !Array.isArray(ids) || ids.length === 0) return;
    const incoming = ids.map((id) => String(id ?? '').trim()).filter(Boolean);
    if (incoming.length === 0) return;
    const current = this.getPendingDeletedIdsByEntity();
    const existing = Array.isArray(current[cleanEntity]) ? current[cleanEntity] : [];
    current[cleanEntity] = Array.from(new Set([...existing, ...incoming]));
    storageService.setItem(PENDING_DELETED_IDS_KEY, current);
  },

  recordDeletedEntityId(entity: string, id: string | number): void {
    this.recordDeletedEntityIds(entity, [id]);
  },

  clearPendingDeletedIds(): void {
    storageService.removeItem(PENDING_DELETED_IDS_KEY);
  },

  recordSyncSuccess(isoTimestamp: string, version?: number): void {
    lastSyncStatusState = 'SUCCESS';
    lastSyncErrorState = null;
    lastSyncAttemptAtState = isoTimestamp;
    lastUnresolvedConflictState = null;
    this.setLastSyncAt(isoTimestamp);
    if (version !== undefined) {
      this.setLastServerVersion(version);
    }
  },

  recordSyncError(errorMessage: string): void {
    const now = new Date().toISOString();
    lastSyncStatusState = 'ERROR';
    lastSyncErrorState = errorMessage;
    lastSyncAttemptAtState = now;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('gmao:server_sync_error', {
          detail: { error: errorMessage, timestamp: now },
        })
      );
    }
  },

  recordSyncConflict(conflict: ConflictDetectionResult): void {
    lastSyncStatusState = 'CONFLICT';
    lastSyncAttemptAtState = new Date().toISOString();
    lastUnresolvedConflictState = conflict;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('gmao:server_conflict', { detail: conflict })
      );
    }
  },

  clearUnresolvedConflict(): void {
    lastUnresolvedConflictState = null;
    if (lastSyncStatusState === 'CONFLICT') {
      lastSyncStatusState = this.getLastSyncAt() ? 'SUCCESS' : 'IDLE';
    }
  },

  getOperationalSyncStatus(): OperationalSyncStatusSnapshot {
    const lastSyncAt = this.getLastSyncAt();
    return {
      lastSyncAt,
      lastServerVersion: this.getLastServerVersion(),
      localModifiedAt: this.getLocalModifiedAt(),
      lastSyncStatus:
        lastSyncStatusState === 'IDLE' && lastSyncAt ? 'SUCCESS' : lastSyncStatusState,
      lastSyncError: lastSyncErrorState,
      lastSyncAttemptAt: lastSyncAttemptAtState || lastSyncAt,
      hasUnresolvedConflict: Boolean(lastUnresolvedConflictState?.hasConflict),
      unresolvedConflict: lastUnresolvedConflictState,
    };
  },

  /**
   * Builds a clean canonical state snapshot from Zustand store or localStorage.
   */
  buildLocalPayload(customState?: Record<string, any>): Record<string, any> {
    const store = customState || useGmaoStore.getState();
    const rawStock = Array.isArray(store.rawStock)
      ? store.rawStock
      : storageService.getItem(STORAGE_KEYS.RAW_STOCK) || [];
    const types = Array.isArray(store.types)
      ? store.types
      : storageService.getItem(STORAGE_KEYS.STOCK_TYPES) || [];
    const designations = Array.isArray(store.designations)
      ? store.designations
      : storageService.getItem(STORAGE_KEYS.DESIGNATIONS) || [];
    const machines = Array.isArray(store.machines)
      ? store.machines
      : storageService.getItem(STORAGE_KEYS.MACHINES) || [];
    const families = Array.isArray(store.families)
      ? store.families
      : storageService.getItem(STORAGE_KEYS.FAMILIES) || [];
    const templates = Array.isArray(store.templates)
      ? store.templates
      : storageService.getItem(STORAGE_KEYS.TEMPLATES) || [];
    const blueprints = Array.isArray(store.blueprints)
      ? store.blueprints
      : storageService.getItem(STORAGE_KEYS.BLUEPRINTS) || [];
    const zones = Array.isArray(store.zones)
      ? store.zones
      : storageService.getItem(STORAGE_KEYS.ZONES) || [];
    const machineElementsLedger = Array.isArray(store.machineElementsLedger)
      ? store.machineElementsLedger
      : storageService.getItem(STORAGE_KEYS.MACHINE_BOM) || [];
    const mouvements = Array.isArray(store.mouvements)
      ? store.mouvements
      : storageService.getItem(STORAGE_KEYS.MOUVEMENTS) || [];
    const preventiveTasks = Array.isArray(store.preventiveTasks)
      ? store.preventiveTasks
      : storageService.getItem(STORAGE_KEYS.PREVENTIVE_TASKS) || [];
    const preventiveActions = Array.isArray(store.preventiveActions)
      ? store.preventiveActions
      : storageService.getItem(STORAGE_KEYS.PREVENTIVE_ACTIONS) || [];
    const preventiveGuides = Array.isArray(store.preventiveGuides)
      ? store.preventiveGuides
      : storageService.getItem(STORAGE_KEYS.PREVENTIVE_GUIDES) || [];
    const preventivePlans = Array.isArray(store.preventivePlans)
      ? store.preventivePlans
      : storageService.getItem(STORAGE_KEYS.PREVENTIVE_PLANS) || [];
    const preventiveExecutions = Array.isArray(store.preventiveExecutions)
      ? store.preventiveExecutions
      : storageService.getItem(STORAGE_KEYS.PREVENTIVE_EXECUTIONS) || [];
    const correctiveInterventions = Array.isArray(store.correctiveInterventions)
      ? store.correctiveInterventions
      : storageService.getItem(STORAGE_KEYS.CORRECTIVE_INTERVENTIONS) || [];
    const correctiveActionsByPanne =
      store.correctiveActionsByPanne ||
      store.actionsByPanne ||
      storageService.getItem(STORAGE_KEYS.CORRECTIVE_ACTIONS_BY_PANNE) ||
      {};
    const correctivePanneCategories =
      store.correctivePanneCategories ||
      store.panneCategories ||
      storageService.getItem(STORAGE_KEYS.CORRECTIVE_PANNE_CATEGORIES) ||
      {};
    const correctiveTravauxAFaire = Array.isArray(store.correctiveTravauxAFaire)
      ? store.correctiveTravauxAFaire
      : Array.isArray(store.travauxAFaire)
      ? store.travauxAFaire
      : storageService.getItem(STORAGE_KEYS.CORRECTIVE_TRAVAUX) || [];
    const correctiveIntervenants = Array.isArray(store.correctiveIntervenants)
      ? store.correctiveIntervenants
      : Array.isArray(store.intervenants)
      ? store.intervenants
      : storageService.getItem(STORAGE_KEYS.CORRECTIVE_INTERVENANTS) || [];
    const users = Array.isArray(store.users)
      ? store.users
      : storageService.getItem(STORAGE_KEYS.PERSONNEL) || [];
    const technicians = Array.isArray(store.technicians)
      ? store.technicians
      : storageService.getItem(STORAGE_KEYS.TECHNICIANS) || [];
    const operations = Array.isArray(store.operations)
      ? store.operations
      : storageService.getItem(STORAGE_KEYS.OPERATIONS) || [];
    const warehouseItems = Array.isArray(store.warehouseItems)
      ? store.warehouseItems
      : storageService.getItem(STORAGE_KEYS.WAREHOUSE_ITEMS) || [];
    const entrepotComponents = Array.isArray(store.entrepotComponents)
      ? store.entrepotComponents
      : storageService.getItem(STORAGE_KEYS.ENTREPOT_COMPONENTS) || [];
    const compGroups = Array.isArray(store.compGroups)
      ? store.compGroups
      : storageService.getItem(STORAGE_KEYS.COMP_GROUPS) || [];
    const compFamilies = Array.isArray(store.compFamilies)
      ? store.compFamilies
      : storageService.getItem(STORAGE_KEYS.COMP_FAMILIES) || [];
    const compTemplates = Array.isArray(store.compTemplates)
      ? store.compTemplates
      : storageService.getItem(STORAGE_KEYS.COMP_TEMPLATES) || [];
    const partTypes = Array.isArray(store.partTypes)
      ? store.partTypes
      : storageService.getItem(STORAGE_KEYS.PART_TYPES) || [];
    const partDesignations = Array.isArray(store.partDesignations)
      ? store.partDesignations
      : storageService.getItem(STORAGE_KEYS.PART_DESIGNATIONS) || [];
    const sortiesExterne = Array.isArray(store.sortiesExterne)
      ? store.sortiesExterne
      : storageService.getItem(STORAGE_KEYS.SORTIE_EXTERNE) || [];

    const generalSystemTypes = Array.isArray(store.generalSystemTypes)
      ? store.generalSystemTypes
      : storageService.getItem(STORAGE_KEYS.GENERAL_SYSTEM_TYPES) || [];
    const sortieDemands = Array.isArray(store.sortieDemands)
      ? store.sortieDemands
      : storageService.getItem(STORAGE_KEYS.SORTIE_DEMANDS) || [];
    const replenishmentOrders = Array.isArray(store.replenishmentOrders)
      ? store.replenishmentOrders
      : storageService.getItem(STORAGE_KEYS.REPLENISHMENT_ORDERS) || [];
    const meterReadings = Array.isArray(store.meterReadings)
      ? store.meterReadings
      : storageService.getItem(STORAGE_KEYS.METER_READINGS) || [];
    const auditEvents = Array.isArray(store.auditEvents)
      ? store.auditEvents
      : storageService.getItem(STORAGE_KEYS.AUDIT_EVENTS) || [];

    let authAccounts: any[] | undefined = Array.isArray(customState?.authAccounts)
      ? customState.authAccounts
      : undefined;
    if (!authAccounts && (!customState || Array.isArray(customState.machines))) {
      try {
        authAccounts = new AuthService().getServerSyncAuthAccounts();
      } catch {
        authAccounts = undefined;
      }
    }

    const pendingDeletedIds =
      customState?.deletedIdsByEntity && typeof customState.deletedIdsByEntity === 'object'
        ? customState.deletedIdsByEntity
        : this.getPendingDeletedIdsByEntity();
    const hasDeletedIds = Object.keys(pendingDeletedIds).length > 0;

    return {
      rawStock,
      stock: rawStock,
      types,
      designations,
      machines,
      generalSystemTypes,
      families,
      templates,
      blueprints,
      zones,
      machineElementsLedger,
      mouvements,
      sortieDemands,
      replenishmentOrders,
      preventiveTasks,
      preventiveActions,
      preventiveGuides,
      preventivePlans,
      preventiveExecutions,
      meterReadings,
      auditEvents,
      correctiveInterventions,
      correctiveActionsByPanne,
      correctivePanneCategories,
      correctiveTravauxAFaire,
      correctiveIntervenants,
      users,
      technicians,
      operations,
      ...(authAccounts ? { authAccounts } : {}),
      warehouseItems,
      entrepotComponents,
      compGroups,
      compFamilies,
      compTemplates,
      partTypes,
      partDesignations,
      sortiesExterne,
      ...(hasDeletedIds ? { deletedIdsByEntity: pendingDeletedIds } : {}),
      updatedAt: this.getLocalModifiedAt() || new Date().toISOString(),
    };
  },

  /**
   * Computes a quantitative and temporal summary for any state payload.
   */
  summarizeState(data: Record<string, any> = {}): ServerStateSummary {
    const stockList = Array.isArray(data.rawStock)
      ? data.rawStock
      : Array.isArray(data.stock)
      ? data.stock
      : [];
    const machinesCount = Array.isArray(data.machines) ? data.machines.length : 0;
    const stockCount = stockList.length;
    const preventiveCount = Array.isArray(data.preventiveTasks) ? data.preventiveTasks.length : 0;
    const correctiveCount = Array.isArray(data.correctiveInterventions)
      ? data.correctiveInterventions.length
      : 0;
    const movementsCount = Array.isArray(data.mouvements) ? data.mouvements.length : 0;
    const zonesCount = Array.isArray(data.zones) ? data.zones.length : 0;

    return {
      version: typeof data.version === 'number' ? data.version : undefined,
      updatedAt: data.updatedAt || null,
      machinesCount,
      stockCount,
      preventiveCount,
      correctiveCount,
      movementsCount,
      zonesCount,
      totalItems:
        machinesCount +
        stockCount +
        preventiveCount +
        correctiveCount +
        movementsCount +
        zonesCount,
    };
  },

  /**
   * Checks server health & returns current gmao_state.json summary.
   */
  async fetchServerState(): Promise<{ online: boolean; state: Record<string, any> | null; summary: ServerStateSummary }> {
    try {
      await clientEnsureFreshServerSession();
      const response = await fetch(networkConfigService.resolveApiUrl('/api/gmao/state'), {
        method: 'GET',
        headers: buildClientAuthHeaders({ Accept: 'application/json' }),
      });
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          const errJson = await response.json().catch(() => ({}));
          if (errJson?.code === 'SERVER_SESSION_INVALID') {
            clearClientServerSessionToken();
            if (typeof window !== 'undefined') {
              window.dispatchEvent(
                new CustomEvent('gmao:server_session_expired', {
                  detail: { status: response.status, message: errJson?.message },
                })
              );
            }
          }
        }
        throw new Error(`HTTP ${response.status}`);
      }
      const json = await response.json();
      const state = json?.data || {};
      if (typeof json?.version === 'number' && state.version === undefined) {
        state.version = json.version;
      }
      return {
        online: true,
        state,
        summary: this.summarizeState(state),
      };
    } catch {
      return {
        online: false,
        state: null,
        summary: this.summarizeState({}),
      };
    }
  },

  /**
   * Fetches recent append-only audit log entries from the server.
   */
  async fetchAuditLogs(limit = 100): Promise<ServerAuditEntry[]> {
    try {
      const response = await fetch(
        networkConfigService.resolveApiUrl(`/api/gmao/audit?limit=${encodeURIComponent(String(limit))}`),
        {
          method: 'GET',
          headers: buildClientAuthHeaders({ Accept: 'application/json' }),
        }
      );
      if (!response.ok) return [];
      const json = await response.json();
      return Array.isArray(json?.data) ? json.data : [];
    } catch {
      return [];
    }
  },

  /**
   * Detects temporal, version, or quantitative conflicts between local state and server gmao_state.json.
   */
  detectConflict(
    localData: Record<string, any>,
    serverData: Record<string, any>,
    direction: 'push' | 'pull' = 'push'
  ): ConflictDetectionResult {
    const localSummary = this.summarizeState(localData);
    const serverSummary = this.summarizeState(serverData);
    const lastSyncAt = this.getLastSyncAt();
    const lastKnownVersion = this.getLastServerVersion();

    const serverTime = serverSummary.updatedAt ? new Date(serverSummary.updatedAt).getTime() : 0;
    const lastSyncTime = lastSyncAt ? new Date(lastSyncAt).getTime() : 0;

    const countsDiffer =
      localSummary.machinesCount !== serverSummary.machinesCount ||
      localSummary.stockCount !== serverSummary.stockCount ||
      localSummary.preventiveCount !== serverSummary.preventiveCount ||
      localSummary.correctiveCount !== serverSummary.correctiveCount ||
      localSummary.movementsCount !== serverSummary.movementsCount;

    if (direction === 'push') {
      const serverHasData = serverSummary.totalItems > 0;
      const versionAdvanced =
        serverHasData &&
        lastKnownVersion !== null &&
        typeof serverSummary.version === 'number' &&
        serverSummary.version > lastKnownVersion;
      const isServerNewerThanLastSync =
        serverHasData && (!lastSyncTime || serverTime > lastSyncTime + 1000 || versionAdvanced);
      const isOverwritingNonEmptyWithDifferent =
        serverHasData && (countsDiffer || versionAdvanced) && isServerNewerThanLastSync;

      if (isOverwritingNonEmptyWithDifferent) {
        return {
          hasConflict: true,
          reason: 'SERVER_NEWER',
          localSummary,
          serverSummary,
          serverState: serverData,
        };
      }
    } else if (direction === 'pull') {
      const localHasData = localSummary.totalItems > 0;
      if (localHasData && countsDiffer) {
        return {
          hasConflict: true,
          reason: 'DATA_DIVERGENCE',
          localSummary,
          serverSummary,
          serverState: serverData,
        };
      }
    }

    return {
      hasConflict: false,
      localSummary,
      serverSummary,
      serverState: serverData,
    };
  },

  /**
   * Explicitly pushes local state to server gmao_state.json.
   * If force=false, checks for conflict first and sends expectedVersion for optimistic concurrency.
   */
  async pushToServer(options: {
    force?: boolean;
    merge?: boolean;
    replaceAll?: boolean;
    customState?: Record<string, any>;
  } = {}): Promise<{
    success: boolean;
    merged?: boolean;
    conflict?: ConflictDetectionResult;
    version?: number;
    updatedAt?: string;
    summary?: ServerStateSummary;
    error?: string;
  }> {
    const localPayload = this.buildLocalPayload(options.customState);
    const lastKnownVersion = this.getLastServerVersion();

    if (options.replaceAll) {
      localPayload.replaceAll = true;
    }

    if (options.merge) {
      localPayload.merge = true;
    } else if (!options.force) {
      const serverCheck = await this.fetchServerState();
      if (!serverCheck.online) {
        const offlineMsg = 'الخادم غير متصل حالياً (Server Offline)';
        this.recordSyncError(offlineMsg);
        return {
          success: false,
          error: offlineMsg,
        };
      }
      if (serverCheck.state) {
        const conflict = this.detectConflict(localPayload, serverCheck.state, 'push');
        if (conflict.hasConflict) {
          this.recordSyncConflict(conflict);
          return {
            success: false,
            conflict,
          };
        }
        if (typeof serverCheck.state.version === 'number') {
          localPayload.expectedVersion = serverCheck.state.version;
        }
      }
    } else {
      localPayload.force = true;
    }

    if (localPayload.expectedVersion === undefined && lastKnownVersion !== null && !options.force && !options.merge) {
      localPayload.expectedVersion = lastKnownVersion;
    }

    try {
      const actorRole = getActiveActorRole();
      if (actorRole === 'VIEWER' || actorRole === 'OBSERVATEUR') {
        const roleErr = 'Accès refusé : le profil Observateur (VIEWER) est en lecture seule.';
        this.recordSyncError(roleErr);
        return {
          success: false,
          error: roleErr,
        };
      }

      await clientEnsureFreshServerSession();

      const response = await fetch(networkConfigService.resolveApiUrl('/api/gmao/state'), {
        method: 'POST',
        headers: buildClientAuthHeaders({ 'Content-Type': 'application/json' }, actorRole),
        body: JSON.stringify(localPayload),
      });

      if (response.status === 401 || response.status === 403) {
        const forbiddenJson = await response.json().catch(() => ({}));
        const code = forbiddenJson?.code;
        if (code === 'SERVER_SESSION_INVALID') {
          clearClientServerSessionToken();
        }
        if (
          (code === 'SERVER_SESSION_INVALID' || code === 'SERVER_SESSION_REQUIRED') &&
          typeof window !== 'undefined'
        ) {
          window.dispatchEvent(
            new CustomEvent('gmao:server_session_expired', {
              detail: { status: response.status, code, message: forbiddenJson?.message },
            })
          );
        }
        const forbiddenMsg =
          forbiddenJson?.message ||
          `Action non autorisée pour votre rôle (${response.status} ${response.status === 401 ? 'Unauthorized' : 'Forbidden'}).`;
        this.recordSyncError(forbiddenMsg);
        return {
          success: false,
          error: forbiddenMsg,
        };
      }

      if (response.status === 409) {
        const conflictJson = await response.json();
        const serverState = conflictJson?.data || {};
        const conflictObj: ConflictDetectionResult = {
          hasConflict: true,
          reason: 'SERVER_NEWER',
          localSummary: this.summarizeState(localPayload),
          serverSummary: this.summarizeState(serverState),
          serverState,
        };
        this.recordSyncConflict(conflictObj);
        return {
          success: false,
          conflict: conflictObj,
        };
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      const updatedAt = result?.updatedAt || new Date().toISOString();
      this.recordSyncSuccess(updatedAt, result?.version);
      this.clearPendingDeletedIds();
      storageService.setItem(LOCAL_MODIFIED_AT_KEY, updatedAt);

      // If the server performed a cross-device smart merge and returned the unified state,
      // apply it locally so this device also receives records created by other LAN devices.
      const finalState = result?.data && typeof result.data === 'object' ? result.data : null;
      if (finalState && !options.customState) {
        const store = useGmaoStore.getState();
        DataGateway.loadFullServerState(finalState, {
          applyRemoteStateUpdate: store.applyRemoteStateUpdate,
        });
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('gmao:server_synced', {
            detail: { version: result?.version, updatedAt, merged: Boolean(result?.merged) },
          })
        );
      }

      return {
        success: true,
        merged: Boolean(result?.merged),
        version: result?.version,
        updatedAt,
        summary: this.summarizeState(finalState || localPayload),
      };
    } catch (err: any) {
      const errMsg = err?.message || 'فشل الاتصال بالخادم أثناء الحفظ';
      this.recordSyncError(errMsg);
      return {
        success: false,
        error: errMsg,
      };
    }
  },

  /**
   * Non-destructively merges local and server states across devices by record ID, timestamp,
   * and Maker-Checker lifecycle rank, then hydrates the unified state locally.
   */
  async mergeWithServer(options: { customState?: Record<string, any> } = {}) {
    return this.pushToServer({ merge: true, customState: options.customState });
  },

  /**
   * Schedules a non-blocking background server sync (debounced) when local state changes.
   * Respects optimistic concurrency so it never overwrites a newer server version silently.
   */
  scheduleAutoPush(customState?: Record<string, any>, delayMs = 2500): void {
    if (typeof window === 'undefined') return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    const role = getActiveActorRole();
    if (role === 'VIEWER' || role === 'OBSERVATEUR') return;

    if (autoPushTimer) {
      clearTimeout(autoPushTimer);
    }

    autoPushTimer = setTimeout(async () => {
      if (autoPushInFlight) return;
      autoPushInFlight = true;
      try {
        await this.pushToServer({ force: false, customState });
      } catch {
        // Silent background fallback when server is unreachable in offline/unit-test environments
      } finally {
        autoPushInFlight = false;
      }
    }, delayMs);
  },

  /**
   * Explicitly pulls state from server gmao_state.json and applies it via DataGateway.loadFullServerState.
   * If force=false, checks for conflict first.
   */
  async pullFromServer(options: {
    force?: boolean;
    setters?: Record<string, any>;
  } = {}): Promise<{
    success: boolean;
    conflict?: ConflictDetectionResult;
    version?: number;
    updatedAt?: string;
    summary?: ServerStateSummary;
    error?: string;
  }> {
    const serverCheck = await this.fetchServerState();
    if (!serverCheck.online || !serverCheck.state) {
      const pullErr = 'تعذر الاتصال بالخادم لاستعادة البيانات';
      this.recordSyncError(pullErr);
      return {
        success: false,
        error: pullErr,
      };
    }

    const localPayload = this.buildLocalPayload();

    if (!options.force) {
      const conflict = this.detectConflict(localPayload, serverCheck.state, 'pull');
      if (conflict.hasConflict) {
        this.recordSyncConflict(conflict);
        return {
          success: false,
          conflict,
        };
      }
    }

    const store = useGmaoStore.getState();
    DataGateway.loadFullServerState(serverCheck.state, {
      applyRemoteStateUpdate: store.applyRemoteStateUpdate,
      ...(options.setters || {}),
    });
    this.clearPendingDeletedIds();

    const syncTimestamp = serverCheck.state.updatedAt || new Date().toISOString();
    this.recordSyncSuccess(syncTimestamp, serverCheck.state.version);

    return {
      success: true,
      version: serverCheck.state.version,
      updatedAt: syncTimestamp,
      summary: serverCheck.summary,
    };
  },
};

export default serverSyncService;
