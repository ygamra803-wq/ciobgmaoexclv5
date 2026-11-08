/**
 * Server-Side RBAC, Actor Verification & Maker-Checker Entity Guard Policy
 *
 * Enforces defense-in-depth on the LAN host server (`server.ts`):
 *  1. Cross-checks `x-gmao-actor-id` / `x-gmao-actor` against registered `dbState.users`
 *     and `dbState.technicians` so a lower-privileged or archived user cannot escalate
 *     privileges by spoofing `x-gmao-role: ADMIN`.
 *  2. Enforces per-entity write permissions (`canRoleMutateEntity`) so `TECHNICIEN` / `OPERATEUR`
 *     cannot directly mutate `users`, `rawStock`, `stock`, or `mouvements` (`Maker-Checker` bypass).
 *  3. Scopes bulk `/api/gmao/state` payloads by role (`sanitizeBulkStateForRole`) and prevents
 *     unapproved field claims from self-approving (`validation_status: 'APPROVED'` + `stock_deducted: true`)
 *     when pushed from a `TECHNICIEN` or `OPERATEUR` device.
 */

export const ADMIN_ONLY_ENTITIES = new Set<string>(['users', 'technicians', 'operations', 'zones']);

export const STOCK_LEDGER_ENTITIES = new Set<string>([
  'rawStock',
  'stock',
  'mouvements',
  'replenishmentOrders',
]);

export const CATALOG_PROTECTED_ENTITIES = new Set<string>([
  'warehouseItems',
  'entrepotComponents',
  'compGroups',
  'compFamilies',
  'compTemplates',
  'partTypes',
  'partDesignations',
  'types',
  'designations',
  'machines',
  'families',
  'templates',
  'blueprints',
]);

export const FIELD_WRITABLE_ENTITIES = new Set<string>([
  'correctiveInterventions',
  'preventiveTasks',
  'preventiveExecutions',
  'meterReadings',
  'sortieDemands',
  'machines',
  'machineElementsLedger',
  'auditEvents',
]);

export const MAGASIN_WRITABLE_ENTITIES = new Set<string>([
  'rawStock',
  'stock',
  'mouvements',
  'sortieDemands',
  'replenishmentOrders',
  'warehouseItems',
  'entrepotComponents',
  'sortiesExterne',
  'types',
  'designations',
  'partTypes',
  'partDesignations',
  'compGroups',
  'compFamilies',
  'compTemplates',
  'machines',
  'machineElementsLedger',
  'auditEvents',
]);

const ROLE_PRIVILEGE_RANK: Record<string, number> = {
  VIEWER: 0,
  OPERATEUR: 1,
  TECHNICIEN: 2,
  RESPONSABLE_MAGASIN: 3,
  RESPONSABLE_MAINTENANCE: 4,
  ADMIN: 5,
};

export function normalizeServerRole(rawRole: unknown): string {
  if (typeof rawRole !== 'string' || !rawRole.trim()) return 'VIEWER';
  const upper = rawRole.trim().toUpperCase();
  if (upper === 'ADMIN' || upper === 'ADMINISTRATEUR') return 'ADMIN';
  if (
    upper === 'RESPONSABLE' ||
    upper === 'RESPONSABLE_MAINTENANCE' ||
    upper === 'CHEF' ||
    upper === 'CHEF_EQUIPE'
  ) {
    return 'RESPONSABLE_MAINTENANCE';
  }
  if (upper === 'MAGASINIER' || upper === 'RESPONSABLE_MAGASIN' || upper === 'RMG') {
    return 'RESPONSABLE_MAGASIN';
  }
  if (upper === 'TECHNICIEN' || upper === 'TECHNICIAN' || upper === 'TECH') return 'TECHNICIEN';
  if (upper === 'OPERATEUR' || upper === 'OPERATOR') return 'OPERATEUR';
  if (upper === 'VIEWER' || upper === 'OBSERVATEUR' || upper === 'VISITEUR') return 'VIEWER';
  return 'VIEWER';
}

export interface ResolvedServerActor {
  claimedRole: string;
  effectiveRole: string;
  actorName: string;
  actorId: string;
  roleSpoofDetected: boolean;
  isArchivedActor: boolean;
}

const UNTRUSTED_GENERIC_ACTORS = new Set<string>([
  'WEB-OPERATOR',
  'ANONYMOUS',
  'UNKNOWN',
  'GUEST',
]);

/**
 * Resolves the effective server role by cross-checking the claimed `x-gmao-role`
 * against registered users and technicians in `dbState`.
 * Missing role or missing/untrusted actor identity always resolves to `VIEWER`.
 */
export function resolveEffectiveServerRole(
  headers: Record<string, unknown>,
  dbUsers: any[] = [],
  dbTechnicians: any[] = []
): ResolvedServerActor {
  const rawRole = headers?.['x-gmao-role'];
  const claimedRole = normalizeServerRole(rawRole);
  const actorId = String(headers?.['x-gmao-actor-id'] || '').trim();
  const actorName = String(headers?.['x-gmao-actor'] || '').trim();

  const normId = actorId.toUpperCase();
  const normName = actorName.toUpperCase();

  const hasTrustedActorIdentity =
    (normId.length > 0 && !UNTRUSTED_GENERIC_ACTORS.has(normId)) ||
    (normName.length > 0 && !UNTRUSTED_GENERIC_ACTORS.has(normName));

  let effectiveRole = hasTrustedActorIdentity ? claimedRole : 'VIEWER';
  let roleSpoofDetected = !hasTrustedActorIdentity && claimedRole !== 'VIEWER';
  let isArchivedActor = false;

  // 1. Check against registered users in dbState.users
  if ((normId || normName) && Array.isArray(dbUsers) && dbUsers.length > 0) {
    const matchedUser = dbUsers.find((u: any) => {
      if (!u) return false;
      const uId = String(u.id || u.code || '').trim().toUpperCase();
      const uUsername = String(u.username || '').trim().toUpperCase();
      const uName = String(u.nom || u.name || '').trim().toUpperCase();
      if (normId && (uId === normId || uUsername === normId)) return true;
      if (normName && (uName === normName || uUsername === normName)) return true;
      return false;
    });

    if (matchedUser) {
      if (
        matchedUser.is_active === false ||
        matchedUser.actif === false ||
        String(matchedUser.statut || '').toUpperCase() === 'ARCHIVE'
      ) {
        isArchivedActor = true;
        effectiveRole = 'VIEWER';
      } else if (matchedUser.role) {
        const registeredRole = normalizeServerRole(matchedUser.role);
        const claimedRank = ROLE_PRIVILEGE_RANK[claimedRole] ?? 0;
        const registeredRank = ROLE_PRIVILEGE_RANK[registeredRole] ?? 0;
        if (claimedRank > registeredRank) {
          roleSpoofDetected = true;
          effectiveRole = registeredRole;
        }
      }
    }
  }

  // 2. Check against registered technicians in dbState.technicians
  if (!isArchivedActor && (normId || normName) && Array.isArray(dbTechnicians) && dbTechnicians.length > 0) {
    const matchedTech = dbTechnicians.find((t: any) => {
      if (!t) return false;
      const tId = String(t.id_technician || t.id || t.code || '').trim().toUpperCase();
      const tName = String(t.nom || t.name || '').trim().toUpperCase();
      if (normId && tId === normId) return true;
      if (normName && tName === normName) return true;
      return false;
    });

    if (matchedTech) {
      if (
        matchedTech.is_active === false ||
        matchedTech.actif === false ||
        String(matchedTech.statut || '').toUpperCase() === 'ARCHIVE'
      ) {
        isArchivedActor = true;
        effectiveRole = 'VIEWER';
      } else if (matchedTech.role) {
        const techRole = normalizeServerRole(matchedTech.role);
        const claimedRank = ROLE_PRIVILEGE_RANK[effectiveRole] ?? 0;
        const techRank = ROLE_PRIVILEGE_RANK[techRole] ?? 2;
        if (claimedRank > techRank) {
          roleSpoofDetected = true;
          effectiveRole = techRole;
        }
      }
    }
  }

  return {
    claimedRole,
    effectiveRole,
    actorName: actorName || 'web-operator',
    actorId,
    roleSpoofDetected,
    isArchivedActor,
  };
}

/**
 * Determines whether `effectiveRole` is permitted to perform `method` on `targetEntity`.
 */
export function canRoleMutateEntity(
  effectiveRole: string,
  targetEntity: string,
  method: string
): { allowed: boolean; reason?: string } {
  const role = normalizeServerRole(effectiveRole);
  const httpMethod = String(method || 'POST').toUpperCase();

  if (role === 'VIEWER') {
    return {
      allowed: false,
      reason: 'Role VIEWER is read-only and cannot modify server state.',
    };
  }

  if (!targetEntity || targetEntity === 'state' || targetEntity === 'audit') {
    return { allowed: true };
  }

  if (targetEntity === 'auditEvents' && (httpMethod === 'DELETE' || httpMethod === 'PUT')) {
    return {
      allowed: false,
      reason: `Entity 'auditEvents' is strictly append-only; ${httpMethod} is prohibited.`,
    };
  }

  if (ADMIN_ONLY_ENTITIES.has(targetEntity) && role !== 'ADMIN' && role !== 'RESPONSABLE_MAINTENANCE') {
    return {
      allowed: false,
      reason: `Role '${role}' is not authorized to modify administrative entity '${targetEntity}'.`,
    };
  }

  if (role === 'TECHNICIEN' || role === 'OPERATEUR') {
    if (STOCK_LEDGER_ENTITIES.has(targetEntity)) {
      return {
        allowed: false,
        reason: `Role '${role}' cannot directly mutate '${targetEntity}' (Maker-Checker policy: use sortieDemands).`,
      };
    }
    if (httpMethod === 'DELETE' && CATALOG_PROTECTED_ENTITIES.has(targetEntity)) {
      return {
        allowed: false,
        reason: `Role '${role}' is not authorized to delete records from '${targetEntity}'.`,
      };
    }
  }

  if (role === 'RESPONSABLE_MAGASIN') {
    if (httpMethod === 'DELETE' && (targetEntity === 'machines' || targetEntity === 'preventivePlans')) {
      return {
        allowed: false,
        reason: `Role '${role}' is not authorized to delete records from '${targetEntity}'.`,
      };
    }
  }

  return { allowed: true };
}

/**
 * Sanitizes a bulk `/api/gmao/state` payload according to the caller's `effectiveRole`:
 *  - Blocks `replaceAll: true` for non-admin/non-supervisor roles.
 *  - Filters entity keys for `TECHNICIEN`, `OPERATEUR`, and `RESPONSABLE_MAGASIN`.
 *  - Prevents `TECHNICIEN`/`OPERATEUR` from self-approving (`validation_status: 'APPROVED'` + `stock_deducted: true`)
 *    records that were not already approved on the server.
 */
export function sanitizeBulkStateForRole(
  effectiveRole: string,
  incomingState: Record<string, any>,
  currentServerState: Record<string, any> = {}
): {
  allowed: boolean;
  reason?: string;
  sanitizedState: Record<string, any>;
  strippedKeys: string[];
} {
  const role = normalizeServerRole(effectiveRole);

  if (role === 'VIEWER') {
    return {
      allowed: false,
      reason: 'Role VIEWER is read-only and cannot push state to server.',
      sanitizedState: {},
      strippedKeys: [],
    };
  }

  if (incomingState?.replaceAll === true && role !== 'ADMIN' && role !== 'RESPONSABLE_MAINTENANCE') {
    return {
      allowed: false,
      reason: `Role '${role}' is not authorized to execute a full factory state replacement (replaceAll).`,
      sanitizedState: {},
      strippedKeys: [],
    };
  }

  if (role === 'ADMIN' || role === 'RESPONSABLE_MAINTENANCE') {
    return {
      allowed: true,
      sanitizedState: incomingState,
      strippedKeys: [],
    };
  }

  const allowedSet =
    role === 'RESPONSABLE_MAGASIN' ? MAGASIN_WRITABLE_ENTITIES : FIELD_WRITABLE_ENTITIES;

  const metaKeys = new Set([
    'expectedVersion',
    'force',
    'merge',
    'replaceAll',
    'deletedIdsByEntity',
    'updatedAt',
  ]);

  const sanitizedState: Record<string, any> = {};
  const strippedKeys: string[] = [];

  for (const [key, value] of Object.entries(incomingState || {})) {
    if (metaKeys.has(key)) {
      sanitizedState[key] = value;
      continue;
    }
    if (!allowedSet.has(key)) {
      strippedKeys.push(key);
      continue;
    }
    sanitizedState[key] = value;
  }

  // Enforce Maker-Checker server-side clamp for TECHNICIEN / OPERATEUR
  if (role === 'TECHNICIEN' || role === 'OPERATEUR') {
    const clampMakerCheckerCollection = (entityKey: string) => {
      if (!Array.isArray(sanitizedState[entityKey])) return;
      const serverList = Array.isArray(currentServerState[entityKey])
        ? currentServerState[entityKey]
        : [];
      const approvedOnServerIds = new Set(
        serverList
          .filter(
            (item: any) =>
              item &&
              (item.validation_status === 'APPROVED' ||
                item.statut === 'CLOTURE' ||
                item.stock_deducted === true)
          )
          .map((item: any) => String(item.id || item.num_bt || item.code || ''))
      );

      sanitizedState[entityKey] = sanitizedState[entityKey].map((item: any) => {
        if (!item || typeof item !== 'object') return item;
        const itemId = String(item.id || item.num_bt || item.code || '');
        const wasAlreadyApproved = itemId && approvedOnServerIds.has(itemId);
        if (
          !wasAlreadyApproved &&
          (item.validation_status === 'APPROVED' || item.stock_deducted === true)
        ) {
          return {
            ...item,
            validation_status: 'PENDING_VALIDATION',
            stock_deducted: false,
            ...(entityKey === 'correctiveInterventions' && item.statut === 'CLOTURE'
              ? { statut: 'EN_COURS', action_fermee: 'NON' }
              : {}),
          };
        }
        return item;
      });
    };

    clampMakerCheckerCollection('correctiveInterventions');
    clampMakerCheckerCollection('preventiveExecutions');
    clampMakerCheckerCollection('sortieDemands');
  }

  return {
    allowed: true,
    sanitizedState,
    strippedKeys,
  };
}

/**
 * SEC-HARDENING-P1 (Batch B): Prohibited weak or default API tokens for LAN host server
 */
export const WEAK_API_TOKENS = new Set<string>([
  '',
  'empty',
  'change-me',
  'changeme',
  'secret',
  'gmao',
  '1234',
  '123456',
  'admin',
  'password',
  'default',
  'token',
]);

/**
 * Returns true if the configured GMAO_API_TOKEN is empty, shorter than 8 characters,
 * or matches a known weak placeholder.
 */
export function isWeakOrEmptyApiToken(token: unknown): boolean {
  if (typeof token !== 'string') return true;
  const clean = token.trim();
  if (clean.length < 8) return true;
  return WEAK_API_TOKENS.has(clean.toLowerCase());
}

/**
 * Evaluates the GMAO_API_TOKEN security guard for incoming API requests.
 * - Production/Host mode: Rejects write requests (POST/PUT/DELETE) and strict API calls
 *   whenever GMAO_API_TOKEN is missing or weak, or when client header does not match.
 * - Development mode: Allows local work without a token (after startup warning),
 *   while still rejecting explicit mismatched tokens.
 */
export function evaluateServerApiTokenGuard(params: {
  method: string;
  providedToken: unknown;
  expectedToken: unknown;
  clientOrigin?: unknown;
  isProduction: boolean;
  strictTokenEnv?: unknown;
}): {
  allowed: boolean;
  statusCode?: number;
  error?: string;
  message?: string;
} {
  const method = String(params.method || 'GET').toUpperCase();
  const isWriteMethod = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);
  const rawExpected = typeof params.expectedToken === 'string' ? params.expectedToken.trim() : '';
  const rawProvided =
    typeof params.providedToken === 'string' ? params.providedToken.trim() : undefined;
  const isExpectedWeak = isWeakOrEmptyApiToken(rawExpected);

  // 1. In production, refuse write requests (and strict access) if server token is missing or weak
  if (params.isProduction && isExpectedWeak) {
    if (isWriteMethod) {
      return {
        allowed: false,
        statusCode: 401,
        error: 'Unauthorized',
        message:
          'Sécurité Production : GMAO_API_TOKEN est absent ou trop faible sur le serveur. Veuillez configurer un GMAO_API_TOKEN robuste dans l’environnement.',
      };
    }
  }

  // 2. If an expected token is configured and client explicitly sent a mismatched token header, reject immediately
  if (rawExpected && rawProvided !== undefined && rawProvided !== rawExpected) {
    return {
      allowed: false,
      statusCode: 401,
      error: 'Unauthorized',
      message: 'API Token invalide ou manquant.',
    };
  }

  const strictToken = params.isProduction || params.strictTokenEnv !== 'false';
  const tokenValid =
    (!params.isProduction && !rawExpected) ||
    (Boolean(rawExpected) && rawProvided === rawExpected && (!params.isProduction || !isExpectedWeak)) ||
    (!strictToken && params.clientOrigin === 'gmao-web-client');

  if (!tokenValid) {
    return {
      allowed: false,
      statusCode: 401,
      error: 'Unauthorized',
      message: 'API Token invalide ou manquant.',
    };
  }

  return { allowed: true };
}

