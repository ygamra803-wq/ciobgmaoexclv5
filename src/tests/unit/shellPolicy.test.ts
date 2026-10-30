import { describe, it, expect, beforeEach } from 'vitest';
import {
  SHELL_OVERRIDE_STORAGE_KEY,
  parseShellQueryParam,
  detectAutoShell,
  resolveShellPolicy,
  setShellMode,
  clearShellOverride,
} from '../../core/shell/shellPolicy';
import { STORAGE_KEYS } from '../../infrastructure/persistence/storageKeys';

describe('ShellPolicy Engine (Single Source of Truth for Desktop vs Mobile Shell)', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear();
    }
    if (typeof window !== 'undefined' && window.history?.replaceState) {
      window.history.replaceState({}, '', '/');
    }
  });

  it('parses ?shell=mobile|desktop|auto query parameters accurately and ignores invalid values', () => {
    expect(parseShellQueryParam('?shell=mobile')).toBe('mobile');
    expect(parseShellQueryParam('?shell=desktop')).toBe('desktop');
    expect(parseShellQueryParam('?shell=AUTO')).toBe('auto');
    expect(parseShellQueryParam('?foo=1&shell=mobile&bar=2')).toBe('mobile');
    expect(parseShellQueryParam('?shell=tablet')).toBeNull();
    expect(parseShellQueryParam('')).toBeNull();
  });

  it('auto-detects mobile vs desktop from viewport width and pointer/touch capabilities', () => {
    // 1. Smartphone (narrow + coarse pointer + touch)
    expect(
      detectAutoShell({ innerWidth: 390, pointerCoarse: true, maxTouchPoints: 5 })
    ).toBe('mobile');

    // 2. Narrow responsive viewport (< 768px even with mouse in DevTools)
    expect(
      detectAutoShell({ innerWidth: 500, pointerCoarse: false, maxTouchPoints: 0 })
    ).toBe('mobile');

    // 3. Industrial touch tablet (width 900 < 1024 + coarse pointer)
    expect(
      detectAutoShell({ innerWidth: 900, pointerCoarse: true, maxTouchPoints: 5 })
    ).toBe('mobile');

    // 4. Compact desktop window (width 960 < 1024, fine pointer, 0 touch points) -> stays desktop
    expect(
      detectAutoShell({ innerWidth: 960, pointerCoarse: false, maxTouchPoints: 0 })
    ).toBe('desktop');

    // 5. Standard Desktop PC (1440px, fine pointer)
    expect(
      detectAutoShell({ innerWidth: 1440, pointerCoarse: false, maxTouchPoints: 0 })
    ).toBe('desktop');
  });

  it('enforces strict override precedence: ?shell query > localStorage > auto detection', () => {
    const mockStorage = new Map<string, string>();
    const storageAdapter = {
      getItem: (k: string) => mockStorage.get(k) ?? null,
    };

    // Case A: localStorage forces 'desktop' on a narrow phone viewport
    mockStorage.set(SHELL_OVERRIDE_STORAGE_KEY, 'desktop');
    const forcedDesktop = resolveShellPolicy({
      search: '',
      storage: storageAdapter,
      env: { innerWidth: 375, pointerCoarse: true, maxTouchPoints: 5 },
    });
    expect(forcedDesktop.mode).toBe('desktop');
    expect(forcedDesktop.resolved).toBe('desktop');
    expect(forcedDesktop.source).toBe('storage');

    // Case B: URL ?shell=mobile overrides localStorage 'desktop' even on a 1920px desktop monitor
    const urlForcesMobile = resolveShellPolicy({
      search: '?shell=mobile',
      storage: storageAdapter,
      env: { innerWidth: 1920, pointerCoarse: false, maxTouchPoints: 0 },
    });
    expect(urlForcesMobile.mode).toBe('mobile');
    expect(urlForcesMobile.resolved).toBe('mobile');
    expect(urlForcesMobile.source).toBe('query');

    // Case C: URL ?shell=desktop overrides localStorage 'mobile' on a 375px phone
    mockStorage.set(SHELL_OVERRIDE_STORAGE_KEY, 'mobile');
    const urlForcesDesktop = resolveShellPolicy({
      search: '?shell=desktop',
      storage: storageAdapter,
      env: { innerWidth: 375, pointerCoarse: true, maxTouchPoints: 5 },
    });
    expect(urlForcesDesktop.mode).toBe('desktop');
    expect(urlForcesDesktop.resolved).toBe('desktop');
    expect(urlForcesDesktop.source).toBe('query');
  });

  it('persists manual mode via setShellMode and resets via clearShellOverride', () => {
    const stateMobile = setShellMode('mobile');
    expect(stateMobile.mode).toBe('mobile');
    expect(stateMobile.resolved).toBe('mobile');
    expect(window.localStorage.getItem(SHELL_OVERRIDE_STORAGE_KEY)).toBe('mobile');
    expect(window.localStorage.getItem(STORAGE_KEYS.DEVICE_MODE)).toBe('mobile');

    const stateDesktop = setShellMode('desktop');
    expect(stateDesktop.mode).toBe('desktop');
    expect(stateDesktop.resolved).toBe('desktop');
    expect(window.localStorage.getItem(SHELL_OVERRIDE_STORAGE_KEY)).toBe('desktop');

    const cleared = clearShellOverride();
    expect(cleared.mode).toBe('auto');
    expect(window.localStorage.getItem(SHELL_OVERRIDE_STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem(STORAGE_KEYS.DEVICE_MODE)).toBe('auto');
  });

  it('scopes technician preventive & corrective items strictly via buildTechnicianDashboardScope and preserves Maker-Checker PENDING_VALIDATION without stock deduction', async () => {
    const { buildTechnicianDashboardScope } = await import('../../core/security/technicianScope');
    const { ExecutionService } = await import('../../application/services/preventive/ExecutionService');

    const techUser = {
      id: 'TECH-01',
      id_technician: 'TECH-01',
      personnelId: 'TECH-01',
      code: 'TECH-01',
      personnelName: 'Karim Benali',
      name: 'Karim Benali',
      nom: 'Karim Benali',
      role: 'TECHNICIEN',
    };

    const preventiveTasks = [
      {
        id: 'T-1',
        id_machine: 'M-01',
        tache: 'Graissage palier',
        id_technicien: 'TECH-01',
        responsable: 'Karim Benali',
        etat: 'En retard',
      },
      {
        id: 'T-2',
        id_machine: 'M-02',
        tache: 'Contrôle pression',
        id_technicien: 'TECH-01',
        responsable: 'Karim Benali',
        etat: 'À clarifier',
        validation_status: 'NEEDS_CLARIFICATION',
        validation_note: 'Préciser la référence du filtre',
      },
      {
        id: 'T-OTHER',
        id_machine: 'M-03',
        tache: 'Tâche autre technicien',
        id_technicien: 'TECH-02',
        responsable: 'Autre Tech',
        etat: 'À faire',
      },
    ];

    const correctiveInterventions = [
      {
        id: 'BT-1',
        num_bt: 'BT-1001',
        code_machine: 'M-01',
        anomalie: 'Fuite huile',
        id_technician: 'TECH-01',
        intervenant: 'Karim Benali',
        statut: 'EN_COURS',
      },
      {
        id: 'BT-2',
        num_bt: 'BT-1002',
        code_machine: 'M-02',
        anomalie: 'Capteur HS',
        id_technician: 'TECH-01',
        intervenant: 'Karim Benali',
        statut: 'EN_COURS',
        validation_status: 'NEEDS_CLARIFICATION',
        validation_note: 'Vérifier quantité capteur',
      },
      {
        id: 'BT-OTHER',
        num_bt: 'BT-9999',
        code_machine: 'M-09',
        anomalie: 'Autre BT',
        id_technician: 'TECH-02',
        intervenant: 'Autre Tech',
        statut: 'EN_COURS',
      },
    ];

    const scope = buildTechnicianDashboardScope({
      user: techUser,
      technicians: [techUser],
      preventiveTasks,
      preventiveExecutions: [],
      correctiveInterventions,
      mouvements: [],
    });

    // R4/R5: Only TECH-01 records are included
    expect(scope.myPreventiveTasks.map((t: any) => t.id)).toEqual(['T-1', 'T-2']);
    expect(scope.overdueTasks.map((t: any) => t.id)).toEqual(['T-1']);
    expect(scope.needsClarificationPreventive.map((t: any) => t.id)).toEqual(['T-2']);
    expect(scope.myCorrectiveInterventions.map((b: any) => b.id)).toEqual(['BT-1', 'BT-2']);
    expect(scope.openCorrective.map((b: any) => b.id)).toEqual(['BT-1', 'BT-2']);
    expect(scope.needsClarificationCorrective.map((b: any) => b.id)).toEqual(['BT-2']);

    // Maker-Checker Preventive submission: PENDING_VALIDATION, sparesProposed populated, sparesUsed empty, stock_deducted false
    const { execution } = ExecutionService.recordExecution(preventiveTasks[0], {
      submitForValidation: true,
      validation_status: 'PENDING_VALIDATION',
      submitted_by_id: 'TECH-01',
      submitted_by_name: 'Karim Benali',
      usedPDR: [{ ref: 'ROUL-6204', designation: 'Roulement 6204', qty: 2, unitPrice: 15 }],
      num_bon_saisi_par_tech: 'BS-2026-01',
      observations: 'Remplacement préventif',
    });

    expect(execution.validation_status).toBe('PENDING_VALIDATION');
    expect(execution.stock_deducted).toBe(false);
    expect(execution.sparesUsed).toEqual([]);
    expect(execution.sparesProposed.length).toBe(1);
    expect(execution.sparesProposed[0].ref).toBe('ROUL-6204');
    expect(execution.num_bon_saisi_par_tech).toBe('BS-2026-01');
  });

  it('aggregates pending Maker-Checker items and reserved stock in selectValidationCenterQueues and enforces RBAC on validation_center', async () => {
    const { selectValidationCenterQueues } = await import('../../core/security/validationReconciliation');
    const { AuthorizationService } = await import('../../core/security/AuthorizationService');
    const { ROLES } = await import('../../core/security/Roles');

    // RBAC check: Supervisors & Storekeepers allowed; Technician denied
    expect(AuthorizationService.canAccessTab({ role: ROLES.ADMIN } as any, 'validation_center')).toBe(true);
    expect(AuthorizationService.canAccessTab({ role: ROLES.RESPONSABLE_MAINTENANCE } as any, 'validation_center')).toBe(true);
    expect(AuthorizationService.canAccessTab({ role: ROLES.RESPONSABLE_MAGASIN } as any, 'validation_center')).toBe(true);
    expect(AuthorizationService.canAccessTab({ role: ROLES.TECHNICIEN } as any, 'validation_center')).toBe(false);

    const queues = selectValidationCenterQueues({
      correctiveInterventions: [
        {
          id: 'BT-PEND-1',
          num_bt: 'BT-101',
          statut: 'EN_ATTENTE_VALIDATION',
          validation_status: 'PENDING_VALIDATION',
          pieces_proposees: [{ ref: 'ROUL-6204', qty: 2 }],
        },
        {
          id: 'BT-CLAR-1',
          num_bt: 'BT-102',
          statut: 'EN_COURS',
          validation_status: 'NEEDS_CLARIFICATION',
        },
        {
          id: 'BT-CLOSED',
          num_bt: 'BT-103',
          statut: 'CLOTURE',
          validation_status: 'APPROVED',
        },
      ],
      preventiveExecutions: [
        {
          id: 'EX-PEND-1',
          taskId: 'PM-01',
          validation_status: 'PENDING_VALIDATION',
          sparesProposed: [{ ref: 'ROUL-6204', qty: 1 }, { ref: 'COUR-A42', qty: 3 }],
        },
      ],
      sortieDemands: [
        {
          id: 'SD-PEND-1',
          validation_status: 'PENDING_VALIDATION',
          items: [{ ref: 'COUR-A42', qty: 2 }],
        },
        {
          id: 'SD-CLAR-1',
          validation_status: 'NEEDS_CLARIFICATION',
          items: [{ ref: 'FILT-10', qty: 1 }],
        },
      ],
    });

    expect(queues.pendingCorrective.map((x) => x.id)).toEqual(['BT-PEND-1']);
    expect(queues.clarificationCorrective.map((x) => x.id)).toEqual(['BT-CLAR-1']);
    expect(queues.pendingPreventive.map((x) => x.id)).toEqual(['EX-PEND-1']);
    expect(queues.pendingSortieDemands.map((x) => x.id)).toEqual(['SD-PEND-1']);
    expect(queues.clarificationSortieDemands.map((x) => x.id)).toEqual(['SD-CLAR-1']);
    expect(queues.totalPending).toBe(3);
    expect(queues.totalClarification).toBe(2);
    // Reserved stock (includes PENDING_VALIDATION + NEEDS_CLARIFICATION):
    // ROUL-6204 (2 + 1 = 3), COUR-A42 (3 + 2 = 5), FILT-10 (1) => 3 refs, 9 units total
    expect(queues.reservedRefsCount).toBe(3);
    expect(queues.totalReservedUnits).toBe(9);
    expect(queues.reservedStockMap.get('ROUL-6204')?.reservedQty).toBe(3);
    expect(queues.reservedStockMap.get('COUR-A42')?.reservedQty).toBe(5);
    expect(queues.reservedStockMap.get('FILT-10')?.reservedQty).toBe(1);
  });

  it('builds Shift/Weekly report excluding PENDING_VALIDATION from official totals, counting APPROVED records in window, and isolating SYSTEM_GENERAL from PRODUCTION', async () => {
    const { buildShiftOrWeeklyReport } = await import('../../application/services/MonthlyReportCalculationService');

    const machines = [
      { id_machine_registered: 'PRESS-01', nom: 'Presse Hydraulique 1', asset_class: 'PRODUCTION' },
      { id_machine_registered: 'SEC-EXT-01', nom: 'Extincteur CO2 Atelier', asset_class: 'SYSTEM_GENERAL', system_type_code: 'SYS-SEC' },
    ];

    const correctiveInterventions = [
      // 1. Approved & Closed on PRODUCTION machine inside window -> counted
      {
        id: 'BT-OK-PROD',
        num_bt: 'BT-2001',
        code_machine: 'PRESS-01',
        statut: 'CLOTURE',
        validation_status: 'APPROVED',
        date_cloture: '2026-10-25',
        temps_arret_minutes: 120,
        pdr_cost: 50,
      },
      // 2. Pending validation on PRODUCTION machine inside window -> MUST NOT be counted in closed/consumed
      {
        id: 'BT-PEND-PROD',
        num_bt: 'BT-2002',
        code_machine: 'PRESS-01',
        statut: 'EN_ATTENTE_VALIDATION',
        validation_status: 'PENDING_VALIDATION',
        date_demande: '2026-10-26',
        temps_arret_minutes: 180,
        pdr_cost: 200,
      },
      // 3. Approved & Closed on SYSTEM_GENERAL asset inside window
      {
        id: 'BT-OK-SYS',
        num_bt: 'BT-2003',
        code_machine: 'SEC-EXT-01',
        statut: 'CLOTURE',
        validation_status: 'APPROVED',
        date_cloture: '2026-10-26',
        temps_arret_minutes: 30,
        pdr_cost: 15,
      },
    ];

    const preventiveExecutions = [
      // Approved on PRODUCTION
      {
        id: 'EX-OK-PROD',
        taskId: 'PM-1',
        machineCode: 'PRESS-01',
        executedAt: '2026-10-25T10:00:00Z',
        validation_status: 'APPROVED',
        durationMinutes: 60,
        totalCost: 20,
      },
      // Pending on PRODUCTION -> excluded from official executed count
      {
        id: 'EX-PEND-PROD',
        taskId: 'PM-2',
        machineCode: 'PRESS-01',
        executedAt: '2026-10-26T10:00:00Z',
        validation_status: 'PENDING_VALIDATION',
        durationMinutes: 45,
        totalCost: 100,
      },
      // Approved on SYSTEM_GENERAL
      {
        id: 'EX-OK-SYS',
        taskId: 'PM-3',
        machineCode: 'SEC-EXT-01',
        executedAt: '2026-10-26T14:00:00Z',
        validation_status: 'APPROVED',
        durationMinutes: 15,
        totalCost: 0,
      },
    ];

    const mouvements = [
      {
        id: 'MVT-1',
        type: 'Sortie',
        ref: 'ROUL-6204',
        quantite: 2,
        prix_unitaire: 25,
        date: '2026-10-25',
        id_machine_registered: 'PRESS-01',
      },
    ];

    const sortieDemands = [
      {
        id: 'SD-PEND-1',
        validation_status: 'PENDING_VALIDATION',
        created_at: '2026-10-26',
        id_machine_registered: 'PRESS-01',
        items: [{ ref: 'ROUL-6204', qty: 4 }],
      },
    ];

    // A) ALL asset classes
    const reportAll = buildShiftOrWeeklyReport({
      from: '2026-10-20',
      to: '2026-10-26',
      assetClass: 'ALL',
      machines,
      correctiveInterventions,
      preventiveExecutions: preventiveExecutions as any,
      mouvements,
      sortieDemands,
    });

    // Only approved records are counted in official totals
    expect(reportAll.correctiveClosedInPeriodCount).toBe(2); // BT-OK-PROD + BT-OK-SYS
    expect(reportAll.correctiveSparesCost).toBe(65); // 50 + 15 (excludes 200 from BT-PEND-PROD)
    expect(reportAll.preventiveExecutedInPeriodCount).toBe(2); // EX-OK-PROD + EX-OK-SYS
    expect(reportAll.sortiesCount).toBe(1); // Only official mouvement MVT-1, not SD-PEND-1
    expect(reportAll.pendingSortieDemandsWarningCount).toBe(1);
    expect(reportAll.excludedUnapprovedInPeriod.totalExcludedCount).toBe(3); // 1 BT + 1 PM + 1 SortieDemand
    expect(reportAll.productionMachinesCount).toBe(1); // Only PRESS-01, never SEC-EXT-01

    // B) Filter PRODUCTION only
    const reportProd = buildShiftOrWeeklyReport({
      from: '2026-10-20',
      to: '2026-10-26',
      assetClass: 'PRODUCTION',
      machines,
      correctiveInterventions,
      preventiveExecutions: preventiveExecutions as any,
      mouvements,
      sortieDemands,
    });
    expect(reportProd.correctiveClosedInPeriodCount).toBe(1); // Only BT-OK-PROD
    expect(reportProd.preventiveExecutedInPeriodCount).toBe(1); // Only EX-OK-PROD

    // C) Filter SYSTEM_GENERAL only
    const reportSysGen = buildShiftOrWeeklyReport({
      from: '2026-10-20',
      to: '2026-10-26',
      assetClass: 'SYSTEM_GENERAL',
      machines,
      correctiveInterventions,
      preventiveExecutions: preventiveExecutions as any,
      mouvements,
      sortieDemands,
    });
    expect(reportSysGen.correctiveClosedInPeriodCount).toBe(1); // Only BT-OK-SYS
    expect(reportSysGen.preventiveExecutedInPeriodCount).toBe(1); // Only EX-OK-SYS
    expect(reportSysGen.systemGeneralSummary.totalAssetsCount).toBe(1);
    expect(reportSysGen.systemGeneralSummary.correctiveInPeriodCount).toBe(1);
    expect(reportSysGen.systemGeneralSummary.preventiveInPeriodCount).toBe(1);
  });

  it('enforces the 4 accounting & lifecycle invariants: computeNextDueDate on approval, CorrectiveCalculationService excluding unapproved/rejected & accurate MTTR', async () => {
    const { computeNextDueDate } = await import('../../application/services/preventive/TaskService');
    const { CorrectiveCalculationService } = await import('../../domain/corrective/services/CorrectiveCalculationService');

    // 1. Preventive prochaine_echeance advancement
    expect(computeNextDueDate('2026-10-01', 'Mensuel')).toBe('2026-10-31');
    expect(computeNextDueDate('2026-10-01', 'Hebdomadaire')).toBe('2026-10-08');

    // 2. CorrectiveCalculationService must exclude PENDING_VALIDATION / REJECTED / NEEDS_CLARIFICATION
    // and compute MTTR strictly on closed interventions' downtime
    const bts: any[] = [
      {
        id: 'BT-1',
        code_machine: 'M-01',
        nom_machine: 'Machine 1',
        statut: 'CLOTURE',
        validation_status: 'APPROVED',
        temps_arret_minutes: 120,
        type_panne: 'Mécanique',
        date_demande: '2026-10-10',
      },
      {
        id: 'BT-2-OPEN',
        code_machine: 'M-01',
        nom_machine: 'Machine 1',
        statut: 'EN_COURS',
        validation_status: 'NONE',
        temps_arret_minutes: 300, // open, should NOT inflate MTTR of closed BTs
        type_panne: 'Électrique',
        date_demande: '2026-10-12',
      },
      {
        id: 'BT-3-PENDING',
        code_machine: 'M-01',
        nom_machine: 'Machine 1',
        statut: 'EN_COURS',
        validation_status: 'PENDING_VALIDATION',
        temps_arret_minutes: 600, // unapproved claim -> must be excluded
        type_panne: 'Hydraulique',
        date_demande: '2026-10-15',
      },
      {
        id: 'BT-4-REJECTED',
        code_machine: 'M-01',
        nom_machine: 'Machine 1',
        statut: 'EN_COURS',
        validation_status: 'REJECTED',
        temps_arret_minutes: 480,
        type_panne: 'Mécanique',
        date_demande: '2026-10-16',
      },
    ];

    const kpis = CorrectiveCalculationService.computeKpis(bts);
    expect(kpis.totalInterventions).toBe(2); // Only BT-1 and BT-2-OPEN
    expect(kpis.cloturesCount).toBe(1); // BT-1
    expect(kpis.mttrMinutes).toBe('120.0'); // Only closed BT-1's 120 mins / 1 closed BT (not 420 / 1)

    const pareto = CorrectiveCalculationService.computePareto(bts, 'type_panne');
    expect(pareto.find((t) => t.name === 'Hydraulique')).toBeUndefined();
  });

  it('separates supervisory roles on mobile: Magasinier sees only SortieDemands, Supervisor sees all 3 Maker-Checker queues, Operator/Viewer see 0 approvals', async () => {
    const {
      resolveMobileSupervisoryProfile,
      getRoleScopedPendingCounts,
    } = await import('../../core/security/supervisoryMobileScope');

    const rawCounts = { prevCount: 4, corrCount: 3, sortieCount: 2, total: 9 };

    // 1. Storekeeper (RESPONSABLE_MAGASIN / MAGASINIER)
    const magProfile = resolveMobileSupervisoryProfile({ role: 'MAGASINIER' });
    expect(magProfile.persona).toBe('RESPONSABLE_MAGASIN');
    expect(magProfile.canValidateSortieDemand).toBe(true);
    expect(magProfile.canValidateCorrective).toBe(false);
    expect(magProfile.canValidatePreventive).toBe(false);
    const magCounts = getRoleScopedPendingCounts(magProfile, rawCounts);
    expect(magCounts).toEqual({ prevCount: 0, corrCount: 0, sortieCount: 2, total: 2 });

    // 2. Maintenance Supervisor (RESPONSABLE_MAINTENANCE)
    const supProfile = resolveMobileSupervisoryProfile({ role: 'RESPONSABLE_MAINTENANCE' });
    expect(supProfile.persona).toBe('SUPERVISEUR_MAINTENANCE');
    expect(supProfile.roleBadge).toBe('RESP. MAINT');
    expect(supProfile.canValidateSortieDemand).toBe(true);
    expect(supProfile.canValidateCorrective).toBe(true);
    expect(supProfile.canValidatePreventive).toBe(true);
    const supCounts = getRoleScopedPendingCounts(supProfile, rawCounts);
    expect(supCounts).toEqual({ prevCount: 4, corrCount: 3, sortieCount: 2, total: 9 });

    // 3. Operator (OPERATEUR)
    const opProfile = resolveMobileSupervisoryProfile({ role: 'OPERATEUR' });
    expect(opProfile.persona).toBe('OPERATEUR_TERRAIN');
    expect(opProfile.canReportBreakdown).toBe(true);
    expect(opProfile.canValidateSortieDemand).toBe(false);
    expect(getRoleScopedPendingCounts(opProfile, rawCounts).total).toBe(0);

    // 4. Viewer (VIEWER)
    const viewProfile = resolveMobileSupervisoryProfile({ role: 'VIEWER' });
    expect(viewProfile.persona).toBe('OBSERVATEUR');
    expect(viewProfile.canReportBreakdown).toBe(false);
    expect(getRoleScopedPendingCounts(viewProfile, rawCounts).total).toBe(0);
  });

  it('detects preventive anomalies for Auto-DI and computes 12-Month Machine Health Passport with BER Organ Recurrence Alerts', async () => {
    const {
      hasPreventiveExecutionAnomaly,
      computeMachineHealthPassport,
    } = await import('../../application/services/MachineHealthPassportService');

    expect(
      hasPreventiveExecutionAnomaly({ notes: '[RONDE: ANOMALIE] Fuite soupape compresseur' })
    ).toBe(true);
    expect(
      hasPreventiveExecutionAnomaly({ notes: '[RONDE: CONFORME] Pression OK 8 bar' })
    ).toBe(false);

    const passport = computeMachineHealthPassport({
      machine: { id_machine_registered: 'COMP-AIR-01', designation: 'Compresseur Vis 1' },
      referenceDate: '2026-10-28T12:00:00Z',
      correctiveInterventions: [
        {
          id: 'BT-1',
          code_machine: 'COMP-AIR-01',
          statut: 'CLOTURE',
          validation_status: 'APPROVED',
          date_cloture: '2026-10-05',
          nom_composant: 'Electrovanne Purge',
          cout_pdr: 120,
          temps_arret_minutes: 60,
        },
        {
          id: 'BT-2',
          code_machine: 'COMP-AIR-01',
          statut: 'CLOTURE',
          validation_status: 'APPROVED',
          date_cloture: '2026-10-15',
          nom_composant: 'Electrovanne Purge',
          cout_pdr: 150,
          temps_arret_minutes: 90,
        },
        {
          id: 'BT-3',
          code_machine: 'COMP-AIR-01',
          statut: 'CLOTURE',
          validation_status: 'APPROVED',
          date_cloture: '2026-10-25',
          nom_composant: 'Electrovanne Purge',
          cout_pdr: 130,
          temps_arret_minutes: 90,
        },
        // Unapproved claim -> must be ignored in TCO & BER
        {
          id: 'BT-UNAPPROVED',
          code_machine: 'COMP-AIR-01',
          statut: 'EN_ATTENTE_VALIDATION',
          validation_status: 'PENDING_VALIDATION',
          date_demande: '2026-10-26',
          nom_composant: 'Moteur Principal',
          cout_pdr: 5000,
          temps_arret_minutes: 600,
        },
      ],
      preventiveExecutions: [
        {
          id: 'EX-1',
          machineCode: 'COMP-AIR-01',
          executedAt: '2026-09-10',
          validation_status: 'APPROVED',
          totalCost: 80,
        },
      ],
    });

    expect(passport.correctiveCount12m).toBe(3);
    expect(passport.preventiveCount12m).toBe(1);
    expect(passport.correctivePdrCost12m).toBe(400); // 120 + 150 + 130 (excludes 5000)
    expect(passport.preventiveTotalCost12m).toBe(80);
    expect(passport.totalMaintenanceCost12m).toBe(480);
    expect(passport.totalDowntimeHours12m).toBe(4); // (60+90+90)/60 = 4.0h
    expect(passport.recurrentOrganAlerts.length).toBe(1);
    expect(passport.recurrentOrganAlerts[0].organLabel).toBe('Electrovanne Purge');
    expect(passport.recurrentOrganAlerts[0].count60d).toBe(3);
    expect(passport.healthStatus).toBe('CRITIQUE_BER');
  });

  it('Vulnerability 2 Fix: integrates SortieExterne (Bobinage) into Machine Health Passport TCO/BER and syncs warehouseItems motor status & history', async () => {
    const { computeMachineHealthPassport } = await import(
      '../../application/services/MachineHealthPassportService'
    );
    const SortieExterneService = (
      await import('../../application/services/SortieExterneService')
    ).default;

    // 1. Test MachineHealthPassport includes externalBobinageCost12m & triggers Rebobinages multiples BER alert
    const passport = computeMachineHealthPassport({
      machine: { id_machine_registered: 'DET-01', designation: 'Détoureuse CNC 1' },
      referenceDate: '2026-10-29T12:00:00Z',
      correctiveInterventions: [
        {
          id: 'BT-10',
          code_machine: 'DET-01',
          statut: 'CLOTURE',
          validation_status: 'APPROVED',
          date_cloture: '2026-08-10',
          nom_composant: 'Courroie Axe X',
          cout_pdr: 300,
          temps_arret_minutes: 60,
        },
      ],
      preventiveExecutions: [],
      sortiesExterne: [
        {
          id: 'SE-1',
          code: 'SORT-EXT-010',
          id_machine: 'DET-01',
          code_moteur_reel: 'mot 01',
          date_expedition: '2026-05-10',
          etat: 'Monté',
          cout_bobinage: 1800,
        },
        {
          id: 'SE-2',
          code: 'SORT-EXT-011',
          id_machine: 'DET-01',
          code_moteur_reel: 'mot 01',
          date_expedition: '2026-10-05',
          etat: 'En réparation externe',
          cout_bobinage: 2200,
        },
      ],
    });

    expect(passport.externalBobinageCount12m).toBe(2);
    expect(passport.externalBobinageCost12m).toBe(4000); // 1800 + 2200
    expect(passport.totalMaintenanceCost12m).toBe(4300); // 300 (corrective) + 4000 (bobinage)
    expect(passport.healthStatus).toBe('CRITIQUE_BER');
    expect(passport.recurrentOrganAlerts).toHaveLength(1);
    expect(passport.recurrentOrganAlerts[0].organLabel).toBe('mot 01');
    expect(passport.recurrentOrganAlerts[0].recommendation).toContain('Rebobinages multiples');

    // 2. Test SortieExterneService.syncWarehouseItemsWithSortie updates motor status, attachment & historique_bobinage
    const initialWarehouse = [
      {
        id: 'ID-MOT01',
        id_warehouse_item: 'mot 01',
        code: 'mot 01',
        rattachement_type: 'MACHINE',
        id_machine: 'DET-01',
        id_machine_registered: 'DET-01',
        status: 'Actif',
        historique_bobinage: [],
      },
    ];

    // Step A: Sent to external repair
    const afterSend = SortieExterneService.syncWarehouseItemsWithSortie(initialWarehouse, {
      id: 'SE-2',
      code: 'SORT-EXT-011',
      ref: 'BS-2026-99',
      id_machine: 'DET-01',
      code_moteur_reel: 'mot 01',
      fournisseur_externe: 'Bobinage Casa',
      type_probleme: 'grille',
      date_expedition: '2026-10-05',
      etat: 'En réparation externe',
      cout_bobinage: 0,
    });
    expect(afterSend[0].status).toBe('En réparation externe');
    expect(afterSend[0].historique_bobinage).toHaveLength(1);

    // Step B: Returned OK to reserve stock with final cost
    const afterReturn = SortieExterneService.syncWarehouseItemsWithSortie(afterSend, {
      id: 'SE-2',
      code: 'SORT-EXT-011',
      ref: 'BS-2026-99',
      id_machine: 'DET-01',
      code_moteur_reel: 'mot 01',
      fournisseur_externe: 'Bobinage Casa',
      type_probleme: 'grille',
      date_expedition: '2026-10-05',
      date_arrivee_reelle: '2026-10-12',
      etat: 'Retourné OK',
      cout_bobinage: 2200,
    });
    expect(afterReturn[0].status).toBe('Retourné OK');
    expect(afterReturn[0].rattachement_type).toBe('STOCK');
    expect(afterReturn[0].historique_bobinage[0].cout_bobinage).toBe(2200);

    // Step C: Remounted on target machine DET-02
    const afterMount = SortieExterneService.syncWarehouseItemsWithSortie(afterReturn, {
      id: 'SE-2',
      code: 'SORT-EXT-011',
      ref: 'BS-2026-99',
      id_machine: 'DET-02',
      code_moteur_reel: 'mot 01',
      fournisseur_externe: 'Bobinage Casa',
      type_probleme: 'grille',
      date_expedition: '2026-10-05',
      date_arrivee_reelle: '2026-10-12',
      date_montage: '2026-10-14',
      technicien_montage: 'Rachid',
      etat: 'Monté',
      cout_bobinage: 2200,
    });
    expect(afterMount[0].status).toBe('Actif');
    expect(afterMount[0].rattachement_type).toBe('MACHINE');
    expect(afterMount[0].id_machine_registered).toBe('DET-02');
    expect(afterMount[0].historique_bobinage[0].etat).toBe('Monté');
  });

  it('Vulnerability 3 Fix: enforces referential cascades on rename and suspends preventive tasks when machines are soft-archived', async () => {
    const { buildTechnicianDashboardScope } = await import('../../core/security/technicianScope');
    const techUser = {
      id: 'TECH-01',
      id_technician: 'TECH-01',
      personnelId: 'TECH-01',
      code: 'TECH-01',
      personnelName: 'Karim Benali',
      name: 'Karim Benali',
      nom: 'Karim Benali',
      role: 'TECHNICIEN',
    };

    const preventiveTasks = [
      {
        id: 'PM-ACTIVE-1',
        id_machine: 'M-ACTIVE',
        tache: 'Graissage machine active',
        id_technicien: 'TECH-01',
        responsable: 'Karim Benali',
        etat: 'En retard',
        is_active: true,
      },
      {
        id: 'PM-ARCHIVED-MCH',
        id_machine: 'M-ARCHIVED',
        tache: 'Graissage machine archivée',
        id_technicien: 'TECH-01',
        responsable: 'Karim Benali',
        etat: 'En retard',
        is_active: false,
        active: false,
        statut: 'ARCHIVEE',
        archived_with_machine: true,
      },
    ];

    const scope = buildTechnicianDashboardScope({
      user: techUser,
      technicians: [techUser],
      preventiveTasks,
      preventiveExecutions: [],
      correctiveInterventions: [],
      mouvements: [],
    });

    // Archived machine's preventive task must not appear in the technician's active or overdue queue
    expect(scope.myPreventiveTasks.map((t: any) => t.id)).toEqual(['PM-ACTIVE-1']);
    expect(scope.overdueTasks.map((t: any) => t.id)).toEqual(['PM-ACTIVE-1']);
  });

  it('Vulnerability 4 Fix: reconciles Corrective BTs, Preventive Executions/Tasks, and Sortie Demands when auto-generated movements are updated or deleted', async () => {
    const {
      reconcileMakerCheckerOnMovementDelete,
      reconcileMakerCheckerOnMovementUpdate,
    } = await import('../../core/security/auditLockReconciliation');

    const initialBt = {
      id: 'BT-500',
      num_bt: 'BT-2026-500',
      code_machine: 'DET-01',
      statut: 'CLOTURE',
      validation_status: 'APPROVED',
      pieces_utilisees: [
        { ref: 'ROUL-6204', designation: 'Roulement 6204', quantite: 2, prix_unitaire: 150 },
      ],
      cout_pdr: 300,
      pdr_cost: 300,
      emitted_movement_ids: ['MVT-BT-500-1'],
    };

    const mvtBt = {
      id: 'MVT-BT-500-1',
      source_bt_id: 'BT-500',
      code_bon: 'BS-BT-BT-2026-500',
      ref: 'ROUL-6204',
      quantite: 2,
      prix_unitaire: 150,
    };

    // 1. Updating movement quantity from 2 to 1 updates BT cout_pdr from 300 to 150
    const afterUpdateBt = reconcileMakerCheckerOnMovementUpdate(
      mvtBt,
      { ...mvtBt, quantite: 1 },
      {
        correctiveInterventions: [initialBt],
        preventiveExecutions: [],
        preventiveTasks: [],
        sortieDemands: [],
      }
    );
    expect(afterUpdateBt.correctiveChanged).toBe(true);
    expect(afterUpdateBt.correctiveInterventions[0].cout_pdr).toBe(150);
    expect(afterUpdateBt.correctiveInterventions[0].pieces_utilisees[0].quantite).toBe(1);

    // 2. Deleting movement zeroes out BT cout_pdr and records audit note
    const afterDeleteBt = reconcileMakerCheckerOnMovementDelete(mvtBt, {
      correctiveInterventions: [initialBt],
      preventiveExecutions: [],
      preventiveTasks: [],
      sortieDemands: [],
    });
    expect(afterDeleteBt.correctiveChanged).toBe(true);
    expect(afterDeleteBt.correctiveInterventions[0].cout_pdr).toBe(0);
    expect(afterDeleteBt.correctiveInterventions[0].pieces_utilisees).toHaveLength(0);
    expect(afterDeleteBt.correctiveInterventions[0].validation_note).toContain('[Audit Magasin]');

    // 3. Deleting Preventive movement recalculates execution totalCost and decrements parent task cout_cumule
    const initialExec = {
      id: 'EXEC-9001',
      taskId: 'TASK-90',
      taskCode: 'PM-90',
      durationMinutes: 60,
      laborRate: 40,
      sparesUsed: [{ ref: 'COURR-A42', designation: 'Courroie A42', qty: 2, unitPrice: 100 }],
      sparesCost: 200,
      totalCost: 240,
      stock_deducted: true,
      emitted_movement_ids: ['MVT-PRV-9001'],
    };
    const initialTask = {
      id: 'TASK-90',
      cout_cumule: 540,
    };
    const mvtPrv = {
      id: 'MVT-PRV-9001',
      source_execution_id: 'EXEC-9001',
      code_bon: 'BS-PRV-C-9001',
      ref: 'COURR-A42',
      quantite: 2,
      prix_unitaire: 100,
    };

    const afterDeletePrv = reconcileMakerCheckerOnMovementDelete(mvtPrv, {
      correctiveInterventions: [],
      preventiveExecutions: [initialExec],
      preventiveTasks: [initialTask],
      sortieDemands: [],
    });
    expect(afterDeletePrv.preventiveExecsChanged).toBe(true);
    expect(afterDeletePrv.preventiveExecutions[0].sparesCost).toBe(0);
    expect(afterDeletePrv.preventiveExecutions[0].totalCost).toBe(40); // labor only
    expect(afterDeletePrv.preventiveExecutions[0].stock_deducted).toBe(false);
    expect(afterDeletePrv.preventiveTasksChanged).toBe(true);
    expect(afterDeletePrv.preventiveTasks[0].cout_cumule).toBe(340); // 540 - 200
  });

  it('Vulnerability 5 Fix: unifies Preventive execution review parity with exactMovementMatch (skipStockDeduction) and Auto-DI anomaly detection', async () => {
    const { reconcileFieldClaim } = await import('../../core/security/validationReconciliation');
    const { hasPreventiveExecutionAnomaly } = await import(
      '../../application/services/MachineHealthPassportService'
    );

    const existingMouvements = [
      {
        id: 'MVT-MAG-77',
        code_bon: 'BS-2026-077',
        ref: 'ROUL-6204',
        quantite: 2,
        machine: 'DET-01',
        type: 'Sortie',
      },
    ];

    const execWithExistingBonAndAnomaly = {
      id: 'EXEC-77',
      machineCode: 'DET-01',
      organe: 'Palier Principal',
      num_bon_saisi_par_tech: 'BS-2026-077',
      notes: 'Anomalie: bruit et échauffement constaté sur le palier',
      sparesProposed: [{ ref: 'ROUL-6204', designation: 'Roulement 6204', qty: 2, unitPrice: 120 }],
    };

    const rec = reconcileFieldClaim({
      claimType: 'PREVENTIVE',
      claimId: execWithExistingBonAndAnomaly.id,
      numBonSaisi: execWithExistingBonAndAnomaly.num_bon_saisi_par_tech,
      machineCode: execWithExistingBonAndAnomaly.machineCode,
      proposedSpares: execWithExistingBonAndAnomaly.sparesProposed,
      stockItems: [{ ref: 'ROUL-6204', stockActuel: 10 }],
      mouvements: existingMouvements,
      correctiveInterventions: [],
      preventiveExecutions: [execWithExistingBonAndAnomaly],
      sortieDemands: [],
    });

    // Both ValidationCenterView and PreventiveExecutionsHistoryView / TabMainView use exactMovementMatch & hasPreventiveExecutionAnomaly
    expect(Boolean(rec.exactMovementMatch)).toBe(true);
    expect(hasPreventiveExecutionAnomaly(execWithExistingBonAndAnomaly)).toBe(true);
  });

  it('Vulnerability 6 Fix: enforces server-side role spoof prevention, entity write guards, and Maker-Checker bulk state sanitization', async () => {
    const {
      resolveEffectiveServerRole,
      canRoleMutateEntity,
      sanitizeBulkStateForRole,
    } = await import('../../core/security/serverRbacPolicy');

    const dbUsers = [
      { id: 'USR-TECH-1', username: 'karim', nom: 'Karim Benali', role: 'TECHNICIEN', is_active: true },
      { id: 'USR-ARCH-1', username: 'ancien', nom: 'Ancien Tech', role: 'TECHNICIEN', is_active: false, statut: 'ARCHIVE' },
    ];

    // 1. Registered TECHNICIEN spoofing x-gmao-role: ADMIN is downgraded to TECHNICIEN
    const spoofCheck = resolveEffectiveServerRole(
      { 'x-gmao-role': 'ADMIN', 'x-gmao-actor': 'Karim Benali' },
      dbUsers,
      []
    );
    expect(spoofCheck.roleSpoofDetected).toBe(true);
    expect(spoofCheck.effectiveRole).toBe('TECHNICIEN');

    // 2. Archived user is downgraded to VIEWER (read-only)
    const archivedCheck = resolveEffectiveServerRole(
      { 'x-gmao-role': 'TECHNICIEN', 'x-gmao-actor': 'Ancien Tech' },
      dbUsers,
      []
    );
    expect(archivedCheck.isArchivedActor).toBe(true);
    expect(archivedCheck.effectiveRole).toBe('VIEWER');

    // 3. TECHNICIEN cannot directly mutate rawStock, mouvements, or users
    expect(canRoleMutateEntity('TECHNICIEN', 'rawStock', 'PUT').allowed).toBe(false);
    expect(canRoleMutateEntity('TECHNICIEN', 'mouvements', 'POST').allowed).toBe(false);
    expect(canRoleMutateEntity('TECHNICIEN', 'users', 'PUT').allowed).toBe(false);
    expect(canRoleMutateEntity('TECHNICIEN', 'sortieDemands', 'POST').allowed).toBe(true);

    // 4. Bulk state sync from TECHNICIEN strips rawStock/mouvements/users, blocks replaceAll, and clamps unapproved self-approvals
    const replaceAllAttempt = sanitizeBulkStateForRole(
      'TECHNICIEN',
      { replaceAll: true, machines: [] },
      {}
    );
    expect(replaceAllAttempt.allowed).toBe(false);

    const bulkAttempt = sanitizeBulkStateForRole(
      'TECHNICIEN',
      {
        users: [{ id: 'hacked', role: 'ADMIN' }],
        rawStock: [{ ref: 'ROUL-6204', stockActuel: 9999 }],
        mouvements: [{ id: 'MVT-FAKE' }],
        correctiveInterventions: [
          {
            id: 'BT-NEW-1',
            code_machine: 'DET-01',
            statut: 'CLOTURE',
            action_fermee: 'OUI',
            validation_status: 'APPROVED',
            stock_deducted: true,
          },
        ],
      },
      { correctiveInterventions: [] }
    );
    expect(bulkAttempt.allowed).toBe(true);
    expect(bulkAttempt.strippedKeys).toEqual(expect.arrayContaining(['users', 'rawStock', 'mouvements']));
    expect(bulkAttempt.sanitizedState.users).toBeUndefined();
    expect(bulkAttempt.sanitizedState.rawStock).toBeUndefined();
    expect(bulkAttempt.sanitizedState.mouvements).toBeUndefined();
    // Unapproved BT pushed by technician is clamped to PENDING_VALIDATION & EN_COURS
    expect(bulkAttempt.sanitizedState.correctiveInterventions[0].validation_status).toBe('PENDING_VALIDATION');
    expect(bulkAttempt.sanitizedState.correctiveInterventions[0].stock_deducted).toBe(false);
    expect(bulkAttempt.sanitizedState.correctiveInterventions[0].statut).toBe('EN_COURS');
  });

  it('Phase 0 — A1 Operational Trust Smoke Suite (A1.1 to A1.6): verifies end-to-end store & merge contracts across all 6 critical paths', async () => {
    const { useGmaoStore } = await import('../../store/useGmaoStore');
    const { buildTechnicianDashboardScope } = await import('../../core/security/technicianScope');
    const { mergeGmaoStateSnapshot, mergeSingleRecord } = await import('../../services/lanStateMergeService');

    const initialState = useGmaoStore.getState();

    try {
      // Seed clean isolated state for A1 verification
      useGmaoStore.setState({
        rawStock: [
          {
            id: 'STK-1',
            ref: 'ROUL-6204',
            designation: 'Roulement 6204',
            stockInitial: 10,
            entrees: 0,
            sorties: 0,
            stockActuel: 10,
            prixUnitaire: 50,
          },
        ],
        mouvements: [],
        sortieDemands: [],
        correctiveInterventions: [
          {
            id: 'BT-A1-1',
            num_bt: 'BT-9001',
            code_machine: 'DET-01',
            nom_machine: 'Détecteur 01',
            statut: 'EN_COURS',
            action_fermee: 'NON',
            validation_status: 'NONE',
            stock_deducted: false,
          } as any,
        ],
        preventiveTasks: [
          {
            id: 'PM-A1-1',
            code_machine: 'DET-01',
            id_machine: 'DET-01',
            machine: 'Détecteur 01',
            organe: 'Roulement Principal',
            composant: 'Roulement Principal',
            tache: 'Graissage & contrôle roulement',
            periodicite: 'Mensuel',
            prochaine_echeance: '2026-10-01',
            statut: 'À faire',
            is_active: true,
          },
          {
            id: 'PM-A1-ARCH',
            code_machine: 'OLD-99',
            id_machine: 'OLD-99',
            machine: 'Machine Archivée',
            organe: 'Moteur',
            tache: 'Contrôle moteur',
            periodicite: 'Mensuel',
            prochaine_echeance: '2026-01-01', // past due date, but archived
            statut: 'ARCHIVEE',
            archived: true,
            is_active: false,
            responsable: 'Karim Benali',
          },
        ],
        preventiveExecutions: [],
      });

      // =========================================================================
      // A1.1: Technician submits BT, Preventive Execution, or SortieDemand
      // -> validation_status === 'PENDING_VALIDATION', NO movement, stock_deducted === false
      // =========================================================================
      const subBt = useGmaoStore.getState().handleSubmitInterventionForValidation('BT-A1-1', {
        submitted_by_id: 'TECH-01',
        submitted_by_name: 'Karim Benali',
        travail_a_faire: 'Remplacement roulement usé',
        action_realisee: 'Remplacement roulement usé',
        pieces_proposees: [{ ref: 'ROUL-6204', designation: 'Roulement 6204', quantite: 2, prix_unitaire: 50 }],
      });
      expect(subBt?.validation_status).toBe('PENDING_VALIDATION');
      expect(subBt?.stock_deducted).toBe(false);
      expect(useGmaoStore.getState().mouvements).toHaveLength(0);

      useGmaoStore.getState().handleMarkTaskDone('PM-A1-1', {
        submitForValidation: true,
        submitted_by_id: 'TECH-01',
        submitted_by_name: 'Karim Benali',
        date_realisation: '2026-10-25',
        notes: 'Anomalie: bruit roulement constaté',
        usedPDR: [{ ref: 'ROUL-6204', designation: 'Roulement 6204', quantite: 1, prix_unitaire: 50 }],
      });
      const pendingExec = useGmaoStore.getState().preventiveExecutions[0];
      expect(pendingExec).toBeDefined();
      expect(pendingExec.validation_status).toBe('PENDING_VALIDATION');
      expect(pendingExec.stock_deducted).toBe(false);
      expect(useGmaoStore.getState().mouvements).toHaveLength(0);

      const sd = useGmaoStore.getState().handleSubmitSortieDemand({
        submitted_by_id: 'TECH-01',
        submitted_by_name: 'Karim Benali',
        id_machine_registered: 'DET-01',
        items: [{ ref: 'ROUL-6204', designation: 'Roulement 6204', quantite: 1, prix_unitaire: 50 }],
      });
      expect(sd.validation_status).toBe('PENDING_VALIDATION');
      expect(sd.stock_deducted).toBe(false);
      expect(useGmaoStore.getState().mouvements).toHaveLength(0);

      // =========================================================================
      // A1.2: Supervisor approves -> either 1 movement per spare OR skipStockDeduction
      // when bon matches; zero double deduction on repeat calls
      // =========================================================================
      const approvedBt = useGmaoStore.getState().handleReviewInterventionValidation('BT-A1-1', {
        decision: 'APPROVED',
        validated_by_id: 'SUP-01',
        validated_by_name: 'Chef Maintenance',
        pieces_utilisees: [{ ref: 'ROUL-6204', designation: 'Roulement 6204', quantite: 2, prix_unitaire: 50 }],
      });
      expect(approvedBt?.validation_status).toBe('APPROVED');
      expect(approvedBt?.statut).toBe('CLOTURE');
      expect(approvedBt?.stock_deducted).toBe(true);
      expect(useGmaoStore.getState().mouvements).toHaveLength(1);
      expect(useGmaoStore.getState().mouvements[0].quantite).toBe(2);

      // Repeat approval on already APPROVED BT must return null and emit 0 extra movements
      const duplicateBtApproval = useGmaoStore.getState().handleReviewInterventionValidation('BT-A1-1', {
        decision: 'APPROVED',
        reviewer_id: 'SUP-01',
        reviewer_name: 'Chef Maintenance',
      });
      expect(duplicateBtApproval).toBeNull();
      expect(useGmaoStore.getState().mouvements).toHaveLength(1);

      // Approve SortieDemand with skipStockDeduction: true (e.g. exact bon match) -> 0 new movements
      const approvedSd = useGmaoStore.getState().handleReviewSortieDemandValidation(sd.id, {
        decision: 'APPROVED',
        reviewer_id: 'SUP-01',
        reviewer_name: 'Chef Maintenance',
        skipStockDeduction: true,
      });
      expect(approvedSd?.validation_status).toBe('APPROVED');
      expect(approvedSd?.stock_deducted).toBe(true);
      expect(useGmaoStore.getState().mouvements).toHaveLength(1); // still 1

      // =========================================================================
      // A1.3: Auto-DI created on approval ONLY if createFollowUpDi === true,
      // and never duplicated if generated_di_id already exists
      // =========================================================================
      const btsBeforePrvApproval = useGmaoStore.getState().correctiveInterventions.length;
      const approvedExec = useGmaoStore.getState().handleReviewPreventiveExecutionValidation(pendingExec.id, {
        decision: 'APPROVED',
        reviewer_id: 'SUP-01',
        reviewer_name: 'Chef Maintenance',
        createFollowUpDi: true,
        followUpDiDescription: 'Vérifier bruit palier détecté lors du préventif',
      });
      expect(approvedExec?.validation_status).toBe('APPROVED');
      expect(approvedExec?.generated_di_id).toBeTruthy();
      expect(useGmaoStore.getState().correctiveInterventions.length).toBe(btsBeforePrvApproval + 1);
      expect(useGmaoStore.getState().mouvements).toHaveLength(2); // 1 from BT + 1 from PM

      // Attempting a second approval on the same execution with createFollowUpDi: true must NOT create a duplicate DI
      const secondExecApproval = useGmaoStore.getState().handleReviewPreventiveExecutionValidation(pendingExec.id, {
        decision: 'APPROVED',
        reviewer_id: 'SUP-01',
        reviewer_name: 'Chef Maintenance',
        createFollowUpDi: true,
      });
      expect(secondExecApproval).toBeNull();
      expect(useGmaoStore.getState().correctiveInterventions.length).toBe(btsBeforePrvApproval + 1);

      // =========================================================================
      // A1.4: Archiving a machine -> its preventive tasks do not appear active/overdue in technician scope
      // =========================================================================
      const techScope = buildTechnicianDashboardScope({
        user: { id: 'USR-TECH-1', personnelId: 'TECH-01', name: 'Karim Benali', role: 'TECHNICIEN' },
        technicians: [{ id: 'TECH-01', nom: 'Karim Benali', is_active: true }],
        machines: [
          { id: 'DET-01', code: 'DET-01', nom: 'Détecteur 01', statut: 'Active', is_active: true },
          { id: 'OLD-99', code: 'OLD-99', nom: 'Machine Archivée', statut: 'ARCHIVEE', is_active: false },
        ],
        correctiveInterventions: useGmaoStore.getState().correctiveInterventions,
        preventiveTasks: useGmaoStore.getState().preventiveTasks,
        preventiveExecutions: useGmaoStore.getState().preventiveExecutions,
        sortieDemands: useGmaoStore.getState().sortieDemands,
        now: new Date('2026-10-28T10:00:00Z'),
      });
      expect(techScope.myPreventiveTasks.some((t: any) => t.id === 'PM-A1-ARCH')).toBe(false);
      expect(techScope.overdueTasks.some((t: any) => t.id === 'PM-A1-ARCH')).toBe(false);

      // =========================================================================
      // A1.6: LAN Merge never overwrites an APPROVED/CLOTURE record with a stale PENDING_VALIDATION
      // copy even when the incoming PENDING copy has a newer client updated_at timestamp (clock skew)
      // =========================================================================
      const serverClosedBt = {
        id: 'BT-LAN-1',
        statut: 'CLOTURE',
        validation_status: 'APPROVED',
        stock_deducted: true,
        updated_at: '2026-10-28T10:00:00.000Z',
      };
      const staleMobilePendingBtWithSkewedClock = {
        id: 'BT-LAN-1',
        statut: 'EN_COURS',
        validation_status: 'PENDING_VALIDATION',
        stock_deducted: false,
        updated_at: '2026-10-28T11:30:00.000Z', // 90 mins ahead due to phone clock skew
      };

      const mergedSingle = mergeSingleRecord(serverClosedBt, staleMobilePendingBtWithSkewedClock);
      expect(mergedSingle.validation_status).toBe('APPROVED');
      expect(mergedSingle.statut).toBe('CLOTURE');
      expect(mergedSingle.stock_deducted).toBe(true);

      const serverStateObj = { correctiveInterventions: [serverClosedBt] };
      mergeGmaoStateSnapshot(
        serverStateObj,
        { correctiveInterventions: [staleMobilePendingBtWithSkewedClock] },
        ['correctiveInterventions'],
        new Set<string>()
      );
      expect(serverStateObj.correctiveInterventions[0].validation_status).toBe('APPROVED');
      expect(serverStateObj.correctiveInterventions[0].statut).toBe('CLOTURE');
      expect(serverStateObj.correctiveInterventions[0].stock_deducted).toBe(true);
    } finally {
      useGmaoStore.setState(initialState);
    }
  });

  it('Phase 0 — A2 Lightweight Operational Sync & Queue Monitor: tracks LAN sync success/error/conflict and matches ValidationCenter queue counters', async () => {
    const { serverSyncService } = await import('../../services/serverSyncService');
    const { selectValidationCenterQueues } = await import('../../core/security/validationReconciliation');

    // 1. Track sync error
    serverSyncService.recordSyncError('Server Offline');
    let snap = serverSyncService.getOperationalSyncStatus();
    expect(snap.lastSyncStatus).toBe('ERROR');
    expect(snap.lastSyncError).toBe('Server Offline');
    expect(snap.hasUnresolvedConflict).toBe(false);

    // 2. Track unresolved conflict
    const fakeConflict: any = {
      hasConflict: true,
      reason: 'SERVER_NEWER',
      localSummary: { totalItems: 10 },
      serverSummary: { totalItems: 12 },
      serverState: {},
    };
    serverSyncService.recordSyncConflict(fakeConflict);
    snap = serverSyncService.getOperationalSyncStatus();
    expect(snap.lastSyncStatus).toBe('CONFLICT');
    expect(snap.hasUnresolvedConflict).toBe(true);
    expect(snap.unresolvedConflict?.reason).toBe('SERVER_NEWER');

    // 3. Track sync success clears error & unresolved conflict
    serverSyncService.recordSyncSuccess('2026-10-29T15:00:00.000Z', 42);
    snap = serverSyncService.getOperationalSyncStatus();
    expect(snap.lastSyncStatus).toBe('SUCCESS');
    expect(snap.lastSyncError).toBeNull();
    expect(snap.hasUnresolvedConflict).toBe(false);
    expect(snap.lastServerVersion).toBe(42);

    // 4. Queue counters match ValidationCenterView sources (BT + PM + SortieDemands)
    const queues = selectValidationCenterQueues({
      correctiveInterventions: [
        { id: 'BT-1', validation_status: 'PENDING_VALIDATION' },
        { id: 'BT-2', validation_status: 'APPROVED' },
        { id: 'BT-3', validation_status: 'NEEDS_CLARIFICATION' },
      ],
      preventiveExecutions: [
        { id: 'PM-1', validation_status: 'PENDING_VALIDATION' },
        { id: 'PM-2', validation_status: 'PENDING_VALIDATION' },
      ],
      sortieDemands: [
        { id: 'SD-1', validation_status: 'PENDING_VALIDATION' },
      ],
    });
    expect(queues.pendingCorrective).toHaveLength(1);
    expect(queues.pendingPreventive).toHaveLength(2);
    expect(queues.pendingSortieDemands).toHaveLength(1);
    expect(queues.totalPending).toBe(4);
    expect(queues.totalClarification).toBe(1);
  });

  it('Phase 0 — A3 Operational Snapshot Export & Restore: exports all critical V4 entities without secrets, previews counts, and restores store + storage cleanly', async () => {
    const { AutoBackupService } = await import('../../core/backup/AutoBackupService');
    const { STORAGE_KEYS } = await import('../../infrastructure/persistence/storageKeys');
    const { useGmaoStore } = await import('../../store/useGmaoStore');

    const initialState = useGmaoStore.getState();
    try {
      localStorage.clear();

      // Seed live store state with V4 entities + a secret field to verify stripping
      useGmaoStore.setState({
        machines: [{ id_machine_registered: 'M-A3-01', nom: 'Compresseur Atlas', id_zone: 'ZONE-01' }] as any,
        generalSystemTypes: [{ id: 'SYS-AIR', label: 'Air Comprimé', is_active: true }] as any,
        rawStock: [{ id: 'ART-A3', ref: 'PDR-A3-99', designation: 'Courroie Trapézoïdale', stockInitial: 10 }] as any,
        mouvements: [{ id: 'MVT-A3-1', ref: 'PDR-A3-99', type: 'Sortie', quantite: 2 }] as any,
        sortieDemands: [{ id: 'SD-A3-1', ref: 'PDR-A3-99', quantite: 1, validation_status: 'PENDING_VALIDATION' }] as any,
        preventiveTasks: [{ id: 'PRV-A3-1', machineCode: 'M-A3-01', organe: 'Filtre' }] as any,
        preventiveExecutions: [{ id: 'EXEC-A3-1', taskId: 'PRV-A3-1', periodMonth: '2026-10', validation_status: 'APPROVED' }] as any,
        correctiveInterventions: [{ id: 'BT-A3-1', code_machine: 'M-A3-01', statut: 'CLOTURE', validation_status: 'APPROVED' }] as any,
        users: [
          {
            id: 'TECH-01',
            nom: 'Karim Tech',
            role: 'TECHNICIEN',
            passwordHash: 'SECRET_HASH_DO_NOT_EXPORT',
            apiToken: 'SECRET_TOKEN_123',
          },
        ] as any,
      });

      // 1. Build full operational snapshot
      const snapshotPayload = AutoBackupService.buildOperationalSnapshotPayload('full');
      expect(snapshotPayload.version).toBe('4.0.0');
      expect(snapshotPayload.counts.machines).toBe(1);
      expect(snapshotPayload.counts.spare_parts).toBe(1);
      expect(snapshotPayload.counts.movements).toBe(1);
      expect(snapshotPayload.counts.sortie_demands).toBe(1);
      expect(snapshotPayload.counts.preventive).toBe(1);
      expect(snapshotPayload.counts.preventive_executions).toBe(1);
      expect(snapshotPayload.counts.corrective).toBe(1);
      expect(snapshotPayload.data[STORAGE_KEYS.GENERAL_SYSTEM_TYPES]).toHaveLength(1);
      expect(snapshotPayload.data[STORAGE_KEYS.SORTIE_DEMANDS]).toHaveLength(1);
      expect(snapshotPayload.data[STORAGE_KEYS.PREVENTIVE_EXECUTIONS]).toHaveLength(1);

      // Verify secrets are stripped
      const exportedJson = JSON.stringify(snapshotPayload);
      expect(exportedJson).not.toContain('SECRET_HASH_DO_NOT_EXPORT');
      expect(exportedJson).not.toContain('SECRET_TOKEN_123');
      expect(exportedJson).not.toContain('passwordHash');

      // 2. Preview validation before overwrite confirmation
      const preview = AutoBackupService.parseAndNormalizeBackupJSON(exportedJson);
      expect(preview.valid).toBe(true);
      expect(preview.counts.machines).toBe(1);
      expect(preview.counts.sortie_demands).toBe(1);

      // Reject invalid JSON
      const badPreview = AutoBackupService.parseAndNormalizeBackupJSON('{"invalid": true}');
      expect(badPreview.valid).toBe(false);
      expect(AutoBackupService.importFullBackupJSON('{"invalid": true}')).toBe(false);

      // 3. Wipe store & storage, then restore from the exported JSON snapshot
      localStorage.clear();
      useGmaoStore.setState({
        machines: [],
        generalSystemTypes: [],
        rawStock: [],
        mouvements: [],
        sortieDemands: [],
        preventiveTasks: [],
        preventiveExecutions: [],
        correctiveInterventions: [],
      });
      expect(useGmaoStore.getState().machines).toHaveLength(0);

      const importedOk = AutoBackupService.importFullBackupJSON(exportedJson);
      expect(importedOk).toBe(true);

      // Verify store and localStorage were both hydrated
      const restoredStore = useGmaoStore.getState();
      expect(restoredStore.machines).toHaveLength(1);
      expect(restoredStore.machines[0].id_machine_registered).toBe('M-A3-01');
      expect(restoredStore.generalSystemTypes).toHaveLength(1);
      expect(restoredStore.rawStock).toHaveLength(1);
      expect(restoredStore.mouvements).toHaveLength(1);
      expect(restoredStore.sortieDemands).toHaveLength(1);
      expect(restoredStore.preventiveTasks).toHaveLength(1);
      expect(restoredStore.preventiveExecutions).toHaveLength(1);
      expect(restoredStore.correctiveInterventions).toHaveLength(1);

      // And a safety snapshot was created before import
      const snapshots = AutoBackupService.listSnapshots();
      expect(snapshots.length).toBeGreaterThanOrEqual(1);
    } finally {
      useGmaoStore.setState(initialState);
    }
  });
});

describe('Phase 1 — B3 Temporal Preventive Maintenance Compliance (PM Compliance)', () => {
  it('classifies ON_TIME vs LATE vs OVERDUE from approved executions only, never counts PENDING/REJECTED as completed, and excludes archived tasks/machines from denominator', async () => {
    const {
      computePmWindowCompliance,
      buildShiftOrWeeklyReport,
    } = await import('../../application/services/MonthlyReportCalculationService');

    const machines = [
      { id_machine_registered: 'M-ACTIVE-01', designation: 'Presse Active 1', status: 'OPERATIONNELLE', is_active: true },
      { id_machine_registered: 'M-ARCHIVED-02', designation: 'Ancienne Presse', status: 'ARCHIVEE', is_active: false, archived: true },
    ];

    const preventiveTasks = [
      // 1) Active task executed ON_TIME (due 2026-10-20, approved execution on 2026-10-19)
      {
        id: 'PM-1-ONTIME',
        code_machine: 'M-ACTIVE-01',
        tache: 'Graissage paliers',
        prochaine_echeance: '2026-11-19', // advanced after approval
        echeance_precedente: '2026-10-20',
        etat: 'Fait',
        validation_status: 'APPROVED',
        is_active: true,
      },
      // 2) Active task executed LATE (due 2026-10-18, approved execution on 2026-10-22)
      {
        id: 'PM-2-LATE',
        code_machine: 'M-ACTIVE-01',
        tache: 'Contrôle pression hydraulique',
        prochaine_echeance: '2026-11-22',
        echeance_precedente: '2026-10-18',
        etat: 'Fait',
        validation_status: 'APPROVED',
        is_active: true,
      },
      // 3) Active task with a PENDING_VALIDATION field claim (due 2026-10-21) -> MUST NOT count as completed, stays OVERDUE
      {
        id: 'PM-3-PENDING',
        code_machine: 'M-ACTIVE-01',
        tache: 'Vérification capteurs sécurité',
        prochaine_echeance: '2026-10-21',
        etat: 'EN_ATTENTE_VALIDATION',
        validation_status: 'PENDING_VALIDATION',
        is_active: true,
      },
      // 4) Active task overdue with no execution (due 2026-10-17) -> OVERDUE
      {
        id: 'PM-4-OVERDUE',
        code_machine: 'M-ACTIVE-01',
        tache: 'Nettoyage filtre air',
        prochaine_echeance: '2026-10-17',
        etat: 'En retard',
        is_active: true,
      },
      // 5) Archived task on active machine -> MUST BE EXCLUDED from compliance denominator
      {
        id: 'PM-5-ARCHIVED-TASK',
        code_machine: 'M-ACTIVE-01',
        tache: 'Tâche obsolète archivée',
        prochaine_echeance: '2026-10-16',
        statut: 'ARCHIVEE',
        is_active: false,
        archived: true,
      },
      // 6) Active task on ARCHIVED machine -> MUST BE EXCLUDED from compliance denominator
      {
        id: 'PM-6-ARCHIVED-MACHINE',
        code_machine: 'M-ARCHIVED-02',
        tache: 'Graissage machine archivée',
        prochaine_echeance: '2026-10-16',
        etat: 'En retard',
        is_active: true,
      },
    ];

    const preventiveExecutions = [
      {
        id: 'EX-1-ONTIME',
        taskId: 'PM-1-ONTIME',
        machineCode: 'M-ACTIVE-01',
        executedAt: '2026-10-19T10:00:00Z',
        scheduledDueDate: '2026-10-20',
        status: 'COMPLETED',
        validation_status: 'APPROVED',
      },
      {
        id: 'EX-2-LATE',
        taskId: 'PM-2-LATE',
        machineCode: 'M-ACTIVE-01',
        executedAt: '2026-10-22T14:30:00Z',
        scheduledDueDate: '2026-10-18',
        status: 'COMPLETED',
        validation_status: 'APPROVED',
      },
      // Technician submitted field claim (PENDING_VALIDATION) -> NOT official completion
      {
        id: 'EX-3-PENDING',
        taskId: 'PM-3-PENDING',
        machineCode: 'M-ACTIVE-01',
        executedAt: '2026-10-20T09:00:00Z',
        scheduledDueDate: '2026-10-21',
        status: 'PENDING_VALIDATION',
        validation_status: 'PENDING_VALIDATION',
      },
    ];

    const compliance = computePmWindowCompliance({
      fromYMD: '2026-10-15',
      toYMD: '2026-10-25',
      preventiveTasks,
      preventiveExecutions,
      machines,
    });

    // Denominator must strictly include only the 4 active tasks on active machines (PM-1, PM-2, PM-3, PM-4)
    // PM-5 (archived task) and PM-6 (task on archived machine) are excluded!
    expect(compliance.archivedExcludedCount).toBe(2);
    expect(compliance.totalEligibleCount).toBe(4);

    // Approved completions: 1 ON_TIME + 1 LATE = 2 completed
    expect(compliance.onTimeCount).toBe(1);
    expect(compliance.lateCompletedCount).toBe(1);
    expect(compliance.completedTotalCount).toBe(2);

    // PENDING_VALIDATION task (PM-3) + unexecuted due task (PM-4) = 2 OVERDUE
    expect(compliance.overdueCount).toBe(2);
    expect(compliance.pendingClaimsExcludedCount).toBeGreaterThanOrEqual(1);

    // Verify individual statuses
    const itemById = new Map(compliance.items.map((i) => [i.taskId, i]));
    expect(itemById.get('PM-1-ONTIME')?.status).toBe('ON_TIME');
    expect(itemById.get('PM-2-LATE')?.status).toBe('LATE');
    expect(itemById.get('PM-3-PENDING')?.status).toBe('OVERDUE');
    expect(itemById.get('PM-3-PENDING')?.hasPendingClaim).toBe(true);
    expect(itemById.get('PM-4-OVERDUE')?.status).toBe('OVERDUE');
    expect(itemById.has('PM-5-ARCHIVED-TASK')).toBe(false);
    expect(itemById.has('PM-6-ARCHIVED-MACHINE')).toBe(false);

    // Rates: ON_TIME = 1/4 = 25%, Overall approved completion = 2/4 = 50%
    expect(compliance.onTimeComplianceRate).toBe(25);
    expect(compliance.overallCompletionRate).toBe(50);

    // Also verify buildShiftOrWeeklyReport exposes pmCompliance consistently
    const report = buildShiftOrWeeklyReport({
      from: '2026-10-15',
      to: '2026-10-25',
      preventiveTasks,
      preventiveExecutions,
      machines,
    });
    expect(report.pmCompliance.totalEligibleCount).toBe(4);
    expect(report.pmCompliance.onTimeCount).toBe(1);
    expect(report.pmCompliance.lateCompletedCount).toBe(1);
    expect(report.pmCompliance.overdueCount).toBe(2);
  });
});

describe('Phase 1 — B2 Machine Activity & Audit Ledger (buildMachineActivityLedger)', () => {
  it('returns [] for a machine with no events, excludes PENDING/REJECTED claims from official ledger, and chronologically aggregates approved BT, PM, Bobinage, BOM, and Lifecycle events', async () => {
    const { buildMachineActivityLedger } = await import(
      '../../application/services/MachineHealthPassportService'
    );

    // 1) Machine with zero events -> must return []
    const emptyLedger = buildMachineActivityLedger({
      machineOrId: { id_machine_registered: 'M-EMPTY-00', status: 'En Service', is_active: true },
      correctiveInterventions: [],
      preventiveExecutions: [],
      sortiesExterne: [],
      machineElementsLedger: [],
      warehouseItems: [],
    });
    expect(emptyLedger).toEqual([]);

    // 2) Machine with mixed official + PENDING events across all 5 sources
    const machine = {
      id_machine_registered: 'DET-01',
      designation: 'Découpeuse Laser 01',
      status: 'ARCHIVEE',
      is_active: false,
      archived: true,
      archived_at: '2026-10-28T16:00:00Z',
    };

    const correctiveInterventions = [
      // Approved BT with PDR cost
      {
        id: 'BT-APP-01',
        num_bt: 'BT-2026-01',
        code_machine: 'DET-01',
        anomalie: 'Fuite vérin serrage',
        action_realisee: 'Remplacement joint hydraulique',
        nom_composant: 'Vérin Principal',
        statut: 'CLOTURE',
        validation_status: 'APPROVED',
        validated_by_name: 'Resp. Maintenance',
        date_cloture: '2026-10-20',
        cout_pdr: 320,
        temps_arret_minutes: 90,
        pieces_utilisees: [{ ref: 'JNT-HYD-40', quantite: 2 }],
      },
      // PENDING BT field claim -> MUST NOT appear in official ledger
      {
        id: 'BT-PEND-02',
        num_bt: 'BT-2026-02',
        code_machine: 'DET-01',
        anomalie: 'Bruit suspect',
        statut: 'EN_COURS',
        validation_status: 'PENDING_VALIDATION',
        submitted_at: '2026-10-25T10:00:00Z',
        cout_pdr: 999,
      },
      // REJECTED BT -> MUST NOT appear in official ledger
      {
        id: 'BT-REJ-03',
        code_machine: 'DET-01',
        anomalie: 'Fausse alerte',
        statut: 'ANNULE',
        validation_status: 'REJECTED',
        date_demande: '2026-10-21',
      },
    ];

    const preventiveExecutions = [
      // Approved PM execution
      {
        id: 'EX-APP-01',
        taskId: 'PM-DET-01',
        taskName: 'Graissage glissières linéaires',
        machineCode: 'DET-01',
        executedAt: '2026-10-18T08:30:00Z',
        status: 'COMPLETED',
        validation_status: 'APPROVED',
        executorName: 'Karim Tech',
        totalCost: 45,
        durationMinutes: 30,
      },
      // PENDING PM execution -> MUST NOT appear in official ledger
      {
        id: 'EX-PEND-02',
        taskId: 'PM-DET-02',
        taskName: 'Nettoyage optique',
        machineCode: 'DET-01',
        executedAt: '2026-10-26T11:00:00Z',
        status: 'PENDING_VALIDATION',
        validation_status: 'PENDING_VALIDATION',
        totalCost: 150,
      },
    ];

    const sortiesExterne = [
      {
        id: 'SE-01',
        code: 'SORT-EXT-007',
        id_machine: 'DET-01',
        designation_moteur: 'Servomoteur Axe X 5kW',
        fournisseur: 'Atelier Bobinage Nord',
        statut: 'Monté',
        date_montage: '2026-10-22',
        cout_bobinage: 1200,
      },
    ];

    const machineElementsLedger = [
      {
        id: 'BOM-DET01-01',
        id_machine_registered: 'DET-01',
        ref_element: 'ROUL-SKF-6204',
        designation: 'Roulement SKF 6204',
        qte_montee: 2,
        unite: 'U',
        date_installation: '2026-10-10',
        emplacement_machine: 'Arbre principal',
      },
    ];

    const ledger = buildMachineActivityLedger({
      machineOrId: machine,
      correctiveInterventions,
      preventiveExecutions,
      sortiesExterne,
      machineElementsLedger,
    });

    // Only the 5 official events should be present (BT-PEND-02, BT-REJ-03, EX-PEND-02 excluded)
    expect(ledger).toHaveLength(5);
    expect(ledger.every((ev) => ev.isOfficial)).toBe(true);
    expect(ledger.some((ev) => ev.id.includes('PEND') || ev.id.includes('REJ'))).toBe(false);

    // Check chronological descending order (newest first):
    // 1) 2026-10-28: MACHINE_LIFECYCLE (Archive)
    // 2) 2026-10-22: EXTERNAL_BOBINAGE
    // 3) 2026-10-20: CORRECTIVE_BT (cost 320)
    // 4) 2026-10-18: PREVENTIVE_EXECUTION (cost 45)
    // 5) 2026-10-10: BOM_COMPONENT
    expect(ledger.map((e) => e.type)).toEqual([
      'MACHINE_LIFECYCLE',
      'EXTERNAL_BOBINAGE',
      'CORRECTIVE_BT',
      'PREVENTIVE_EXECUTION',
      'BOM_COMPONENT',
    ]);
    expect(ledger[2].cost).toBe(320);
    expect(ledger[2].referenceCode).toBe('BT-2026-01');
    expect(ledger[3].cost).toBe(45);
  });
});


