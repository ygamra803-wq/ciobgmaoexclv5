import { DataGateway } from '../../application/DataGateway';
import { movementRepository } from '../../application/MovementRepository';
import { reactiveCalculationEngine } from '../../services/reactiveCalculationEngine';
import { StockCalculationService } from '../../core/domain/services/StockCalculationService';
import { Logger } from '../../core/logger/LoggerService';
import { safeId } from '../../utils/safeId';
import type {
  BatchInventoryAdjustmentDetail,
  BatchInventoryResult,
  GmaoStoreState,
  StateUpdater,
  ValidationReviewDecisionPayload,
} from '../../types/store';
import type {
  IStockItem,
  IType,
  IPartDesignation,
  PdrGroup,
  IMouvement,
  ISortieDemand,
  ISortieDemandItem,
} from '../../types/domain';
import type { IReplenishmentOrder, ReplenishmentOrderStatus } from '../../types/replenishment';
import {
  resolveUpdate,
  buildInitialStockMapFromList,
  trackRemovedEntityIds,
  getInitialStock,
  getInitialMovements,
  resolveActiveActorContext,
  resolveActiveSessionRole,
  isMakerCheckerSelfApproval,
  isPartAlreadyDeductedByStoreBon,
} from './storeBootstrapSlice';

const STOCK_MANAGER_ROLES = new Set([
  'ADMIN',
  'RESPONSABLE',
  'RESPONSABLE_MAINTENANCE',
  'RESPONSABLE_MAGASIN',
]);

const STOCK_DEMAND_SUBMITTER_ROLES = new Set([
  'ADMIN',
  'RESPONSABLE',
  'RESPONSABLE_MAINTENANCE',
  'RESPONSABLE_MAGASIN',
  'TECHNICIEN',
  'OPERATEUR',
]);

function resolveStockRole(explicitRole?: unknown): string {
  return String(explicitRole || resolveActiveSessionRole() || '')
    .trim()
    .toUpperCase();
}

function canManageStockSession(explicitRole?: unknown): boolean {
  const role = resolveStockRole(explicitRole);
  if (!role) return true; // Headless unit test without active browser session
  return STOCK_MANAGER_ROLES.has(role);
}

function canSubmitSortieDemandSession(explicitRole?: unknown): boolean {
  const role = resolveStockRole(explicitRole);
  if (!role) return true;
  return STOCK_DEMAND_SUBMITTER_ROLES.has(role);
}

function validateSortieDemandStockSufficiency(
  items: ISortieDemandItem[],
  stockMap: Map<string, any>,
  currentMovements: IMouvement[],
  numBonSaisi: unknown
): { valid: boolean; reason?: string } {
  if (!Array.isArray(items) || items.length === 0) return { valid: true };
  const requestedByRef = new Map<string, { ref: string; qty: number }>();

  for (const it of items) {
    if (!it) continue;
    const refRaw = String(it.ref || '').trim();
    const refKey = refRaw.toUpperCase();
    const qty = Number(it.quantite) || 0;
    if (!refKey || qty <= 0) continue;
    if (isPartAlreadyDeductedByStoreBon(currentMovements, numBonSaisi, refRaw)) continue;
    const prev = requestedByRef.get(refKey);
    if (prev) {
      prev.qty += qty;
    } else {
      requestedByRef.set(refKey, { ref: refRaw, qty });
    }
  }

  for (const [refKey, req] of requestedByRef.entries()) {
    const stockMatch = stockMap.get(refKey);
    if (!stockMatch) continue;
    const liveStock = StockCalculationService.calculateStockActuel(stockMatch, currentMovements);
    if (req.qty > liveStock) {
      return {
        valid: false,
        reason: `Stock insuffisant pour ${req.ref} : demandé ${req.qty}, disponible ${liveStock}.`,
      };
    }
  }

  return { valid: true };
}

type StoreSet = (
  partial: Partial<GmaoStoreState> | ((state: GmaoStoreState) => Partial<GmaoStoreState>)
) => void;
type StoreGet = () => GmaoStoreState;

export type StockSliceKeys = Pick<
  GmaoStoreState,
  | 'pdrGroups'
  | 'types'
  | 'rawStock'
  | 'designations'
  | 'setPdrGroups'
  | 'setTypes'
  | 'setRawStock'
  | 'setDesignations'
  | 'mouvements'
  | 'setMouvements'
  | 'sortieDemands'
  | 'setSortieDemands'
  | 'handleSubmitSortieDemand'
  | 'handleReviewSortieDemandValidation'
  | 'handleBatchPhysicalInventory'
  | 'replenishmentOrders'
  | 'setReplenishmentOrders'
  | 'handleCreateReplenishmentOrder'
  | 'handleUpdateReplenishmentOrderStatus'
  | 'handleReceiveReplenishmentOrder'
  | 'stockItems'
  | 'effectiveDesignations'
>;

export function createStockSlice(set: StoreSet, get: StoreGet): StockSliceKeys {
  const initialStock = getInitialStock();
  const initialMovements = getInitialMovements();

  movementRepository.bulkReplace(
    initialMovements.mouvements as any[],
    buildInitialStockMapFromList(initialStock.rawStock)
  );

  return {
    pdrGroups: initialStock.pdrGroups as PdrGroup[],
    types: initialStock.types as IType[],
    rawStock: initialStock.rawStock as IStockItem[],
    designations: initialStock.designations as IPartDesignation[],

    setPdrGroups: (updater: StateUpdater<PdrGroup[]>) => {
      const prev = get().pdrGroups || [];
      const next = resolveUpdate(updater, prev);
      trackRemovedEntityIds('pdrGroups', prev, next);
      DataGateway.savePdrGroups(next);
      set({ pdrGroups: next });
    },

    setTypes: (updater: StateUpdater<IType[]>) => {
      const prev = get().types || [];
      const next = resolveUpdate(updater, prev);
      trackRemovedEntityIds('types', prev, next);
      DataGateway.saveStockTypes(next);
      set({ types: next });
    },

    setRawStock: (updater: StateUpdater<IStockItem[]>) => {
      const prev = get().rawStock || [];
      const next = resolveUpdate(updater, prev);
      trackRemovedEntityIds('rawStock', prev, next);

      // Institutional append-only audit on stockInitial / unit price adjustments
      if (prev.length > 0 && typeof get().appendAuditEvent === 'function') {
        const prevByRef = new Map<string, IStockItem>();
        for (const item of prev) {
          const refKey = String(item?.ref || '').trim().toUpperCase();
          if (refKey) prevByRef.set(refKey, item);
        }
        for (const item of next) {
          const refRaw = String(item?.ref || '').trim();
          const refKey = refRaw.toUpperCase();
          if (!refKey) continue;
          const oldItem = prevByRef.get(refKey);
          if (!oldItem) continue;

          const prevInitial = Number(oldItem.stockInitial ?? 0);
          const nextInitial = Number(item.stockInitial ?? 0);
          const prevPrice = Number(oldItem.prixUnitaire ?? oldItem.prix ?? 0);
          const nextPrice = Number(item.prixUnitaire ?? item.prix ?? 0);

          const initialChanged = Number.isFinite(prevInitial) && Number.isFinite(nextInitial) && prevInitial !== nextInitial;
          const priceChanged = Number.isFinite(prevPrice) && Number.isFinite(nextPrice) && prevPrice !== nextPrice;

          if (initialChanged || priceChanged) {
            const actionType =
              initialChanged && priceChanged
                ? 'STOCK_INITIAL_AND_PRICE_CHANGED'
                : initialChanged
                ? 'STOCK_INITIAL_CHANGED'
                : 'STOCK_PRICE_CHANGED';
            get().appendAuditEvent({
              actionType,
              entityType: 'STOCK_ITEM',
              entityId: refRaw,
              before: { stockInitial: prevInitial, prix_unitaire: prevPrice },
              after: { stockInitial: nextInitial, prix_unitaire: nextPrice },
            });
          }
        }
      }

      DataGateway.saveStock(next);
      set({ rawStock: next });
      movementRepository.bulkReplace(
        (get().mouvements || []) as any[],
        buildInitialStockMapFromList(next)
      );
    },

    setDesignations: (updater: StateUpdater<IPartDesignation[]>) => {
      const prev = get().designations || [];
      const next = resolveUpdate(updater, prev);
      trackRemovedEntityIds('designations', prev, next);
      DataGateway.saveDesignations(next);
      set({ designations: next });
    },

    mouvements: initialMovements.mouvements as IMouvement[],
    sortieDemands: initialMovements.sortieDemands as ISortieDemand[],
    replenishmentOrders: initialMovements.replenishmentOrders as IReplenishmentOrder[],

    setMouvements: (updater: StateUpdater<IMouvement[]>) => {
      const prev = get().mouvements || [];
      const next = resolveUpdate(updater, prev);
      trackRemovedEntityIds('mouvements', prev, next);
      DataGateway.saveMouvements(next, { stock: get().rawStock, strict: false });
      set({ mouvements: next });
      movementRepository.bulkReplace(
        next as any[],
        buildInitialStockMapFromList(get().rawStock || [])
      );
    },

    setSortieDemands: (updater: StateUpdater<ISortieDemand[]>) => {
      const prev = get().sortieDemands || [];
      const next = resolveUpdate(updater, prev);
      trackRemovedEntityIds('sortieDemands', prev, next);
      DataGateway.saveSortieDemands(next);
      set({ sortieDemands: next });
    },

    setReplenishmentOrders: (updater: StateUpdater<IReplenishmentOrder[]>) => {
      const prev = get().replenishmentOrders || [];
      const next = resolveUpdate(updater, prev);
      trackRemovedEntityIds('replenishmentOrders', prev, next);
      DataGateway.saveReplenishmentOrders(next);
      set({ replenishmentOrders: next });
    },

    handleSubmitSortieDemand: (demandPayload) => {
      if (!demandPayload || typeof demandPayload !== 'object') return null;
      if (!canSubmitSortieDemandSession((demandPayload as any)?.actorRole)) {
        Logger.warn('[StockSlice] RBAC blocked handleSubmitSortieDemand');
        return null;
      }
      const nowIso = new Date().toISOString();
      const actor = resolveActiveActorContext();
      const rawItems = Array.isArray(demandPayload.items) ? demandPayload.items : [];
      const normalizedItems: ISortieDemandItem[] = rawItems
        .map((it: any) => ({
          ref: String(it?.ref || '').trim(),
          designation: String(it?.designation || it?.ref || 'PDR').trim(),
          quantite: Math.max(1, Number(it?.quantite ?? it?.qty ?? 1) || 1),
          unite: it?.unite || it?.unit,
          prix_unitaire: Number(it?.prix_unitaire ?? it?.prix ?? 0) || 0,
        }))
        .filter((it) => Boolean(it.ref));

      const demand: ISortieDemand = {
        id: String(demandPayload.id || safeId('SD')).trim(),
        code_bon_tech: String(
          demandPayload.code_bon_tech || demandPayload.code_bon || `BS-TECH-${Date.now().toString().slice(-4)}`
        ).trim(),
        type: String(demandPayload.type || 'Sortie Interne').trim(),
        date: String(demandPayload.date || nowIso.slice(0, 10)).trim(),
        technicien: String(demandPayload.technicien || demandPayload.submitted_by_name || actor.actorName).trim(),
        submitted_by_id: String(demandPayload.submitted_by_id || actor.actorId).trim(),
        submitted_by_name: String(demandPayload.submitted_by_name || demandPayload.technicien || actor.actorName).trim(),
        submitted_at: String(demandPayload.submitted_at || nowIso),
        id_machine_registered: demandPayload.id_machine_registered,
        id_zone: demandPayload.id_zone,
        id_bt: demandPayload.id_bt,
        items: normalizedItems,
        validation_status: 'PENDING_VALIDATION',
        stock_deducted: false,
        stock_effect: 'RESERVED',
        notes: demandPayload.notes || demandPayload.observations || '',
      };

      get().setSortieDemands((prev) => [demand, ...(prev || [])]);
      return demand;
    },

    handleReviewSortieDemandValidation: (
      demandId: string,
      decisionData: ValidationReviewDecisionPayload = {},
      onAddMouvement = null
    ) => {
      if (!canManageStockSession(decisionData?.actorRole)) {
        Logger.warn('[StockSlice] RBAC blocked handleReviewSortieDemandValidation');
        return null;
      }

      const currentDemands = get().sortieDemands || [];
      const existing = currentDemands.find((d) => String(d.id) === String(demandId));
      if (!existing) return null;
      if (String(existing.validation_status || '').toUpperCase() === 'APPROVED') {
        return null;
      }

      const nowIso = new Date().toISOString();
      const actor = resolveActiveActorContext();
      const hasActiveSession = Boolean(resolveActiveSessionRole());
      const explicitValidatorId = decisionData?.validated_by_id || decisionData?.reviewer_id;
      const decision = String(decisionData?.decision || 'APPROVED').trim().toUpperCase();
      const validatorId = String(explicitValidatorId || actor.actorId).trim();
      const validatorName = String(
        decisionData?.validated_by_name ||
          decisionData?.reviewer_name ||
          decisionData?.reviewerName ||
          actor.actorName
      ).trim();
      const validationNote = String(decisionData?.validation_note || decisionData?.notes || '').trim();

      let updatedDemand: ISortieDemand = existing;

      if (decision === 'REJECTED' || decision === 'NEEDS_CLARIFICATION') {
        const nextStatus = decision === 'REJECTED' ? 'REJECTED' : 'NEEDS_CLARIFICATION';
        updatedDemand = {
          ...existing,
          validation_status: nextStatus,
          validated_by_id: validatorId,
          validated_by_name: validatorName,
          validated_at: nowIso,
          validation_note: validationNote,
          stock_deducted: false,
          stock_effect: nextStatus === 'REJECTED' ? 'NONE' : 'RESERVED',
        };
        get().setSortieDemands((prev) =>
          (prev || []).map((d) => (String(d.id) === String(demandId) ? updatedDemand : d))
        );
        get().appendAuditEvent({
          actorId: validatorId,
          actorName: validatorName,
          actorRole: actor.actorRole,
          actionType: nextStatus === 'REJECTED' ? 'VALIDATION_REJECTED' : 'VALIDATION_NEEDS_CLARIFICATION',
          entityType: 'SORTIE_DEMAND',
          entityId: existing.id,
          before: { validation_status: existing.validation_status },
          after: { validation_status: nextStatus, validation_note: validationNote },
        });
        return updatedDemand;
      }

      // Enforce Segregation of Duties (SoD): submitter cannot approve their own sortie demand
      if (
        isMakerCheckerSelfApproval({
          submitterId: existing.submitted_by_id,
          submitterName: existing.submitted_by_name || existing.technicien,
          validatorId,
          validatorName,
          hasExplicitValidatorId: Boolean(explicitValidatorId),
          hasActiveSession,
        })
      ) {
        Logger.warn('[StockSlice] SoD blocked self-approval on sortie demand', {
          demandId: String(demandId),
          validatorId,
        });
        return null;
      }

      // APPROVED branch
      const mergeWithMovementId = decisionData?.mergeWithMovementId
        ? String(decisionData.mergeWithMovementId).trim()
        : '';
      const skipStockDeduction = Boolean(decisionData?.skipStockDeduction);

      if (mergeWithMovementId || skipStockDeduction) {
        const currentMovements = get().mouvements || [];
        const matchedMovement = mergeWithMovementId
          ? currentMovements.find(
              (m) => String(m.id) === mergeWithMovementId || String(m.code_bon) === mergeWithMovementId
            )
          : undefined;
        const mergedBonCode = String(
          matchedMovement?.code_bon || decisionData?.code_bon_magasin || existing.code_bon_tech || ''
        ).trim();

        if (matchedMovement) {
          get().setMouvements((prev) =>
            (prev || []).map((m) =>
              String(m.id) === String(matchedMovement.id)
                ? {
                    ...m,
                    num_bon_saisi_par_tech: existing.code_bon_tech,
                    merged_demand_id: existing.id,
                  }
                : m
            )
          );
        }

        updatedDemand = {
          ...existing,
          validation_status: 'APPROVED',
          validated_by_id: validatorId,
          validated_by_name: validatorName,
          validated_at: nowIso,
          validation_note: validationNote,
          stock_deducted: true,
          stock_effect: 'APPLIED',
          ...(mergeWithMovementId
            ? {
                discrepancy_status: 'BON_MISMATCH_MERGED' as const,
                merged_with_movement_id: mergeWithMovementId,
              }
            : {}),
          code_bon_magasin: mergedBonCode,
          emitted_movement_ids: matchedMovement ? [String(matchedMovement.id)] : [],
        };

        get().setSortieDemands((prev) =>
          (prev || []).map((d) => (String(d.id) === String(demandId) ? updatedDemand : d))
        );
        get().appendAuditEvent({
          actorId: validatorId,
          actorName: validatorName,
          actorRole: actor.actorRole,
          actionType: 'VALIDATION_APPROVED',
          entityType: 'SORTIE_DEMAND',
          entityId: existing.id,
          before: { validation_status: existing.validation_status },
          after: {
            validation_status: 'APPROVED',
            ...(mergeWithMovementId
              ? {
                  discrepancy_status: 'BON_MISMATCH_MERGED',
                  merged_with_movement_id: mergeWithMovementId,
                }
              : { skipStockDeduction: true }),
          },
        });
        return updatedDemand;
      }

      // Standard approval: emit 1 Sortie movement per approved item after atomic stock sufficiency check
      const approvedItems: ISortieDemandItem[] = Array.isArray(decisionData?.approvedItems)
        ? decisionData.approvedItems
        : Array.isArray(existing.items)
        ? existing.items
        : [];
      const officialBonCode = String(
        decisionData?.code_bon_magasin || existing.code_bon_tech || `BS-${Date.now().toString().slice(-5)}`
      ).trim();

      const currentMovements = get().mouvements || [];
      const stockMap = new Map<string, any>();
      for (const s of get().rawStock || []) {
        const refKey = String(s?.ref || '').trim().toUpperCase();
        if (refKey) stockMap.set(refKey, s);
      }

      const stockCheck = validateSortieDemandStockSufficiency(
        approvedItems,
        stockMap,
        currentMovements,
        existing.code_bon_tech || officialBonCode
      );
      if (!stockCheck.valid) {
        Logger.warn(`[StockSlice] Blocked SortieDemand approval: ${stockCheck.reason}`);
        return null;
      }

      const emittedIds: string[] = [];
      const newMovements: IMouvement[] = approvedItems
        .filter(
          (it) =>
            it &&
            String(it.ref || '').trim() &&
            Number(it.quantite) > 0 &&
            !isPartAlreadyDeductedByStoreBon(
              currentMovements,
              existing.code_bon_tech || officialBonCode,
              it.ref
            )
        )
        .map((it) => {
          const mvtId = safeId('MVT');
          emittedIds.push(mvtId);
          return {
            id: mvtId,
            code_bon: officialBonCode,
            num_bon_saisi_par_tech: existing.code_bon_tech,
            source_demand_id: existing.id,
            type: existing.type || 'Sortie Interne',
            ref: String(it.ref).trim(),
            designation: String(it.designation || it.ref).trim(),
            quantite: Number(it.quantite),
            date: existing.date || nowIso.slice(0, 10),
            technicien: existing.technicien || existing.submitted_by_name,
            id_machine_registered: existing.id_machine_registered,
            id_zone: existing.id_zone,
            action_id: 'SORTIE_DEMAND',
            prix_unitaire: it.prix_unitaire,
          };
        });

      if (newMovements.length > 0) {
        get().setMouvements((prev) => [...newMovements, ...(prev || [])]);
        if (typeof onAddMouvement === 'function') {
          for (const mv of newMovements) {
            onAddMouvement(mv);
          }
        }
      }

      updatedDemand = {
        ...existing,
        items: approvedItems,
        code_bon_magasin: officialBonCode,
        validation_status: 'APPROVED',
        validated_by_id: validatorId,
        validated_by_name: validatorName,
        validated_at: nowIso,
        validation_note: validationNote,
        stock_deducted: newMovements.length > 0,
        stock_effect: newMovements.length > 0 ? 'APPLIED' : 'NONE',
        discrepancy_status: decisionData?.approvedItems ? 'ADJUSTED' : 'MATCH',
        emitted_movement_ids: emittedIds,
      };

      get().setSortieDemands((prev) =>
        (prev || []).map((d) => (String(d.id) === String(demandId) ? updatedDemand : d))
      );
      get().appendAuditEvent({
        actorId: validatorId,
        actorName: validatorName,
        actorRole: actor.actorRole,
        actionType: 'VALIDATION_APPROVED',
        entityType: 'SORTIE_DEMAND',
        entityId: existing.id,
        before: { validation_status: existing.validation_status },
        after: {
          validation_status: 'APPROVED',
          code_bon_magasin: officialBonCode,
          emitted_movement_ids: emittedIds,
        },
      });
      return updatedDemand;
    },

    handleBatchPhysicalInventory: (payload): BatchInventoryResult => {
      if (!canManageStockSession(payload?.actorRole)) {
        Logger.warn('[StockSlice] RBAC blocked handleBatchPhysicalInventory');
        return {
          success: false,
          reason: 'Accès refusé : rôle Magasinier ou Responsable requis pour valider un inventaire.',
          adjustedCount: 0,
          netEcartUnits: 0,
          netEcartValueMad: 0,
          adjustments: [],
          emittedMovements: [],
        };
      }

      const rawEntries = Array.isArray(payload?.entries) ? payload.entries : [];
      const reason = String(payload?.reason || '').trim() || 'Inventaire physique périodique';
      if (rawEntries.length === 0) {
        return {
          success: false,
          reason: 'Aucune ligne de comptage fournie.',
          adjustedCount: 0,
          netEcartUnits: 0,
          netEcartValueMad: 0,
          adjustments: [],
          emittedMovements: [],
        };
      }

      // Deduplicate by normalized ref keeping last explicit count
      const countedByRef = new Map<string, number>();
      for (const entry of rawEntries) {
        const refKey = String(entry?.ref || '').trim().toUpperCase();
        if (!refKey) continue;
        const parsedQty = Number(entry?.countedQty);
        if (!Number.isFinite(parsedQty) || parsedQty < 0) continue;
        countedByRef.set(refKey, parsedQty);
      }

      const currentStockList = get().rawStock || [];
      const currentMovements = get().mouvements || [];
      const stockByRef = new Map<string, IStockItem>();
      for (const item of currentStockList) {
        const refKey = String(item?.ref || '').trim().toUpperCase();
        if (refKey) stockByRef.set(refKey, item);
      }

      const now = new Date();
      const nowIso = now.toISOString();
      const dateStr = nowIso.slice(0, 10);
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const actor = resolveActiveActorContext();
      const actorName = String(payload?.actorName || actor.actorName || 'Magasinier Central').trim();
      const actorId = String(payload?.actorId || actor.actorId || 'system').trim();
      const actorRole = String(payload?.actorRole || actor.actorRole || 'ADMIN').trim();
      const batchStamp = Date.now().toString().slice(-6);

      const adjustments: BatchInventoryAdjustmentDetail[] = [];
      const emittedMovements: IMouvement[] = [];
      let netEcartUnits = 0;
      let netEcartValueMad = 0;
      let seqIdx = 1;

      for (const [refKey, countedQty] of countedByRef.entries()) {
        const stockMatch = stockByRef.get(refKey);
        if (!stockMatch) continue;

        const stockBefore = StockCalculationService.calculateStockActuel(stockMatch, currentMovements);
        const ecart = Number((countedQty - stockBefore).toFixed(4));
        if (ecart === 0) continue;

        const absDelta = Math.abs(ecart);
        const unitPrice = Math.max(
          0,
          Number(
            stockMatch.prixUnitaire ??
              stockMatch.prix_unitaire ??
              stockMatch.prix ??
              0
          ) || 0
        );
        const ecartValue = Number((ecart * unitPrice).toFixed(2));
        const codeBon = `INV-${batchStamp}-${String(seqIdx).padStart(2, '0')}`;
        seqIdx += 1;

        const mvtType = ecart > 0 ? 'Entrée' : 'Sortie';
        const mvt: IMouvement = {
          id: safeId('MVT'),
          code_bon: codeBon,
          date: dateStr,
          heure: timeStr,
          timestamp: nowIso,
          ref: stockMatch.ref,
          designation: stockMatch.designation || stockMatch.ref,
          quantite: absDelta,
          stock_avant: stockBefore,
          stock_apres: countedQty,
          type: mvtType,
          action_id: 'INVENTAIRE',
          technicien: actorName,
          prix_unitaire: unitPrice,
          cout_total: Number((absDelta * unitPrice).toFixed(2)),
          emplacement_reception: stockMatch.emplacement || '',
          commentaire: `[Inventaire Batch] ${reason} (${stockBefore} → ${countedQty})`,
        };

        emittedMovements.push(mvt);
        adjustments.push({
          ref: stockMatch.ref,
          designation: stockMatch.designation || stockMatch.ref,
          before: stockBefore,
          counted: countedQty,
          ecart,
          unitPrice,
          ecartValue,
          code_bon: codeBon,
        });
        netEcartUnits += ecart;
        netEcartValueMad += ecartValue;
      }

      if (emittedMovements.length === 0) {
        return {
          success: true,
          adjustedCount: 0,
          netEcartUnits: 0,
          netEcartValueMad: 0,
          adjustments: [],
          emittedMovements: [],
        };
      }

      // AGENTS.md §1.3: Never mutate stockInitial alongside movements — append movements only.
      get().setMouvements((prev) => [...emittedMovements, ...(prev || [])]);

      if (typeof get().appendAuditEvent === 'function') {
        get().appendAuditEvent({
          actorId,
          actorName,
          actorRole,
          actionType: 'INVENTORY_BATCH_ADJUSTED',
          entityType: 'STOCK_ITEM',
          entityId: `INV-BATCH-${batchStamp}`,
          before: {
            adjustedCount: adjustments.length,
            refs: adjustments.map((a) => ({ ref: a.ref, stock: a.before })),
          },
          after: {
            reason,
            adjustedCount: adjustments.length,
            netEcartUnits: Number(netEcartUnits.toFixed(4)),
            netEcartValueMad: Number(netEcartValueMad.toFixed(2)),
            adjustments,
          },
        });
      }

      return {
        success: true,
        adjustedCount: adjustments.length,
        netEcartUnits: Number(netEcartUnits.toFixed(4)),
        netEcartValueMad: Number(netEcartValueMad.toFixed(2)),
        adjustments,
        emittedMovements,
      };
    },

    handleCreateReplenishmentOrder: async (orderData: Partial<IReplenishmentOrder>) => {
      if (!canManageStockSession((orderData as any)?.actorRole)) {
        Logger.warn('[StockSlice] RBAC blocked handleCreateReplenishmentOrder');
        throw new Error('Permission refusée : rôle magasinier ou responsable requis pour créer une commande fournisseur.');
      }
      const nowIso = new Date().toISOString();
      const yyyymm = nowIso.slice(0, 7).replace('-', '');
      const existingOrders = get().replenishmentOrders || [];
      const seq = String(existingOrders.length + 1).padStart(3, '0');
      const actor = resolveActiveActorContext();

      const items = Array.isArray(orderData.items) ? orderData.items : [];
      const computedTotal = items.reduce(
        (sum, it) => sum + (Number(it.quantite_demandee) || 0) * (Number(it.prix_unitaire_estime) || 0),
        0
      );

      const newOrder: IReplenishmentOrder = {
        id: String(orderData.id || safeId('PO')).trim(),
        numero_commande: String(orderData.numero_commande || `BC-${yyyymm}-${seq}`).trim(),
        date_creation: String(orderData.date_creation || nowIso.slice(0, 10)),
        fournisseur: String(orderData.fournisseur || 'Fournisseur Standard').trim(),
        statut: 'BROUILLON',
        cree_par: String(orderData.cree_par || orderData.demandeur || actor.actorName).trim(),
        items,
        montant_total_estime: Number(orderData.montant_total_estime ?? computedTotal) || 0,
        notes: orderData.notes || '',
        date_livraison_prevue: orderData.date_livraison_prevue,
        priorite: orderData.priorite,
      };

      get().setReplenishmentOrders((prev) => [newOrder, ...(prev || [])]);
      get().appendAuditEvent({
        actionType: 'PO_CREATED',
        entityType: 'REPLENISHMENT_ORDER',
        entityId: newOrder.id,
        before: null,
        after: {
          numero_commande: newOrder.numero_commande,
          statut: newOrder.statut,
          fournisseur: newOrder.fournisseur,
          montant_total_estime: newOrder.montant_total_estime,
        },
      });
      return newOrder;
    },

    handleUpdateReplenishmentOrderStatus: async (
      orderId: string,
      status: ReplenishmentOrderStatus,
      metadata: Record<string, any> = {}
    ) => {
      if (!canManageStockSession(metadata?.actorRole)) {
        Logger.warn('[StockSlice] RBAC blocked handleUpdateReplenishmentOrderStatus');
        return;
      }
      const orders = get().replenishmentOrders || [];
      const target = orders.find((o) => String(o.id) === String(orderId));
      if (!target) return;
      if (target.statut === 'RECU_CONFORME' || target.statut === 'ANNULE') {
        return;
      }

      const today = new Date().toISOString().slice(0, 10);
      const updatedOrder: IReplenishmentOrder = {
        ...target,
        ...metadata,
        statut: status,
        ...(status === 'COMMANDE' && !target.date_commande ? { date_commande: today } : {}),
      };

      get().setReplenishmentOrders((prev) =>
        (prev || []).map((o) => (String(o.id) === String(orderId) ? updatedOrder : o))
      );
      get().appendAuditEvent({
        actionType: status === 'ANNULE' ? 'PO_CANCELLED' : 'PO_STATUS_CHANGED',
        entityType: 'REPLENISHMENT_ORDER',
        entityId: target.id,
        before: { statut: target.statut },
        after: { statut: status },
      });
    },

    handleReceiveReplenishmentOrder: async (
      orderId: string,
      receivedItems: {
        ref: string;
        quantite_recue: number;
        prix_unitaire_reel?: number;
        lot_number?: string;
        date_peremption?: string;
        emplacement_reception?: string;
      }[],
      numBonReception?: string,
      recepteur?: string
    ) => {
      if (!canManageStockSession()) {
        Logger.warn('[StockSlice] RBAC blocked handleReceiveReplenishmentOrder');
        return;
      }
      const orders = get().replenishmentOrders || [];
      const target = orders.find((o) => String(o.id) === String(orderId));
      if (!target) return;
      if (target.statut === 'RECU_CONFORME' || target.statut === 'ANNULE') {
        return;
      }

      const today = new Date().toISOString().slice(0, 10);
      const compactDate = today.replace(/-/g, '');
      const actor = resolveActiveActorContext();
      const bonCode = String(numBonReception || `BR-${Date.now().toString().slice(-6)}`).trim();
      const receiverName = String(recepteur || actor.actorName).trim();

      const currentStockList = get().rawStock || [];
      const currentMovements = get().mouvements || [];

      const receivedMetaByRef = new Map<
        string,
        {
          qty: number;
          prix_unitaire_reel?: number;
          lot_number?: string;
          date_peremption?: string;
          emplacement_reception?: string;
        }
      >();
      for (const rec of receivedItems || []) {
        const refKey = String(rec?.ref || '').trim().toUpperCase();
        const qty = Math.max(0, Number(rec?.quantite_recue) || 0);
        if (refKey && qty > 0) {
          const prev = receivedMetaByRef.get(refKey);
          receivedMetaByRef.set(refKey, {
            qty: (prev?.qty || 0) + qty,
            prix_unitaire_reel:
              rec.prix_unitaire_reel !== undefined ? Number(rec.prix_unitaire_reel) : prev?.prix_unitaire_reel,
            lot_number: rec.lot_number ? String(rec.lot_number).trim() : prev?.lot_number,
            date_peremption: rec.date_peremption ? String(rec.date_peremption).trim() : prev?.date_peremption,
            emplacement_reception: rec.emplacement_reception
              ? String(rec.emplacement_reception).trim()
              : prev?.emplacement_reception,
          });
        }
      }

      const newMovements: IMouvement[] = [];
      const stockPriceAndBinUpdates = new Map<
        string,
        { cumpAfter: number; realPrice: number; emplacement?: string }
      >();

      const updatedItems = (target.items || []).map((item) => {
        const refKey = String(item.ref || '').trim().toUpperCase();
        const recMeta = receivedMetaByRef.get(refKey);
        const requestedDelta = recMeta?.qty || 0;
        const alreadyReceived = Math.max(0, Number(item.quantite_recue) || 0);
        const remainingNeeded = Math.max(0, (Number(item.quantite_demandee) || 0) - alreadyReceived);
        const clampedAdded = Math.min(requestedDelta, remainingNeeded);

        const stockMatch = currentStockList.find(
          (s) => String(s.ref || '').trim().toUpperCase() === refKey
        );
        const stockBefore = stockMatch
          ? Math.max(0, StockCalculationService.calculateStockActuel(stockMatch, currentMovements))
          : 0;
        const oldPrice = Math.max(
          0,
          Number(
            stockMatch?.prixUnitaire ??
              stockMatch?.prix_unitaire ??
              stockMatch?.prix ??
              item.prix_unitaire_estime ??
              0
          ) || 0
        );

        const hasExplicitRealPrice =
          recMeta?.prix_unitaire_reel !== undefined &&
          Number.isFinite(Number(recMeta.prix_unitaire_reel)) &&
          Number(recMeta.prix_unitaire_reel) > 0;
        const realPrice = hasExplicitRealPrice
          ? Number(recMeta!.prix_unitaire_reel)
          : Math.max(0, Number(item.prix_unitaire_reel ?? item.prix_unitaire_estime ?? oldPrice) || 0);

        const cumpAfter =
          clampedAdded > 0
            ? stockBefore > 0 && oldPrice > 0
              ? Number(((stockBefore * oldPrice + clampedAdded * realPrice) / (stockBefore + clampedAdded)).toFixed(2))
              : Number(realPrice.toFixed(2))
            : Number((item.cump_apres ?? (oldPrice || realPrice)).toFixed(2));

        const resolvedLot =
          recMeta?.lot_number ||
          item.lot_number ||
          `LOT-${compactDate}-${refKey}`;
        const resolvedExpiry = recMeta?.date_peremption || item.date_peremption || undefined;
        const resolvedBin =
          recMeta?.emplacement_reception ||
          item.emplacement_reception ||
          String(stockMatch?.emplacement || '').trim() ||
          undefined;

        if (clampedAdded > 0) {
          newMovements.push({
            id: safeId('MVT'),
            code_bon: bonCode,
            type: 'Entrée',
            ref: item.ref,
            designation: item.designation,
            quantite: clampedAdded,
            date: today,
            technicien: receiverName,
            action_id: 'reapprovisionnement',
            prix_unitaire: realPrice,
            cout_total: Number((clampedAdded * realPrice).toFixed(2)),
            fournisseur: target.fournisseur,
            lot_number: resolvedLot,
            ...(resolvedExpiry ? { date_peremption: resolvedExpiry, expiry_date: resolvedExpiry } : {}),
            ...(resolvedBin ? { emplacement_reception: resolvedBin, bin_code: resolvedBin } : {}),
            cump_avant: oldPrice,
            cump_apres: cumpAfter,
          });

          if (cumpAfter > 0 || resolvedBin) {
            stockPriceAndBinUpdates.set(refKey, {
              cumpAfter,
              realPrice,
              emplacement: resolvedBin,
            });
          }
        }

        return {
          ...item,
          quantite_recue: alreadyReceived + clampedAdded,
          prix_unitaire_reel: realPrice,
          lot_number: resolvedLot,
          ...(resolvedExpiry ? { date_peremption: resolvedExpiry } : {}),
          ...(resolvedBin ? { emplacement_reception: resolvedBin } : {}),
          cump_avant: oldPrice,
          cump_apres: cumpAfter,
        };
      });

      const allConforming = updatedItems.every(
        (it) => (Number(it.quantite_recue) || 0) >= (Number(it.quantite_demandee) || 0)
      );
      const nextStatus: ReplenishmentOrderStatus = allConforming
        ? 'RECU_CONFORME'
        : 'RECEPTION_PARTIELLE';

      const montantTotalReel = Number(
        updatedItems
          .reduce(
            (sum, it) =>
              sum +
              (Number(it.quantite_recue) || 0) *
                (Number(it.prix_unitaire_reel ?? it.prix_unitaire_estime) || 0),
            0
          )
          .toFixed(2)
      );

      const updatedOrder: IReplenishmentOrder = {
        ...target,
        items: updatedItems,
        statut: nextStatus,
        date_reception_reelle: today,
        numero_bon_reception: bonCode,
        recepteur: receiverName,
        montant_total_reel: montantTotalReel,
      };

      if (stockPriceAndBinUpdates.size > 0) {
        get().setRawStock((prev) =>
          (prev || []).map((s) => {
            const refKey = String(s.ref || '').trim().toUpperCase();
            const upd = stockPriceAndBinUpdates.get(refKey);
            if (!upd) return s;
            const nextPrice = upd.cumpAfter > 0 ? upd.cumpAfter : Number(s.prixUnitaire ?? s.prix_unitaire ?? 0);
            const currentBin = String(s.emplacement || '').trim();
            return {
              ...s,
              ...(nextPrice > 0 ? { prixUnitaire: nextPrice, prix_unitaire: nextPrice } : {}),
              ...(upd.realPrice > 0 ? { dernier_prix_achat: upd.realPrice } : {}),
              ...(!currentBin && upd.emplacement ? { emplacement: upd.emplacement } : {}),
            };
          })
        );
      }

      if (newMovements.length > 0) {
        get().setMouvements((prev) => [...newMovements, ...(prev || [])]);
      }

      get().setReplenishmentOrders((prev) =>
        (prev || []).map((o) => (String(o.id) === String(orderId) ? updatedOrder : o))
      );

      get().appendAuditEvent({
        actionType: 'PO_RECEIVED',
        entityType: 'REPLENISHMENT_ORDER',
        entityId: target.id,
        before: { statut: target.statut },
        after: {
          statut: nextStatus,
          numero_bon_reception: bonCode,
          itemsCount: newMovements.length,
          montant_total_reel: montantTotalReel,
          cumpUpdates: Array.from(stockPriceAndBinUpdates.entries()).map(([ref, u]) => ({
            ref,
            cumpAfter: u.cumpAfter,
            realPrice: u.realPrice,
          })),
        },
      });
    },

    stockItems: () =>
      reactiveCalculationEngine.recalculateStockReactive(
        get().rawStock || [],
        get().mouvements || []
      ) as IStockItem[],

    effectiveDesignations: () => {
      const explicit = get().designations || [];
      if (explicit.length > 0) return explicit;
      return (get().rawStock || []).map((s) => ({
        id: s.id || s.ref,
        ref: s.ref,
        designation: s.designation,
        id_type: s.id_type,
        type: s.type,
        stockInitial: s.stockInitial,
        seuil: s.seuil,
        emplacement: s.emplacement,
      }));
    },
  };
}
