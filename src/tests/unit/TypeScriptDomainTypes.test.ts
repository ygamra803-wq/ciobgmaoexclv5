import { describe, it, expect } from 'vitest';
import type {
  IStockItem,
  IMachine,
  IMouvement,
  IDemandeIntervention,
  IBonTravail,
  IRapportIntervention,
  IPreventivePlan,
  IPreventiveTask,
  IUserSession,
  IAuditLog,
  ISyncQueueItem,
  IMtbfMttrData
} from '@/types';

describe('TypeScript Domain Types & Contracts (P1-3)', () => {
  it('should successfully construct and type-check Corrective Work Order entities', () => {
    const di: IDemandeIntervention = {
      id: 'DI-2026-001',
      code_di: 'DI-001',
      date_emission: '2026-10-06',
      emetteur: 'Technicien 1',
      id_machine: 'MCH-01',
      urgence: 'URGENTE',
      statut: 'PRISE_EN_CHARGE',
      description_panne: 'Fuite hydraulique sur vérin principal',
      arret_machine: true
    };

    expect(di.code_di).toBe('DI-001');
    expect(di.urgence).toBe('URGENTE');

    const bt: IBonTravail = {
      id: 'BT-2026-001',
      code_bt: 'BT-001',
      code_di: 'DI-001',
      date_creation: '2026-10-06',
      id_machine: 'MCH-01',
      priorite: 'URGENTE',
      statut: 'EN_COURS',
      technicien_assigne: 'Karim',
      pieces_demandees: [
        {
          ref_pdr: 'JNT-001',
          designation: 'Joint torique 50mm',
          quantite_demandee: 2,
          statut_dispo: 'DISPONIBLE'
        }
      ]
    };

    expect(bt.pieces_demandees?.[0].ref_pdr).toBe('JNT-001');
  });

  it('should successfully construct and type-check Preventive Maintenance entities', () => {
    const task: IPreventiveTask = {
      id_task: 'TSK-01',
      titre: 'Graissage paliers',
      description: 'Appliquer graisse haute température sur paliers',
      duree_estimee_min: 30,
      specialite: 'MECANIQUE'
    };

    const plan: IPreventivePlan = {
      id_plan: 'PLN-01',
      code_plan: 'PREV-MCH-01',
      titre: 'Maintenance mensuelle Tour CNC',
      id_machine: 'MCH-01',
      frequence: 'MENSUEL',
      intervalle_valeur: 1,
      intervalle_unite: 'MOIS',
      date_prochaine_echeance: '2026-11-01',
      statut: 'ACTIF',
      taches: [task],
      est_actif: true
    };

    expect(plan.taches.length).toBe(1);
    expect(plan.frequence).toBe('MENSUEL');
  });

  it('should successfully construct and type-check Security & Sync entities', () => {
    const session: IUserSession = {
      sessionId: 'sess_123',
      userId: 'user_01',
      username: 'admin',
      role: 'ADMIN',
      loginTimestamp: Date.now(),
      lastActivityTimestamp: Date.now(),
      expiresAt: Date.now() + 3600000,
      permissions: ['read', 'write', 'admin']
    };

    const syncItem: ISyncQueueItem = {
      id: 'sync_01',
      operation: {
        type: 'STOCK_ADJUSTMENT',
        collection: 'stock',
        payload: { ref: 'ROUL-01', quantite: 5 }
      },
      timestamp: new Date().toISOString(),
      retries: 0,
      maxRetries: 3,
      status: 'PENDING'
    };

    expect(session.role).toBe('ADMIN');
    expect(syncItem.status).toBe('PENDING');
  });
});
