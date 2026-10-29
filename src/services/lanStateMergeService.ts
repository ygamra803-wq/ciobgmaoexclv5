/**
 * Smart Entity & State Merge Service for Multi-Device LAN Synchronization.
 * Prevents "Lost Updates" (Full-Array Overwrite) when Mobile Technicians,
 * Mobile Supervisors, Storekeepers, and Desktop Admins sync concurrently.
 */

export interface MergeCollectionOptions {
  /**
   * When true (default for cross-version / multi-device sync), records that exist
   * on the server but are missing from the incoming client array are preserved
   * rather than wiped out.
   */
  preserveServerOnlyItems?: boolean;
  /**
   * Explicit list of record IDs intentionally deleted by the client.
   */
  deletedIds?: string[];
  /**
   * When true, incoming payload completely replaces the server collection (used for Factory Reset).
   */
  replaceAll?: boolean;
}

export interface MergeStateOptions {
  preserveServerOnlyItems?: boolean;
  replaceAll?: boolean;
  deletedIdsByEntity?: Record<string, string[]>;
}

/**
 * Extracts a deterministic primary key for any GMAO entity record.
 */
export function getEntityRecordId(entity: string, item: any): string {
  if (!item || typeof item !== 'object') return '';

  if (entity === 'machines') {
    const k = item.id || item.id_machine_registered || item.id_machine || item.code;
    if (k !== undefined && k !== null && String(k).trim() !== '') {
      return String(k).trim().toUpperCase();
    }
  }

  if (entity === 'rawStock' || entity === 'stock' || entity === 'designations') {
    const k = item.id || item.ref || item.code;
    if (k !== undefined && k !== null && String(k).trim() !== '') {
      return String(k).trim().toUpperCase();
    }
  }

  if (entity === 'mouvements') {
    if (item.id !== undefined && item.id !== null && String(item.id).trim() !== '') {
      return String(item.id).trim();
    }
    const bon = String(item.code_bon || item.num_bon_saisi_par_tech || '').trim().toUpperCase();
    const ref = String(item.ref || item.code_article || item.reference || '').trim().toUpperCase();
    const type = String(item.type || '').trim().toUpperCase();
    const date = String(item.date || item.created_at || '').trim();
    if (bon || ref) {
      return `MVT::${bon}::${ref}::${type}::${date}`;
    }
  }

  const candidate =
    item.id ??
    item.id_machine_registered ??
    item.id_task ??
    item.id_execution ??
    item.id_demand ??
    item.code_bon ??
    item.id_technician ??
    item.id_operation ??
    item.id_zone ??
    item.code_zone ??
    item.id_family ??
    item.id_template ??
    item.id_blueprint ??
    item.id_general_system_type ??
    item.id_action ??
    item.id_guide ??
    item.ref ??
    item.code;

  if (candidate !== undefined && candidate !== null && String(candidate).trim() !== '') {
    return String(candidate).trim();
  }

  return '';
}

/**
 * Extracts the latest modification or lifecycle timestamp (in ms) from a record.
 */
export function getRecordTimestampMs(item: any): number {
  if (!item || typeof item !== 'object') return 0;

  const dateFields = [
    item.updated_at,
    item.updatedAt,
    item.validated_at,
    item.validatedAt,
    item.reviewed_at,
    item.reviewedAt,
    item.cloture_at,
    item.clotureAt,
    item.date_retour,
    item.submitted_at,
    item.submittedAt,
    item.completedAt,
    item.completed_at,
    item.started_at,
    item.created_at,
    item.createdAt,
    item.timestamp,
    item.date_execution,
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
export function getRecordLifecycleRank(item: any): number {
  if (!item || typeof item !== 'object') return 0;
  let rank = 0;

  const status = String(item.statut || item.status || item.etat || '').trim().toUpperCase();
  if (status === 'CLOTURE' || status === 'CLÔTURÉ' || status === 'TERMINE' || status === 'TERMINÉ' || status === 'MONTE' || status === 'MONTÉ') {
    rank += 50;
  } else if (status === 'RETOURNE' || status === 'RETOURNÉ') {
    rank += 40;
  } else if (status === 'EN_COURS' || status === 'EN COURS' || status === 'EN REPARATION EXTERNE' || status === 'EN RÉPARATION EXTERNE') {
    rank += 25;
  } else if (status === 'EN_ATTENTE_PDR') {
    rank += 20;
  } else if (status === 'DEMANDE' || status === 'A FAIRE' || status === 'À FAIRE' || status === 'EN RETARD') {
    rank += 10;
  }

  const valStatus = String(item.validation_status || item.validationStatus || '').trim().toUpperCase();
  if (valStatus === 'APPROVED') {
    rank += 45;
  } else if (valStatus === 'REJECTED') {
    rank += 35;
  } else if (valStatus === 'NEEDS_CLARIFICATION') {
    rank += 30;
  } else if (valStatus === 'PENDING_VALIDATION' || valStatus === 'PENDING') {
    rank += 20;
  }

  if (item.stock_deducted === true) {
    rank += 10;
  }

  return rank;
}

/**
 * Merges two versions of the same record using timestamp priority and Maker-Checker lifecycle rank.
 */
export function mergeSingleRecord(serverItem: any, incomingItem: any): any {
  if (!serverItem || typeof serverItem !== 'object') return incomingItem;
  if (!incomingItem || typeof incomingItem !== 'object') return serverItem;

  const serverTime = getRecordTimestampMs(serverItem);
  const incomingTime = getRecordTimestampMs(incomingItem);

  if (incomingTime > 0 && serverTime > 0 && incomingTime !== serverTime) {
    if (incomingTime > serverTime) {
      return { ...serverItem, ...incomingItem };
    }
    return { ...incomingItem, ...serverItem };
  }

  const serverRank = getRecordLifecycleRank(serverItem);
  const incomingRank = getRecordLifecycleRank(incomingItem);

  if (serverRank > incomingRank) {
    return { ...incomingItem, ...serverItem };
  }

  return { ...serverItem, ...incomingItem };
}

/**
 * Merges an entity collection by primary key without losing concurrent records from other devices.
 */
export function mergeEntityCollection(
  entity: string,
  serverList: any[],
  incomingList: any[],
  options: MergeCollectionOptions = {}
): any[] {
  if (!Array.isArray(incomingList)) {
    return Array.isArray(serverList) ? serverList : [];
  }
  if (options.replaceAll === true || !Array.isArray(serverList) || serverList.length === 0) {
    return incomingList;
  }

  const preserveServerOnly = options.preserveServerOnlyItems !== false;
  const deletedSet = new Set(
    (options.deletedIds || []).map((id) => String(id).trim()).filter(Boolean)
  );

  const serverMap = new Map<string, any>();
  const unkeyedServerItems: any[] = [];

  for (const sItem of serverList) {
    const key = getEntityRecordId(entity, sItem);
    if (key) {
      serverMap.set(key, sItem);
    } else {
      unkeyedServerItems.push(sItem);
    }
  }

  const seenKeys = new Set<string>();
  const mergedResult: any[] = [];

  for (const incItem of incomingList) {
    const key = getEntityRecordId(entity, incItem);
    if (!key) {
      mergedResult.push(incItem);
      continue;
    }
    if (deletedSet.has(key)) {
      continue;
    }
    seenKeys.add(key);
    const existingServerItem = serverMap.get(key);
    if (existingServerItem) {
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
  }

  return mergedResult;
}

/**
 * Merges a full incoming GMAO state payload into the server's dbState.
 */
export function mergeGmaoStateSnapshot(
  serverState: Record<string, any>,
  incomingState: Record<string, any>,
  allowedEntities: readonly string[],
  objectEntitySet: Set<string>,
  options: MergeStateOptions = {}
): { acceptedKeys: string[]; mergedCount: number } {
  const acceptedKeys: string[] = [];
  let mergedCount = 0;
  const replaceAll = options.replaceAll === true || incomingState?.replaceAll === true;
  const preserveServerOnly = !replaceAll && options.preserveServerOnlyItems !== false;
  const deletedByEntity = options.deletedIdsByEntity || incomingState?.deletedIdsByEntity || {};

  for (const key of allowedEntities) {
    if (!Object.prototype.hasOwnProperty.call(incomingState, key)) continue;
    const val = incomingState[key];

    if (objectEntitySet.has(key)) {
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        if (replaceAll || !preserveServerOnly) {
          serverState[key] = val;
        } else {
          serverState[key] = { ...(serverState[key] || {}), ...val };
        }
        acceptedKeys.push(key);
      }
    } else if (Array.isArray(val)) {
      const currentServerList = Array.isArray(serverState[key]) ? serverState[key] : [];
      const mergedList = mergeEntityCollection(key, currentServerList, val, {
        replaceAll,
        preserveServerOnlyItems: preserveServerOnly,
        deletedIds: Array.isArray(deletedByEntity[key]) ? deletedByEntity[key] : undefined,
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
