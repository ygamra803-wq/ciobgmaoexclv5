// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createSqliteStateStore } from '../../server/persistence/sqliteStateStore';
import type { CorrectiveInterventionItem } from '../../types/store';

describe('Corrective Phase B3 — SQLite Technical RCA & TCO Persistence Round-Trip', () => {
  let tempDir = '';

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      tempDir = '';
    }
  });

  it('persists technical_report, cause_racine, and TCO fields across SQLite close & reopen', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gmao-rca-sqlite-'));
    const dbFile = path.join(tempDir, 'ciob_gmao_rca_test.db');

    const store1 = createSqliteStateStore({ dbFile, journalMode: 'DELETE' });
    const btWithRca: CorrectiveInterventionItem = {
      id: 'BT-SQLITE-RCA',
      num_bt: 'BT-SQLITE-RCA',
      code_machine: 'M-PRESSE-04',
      anomalie: 'Perte pression hydraulique',
      statut: 'CLOTURE',
      cout_pdr: 450,
      cout_atelier: 300,
      cout_total: 750,
      taux_horaire: 55,
      cout_main_oeuvre: 110,
      cout_arret_horaire: 1200,
      cout_arret_production: 2400,
      cout_total_tco: 3260,
      cause_racine: 'Clapet anti-retour fissuré',
      rapport_redige: 'OUI',
      technical_report: {
        fields: {
          exec_summary: 'Remplacement clapet + test pression 180 bar',
          rca_root_cause: 'Clapet anti-retour fissuré',
          rec_preventive: 'Contrôle pression trimestriel',
        },
        extraRcaRows: [
          {
            id: 'rca-sql-1',
            component: 'Clapet anti-retour',
            observation: 'Fissure siège',
            impact: 'Chute pression 40 bar',
          },
        ],
        updatedAt: '2026-06-15T10:00:00.000Z',
        savedById: 'ENG-01',
        savedByName: 'Ingénieur Fiabilité',
      },
    };

    store1.dbState.correctiveInterventions = [btWithRca];
    await store1.persistState({
      actor: 'Ingénieur Fiabilité',
      action: 'CORRECTIVE_RCA_SAVED',
      entity: 'correctiveInterventions',
      summary: 'RCA + TCO persisted for BT-SQLITE-RCA',
    });
    store1.close();

    // Reopen fresh SQLite handle and verify full RCA & TCO payload survived intact
    const store2 = createSqliteStateStore({ dbFile, journalMode: 'DELETE' });
    const reloaded = (store2.dbState.correctiveInterventions || []).find(
      (b: any) => b.id === 'BT-SQLITE-RCA'
    ) as CorrectiveInterventionItem | undefined;
    expect(reloaded).toBeTruthy();
    expect(reloaded?.cout_total).toBe(750);
    expect(reloaded?.cout_total_tco).toBe(3260);
    expect(reloaded?.cause_racine).toBe('Clapet anti-retour fissuré');
    expect(reloaded?.technical_report?.fields.exec_summary).toBe(
      'Remplacement clapet + test pression 180 bar'
    );
    expect(reloaded?.technical_report?.extraRcaRows).toHaveLength(1);
    store2.close();
  });
});
