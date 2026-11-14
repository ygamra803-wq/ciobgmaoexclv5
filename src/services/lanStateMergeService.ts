/**
 * Smart Entity & State Merge Service for Multi-Device LAN Synchronization.
 * Prevents "Lost Updates" (Full-Array Overwrite) when Mobile Technicians,
 * Mobile Supervisors, Storekeepers, and Desktop Admins sync concurrently.
 */

export type LanRecordObject = Record<string, unknown>;

export interface MergeCollectionOptions {
  /**
   * When true (default for cross-version / multi-device sync), records that exist
   * on the server but are missing from the incoming client array are preserved
   * rather than wiped out.
   */
  preserveServerOnlyItems?: boolean;
  /** Alias for preserveServerOnlyItems for backward compatibility. */
  preserveServerOnly?: boolean;
  /** Explicit list of record IDs intentionally deleted by the client. */
  deletedIds?: string[];
  /** When true, incoming payload completely replaces the server collection (used for Factory Reset). */
  replaceAll?: boolean;
}

export interface MergeStateOptions {
  preserveServerOnlyItems?: boolean;
  replaceAll?: boolean;
  deletedIdsByEntity?: Record<string, string[]>;
}

function asRecordObject(value: unknown): LanRecordObject | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as LanRecordObject)
    : null;
}

/**
 * Extracts a deterministic primary key for any GMAO entity record (`machines`, `rawStock`, `mouvements`, etc.).
 */
export function getEntityRecordId(entity: string, item: unknown): string {
  if (typeof item === 'string' || typeof item === 'number') {
    return String(item).trim();
  }
  const obj = asRecordObject(item);
  if (!obj) return '';

  if (entity === 'machines') {
    const k = obj.id || obj.id_machine_registered || obj.id_machine || obj.code;
    if (k !== undefined && k !== null && String(k).trim() !== '') {
      return String(k).trim().toUpperCase();
    }
  }

  if (entity === 'rawStock' || entity === 'stock' || entity === 'designations') {
    const k = obj.id || obj.ref || obj.code;
    if (k !== undefined && k !== null && String(k).trim() !== '') {
      return String(k).trim().toUpperCase();
    }
  }

  if (entity === 'mouvements') {
    if (obj.id !== undefined && obj.id !== null && String(obj.id).trim() !== '') {
      return String(obj.id).trim();
    }
    const bon = String(obj.code_bon || obj.num_bon_saisi_par_tech || '').trim().toUpperCase();
    const ref = String(obj.ref || obj.code_article || obj.reference || '').trim().toUpperCase();
    const type = String(obj.type || '').trim().toUpperCase();
    const date = String(obj.date || obj.created_at || '').trim();
    if (bon || ref) {
      return `MVT::${bon}::${ref}::${type}::${date}`;
    }
  }

  const candidate =
    obj.id ??
    obj.id_machine_registered ??
    obj.id_task ??
    obj.id_execution ??
    obj.id_demand ??
    obj.code_bon ??
    obj.id_technician ??
    obj.id_operation ??
    obj.id_zone ??
    obj.code_zone ??
    obj.id_family ??
    obj.id_template ??
    obj.id_blueprint ??
    obj.id_general_system_type ??
    obj.id_action ??
    obj.id_guide ??
    obj.ref ??
    obj.code;

  if (candidate !== undefined && candidate !== null && String(candidate).trim() !== '') {
    return String(candidate).trim();
  }

  return '';
}

/**
 * Extracts the latest modification or lifecycle timestamp (in ms) from a record.
 */
export function getRecordTimestampMs(item: unknown): number {
  const obj = asRecordObject(item);
  if (!obj) return 0;

  const dateFields = [
    obj.updated_at,
    obj.updatedAt,
    obj.validated_at,
    obj.validatedAt,
    obj.reviewed_at,
    obj.reviewedAt,
    obj.cloture_at,
    obj.clotureAt,
    obj.date_retour,
    obj.submitted_at,
    obj.submittedAt,
    obj.completedAt,
    obj.completed_at,
    obj.started_at,
    obj.created_at,
    obj.createdAt,
    obj.timestamp,
    obj.date_execution,
  ];

  let maxMs = 0;
  for (const raw of dateFields) {
    if (!raw) continue;
    const parsed = typeof raw === 'number' ? raw : Date.parse(String(raw));
    if (Number.isFinite(parsed) && parsed > maxMs) {
      maxMs = parsed;
    }
  }
  return maxMs;
}

/**
 * Computes a domain lifecycle progression rank for Maker-Checker & WorkOrder entities.
 * Ensures that an approved or closed record is not accidentally regressed by a stale snapshot
 * lacking explicit timestamps.
 */
export function getRecordLifecycleRank(item: unknown): number {
  const obj = asRecordObject(item);
  if (!obj) return 0;
  let rank = 0;

  const status = String(obj.statut || obj.status || obj.etat || '').trim().toUpperCase();
  if (
    status === 'CLOTURE' ||
    status === 'CLÔTURÉ' ||
    status === 'TERMINE' ||
    status === 'TERMINÉ' ||
    status === 'MONTE' ||
    status === 'MONTÉ'
  ) {
    rank += 50;
  } else if (status === 'RETOURNE' || status === 'RETOURNÉ') {
    rank += 40;
  } else if (
    status === 'EN_COURS' ||
    status === 'EN COURS' ||
    status === 'EN REPARATION EXTERNE' ||
    status === 'EN RÉPARATION EXTERNE'
  ) {
    rank += 25;
  } else if (status === 'EN_ATTENTE_PDR') {
    rank += 20;
  } else if (status === 'DEMANDE' || status === 'A FAIRE' || status === 'À FAIRE' || status === 'EN RETARD') {
    rank += 10;
  }

  const valStatus = String(obj.validation_status || obj.validationStatus || '').trim().toUpperCase();
  if (valStatus === 'APPROVED') {
    rank += 45;
  } else if (valStatus === 'REJECTED') {
    rank += 35;
  } else if (valStatus === 'NEEDS_CLARIFICATION') {
    rank += 30;
  } else if (valStatus === 'PENDING_VALIDATION' || valStatus === 'PENDING') {
    rank += 20;
  }

  if (obj.stock_deducted === true) {
    rank += 10;
  }

  return rank;
}

function isTerminalOrApprovedRecord(item: unknown): boolean {
  const obj = asRecordObject(item);
  if (!obj) return false;
  const valStatus = String(obj.validation_status || obj.validationStatus || '').trim().toUpperCase();
  const status = String(obj.statut || obj.status || obj.etat || '').trim().toUpperCase();
  return (
    valStatus === 'APPROVED' ||
    status === 'CLOTURE' ||
    status === 'CLÔTURÉ' ||
    obj.stock_deducted === true
  );
}

function isPendingOrOpenDraftRecord(item: unknown): boolean {
  const obj = asRecordObject(item);
  if (!obj) return false;
  if (isTerminalOrApprovedRecord(obj)) return false;
  const valStatus = String(obj.validation_status || obj.validationStatus || '').trim().toUpperCase();
  const status = String(obj.statut || obj.status || obj.etat || '').trim().toUpperCase();
  return (
    valStatus === 'PENDING_VALIDATION' ||
    valStatus === 'PENDING' ||
    valStatus === 'NONE' ||
    status === 'DEMANDE' ||
    status === 'EN_COURS' ||
    status === 'EN COURS' ||
    status === 'A FAIRE' ||
    status === 'À FAIRE' ||
    status === 'EN RETARD'
  );
}

/**
 * Merges two versions of the same record using Maker-Checker lifecycle protection and timestamp priority.
 * Never allows a pending/open draft to downgrade an already APPROVED/CLOTURE/stock_deducted record,
 * even if the draft carries a newer client timestamp due to clock skew or offline touch.
 * Also preserves server-side `passwordHash` credentials stripped from redacted client projections.
 */
export function mergeSingleRecord<TServer = LanRecordObject, TIncoming = TServer>(
  serverItem: TServer,
  incomingItem: TIncoming
): TServer & TIncoming {
  const serverObj = asRecordObject(serverItem);
  const incomingObj = asRecordObject(incomingItem);
  if (!serverObj) return incomingItem as unknown as TServer & TIncoming;
  if (!incomingObj) return serverItem as unknown as TServer & TIncoming;

  const preserveAuthHash = (merged: LanRecordObject): TServer & TIncoming => {
    const serverHash = serverObj.passwordHash;
    const mergedHash = merged.passwordHash;
    if (
      typeof serverHash === 'string' &&
      serverHash.trim().length > 0 &&
      (!mergedHash || typeof mergedHash !== 'string' || !mergedHash.trim())
    ) {
      return { ...merged, passwordHash: serverHash } as unknown as TServer & TIncoming;
    }
    return merged as unknown as TServer & TIncoming;
  };

  // A1.6 Lifecycle Guard: Never regress an APPROVED/CLOTURE record back to a PENDING/open copy
  if (isTerminalOrApprovedRecord(serverObj) && isPendingOrOpenDraftRecord(incomingObj)) {
    return preserveAuthHash({ ...incomingObj, ...serverObj });
  }
  if (isTerminalOrApprovedRecord(incomingObj) && isPendingOrOpenDraftRecord(serverObj)) {
    return preserveAuthHash({ ...serverObj, ...incomingObj });
  }

  const serverTime = getRecordTimestampMs(serverObj);
  const incomingTime = getRecordTimestampMs(incomingObj);

  if (incomingTime > 0 && serverTime > 0 && incomingTime !== serverTime) {
    if (incomingTime > serverTime) {
      return preserveAuthHash({ ...serverObj, ...incomingObj });
    }
    return preserveAuthHash({ ...incomingObj, ...serverObj });
  }

  const serverRank = getRecordLifecycleRank(serverObj);
  const incomingRank = getRecordLifecycleRank(incomingObj);

  if (serverRank > incomingRank) {
    return preserveAuthHash({ ...incomingObj, ...serverObj });
  }

  return preserveAuthHash({ ...serverObj, ...incomingObj });
}

function serializeUnkeyedItem(item: unknown): string {
  try {
    return JSON.stringify(item);
  } catch {
    return String(item);
  }
}

/**
 * Merges an entity collection by primary key without losing concurrent records from other devices.
 * Unkeyed server records (records without an extractable primary key) are also preserved
 * (deduplicated by content signature) when `preserveServerOnlyItems` is active.
 */
export function mergeEntityCollection<T = unknown>(
  entity: string,
  serverList: T[],
  incomingList: T[],
  options: MergeCollectionOptions = {}
): T[] {
  if (!Array.isArray(incomingList)) {
    return Array.isArray(serverList) ? serverList : [];
  }
  if (options.replaceAll === true || !Array.isArray(serverList) || serverList.length === 0) {
    return incomingList;
  }

  const preserveServerOnly =
    options.preserveServerOnlyItems !== false && options.preserveServerOnly !== false;
  const deletedSet = new Set(
    (options.deletedIds || []).map((id) => String(id).trim()).filter(Boolean)
  );

  const serverMap = new Map<string, T>();
  const unkeyedServerItems: T[] = [];

  for (const sItem of serverList) {
    const key = getEntityRecordId(entity, sItem);
    if (key) {
      serverMap.set(key, sItem);
    } else if (sItem !== null && sItem !== undefined) {
      unkeyedServerItems.push(sItem);
    }
  }

  const seenKeys = new Set<string>();
  const seenUnkeyedSignatures = new Set<string>();
  const mergedResult: T[] = [];

  for (const incItem of incomingList) {
    const key = getEntityRecordId(entity, incItem);
    if (!key) {
      seenUnkeyedSignatures.add(serializeUnkeyedItem(incItem));
      mergedResult.push(incItem);
      continue;
    }
    if (deletedSet.has(key)) {
      continue;
    }
    seenKeys.add(key);
    const existingServerItem = serverMap.get(key);
    if (existingServerItem !== undefined) {
      mergedResult.push(mergeSingleRecord(existingServerItem, incItem));
    } else {
      mergedResult.push(incItem);
    }
  }

  if (preserveServerOnly) {
    for (const [key, sItem] of serverMap.entries()) {
      if (!seenKeys.has(key) && !deletedSet.has(key)) {
        mergedResult.push(sItem);
      }
    }
    for (const unkeyedItem of unkeyedServerItems) {
      const sig = serializeUnkeyedItem(unkeyedItem);
      if (!seenUnkeyedSignatures.has(sig)) {
        seenUnkeyedSignatures.add(sig);
        mergedResult.push(unkeyedItem);
      }
    }
  }

  return mergedResult;
}

/**
 * Merges a full incoming GMAO state payload into the server's `dbState`, honoring
 * `allowedEntities`, object-map vs collection merging, `deletedIdsByEntity`, and `rawStock <-> stock` mirror sync.
 */
export function mergeGmaoStateSnapshot(
  serverState: LanRecordObject,
  incomingState: LanRecordObject,
  allowedEntities: readonly string[],
  objectEntitySet: Set<string>,
  options: MergeStateOptions = {}
): { acceptedKeys: string[]; mergedCount: number } {
  const acceptedKeys: string[] = [];
  let mergedCount = 0;
  const replaceAll = options.replaceAll === true || incomingState?.replaceAll === true;
  const preserveServerOnly = !replaceAll && options.preserveServerOnlyItems !== false;
  const rawDeletedMap = options.deletedIdsByEntity || asRecordObject(incomingState?.deletedIdsByEntity) || {};

  for (const key of allowedEntities) {
    if (!Object.prototype.hasOwnProperty.call(incomingState, key)) continue;
    const val = incomingState[key];

    if (objectEntitySet.has(key)) {
      const valObj = asRecordObject(val);
      if (valObj) {
        if (replaceAll || !preserveServerOnly) {
          serverState[key] = valObj;
        } else {
          serverState[key] = { ...(asRecordObject(serverState[key]) || {}), ...valObj };
        }
        acceptedKeys.push(key);
      }
    } else if (Array.isArray(val)) {
      const currentServerList = Array.isArray(serverState[key]) ? (serverState[key] as unknown[]) : [];
      const entityDeleted = rawDeletedMap[key];
      const mergedList = mergeEntityCollection(key, currentServerList, val as unknown[], {
        replaceAll,
        preserveServerOnlyItems: preserveServerOnly,
        deletedIds: Array.isArray(entityDeleted) ? entityDeleted.map((id) => String(id)) : undefined,
      });
      serverState[key] = mergedList;
      acceptedKeys.push(key);
      mergedCount += mergedList.length;
    }
  }

  if (acceptedKeys.includes('rawStock') && !acceptedKeys.includes('stock')) {
    serverState.stock = serverState.rawStock;
  } else if (acceptedKeys.includes('stock') && !acceptedKeys.includes('rawStock')) {
    serverState.rawStock = serverState.stock;
  }

  return { acceptedKeys, mergedCount };
}
