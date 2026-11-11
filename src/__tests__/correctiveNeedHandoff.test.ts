import { describe, it, expect, beforeEach } from 'vitest';
import {
  createNeedRequestRecord,
  getSuggestedChannelsForMaterialClass,
  validateNeedRequestTransition,
} from '../domain/corrective/needRequestService';
import { STORAGE_KEYS } from '../infrastructure/persistence/storageKeys';
import { storageService } from '../utils/storageService';
import { DataGateway } from '../application/DataGateway';
import { useGmaoStore } from '../store/useGmaoStore';

describe('COR-HANDOFF-P0 — Need Request & Multi-Actor Handoff Lifecycle above COR-ATELIER-P0', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useGmaoStore.setState({
      machines: [
        {
          id: 'PRESS-01',
          id_machine_registered: 'PRESS-01',
          designation: 'Presse Hydraulique 200T',
          status: 'OPERATIONNELLE',
        } as any,
      ],
      rawStock: [],
      mouvements: [],
      sortiesExterne: [],
      workshopOrders: [],
      needRequests: [],
      correctiveInterventions: [
        {
          id: 'bt-handoff-1',
          num_bt: 'BT-2026-099',
          code_machine: 'PRESS-01',
          anomalie: 'Usure bague bronze et roulement palier principal',
          statut: 'EN_COURS',
          action_fermee: 'NON',
          intervenant: 'Karim Tech',
        } as any,
      ],
      warehouseItems: [],
    });
  });

  it('1. Technician creates a NeedRequest -> starts in DEMANDE_TECH with canal_appro === null, persists in STORAGE_KEYS.NEED_REQUESTS, and places parent BT in EN_ATTENTE_PDR without touching stock', () => {
    const store = useGmaoStore.getState();

    // Even if an untrusted payload attempts to pass canal_appro, createNeedRequestRecord clamps it to null
    const rawCheck = createNeedRequestRecord(
      {
        id_machine: 'PRESS-01',
        id_bt: 'BT-2026-099',
        material_class: 'PART',
        quantite: 2,
        description_besoin: 'Bague bronze Ø50x70 usée sur palier presse',
        ...( { canal_appro: 'ATELIER' } as any ),
      },
      []
    );
    expect(rawCheck.statut).toBe('DEMANDE_TECH');
    expect(rawCheck.canal_appro).toBeNull();

    const created = store.handleCreateNeedRequest({
      id_machine: 'PRESS-01',
      id_bt: 'BT-2026-099',
      id_technicien_demandeur: 'TECH-01',
      nom_technicien_demandeur: 'Karim Tech',
      material_class: 'PART',
      quantite: 2,
      description_besoin: 'Bague bronze Ø50x70 usée sur palier presse',
    });

    expect(created).not.toBeNull();
    expect(created?.code_demande).toMatch(/^ND-\d{4}-001$/);
    expect(created?.statut).toBe('DEMANDE_TECH');
    expect(created?.canal_appro).toBeNull();
    expect(created?.requires_material).toBe(true);

    // Persisted in STORAGE_KEYS.NEED_REQUESTS
    const persisted = storageService.getItem(STORAGE_KEYS.NEED_REQUESTS);
    expect(Array.isArray(persisted)).toBe(true);
    expect(persisted).toHaveLength(1);
    expect(persisted[0].code_demande).toBe(created?.code_demande);

    // Parent BT is placed in EN_ATTENTE_PDR and stays open (action_fermee === 'NON')
    const updatedBt = useGmaoStore
      .getState()
      .correctiveInterventions.find((i) => i.id === 'bt-handoff-1');
    expect(updatedBt?.statut).toBe('EN_ATTENTE_PDR');
    expect(updatedBt?.action_fermee).toBe('NON');

    // Stock movements remain untouched
    expect(useGmaoStore.getState().mouvements).toHaveLength(0);
  });

  it('2. Supervisor reviews NeedRequest and sets canal_appro = ATELIER -> auto-creates & links IWorkshopOrder, keeps BT open, and blocks RECU_STRUCTURE while WorkshopOrder is active', () => {
    const store = useGmaoStore.getState();
    const created = store.handleCreateNeedRequest({
      id_machine: 'PRESS-01',
      id_bt: 'BT-2026-099',
      material_class: 'PART',
      quantite: 1,
      description_besoin: 'Confection arbre cannelé sur mesure',
    });
    expect(created).not.toBeNull();

    // Technician cannot perform supervisor review
    const techAttempt = store.handleReviewNeedRequest(created!.id, {
      decision: 'APPROVISIONNEMENT',
      canal_appro: 'ATELIER',
      actorRole: 'TECHNICIEN',
    });
    expect(techAttempt.valid).toBe(false);

    // Supervisor cannot enter APPROVISIONNEMENT without a valid canal_appro
    const missingCanalAttempt = store.handleReviewNeedRequest(created!.id, {
      decision: 'APPROVISIONNEMENT',
      canal_appro: null,
      actorRole: 'RESPONSABLE_MAINTENANCE',
    });
    expect(missingCanalAttempt.valid).toBe(false);

    // Supervisor approves APPROVISIONNEMENT with canal_appro === 'ATELIER'
    const reviewRes = useGmaoStore.getState().handleReviewNeedRequest(created!.id, {
      decision: 'APPROVISIONNEMENT',
      canal_appro: 'ATELIER',
      workshopOrderType: 'REALISATION',
      notes_superviseur: 'Usiner en acier 42CD4 traité',
      actorRole: 'RESPONSABLE_MAINTENANCE',
      actorId: 'RESP-01',
      actorName: 'Chef Maintenance',
    });

    expect(reviewRes.valid).toBe(true);
    expect(reviewRes.needRequest?.statut).toBe('APPROVISIONNEMENT');
    expect(reviewRes.needRequest?.canal_appro).toBe('ATELIER');
    expect(reviewRes.workshopOrder).not.toBeNull();
    expect(reviewRes.workshopOrder?.code_bon).toMatch(/^BR-\d{4}-001$/);
    expect(reviewRes.needRequest?.id_workshop_order).toBe(reviewRes.workshopOrder?.id);

    // Parent BT stays open
    const btAfterReview = useGmaoStore
      .getState()
      .correctiveInterventions.find((i) => i.id === 'bt-handoff-1');
    expect(btAfterReview?.action_fermee).toBe('NON');
    expect(btAfterReview?.statut).toBe('EN_ATTENTE_PDR');

    // Attempting to transition NeedRequest to RECU_STRUCTURE while WorkshopOrder is still EMIS / EN_COURS_FABRICATION is rejected
    const prematureRecu = useGmaoStore
      .getState()
      .handleTransitionNeedRequestStatus(created!.id, 'RECU_STRUCTURE', {
        actorRole: 'RESPONSABLE_MAINTENANCE',
      });
    expect(prematureRecu.valid).toBe(false);
    expect(prematureRecu.reason).toContain('Atelier Mécanique');
  });

  it('3 & 4. Blocks BT closure (handleClotureIntervention) until NeedRequest completes RECU_STRUCTURE -> REMIS_TECHNICIEN -> POSE_ESSAI -> CLOTURE_FIELD', () => {
    const store = useGmaoStore.getState();
    const need = store.handleCreateNeedRequest({
      id_machine: 'PRESS-01',
      id_bt: 'BT-2026-099',
      material_class: 'PART',
      quantite: 1,
      description_besoin: 'Rectification flasque palier',
    });
    expect(need).not.toBeNull();

    // 3a. Attempting to close BT while NeedRequest is in DEMANDE_TECH is rejected
    const blockedAtDemande = useGmaoStore.getState().handleClotureIntervention('bt-handoff-1', {
      action_realisee: 'Tentative clôture prématurée (DEMANDE_TECH)',
      actorRole: 'ADMIN',
    });
    expect(blockedAtDemande).toBeNull();

    // Supervisor routes to ATELIER (RECTIFICATION)
    const review = useGmaoStore.getState().handleReviewNeedRequest(need!.id, {
      decision: 'APPROVISIONNEMENT',
      canal_appro: 'ATELIER',
      workshopOrderType: 'RECTIFICATION',
      actorRole: 'ADMIN',
    });
    expect(review.valid).toBe(true);
    const woId = review.workshopOrder!.id;

    // Advance WorkshopOrder through EMIS -> EN_COURS_FABRICATION -> PRET_LIVRAISON -> RECEPTIONNE_MONTAGE
    expect(
      useGmaoStore.getState().handleTransitionWorkshopOrderStatus(woId, 'EN_COURS_FABRICATION')
        .valid
    ).toBe(true);
    expect(
      useGmaoStore.getState().handleTransitionWorkshopOrderStatus(woId, 'PRET_LIVRAISON').valid
    ).toBe(true);
    expect(
      useGmaoStore.getState().handleTransitionWorkshopOrderStatus(woId, 'RECEPTIONNE_MONTAGE')
        .valid
    ).toBe(true);

    // NeedRequest automatically synced to RECU_STRUCTURE when WorkshopOrder reached RECEPTIONNE_MONTAGE!
    const syncedNeed = useGmaoStore
      .getState()
      .needRequests.find((r) => r.id === need!.id);
    expect(syncedNeed?.statut).toBe('RECU_STRUCTURE');

    // 3b. Even though WorkshopOrder is RECEPTIONNE_MONTAGE and NeedRequest is RECU_STRUCTURE,
    // BT closure is STILL blocked because the part has not been handed off and field-tested (CLOTURE_FIELD)!
    const blockedAtRecu = useGmaoStore.getState().handleClotureIntervention('bt-handoff-1', {
      action_realisee: 'Tentative clôture avant remise et essai terrain',
      actorRole: 'ADMIN',
    });
    expect(blockedAtRecu).toBeNull();

    // Hand off to technician: RECU_STRUCTURE -> REMIS_TECHNICIEN
    const remisRes = useGmaoStore
      .getState()
      .handleTransitionNeedRequestStatus(need!.id, 'REMIS_TECHNICIEN', {
        actorRole: 'RESPONSABLE_MAINTENANCE',
      });
    expect(remisRes.valid).toBe(true);

    // 3c. Still blocked while REMIS_TECHNICIEN (before POSE_ESSAI -> CLOTURE_FIELD)
    const blockedAtRemis = useGmaoStore.getState().handleClotureIntervention('bt-handoff-1', {
      action_realisee: 'Tentative clôture avant essai machine',
      actorRole: 'ADMIN',
    });
    expect(blockedAtRemis).toBeNull();

    // Technician mounts part and runs trial: REMIS_TECHNICIEN -> POSE_ESSAI -> CLOTURE_FIELD
    const poseRes = useGmaoStore
      .getState()
      .handleTransitionNeedRequestStatus(need!.id, 'POSE_ESSAI', {
        actorRole: 'TECHNICIEN',
        isTechnician: true,
      });
    expect(poseRes.valid).toBe(true);

    const clotureFieldRes = useGmaoStore
      .getState()
      .handleTransitionNeedRequestStatus(need!.id, 'CLOTURE_FIELD', {
        actorRole: 'TECHNICIEN',
        isTechnician: true,
        observation_pose_essai: 'Montage flasque et essai en charge concluant (0 vibration)',
      });
    expect(clotureFieldRes.valid).toBe(true);
    expect(clotureFieldRes.needRequest?.statut).toBe('CLOTURE_FIELD');

    // 4. Now that NeedRequest has reached CLOTURE_FIELD, closing the parent BT succeeds!
    const closedBt = useGmaoStore.getState().handleClotureIntervention('bt-handoff-1', {
      action_realisee: 'Remontage flasque rectifiée et validation essai en charge',
      actorRole: 'ADMIN',
    });
    expect(closedBt).not.toBeNull();
    expect(closedBt?.statut).toBe('CLOTURE');
    expect(closedBt?.action_fermee).toBe('OUI');
  });

  it('5. getSuggestedChannelsForMaterialClass(PDR) returns [STOCK, ACHAT] and strictly excludes ATELIER, plus DataGateway.clearAll resets NEED_REQUESTS to []', async () => {
    const pdrChannels = getSuggestedChannelsForMaterialClass('PDR');
    expect(pdrChannels).toEqual(['STOCK', 'ACHAT']);
    expect(pdrChannels).not.toContain('ATELIER');

    const partChannels = getSuggestedChannelsForMaterialClass('PART');
    expect(partChannels).toContain('ATELIER');
    expect(partChannels).toContain('STOCK');
    expect(partChannels).toContain('ACHAT');

    // Validate illegal jump in FSM (e.g., DEMANDE_TECH -> CLOTURE_FIELD directly)
    const illegalJump = validateNeedRequestTransition('DEMANDE_TECH', 'CLOTURE_FIELD', {
      actorRole: 'ADMIN',
    });
    expect(illegalJump.valid).toBe(false);

    // Create a need request then verify DataGateway.clearAllForRealFactory resets STORAGE_KEYS.NEED_REQUESTS to []
    useGmaoStore.getState().handleCreateNeedRequest({
      id_machine: 'PRESS-01',
      material_class: 'PDR',
      quantite: 1,
      description_besoin: 'Roulement SKF 6205',
    });
    expect(storageService.getItem(STORAGE_KEYS.NEED_REQUESTS)).toHaveLength(1);

    await DataGateway.clearAllForRealFactory({
      setNeedRequests: (empty: any[]) => useGmaoStore.setState({ needRequests: empty }),
    });
    expect(storageService.getItem(STORAGE_KEYS.NEED_REQUESTS)).toEqual([]);
    expect(useGmaoStore.getState().needRequests).toEqual([]);
  });
});
