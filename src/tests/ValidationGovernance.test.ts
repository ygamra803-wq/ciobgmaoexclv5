import { describe, it, expect, beforeEach } from 'vitest';
import { useGmaoStore } from '../store/useGmaoStore';
import { getValidationStatusMeta } from '../presentation/components/common/ValidationStatusBadge';

describe('VAL-1 & VAL-2 — Maker-Checker Validation Governance & Status Constitution', () => {
  beforeEach(() => {
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

  it('VAL-2: routes technician direct closure call through PENDING_VALIDATION without deducting stock', () => {
    const store = useGmaoStore.getState();
    const result = store.handleClotureIntervention('BT-TEST-001', {
      actorRole: 'TECHNICIEN',
      isTechnician: true,
      action_realisee: 'Remplacement roulement',
      date_fin: '2026-04-01',
      heure_fin: '10:00',
      pieces_utilisees: [{ ref: 'PDR-RLM-6205', quantite: 2 }],
    });

    expect(result).toBeTruthy();
    expect(result.validation_status).toBe('PENDING_VALIDATION');
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

  it('VAL-2: preserves pieces_claimed and flags validated_with_edits when Admin modifies parts before approval', () => {
    const store = useGmaoStore.getState();
    store.handleSubmitInterventionForValidation('BT-TEST-001', {
      action_realisee: 'Changement roulements',
      date_fin_proposee: '2026-04-01',
      heure_fin_proposee: '10:30',
      pieces_proposees: [{ ref: 'PDR-RLM-6205', quantite: 3 }],
      submitted_by_name: 'Karim Tech',
    });

    const approved = useGmaoStore.getState().handleReviewInterventionValidation('BT-TEST-001', {
      decision: 'APPROVED',
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
  });

  it('VAL-1 & VAL-2: REJECTED decision keeps official stock untouched and exposes clear rejection metadata', () => {
    const store = useGmaoStore.getState();
    store.handleSubmitInterventionForValidation('BT-TEST-001', {
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
});
