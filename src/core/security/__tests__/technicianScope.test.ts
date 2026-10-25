import { describe, it, expect, beforeEach } from 'vitest';
import {
  isTechnicianRole,
  getTechnicianDisplayName,
  getTechnicianBadgeLabel,
  matchesTechnicianRecord,
  buildTechnicianDashboardScope,
} from '../technicianScope';
import { AuthorizationService } from '../AuthorizationService';
import {
  reconcileFieldClaim,
  buildAdminValidationRadar,
} from '../validationReconciliation';
import { useGmaoStore } from '../../../store/useGmaoStore';

const SAMPLE_TECHNICIANS = [
  { id_technician: 'TECH-01', nom: 'Rachid', id_zone: 'FM', specialite: 'Mécanique' },
  { id_technician: 'TECH-02', nom: 'Youssef', id_zone: 'Polissage', specialite: 'Polissage' },
  { id_technician: 'TECH-03', nom: 'Mhammed', id_zone: 'Presse injection', specialite: 'Injection' },
];

describe('technicianScope (R4 Row-Level Identity Matching & R5 Dashboard Scope)', () => {
  it('detects TECHNICIEN role accurately and ignores ADMIN/VIEWER', () => {
    expect(isTechnicianRole({ role: 'TECHNICIEN' })).toBe(true);
    expect(isTechnicianRole({ role: 'technicien' })).toBe(true);
    expect(isTechnicianRole({ role: 'ADMIN' })).toBe(false);
    expect(isTechnicianRole(null)).toBe(false);
  });

  it('resolves display name and badge label from session + personnel directory', () => {
    const sessionUser = {
      id: 'TECH-01',
      role: 'TECHNICIEN',
      personnelId: 'TECH-01',
      personnelName: 'Rachid',
      name: 'Rachid',
    };
    expect(getTechnicianDisplayName(sessionUser, SAMPLE_TECHNICIANS)).toBe('Rachid');
    expect(getTechnicianBadgeLabel(sessionUser, SAMPLE_TECHNICIANS)).toBe('Rachid (TECH-01)');
  });

  it('matches PreventiveTask by responsable name or id_technicien code', () => {
    const tech01Session = {
      id: 'TECH-01',
      role: 'TECHNICIEN',
      personnelId: 'TECH-01',
      personnelName: 'Rachid',
    };

    expect(
      matchesTechnicianRecord({ id: 'T1', responsable: 'Rachid' }, tech01Session, SAMPLE_TECHNICIANS)
    ).toBe(true);
    expect(
      matchesTechnicianRecord({ id: 'T2', id_technicien: 'TECH-01' }, tech01Session, SAMPLE_TECHNICIANS)
    ).toBe(true);
    expect(
      matchesTechnicianRecord({ id: 'T3', responsable: 'Youssef' }, tech01Session, SAMPLE_TECHNICIANS)
    ).toBe(false);
  });

  it('matches CorrectiveIntervention by intervenant name or technicien_matricule even if session only has personnelId', () => {
    const tech03Session = {
      id: 'TECH-03',
      role: 'TECHNICIEN',
      personnelId: 'TECH-03',
    };

    expect(
      matchesTechnicianRecord(
        { id: 'CORR-1', intervenant: 'Mhammed', technicien_matricule: 'TECH-03' },
        tech03Session,
        SAMPLE_TECHNICIANS
      )
    ).toBe(true);
    expect(
      matchesTechnicianRecord(
        { id: 'CORR-2', intervenant: 'Mhammed' },
        tech03Session,
        SAMPLE_TECHNICIANS
      )
    ).toBe(true);
    expect(
      matchesTechnicianRecord(
        { id: 'CORR-3', intervenant: 'Rachid', technicien_matricule: 'TECH-01' },
        tech03Session,
        SAMPLE_TECHNICIANS
      )
    ).toBe(false);
  });

  it('R5: buildTechnicianDashboardScope filters preventive tasks, corrective WOs, executions, and movements for TECHNICIEN only', () => {
    const tech01Session = {
      id: 'TECH-01',
      role: 'TECHNICIEN',
      personnelId: 'TECH-01',
      personnelName: 'Rachid',
    };

    const preventiveTasks = [
      { id: 'PRV-1', id_machine: 'M1', responsable: 'Rachid', etat: 'En retard', planning: { S10: true } },
      { id: 'PRV-2', id_machine: 'M2', id_technicien: 'TECH-01', etat: 'À faire', planning: { S12: true } },
      { id: 'PRV-3', id_machine: 'M3', responsable: 'Rachid', etat: 'Fait' },
      { id: 'PRV-4', id_machine: 'M4', responsable: 'Youssef', etat: 'En retard' },
    ];

    const correctiveInterventions = [
      { id: 'BT-1', code_machine: 'M1', intervenant: 'Rachid', statut: 'EN_COURS' },
      { id: 'BT-2', code_machine: 'M2', technicien_matricule: 'TECH-01', statut: 'BT_PLANIFIE' },
      { id: 'BT-3', code_machine: 'M1', intervenant: 'Rachid', statut: 'CLOTURE' },
      { id: 'BT-4', code_machine: 'M4', intervenant: 'Youssef', statut: 'EN_COURS' },
    ];

    const preventiveExecutions = [
      { id: 'EX-1', id_machine: 'M3', technicien: 'Rachid', date_execution: '2026-10-20' },
      { id: 'EX-2', id_machine: 'M4', technicien: 'Youssef', date_execution: '2026-10-21' },
    ];

    const mouvements = [
      { id: 'MV-1', type: 'Sortie Interne', ref: 'ROUL-6204', quantite: 2, technicien: 'Rachid' },
      { id: 'MV-2', type: 'Sortie Interne', ref: 'COUR-A42', quantite: 5, technicien: 'Youssef' },
    ];

    const scope = buildTechnicianDashboardScope({
      user: tech01Session,
      technicians: SAMPLE_TECHNICIANS,
      preventiveTasks,
      preventiveExecutions,
      correctiveInterventions,
      mouvements,
      currentWeekKey: 'S12',
    });

    expect(scope.isTechUser).toBe(true);
    expect(scope.badgeLabel).toBe('Rachid (TECH-01)');
    expect(scope.myPreventiveTasks).toHaveLength(3);
    expect(scope.overdueTasks).toHaveLength(1);
    expect(scope.thisWeekTasks).toHaveLength(1);
    expect(scope.todoTasks).toHaveLength(1);
    expect(scope.doneTasks).toHaveLength(1);
    expect(scope.priorityTasks[0].id).toBe('PRV-1'); // En retard prioritized first
    expect(scope.myCorrectiveInterventions).toHaveLength(3);
    expect(scope.openCorrective).toHaveLength(2);
    expect(scope.liveCorrective).toHaveLength(1);
    expect(scope.plannedBtCorrective).toHaveLength(1);
    expect(scope.closedCorrective).toHaveLength(1);
    expect(scope.myPreventiveExecutions).toHaveLength(1);
    expect(scope.myMouvements).toHaveLength(1);
    expect(scope.totalMySortiePieces).toBe(2);
  });

  it('R5: enforces ROLE_ALLOWED_TABS for technician quick shortcuts and blocks admin/referentiel tabs', () => {
    const techUser = { role: 'TECHNICIEN', personnelId: 'TECH-01' };
    expect(AuthorizationService.canAccessTab(techUser, 'preventive')).toBe(true);
    expect(AuthorizationService.canAccessTab(techUser, 'corrective')).toBe(true);
    expect(AuthorizationService.canAccessTab(techUser, 'stock')).toBe(true);
    expect(AuthorizationService.canAccessTab(techUser, 'sortie')).toBe(true);
    expect(AuthorizationService.canAccessTab(techUser, 'machines')).toBe(true);
    expect(AuthorizationService.canAccessTab(techUser, 'guide')).toBe(true);

    // Blocked for technician
    expect(AuthorizationService.canAccessTab(techUser, 'settings')).toBe(false);
    expect(AuthorizationService.canAccessTab(techUser, 'utilisateurs')).toBe(false);
    expect(AuthorizationService.canAccessTab(techUser, 'blueprints')).toBe(false);
    expect(AuthorizationService.canAccessTab(techUser, 'families')).toBe(false);
    expect(AuthorizationService.canAccessTab(techUser, 'entrepot')).toBe(false);
    expect(AuthorizationService.canAccessTab(techUser, 'zones')).toBe(false);
  });
});

describe('V1+V2 Maker-Checker Validation Lifecycle on Corrective Maintenance', () => {
  beforeEach(() => {
    useGmaoStore.setState({
      activeLiveInterventionId: 'BT-MC-01',
      correctiveInterventions: [
        {
          id: 'BT-MC-01',
          date: '2026-10-25',
          semaine: 'S43',
          mois: '10',
          code_machine: 'M-101',
          designation_machine: 'Presse Injection 1',
          zone: 'FM',
          criticite: 'Haute',
          statut_equipement: 'En arrêt',
          description_anomalie: 'Fuite vérin hydraulique',
          type_panne: 'Hydraulique',
          cause_racine: '',
          action_realisee: '',
          action_fermee: 'NON',
          intervenant: 'Rachid',
          technicien_matricule: 'TECH-01',
          heure_demande: '08:00',
          heure_debut: '08:30',
          heure_fin: '',
          temps_attente: '30m',
          temps_intervention: '',
          temps_arret_total: '',
          pdr_ref: '',
          pdr_designation: '',
          pdr_quantite: 0,
          pieces_utilisees: [],
          statut: 'EN_COURS',
        },
      ],
      mouvements: [],
    });
  });

  it('Technician submission sets PENDING_VALIDATION & pieces_proposees WITHOUT deducting stock or closing BT', () => {
    const store = useGmaoStore.getState();
    store.handleSubmitInterventionForValidation('BT-MC-01', {
      cause_racine: 'Joint torique usé',
      action_realisee: 'Remplacement joint + purge',
      pieces_proposees: [
        { ref: 'JNT-40', designation: 'Joint Torique 40mm', quantite: 2, unite: 'pcs' },
      ],
      num_bon_saisi_par_tech: 'BON-TERRAIN-77',
      date_fin_proposee: '2026-10-25',
      heure_fin_proposee: '10:00',
      submitted_by_id: 'TECH-01',
      submitted_by_name: 'Rachid',
    });

    const updatedState = useGmaoStore.getState();
    const bt = updatedState.correctiveInterventions.find(i => i.id === 'BT-MC-01')!;

    expect(bt.validation_status).toBe('PENDING_VALIDATION');
    expect(bt.statut).toBe('EN_COURS');
    expect(bt.action_fermee).toBe('NON');
    expect(bt.pieces_proposees).toEqual([
      expect.objectContaining({ ref: 'JNT-40', designation: 'Joint Torique 40mm', quantite: 2, unite: 'pcs' }),
    ]);
    // Official approved pieces remain empty until Admin approval
    expect(bt.pieces_utilisees).toEqual([]);
    expect(bt.pdr_quantite).toBe(0);
    expect(bt.num_bon_saisi_par_tech).toBe('BON-TERRAIN-77');
    expect(bt.submitted_by_id).toBe('TECH-01');
    expect(bt.submitted_by_name).toBe('Rachid');
    expect(bt.temps_intervention_propose).toBe('1h 30m');
    expect(updatedState.activeLiveInterventionId).toBeNull();
    expect(updatedState.mouvements).toHaveLength(0);
  });

  it('Admin NEEDS_CLARIFICATION returns BT to technician with validation_note and zero stock deduction', () => {
    const store = useGmaoStore.getState();
    store.handleSubmitInterventionForValidation('BT-MC-01', {
      cause_racine: 'Joint torique usé',
      action_realisee: 'Remplacement joint',
      pieces_proposees: [
        { ref: 'JNT-40', designation: 'Joint Torique 40mm', quantite: 5, unite: 'pcs' },
      ],
      submitted_by_id: 'TECH-01',
      submitted_by_name: 'Rachid',
    });

    const emittedMovements: any[] = [];
    useGmaoStore.getState().handleReviewInterventionValidation(
      'BT-MC-01',
      {
        decision: 'NEEDS_CLARIFICATION',
        validation_note: 'Vérifier la quantité: 2 joints au lieu de 5 ?',
        validated_by_id: 'ADMIN-01',
        validated_by_name: 'Responsable Maintenance',
      },
      mv => emittedMovements.push(mv)
    );

    const updatedBt = useGmaoStore.getState().correctiveInterventions.find(i => i.id === 'BT-MC-01')!;
    expect(updatedBt.validation_status).toBe('NEEDS_CLARIFICATION');
    expect(updatedBt.validation_note).toBe('Vérifier la quantité: 2 joints au lieu de 5 ?');
    expect(updatedBt.statut).toBe('EN_COURS');
    expect(updatedBt.action_fermee).toBe('NON');
    expect(emittedMovements).toHaveLength(0);

    // Verify technician dashboard scope surfaces needsClarificationCorrective
    const scope = buildTechnicianDashboardScope({
      user: { id: 'TECH-01', role: 'TECHNICIEN', personnelId: 'TECH-01', personnelName: 'Rachid' },
      technicians: SAMPLE_TECHNICIANS,
      preventiveTasks: [],
      preventiveExecutions: [],
      correctiveInterventions: useGmaoStore.getState().correctiveInterventions,
      mouvements: [],
      currentWeekKey: 'S43',
    });
    expect(scope.needsClarificationCorrective).toHaveLength(1);
    expect(scope.needsClarificationCorrective[0].id).toBe('BT-MC-01');
  });

  it('Admin APPROVED closes BT officially, stamps validation metadata, and emits Sortie movement exactly once', () => {
    const store = useGmaoStore.getState();
    store.handleSubmitInterventionForValidation('BT-MC-01', {
      cause_racine: 'Joint torique usé',
      action_realisee: 'Remplacement joint + purge',
      pieces_proposees: [
        { ref: 'JNT-40', designation: 'Joint Torique 40mm', quantite: 5, unite: 'pcs' },
      ],
      date_fin_proposee: '2026-10-25',
      heure_fin_proposee: '10:00',
      submitted_by_id: 'TECH-01',
      submitted_by_name: 'Rachid',
    });

    const emittedMovements: any[] = [];
    // Admin adjusts quantity from 5 to 2 during approval
    useGmaoStore.getState().handleReviewInterventionValidation(
      'BT-MC-01',
      {
        decision: 'APPROVED',
        pieces_utilisees: [
          { ref: 'JNT-40', designation: 'Joint Torique 40mm', quantite: 2, unite: 'pcs' },
        ],
        validation_note: 'Quantité corrigée à 2 pcs après contrôle magasin',
        validated_by_id: 'ADMIN-01',
        validated_by_name: 'Responsable Maintenance',
      },
      mv => emittedMovements.push(mv)
    );

    const closedBt = useGmaoStore.getState().correctiveInterventions.find(i => i.id === 'BT-MC-01')!;
    expect(closedBt.statut).toBe('CLOTURE');
    expect(closedBt.action_fermee).toBe('OUI');
    expect(closedBt.validation_status).toBe('APPROVED');
    expect(closedBt.validated_by_name).toBe('Responsable Maintenance');
    expect(closedBt.validation_note).toBe('Quantité corrigée à 2 pcs après contrôle magasin');
    expect(closedBt.pieces_utilisees).toEqual([
      expect.objectContaining({ ref: 'JNT-40', designation: 'Joint Torique 40mm', quantite: 2, unite: 'pcs' }),
    ]);
    expect(closedBt.temps_intervention).toBe('1h 30m');

    // Exactly 1 Sortie movement emitted with the approved quantity (2)
    expect(emittedMovements).toHaveLength(1);
    expect(emittedMovements[0].ref).toBe('JNT-40');
    expect(emittedMovements[0].quantite).toBe(2);
    expect(emittedMovements[0].code_bon).toContain('BS-BT-BT-MC-01');

    // Attempting a duplicate approval/closure is blocked by the terminal state guard
    useGmaoStore.getState().handleReviewInterventionValidation(
      'BT-MC-01',
      {
        decision: 'APPROVED',
        validated_by_id: 'ADMIN-01',
        validated_by_name: 'Responsable Maintenance',
      },
      mv => emittedMovements.push(mv)
    );
    expect(emittedMovements).toHaveLength(1);
  });
});

describe('V3 Maker-Checker on Preventive Executions & Direct Stock Bypass Closure', () => {
  beforeEach(() => {
    useGmaoStore.setState({
      preventiveTasks: [
        {
          id: 'PRV-MC-01',
          code: 'PRV-MC-01',
          id_machine: 'M-202',
          nom_machine: 'Extrudeuse Principale',
          composant: 'Réducteur Principal',
          action_code: 'V',
          action_libelle: 'Vidange huile réducteur',
          frequence: 'Mensuel',
          responsable: 'Rachid',
          id_technicien: 'TECH-01',
          etat: 'À faire',
          cout_cumule: 0,
          planning: { S43: 'P' },
        },
      ],
      preventiveExecutions: [],
      mouvements: [],
    });
  });

  it('revokes direct movement.create permission from TECHNICIEN and OPERATEUR while preserving it for ADMIN/MAGASIN', () => {
    expect(AuthorizationService.hasPermission({ role: 'TECHNICIEN' }, 'movement.create')).toBe(false);
    expect(AuthorizationService.hasPermission({ role: 'OPERATEUR' }, 'movement.create')).toBe(false);
    expect(AuthorizationService.hasPermission({ role: 'ADMIN' }, 'movement.create')).toBe(true);
    expect(AuthorizationService.hasPermission({ role: 'RESPONSABLE_MAGASIN' }, 'movement.create')).toBe(true);
  });

  it('Technician preventive execution records PENDING_VALIDATION with sparesProposed and ZERO stock deduction until Admin approval', () => {
    const store = useGmaoStore.getState();

    // 1. Technician submits preventive task execution with proposed PDR
    store.handleMarkTaskDone('PRV-MC-01', {
      date_realisation: '2026-10-25',
      technicien: 'Rachid',
      duree_reelle: '30 min',
      taux_horaire: 30,
      observations: 'Vidange effectuée, niveau vérifié.',
      usedPDR: [
        {
          reference: 'HUILE-ISO-220',
          designation: 'Huile Réducteur ISO VG 220',
          quantite: 5,
          unite: 'L',
          prix_unitaire: 12,
        },
      ],
      num_bon_saisi_par_tech: 'BS-TERRAIN-19',
      submitForValidation: true,
      validation_status: 'PENDING_VALIDATION',
      submitted_by_id: 'TECH-01',
      submitted_by_name: 'Rachid',
    });

    const afterSubmit = useGmaoStore.getState();
    const pendingTask = afterSubmit.preventiveTasks.find(t => t.id === 'PRV-MC-01')!;
    const pendingExec = afterSubmit.preventiveExecutions[0];

    expect(pendingTask.etat).toBe('En attente validation');
    expect(pendingTask.validation_status).toBe('PENDING_VALIDATION');
    expect(pendingTask.cout_cumule).toBe(0); // Not added to cumulative cost before approval
    expect(pendingExec.validation_status).toBe('PENDING_VALIDATION');
    expect(pendingExec.stock_deducted).toBe(false);
    expect(pendingExec.sparesProposed).toHaveLength(1);
    expect(pendingExec.sparesProposed?.[0].ref).toBe('HUILE-ISO-220');
    expect(pendingExec.sparesProposed?.[0].qty).toBe(5);
    expect(pendingExec.sparesUsed).toHaveLength(0);
    expect(pendingExec.num_bon_saisi_par_tech).toBe('BS-TERRAIN-19');

    // 2. Admin requests clarification -> task becomes 'À clarifier', zero stock movement
    const emittedMovements: any[] = [];
    useGmaoStore.getState().handleReviewPreventiveExecutionValidation(
      pendingExec.id,
      {
        decision: 'NEEDS_CLARIFICATION',
        validation_note: 'Confirmer si 4L ou 5L utilisés sur le réducteur',
        validated_by_id: 'ADMIN-01',
        validated_by_name: 'Chef Maintenance',
      },
      mv => emittedMovements.push(mv)
    );

    const afterClarify = useGmaoStore.getState();
    const clarifyTask = afterClarify.preventiveTasks.find(t => t.id === 'PRV-MC-01')!;
    expect(clarifyTask.etat).toBe('À clarifier');
    expect(clarifyTask.validation_status).toBe('NEEDS_CLARIFICATION');
    expect(clarifyTask.validation_note).toBe('Confirmer si 4L ou 5L utilisés sur le réducteur');
    expect(emittedMovements).toHaveLength(0);

    // 3. Admin approves with adjusted quantity (4L) -> task marked 'Fait', stock movement emitted once
    useGmaoStore.getState().handleReviewPreventiveExecutionValidation(
      pendingExec.id,
      {
        decision: 'APPROVED',
        approvedSpares: [
          {
            ref: 'HUILE-ISO-220',
            designation: 'Huile Réducteur ISO VG 220',
            qty: 4,
            unit: 'L',
            unitPrice: 12,
          },
        ],
        validation_note: 'Validé à 4L conformément à la capacité carter',
        validated_by_id: 'ADMIN-01',
        validated_by_name: 'Chef Maintenance',
      },
      mv => emittedMovements.push(mv)
    );

    const afterApprove = useGmaoStore.getState();
    const approvedTask = afterApprove.preventiveTasks.find(t => t.id === 'PRV-MC-01')!;
    const approvedExec = afterApprove.preventiveExecutions.find(e => e.id === pendingExec.id)!;

    expect(approvedTask.etat).toBe('Fait');
    expect(approvedTask.validation_status).toBe('APPROVED');
    expect(approvedExec.validation_status).toBe('APPROVED');
    expect(approvedExec.stock_deducted).toBe(true);
    expect(approvedExec.sparesUsed).toHaveLength(1);
    expect(approvedExec.sparesUsed[0].qty).toBe(4);
    expect(approvedExec.sparesCost).toBe(48);

    // Exactly 1 Sortie Interne movement emitted
    expect(emittedMovements).toHaveLength(1);
    expect(emittedMovements[0].ref).toBe('HUILE-ISO-220');
    expect(emittedMovements[0].quantite).toBe(4);
    expect(emittedMovements[0].action_id).toBe('PREVENTIVE');

    // Duplicate approval call is blocked by terminal guard
    useGmaoStore.getState().handleReviewPreventiveExecutionValidation(
      pendingExec.id,
      {
        decision: 'APPROVED',
        validated_by_id: 'ADMIN-01',
        validated_by_name: 'Chef Maintenance',
      },
      mv => emittedMovements.push(mv)
    );
    expect(emittedMovements).toHaveLength(1);
  });
});

describe('V4 Smart Reconciliation & Admin Validation Radar', () => {
  const stockItems = [
    { ref: 'RLM-6205', designation: 'Roulement 6205 ZZ', stockActuel: 3 },
    { ref: 'HUILE-ISO-220', designation: 'Huile Réducteur ISO VG 220', stockActuel: 5 },
  ];

  const mouvements = [
    { id: 'MVT-100', code_bon: 'BS-9001', ref: 'RLM-6205', quantite: 1, type: 'Sortie Interne' },
  ];

  it('detects DUPLICATE_BON, STOCK_SHORTAGE, CONCURRENT_CLAIM_OVERFLOW, and MISSING_BON_WITH_PDR', () => {
    const correctiveInterventions = [
      {
        id: 'BT-PEND-1',
        num_bt: 'BT-0088',
        code_machine: 'M-101',
        validation_status: 'PENDING_VALIDATION',
        num_bon_saisi_par_tech: 'BS-9001', // Duplicate with MVT-100
        pieces_proposees: [{ ref: 'RLM-6205', designation: 'Roulement 6205 ZZ', quantite: 2 }],
      },
      {
        id: 'BT-PEND-2',
        num_bt: 'BT-0089',
        code_machine: 'M-102',
        validation_status: 'PENDING_VALIDATION',
        num_bon_saisi_par_tech: '', // Missing bon while proposing PDR
        pieces_proposees: [
          { ref: 'RLM-6205', designation: 'Roulement 6205 ZZ', quantite: 2 }, // 2 + 2 = 4 > stockActuel 3 -> CONCURRENT_CLAIM_OVERFLOW
          { ref: 'HUILE-ISO-220', designation: 'Huile Réducteur', quantite: 8 }, // 8 > stockActuel 5 -> STOCK_SHORTAGE
        ],
      },
    ];

    const res1 = reconcileFieldClaim({
      claimType: 'CORRECTIVE',
      claimId: 'BT-PEND-1',
      numBonSaisi: 'BS-9001',
      proposedSpares: correctiveInterventions[0].pieces_proposees,
      stockItems,
      mouvements,
      correctiveInterventions,
      preventiveExecutions: [],
    });

    expect(res1.hasCritical).toBe(true);
    expect(res1.alerts.map((a) => a.code)).toContain('DUPLICATE_BON');
    expect(res1.alerts.map((a) => a.code)).toContain('CONCURRENT_CLAIM_OVERFLOW');

    const res2 = reconcileFieldClaim({
      claimType: 'CORRECTIVE',
      claimId: 'BT-PEND-2',
      numBonSaisi: '',
      proposedSpares: correctiveInterventions[1].pieces_proposees,
      stockItems,
      mouvements,
      correctiveInterventions,
      preventiveExecutions: [],
    });

    expect(res2.hasCritical).toBe(true);
    expect(res2.alerts.map((a) => a.code)).toContain('MISSING_BON_WITH_PDR');
    expect(res2.alerts.map((a) => a.code)).toContain('CONCURRENT_CLAIM_OVERFLOW');
    expect(res2.alerts.map((a) => a.code)).toContain('STOCK_SHORTAGE');
  });

  it('builds unified AdminValidationRadar across Corrective & Preventive queues sorted by criticality', () => {
    const radar = buildAdminValidationRadar({
      stockItems,
      mouvements,
      correctiveInterventions: [
        {
          id: 'BT-OK-1',
          num_bt: 'BT-0100',
          code_machine: 'M-101',
          validation_status: 'PENDING_VALIDATION',
          num_bon_saisi_par_tech: 'BS-NEW-100',
          submitted_by_name: 'Rachid',
          submitted_at: '2026-10-25T08:00:00Z',
          pieces_proposees: [{ ref: 'RLM-6205', quantite: 1 }],
        },
        {
          id: 'BT-CLAR-1',
          num_bt: 'BT-0101',
          code_machine: 'M-101',
          validation_status: 'NEEDS_CLARIFICATION',
        },
      ],
      preventiveExecutions: [
        {
          id: 'EXEC-CRIT-1',
          actionCode: 'PRV-09',
          machineCode: 'M-202',
          organe: 'Réducteur',
          executorName: 'Youssef',
          validation_status: 'PENDING_VALIDATION',
          num_bon_saisi_par_tech: 'BS-9001', // Duplicate with existing movement
          submitted_at: '2026-10-25T07:00:00Z',
          sparesProposed: [{ ref: 'HUILE-ISO-220', qty: 2 }],
        },
      ],
    });

    expect(radar.pendingCorrectiveCount).toBe(1);
    expect(radar.pendingPreventiveCount).toBe(1);
    expect(radar.totalPendingCount).toBe(2);
    expect(radar.totalClarificationCount).toBe(1);
    expect(radar.criticalAlertCount).toBe(1);
    // Critical preventive item should be sorted first ahead of clean corrective item
    expect(radar.items[0].id).toBe('EXEC-CRIT-1');
    expect(radar.items[0].reconciliation.hasCritical).toBe(true);
    expect(radar.items[1].id).toBe('BT-OK-1');
    expect(radar.items[1].reconciliation.hasCritical).toBe(false);
  });
});




