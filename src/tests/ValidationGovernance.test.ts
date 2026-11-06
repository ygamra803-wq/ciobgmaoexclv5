import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGmaoStore } from '../store/useGmaoStore';
import {
  getValidationStatusMeta,
  getInterventionNatureMeta,
} from '../presentation/components/common/ValidationStatusBadge';

describe('VAL-1, VAL-2, VAL-3, VAL-4 & G0 — Maker-Checker Validation Governance', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.removeItem('gmao_session_v2');
    }
    const store = useGmaoStore.getState();
    store.setRawStock([
      {
        ref: 'PDR-RLM-6205',
        designation: 'Roulement SKF 6205-2RS',
        stockInitial: 10,
        stockActuel: 10,
        prix: 120,
        unite: 'Pièce',
      },
      {
        ref: 'PDR-JNT-10',
        designation: 'Joint Torique NBR 10',
        stockInitial: 20,
        stockActuel: 20,
        prix: 15,
        unite: 'Pièce',
      },
    ]);
    store.setMouvements([]);
    useGmaoStore.setState({
      correctiveInterventions: [
        {
          id: 'BT-TEST-001',
          num_bt: 'BT-2026-001',
          code_machine: 'M-101',
          nom_machine: 'Presse Hydraulique 1',
          statut: 'EN_COURS',
          action_fermee: 'NON',
          anomalie: 'Bruit anormal palier',
          intervenant: 'Karim Tech',
          date_debut: '2026-04-01',
          heure_debut: '08:00',
        },
      ],
    });
  });

  afterEach(() => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.removeItem('gmao_session_v2');
    }
  });

  it('VAL-2: routes technician direct closure call through PENDING_VALIDATION without deducting stock', () => {
    const store = useGmaoStore.getState();
    const result = store.handleClotureIntervention('BT-TEST-001', {
      actorRole: 'TECHNICIEN',
      isTechnician: true,
      intervention_nature: 'REPLACE',
      action_realisee: 'Remplacement roulement',
      date_fin: '2026-04-01',
      heure_fin: '10:00',
      pieces_utilisees: [{ ref: 'PDR-RLM-6205', quantite: 2 }],
    });

    expect(result).toBeTruthy();
    expect(result.validation_status).toBe('PENDING_VALIDATION');
    expect(result.intervention_nature).toBe('REPLACE');
    expect(result.action_fermee).toBe('NON');
    expect(result.statut).toBe('EN_COURS');
    expect(result.stock_deducted).toBe(false);
    expect(result.stock_effect).toBe('RESERVED');
    expect(result.pieces_utilisees).toEqual([]);
    expect(result.pieces_claimed).toHaveLength(1);
    expect(result.pieces_claimed[0].ref).toBe('PDR-RLM-6205');
    expect(result.pieces_claimed[0].quantite).toBe(2);
    expect(useGmaoStore.getState().mouvements).toHaveLength(0);
  });

  it('G0: intercepts handleClotureIntervention via active sessionStorage role even when actorRole is omitted', () => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem(
        'gmao_session_v2',
        JSON.stringify({ id: 'TECH-01', name: 'Karim Tech', role: 'TECHNICIEN' })
      );
    }

    const store = useGmaoStore.getState();
    const result = store.handleClotureIntervention('BT-TEST-001', {
      action_realisee: 'Tentative de clôture directe sans actorRole explicite',
      date_fin: '2026-04-01',
      heure_fin: '11:00',
      pieces_utilisees: [{ ref: 'PDR-RLM-6205', quantite: 1 }],
    });

    expect(result).toBeTruthy();
    expect(result.validation_status).toBe('PENDING_VALIDATION');
    expect(result.statut).toBe('EN_COURS');
    expect(result.action_fermee).toBe('NON');
    expect(result.stock_deducted).toBe(false);
    expect(result.pieces_utilisees).toEqual([]);
    expect(useGmaoStore.getState().mouvements).toHaveLength(0);
  });

  it('VAL-2: preserves pieces_claimed and flags validated_with_edits when Admin modifies parts before approval', () => {
    const store = useGmaoStore.getState();
    store.handleSubmitInterventionForValidation('BT-TEST-001', {
      intervention_nature: 'REPLACE',
      action_realisee: 'Changement roulements',
      date_fin_proposee: '2026-04-01',
      heure_fin_proposee: '10:30',
      pieces_proposees: [{ ref: 'PDR-RLM-6205', quantite: 3 }],
      submitted_by_name: 'Karim Tech',
    });

    const approved = useGmaoStore.getState().handleReviewInterventionValidation('BT-TEST-001', {
      decision: 'APPROVED',
      intervention_nature: 'REPLACE',
      action_realisee: 'Changement roulement (1 seul remplacé après contrôle)',
      pieces_utilisees: [{ ref: 'PDR-RLM-6205', quantite: 1 }],
      validated_by_name: 'Responsable Maintenance',
      validation_note: 'Quantité ajustée de 3 à 1 selon bon magasin',
    });

    expect(approved).toBeTruthy();
    expect(approved.statut).toBe('CLOTURE');
    expect(approved.action_fermee).toBe('OUI');
    expect(approved.validation_status).toBe('APPROVED');
    expect(approved.validated_with_edits).toBe(true);
    expect(approved.stock_deducted).toBe(true);
    expect(approved.stock_effect).toBe('APPLIED');
    expect(approved.pieces_claimed).toHaveLength(1);
    expect(approved.pieces_claimed[0].quantite).toBe(3);
    expect(approved.pieces_utilisees).toHaveLength(1);
    expect(approved.pieces_utilisees[0].quantite).toBe(1);

    const meta = getValidationStatusMeta(approved);
    expect(meta.status).toBe('APPROVED');
    expect(meta.validatedWithEdits).toBe(true);
    expect(meta.label).toContain('AJUSTÉ PAR ADMIN');
    expect(meta.natureMeta?.nature).toBe('REPLACE');
  });

  it('VAL-1 & VAL-2: REJECTED decision keeps official stock untouched and exposes clear rejection metadata', () => {
    const store = useGmaoStore.getState();
    store.handleSubmitInterventionForValidation('BT-TEST-001', {
      intervention_nature: 'CLEAN',
      action_realisee: 'Nettoyage capteur sans remplacement',
      pieces_proposees: [{ ref: 'PDR-RLM-6205', quantite: 1 }],
      submitted_by_name: 'Karim Tech',
    });

    const rejected = useGmaoStore.getState().handleReviewInterventionValidation('BT-TEST-001', {
      decision: 'REJECTED',
      validation_note: 'Simple nettoyage, aucune pièce sortie du magasin',
      validated_by_name: 'Admin GMAO',
    });

    expect(rejected).toBeTruthy();
    expect(rejected.validation_status).toBe('REJECTED');
    expect(rejected.action_fermee).toBe('NON');
    expect(rejected.stock_deducted).toBe(false);
    expect(rejected.stock_effect).toBe('NONE');
    expect(rejected.pieces_utilisees).toEqual([]);
    expect(useGmaoStore.getState().mouvements).toHaveLength(0);

    const meta = getValidationStatusMeta(rejected);
    expect(meta.status).toBe('REJECTED');
    expect(meta.label).toContain('REJETÉ');
    expect(meta.validationNote).toBe('Simple nettoyage, aucune pièce sortie du magasin');
  });

  it('VAL-3: resubmission after NEEDS_CLARIFICATION or REJECTED returns to PENDING_VALIDATION, archives old note, and updates pieces_claimed', () => {
    const store = useGmaoStore.getState();
    store.handleSubmitInterventionForValidation('BT-TEST-001', {
      intervention_nature: 'REPLACE',
      action_realisee: 'Remplacement roulement',
      pieces_proposees: [{ ref: 'PDR-RLM-6205', quantite: 2 }],
      submitted_by_name: 'Karim Tech',
    });

    // Step 1: Admin requests clarification
    const clarified = useGmaoStore.getState().handleReviewInterventionValidation('BT-TEST-001', {
      decision: 'NEEDS_CLARIFICATION',
      validation_note: 'Merci de vérifier la référence exacte avec le magasinier',
      validated_by_name: 'Responsable Maintenance',
    });

    expect(clarified.validation_status).toBe('NEEDS_CLARIFICATION');
    expect(clarified.validation_note).toBe(
      'Merci de vérifier la référence exacte avec le magasinier'
    );
    expect(clarified.stock_deducted).toBe(false);

    // Step 2: Technician corrects and resubmits
    const resubmitted = useGmaoStore.getState().handleSubmitInterventionForValidation(
      'BT-TEST-001',
      {
        intervention_nature: 'REPLACE',
        action_realisee: 'Remplacement joint torique et 1 roulement',
        pieces_proposees: [
          { ref: 'PDR-RLM-6205', quantite: 1 },
          { ref: 'PDR-JNT-10', quantite: 2 },
        ],
        submitted_by_name: 'Karim Tech',
      }
    );

    expect(resubmitted.validation_status).toBe('PENDING_VALIDATION');
    expect(resubmitted.validation_note).toBe('');
    expect(resubmitted.previous_validation_note).toBe(
      'Merci de vérifier la référence exacte avec le magasinier'
    );
    expect(resubmitted.previous_validation_status).toBe('NEEDS_CLARIFICATION');
    expect(resubmitted.resubmitted_count).toBe(1);
    expect(resubmitted.stock_deducted).toBe(false);
    expect(resubmitted.pieces_claimed).toHaveLength(2);
    expect(resubmitted.pieces_proposees).toHaveLength(2);
    expect(useGmaoStore.getState().mouvements).toHaveLength(0);
  });

  it('VAL-4: preserves intervention_nature and handles legacy records without nature gracefully', () => {
    const store = useGmaoStore.getState();

    // Legacy record without intervention_nature
    const legacyMeta = getValidationStatusMeta({
      id: 'BT-LEGACY',
      statut: 'CLOTURE',
      action_fermee: 'OUI',
    });
    expect(legacyMeta.natureMeta).toBeNull();
    expect(getInterventionNatureMeta(undefined)).toBeNull();

    // Explicit nature
    const submitted = store.handleSubmitInterventionForValidation('BT-TEST-001', {
      intervention_nature: 'CLEAN',
      action_realisee: 'Nettoyage complet armoire électrique',
      pieces_proposees: [],
      submitted_by_name: 'Karim Tech',
    });

    expect(submitted.intervention_nature).toBe('CLEAN');
    expect(submitted.stock_effect).toBe('NONE');

    const natureMeta = getInterventionNatureMeta(submitted.intervention_nature);
    expect(natureMeta?.nature).toBe('CLEAN');
    expect(natureMeta?.requiresParts).toBe(false);
  });

  it('VAL-5: selectValidationCenterQueues computes live pending, clarification, rejected, and approvedToday KPIs accurately', async () => {
    const { selectValidationCenterQueues } = await import(
      '../core/security/validationReconciliation'
    );

    const queues = selectValidationCenterQueues({
      todayIsoDate: '2026-11-06',
      correctiveInterventions: [
        { id: 'BT-1', validation_status: 'PENDING_VALIDATION', statut: 'EN_COURS' },
        { id: 'BT-2', validation_status: 'NEEDS_CLARIFICATION', statut: 'EN_COURS' },
        { id: 'BT-3', validation_status: 'REJECTED', statut: 'EN_COURS' },
        {
          id: 'BT-4',
          validation_status: 'APPROVED',
          statut: 'CLOTURE',
          validated_at: '2026-11-06T09:15:00.000Z',
        },
        {
          id: 'BT-5',
          validation_status: 'APPROVED',
          statut: 'CLOTURE',
          validated_at: '2026-11-01T14:00:00.000Z',
        },
      ],
      preventiveExecutions: [
        { id: 'PM-1', validation_status: 'PENDING_VALIDATION' },
        { id: 'PM-2', validation_status: 'PENDING_VALIDATION' },
        {
          id: 'PM-3',
          validation_status: 'APPROVED',
          validated_at: '2026-11-06T10:30:00.000Z',
        },
      ],
      sortieDemands: [
        { id: 'SD-1', validation_status: 'NEEDS_CLARIFICATION' },
        { id: 'SD-2', validation_status: 'REJECTED' },
      ],
    });

    expect(queues.pendingCorrective).toHaveLength(1);
    expect(queues.pendingPreventive).toHaveLength(2);
    expect(queues.pendingSortieDemands).toHaveLength(0);
    expect(queues.totalPending).toBe(3);

    expect(queues.clarificationCorrective).toHaveLength(1);
    expect(queues.clarificationPreventive).toHaveLength(0);
    expect(queues.clarificationSortieDemands).toHaveLength(1);
    expect(queues.totalClarification).toBe(2);

    expect(queues.rejectedCorrective).toHaveLength(1);
    expect(queues.rejectedPreventive).toHaveLength(0);
    expect(queues.rejectedSortieDemands).toHaveLength(1);
    expect(queues.totalRejected).toBe(2);

    expect(queues.approvedTodayCorrective).toBe(1);
    expect(queues.approvedTodayPreventive).toBe(1);
    expect(queues.approvedTodaySortieDemands).toBe(0);
    expect(queues.totalApprovedToday).toBe(2);
    expect(queues.hasAnyApprovedTimestamp).toBe(true);
  });
});
