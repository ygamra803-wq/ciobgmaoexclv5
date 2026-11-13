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
  'workshopOrders',
  'needRequests',
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
  'needRequests',
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

export type ServerIdentityStatus = 'VERIFIED' | 'ARCHIVED' | 'UNKNOWN' | 'ANONYMOUS';

export interface ResolvedServerActor {
  claimedRole: string;
  effectiveRole: string;
  identityStatus: ServerIdentityStatus;
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

function readHeaderValue(headers: Record<string, unknown> | undefined, targetKey: string): string {
  if (!headers || typeof headers !== 'object') return '';
  const lowerTarget = targetKey.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== lowerTarget) continue;
    const raw = Array.isArray(value) ? value[0] : value;
    return typeof raw === 'string' ? raw.trim() : raw != null ? String(raw).trim() : '';
  }
  return '';
}

function isRecordArchived(record: any): boolean {
  if (!record || typeof record !== 'object') return false;
  const statut = String(record.statut || '').trim().toUpperCase();
  const status = String(record.status || '').trim().toUpperCase();
  return (
    record.is_active === false ||
    record.actif === false ||
    record.isActive === false ||
    statut === 'ARCHIVE' ||
    statut === 'ARCHIVEE' ||
    status === 'ARCHIVE' ||
    status === 'ARCHIVEE'
  );
}

/**
 * Resolves the effective server role strictly (Fail-Closed) by verifying `x-gmao-actor-id`
 * and `x-gmao-actor` against registered `dbUsers` and `dbTechnicians`.
 *
 * Security invariants (SEC-LAN-P0):
 *  - Missing or generic actor headers -> `VIEWER`, `identityStatus: 'ANONYMOUS'`.
 *  - Non-empty `actorId` is authoritative: if it fails to match any registered ID, we do NOT
 *    fall back to matching by display name (`actorName`), preventing impersonation.
 *  - Any unrecognized identity (including `ghost-99` or empty DB) -> ALWAYS downgraded to
 *    `VIEWER` with `identityStatus: 'UNKNOWN'` and `roleSpoofDetected: claimedRole !== 'VIEWER'`.
 *  - Archived/inactive users/technicians -> `VIEWER`, `identityStatus: 'ARCHIVED'`.
 *  - Active registered users/technicians -> clamped to `min(claimedRole, registeredRole)`
 *    (or `registeredRole` when valid) so claimed privilege can never exceed registry privilege.
 */
export function resolveEffectiveServerRole(
  headers: Record<string, unknown>,
  dbUsers: any[] = [],
  dbTechnicians: any[] = []
): ResolvedServerActor {
  const rawRole = readHeaderValue(headers, 'x-gmao-role');
  const claimedRole = normalizeServerRole(rawRole);
  const actorId = readHeaderValue(headers, 'x-gmao-actor-id');
  const actorName = readHeaderValue(headers, 'x-gmao-actor');

  const normId = actorId.toUpperCase();
  const normName = actorName.toUpperCase();

  const isIdGenericOrEmpty = normId.length === 0 || UNTRUSTED_GENERIC_ACTORS.has(normId);
  const isNameGenericOrEmpty = normName.length === 0 || UNTRUSTED_GENERIC_ACTORS.has(normName);

  // 1. Missing or purely generic identity -> ANONYMOUS / VIEWER (fail-closed)
  if (isIdGenericOrEmpty && isNameGenericOrEmpty) {
    return {
      claimedRole,
      effectiveRole: 'VIEWER',
      identityStatus: 'ANONYMOUS',
      actorName: actorName || 'web-operator',
      actorId,
      roleSpoofDetected: claimedRole !== 'VIEWER',
      isArchivedActor: false,
    };
  }

  const usersList = Array.isArray(dbUsers) ? dbUsers : [];
  const techList = Array.isArray(dbTechnicians) ? dbTechnicians : [];
  const matchByIdOnly = !isIdGenericOrEmpty;

  // 2. Lookup in registered users (ID match is authoritative if actorId was provided)
  const matchedUser = usersList.find((u: any) => {
    if (!u || typeof u !== 'object') return false;
    const candidateIds = [u.id, u.code, u.username, u.personnelId, u.id_operation, u.id_technician]
      .map((v) => String(v || '').trim().toUpperCase())
      .filter(Boolean);

    if (matchByIdOnly) {
      return candidateIds.includes(normId);
    }
    const candidateNames = [u.nom, u.name, u.username, u.personnelName]
      .map((v) => String(v || '').trim().toUpperCase())
      .filter(Boolean);
    return candidateNames.includes(normName);
  });

  if (matchedUser) {
    const resolvedDisplayName =
      actorName || String(matchedUser.nom || matchedUser.name || matchedUser.username || 'web-operator').trim();
    if (isRecordArchived(matchedUser)) {
      return {
        claimedRole,
        effectiveRole: 'VIEWER',
        identityStatus: 'ARCHIVED',
        actorName: resolvedDisplayName,
        actorId,
        roleSpoofDetected: claimedRole !== 'VIEWER',
        isArchivedActor: true,
      };
    }

    const registeredRole = normalizeServerRole(matchedUser.role);
    const claimedRank = ROLE_PRIVILEGE_RANK[claimedRole] ?? 0;
    const registeredRank = ROLE_PRIVILEGE_RANK[registeredRole] ?? 0;
    const roleSpoofDetected = claimedRank > registeredRank;
    const effectiveRole = roleSpoofDetected
      ? registeredRole
      : rawRole
      ? claimedRole
      : registeredRole;

    return {
      claimedRole,
      effectiveRole,
      identityStatus: 'VERIFIED',
      actorName: resolvedDisplayName,
      actorId,
      roleSpoofDetected,
      isArchivedActor: false,
    };
  }

  // 3. Lookup in registered technicians (defaults role to TECHNICIEN when record omits .role)
  const matchedTech = techList.find((t: any) => {
    if (!t || typeof t !== 'object') return false;
    const candidateIds = [t.id_technician, t.id, t.code, t.username]
      .map((v) => String(v || '').trim().toUpperCase())
      .filter(Boolean);

    if (matchByIdOnly) {
      return candidateIds.includes(normId);
    }
    const candidateNames = [t.nom, t.name]
      .map((v) => String(v || '').trim().toUpperCase())
      .filter(Boolean);
    return candidateNames.includes(normName);
  });

  if (matchedTech) {
    const resolvedDisplayName =
      actorName || String(matchedTech.nom || matchedTech.name || 'web-operator').trim();
    if (isRecordArchived(matchedTech)) {
      return {
        claimedRole,
        effectiveRole: 'VIEWER',
        identityStatus: 'ARCHIVED',
        actorName: resolvedDisplayName,
        actorId,
        roleSpoofDetected: claimedRole !== 'VIEWER',
        isArchivedActor: true,
      };
    }

    const techRole = matchedTech.role ? normalizeServerRole(matchedTech.role) : 'TECHNICIEN';
    const claimedRank = ROLE_PRIVILEGE_RANK[claimedRole] ?? 0;
    const techRank = ROLE_PRIVILEGE_RANK[techRole] ?? 2;
    const roleSpoofDetected = claimedRank > techRank;
    const effectiveRole = roleSpoofDetected
      ? techRole
      : rawRole
      ? claimedRole
      : techRole;

    return {
      claimedRole,
      effectiveRole,
      identityStatus: 'VERIFIED',
      actorName: resolvedDisplayName,
      actorId,
      roleSpoofDetected,
      isArchivedActor: false,
    };
  }

  // 4. Unmatched / unregistered identity -> strictly fail-closed to VIEWER + UNKNOWN
  return {
    claimedRole,
    effectiveRole: 'VIEWER',
    identityStatus: 'UNKNOWN',
    actorName: actorName || 'web-operator',
    actorId,
    roleSpoofDetected: claimedRole !== 'VIEWER',
    isArchivedActor: false,
  };
}

export const BOOTSTRAP_ALLOWED_ENTITIES = new Set<string>(['users', 'state']);

/**
 * Checks whether a socket remoteAddress belongs strictly to local loopback (localhost).
 */
export function isLoopbackRemoteAddress(remoteAddress: unknown): boolean {
  if (typeof remoteAddress !== 'string') return false;
  const clean = remoteAddress.trim().toLowerCase();
  return (
    clean === '127.0.0.1' ||
    clean === '::1' ||
    clean === '::ffff:127.0.0.1' ||
    clean === 'localhost'
  );
}

/**
 * Explicit Bootstrap Policy when BOTH `dbUsers` and `dbTechnicians` are empty (initial setup).
 *
 * Security rule:
 *  - Permanently disabled as soon as any user OR technician exists in server state.
 *  - Only permits `POST` to `/api/gmao/users` or `/api/gmao/state`.
 *  - Requires EITHER a valid strong `GMAO_API_TOKEN` OR a local loopback request
 *    (local host machine only — remote LAN clients without a strong token are rejected with 403).
 */
export function evaluateBootstrapWriteAllowance(params: {
  method: string;
  targetEntity: string;
  dbUsers: any[] | undefined;
  dbTechnicians: any[] | undefined;
  remoteAddress: unknown;
  providedToken: unknown;
  expectedToken: unknown;
  isProduction: boolean;
}): { allowed: boolean; reason?: string } {
  const usersCount = Array.isArray(params.dbUsers) ? params.dbUsers.length : 0;
  const techCount = Array.isArray(params.dbTechnicians) ? params.dbTechnicians.length : 0;

  if (usersCount > 0 || techCount > 0) {
    return {
      allowed: false,
      reason: 'Bootstrap disabled: user/technician registry is already initialized.',
    };
  }

  const httpMethod = String(params.method || 'GET').toUpperCase();
  if (httpMethod !== 'POST' || !BOOTSTRAP_ALLOWED_ENTITIES.has(params.targetEntity)) {
    return {
      allowed: false,
      reason: `Bootstrap mode only allows POST on 'users' or 'state' (blocked ${httpMethod} on '${params.targetEntity || 'unknown'}').`,
    };
  }

  const rawExpected = typeof params.expectedToken === 'string' ? params.expectedToken.trim() : '';
  const rawProvided = typeof params.providedToken === 'string' ? params.providedToken.trim() : '';
  const hasValidStrongToken =
    !isWeakOrEmptyApiToken(rawExpected) && rawProvided === rawExpected;

  if (hasValidStrongToken) {
    return { allowed: true };
  }

  if (!params.isProduction && isLoopbackRemoteAddress(params.remoteAddress)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason:
      'Bootstrap rejected: initial setup requires either local loopback access (dev) or a valid strong GMAO_API_TOKEN.',
  };
}

/**
 * Validates incoming `Origin` header against explicit allowlist, loopback origins,
 * and the host server's own LAN IPv4 addresses on allowed ports.
 */
export function isAllowedCorsOrigin(
  origin: string | undefined,
  extraAllowedOrigins: Set<string>,
  serverHostIps: Set<string>,
  serverPort: number
): boolean {
  if (!origin) return true; // Same-origin or non-browser client without Origin header
  const cleanOrigin = origin.trim();
  if (!cleanOrigin || cleanOrigin === 'null') return false;

  if (extraAllowedOrigins.has(cleanOrigin)) return true;

  try {
    const parsed = new URL(cleanOrigin);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    const portNum = parsed.port
      ? Number(parsed.port)
      : parsed.protocol === 'https:'
      ? 443
      : 80;

    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return true;
    }

    const allowedPorts = new Set<number>([serverPort, 3000, 5173, 80, 443]);
    if (serverHostIps.has(hostname) && allowedPorts.has(portNum)) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
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

