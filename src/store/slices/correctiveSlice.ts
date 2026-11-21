import { DataGateway } from '../../application/DataGateway';
import SortieExterneService from '../../application/services/SortieExterneService';
import {
  CorrectiveCalculationService,
  isMachineStoppageFlag,
} from '../../domain/corrective/services/CorrectiveCalculationService';
import { StockCalculationService } from '../../domain/pdr/services/StockCalculationService';
import { WorkOrderStateMachine } from '../../domain/corrective/services/WorkOrderStateMachine';
import {
  createWorkshopOrderRecord,
  validateWorkshopOrderTransition,
  isWorkshopOrderActive,
  getLinkedWorkshopOrdersForIntervention,
  computeLinkedInternalWorkshopCost,
  type IWorkshopOrder,
  type WorkshopOrderStatus,
} from '../../domain/corrective/workshopOrderService';
import {
  createNeedRequestRecord,
  validateNeedRequestTransition,
  validateNeedRequestFastTrack,
  hasBlockingNeedRequestForIntervention,
  getEffectivePolicyTags,
  type INeedRequest,
  type NeedRequestStatus,
  type CreateNeedRequestInput,
  type NeedMaterialClass,
} from '../../domain/corrective/needRequestService';
import {
  validateLotoConsignation,
  validateLotoDeconsignation,
  canStartWorkWithLoto,
} from '../../domain/corrective/lotoService';
import { storageService } from '../../utils/storageService';
import { STORAGE_KEYS } from '../../infrastructure/persistence/storageKeys';
import { loadBaselineCorrectiveData } from '../../utils/baselineCorrective';
import { safeId } from '../../utils/safeId';
import type {
  CorrectiveIntervenantEntry,
  CorrectiveInterventionItem,
  CorrectivePdrConsumedItem,
  GmaoStoreState,
  StateUpdater,
  ValidationReviewDecisionPayload,
} from '../../types/store';
import type { IMouvement } from '../../types/domain';
import { Logger } from '../../core/logger/LoggerService';
import {
  ACTIVE_LIVE_KEY,
  resolveUpdate,
  trackRemovedEntityIds,
  resolveActiveSessionRole,
  resolveActiveActorContext,
  isMakerCheckerSelfApproval,
  normalizeInterventionNature,
  isPartAlreadyDeductedByStoreBon,
  getInitialCorrective,
} from './storeBootstrapSlice';

type StoreSet = (
  partial: Partial<GmaoStoreState> | ((state: GmaoStoreState) => Partial<GmaoStoreState>)
) => void;
type StoreGet = () => GmaoStoreState;

export type CorrectiveSliceKeys = Pick<
  GmaoStoreState,
  | 'correctiveInterventions'
  | 'setCorrectiveInterventions'
  | 'correctiveActionsByPanne'
  | 'setCorrectiveActionsByPanne'
  | 'correctivePanneCategories'
  | 'setCorrectivePanneCategories'
  | 'correctiveTravauxAFaire'
  | 'setCorrectiveTravauxAFaire'
  | 'correctiveIntervenants'
  | 'setCorrectiveIntervenants'
  | 'activeLiveInterventionId'
  | 'setActiveLiveInterventionId'
  | 'handleGetCorrectiveActionsForPanne'
  | 'handleAddCorrectiveActionForPanne'
  | 'handleUpdateCorrectiveActionForPanne'
  | 'handleDeleteCorrectiveActionForPanne'
  | 'handleAddPanne'
  | 'handleUpdatePanne'
  | 'handleDeletePanne'
  | 'handleAddTravail'
  | 'handleUpdateTravail'
  | 'handleDeleteTravail'
  | 'handleResetCorrectiveActions'
  | 'handleForceSyncCorrectiveSeed'
  | 'handleAddDemandeIntervention'
  | 'handleConvertToBt'
  | 'handleStartLiveIntervention'
  | 'handleSubmitInterventionForValidation'
  | 'handleReviewInterventionValidation'
  | 'handleClotureIntervention'
  | 'handleUpdateCorrectiveIntervention'
  | 'handleDeleteCorrectiveIntervention'
  | 'handleBulkImportCorrective'
  | 'handleResetCorrectiveToSeed'
  | 'workshopOrders'
  | 'setWorkshopOrders'
  | 'handleCreateWorkshopOrder'
  | 'handleTransitionWorkshopOrderStatus'
  | 'needRequests'
  | 'setNeedRequests'
  | 'handleCreateNeedRequest'
  | 'handleReviewNeedRequest'
  | 'handleTransitionNeedRequestStatus'
  | 'handleFastTrackNeedRequest'
  | 'handleConsignInterventionLoto'
  | 'handleDeconsignInterventionLoto'
  | 'handleSaveInterventionReport'
  | 'correctiveKpis'
  | 'correctiveParetoAnomalies'
  | 'correctiveParetoMachines'
  | 'correctiveParetoTypes'
  | 'correctivePreventiveRecommendations'
>;

function matchesIntervention(bt: CorrectiveInterventionItem, id: string | number): boolean {
  const key = String(id ?? '').trim().toUpperCase();
  if (!key) return false;
  return (
    String(bt?.id ?? '').trim().toUpperCase() === key ||
    String(bt?.num_bt ?? '').trim().toUpperCase() === key
  );
}

function normalizePdrItems(items: unknown): CorrectivePdrConsumedItem[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((p: any) => {
      const ref = String(p?.ref || p?.reference || p?.code || '').trim();
      const qty = Number(p?.quantite ?? p?.qty ?? 0);
      const prixUnitaire = Number(p?.prix_unitaire ?? p?.unitPrice ?? p?.prix ?? 0);
      return {
        ...p,
        ref,
        designation: String(p?.designation || p?.nom || ref || 'PDR').trim(),
        quantite: Number.isFinite(qty) && qty > 0 ? qty : 0,
        ...(p?.unite || p?.unit ? { unite: p.unite || p.unit } : {}),
        ...(Number.isFinite(prixUnitaire) && prixUnitaire >= 0 ? { prix_unitaire: prixUnitaire } : {}),
      };
    })
    .filter((p) => Boolean(p.ref && p.quantite > 0));
}

function areSamePdrLists(
  a: CorrectivePdrConsumedItem[] = [],
  b: CorrectivePdrConsumedItem[] = []
): boolean {
  if (a.length !== b.length) return false;
  const sortKey = (list: CorrectivePdrConsumedItem[]) =>
    list
      .map((x) => `${String(x.ref).trim().toUpperCase()}:${Number(x.quantite) || 0}`)
      .sort()
      .join('|');
  return sortKey(a) === sortKey(b);
}

const NON_DESTRUCTIVE_ROLES = new Set([
  'TECHNICIEN',
  'TECHNICIAN',
  'OPERATEUR',
  'OPERATOR',
  'VIEWER',
  'OBSERVATEUR',
]);

const CORRECTIVE_VALIDATION_MANAGER_ROLES = new Set([
  'ADMIN',
  'RESPONSABLE',
  'RESPONSABLE_MAINTENANCE',
]);

function canManageCorrectiveValidationSession(explicitRole?: unknown): boolean {
  const role = String(explicitRole || resolveActiveSessionRole() || '')
    .trim()
    .toUpperCase();
  if (!role) return true; // Headless unit test without active browser session
  return CORRECTIVE_VALIDATION_MANAGER_ROLES.has(role);
}

function normalizeTypePanne(raw: unknown): string {
  const clean = String(raw || '').trim();
  if (!clean) return 'M';
  const upper = clean
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
  if (upper === 'M' || upper.startsWith('MECA')) return 'M';
  if (upper === 'E' || upper.startsWith('ELEC')) return 'E';
  if (upper === 'H' || upper.startsWith('HYDR')) return 'H';
  if (upper === 'P' || upper.startsWith('PNEU')) return 'P';
  if (upper === 'S' || upper.startsWith('SECU')) return 'S';
  if (upper === 'A' || upper.startsWith('AUTO')) return 'A';
  if (upper.startsWith('AUTR') || upper === 'OTHER') return 'AUTRE';
  return clean;
}

function normalizePriorite(raw: unknown): 'HAUTE' | 'MOYENNE' | 'BASSE' {
  const upper = String(raw || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
  if (
    upper.includes('CRITIQUE') ||
    upper.includes('URGENT') ||
    upper === 'HAUTE' ||
    upper === 'HIGH' ||
    upper === 'P1'
  ) {
    return 'HAUTE';
  }
  if (upper.includes('MINEUR') || upper === 'BASSE' || upper === 'LOW' || upper === 'P3') {
    return 'BASSE';
  }
  return 'MOYENNE';
}

function computeNextBtNumber(interventions: CorrectiveInterventionItem[]): string {
  const year = new Date().getFullYear();
  const prefix = `BT-${year}-`;
  let maxSeq = 0;
  for (const item of interventions || []) {
    const code = String(item?.num_bt || '').trim().toUpperCase();
    if (!code.startsWith(prefix)) continue;
    const match = code.match(/^BT-\d{4}-(\d+)$/);
    if (match) {
      const seq = Number(match[1]);
      if (Number.isFinite(seq) && seq > maxSeq) maxSeq = seq;
    }
  }
  return `${prefix}${String(maxSeq + 1).padStart(3, '0')}`;
}

function computeDowntimeMinutesForClosure(
  item: Record<string, any>,
  repairMinutes: number
): number {
  const explicitMins = CorrectiveCalculationService.timeStringToMinutes(item?.temps_arret);
  if (explicitMins > 0) return explicitMins;
  if (item?.temps_arret_minutes !== undefined && item?.temps_arret_minutes !== null && item?.temps_arret_minutes !== '') {
    const numeric = Number(item.temps_arret_minutes);
    if (Number.isFinite(numeric) && numeric >= 0) return Math.round(numeric);
  }
  if (isMachineStoppageFlag(item)) {
    return Math.max(0, Math.round(repairMinutes || 0));
  }
  return 0;
}

function resolveMachineAndTechnicianForBt(
  item: Record<string, any>,
  machines: any[] = [],
  technicians: any[] = []
): { machine?: any; technician?: any } {
  const mKey = String(item?.code_machine || item?.id_machine_registered || item?.id_machine || '')
    .trim()
    .toUpperCase();
  const machine = mKey
    ? (machines || []).find((m) => {
        const keys = [m?.id_machine_registered, m?.id, m?.code, m?.id_machine]
          .map((v) => String(v || '').trim().toUpperCase())
          .filter(Boolean);
        return keys.includes(mKey);
      })
    : undefined;

  const techIdKey = String(item?.technicien_matricule || '').trim().toUpperCase();
  const techNameKey = String(item?.intervenant || item?.submitted_by_name || '').trim().toUpperCase();
  const technician = (technicians || []).find((t) => {
    const idCandidates = [t?.id_technician, t?.id]
      .map((v) => String(v || '').trim().toUpperCase())
      .filter(Boolean);
    const nameCandidates = [t?.nom, t?.name]
      .map((v) => String(v || '').trim().toUpperCase())
      .filter(Boolean);
    if (techIdKey && idCandidates.includes(techIdKey)) return true;
    if (techNameKey && nameCandidates.includes(techNameKey)) return true;
    return false;
  });

  return { machine, technician };
}

function validateStockSufficiencyForDeduction(
  pieces: CorrectivePdrConsumedItem[],
  stockMap: Map<string, any>,
  currentMovements: IMouvement[],
  numBonSaisi: unknown,
  skipAllDeduction: boolean
): { valid: boolean; reason?: string } {
  if (skipAllDeduction || pieces.length === 0) return { valid: true };
  const pendingQtyByRef = new Map<string, { ref: string; qty: number }>();

  for (const piece of pieces) {
    const refKey = String(piece.ref || '').trim().toUpperCase();
    if (!refKey || piece.quantite <= 0) continue;
    if (isPartAlreadyDeductedByStoreBon(currentMovements, numBonSaisi, piece.ref)) continue;
    const prev = pendingQtyByRef.get(refKey);
    if (prev) {
      prev.qty += piece.quantite;
    } else {
      pendingQtyByRef.set(refKey, { ref: piece.ref, qty: piece.quantite });
    }
  }

  for (const [refKey, req] of pendingQtyByRef.entries()) {
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

function resolveCombinedWorkshopCost(
  existing: CorrectiveInterventionItem,
  linkedSorties: ReadonlyArray<{ cout_bobinage?: unknown; etat?: unknown }>,
  linkedWorkshopOrders: ReadonlyArray<IWorkshopOrder>,
  overrideCoutAtelier?: unknown
): number {
  const internalCost = computeLinkedInternalWorkshopCost(existing, linkedWorkshopOrders);
  const externalCost = (linkedSorties || []).reduce((sum, s) => {
    const val = Number(s?.cout_bobinage ?? 0);
    return Number.isFinite(val) && val > 0 ? sum + val : sum;
  }, 0);
  const derivedTotal = Number((externalCost + internalCost).toFixed(2));
  const explicitCost = Number(overrideCoutAtelier ?? existing.cout_atelier ?? 0) || 0;
  return Number(Math.max(explicitCost, derivedTotal).toFixed(2));
}

export function createCorrectiveSlice(set: StoreSet, get: StoreGet): CorrectiveSliceKeys {
  const initialCorrective = getInitialCorrective();

  return {
    correctiveInterventions: initialCorrective.interventions as CorrectiveInterventionItem[],
    correctiveActionsByPanne: initialCorrective.actionsByPanne as Record<string, string[]>,
    correctivePanneCategories: initialCorrective.panneCategories as Record<string, string[]>,
    correctiveTravauxAFaire: initialCorrective.travauxAFaire as string[],
    correctiveIntervenants: initialCorrective.intervenants as CorrectiveIntervenantEntry[],
    activeLiveInterventionId: initialCorrective.activeLiveId as string | number | null,
    workshopOrders: initialCorrective.workshopOrders as IWorkshopOrder[],
    needRequests: initialCorrective.needRequests as INeedRequest[],

    setCorrectiveInterventions: (updater: StateUpdater<CorrectiveInterventionItem[]>) => {
      const prev = get().correctiveInterventions || [];
      const next = resolveUpdate(updater, prev);
      trackRemovedEntityIds('correctiveInterventions', prev, next);
      DataGateway.saveCorrectiveInterventions(next, { machines: get().machines, strict: false });
      set({ correctiveInterventions: next });
    },

    setCorrectiveActionsByPanne: (updater: StateUpdater<Record<string, string[]>>) => {
      const prev = get().correctiveActionsByPanne || {};
      const next = resolveUpdate(updater, prev);
      DataGateway.saveCorrectiveActionsByPanne(next);
      set({ correctiveActionsByPanne: next });
    },

    setCorrectivePanneCategories: (updater: StateUpdater<Record<string, string[]>>) => {
      const prev = get().correctivePanneCategories || {};
      const next = resolveUpdate(updater, prev);
      DataGateway.saveCorrectivePanneCategories(next);
      set({ correctivePanneCategories: next });
    },

    setCorrectiveTravauxAFaire: (updater: StateUpdater<string[]>) => {
      const prev = get().correctiveTravauxAFaire || [];
      const next = resolveUpdate(updater, prev);
      DataGateway.saveCorrectiveTravaux(next);
      set({ correctiveTravauxAFaire: next });
    },

    setCorrectiveIntervenants: (updater: StateUpdater<CorrectiveIntervenantEntry[]>) => {
      const prev = get().correctiveIntervenants || [];
      const next = resolveUpdate(updater, prev);
      DataGateway.saveCorrectiveIntervenants(next);
      set({ correctiveIntervenants: next });
    },

    setActiveLiveInterventionId: (id: string | number | null) => {
      storageService.setItem(ACTIVE_LIVE_KEY, id);
      set({ activeLiveInterventionId: id });
    },

    setWorkshopOrders: (updater: StateUpdater<IWorkshopOrder[]>) => {
      const prev = get().workshopOrders || [];
      const next = resolveUpdate(updater, prev);
      trackRemovedEntityIds('workshopOrders', prev, next);
      DataGateway.saveWorkshopOrders(next);
      set({ workshopOrders: next });
    },

    setNeedRequests: (updater: StateUpdater<INeedRequest[]>) => {
      const prev = get().needRequests || [];
      const next = resolveUpdate(updater, prev);
      trackRemovedEntityIds('needRequests', prev, next);
      DataGateway.saveNeedRequests(next);
      set({ needRequests: next });
    },

    handleGetCorrectiveActionsForPanne: (anomalie: string) => {
      const dict = get().correctiveActionsByPanne || {};
      if (!anomalie) return [];
      if (Array.isArray(dict[anomalie])) return dict[anomalie];
      const upper = String(anomalie).trim().toUpperCase();
      const matchedKey = Object.keys(dict).find((k) => k.trim().toUpperCase() === upper);
      return matchedKey && Array.isArray(dict[matchedKey]) ? dict[matchedKey] : [];
    },

    handleAddCorrectiveActionForPanne: (panneKey: string, actionText: string) => {
      const cleanKey = String(panneKey || '').trim();
      const cleanText = String(actionText || '').trim();
      if (!cleanKey || !cleanText) return;
      get().setCorrectiveActionsByPanne((prev) => {
        const current = Array.isArray(prev[cleanKey]) ? prev[cleanKey] : [];
        if (current.includes(cleanText)) return prev;
        return { ...prev, [cleanKey]: [...current, cleanText] };
      });
    },

    handleUpdateCorrectiveActionForPanne: (panneKey: string, actionIndex: number, newActionText: string) => {
      const cleanText = String(newActionText || '').trim();
      if (!cleanText) return;
      get().setCorrectiveActionsByPanne((prev) => {
        const current = Array.isArray(prev[panneKey]) ? [...prev[panneKey]] : [];
        if (actionIndex < 0 || actionIndex >= current.length) return prev;
        current[actionIndex] = cleanText;
        return { ...prev, [panneKey]: current };
      });
    },

    handleDeleteCorrectiveActionForPanne: (panneKey: string, actionIndex: number) => {
      get().setCorrectiveActionsByPanne((prev) => {
        const current = Array.isArray(prev[panneKey]) ? [...prev[panneKey]] : [];
        if (actionIndex < 0 || actionIndex >= current.length) return prev;
        current.splice(actionIndex, 1);
        return { ...prev, [panneKey]: current };
      });
    },

    handleAddPanne: (category: string, panneCode: string) => {
      const cleanCat = String(category || 'M').trim();
      const cleanCode = String(panneCode || '').trim();
      if (!cleanCode) return;
      get().setCorrectivePanneCategories((prev) => {
        const list = Array.isArray(prev[cleanCat]) ? prev[cleanCat] : [];
        if (list.includes(cleanCode)) return prev;
        return { ...prev, [cleanCat]: [...list, cleanCode] };
      });
    },

    handleUpdatePanne: (category: string, oldCode: string, newCode: string) => {
      const cleanNew = String(newCode || '').trim();
      if (!cleanNew) return;
      get().setCorrectivePanneCategories((prev) => {
        const list = Array.isArray(prev[category]) ? prev[category] : [];
        return {
          ...prev,
          [category]: list.map((c) => (c === oldCode ? cleanNew : c)),
        };
      });
    },

    handleDeletePanne: (category: string, panneCode: string) => {
      get().setCorrectivePanneCategories((prev) => {
        const list = Array.isArray(prev[category]) ? prev[category] : [];
        return {
          ...prev,
          [category]: list.filter((c) => c !== panneCode),
        };
      });
    },

    handleAddTravail: (travailText: string) => {
      const clean = String(travailText || '').trim();
      if (!clean) return;
      get().setCorrectiveTravauxAFaire((prev) =>
        (prev || []).includes(clean) ? prev : [...(prev || []), clean]
      );
    },

    handleUpdateTravail: (oldText: string, newText: string) => {
      const cleanNew = String(newText || '').trim();
      if (!cleanNew) return;
      get().setCorrectiveTravauxAFaire((prev) =>
        (prev || []).map((t) => (t === oldText ? cleanNew : t))
      );
    },

    handleDeleteTravail: (travailText: string) => {
      get().setCorrectiveTravauxAFaire((prev) =>
        (prev || []).filter((t) => t !== travailText)
      );
    },

    handleResetCorrectiveActions: async () => {
      DataGateway.syncCmCatalogBaseline({
        setCorrectiveActionsByPanne: (val) => get().setCorrectiveActionsByPanne(val),
        setCorrectivePanneCategories: (val) => get().setCorrectivePanneCategories(val),
        setCorrectiveTravauxAFaire: (val) => get().setCorrectiveTravauxAFaire(val),
      });
    },

    handleForceSyncCorrectiveSeed: async () => {
      const synced = DataGateway.syncCmCatalogBaseline({
        setCorrectiveActionsByPanne: (val) => get().setCorrectiveActionsByPanne(val),
        setCorrectivePanneCategories: (val) => get().setCorrectivePanneCategories(val),
        setCorrectiveTravauxAFaire: (val) => get().setCorrectiveTravauxAFaire(val),
      });
      return {
        interventionsCount: synced.interventionsCount,
        pannesCount: synced.pannesCount,
        categoriesCount: synced.categoriesCount,
        travauxCount: synced.travauxCount,
        actionsCount: synced.actionsCount,
        intervenantsCount: (get().correctiveIntervenants || []).length,
      };
    },

    handleAddDemandeIntervention: (data) => {
      const nowIso = new Date().toISOString();
      const today = nowIso.slice(0, 10);
      const timeNow = nowIso.slice(11, 16);
      const requiresLoto = Boolean(data?.requires_loto);
      const created: CorrectiveInterventionItem = {
        ...data,
        id: String(data?.id || safeId('DI')).trim(),
        code_machine: String(data?.code_machine || data?.id_machine_registered || '').trim(),
        type_panne: normalizeTypePanne(data?.type_panne),
        priorite: normalizePriorite(data?.priorite),
        statut: 'DEMANDE',
        action_fermee: 'NON',
        requires_loto: requiresLoto,
        ...(requiresLoto
          ? {
              loto_status: 'ATTENTE_CONSIGNATION' as const,
              loto: {
                required: true,
                status: 'ATTENTE_CONSIGNATION' as const,
                energy_types: [],
              },
            }
          : {}),
        demande_date: data?.demande_date || data?.date_demande || today,
        date_demande: data?.date_demande || data?.demande_date || today,
        demande_heure: data?.demande_heure || data?.heure_demande || timeNow,
        heure_demande: data?.heure_demande || data?.demande_heure || timeNow,
        created_at: nowIso,
        updated_at: nowIso,
      };

      get().setCorrectiveInterventions((prev) => [created, ...(prev || [])]);
      return created;
    },

    handleConvertToBt: (id, btDetails: Record<string, any> = {}) => {
      const current = get().correctiveInterventions || [];
      const existing = current.find((i) => matchesIntervention(i, id));
      if (!existing) return null;

      const requiresLoto = Boolean(btDetails?.requires_loto ?? existing.requires_loto);
      const targetStatut = String(
        btDetails?.statut || (requiresLoto ? 'BT_PLANIFIE' : 'EN_COURS')
      ).trim();

      const candidateRecord: CorrectiveInterventionItem = {
        ...existing,
        ...btDetails,
        requires_loto: requiresLoto,
        ...(requiresLoto && !existing.loto?.status && !existing.loto_status
          ? {
              loto_status: 'ATTENTE_CONSIGNATION',
              loto: { required: true, status: 'ATTENTE_CONSIGNATION', energy_types: [] },
            }
          : {}),
      };

      const check = WorkOrderStateMachine.validateTransition(candidateRecord, targetStatut, {
        ...btDetails,
        code_machine: btDetails.code_machine || existing.code_machine || existing.machine,
      });
      if (!check.valid) return null;

      const nowIso = new Date().toISOString();
      const today = nowIso.slice(0, 10);
      const timeNow = nowIso.slice(11, 16);

      const updated: CorrectiveInterventionItem = {
        ...existing,
        ...btDetails,
        ...(btDetails?.type_panne ? { type_panne: normalizeTypePanne(btDetails.type_panne) } : {}),
        ...(btDetails?.priorite ? { priorite: normalizePriorite(btDetails.priorite) } : {}),
        requires_loto: requiresLoto,
        ...(requiresLoto && !existing.loto?.status && !existing.loto_status
          ? {
              loto_status: 'ATTENTE_CONSIGNATION' as const,
              loto: { required: true, status: 'ATTENTE_CONSIGNATION' as const, energy_types: [] },
            }
          : {}),
        num_bt: String(
          btDetails?.num_bt || existing.num_bt || computeNextBtNumber(current)
        ).trim(),
        statut: targetStatut,
        action_fermee: 'NON',
        date_debut: btDetails?.date_debut || existing.date_debut || today,
        heure_debut: btDetails?.heure_debut || existing.heure_debut || timeNow,
        updated_at: nowIso,
      };

      get().setCorrectiveInterventions((prev) =>
        (prev || []).map((i) => (matchesIntervention(i, id) ? updated : i))
      );
      return updated;
    },

    handleStartLiveIntervention: (id) => {
      const current = get().correctiveInterventions || [];
      const existing = current.find((i) => matchesIntervention(i, id));
      if (!existing) return;

      // Focus the BT in Live View even when LOTO blocks EN_COURS so the operator can open the LOTO permit panel
      get().setActiveLiveInterventionId(existing.id ?? id);

      const lotoCheck = canStartWorkWithLoto(existing);
      if (!lotoCheck.valid) return;

      const nowIso = new Date().toISOString();
      get().setCorrectiveInterventions((prev) =>
        (prev || []).map((i) =>
          matchesIntervention(i, id)
            ? {
                ...i,
                statut: i.statut === 'CLOTURE' ? i.statut : 'EN_COURS',
                date_debut: i.date_debut || nowIso.slice(0, 10),
                heure_debut: i.heure_debut || nowIso.slice(11, 16),
                updated_at: nowIso,
              }
            : i
        )
      );
    },

    handleSubmitInterventionForValidation: (id, submissionData: Record<string, any> = {}) => {
      const current = get().correctiveInterventions || [];
      const existing = current.find((i) => matchesIntervention(i, id));
      if (!existing) return null;

      const nowIso = new Date().toISOString();
      const actor = resolveActiveActorContext();
      const prevStatus = String(existing.validation_status || '').trim().toUpperCase();
      const prevNote = String(existing.validation_note || '').trim();
      const isResubmission = prevStatus === 'NEEDS_CLARIFICATION' || prevStatus === 'REJECTED';

      const rawProposed =
        submissionData.pieces_proposees ??
        submissionData.pieces_utilisees ??
        submissionData.pdr_proposees ??
        submissionData.pdr_utilisees ??
        existing.pieces_proposees ??
        [];
      const normalizedProposed = normalizePdrItems(rawProposed);

      const dDebut = String(submissionData.date_debut || existing.date_debut || existing.date || nowIso.slice(0, 10));
      const hDebut = String(submissionData.heure_debut || existing.heure_debut || '08:00');
      const dFin = String(submissionData.date_fin_proposee || submissionData.date_fin || dDebut);
      const hFin = String(submissionData.heure_fin_proposee || submissionData.heure_fin || nowIso.slice(11, 16));

      const timing = CorrectiveCalculationService.calculateWorkingTime(dDebut, hDebut, dFin, hFin);
      const nature = normalizeInterventionNature(submissionData.intervention_nature ?? existing.intervention_nature);
      const stockEffect = normalizedProposed.length > 0 ? 'RESERVED' : 'NONE';

      const updated: CorrectiveInterventionItem = {
        ...existing,
        ...submissionData,
        ...(nature ? { intervention_nature: nature } : {}),
        pieces_proposees: normalizedProposed,
        pieces_claimed: normalizedProposed,
        pieces_utilisees: [],
        pdr_utilisees: [],
        pdr_quantite: 0,
        statut: existing.statut === 'CLOTURE' ? 'EN_COURS' : existing.statut || 'EN_COURS',
        action_fermee: 'NON',
        validation_status: 'PENDING_VALIDATION',
        validation_note: '',
        ...(isResubmission
          ? {
              previous_validation_status: prevStatus,
              previous_validation_note: prevNote,
              resubmitted_count: Number(existing.resubmitted_count || 0) + 1,
            }
          : {}),
        submitted_by_id: String(submissionData.submitted_by_id || existing.submitted_by_id || actor.actorId).trim(),
        submitted_by_name: String(
          submissionData.submitted_by_name || existing.submitted_by_name || existing.intervenant || actor.actorName
        ).trim(),
        submitted_at: String(submissionData.submitted_at || nowIso),
        date_fin_proposee: dFin,
        heure_fin_proposee: hFin,
        temps_intervention_propose: submissionData.temps_intervention_propose || timing.formatted,
        stock_deducted: false,
        stock_effect: stockEffect,
        updated_at: nowIso,
      };

      get().setCorrectiveInterventions((prev) =>
        (prev || []).map((i) => (matchesIntervention(i, id) ? updated : i))
      );

      if (String(get().activeLiveInterventionId ?? '') === String(existing.id ?? id)) {
        get().setActiveLiveInterventionId(null);
      }

      return updated;
    },

    handleReviewInterventionValidation: (
      id,
      decisionData: ValidationReviewDecisionPayload = {},
      onAddMouvement = null
    ) => {
      if (!canManageCorrectiveValidationSession(decisionData?.actorRole)) {
        Logger.warn('[CorrectiveSlice] RBAC blocked handleReviewInterventionValidation');
        return null;
      }

      const current = get().correctiveInterventions || [];
      const existing = current.find((i) => matchesIntervention(i, id));
      if (!existing) return null;

      if (
        String(existing.validation_status || '').toUpperCase() === 'APPROVED' ||
        existing.statut === 'CLOTURE'
      ) {
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

      if (decision === 'NEEDS_CLARIFICATION' || decision === 'REJECTED') {
        const nextStatus = decision === 'REJECTED' ? 'REJECTED' : 'NEEDS_CLARIFICATION';
        const updated: CorrectiveInterventionItem = {
          ...existing,
          validation_status: nextStatus,
          validated_by_id: validatorId,
          validated_by_name: validatorName,
          validated_at: nowIso,
          validation_note: validationNote,
          statut: 'EN_COURS',
          action_fermee: 'NON',
          stock_deducted: false,
          stock_effect: nextStatus === 'REJECTED' ? 'NONE' : existing.stock_effect || 'RESERVED',
          pieces_utilisees: [],
          updated_at: nowIso,
        };

        get().setCorrectiveInterventions((prev) =>
          (prev || []).map((i) => (matchesIntervention(i, id) ? updated : i))
        );

        get().appendAuditEvent({
          actorId: validatorId,
          actorName: validatorName,
          actorRole: actor.actorRole,
          actionType: nextStatus === 'REJECTED' ? 'VALIDATION_REJECTED' : 'VALIDATION_NEEDS_CLARIFICATION',
          entityType: 'CORRECTIVE_BT',
          entityId: String(existing.id || id),
          before: { validation_status: existing.validation_status },
          after: { validation_status: nextStatus, validation_note: validationNote },
        });
        return updated;
      }

      // Enforce Segregation of Duties (SoD): submitter cannot approve their own corrective claim
      if (
        isMakerCheckerSelfApproval({
          submitterId: existing.submitted_by_id,
          submitterName: existing.submitted_by_name || existing.intervenant,
          validatorId,
          validatorName,
          hasExplicitValidatorId: Boolean(explicitValidatorId),
          hasActiveSession,
        })
      ) {
        Logger.warn('[CorrectiveSlice] SoD blocked self-approval on BT validation', {
          btId: String(existing.id || id),
          validatorId,
        });
        return null;
      }

      // APPROVED branch: verify FSM guards first
      const linkedSorties = SortieExterneService.getLinkedOrdersForBt(
        existing,
        get().sortiesExterne || []
      );
      const openSorties = linkedSorties.some((s) =>
        SortieExterneService.isWorkshopOrderOpen(s.etat)
      );
      const linkedWorkshopOrders = getLinkedWorkshopOrdersForIntervention(
        existing,
        get().workshopOrders || []
      );
      const openWorkshopOrders = linkedWorkshopOrders.some((o) => isWorkshopOrderActive(o));
      const openNeedRequest = hasBlockingNeedRequestForIntervention(
        { ...existing, ...(decisionData || {}) },
        get().needRequests || []
      );

      const fsmCheck = WorkOrderStateMachine.validateTransition(existing, 'CLOTURE', {
        ...decisionData,
        action_realisee:
          decisionData?.action_realisee ||
          existing.action_realisee ||
          existing.travail_a_faire ||
          existing.anomalie ||
          'Validé',
        hasOpenWorkshopOrder: openSorties || openWorkshopOrders,
        hasOpenNeedRequest: openNeedRequest,
      });
      if (!fsmCheck.valid) return null;

      const claimedPieces = normalizePdrItems(
        existing.pieces_claimed ?? existing.pieces_proposees ?? existing.pdr_utilisees ?? []
      );
      const rawApproved =
        decisionData?.pieces_utilisees ??
        decisionData?.approvedItems ??
        existing.pieces_proposees ??
        existing.pdr_utilisees ??
        [];
      const approvedPieces = normalizePdrItems(rawApproved);
      const editedByAdmin =
        Boolean(decisionData?.pieces_utilisees) && !areSamePdrLists(claimedPieces, approvedPieces);

      const currentMovements = get().mouvements || [];
      const stockMap = new Map<string, any>();
      for (const s of get().rawStock || []) {
        const refKey = String(s?.ref || (s as any)?.reference || '').trim().toUpperCase();
        if (refKey) stockMap.set(refKey, s);
      }

      const skipDeduction = Boolean(decisionData?.skipStockDeduction);
      const stockSufficiency = validateStockSufficiencyForDeduction(
        approvedPieces,
        stockMap,
        currentMovements,
        existing.num_bon_saisi_par_tech,
        skipDeduction
      );
      if (!stockSufficiency.valid) return null;

      const bonRef = `BS-BT-${existing.id || id}`;
      const newMovements: IMouvement[] = [];
      const emittedIds: string[] = [];
      let totalPdrCost = 0;

      for (const piece of approvedPieces) {
        const stockMatch = stockMap.get(piece.ref.toUpperCase());
        const unitPrice =
          Number(piece.prix_unitaire) ||
          Number(stockMatch?.prixUnitaire) ||
          Number(stockMatch?.prix_unitaire) ||
          Number(stockMatch?.prix_achat_ht) ||
          Number(stockMatch?.prix) ||
          0;
        totalPdrCost += unitPrice * piece.quantite;

        const alreadyDeducted =
          skipDeduction ||
          isPartAlreadyDeductedByStoreBon(
            currentMovements,
            existing.num_bon_saisi_par_tech,
            piece.ref
          );
        if (!alreadyDeducted) {
          const mvtId = safeId('MVT');
          emittedIds.push(mvtId);
          newMovements.push({
            id: mvtId,
            code_bon: bonRef,
            num_bon_saisi_par_tech: existing.num_bon_saisi_par_tech,
            source_bt_id: String(existing.id || id),
            type: 'Sortie Interne',
            ref: piece.ref,
            designation: piece.designation || piece.ref,
            quantite: piece.quantite,
            date: existing.date_fin_proposee || nowIso.slice(0, 10),
            technicien: existing.submitted_by_name || existing.intervenant || validatorName,
            id_machine_registered: existing.code_machine || existing.id_machine_registered,
            id_zone: existing.zone || existing.id_zone,
            action_id: 'CORRECTIVE',
            prix_unitaire: unitPrice,
          });
        }
      }

      if (newMovements.length > 0) {
        get().setMouvements((prev) => [...newMovements, ...(prev || [])]);
        if (typeof onAddMouvement === 'function') {
          for (const mv of newMovements) {
            onAddMouvement(mv);
          }
        }
      }

      const dDebut = String(existing.date_debut || existing.date || nowIso.slice(0, 10));
      const hDebut = String(existing.heure_debut || '08:00');
      const dFin = String(decisionData?.date_fin || existing.date_fin_proposee || dDebut);
      const hFin = String(decisionData?.heure_fin || existing.heure_fin_proposee || '17:00');
      const timing = CorrectiveCalculationService.calculateWorkingTime(dDebut, hDebut, dFin, hFin);
      const resolvedRepairMins =
        Number(decisionData?.temps_intervention_mins) ||
        existing.temps_intervention_mins ||
        timing.minutes;
      const resolvedDowntimeMins = computeDowntimeMinutesForClosure(
        { ...existing, ...decisionData },
        resolvedRepairMins
      );

      const coutAtelier = resolveCombinedWorkshopCost(
        existing,
        linkedSorties,
        linkedWorkshopOrders,
        decisionData?.cout_atelier
      );
      const coutPdr = Number(totalPdrCost.toFixed(2));
      const coutTotal = Number((coutPdr + coutAtelier).toFixed(2));
      const { machine: linkedMachine, technician: linkedTech } = resolveMachineAndTechnicianForBt(
        { ...existing, ...decisionData },
        get().machines || [],
        get().technicians || []
      );
      const tcoBreakdown = CorrectiveCalculationService.computeInterventionCostBreakdown(
        {
          ...existing,
          ...decisionData,
          cout_pdr: coutPdr,
          cout_atelier: coutAtelier,
          temps_intervention_mins: resolvedRepairMins,
          temps_arret_minutes: resolvedDowntimeMins,
        },
        { machine: linkedMachine, technician: linkedTech, stockMap }
      );
      const nature = normalizeInterventionNature(
        decisionData?.intervention_nature ?? existing.intervention_nature
      );

      const formattedRepair =
        decisionData?.temps_intervention ||
        existing.temps_intervention_propose ||
        timing.formatted;

      const closedBt: CorrectiveInterventionItem = {
        ...existing,
        ...decisionData,
        ...(nature ? { intervention_nature: nature } : {}),
        statut: 'CLOTURE',
        action_fermee: 'OUI',
        validation_status: 'APPROVED',
        validated_by_id: validatorId,
        validated_by_name: validatorName,
        validated_at: nowIso,
        validation_note: validationNote,
        validated_with_edits: editedByAdmin,
        pieces_claimed: claimedPieces,
        pieces_utilisees: approvedPieces,
        pdr_utilisees: approvedPieces,
        pdr_quantite: approvedPieces.reduce((sum, p) => sum + p.quantite, 0),
        date_fin: dFin,
        heure_fin: hFin,
        date_cloture: nowIso.slice(0, 10),
        temps_intervention: formattedRepair,
        temps_intervention_calc: formattedRepair,
        temps_intervention_mins: resolvedRepairMins,
        temps_arret_minutes: resolvedDowntimeMins,
        cout_pdr: coutPdr,
        cout_atelier: coutAtelier,
        taux_horaire: tcoBreakdown.tauxHoraire,
        cout_main_oeuvre: tcoBreakdown.coutMainOeuvre,
        cout_arret_horaire: tcoBreakdown.coutArretHoraire,
        cout_arret_production: tcoBreakdown.coutArretProduction,
        cout_total: coutTotal,
        cout_total_tco: tcoBreakdown.coutTotalTco,
        stock_deducted: emittedIds.length > 0 || (skipDeduction && approvedPieces.length > 0),
        stock_effect:
          emittedIds.length > 0
            ? 'APPLIED'
            : skipDeduction && approvedPieces.length > 0
            ? 'ALREADY_DEDUCTED_BY_STORE'
            : 'NONE',
        emitted_movement_ids: emittedIds,
        updated_at: nowIso,
      };

      get().setCorrectiveInterventions((prev) =>
        (prev || []).map((i) => (matchesIntervention(i, id) ? closedBt : i))
      );

      get().appendAuditEvent({
        actorId: validatorId,
        actorName: validatorName,
        actorRole: actor.actorRole,
        actionType: 'VALIDATION_APPROVED',
        entityType: 'CORRECTIVE_BT',
        entityId: String(existing.id || id),
        before: { validation_status: existing.validation_status, statut: existing.statut },
        after: {
          validation_status: 'APPROVED',
          statut: 'CLOTURE',
          cout_total: coutTotal,
          cout_main_oeuvre: tcoBreakdown.coutMainOeuvre,
          cout_arret_production: tcoBreakdown.coutArretProduction,
          cout_total_tco: tcoBreakdown.coutTotalTco,
          validated_with_edits: editedByAdmin,
          skip_stock_deduction: skipDeduction,
          emitted_movement_ids: emittedIds,
        },
      });

      return closedBt;
    },

    handleClotureIntervention: (
      id,
      clotureData: Partial<CorrectiveInterventionItem> & Record<string, any> = {},
      onAddMouvement = null
    ) => {
      const current = get().correctiveInterventions || [];
      const existing = current.find((i) => matchesIntervention(i, id));
      if (!existing) return null;

      // Maker-Checker guard: Technicians / Operators cannot bypass supervisor validation on closure
      const effectiveRole = String(
        clotureData?.actorRole || resolveActiveSessionRole() || ''
      )
        .trim()
        .toUpperCase();
      if (
        clotureData?.isTechnician === true ||
        effectiveRole === 'TECHNICIEN' ||
        effectiveRole === 'OPERATEUR'
      ) {
        return get().handleSubmitInterventionForValidation(id, {
          ...clotureData,
          pieces_proposees:
            clotureData?.pieces_proposees ??
            clotureData?.pieces_utilisees ??
            clotureData?.pdr_utilisees ??
            [],
          date_fin_proposee: clotureData?.date_fin_proposee ?? clotureData?.date_fin,
          heure_fin_proposee: clotureData?.heure_fin_proposee ?? clotureData?.heure_fin,
        });
      }

      // Check linked open workshop/external orders or incomplete need requests
      const linkedSorties = SortieExterneService.getLinkedOrdersForBt(
        existing,
        get().sortiesExterne || []
      );
      const hasOpenSortie = linkedSorties.some((s) =>
        SortieExterneService.isWorkshopOrderOpen(s.etat)
      );
      const linkedWorkshopOrders = getLinkedWorkshopOrdersForIntervention(
        existing,
        get().workshopOrders || []
      );
      const hasOpenWorkshop = linkedWorkshopOrders.some((o) => isWorkshopOrderActive(o));
      const hasOpenNeed = hasBlockingNeedRequestForIntervention(
        { ...existing, ...clotureData },
        get().needRequests || []
      );

      const fsmResult = WorkOrderStateMachine.validateTransition(existing, 'CLOTURE', {
        ...clotureData,
        hasOpenWorkshopOrder:
          Boolean(clotureData?.hasOpenWorkshopOrder) || hasOpenSortie || hasOpenWorkshop,
        hasOpenNeedRequest: Boolean(clotureData?.hasOpenNeedRequest) || hasOpenNeed,
      });

      if (!fsmResult.valid) {
        return null;
      }

      const nowIso = new Date().toISOString();
      const actor = resolveActiveActorContext();
      let pieces = normalizePdrItems(
        clotureData?.pieces_utilisees ??
          clotureData?.pdr_utilisees ??
          existing.pieces_utilisees ??
          []
      );
      if (pieces.length === 0) {
        const singleRef = String(clotureData?.pdr_ref || existing.pdr_ref || '').trim();
        const singleQty = Number(clotureData?.pdr_quantite ?? existing.pdr_quantite ?? 0);
        if (singleRef && Number.isFinite(singleQty) && singleQty > 0) {
          pieces = normalizePdrItems([
            {
              ref: singleRef,
              designation: String(
                clotureData?.pdr_designation || existing.pdr_designation || singleRef
              ).trim(),
              quantite: singleQty,
              prix_unitaire: Number(clotureData?.pdr_prix ?? existing.pdr_prix ?? 0) || 0,
            },
          ]);
        }
      }

      const currentMovements = get().mouvements || [];
      const stockMap = new Map<string, any>();
      for (const s of get().rawStock || []) {
        const refKey = String(s?.ref || (s as any)?.reference || '').trim().toUpperCase();
        if (refKey) stockMap.set(refKey, s);
      }

      const skipDeduction = Boolean(clotureData?.skipStockDeduction);
      const stockSufficiency = validateStockSufficiencyForDeduction(
        pieces,
        stockMap,
        currentMovements,
        clotureData?.num_bon_saisi_par_tech ?? existing.num_bon_saisi_par_tech,
        skipDeduction
      );
      if (!stockSufficiency.valid) {
        return null;
      }

      const manualBon = String(
        clotureData?.num_bon_saisi_par_tech || existing.num_bon_saisi_par_tech || ''
      ).trim();
      const baseBtBon = `BS-BT-${existing.num_bt || existing.id || id}`;

      const newMovements: IMouvement[] = [];
      const emittedIds: string[] = [];
      let totalPdrCost = 0;

      for (let idx = 0; idx < pieces.length; idx++) {
        const piece = pieces[idx];
        const stockMatch = stockMap.get(piece.ref.toUpperCase());
        const unitPrice =
          Number(piece.prix_unitaire) ||
          Number(stockMatch?.prixUnitaire) ||
          Number(stockMatch?.prix_unitaire) ||
          Number(stockMatch?.prix_achat_ht) ||
          Number(stockMatch?.prix) ||
          0;
        totalPdrCost += unitPrice * piece.quantite;

        const bonRef =
          manualBon || (pieces.length > 1 ? `${baseBtBon}-${idx + 1}` : baseBtBon);

        const alreadyDeducted =
          skipDeduction ||
          isPartAlreadyDeductedByStoreBon(
            currentMovements,
            clotureData?.num_bon_saisi_par_tech ?? existing.num_bon_saisi_par_tech,
            piece.ref
          );
        if (!alreadyDeducted) {
          const mvtId = safeId('MVT');
          emittedIds.push(mvtId);
          newMovements.push({
            id: mvtId,
            code_bon: bonRef,
            source_bt_id: String(existing.id || id),
            type: 'Sortie Interne',
            ref: piece.ref,
            designation: piece.designation || piece.ref,
            quantite: piece.quantite,
            date: clotureData?.date_fin || nowIso.slice(0, 10),
            technicien: clotureData?.intervenant || existing.intervenant || actor.actorName,
            id_machine_registered: existing.code_machine || existing.id_machine_registered,
            id_zone: existing.zone || existing.id_zone,
            action_id: 'CORRECTIVE',
            prix_unitaire: unitPrice,
          });
        }
      }

      if (newMovements.length > 0) {
        get().setMouvements((prev) => [...newMovements, ...(prev || [])]);
        if (typeof onAddMouvement === 'function') {
          for (const mv of newMovements) {
            onAddMouvement(mv);
          }
        }
      }

      const dDebut = String(clotureData?.date_debut || existing.date_debut || nowIso.slice(0, 10));
      const hDebut = String(clotureData?.heure_debut || existing.heure_debut || '08:00');
      const dFin = String(clotureData?.date_fin || nowIso.slice(0, 10));
      const hFin = String(clotureData?.heure_fin || nowIso.slice(11, 16));
      const timing = CorrectiveCalculationService.calculateWorkingTime(dDebut, hDebut, dFin, hFin);
      const resolvedRepairMins =
        Number(clotureData?.temps_intervention_mins) ||
        existing.temps_intervention_mins ||
        timing.minutes;
      const resolvedDowntimeMins = computeDowntimeMinutesForClosure(
        { ...existing, ...clotureData },
        resolvedRepairMins
      );

      const coutPdr = Number(totalPdrCost.toFixed(2));
      const coutAtelier = resolveCombinedWorkshopCost(
        existing,
        linkedSorties,
        linkedWorkshopOrders,
        clotureData?.cout_atelier
      );
      const coutTotal = Number((coutPdr + coutAtelier).toFixed(2));
      const { machine: linkedMachine, technician: linkedTech } = resolveMachineAndTechnicianForBt(
        { ...existing, ...clotureData },
        get().machines || [],
        get().technicians || []
      );
      const tcoBreakdown = CorrectiveCalculationService.computeInterventionCostBreakdown(
        {
          ...existing,
          ...clotureData,
          cout_pdr: coutPdr,
          cout_atelier: coutAtelier,
          temps_intervention_mins: resolvedRepairMins,
          temps_arret_minutes: resolvedDowntimeMins,
        },
        { machine: linkedMachine, technician: linkedTech, stockMap }
      );
      const nature = normalizeInterventionNature(
        clotureData?.intervention_nature ?? existing.intervention_nature
      );

      const firstPiece = pieces[0];
      const summaryDesignation = firstPiece
        ? pieces.length > 1
          ? `${firstPiece.designation} (+${pieces.length - 1} réf.)`
          : firstPiece.designation
        : clotureData?.pdr_designation ?? existing.pdr_designation;

      const formattedRepair = clotureData?.temps_intervention || timing.formatted;

      const closedBt: CorrectiveInterventionItem = {
        ...existing,
        ...clotureData,
        ...(nature ? { intervention_nature: nature } : {}),
        statut: 'CLOTURE',
        action_fermee: 'OUI',
        validation_status: 'APPROVED',
        validated_by_id: String(clotureData?.validated_by_id || actor.actorId),
        validated_by_name: String(clotureData?.validated_by_name || actor.actorName),
        validated_at: nowIso,
        pieces_utilisees: pieces,
        pdr_utilisees: pieces,
        ...(firstPiece
          ? {
              pdr_ref: firstPiece.ref,
              pdr_designation: summaryDesignation,
            }
          : {}),
        pdr_quantite: pieces.reduce((sum, p) => sum + p.quantite, 0),
        date_fin: dFin,
        heure_fin: hFin,
        date_cloture: clotureData?.date_cloture || dFin,
        temps_intervention: formattedRepair,
        temps_intervention_calc: formattedRepair,
        temps_intervention_mins: resolvedRepairMins,
        temps_arret_minutes: resolvedDowntimeMins,
        cout_pdr: coutPdr,
        cout_atelier: coutAtelier,
        taux_horaire: tcoBreakdown.tauxHoraire,
        cout_main_oeuvre: tcoBreakdown.coutMainOeuvre,
        cout_arret_horaire: tcoBreakdown.coutArretHoraire,
        cout_arret_production: tcoBreakdown.coutArretProduction,
        cout_total: coutTotal,
        cout_total_tco: tcoBreakdown.coutTotalTco,
        stock_deducted: emittedIds.length > 0 || (skipDeduction && pieces.length > 0),
        stock_effect:
          emittedIds.length > 0
            ? 'APPLIED'
            : skipDeduction && pieces.length > 0
            ? 'ALREADY_DEDUCTED_BY_STORE'
            : 'NONE',
        emitted_movement_ids: emittedIds,
        updated_at: nowIso,
      };

      get().setCorrectiveInterventions((prev) =>
        (prev || []).map((i) => (matchesIntervention(i, id) ? closedBt : i))
      );

      get().appendAuditEvent?.({
        actorId: String(clotureData?.validated_by_id || actor.actorId),
        actorName: String(clotureData?.validated_by_name || actor.actorName),
        actorRole: effectiveRole || actor.actorRole,
        actionType: 'CORRECTIVE_BT_CLOSED',
        entityType: 'CORRECTIVE_BT',
        entityId: String(existing.id || id),
        before: { statut: existing.statut, action_fermee: existing.action_fermee },
        after: {
          statut: 'CLOTURE',
          cout_total: coutTotal,
          cout_main_oeuvre: tcoBreakdown.coutMainOeuvre,
          cout_arret_production: tcoBreakdown.coutArretProduction,
          cout_total_tco: tcoBreakdown.coutTotalTco,
          temps_intervention_mins: resolvedRepairMins,
          temps_arret_minutes: resolvedDowntimeMins,
          emitted_movement_ids: emittedIds,
        },
      });

      // Sync linked warehouse component status if requested at BT closure
      const compId = String(clotureData?.id_composant || existing.id_composant || '').trim();
      const compStatus = clotureData?.statut_composant_cloture;
      if (compId && compStatus) {
        get().setWarehouseItems((prev) =>
          (prev || []).map((w: any) => {
            const wId = String(w?.id_warehouse_item || w?.id || '').trim();
            if (wId !== compId) return w;
            return {
              ...w,
              status: compStatus,
              derniere_intervention_bt: existing.num_bt || existing.id,
              updated_at: nowIso,
            };
          })
        );
      }

      if (String(get().activeLiveInterventionId ?? '') === String(existing.id ?? id)) {
        get().setActiveLiveInterventionId(null);
      }

      return closedBt;
    },

    handleUpdateCorrectiveIntervention: (id, patch = {}) => {
      const current = get().correctiveInterventions || [];
      const target = current.find((i) => matchesIntervention(i, id));
      if (!target) return false;

      // Closure MUST flow through handleClotureIntervention / handleReviewInterventionValidation
      // so stock deductions, LOTO/workshop/need guards, downtime math & AUDIT_EVENTS cannot be bypassed.
      if (
        patch.statut &&
        String(patch.statut).trim().toUpperCase() === 'CLOTURE' &&
        String(target.statut || '').trim().toUpperCase() !== 'CLOTURE'
      ) {
        return false;
      }

      if (patch.statut && patch.statut !== target.statut) {
        const check = WorkOrderStateMachine.validateTransition(target, patch.statut, patch);
        if (!check.valid) {
          return false;
        }
      }

      const nowIso = new Date().toISOString();
      const normalizedPatch: Record<string, any> = {
        ...patch,
        ...(patch.type_panne ? { type_panne: normalizeTypePanne(patch.type_panne) } : {}),
        ...(patch.priorite ? { priorite: normalizePriorite(patch.priorite) } : {}),
      };

      get().setCorrectiveInterventions((prev) =>
        (prev || []).map((i) =>
          matchesIntervention(i, id) ? { ...i, ...normalizedPatch, updated_at: nowIso } : i
        )
      );
      return true;
    },

    handleDeleteCorrectiveIntervention: (id) => {
      const sessionRole = resolveActiveSessionRole();
      if (sessionRole && NON_DESTRUCTIVE_ROLES.has(sessionRole)) {
        return false;
      }

      const current = get().correctiveInterventions || [];
      const target = current.find((i) => matchesIntervention(i, id));
      if (!target) return false;

      const actor = resolveActiveActorContext();
      const targetId = String(target.id || id || '').trim();
      const emittedSet = new Set(
        Array.isArray(target.emitted_movement_ids) ? target.emitted_movement_ids.map(String) : []
      );
      const fallbackBon = targetId ? `BS-BT-${targetId}` : '';

      get().setCorrectiveInterventions((prev) =>
        (prev || []).filter((i) => !matchesIntervention(i, id))
      );

      if (targetId || emittedSet.size > 0) {
        get().setMouvements((prev) =>
          (prev || []).filter((m: any) => {
            if (targetId && String(m?.source_bt_id || '') === targetId) return false;
            if (emittedSet.has(String(m?.id || ''))) return false;
            if (fallbackBon && String(m?.code_bon || '') === fallbackBon) return false;
            return true;
          })
        );
      }

      if (String(get().activeLiveInterventionId ?? '') === String(target.id ?? id)) {
        get().setActiveLiveInterventionId(null);
      }

      get().appendAuditEvent?.({
        actorId: actor.actorId,
        actorName: actor.actorName,
        actorRole: sessionRole || actor.actorRole,
        actionType: 'CORRECTIVE_BT_DELETED',
        entityType: 'CORRECTIVE_BT',
        entityId: targetId || String(id),
        before: {
          num_bt: target.num_bt || null,
          code_machine: target.code_machine || null,
          statut: target.statut || null,
          anomalie: target.anomalie || null,
          cout_total: target.cout_total || 0,
        },
        after: null,
      });

      return true;
    },

    handleBulkImportCorrective: (_importedItems: CorrectiveInterventionItem[]) => {
      // Governance rule (AGENTS.md §1.2): Bulk BT/DI import is strictly forbidden.
      // Level 2 Corrective Catalogs (CM_CATALOG) are imported via UnifiedImportPipeline.
      return;
    },

    handleResetCorrectiveToSeed: async () => {
      const demoFlag = storageService.getItem(STORAGE_KEYS.DEMO_MODE);
      const startMode = storageService.getItem(STORAGE_KEYS.START_MODE);
      const isExplicitDemoMode =
        (demoFlag === true || demoFlag === 'true') && startMode !== 'empty';
      if (!isExplicitDemoMode) {
        return {
          cancelled: true,
          restoredCount: 0,
          orphanCountAfter: 0,
        };
      }
      DataGateway.loadDemoSection('corrective', {
        setCorrectiveInterventions: (val) => get().setCorrectiveInterventions(val),
        setWorkshopOrders: (val) => get().setWorkshopOrders(val),
        setNeedRequests: (val) => get().setNeedRequests(val),
      });
      const baseline = await loadBaselineCorrectiveData();
      return {
        cancelled: false,
        restoredCount: (baseline.interventions || []).length,
        orphanCountAfter: 0,
      };
    },

    handleCreateWorkshopOrder: (payload) => {
      try {
        const existingOrders = get().workshopOrders || [];
        const created = createWorkshopOrderRecord(payload, existingOrders);
        get().setWorkshopOrders([created, ...existingOrders]);

        const targetBtKey = String(created.id_bt || created.id_di || '').trim().toUpperCase();
        if (targetBtKey) {
          const nowIso = new Date().toISOString();
          get().setCorrectiveInterventions((prev) =>
            (prev || []).map((bt) => {
              if (!matchesIntervention(bt, targetBtKey)) return bt;
              if (bt.statut === 'CLOTURE' || bt.statut === 'ANNULE') return bt;
              return {
                ...bt,
                statut: 'EN_ATTENTE_PDR',
                action_fermee: 'NON',
                id_bon_atelier: created.id,
                code_bon_atelier: created.code_bon,
                statut_bon_atelier: created.statut,
                updated_at: nowIso,
              };
            })
          );
        }
        return created;
      } catch {
        return null;
      }
    },

    handleTransitionWorkshopOrderStatus: (
      orderId: string,
      nextStatus: WorkshopOrderStatus,
      observation?: string,
      costDetails?: { heures_atelier?: number; cout_atelier?: number }
    ) => {
      const orders = get().workshopOrders || [];
      const target = orders.find(
        (o) => String(o.id) === String(orderId) || String(o.code_bon) === String(orderId)
      );
      if (!target) {
        return { valid: false, reason: "Bon d'atelier introuvable." };
      }

      const check = validateWorkshopOrderTransition(target.statut, nextStatus);
      if (!check.valid) {
        return { valid: false, reason: check.reason };
      }

      const nowIso = new Date().toISOString();
      const updatedOrder: IWorkshopOrder = {
        ...target,
        statut: check.normalizedTarget || nextStatus,
        date_statut: nowIso,
        ...(observation !== undefined ? { observation } : {}),
        ...(costDetails?.heures_atelier !== undefined &&
        Number.isFinite(Number(costDetails.heures_atelier))
          ? { heures_atelier: Math.max(0, Number(costDetails.heures_atelier)) }
          : {}),
        ...(costDetails?.cout_atelier !== undefined &&
        Number.isFinite(Number(costDetails.cout_atelier))
          ? { cout_atelier: Math.max(0, Number(costDetails.cout_atelier)) }
          : {}),
      };

      const nextOrders = orders.map((o) => (String(o.id) === String(target.id) ? updatedOrder : o));
      get().setWorkshopOrders(nextOrders);

      // Sync parent corrective BT status metadata (without auto-closing BT)
      const parentKey = String(target.id_bt || target.id_di || '').trim().toUpperCase();
      if (parentKey) {
        get().setCorrectiveInterventions((prev) =>
          (prev || []).map((bt) =>
            matchesIntervention(bt, parentKey)
              ? {
                  ...bt,
                  statut_bon_atelier: updatedOrder.statut,
                  code_bon_atelier: updatedOrder.code_bon,
                  updated_at: nowIso,
                }
              : bt
          )
        );
      }

      // Sync linked NeedRequests to RECU_STRUCTURE when WorkshopOrder reaches RECEPTIONNE_MONTAGE
      if (updatedOrder.statut === 'RECEPTIONNE_MONTAGE') {
        const currentNeeds = get().needRequests || [];
        let needsChanged = false;
        const nextNeeds = currentNeeds.map((req) => {
          if (
            String(req.id_workshop_order || '').trim() === String(updatedOrder.id) &&
            req.statut === 'APPROVISIONNEMENT'
          ) {
            needsChanged = true;
            return {
              ...req,
              statut: 'RECU_STRUCTURE' as NeedRequestStatus,
              date_statut: nowIso,
              timestamps: {
                ...(req.timestamps || {}),
                RECU_STRUCTURE: nowIso,
              },
            };
          }
          return req;
        });
        if (needsChanged) {
          get().setNeedRequests(nextNeeds);
        }
      }

      return { valid: true, order: updatedOrder };
    },

    handleCreateNeedRequest: (payload: CreateNeedRequestInput) => {
      try {
        const existing = get().needRequests || [];
        const materialClass = String(payload.material_class || 'PDR')
          .trim()
          .toUpperCase() as NeedMaterialClass;

        let resolvedTags = payload.policy_tags_snapshot;
        if (!Array.isArray(resolvedTags) || resolvedTags.length === 0) {
          let matchedEntity: any = null;
          if (materialClass === 'PART') {
            const key = String(payload.id_part || payload.nom_part || '').trim().toUpperCase();
            if (key) {
              matchedEntity = (get().partDesignations || []).find(
                (p: any) =>
                  String(p?.id || '').trim().toUpperCase() === key ||
                  String(p?.ref || '').trim().toUpperCase() === key ||
                  String(p?.code || '').trim().toUpperCase() === key
              );
            }
          } else if (materialClass === 'COMPONENT') {
            const key = String(payload.id_composant || payload.nom_composant || '')
              .trim()
              .toUpperCase();
            if (key) {
              matchedEntity =
                (get().warehouseItems || []).find(
                  (w: any) =>
                    String(w?.id_warehouse_item || w?.id || '').trim().toUpperCase() === key ||
                    String(w?.code || w?.ref || '').trim().toUpperCase() === key
                ) ||
                (get().compTemplates || []).find(
                  (c: any) =>
                    String(c?.id || c?.code || '').trim().toUpperCase() === key
                );
            }
          } else if (materialClass === 'PDR') {
            const key = String(payload.id_ref_pdr || payload.designation_pdr || '')
              .trim()
              .toUpperCase();
            if (key) {
              matchedEntity = (get().rawStock || []).find(
                (s: any) =>
                  String(s?.id || '').trim().toUpperCase() === key ||
                  String(s?.ref || '').trim().toUpperCase() === key ||
                  String(s?.code || '').trim().toUpperCase() === key
              );
            }
          }
          resolvedTags = getEffectivePolicyTags(matchedEntity, materialClass);
        }

        const created = createNeedRequestRecord(
          { ...payload, policy_tags_snapshot: resolvedTags },
          existing
        );
        get().setNeedRequests([created, ...existing]);

        const parentKey = String(created.id_bt || created.id_di || '').trim().toUpperCase();
        if (parentKey) {
          const nowIso = new Date().toISOString();
          get().setCorrectiveInterventions((prev) =>
            (prev || []).map((bt) => {
              if (!matchesIntervention(bt, parentKey)) return bt;
              if (bt.statut === 'CLOTURE' || bt.statut === 'ANNULE') return bt;
              return {
                ...bt,
                statut: 'EN_ATTENTE_PDR',
                action_fermee: 'NON',
                updated_at: nowIso,
              };
            })
          );
        }

        return created;
      } catch {
        return null;
      }
    },

    handleReviewNeedRequest: (needId: string, decisionPayload) => {
      const currentNeeds = get().needRequests || [];
      const target = currentNeeds.find((r) => String(r.id) === String(needId));
      if (!target) {
        return { valid: false, reason: 'Demande de besoin introuvable.' };
      }

      const targetStatus = decisionPayload.decision as NeedRequestStatus;
      const actor = resolveActiveActorContext();
      const role = String(decisionPayload.actorRole || resolveActiveSessionRole() || actor.actorRole).trim();

      const check = validateNeedRequestTransition(target.statut, targetStatus, {
        actorRole: role,
        canal_appro: decisionPayload.canal_appro ?? null,
        existingCanalAppro: target.canal_appro ?? null,
        material_class: target.material_class,
        notes_superviseur: decisionPayload.notes_superviseur,
        motif_rejet: decisionPayload.motif_rejet,
      });
      if (!check.valid) {
        return { valid: false, reason: check.reason };
      }

      const nowIso = new Date().toISOString();
      let createdWorkshopOrder: IWorkshopOrder | null = null;

      if (targetStatus === 'APPROVISIONNEMENT' && decisionPayload.canal_appro === 'ATELIER') {
        createdWorkshopOrder = get().handleCreateWorkshopOrder({
          type_demande: decisionPayload.workshopOrderType || 'REALISATION',
          id_machine: target.id_machine,
          id_bt: target.id_bt || null,
          id_di: target.id_di || null,
          id_part: target.id_part || null,
          id_composant: target.id_composant || null,
          quantite: target.quantite,
          description_travaux: target.description_besoin,
          observation: decisionPayload.notes_superviseur || '',
          emetteur_user_id: decisionPayload.actorId || actor.actorId,
          emetteur_name: decisionPayload.actorName || actor.actorName,
        });
      }

      const updatedNeed: INeedRequest = {
        ...target,
        statut: targetStatus,
        canal_appro:
          targetStatus === 'APPROVISIONNEMENT'
            ? decisionPayload.canal_appro ?? target.canal_appro ?? null
            : target.canal_appro ?? null,
        ...(decisionPayload.notes_superviseur !== undefined
          ? { notes_superviseur: decisionPayload.notes_superviseur }
          : {}),
        ...(decisionPayload.motif_rejet !== undefined ? { motif_rejet: decisionPayload.motif_rejet } : {}),
        ...(decisionPayload.id_sortie_demand !== undefined
          ? { id_sortie_demand: decisionPayload.id_sortie_demand }
          : {}),
        ...(createdWorkshopOrder
          ? {
              id_workshop_order: createdWorkshopOrder.id,
              code_workshop_order: createdWorkshopOrder.code_bon,
            }
          : {}),
        date_statut: nowIso,
        timestamps: {
          ...(target.timestamps || {}),
          [targetStatus]: nowIso,
        },
      };

      get().setNeedRequests(
        currentNeeds.map((r) => (String(r.id) === String(needId) ? updatedNeed : r))
      );

      return {
        valid: true,
        needRequest: updatedNeed,
        workshopOrder: createdWorkshopOrder,
      };
    },

    handleTransitionNeedRequestStatus: (needId: string, nextStatus: NeedRequestStatus, context = {}) => {
      const currentNeeds = get().needRequests || [];
      const target = currentNeeds.find((r) => String(r.id) === String(needId));
      if (!target) {
        return { valid: false, reason: 'Demande de besoin introuvable.' };
      }

      const linkedWo = target.id_workshop_order
        ? (get().workshopOrders || []).find((o) => String(o.id) === String(target.id_workshop_order)) || null
        : null;

      const check = validateNeedRequestTransition(target.statut, nextStatus, {
        actorRole: context.actorRole,
        isTechnician: context.isTechnician,
        existingCanalAppro: target.canal_appro ?? null,
        linkedWorkshopOrder: linkedWo,
        material_class: target.material_class,
        notes_superviseur: context.notes_superviseur ?? target.notes_superviseur,
        motif_rejet: context.motif_rejet,
        observation_pose_essai: context.observation_pose_essai,
      });
      if (!check.valid) {
        return { valid: false, reason: check.reason };
      }

      const nowIso = new Date().toISOString();
      const updatedNeed: INeedRequest = {
        ...target,
        statut: nextStatus,
        ...(context.observation_pose_essai !== undefined
          ? { observation_pose_essai: context.observation_pose_essai }
          : {}),
        ...(context.notes_superviseur !== undefined
          ? { notes_superviseur: context.notes_superviseur }
          : {}),
        ...(context.motif_rejet !== undefined ? { motif_rejet: context.motif_rejet } : {}),
        date_statut: nowIso,
        timestamps: {
          ...(target.timestamps || {}),
          [nextStatus]: nowIso,
        },
      };

      get().setNeedRequests(
        currentNeeds.map((r) => (String(r.id) === String(needId) ? updatedNeed : r))
      );

      return { valid: true, needRequest: updatedNeed };
    },

    handleFastTrackNeedRequest: (needId: string, options = {}) => {
      const currentNeeds = get().needRequests || [];
      const target = currentNeeds.find((r) => String(r.id) === String(needId));
      if (!target) {
        return { valid: false, reason: 'Demande de besoin introuvable.' };
      }

      const actor = resolveActiveActorContext();
      const effectiveRole = String(
        options?.actorRole || resolveActiveSessionRole() || actor.actorRole || ''
      )
        .trim()
        .toUpperCase();

      const linkedWo = target.id_workshop_order
        ? (get().workshopOrders || []).find(
            (o) => String(o.id) === String(target.id_workshop_order)
          ) || null
        : null;

      // Read-only live stock check when a catalog PDR reference is specified (zero stock mutation)
      let availableStock: number | null = null;
      const refKey = String(target.id_ref_pdr || '').trim().toUpperCase();
      if (refKey) {
        const stockMatch = (get().rawStock || []).find((s: any) => {
          const keys = [s?.ref, s?.reference, s?.code_article, s?.code]
            .map((v) => String(v || '').trim().toUpperCase())
            .filter(Boolean);
          return keys.includes(refKey);
        });
        if (stockMatch) {
          availableStock = StockCalculationService.calculateStockActuel(
            stockMatch,
            get().mouvements || []
          );
        }
      }

      const check = validateNeedRequestFastTrack(target, {
        actorRole: effectiveRole,
        isTechnician: options?.isTechnician,
        availableStock,
        linkedWorkshopOrder: linkedWo,
        closeFieldImmediately: Boolean(options?.closeFieldImmediately),
      });
      if (!check.valid || !check.targetStatus) {
        return { valid: false, reason: check.reason };
      }

      const nowIso = new Date().toISOString();
      const targetStatus = check.targetStatus;
      const nextTimestamps: Partial<Record<NeedRequestStatus, string>> = {
        ...(target.timestamps || {}),
        REVUE_SUPERVISEUR: target.timestamps?.REVUE_SUPERVISEUR || nowIso,
        APPROVISIONNEMENT: target.timestamps?.APPROVISIONNEMENT || nowIso,
        RECU_STRUCTURE: target.timestamps?.RECU_STRUCTURE || nowIso,
        REMIS_TECHNICIEN: target.timestamps?.REMIS_TECHNICIEN || nowIso,
        ...(targetStatus === 'CLOTURE_FIELD'
          ? {
              POSE_ESSAI: target.timestamps?.POSE_ESSAI || nowIso,
              CLOTURE_FIELD: nowIso,
            }
          : {}),
      };

      const noteText =
        options?.notes_superviseur !== undefined
          ? String(options.notes_superviseur).trim()
          : target.notes_superviseur || 'Remise Express Stock (Mode Usine Flexible)';

      const updatedNeed: INeedRequest = {
        ...target,
        statut: targetStatus,
        canal_appro: 'STOCK',
        fast_track: true,
        notes_superviseur: noteText,
        date_statut: nowIso,
        timestamps: nextTimestamps,
      };

      get().setNeedRequests(
        currentNeeds.map((r) => (String(r.id) === String(needId) ? updatedNeed : r))
      );

      get().appendAuditEvent?.({
        actorId: String(options?.actorId || actor.actorId || 'ADMIN'),
        actorName: String(options?.actorName || actor.actorName || 'Administrateur'),
        actorRole: effectiveRole || actor.actorRole,
        actionType: 'NEED_REQUEST_FAST_TRACK',
        entityType: 'NEED_REQUEST',
        entityId: String(target.code_demande || target.id),
        before: {
          statut: target.statut,
          canal_appro: target.canal_appro || null,
          fast_track: Boolean(target.fast_track),
        },
        after: {
          statut: updatedNeed.statut,
          canal_appro: 'STOCK',
          fast_track: true,
          id_ref_pdr: target.id_ref_pdr || null,
          quantite: target.quantite,
          available_stock_snapshot: availableStock,
        },
      });

      return { valid: true, needRequest: updatedNeed };
    },

    handleConsignInterventionLoto: (id, payload = {}) => {
      const current = get().correctiveInterventions || [];
      const existing = current.find((i) => matchesIntervention(i, id));
      if (!existing) {
        return { valid: false, reason: 'Bon de travail introuvable.' };
      }

      const actor = resolveActiveActorContext();
      const effectiveRole = String(payload?.actorRole || resolveActiveSessionRole() || actor.actorRole)
        .trim()
        .toUpperCase();
      if (effectiveRole === 'VIEWER' || effectiveRole === 'OBSERVATEUR') {
        return { valid: false, reason: 'Profil Observateur en lecture seule : consignation LOTO refusée.' };
      }

      if (existing.statut === 'CLOTURE' || existing.statut === 'ANNULE') {
        return { valid: false, reason: 'Consignation impossible sur une intervention clôturée ou annulée.' };
      }

      const check = validateLotoConsignation(existing.loto, {
        ...payload,
        consignateur_id: payload.consignateur_id || actor.actorId,
        consignateur_name: payload.consignateur_name || actor.actorName,
      });
      if (!check.valid || !check.permit) {
        return { valid: false, reason: check.reason };
      }

      const nowIso = new Date().toISOString();
      const updated: CorrectiveInterventionItem = {
        ...existing,
        requires_loto: true,
        loto_status: check.permit.status,
        loto: check.permit,
        updated_at: nowIso,
      };

      get().setCorrectiveInterventions((prev) =>
        (prev || []).map((i) => (matchesIntervention(i, id) ? updated : i))
      );

      get().appendAuditEvent?.({
        actorId: check.permit.consignateur_id || actor.actorId,
        actorName: check.permit.consignateur_name || actor.actorName,
        actorRole: effectiveRole,
        actionType: 'LOTO_CONSIGNED',
        entityType: 'CORRECTIVE_BT',
        entityId: String(existing.id || id),
        before: { loto_status: existing.loto_status || existing.loto?.status || 'NON_REQUIS' },
        after: {
          loto_status: check.permit.status,
          num_cadenas: check.permit.num_cadenas,
          energy_types: check.permit.energy_types,
          vat_verified: check.permit.vat_verified,
        },
      });

      return { valid: true, intervention: updated };
    },

    handleDeconsignInterventionLoto: (id, payload = {}) => {
      const current = get().correctiveInterventions || [];
      const existing = current.find((i) => matchesIntervention(i, id));
      if (!existing) {
        return { valid: false, reason: 'Bon de travail introuvable.' };
      }

      const actor = resolveActiveActorContext();
      const effectiveRole = String(payload?.actorRole || resolveActiveSessionRole() || actor.actorRole)
        .trim()
        .toUpperCase();
      if (effectiveRole === 'VIEWER' || effectiveRole === 'OBSERVATEUR') {
        return { valid: false, reason: 'Profil Observateur en lecture seule : déconsignation LOTO refusée.' };
      }

      const check = validateLotoDeconsignation(existing.loto, {
        ...payload,
        actorRole: effectiveRole,
        deconsignateur_id: payload.deconsignateur_id || actor.actorId,
        deconsignateur_name: payload.deconsignateur_name || actor.actorName,
      });
      if (!check.valid || !check.permit) {
        return { valid: false, reason: check.reason };
      }

      const nowIso = new Date().toISOString();
      const updated: CorrectiveInterventionItem = {
        ...existing,
        requires_loto: true,
        loto_status: check.permit.status,
        loto: check.permit,
        updated_at: nowIso,
      };

      get().setCorrectiveInterventions((prev) =>
        (prev || []).map((i) => (matchesIntervention(i, id) ? updated : i))
      );

      get().appendAuditEvent?.({
        actorId: check.permit.deconsignateur_id || actor.actorId,
        actorName: check.permit.deconsignateur_name || actor.actorName,
        actorRole: effectiveRole,
        actionType: check.permit.override_break_lock ? 'LOTO_BREAK_LOCK_OVERRIDE' : 'LOTO_DECONSIGNED',
        entityType: 'CORRECTIVE_BT',
        entityId: String(existing.id || id),
        before: {
          loto_status: existing.loto_status || existing.loto?.status,
          consignateur_id: existing.loto?.consignateur_id || null,
        },
        after: {
          loto_status: check.permit.status,
          num_cadenas: check.permit.num_cadenas,
          deconsigned_at: check.permit.deconsigned_at,
          ...(check.permit.override_break_lock
            ? {
                override_break_lock: true,
                override_reason: check.permit.override_reason || '',
              }
            : {}),
        },
      });

      return { valid: true, intervention: updated };
    },

    handleSaveInterventionReport: (id, report, context = {}) => {
      const current = get().correctiveInterventions || [];
      const existing = current.find((i) => matchesIntervention(i, id));
      if (!existing) {
        return { valid: false, reason: 'Bon de travail introuvable pour enregistrement RCA.' };
      }

      const actor = resolveActiveActorContext();
      const effectiveRole = String(context?.actorRole || resolveActiveSessionRole() || actor.actorRole)
        .trim()
        .toUpperCase();
      if (effectiveRole === 'VIEWER' || effectiveRole === 'OBSERVATEUR') {
        return {
          valid: false,
          reason: 'Profil Observateur en lecture seule : enregistrement du rapport technique refusé.',
        };
      }

      const nowIso = new Date().toISOString();
      const savedById = String(context?.actorId || actor.actorId || 'ADMIN');
      const savedByName = String(context?.actorName || actor.actorName || 'Administrateur');

      const sanitizedReport = report
        ? {
            fields: { ...(report.fields || {}) },
            extraRcaRows: Array.isArray(report.extraRcaRows)
              ? report.extraRcaRows.map((row, idx) => ({
                  id: String(row?.id || `rca-${idx + 1}`),
                  component: String(row?.component || ''),
                  observation: String(row?.observation || ''),
                  impact: String(row?.impact || ''),
                }))
              : [],
            updatedAt: String(report.updatedAt || nowIso),
            savedById,
            savedByName,
          }
        : null;

      const rootCauseSummary = sanitizedReport
        ? String(sanitizedReport.fields.root_cause_detail || '').trim()
        : '';

      // Post-mortem RCA documentation is explicitly permitted on CLOTURE BTs without mutating statut, stock, or costs.
      const updated: CorrectiveInterventionItem = {
        ...existing,
        technical_report: sanitizedReport,
        ...(rootCauseSummary
          ? { cause_racine: rootCauseSummary }
          : report === null
          ? { cause_racine: '' }
          : {}),
        rapport_redige: sanitizedReport ? 'OUI' : 'NON',
        updated_at: nowIso,
      };

      get().setCorrectiveInterventions((prev) =>
        (prev || []).map((i) => (matchesIntervention(i, id) ? updated : i))
      );

      get().appendAuditEvent?.({
        actorId: savedById,
        actorName: savedByName,
        actorRole: effectiveRole,
        actionType: sanitizedReport ? 'CORRECTIVE_RCA_SAVED' : 'CORRECTIVE_RCA_CLEARED',
        entityType: 'CORRECTIVE_BT',
        entityId: String(existing.id || id),
        before: {
          has_report: Boolean(existing.technical_report),
          cause_racine: existing.cause_racine || '',
        },
        after: {
          has_report: Boolean(sanitizedReport),
          cause_racine: rootCauseSummary,
          extra_rca_rows: sanitizedReport ? sanitizedReport.extraRcaRows.length : 0,
        },
      });

      return { valid: true, intervention: updated };
    },

    correctiveKpis: () => CorrectiveCalculationService.computeKpis(get().correctiveInterventions || []),
    correctiveParetoAnomalies: () =>
      CorrectiveCalculationService.computePareto(get().correctiveInterventions || [], 'anomalie'),
    correctiveParetoMachines: () =>
      CorrectiveCalculationService.computePareto(get().correctiveInterventions || [], 'code_machine'),
    correctiveParetoTypes: () =>
      CorrectiveCalculationService.computePareto(get().correctiveInterventions || [], 'type_panne'),
    correctivePreventiveRecommendations: () =>
      CorrectiveCalculationService.detectPreventiveRecommendations(get().correctiveInterventions || []),
  };
}
