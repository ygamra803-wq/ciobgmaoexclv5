import { describe, it, expect } from 'vitest';
import { CorrectiveIntervention } from '../../domain/corrective/entities/CorrectiveIntervention';
import { DatabaseService } from '../../core/database/DatabaseService';

describe('Complete Workflow E2E', () => {
  it('should complete a full DI to BT conversion and closure workflow', async () => {
    const db = new DatabaseService();

    // 1. Create a Demande d'Intervention (DI)
    const diData = {
      code_machine: 'PRESS-01',
      demandeur: 'Production Team A',
      anomalie: 'Fuite d\'huile sous la presse hydraulique',
      priorite: 'HAUTE',
      statut: 'DEMANDE'
    };
    
    const di = new CorrectiveIntervention(diData);
    expect(di.statut).toBe('DEMANDE');
    expect(di.code_machine).toBe('PRESS-01');
    expect(di.action_fermee).toBe('NON');

    // Save DI to Database
    const savedDI = await db.save('interventions', di.toJSON());
    expect(savedDI).toBe(true);

    // 2. Retrieve DI and Convert to Bon de Travail (BT)
    const retrievedDIJson = await db.getById('interventions', di.id);
    expect(retrievedDIJson).not.toBeNull();
    
    const correctiveDI = CorrectiveIntervention.fromJSON(retrievedDIJson);
    expect(correctiveDI.id).toBe(di.id);

    // Update to BT (Assign technician and set num_bt)
    correctiveDI.num_bt = 'BT-2026-0045';
    correctiveDI.intervenant = 'Mounir El-Khatib';
    correctiveDI.technicien_matricule = 'TECH-002';
    correctiveDI.statut = 'EN_COURS';

    // Save updated BT
    const savedBT = await db.save('interventions', correctiveDI.toJSON());
    expect(savedBT).toBe(true);

    // 3. Complete and Close BT
    const retrievedBTJson = await db.getById('interventions', di.id);
    const activeBT = CorrectiveIntervention.fromJSON(retrievedBTJson);
    expect(activeBT.statut).toBe('EN_COURS');

    activeBT.date_debut = '2026-10-05';
    activeBT.heure_debut = '08:00';
    activeBT.date_fin = '2026-10-05';
    activeBT.heure_fin = '09:30';
    activeBT.action_realisee = 'Remplacement du joint spi défectueux et nettoyage';
    activeBT.pdr_ref = 'JOINT-SPI-50';
    activeBT.pdr_quantite = 1;
    activeBT.action_fermee = 'OUI';
    activeBT.statut = 'CLOTURE';

    // Automatic calculation of working hours should trigger inside constructor
    const closedBT = new CorrectiveIntervention(activeBT.toJSON());
    expect(closedBT.temps_intervention_mins).toBe(90);
    expect(closedBT.temps_intervention).toBe('01:30');
    expect(closedBT.statut).toBe('CLOTURE');

    // Save final report
    const finalSave = await db.save('interventions', closedBT.toJSON());
    expect(finalSave).toBe(true);

    // 4. Validate final report in DB
    const finalReportJson = await db.getById('interventions', di.id);
    expect(finalReportJson.statut).toBe('CLOTURE');
    expect(finalReportJson.temps_intervention).toBe('01:30');
    expect(finalReportJson.pdr_ref).toBe('JOINT-SPI-50');
    expect(finalReportJson.intervenant).toBe('Mounir El-Khatib');
  });
});
