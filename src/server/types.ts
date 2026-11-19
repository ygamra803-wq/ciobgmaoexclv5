import type { Request } from 'express';
import type { ResolvedServerActor } from '../core/security/serverRbacPolicy.ts';
import type { resolveServerSessionSecret, ServerSessionPayload } from '../core/security/serverSession.ts';
import type { createServerSessionStore } from '../core/security/serverSessionStore.ts';

/**
 * Canonical allowlist of GMAO collections and dictionary entities managed by the LAN API host.
 * Any entity outside this set is rejected fail-closed with HTTP 403.
 */
export const ALLOWED_ENTITIES = [
  'rawStock',
  'stock',
  'types',
  'pdrGroups',
  'designations',
  'machines',
  'generalSystemTypes',
  'families',
  'templates',
  'blueprints',
  'zones',
  'machineElementsLedger',
  'mouvements',
  'preventiveTasks',
  'preventiveActions',
  'preventiveGuides',
  'preventivePlans',
  'preventiveExecutions',
  'correctiveInterventions',
  'correctiveActionsByPanne',
  'correctivePanneCategories',
  'correctiveTravauxAFaire',
  'correctiveIntervenants',
  'users',
  'technicians',
  'operations',
  'authAccounts',
  'warehouseItems',
  'entrepotComponents',
  'compGroups',
  'compFamilies',
  'compTemplates',
  'partGroups',
  'partTypes',
  'partDesignations',
  'sortiesExterne',
  'sortieDemands',
  'meterReadings',
  'replenishmentOrders',
  'workshopOrders',
  'needRequests',
  'financialBudgets',
  'currencyConfig',
  'auditEvents',
] as const;

export type AllowedEntityKey = (typeof ALLOWED_ENTITIES)[number];
export type DictionaryEntityKey =
  | 'correctiveActionsByPanne'
  | 'correctivePanneCategories'
  | 'financialBudgets'
  | 'currencyConfig';
export type ArrayEntityKey = Exclude<AllowedEntityKey, DictionaryEntityKey>;

export const ALLOWED_ENTITY_SET = new Set<string>(ALLOWED_ENTITIES);

export const OBJECT_ENTITY_SET = new Set<string>([
  'correctiveActionsByPanne',
  'correctivePanneCategories',
  'financialBudgets',
  'currencyConfig',
]);

export const MAX_STATE_PAYLOAD_LIMIT = '10mb';

export type ServerRecord = Record<string, unknown>;

export type GmaoDbState = {
  [K in ArrayEntityKey]: ServerRecord[];
} & {
  [K in DictionaryEntityKey]: Record<string, unknown>;
} & {
  version: number;
  updatedAt: string;
  [key: string]: unknown;
};

export type ServerStorageEngine = 'sqlite' | 'json';
export type SqliteJournalMode = 'WAL' | 'DELETE';

export interface SqliteStorageInfo {
  engine: ServerStorageEngine;
  dbFile: string;
  journalMode: SqliteJournalMode | 'NONE';
  schemaVersion: number;
  version: number;
  updatedAt: string;
  sizeBytes: number;
  walSizeBytes: number;
  entityCount: number;
  auditCount: number;
  backupsCount: number;
  migratedFromJsonAt: string | null;
  isNetworkPath: boolean;
}

export interface SqliteBackupResult {
  backupFile: string;
  fileName: string;
  sizeBytes: number;
  version: number;
  createdAt: string;
  retainedBackups: number;
}

export interface CreateGmaoApiAppOptions {
  dataDir?: string;
  dbFile?: string;
  storageEngine?: ServerStorageEngine;
  sqliteJournalMode?: SqliteJournalMode;
  backupRetention?: number;
  port?: number;
  isProduction?: boolean;
  initialState?: Record<string, unknown>;
  sessionSecret?: string;
  maxSensitiveSessions?: number;
  maxStandardSessions?: number;
  distDir?: string;
}

export interface SseTicketEntry {
  sub: string;
  role: string;
  ip: string;
  exp: number;
}

export interface LoginThrottleEntry {
  failures: number;
  lockUntil: number;
  resetAt: number;
}

export interface GmaoApiRequest extends Request {
  resolvedServerActor?: ResolvedServerActor & {
    sessionVerified?: boolean;
  };
  serverSessionPayload?: ServerSessionPayload;
  sseTicketActor?: SseTicketEntry;
  isBootstrapAuthorized?: boolean;
}

export interface AuditWriteContext {
  actor?: string;
  action: string;
  entity: string;
  summary?: string;
}

export type SessionSecretResolution = ReturnType<typeof resolveServerSessionSecret>;
export type ServerSessionStore = ReturnType<typeof createServerSessionStore>;
