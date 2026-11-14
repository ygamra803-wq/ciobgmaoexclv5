import type { Request } from 'express';
import type { ResolvedServerActor } from '../core/security/serverRbacPolicy';
import type { resolveServerSessionSecret, ServerSessionPayload } from '../core/security/serverSession';
import type { createServerSessionStore } from '../core/security/serverSessionStore';

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
  'partTypes',
  'partDesignations',
  'sortiesExterne',
  'sortieDemands',
  'meterReadings',
  'replenishmentOrders',
  'workshopOrders',
  'needRequests',
  'auditEvents',
] as const;

export type AllowedEntityKey = (typeof ALLOWED_ENTITIES)[number];
export type DictionaryEntityKey = 'correctiveActionsByPanne' | 'correctivePanneCategories';
export type ArrayEntityKey = Exclude<AllowedEntityKey, DictionaryEntityKey>;

export const ALLOWED_ENTITY_SET = new Set<string>(ALLOWED_ENTITIES);

export const OBJECT_ENTITY_SET = new Set<string>([
  'correctiveActionsByPanne',
  'correctivePanneCategories',
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

export interface CreateGmaoApiAppOptions {
  dataDir?: string;
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
