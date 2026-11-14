import type express from 'express';
import { mergeEntityCollection, mergeGmaoStateSnapshot } from '../../services/lanStateMergeService';
import {
  clampMakerCheckerCollectionForRole,
  clampMakerCheckerRecordForRole,
  isRegistryInitialized,
  normalizeServerRole,
  resolveEffectiveServerRole,
  sanitizeBulkStateForRole,
} from '../../core/security/serverRbacPolicy';
import {
  sanitizeStateSnapshotForTransport,
  stripSensitiveAccountFields,
} from '../../core/security/serverSession';
import { readRecentAuditEntries } from '../auditLogReader';
import { validateProjectedStockInvariant } from '../stockInvariantGuard';
import {
  ALLOWED_ENTITIES,
  ALLOWED_ENTITY_SET,
  OBJECT_ENTITY_SET,
  type AuditWriteContext,
  type GmaoApiRequest,
  type GmaoDbState,
  type ServerRecord,
} from '../types';

function toErrorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

function getArraySlice(state: GmaoDbState, key: string): ServerRecord[] {
  const val = state[key];
  return Array.isArray(val) ? (val as ServerRecord[]) : [];
}

function isObjectRecord(value: unknown): value is ServerRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function matchesEntityId(item: unknown, targetId: string): boolean {
  if (!isObjectRecord(item)) return false;
  return (
    String(item.id) === targetId ||
    String(item.code) === targetId ||
    String(item.ref) === targetId
  );
}

/**
 * Mounts GMAO data synchronization, audit log reading, and allowlisted entity CRUD routes:
 *  - `GET /api/gmao/audit`
 *  - `GET /api/gmao/state` & `POST /api/gmao/state`
 *  - `GET / POST / PUT / DELETE /api/gmao/:entity(/:id)`
 *
 * All stock-affecting mutations (`POST`, `PUT`, and `DELETE` on `mouvements`, `rawStock`, `stock`)
 * validate `validateProjectedStockInvariant` atomically and roll back with `409 Conflict`
 * (`STOCK_NEGATIVE_PREVENTED`) whenever an operation would drive projected stock below zero.
 */
export function mountEntityAndStateRoutes(
  app: express.Application,
  deps: {
    dbState: GmaoDbState;
    auditFile: string;
    persistState: (auditContext?: AuditWriteContext, rollbackState?: () => void) => Promise<void>;
  }
): void {
  const { dbState, auditFile, persistState } = deps;

  const resolveActor = (req: express.Request): string => {
    const gmaoReq = req as GmaoApiRequest;
    const resolved = gmaoReq.resolvedServerActor;
    if (resolved?.identityStatus === 'VERIFIED' && resolved.actorName) {
      return (resolved.actorId ? `${resolved.actorName} (${resolved.actorId})` : resolved.actorName).slice(
        0,
        120
      );
    }
    const headerActor = req.headers['x-gmao-actor'];
    if (typeof headerActor === 'string' && headerActor.trim().length > 0) {
      return headerActor.trim().slice(0, 120);
    }
    return 'web-operator';
  };

  const requireAllowedEntity: express.RequestHandler = (req, res, next) => {
    const entity = String(req.params.entity || '');
    if (!ALLOWED_ENTITY_SET.has(entity)) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: `Entity '${entity}' is not allowed.`,
      });
    }
    return next();
  };

  const parseOptionalExpectedVersion = (req: express.Request): number | undefined => {
    const rawIfMatch = req.headers['if-match'];
    const rawQuery = req.query?.expectedVersion;
    const candidate =
      typeof rawIfMatch === 'string' && rawIfMatch.trim()
        ? rawIfMatch
        : typeof rawQuery === 'string' && rawQuery.trim()
        ? rawQuery
        : '';
    if (!candidate) return undefined;
    const num = Number(candidate.replace(/[^\d]/g, ''));
    return Number.isFinite(num) && num >= 1 ? num : undefined;
  };

  const canRoleForceReplaceEntity = (req: GmaoApiRequest): boolean => {
    if (req.isBootstrapAuthorized === true) return true;
    const role = normalizeServerRole(req.resolvedServerActor?.effectiveRole);
    return role === 'ADMIN' || role === 'RESPONSABLE_MAINTENANCE';
  };

  // Bounded O(1) tail read of server-side audit log
  app.get('/api/gmao/audit', async (req, res) => {
    try {
      const limitParam = Number(req.query.limit) || 100;
      const limit = Math.min(Math.max(1, limitParam), 500);
      const recent = await readRecentAuditEntries(auditFile, limit);
      return res.json({ success: true, data: recent });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: toErrorMessage(err, 'Failed to read audit log'),
      });
    }
  });

  app.get('/api/gmao/state', (req, res) => {
    const gmaoReq = req as GmaoApiRequest;
    res.setHeader('ETag', `W/"v${dbState.version}"`);
    const sessionVerified = Boolean(gmaoReq.resolvedServerActor?.sessionVerified);
    const registryReady = isRegistryInitialized(
      getArraySlice(dbState, 'users'),
      getArraySlice(dbState, 'technicians'),
      getArraySlice(dbState, 'authAccounts')
    );
    res.json({
      success: true,
      version: dbState.version,
      updatedAt: dbState.updatedAt,
      data: sanitizeStateSnapshotForTransport(dbState, {
        includeProtectedCollections: sessionVerified || !registryReady,
      }),
    });
  });

  app.post('/api/gmao/state', async (req, res) => {
    const gmaoReq = req as GmaoApiRequest;
    try {
      const incomingState: unknown = req.body;
      if (!isObjectRecord(incomingState)) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Invalid state payload: body must be a JSON object.',
        });
      }

      const isBootstrapAuthorized = gmaoReq.isBootstrapAuthorized === true;
      const resolvedActor =
        gmaoReq.resolvedServerActor ||
        resolveEffectiveServerRole(
          req.headers as Record<string, unknown>,
          getArraySlice(dbState, 'users'),
          getArraySlice(dbState, 'technicians'),
          getArraySlice(dbState, 'authAccounts')
        );

      if (!isBootstrapAuthorized && resolvedActor.identityStatus !== 'VERIFIED') {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'Unverified or inactive actor cannot modify server state.',
        });
      }

      const callerRole = normalizeServerRole(resolvedActor.effectiveRole);
      const canForceOverwrite =
        isBootstrapAuthorized || callerRole === 'ADMIN' || callerRole === 'RESPONSABLE_MAINTENANCE';

      if (incomingState.force === true && !canForceOverwrite) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: `Role '${callerRole}' is not authorized to force-overwrite server state conflicts.`,
        });
      }

      const expectedVersion =
        typeof incomingState.expectedVersion === 'number'
          ? incomingState.expectedVersion
          : req.headers['if-match']
          ? Number(String(req.headers['if-match']).replace(/[^\d]/g, ''))
          : undefined;

      const serverHasData = ALLOWED_ENTITIES.some((k) => {
        const val = dbState[k];
        return Array.isArray(val) ? val.length > 0 : isObjectRecord(val) ? Object.keys(val).length > 0 : false;
      });

      const isSmartMergeRequest = incomingState.merge === true;

      if (
        expectedVersion !== undefined &&
        !Number.isNaN(expectedVersion) &&
        incomingState.force !== true &&
        !isSmartMergeRequest &&
        serverHasData &&
        expectedVersion < dbState.version
      ) {
        return res.status(409).json({
          success: false,
          error: 'Conflict',
          message: `Server state version (${dbState.version}) is newer than client expectedVersion (${expectedVersion}).`,
          version: dbState.version,
          updatedAt: dbState.updatedAt,
          data: sanitizeStateSnapshotForTransport(dbState, {
            includeProtectedCollections: canForceOverwrite,
          }),
        });
      }

      let effectiveIncomingState: ServerRecord = incomingState;
      if (!isBootstrapAuthorized) {
        const bulkCheck = sanitizeBulkStateForRole(
          resolvedActor.effectiveRole,
          incomingState,
          dbState
        );
        if (!bulkCheck.allowed) {
          return res.status(403).json({
            success: false,
            error: 'Forbidden',
            message: bulkCheck.reason || 'Role not authorized for this state operation.',
          });
        }
        effectiveIncomingState = bulkCheck.sanitizedState;
      }

      const baseVersionMatches =
        expectedVersion !== undefined &&
        !Number.isNaN(expectedVersion) &&
        expectedVersion === dbState.version;

      const preserveServerOnlyItems =
        effectiveIncomingState.replaceAll === true
          ? false
          : isSmartMergeRequest
          ? true
          : !baseVersionMatches;

      const prevSnapshot: Record<string, unknown> = {};
      for (const k of ALLOWED_ENTITIES) {
        if (Object.prototype.hasOwnProperty.call(effectiveIncomingState, k)) {
          const val = dbState[k];
          prevSnapshot[k] = Array.isArray(val)
            ? [...val]
            : { ...(isObjectRecord(val) ? val : {}) };
        }
      }
      if (
        Object.prototype.hasOwnProperty.call(prevSnapshot, 'rawStock') &&
        !Object.prototype.hasOwnProperty.call(prevSnapshot, 'stock')
      ) {
        prevSnapshot.stock = [...getArraySlice(dbState, 'stock')];
      } else if (
        Object.prototype.hasOwnProperty.call(prevSnapshot, 'stock') &&
        !Object.prototype.hasOwnProperty.call(prevSnapshot, 'rawStock')
      ) {
        prevSnapshot.rawStock = [...getArraySlice(dbState, 'rawStock')];
      }

      const prevRawStockForGuard = getArraySlice(dbState, 'rawStock');
      const prevMouvementsForGuard = getArraySlice(dbState, 'mouvements');

      const rawDeletedMap = effectiveIncomingState.deletedIdsByEntity;
      const normalizedDeletedIdsByEntity: Record<string, string[]> | undefined = isObjectRecord(
        rawDeletedMap
      )
        ? Object.fromEntries(
            Object.entries(rawDeletedMap)
              .filter(([, ids]) => Array.isArray(ids))
              .map(([k, ids]) => [k, (ids as unknown[]).map((id) => String(id))])
          )
        : undefined;

      const { acceptedKeys } = mergeGmaoStateSnapshot(
        dbState,
        effectiveIncomingState,
        ALLOWED_ENTITIES,
        OBJECT_ENTITY_SET,
        {
          replaceAll: effectiveIncomingState.replaceAll === true,
          preserveServerOnlyItems,
          deletedIdsByEntity: normalizedDeletedIdsByEntity,
        }
      );

      const rollbackSnapshot = () => {
        for (const [k, v] of Object.entries(prevSnapshot)) {
          dbState[k] = v;
        }
      };

      if (
        acceptedKeys.includes('mouvements') ||
        acceptedKeys.includes('rawStock') ||
        acceptedKeys.includes('stock')
      ) {
        const stockGuard = validateProjectedStockInvariant({
          previousRawStock: prevRawStockForGuard,
          previousMouvements: prevMouvementsForGuard,
          nextRawStock: getArraySlice(dbState, 'rawStock'),
          nextMouvements: getArraySlice(dbState, 'mouvements'),
          bypassForAdminForce:
            effectiveIncomingState.replaceAll === true ||
            (effectiveIncomingState.force === true && canForceOverwrite),
        });

        if (!stockGuard.valid) {
          rollbackSnapshot();
          return res.status(409).json({
            success: false,
            error: 'Conflict',
            code: 'STOCK_NEGATIVE_PREVENTED',
            message: `Stock négatif interdit pour ${stockGuard.violations.map((v) => v.ref).join(', ')}.`,
            violations: stockGuard.violations,
            version: dbState.version,
          });
        }
      }

      await persistState(
        {
          actor: resolveActor(req),
          action: isSmartMergeRequest ? 'MERGE_STATE' : 'SYNC_STATE',
          entity: 'state',
          summary: `${isSmartMergeRequest ? 'Merged' : 'Updated'} ${acceptedKeys.length} collections (${acceptedKeys.slice(0, 6).join(', ')})`,
        },
        rollbackSnapshot
      );

      res.setHeader('ETag', `W/"v${dbState.version}"`);
      return res.json({
        success: true,
        merged: isSmartMergeRequest || preserveServerOnlyItems,
        message: 'State synchronized successfully',
        version: dbState.version,
        updatedAt: dbState.updatedAt,
        acceptedKeys,
        data:
          isSmartMergeRequest || preserveServerOnlyItems
            ? sanitizeStateSnapshotForTransport(dbState, {
                includeProtectedCollections: canForceOverwrite,
              })
            : undefined,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        code: 'PERSISTENCE_FAILED',
        message: toErrorMessage(error, 'Failed to synchronize state'),
      });
    }
  });

  app.get('/api/gmao/:entity', requireAllowedEntity, (req, res) => {
    const entity = String(req.params.entity);
    if (dbState[entity] === undefined) {
      dbState[entity] = OBJECT_ENTITY_SET.has(entity) ? {} : [];
    }
    res.setHeader('ETag', `W/"v${dbState.version}"`);

    const sanitized = stripSensitiveAccountFields(entity, dbState[entity]);
    const hasPaginationQuery =
      req.query.limit !== undefined || req.query.offset !== undefined || req.query.page !== undefined;

    if (hasPaginationQuery && Array.isArray(sanitized)) {
      const total = sanitized.length;
      const rawLimit = Number(req.query.limit);
      const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), 1000) : 100;
      const rawPage = Number(req.query.page);
      const rawOffset = Number(req.query.offset);
      const offset =
        Number.isFinite(rawOffset) && rawOffset >= 0
          ? Math.floor(rawOffset)
          : Number.isFinite(rawPage) && rawPage >= 1
          ? (Math.floor(rawPage) - 1) * limit
          : 0;
      const sliced = sanitized.slice(offset, offset + limit);
      return res.json({
        success: true,
        version: dbState.version,
        data: sliced,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + sliced.length < total,
        },
      });
    }

    return res.json({
      success: true,
      version: dbState.version,
      data: sanitized,
    });
  });

  app.post('/api/gmao/:entity', requireAllowedEntity, async (req, res) => {
    const gmaoReq = req as GmaoApiRequest;
    const entity = String(req.params.entity);
    const rawItem: unknown = req.body;
    if (!isObjectRecord(rawItem)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Item payload must be a JSON object.',
      });
    }
    try {
      if (OBJECT_ENTITY_SET.has(entity)) {
        const prevDict = isObjectRecord(dbState[entity]) ? { ...(dbState[entity] as ServerRecord) } : {};
        dbState[entity] = { ...prevDict, ...rawItem };
        await persistState(
          {
            actor: resolveActor(req),
            action: 'UPSERT_DICTIONARY',
            entity,
            summary: `Updated dictionary keys in ${entity}`,
          },
          () => {
            dbState[entity] = prevDict;
          }
        );
        res.setHeader('ETag', `W/"v${dbState.version}"`);
        return res.status(201).json({ success: true, version: dbState.version, data: dbState[entity] });
      }
      if (!Array.isArray(dbState[entity])) {
        dbState[entity] = [];
      }
      const prevRawStock = [...getArraySlice(dbState, 'rawStock')];
      const prevStock = [...getArraySlice(dbState, 'stock')];
      const prevList = [...(dbState[entity] as unknown[])];

      const actorRole = normalizeServerRole(gmaoReq.resolvedServerActor?.effectiveRole);
      const newItem: ServerRecord =
        gmaoReq.isBootstrapAuthorized === true
          ? rawItem
          : (clampMakerCheckerRecordForRole(actorRole, entity, rawItem, null) as ServerRecord);

      const rollbackEntity = () => {
        dbState[entity] = prevList;
        if (entity === 'rawStock' || entity === 'stock') {
          dbState.rawStock = prevRawStock;
          dbState.stock = prevStock;
        }
      };

      (dbState[entity] as unknown[]).push(newItem);
      if (entity === 'rawStock') dbState.stock = dbState.rawStock;
      if (entity === 'stock') dbState.rawStock = dbState.stock;

      if (entity === 'mouvements' || entity === 'rawStock' || entity === 'stock') {
        const stockGuard = validateProjectedStockInvariant({
          previousRawStock: prevRawStock,
          previousMouvements: entity === 'mouvements' ? prevList : getArraySlice(dbState, 'mouvements'),
          nextRawStock: getArraySlice(dbState, 'rawStock'),
          nextMouvements: getArraySlice(dbState, 'mouvements'),
        });
        if (!stockGuard.valid) {
          rollbackEntity();
          return res.status(409).json({
            success: false,
            error: 'Conflict',
            code: 'STOCK_NEGATIVE_PREVENTED',
            message: `Stock insuffisant : solde négatif interdit pour ${stockGuard.violations.map((v) => v.ref).join(', ')}.`,
            violations: stockGuard.violations,
            version: dbState.version,
          });
        }
      }

      const itemId = String(newItem.id || newItem.code || newItem.ref || 'new');
      await persistState(
        {
          actor: resolveActor(req),
          action: 'CREATE_ITEM',
          entity,
          summary: `Created item '${itemId}' in ${entity}`,
        },
        rollbackEntity
      );
      res.setHeader('ETag', `W/"v${dbState.version}"`);
      const stripped = stripSensitiveAccountFields(entity, [newItem]);
      const safeReturned = Array.isArray(stripped) ? stripped[0] : stripped;
      return res.status(201).json({ success: true, version: dbState.version, data: safeReturned });
    } catch (error) {
      return res.status(500).json({
        success: false,
        code: 'PERSISTENCE_FAILED',
        message: toErrorMessage(error, `Failed to create item in '${entity}'`),
      });
    }
  });

  app.put('/api/gmao/:entity', requireAllowedEntity, async (req, res) => {
    const gmaoReq = req as GmaoApiRequest;
    const entity = String(req.params.entity);
    const payload: unknown = req.body;
    const shouldMergeEntity = req.query.merge === 'true';

    if (!shouldMergeEntity && !canRoleForceReplaceEntity(gmaoReq)) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: `Role '${normalizeServerRole(gmaoReq.resolvedServerActor?.effectiveRole)}' cannot replace entire collection '${entity}' without ?merge=true.`,
      });
    }

    const expectedVersion = parseOptionalExpectedVersion(req);
    if (expectedVersion !== undefined && expectedVersion < dbState.version && !shouldMergeEntity) {
      return res.status(409).json({
        success: false,
        error: 'Conflict',
        message: `Server state version (${dbState.version}) is newer than If-Match (${expectedVersion}).`,
        version: dbState.version,
      });
    }

    try {
      if (OBJECT_ENTITY_SET.has(entity)) {
        if (!isObjectRecord(payload)) {
          return res.status(400).json({
            success: false,
            error: 'Bad Request',
            message: `Entity '${entity}' requires a JSON object payload.`,
          });
        }
        const prevDict = isObjectRecord(dbState[entity]) ? { ...(dbState[entity] as ServerRecord) } : {};
        dbState[entity] = payload;
        await persistState(
          {
            actor: resolveActor(req),
            action: 'REPLACE_DICTIONARY',
            entity,
            summary: `Replaced dictionary ${entity}`,
          },
          () => {
            dbState[entity] = prevDict;
          }
        );
        res.setHeader('ETag', `W/"v${dbState.version}"`);
        return res.json({ success: true, version: dbState.version, data: dbState[entity] });
      }

      if (!Array.isArray(payload)) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: `PUT /api/gmao/${entity} requires an array payload or use /api/gmao/${entity}/:id.`,
        });
      }

      const currentList = [...getArraySlice(dbState, entity)];
      const prevRawStock = [...getArraySlice(dbState, 'rawStock')];
      const prevStock = [...getArraySlice(dbState, 'stock')];
      const actorRole = normalizeServerRole(gmaoReq.resolvedServerActor?.effectiveRole);
      const effectivePayload =
        gmaoReq.isBootstrapAuthorized === true
          ? payload
          : clampMakerCheckerCollectionForRole(actorRole, entity, payload, currentList);

      const rollbackEntity = () => {
        dbState[entity] = currentList;
        if (entity === 'rawStock' || entity === 'stock') {
          dbState.rawStock = prevRawStock;
          dbState.stock = prevStock;
        }
      };

      const nextList = shouldMergeEntity
        ? mergeEntityCollection(entity, currentList, effectivePayload, { preserveServerOnlyItems: true })
        : effectivePayload;
      dbState[entity] = nextList;
      if (entity === 'rawStock') dbState.stock = dbState.rawStock;
      if (entity === 'stock') dbState.rawStock = dbState.stock;

      if (entity === 'mouvements' || entity === 'rawStock' || entity === 'stock') {
        const stockGuard = validateProjectedStockInvariant({
          previousRawStock: prevRawStock,
          previousMouvements: entity === 'mouvements' ? currentList : getArraySlice(dbState, 'mouvements'),
          nextRawStock: getArraySlice(dbState, 'rawStock'),
          nextMouvements: getArraySlice(dbState, 'mouvements'),
        });
        if (!stockGuard.valid) {
          rollbackEntity();
          return res.status(409).json({
            success: false,
            error: 'Conflict',
            code: 'STOCK_NEGATIVE_PREVENTED',
            message: `Stock insuffisant : solde négatif interdit pour ${stockGuard.violations.map((v) => v.ref).join(', ')}.`,
            violations: stockGuard.violations,
            version: dbState.version,
          });
        }
      }

      await persistState(
        {
          actor: resolveActor(req),
          action: shouldMergeEntity ? 'MERGE_COLLECTION' : 'REPLACE_COLLECTION',
          entity,
          summary: `${shouldMergeEntity ? 'Merged' : 'Replaced'} collection ${entity} (${nextList.length} items)`,
        },
        rollbackEntity
      );
      res.setHeader('ETag', `W/"v${dbState.version}"`);
      return res.json({
        success: true,
        version: dbState.version,
        data: stripSensitiveAccountFields(entity, dbState[entity]),
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        code: 'PERSISTENCE_FAILED',
        message: toErrorMessage(error, `Failed to update collection '${entity}'`),
      });
    }
  });

  app.put('/api/gmao/:entity/:id', requireAllowedEntity, async (req, res) => {
    const gmaoReq = req as GmaoApiRequest;
    const entity = String(req.params.entity);
    const id = String(req.params.id);
    const updatedData: unknown = req.body;
    if (!isObjectRecord(updatedData)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Update payload must be a JSON object.',
      });
    }
    const expectedVersion = parseOptionalExpectedVersion(req);
    if (expectedVersion !== undefined && expectedVersion < dbState.version) {
      return res.status(409).json({
        success: false,
        error: 'Conflict',
        message: `Server state version (${dbState.version}) is newer than If-Match (${expectedVersion}).`,
        version: dbState.version,
      });
    }
    if (!Array.isArray(dbState[entity])) {
      return res.status(404).json({ success: false, message: `Entity '${entity}' is not an array collection` });
    }
    const currentCollection = dbState[entity] as unknown[];
    const index = currentCollection.findIndex((item) => matchesEntityId(item, id));
    if (index === -1) {
      return res.status(404).json({
        success: false,
        message: `Item with id/code '${id}' not found in '${entity}'`,
      });
    }

    try {
      const prevList = [...currentCollection];
      const prevRawStock = [...getArraySlice(dbState, 'rawStock')];
      const prevStock = [...getArraySlice(dbState, 'stock')];
      const existingRecord = (currentCollection[index] || {}) as ServerRecord;
      const mergedRecord = { ...existingRecord, ...updatedData };
      const actorRole = normalizeServerRole(gmaoReq.resolvedServerActor?.effectiveRole);
      const rollbackEntity = () => {
        dbState[entity] = prevList;
        if (entity === 'rawStock' || entity === 'stock') {
          dbState.rawStock = prevRawStock;
          dbState.stock = prevStock;
        }
      };

      currentCollection[index] =
        gmaoReq.isBootstrapAuthorized === true
          ? mergedRecord
          : clampMakerCheckerRecordForRole(actorRole, entity, mergedRecord, existingRecord);
      if (entity === 'rawStock') dbState.stock = dbState.rawStock;
      if (entity === 'stock') dbState.rawStock = dbState.stock;

      if (entity === 'mouvements' || entity === 'rawStock' || entity === 'stock') {
        const stockGuard = validateProjectedStockInvariant({
          previousRawStock: prevRawStock,
          previousMouvements: entity === 'mouvements' ? prevList : getArraySlice(dbState, 'mouvements'),
          nextRawStock: getArraySlice(dbState, 'rawStock'),
          nextMouvements: getArraySlice(dbState, 'mouvements'),
        });
        if (!stockGuard.valid) {
          rollbackEntity();
          return res.status(409).json({
            success: false,
            error: 'Conflict',
            code: 'STOCK_NEGATIVE_PREVENTED',
            message: `Stock insuffisant : solde négatif interdit pour ${stockGuard.violations.map((v) => v.ref).join(', ')}.`,
            violations: stockGuard.violations,
            version: dbState.version,
          });
        }
      }

      await persistState(
        {
          actor: resolveActor(req),
          action: 'UPDATE_ITEM',
          entity,
          summary: `Updated item '${id}' in ${entity}`,
        },
        rollbackEntity
      );
      res.setHeader('ETag', `W/"v${dbState.version}"`);
      const stripped = stripSensitiveAccountFields(entity, [currentCollection[index]]);
      const safeReturned = Array.isArray(stripped) ? stripped[0] : stripped;
      return res.json({ success: true, version: dbState.version, data: safeReturned });
    } catch (error) {
      return res.status(500).json({
        success: false,
        code: 'PERSISTENCE_FAILED',
        message: toErrorMessage(error, `Failed to update item '${id}' in '${entity}'`),
      });
    }
  });

  app.delete('/api/gmao/:entity', requireAllowedEntity, (_req, res) => {
    return res.status(400).json({
      success: false,
      error: 'Bad Request',
      message: 'Item ID is required for DELETE (/api/gmao/:entity/:id).',
    });
  });

  app.delete('/api/gmao/:entity/:id', requireAllowedEntity, async (req, res) => {
    const gmaoReq = req as GmaoApiRequest;
    const entity = String(req.params.entity);
    const id = String(req.params.id);
    const expectedVersion = parseOptionalExpectedVersion(req);
    if (expectedVersion !== undefined && expectedVersion < dbState.version) {
      return res.status(409).json({
        success: false,
        error: 'Conflict',
        message: `Server state version (${dbState.version}) is newer than If-Match (${expectedVersion}).`,
        version: dbState.version,
      });
    }
    if (!Array.isArray(dbState[entity])) {
      return res.status(404).json({ success: false, message: `Entity '${entity}' is not an array collection` });
    }
    const prevList = [...(dbState[entity] as unknown[])];
    const prevRawStock = [...getArraySlice(dbState, 'rawStock')];
    const prevStock = [...getArraySlice(dbState, 'stock')];
    const filteredList = prevList.filter((item) => !matchesEntityId(item, id));

    if (filteredList.length === prevList.length) {
      return res.status(404).json({
        success: false,
        message: `Item with id/code '${id}' not found in '${entity}'`,
      });
    }

    try {
      const rollbackEntity = () => {
        dbState[entity] = prevList;
        if (entity === 'rawStock' || entity === 'stock') {
          dbState.rawStock = prevRawStock;
          dbState.stock = prevStock;
        }
      };

      dbState[entity] = filteredList;
      if (entity === 'rawStock') dbState.stock = dbState.rawStock;
      if (entity === 'stock') dbState.rawStock = dbState.stock;

      // Enforce stock non-negativity invariant on DELETE (e.g., deleting an ENTREE movement
      // whose balance already covers downstream SORTIE withdrawals is rejected with 409 Conflict).
      if (entity === 'mouvements' || entity === 'rawStock' || entity === 'stock') {
        const stockGuard = validateProjectedStockInvariant({
          previousRawStock: prevRawStock,
          previousMouvements: entity === 'mouvements' ? prevList : getArraySlice(dbState, 'mouvements'),
          nextRawStock: getArraySlice(dbState, 'rawStock'),
          nextMouvements: getArraySlice(dbState, 'mouvements'),
          bypassForAdminForce: req.query?.force === 'true' && canRoleForceReplaceEntity(gmaoReq),
        });
        if (!stockGuard.valid) {
          rollbackEntity();
          return res.status(409).json({
            success: false,
            error: 'Conflict',
            code: 'STOCK_NEGATIVE_PREVENTED',
            message: `Suppression interdite : solde négatif détecté pour ${stockGuard.violations.map((v) => v.ref).join(', ')}.`,
            violations: stockGuard.violations,
            version: dbState.version,
          });
        }
      }

      await persistState(
        {
          actor: resolveActor(req),
          action: 'DELETE_ITEM',
          entity,
          summary: `Deleted item '${id}' from ${entity}`,
        },
        rollbackEntity
      );
      res.setHeader('ETag', `W/"v${dbState.version}"`);
      return res.json({
        success: true,
        version: dbState.version,
        message: `Deleted item '${id}' from '${entity}'`,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        code: 'PERSISTENCE_FAILED',
        message: toErrorMessage(error, `Failed to delete item '${id}' from '${entity}'`),
      });
    }
  });
}
