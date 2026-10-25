import { describe, it, expect } from 'vitest';
import {
  isTechnicianRole,
  getTechnicianDisplayName,
  getTechnicianBadgeLabel,
  matchesTechnicianRecord,
  buildTechnicianDashboardScope,
} from '../technicianScope';
import { AuthorizationService } from '../AuthorizationService';

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

