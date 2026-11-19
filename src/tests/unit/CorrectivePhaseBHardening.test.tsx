import React, { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CorrectiveCalculationService,
  DEFAULT_LABOR_HOURLY_RATE,
} from '../../domain/corrective/services/CorrectiveCalculationService';
import { SecurityService } from '../../core/security/SecurityService';
import { useGmaoStore } from '../../store/useGmaoStore';
import BtValidationReviewModal from '../../presentation/pages/corrective/components/BtValidationReviewModal';
import AnalyseCorrectiveTab from '../../presentation/pages/corrective/AnalyseCorrectiveTab';
import { I18nProvider } from '../../i18n/I18nContext';
import type { CorrectiveInterventionItem, ICorrectiveTechnicalReport } from '../../types/store';

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'USR-ADMIN',
      nom: 'Chef Maintenance',
      role: 'ADMIN',
      matricule: 'ADM-01',
    },
  }),
}));

function setSessionUser(role: string, userId = 'USR-1', nom = 'Responsable Test') {
  SecurityService.saveSessionSecure('gmao_session_v2', {
    userId,
    id: userId,
    nom,
    role,
    matricule: userId,
  });
}

function resetStoreState() {
  localStorage.clear();
  sessionStorage.clear();
  SecurityService.removeSecure('gmao_session_v2');
  useGmaoStore.setState({
    correctiveInterventions: [],
    auditEvents: [],
    sortieDemands: [],
    preventiveExecutions: [],
    mouvements: [],
    rawStock: [],
    machines: [],
    technicians: [],
    workshopOrders: [],
    needRequests: [],
    activeLiveInterventionId: null,
  });
}

function setNativeValue(el: HTMLInputElement | HTMLSelectElement, value: string) {
  const proto =
    el instanceof HTMLSelectElement
      ? HTMLSelectElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) {
    setter.call(el, value);
  } else {
    el.value = value;
  }
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('Corrective Phase B1 — Industrial TCO Engine & Store Persistence', () => {
  beforeEach(() => {
    resetStoreState();
  });

  afterEach(() => {
    resetStoreState();
  });

  it('computes exact TCO breakdown (PDR + Atelier + Labor + Production Downtime Loss)', () => {
    const stockMap = new Map<string, any>([
      ['PDR-6205', { ref: 'PDR-6205', designation: 'Roulement 6205', prix_unitaire: 150 }],
    ]);
    const machineMap = new Map<string, any>([
      ['M-EXT-01', { id_machine_registered: 'M-EXT-01', cout_arret_horaire: 1200 }],
    ]);
    const technicianMap = new Map<string, any>([
      ['TECH-01', { id_technician: 'TECH-01', nom: 'Karim', taux_horaire: 60 }],
    ]);

    const breakdown = CorrectiveCalculationService.computeInterventionCostBreakdown(
      {
        code_machine: 'M-EXT-01',
        technicien_matricule: 'TECH-01',
        arret_machine: true,
        temps_intervention_mins: 90, // 1.5h -> labor = 90 DH
        temps_arret_minutes: 120, // 2.0h -> production loss = 2400 DH
        cout_atelier: 400,
        pieces_utilisees: [{ ref: 'PDR-6205', quantite: 2 }], // 300 DH
      },
      { stockMap, machineMap, technicianMap }
    );

    expect(breakdown.coutPdr).toBe(300);
    expect(breakdown.coutAtelier).toBe(400);
    expect(breakdown.tauxHoraire).toBe(60);
    expect(breakdown.coutMainOeuvre).toBe(90);
    expect(breakdown.coutDirectMaintenance).toBe(790); // 300 + 400 + 90
    expect(breakdown.coutArretHoraire).toBe(1200);
    expect(breakdown.coutArretProduction).toBe(2400);
    expect(breakdown.coutTotalTco).toBe(3190); // 790 + 2400
  });

  it('never fabricates production downtime cost when machine rate is omitted or arret_machine is false', () => {
    const machineMap = new Map<string, any>([
      ['M-NO-RATE', { id_machine_registered: 'M-NO-RATE' }],
      ['M-WITH-RATE', { id_machine_registered: 'M-WITH-RATE', cout_arret_horaire: 900 }],
    ]);

    const noRate = CorrectiveCalculationService.computeInterventionCostBreakdown(
      {
        code_machine: 'M-NO-RATE',
        arret_machine: true,
        temps_intervention_mins: 60,
        temps_arret_minutes: 60,
      },
      { machineMap }
    );
    expect(noRate.tauxHoraire).toBe(DEFAULT_LABOR_HOURLY_RATE);
    expect(noRate.coutMainOeuvre).toBe(DEFAULT_LABOR_HOURLY_RATE);
    expect(noRate.coutArretHoraire).toBe(0);
    expect(noRate.coutArretProduction).toBe(0);
    expect(noRate.coutTotalTco).toBe(DEFAULT_LABOR_HOURLY_RATE);

    const running = CorrectiveCalculationService.computeInterventionCostBreakdown(
      {
        code_machine: 'M-WITH-RATE',
        arret_machine: false,
        temps_intervention_mins: 60,
      },
      { machineMap }
    );
    expect(running.downtimeMinutes).toBe(0);
    expect(running.coutArretProduction).toBe(0);
  });

  it('persists cout_total (PDR+Atelier) and cout_total_tco (full TCO) on BT closure + audit trail', () => {
    setSessionUser('ADMIN', 'ADM-01', 'Chef Maintenance');

    useGmaoStore.setState({
      machines: [
        {
          id_machine_registered: 'M-TCO-01',
          nom: 'Ligne Extrusion 1',
          cout_arret_horaire: 1000,
        } as any,
      ],
      technicians: [
        {
          id_technician: 'TECH-07',
          nom: 'Hassan',
          taux_horaire: 50,
        } as any,
      ],
      rawStock: [
        {
          ref: 'PDR-TCO',
          designation: 'Joint Haute Pression',
          stockInitial: 10,
          prix_unitaire: 200,
        } as any,
      ],
      correctiveInterventions: [
        {
          id: 'BT-TCO-01',
          num_bt: 'BT-TCO-01',
          code_machine: 'M-TCO-01',
          anomalie: 'Fuite vérin principal',
          statut: 'EN_COURS',
          arret_machine: true,
          technicien_matricule: 'TECH-07',
          intervenant: 'Hassan',
          date_debut: '2026-06-01',
          heure_debut: '09:00',
        } as CorrectiveInterventionItem,
      ],
    });

    const emittedMovements: any[] = [];
    const closed = useGmaoStore.getState().handleClotureIntervention(
      'BT-TCO-01',
      {
        action_realisee: 'Remplacement joint HP et purge circuit',
        date_fin: '2026-06-01',
        heure_fin: '11:00', // 2h working time -> labor = 2 * 50 = 100 DH
        temps_arret_minutes: 150, // 2.5h -> stoppage = 2.5 * 1000 = 2500 DH
        cout_atelier: 300,
        pieces_utilisees: [{ ref: 'PDR-TCO', designation: 'Joint Haute Pression', quantite: 2 }], // 400 DH
      },
      (mvt) => emittedMovements.push(mvt)
    ) as CorrectiveInterventionItem;

    expect(closed).toBeTruthy();
    expect(closed.statut).toBe('CLOTURE');
    expect(closed.cout_pdr).toBe(400);
    expect(closed.cout_atelier).toBe(300);
    // Legacy contract preserved: cout_total === cout_pdr + cout_atelier
    expect(closed.cout_total).toBe(700);
    // Industrial TCO fields
    expect(closed.taux_horaire).toBe(50);
    expect(closed.cout_main_oeuvre).toBe(100);
    expect(closed.cout_arret_horaire).toBe(1000);
    expect(closed.cout_arret_production).toBe(2500);
    expect(closed.cout_total_tco).toBe(3300); // 400 + 300 + 100 + 2500
    expect(emittedMovements.length).toBe(1);

    const audit = useGmaoStore
      .getState()
      .auditEvents.find((ev) => ev.actionType === 'CORRECTIVE_BT_CLOSED');
    expect(audit).toBeTruthy();
    expect(audit?.after?.cout_total_tco).toBe(3300);
  });
});

describe('Corrective Phase B2 — 3D Industrial Pareto (COUNT | DOWNTIME | COST)', () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount();
      });
      root = null;
    }
    container.remove();
  });

  const machines = [
    { id_machine_registered: 'M-MINOR', nom: 'Convoyeur', cout_arret_horaire: 100 },
    { id_machine_registered: 'M-CRIT', nom: 'Four Principal', cout_arret_horaire: 2000 },
  ];
  const machineMap = new Map(machines.map((m) => [m.id_machine_registered, m]));

  // 4 frequent minor faults vs 1 rare catastrophic fault
  const sampleInterventions: any[] = [
    {
      id: 'BT-1',
      code_machine: 'M-MINOR',
      anomalie: 'Capteur encrassé',
      statut: 'CLOTURE',
      arret_machine: true,
      temps_intervention_mins: 15,
      temps_arret_minutes: 15,
      cout_pdr: 0,
      date_demande: '2026-06-01',
    },
    {
      id: 'BT-2',
      code_machine: 'M-MINOR',
      anomalie: 'Capteur encrassé',
      statut: 'CLOTURE',
      arret_machine: true,
      temps_intervention_mins: 15,
      temps_arret_minutes: 15,
      cout_pdr: 0,
      date_demande: '2026-06-02',
    },
    {
      id: 'BT-3',
      code_machine: 'M-MINOR',
      anomalie: 'Capteur encrassé',
      statut: 'CLOTURE',
      arret_machine: true,
      temps_intervention_mins: 15,
      temps_arret_minutes: 15,
      cout_pdr: 0,
      date_demande: '2026-06-03',
    },
    {
      id: 'BT-4',
      code_machine: 'M-MINOR',
      anomalie: 'Capteur encrassé',
      statut: 'CLOTURE',
      arret_machine: true,
      temps_intervention_mins: 15,
      temps_arret_minutes: 15,
      cout_pdr: 0,
      date_demande: '2026-06-04',
    },
    {
      id: 'BT-5',
      code_machine: 'M-CRIT',
      anomalie: 'Casse réducteur principal',
      statut: 'CLOTURE',
      arret_machine: true,
      temps_intervention_mins: 240,
      temps_arret_minutes: 360, // 6h -> 12,000 DH production loss
      cout_pdr: 5000,
      cout_atelier: 2500,
      date_demande: '2026-06-05',
    },
  ];

  it('re-ranks #1 anomaly and #1 machine when switching between COUNT, DOWNTIME, and COST', () => {
    const byCount = CorrectiveCalculationService.compute3DPareto(
      sampleInterventions,
      'anomalie',
      'COUNT',
      { machineMap }
    );
    expect(byCount[0].name).toBe('Capteur encrassé');
    expect(byCount[0].count).toBe(4);
    expect(byCount[0].percentage).toBe(80);
    expect(byCount[0].isPareto80).toBe(true);

    const byDowntime = CorrectiveCalculationService.compute3DPareto(
      sampleInterventions,
      'anomalie',
      'DOWNTIME',
      { machineMap }
    );
    expect(byDowntime[0].name).toBe('Casse réducteur principal');
    expect(byDowntime[0].downtimeMinutes).toBe(360);
    expect(byDowntime[0].isPareto80).toBe(true);

    const byCost = CorrectiveCalculationService.compute3DPareto(
      sampleInterventions,
      'code_machine',
      'COST',
      { machineMap }
    );
    expect(byCost[0].name).toBe('M-CRIT');
    expect(byCost[0].totalCost).toBeGreaterThan(19000);
    expect(byCost[1].name).toBe('M-MINOR');
    expect(byCost[1].totalCost).toBeLessThan(500);
  });

  it('renders TCO cockpit and switches 3D Pareto dimension interactively in AnalyseCorrectiveTab', async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(
        <I18nProvider>
          <AnalyseCorrectiveTab
            interventions={sampleInterventions}
            machines={machines}
            stockItems={[]}
            technicians={[]}
            onNavigateToTab={vi.fn()}
            onAddPreventiveTask={vi.fn()}
            showToast={vi.fn()}
          />
        </I18nProvider>
      );
    });

    expect(container.querySelector('[data-testid="analyse-tco-kpi-card"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="analyse-tco-breakdown-strip"]')).toBeTruthy();

    const countBtn = container.querySelector('[data-testid="pareto-dim-COUNT"]') as HTMLButtonElement;
    const costBtn = container.querySelector('[data-testid="pareto-dim-COST"]') as HTMLButtonElement;
    expect(countBtn?.getAttribute('aria-selected')).toBe('true');

    await act(async () => {
      costBtn.click();
    });

    expect(costBtn.getAttribute('aria-selected')).toBe('true');
    expect(container.textContent).toContain('Classement par Coût Global TCO cumulé');
  });
});

describe('Corrective Phase B3 — SSOT Technical RCA Persistence & RBAC', () => {
  beforeEach(() => {
    resetStoreState();
  });

  afterEach(() => {
    resetStoreState();
  });

  it('persists technical_report and cause_racine on a CLOTURE BT, appends audit event, and blocks VIEWER', () => {
    useGmaoStore.setState({
      correctiveInterventions: [
        {
          id: 'BT-RCA-01',
          num_bt: 'BT-RCA-01',
          code_machine: 'M-EXT-01',
          anomalie: 'Surchauffe moteur',
          statut: 'CLOTURE',
          cout_pdr: 500,
          cout_total: 500,
        } as CorrectiveInterventionItem,
      ],
    });

    const report: ICorrectiveTechnicalReport = {
      fields: {
        exec_summary: 'Démontage ventilateur et contrôle isolement stator',
        root_cause_detail: 'Colmatage grille aspiration + roulement AV grippé',
        rec_preventive: 'Nettoyage mensuel filtre moteur + contrôle thermographique',
      },
      extraRcaRows: [
        {
          id: 'rca-1',
          component: 'Ventilateur moteur',
          observation: 'Grille obstruée par poussière',
          impact: 'Surchauffe stator +85°C',
        },
      ],
      updatedAt: '2026-06-15T09:30:00.000Z',
      savedById: 'ADM-01',
      savedByName: 'Chef Maintenance',
    };

    // Fail-closed for VIEWER
    setSessionUser('VIEWER', 'USR-VIEW', 'Observateur');
    const blocked = useGmaoStore.getState().handleSaveInterventionReport('BT-RCA-01', report);
    expect(blocked.valid).toBe(false);
    expect(useGmaoStore.getState().correctiveInterventions[0].technical_report).toBeUndefined();

    // Allowed for ADMIN (post-mortem RCA does not alter CLOTURE status or costs)
    setSessionUser('ADMIN', 'ADM-01', 'Chef Maintenance');
    const savedRes = useGmaoStore.getState().handleSaveInterventionReport('BT-RCA-01', report);
    expect(savedRes.valid).toBe(true);
    const saved = savedRes.intervention as CorrectiveInterventionItem;

    expect(saved).toBeTruthy();
    expect(saved.statut).toBe('CLOTURE');
    expect(saved.cout_total).toBe(500);
    expect(saved.rapport_redige).toBe('OUI');
    expect(saved.cause_racine).toBe('Colmatage grille aspiration + roulement AV grippé');
    expect(saved.technical_report?.fields.exec_summary).toBe(report.fields.exec_summary);
    expect(saved.technical_report?.extraRcaRows).toHaveLength(1);
    expect(saved.technical_report?.savedByName).toBe('Chef Maintenance');

    const rcaAudit = useGmaoStore
      .getState()
      .auditEvents.find((ev) => ev.actionType === 'CORRECTIVE_RCA_SAVED');
    expect(rcaAudit).toBeTruthy();
  });
});

describe('Corrective Phase B4 — Supervisor Adding Missing PDRs in Maker-Checker Review', () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    resetStoreState();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount();
      });
      root = null;
    }
    container.remove();
    resetStoreState();
  });

  it('allows supervisor to add a missing catalog PDR and merges duplicate refs in BtValidationReviewModal', async () => {
    function Harness() {
      const [pieces, setPieces] = useState<Array<{ ref: string; designation: string; quantite: number }>>([
        { ref: 'PDR-A', designation: 'Courroie SPA', quantite: 1 },
      ]);
      return (
        <BtValidationReviewModal
          reviewModalBt={{
            id: 'BT-REV-1',
            num_bt: 'BT-REV-1',
            code_machine: 'M-01',
            submitted_by_name: 'Technicien Ali',
          }}
          setReviewModalBt={vi.fn()}
          resolveTechNom={() => 'Technicien Ali'}
          reviewReconciliation={{ alerts: [], hasWarning: false, hasCritical: false }}
          reviewNature="DEPANNAGE_TEMPORAIRE"
          setReviewNature={vi.fn()}
          reviewActionRealisee="Remplacement courroie"
          setReviewActionRealisee={vi.fn()}
          reviewPieces={pieces}
          setReviewPieces={setPieces}
          stockItems={[
            { ref: 'PDR-A', designation: 'Courroie SPA', stockActuel: 10 },
            { ref: 'PDR-B', designation: 'Roulement 6308', stockActuel: 6 },
          ]}
          reviewSkipStockDeduction={false}
          setReviewSkipStockDeduction={vi.fn()}
          sortiesExterne={[]}
          handleMarkSortieReturned={vi.fn()}
          showToast={vi.fn()}
          reviewNote=""
          setReviewNote={vi.fn()}
          handleReviewDecision={vi.fn()}
        />
      );
    }

    await act(async () => {
      root = createRoot(container);
      root.render(<Harness />);
    });

    expect(container.querySelector('[data-testid="review-add-pdr-panel"]')).toBeTruthy();
    const select = container.querySelector('[data-testid="review-add-pdr-select"]') as HTMLSelectElement;
    const qtyInput = container.querySelector('[data-testid="review-add-pdr-qty"]') as HTMLInputElement;
    const addBtn = container.querySelector('[data-testid="review-add-pdr-btn"]') as HTMLButtonElement;

    // Add a missing PDR (PDR-B x 2)
    await act(async () => {
      setNativeValue(select, 'PDR-B');
      setNativeValue(qtyInput, '2');
    });
    await act(async () => {
      addBtn.click();
    });

    expect(container.textContent).toContain('PDR-B');
    expect(container.textContent).toContain('Pièces de Rechange Proposées (2)');

    // Add PDR-B x 1 again -> merges quantity to 3 instead of creating duplicate row
    await act(async () => {
      setNativeValue(select, 'PDR-B');
      setNativeValue(qtyInput, '1');
    });
    await act(async () => {
      addBtn.click();
    });

    expect(container.textContent).toContain('Pièces de Rechange Proposées (2)');
    const numericInputs = Array.from(
      container.querySelectorAll<HTMLInputElement>('input[type="number"]')
    );
    // Row 0 = PDR-A (1), Row 1 = PDR-B (3), Adder qty input = (1)
    expect(numericInputs[1].value).toBe('3');
  });

  it('commits supervisor-added PDR with validated_with_edits=true, updates TCO, and blocks stock shortage', () => {
    setSessionUser('ADMIN', 'ADM-01', 'Chef Maintenance');

    useGmaoStore.setState({
      machines: [
        { id_machine_registered: 'M-MC-01', nom: 'Presse 1', cout_arret_horaire: 600 } as any,
      ],
      technicians: [
        { id_technician: 'TECH-02', nom: 'Youssef', taux_horaire: 40 } as any,
      ],
      rawStock: [
        { ref: 'PDR-A', designation: 'Courroie', stockInitial: 5, prix_unitaire: 100 } as any,
        { ref: 'PDR-B', designation: 'Roulement 6308', stockInitial: 3, prix_unitaire: 250 } as any,
      ],
      correctiveInterventions: [
        {
          id: 'BT-MC-01',
          num_bt: 'BT-MC-01',
          code_machine: 'M-MC-01',
          anomalie: 'Vibration arbre',
          statut: 'EN_ATTENTE_VALIDATION',
          validation_status: 'PENDING_VALIDATION',
          arret_machine: true,
          technicien_matricule: 'TECH-02',
          intervenant: 'Youssef',
          temps_intervention_propose: '01:00',
          temps_intervention_mins: 60,
          temps_arret_minutes: 60,
          pieces_proposees: [{ ref: 'PDR-A', designation: 'Courroie', quantite: 1 }],
        } as CorrectiveInterventionItem,
      ],
    });

    // 1. Attempting to approve with supervisor-added qty exceeding live stock (5 > 3) MUST fail-closed
    const shortageRes = useGmaoStore.getState().handleReviewInterventionValidation(
      'BT-MC-01',
      {
        decision: 'APPROVED',
        pieces_utilisees: [
          { ref: 'PDR-A', designation: 'Courroie', quantite: 1 },
          { ref: 'PDR-B', designation: 'Roulement 6308', quantite: 5 },
        ],
      },
      vi.fn()
    );

    expect(shortageRes).toBeNull();
    expect(useGmaoStore.getState().correctiveInterventions[0].statut).toBe('EN_ATTENTE_VALIDATION');

    // 2. Approving with valid supervisor-added PDR (PDR-B x 2 <= 3) succeeds with validated_with_edits=true & TCO
    const emitted: any[] = [];
    const approved = useGmaoStore.getState().handleReviewInterventionValidation(
      'BT-MC-01',
      {
        decision: 'APPROVED',
        pieces_utilisees: [
          { ref: 'PDR-A', designation: 'Courroie', quantite: 1 },
          { ref: 'PDR-B', designation: 'Roulement 6308', quantite: 2 },
        ],
      },
      (mvt) => emitted.push(mvt)
    ) as CorrectiveInterventionItem;

    expect(approved).toBeTruthy();
    expect(approved.statut).toBe('CLOTURE');
    expect(approved.validated_with_edits).toBe(true);
    expect(emitted).toHaveLength(2);
    expect(approved.cout_pdr).toBe(600); // 1*100 + 2*250
    expect(approved.cout_total).toBe(600);
    expect(approved.cout_main_oeuvre).toBe(40); // 1h * 40
    expect(approved.cout_arret_production).toBe(600); // 1h * 600
    expect(approved.cout_total_tco).toBe(1240); // 600 + 40 + 600
  });
});
