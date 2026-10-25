import { describe, it, expect } from 'vitest';
import {
  isTechnicianRole,
  getTechnicianDisplayName,
  getTechnicianBadgeLabel,
  matchesTechnicianRecord,
} from '../technicianScope';

const SAMPLE_TECHNICIANS = [
  { id_technician: 'TECH-01', nom: 'Rachid', id_zone: 'FM', specialite: 'Mécanique' },
  { id_technician: 'TECH-02', nom: 'Youssef', id_zone: 'Polissage', specialite: 'Polissage' },
  { id_technician: 'TECH-03', nom: 'Mhammed', id_zone: 'Presse injection', specialite: 'Injection' },
];

describe('technicianScope (R4 Row-Level Identity Matching)', () => {
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
});
