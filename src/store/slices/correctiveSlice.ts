import { DataGateway } from '../../application/DataGateway';
import SortieExterneService from '../../application/services/SortieExterneService';
import { CorrectiveCalculationService } from '../../domain/corrective/services/CorrectiveCalculationService';
import { WorkOrderStateMachine } from '../../domain/corrective/services/WorkOrderStateMachine';
import {
  createWorkshopOrderRecord,
  validateWorkshopOrderTransition,
  isWorkshopOrderActive,
  getLinkedWorkshopOrdersForIntervention,
  type IWorkshopOrder,
  type WorkshopOrderStatus,
} from '../../domain/corrective/workshopOrderService';
import {
  createNeedRequestRecord,
  validateNeedRequestTransition,
  hasBlockingNeedRequestForIntervention,
  getEffectivePolicyTags,
  type INeedRequest,
  type NeedRequestStatus,
  type CreateNeedRequestInput,
  type NeedMaterialClass,
} from '../../domain/corrective/needRequestService';
import { storageService } from '../../utils/storageService';
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
import {
  ACTIVE_LIVE_KEY,
  resolveUpdate,
  trackRemovedEntityIds,
  resolveActiveSessionRole,
  resolveActiveActorContext,
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
      const baseline = await loadBaselineCorrectiveData();
      get().setCorrectiveActionsByPanne(baseline.actionsByPanne || {});
      get().setCorrectivePanneCategories(baseline.panneCategories || {});
      get().setCorrectiveTravauxAFaire(baseline.travauxAFaire || []);
    },

    handleForceSyncCorrectiveSeed: async () => {
      const baseline = await loadBaselineCorrectiveData();
      get().setCorrectiveInterventions(baseline.interventions || []);
      get().setCorrectiveActionsByPanne(baseline.actionsByPanne || {});
      get().setCorrectivePanneCategories(baseline.panneCategories || {});
      get().setCorrectiveTravauxAFaire(baseline.travauxAFaire || []);
      get().setCorrectiveIntervenants(baseline.intervenants || []);
      return {
        interventionsCount: (baseline.interventions || []).length,
        pannesCount: Object.values(baseline.panneCategories || {}).reduce<number>(
          (acc, arr) => acc + (Array.isArray(arr) ? arr.length : 0),
          0
        ),
        categoriesCount: Object.keys(baseline.panneCategories || {}).length,
        travauxCount: (baseline.travauxAFaire || []).length,
        actionsCount: Object.keys(baseline.actionsByPanne || {}).length,
        intervenantsCount: (baseline.intervenants || []).length,
      };
    },

    handleAddDemandeIntervention: (data) => {
      const nowIso = new Date().toISOString();
      const today = nowIso.slice(0, 10);
      const timeNow = nowIso.slice(11, 16);
      const created: CorrectiveInterventionItem = {
        ...data,
        id: String(data?.id || safeId('DI')).trim(),
        code_machine: String(data?.code_machine || data?.id_machine_registered || '').trim(),
        statut: 'DEMANDE',
        action_fermee: 'NON',
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

      const check = WorkOrderStateMachine.validateTransition(existing, 'EN_COURS', {
        ...btDetails,
        code_machine: btDetails.code_machine || existing.code_machine || existing.machine,
      });
      if (!check.valid) return null;

      const nowIso = new Date().toISOString();
      const today = nowIso.slice(0, 10);
      const timeNow = nowIso.slice(11, 16);
      const existingBtCount = current.filter((i) => Boolean(i.num_bt)).length;

      const updated: CorrectiveInterventionItem = {
        ...existing,
        ...btDetails,
        num_bt: String(
          btDetails?.num_bt || existing.num_bt || `BT-${new Date().getFullYear()}-${String(existingBtCount + 1).padStart(3, '0')}`
        ).trim(),
        statut: btDetails?.statut || 'EN_COURS',
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

      const nowIso = new Date().toISOString();
      get().setActiveLiveInterventionId(existing.id ?? id);
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
      const decision = String(decisionData?.decision || 'APPROVED').trim().toUpperCase();
      const validatorId = String(decisionData?.validated_by_id || actor.actorId).trim();
      const validatorName = String(decisionData?.validated_by_name || actor.actorName).trim();
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

      // APPROVED branch: verify FSM guards first
      const openSorties = SortieExterneService.getLinkedOrdersForBt(
        existing,
        get().sortiesExterne || []
      ).some((s) => SortieExterneService.isWorkshopOrderOpen(s.etat));
      const openWorkshopOrders = getLinkedWorkshopOrdersForIntervention(
        existing,
        get().workshopOrders || []
      ).some((o) => isWorkshopOrderActive(o));
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
        existing.pieces_claimed ?? existing.pieces_proposees ?? []
      );
      const rawApproved =
        decisionData?.pieces_utilisees ??
        decisionData?.approvedItems ??
        existing.pieces_proposees ??
        [];
      const approvedPieces = normalizePdrItems(rawApproved);
      const editedByAdmin =
        Boolean(decisionData?.pieces_utilisees) && !areSamePdrLists(claimedPieces, approvedPieces);

      const currentMovements = get().mouvements || [];
      const stockMap = new Map<string, any>();
      for (const s of get().rawStock || []) {
        const refKey = String(s?.ref || '').trim().toUpperCase();
        if (refKey) stockMap.set(refKey, s);
      }

      const bonRef = `BS-BT-${existing.id || id}`;
      const newMovements: IMouvement[] = [];
      const emittedIds: string[] = [];
      let totalPdrCost = 0;

      for (const piece of approvedPieces) {
        const stockMatch = stockMap.get(piece.ref.toUpperCase());
        const unitPrice = Number(piece.prix_unitaire ?? stockMatch?.prixUnitaire ?? stockMatch?.prix ?? 0) || 0;
        totalPdrCost += unitPrice * piece.quantite;

        const alreadyDeducted = isPartAlreadyDeductedByStoreBon(
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

      const coutAtelier = Number(existing.cout_atelier ?? 0) || 0;
      const coutPdr = Number(totalPdrCost.toFixed(2));
      const coutTotal = Number((coutPdr + coutAtelier).toFixed(2));
      const nature = normalizeInterventionNature(
        decisionData?.intervention_nature ?? existing.intervention_nature
      );

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
        temps_intervention:
          decisionData?.temps_intervention ||
          existing.temps_intervention_propose ||
          timing.formatted,
        temps_intervention_mins:
          Number(decisionData?.temps_intervention_mins) ||
          existing.temps_intervention_mins ||
          timing.minutes,
        cout_pdr: coutPdr,
        cout_atelier: coutAtelier,
        cout_total: coutTotal,
        stock_deducted: approvedPieces.length > 0,
        stock_effect: approvedPieces.length > 0 ? 'APPLIED' : 'NONE',
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
        const refKey = String(s?.ref || '').trim().toUpperCase();
        if (refKey) stockMap.set(refKey, s);
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
        const unitPrice = Number(piece.prix_unitaire ?? stockMatch?.prixUnitaire ?? stockMatch?.prix ?? 0) || 0;
        totalPdrCost += unitPrice * piece.quantite;

        const bonRef =
          manualBon || (pieces.length > 1 ? `${baseBtBon}-${idx + 1}` : baseBtBon);

        const alreadyDeducted = isPartAlreadyDeductedByStoreBon(
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

      const coutPdr = Number(totalPdrCost.toFixed(2));
      const coutAtelier = Number(clotureData?.cout_atelier ?? existing.cout_atelier ?? 0) || 0;
      const coutTotal = Number((coutPdr + coutAtelier).toFixed(2));
      const nature = normalizeInterventionNature(
        clotureData?.intervention_nature ?? existing.intervention_nature
      );

      const firstPiece = pieces[0];
      const summaryDesignation = firstPiece
        ? pieces.length > 1
          ? `${firstPiece.designation} (+${pieces.length - 1} réf.)`
          : firstPiece.designation
        : clotureData?.pdr_designation ?? existing.pdr_designation;

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
        temps_intervention: clotureData?.temps_intervention || timing.formatted,
        temps_intervention_mins:
          Number(clotureData?.temps_intervention_mins) ||
          existing.temps_intervention_mins ||
          timing.minutes,
        cout_pdr: coutPdr,
        cout_atelier: coutAtelier,
        cout_total: coutTotal,
        stock_deducted: pieces.length > 0,
        stock_effect: pieces.length > 0 ? 'APPLIED' : 'NONE',
        emitted_movement_ids: emittedIds,
        updated_at: nowIso,
      };

      get().setCorrectiveInterventions((prev) =>
        (prev || []).map((i) => (matchesIntervention(i, id) ? closedBt : i))
      );

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
      const nowIso = new Date().toISOString();
      get().setCorrectiveInterventions((prev) =>
        (prev || []).map((i) => {
          if (!matchesIntervention(i, id)) return i;
          if (patch.statut && patch.statut !== i.statut) {
            const check = WorkOrderStateMachine.validateTransition(i, patch.statut, patch);
            if (!check.valid) {
              return i;
            }
          }
          return { ...i, ...patch, updated_at: nowIso };
        })
      );
    },

    handleDeleteCorrectiveIntervention: (id) => {
      const current = get().correctiveInterventions || [];
      const target = current.find((i) => matchesIntervention(i, id));
      const targetId = String(target?.id || id || '').trim();
      const emittedSet = new Set(
        Array.isArray(target?.emitted_movement_ids) ? target.emitted_movement_ids.map(String) : []
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
    },

    handleBulkImportCorrective: (importedItems: CorrectiveInterventionItem[]) => {
      if (!Array.isArray(importedItems) || importedItems.length === 0) return;
      get().setCorrectiveInterventions((prev) => [...importedItems, ...(prev || [])]);
    },

    handleResetCorrectiveToSeed: async () => {
      const baseline = await loadBaselineCorrectiveData();
      get().setCorrectiveInterventions(baseline.interventions || []);
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
      observation?: string
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
