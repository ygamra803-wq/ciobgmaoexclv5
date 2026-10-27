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
});


