import { STORAGE_KEYS } from '../infrastructure/persistence/storageKeys';
import { storageService } from '../utils/storageService';
import { DataGateway } from '../application/DataGateway';
import { useGmaoStore } from '../store/useGmaoStore';
import { networkConfigService } from './networkConfigService';

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

const LAST_SYNC_AT_KEY = 'gmao_last_server_sync_at';
const LAST_SERVER_VERSION_KEY = 'gmao_last_server_version';
const LOCAL_MODIFIED_AT_KEY = 'gmao_local_modified_at';

let autoPushTimer: ReturnType<typeof setTimeout> | null = null;
let autoPushInFlight = false;

const resolveSessionUser = (): Record<string, any> | null => {
  try {
    if (typeof sessionStorage !== 'undefined') {
      const signedRaw = sessionStorage.getItem('gmao_session_v2');
      if (signedRaw) {
        const parsed = JSON.parse(signedRaw);
        if (parsed?.payload && typeof parsed.payload === 'object') {
          return parsed.payload;
        }
      }
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

const getActiveActorName = (): string => {
  const user = resolveSessionUser();
  if (user) {
    return user.nom || user.name || user.username || user.role || 'operator';
  }
  return 'web-operator';
};

const getActiveActorRole = (): string => {
  const user = resolveSessionUser();
  if (user && typeof user.role === 'string' && user.role.trim()) {
    return user.role.trim().toUpperCase();
  }
  return 'ADMIN';
};


export const serverSyncService = {
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

    return {
      rawStock,
      stock: rawStock,
      types,
      designations,
      machines,
      families,
      templates,
      blueprints,
      zones,
      machineElementsLedger,
      mouvements,
      preventiveTasks,
      preventiveActions,
      preventiveGuides,
      preventivePlans,
      preventiveExecutions,
      correctiveInterventions,
      correctiveActionsByPanne,
      correctivePanneCategories,
      correctiveTravauxAFaire,
      correctiveIntervenants,
      users,
      technicians,
      operations,
      warehouseItems,
      entrepotComponents,
      compGroups,
      compFamilies,
      compTemplates,
      partTypes,
      partDesignations,
      sortiesExterne,
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
      const response = await fetch(networkConfigService.resolveApiUrl('/api/gmao/state'), {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'x-gmao-client-origin': 'gmao-web-client',
        },
      });
      if (!response.ok) {
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
          headers: {
            Accept: 'application/json',
            'x-gmao-client-origin': 'gmao-web-client',
          },
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
  async pushToServer(options: { force?: boolean; customState?: Record<string, any> } = {}): Promise<{
    success: boolean;
    conflict?: ConflictDetectionResult;
    version?: number;
    updatedAt?: string;
    summary?: ServerStateSummary;
    error?: string;
  }> {
    const localPayload = this.buildLocalPayload(options.customState);
    const lastKnownVersion = this.getLastServerVersion();

    if (!options.force) {
      const serverCheck = await this.fetchServerState();
      if (!serverCheck.online) {
        return {
          success: false,
          error: 'الخادم غير متصل حالياً (Server Offline)',
        };
      }
      if (serverCheck.state) {
        const conflict = this.detectConflict(localPayload, serverCheck.state, 'push');
        if (conflict.hasConflict) {
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

    if (localPayload.expectedVersion === undefined && lastKnownVersion !== null && !options.force) {
      localPayload.expectedVersion = lastKnownVersion;
    }

    try {
      const actorRole = getActiveActorRole();
      if (actorRole === 'VIEWER' || actorRole === 'OBSERVATEUR') {
        return {
          success: false,
          error: 'Accès refusé : le profil Observateur (VIEWER) est en lecture seule.',
        };
      }

      const response = await fetch(networkConfigService.resolveApiUrl('/api/gmao/state'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gmao-client-origin': 'gmao-web-client',
          'x-gmao-actor': getActiveActorName(),
          'x-gmao-role': actorRole,
        },
        body: JSON.stringify(localPayload),
      });

      if (response.status === 403) {
        const forbiddenJson = await response.json().catch(() => ({}));
        return {
          success: false,
          error: forbiddenJson?.message || 'Action non autorisée pour votre rôle (403 Forbidden).',
        };
      }

      if (response.status === 409) {
        const conflictJson = await response.json();
        const serverState = conflictJson?.data || {};
        return {
          success: false,
          conflict: {
            hasConflict: true,
            reason: 'SERVER_NEWER',
            localSummary: this.summarizeState(localPayload),
            serverSummary: this.summarizeState(serverState),
            serverState,
          },
        };
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      const updatedAt = result?.updatedAt || new Date().toISOString();
      this.setLastSyncAt(updatedAt);
      this.setLastServerVersion(result?.version);
      storageService.setItem(LOCAL_MODIFIED_AT_KEY, updatedAt);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('gmao:server_synced', {
            detail: { version: result?.version, updatedAt },
          })
        );
      }

      return {
        success: true,
        version: result?.version,
        updatedAt,
        summary: this.summarizeState(localPayload),
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'فشل الاتصال بالخادم أثناء الحفظ',
      };
    }
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
        const res = await this.pushToServer({ force: false, customState });
        if (!res.success && res.conflict) {
          window.dispatchEvent(
            new CustomEvent('gmao:server_conflict', { detail: res.conflict })
          );
        }
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
      return {
        success: false,
        error: 'تعذر الاتصال بالخادم لاستعادة البيانات',
      };
    }

    const localPayload = this.buildLocalPayload();

    if (!options.force) {
      const conflict = this.detectConflict(localPayload, serverCheck.state, 'pull');
      if (conflict.hasConflict) {
        return {
          success: false,
          conflict,
        };
      }
    }

    const store = useGmaoStore.getState();
    DataGateway.loadFullServerState(serverCheck.state, {
      applyRemoteStateUpdate: store.applyRemoteStateUpdate,
      setTypes: store.setTypes,
      setDesignations: store.setDesignations,
      setRawStock: store.setRawStock,
      setFamilies: store.setFamilies,
      setTemplates: store.setTemplates,
      setBlueprints: store.setBlueprints,
      setMachines: store.setMachines,
      setZones: store.setZones,
      setMachineElementsLedger: store.setMachineElementsLedger,
      setWarehouseItems: store.setWarehouseItems,
      setEntrepotComponents: store.setEntrepotComponents,
      setCompGroups: store.setCompGroups,
      setCompFamilies: store.setCompFamilies,
      setCompTemplates: store.setCompTemplates,
      setPartTypes: store.setPartTypes,
      setPartDesignations: store.setPartDesignations,
      setUsers: store.setUsers,
      setTechnicians: store.setTechnicians,
      setOperations: store.setOperations,
      setMouvements: store.setMouvements,
      setPreventiveTasks: store.setPreventiveTasks,
      setPreventiveActions: store.setPreventiveActions,
      setPreventiveGuides: store.setPreventiveGuides,
      setPreventivePlans: store.setPreventivePlans,
      setPreventiveExecutions: store.setPreventiveExecutions,
      setSortiesExterne: store.setSortiesExterne,
      setCorrectiveInterventions: store.setCorrectiveInterventions,
      setCorrectiveActionsByPanne: store.setCorrectiveActionsByPanne,
      setCorrectivePanneCategories: store.setCorrectivePanneCategories,
      setCorrectiveTravauxAFaire: store.setCorrectiveTravauxAFaire,
      setCorrectiveIntervenants: store.setCorrectiveIntervenants,
      ...(options.setters || {}),
    });

    const syncTimestamp = serverCheck.state.updatedAt || new Date().toISOString();
    this.setLastSyncAt(syncTimestamp);
    this.setLastServerVersion(serverCheck.state.version);

    return {
      success: true,
      version: serverCheck.state.version,
      updatedAt: syncTimestamp,
      summary: serverCheck.summary,
    };
  },
};

export default serverSyncService;
