import { describe, it, expect } from 'vitest';
import { swaggerSpec, swaggerUiOptions } from '../../config/swaggerConfig';
import { NotificationService } from '../../utils/notificationService';
import { serverSyncService } from '../../services/serverSyncService';
import { DataGateway } from '../../application/DataGateway';
import { loadCollection } from '../../infrastructure/persistence/migrateStorage';
import { STORAGE_KEYS } from '../../infrastructure/persistence/storageKeys';
import { PreventiveService } from '../../application/services/PreventiveService';

describe('CIOB GMAO v4 — 4-Pillar Enhancements & SSOT Integration Suite', () => {
  it('Pillar 4 (OpenAPI / Swagger): generates a valid OpenAPI 3.0 specification with core GMAO paths and security', () => {
    const spec = swaggerSpec as any;
    expect(spec.openapi).toBe('3.0.0');
    expect(spec.info.title).toBe('CIOB GMAO API');
    expect(spec.info.version).toBe('4.0.0');
    expect(spec.paths['/health']).toBeDefined();
    expect(spec.paths['/gmao/state']).toBeDefined();
    expect(spec.paths['/gmao/{entity}']).toBeDefined();
    expect(spec.paths['/gmao/{entity}/{id}']).toBeDefined();
    expect(spec.components.securitySchemes.ApiKeyAuth).toBeDefined();
    expect(swaggerUiOptions.customSiteTitle).toBe('CIOB GMAO API Documentation');
  });

  it('Pillar 3 (PWA & NotificationService): converts VAPID base64url keys accurately and degrades gracefully in headless environments', async () => {
    const sampleKey = 'BKjZQ1Q8JQ5OeYl5Q1Z5JQ5OeYl5Q1Z5JQ5OeYl5Q1Z5JQ5OeYl5Q1Z5JQ';
    const uint8 = NotificationService.urlBase64ToUint8Array(sampleKey);
    expect(uint8).toBeInstanceOf(Uint8Array);
    expect(uint8.length).toBeGreaterThan(30);

    const syncResult = await NotificationService.triggerBackgroundSync('sync-gmao-data');
    expect(typeof syncResult).toBe('boolean');
  });

  it('Pillar 1 (Integration - MANUAL_SSOT_TEST 5-step protocol & Conflict Detection): executes full lifecycle cleanly', () => {
    // Step 1: Start in empty mode
    DataGateway.clearAllForRealFactory();
    expect(loadCollection(STORAGE_KEYS.PREVENTIVE_TASKS, [])).toEqual([]);

    // Step 2: Load demo data
    const demoLoaded = DataGateway.loadDemoData();
    expect(demoLoaded.stockCount).toBeGreaterThan(800);
    expect(demoLoaded.preventiveCount).toBeGreaterThan(100);
    const demoTasksSnapshot = PreventiveService.getTasks();
    expect(demoTasksSnapshot.length).toBeGreaterThan(100);

    // Step 3: Clear all for real factory
    DataGateway.clearAllForRealFactory();
    expect(PreventiveService.getTasks()).toEqual([]);

    // Step 4: Add 3 preventive tasks
    const threeTasks = [
      { id: 'SSOT-1', machine: 'DET-05', task_description: 'Contrôle vibration' },
      { id: 'SSOT-2', machine: 'PCE-01', task_description: 'Vérification pression' },
      { id: 'SSOT-3', machine: 'FRL-02', task_description: 'Nettoyage capteur' },
    ];
    PreventiveService.saveTasks(threeTasks);

    // Step 5: Simulate F5 reload and verify only 3 tasks remain without demo resurrection
    const afterF5 = loadCollection(STORAGE_KEYS.PREVENTIVE_TASKS, demoTasksSnapshot);
    expect(afterF5).toHaveLength(3);
    expect(afterF5.map((t: any) => t.id)).toEqual(['SSOT-1', 'SSOT-2', 'SSOT-3']);

    // Verify conflict detection between local 3 tasks and server 100+ tasks
    const conflict = serverSyncService.detectConflict(
      { stock: [], machines: [], preventiveTasks: threeTasks, correctiveInterventions: [], mouvements: [] },
      {
        stock: new Array(demoLoaded.stockCount),
        machines: new Array(demoLoaded.machinesCount),
        preventiveTasks: demoTasksSnapshot,
        correctiveInterventions: new Array(demoLoaded.correctiveCount),
        mouvements: new Array(demoLoaded.movementsCount),
        updatedAt: new Date(Date.now() + 60000).toISOString(),
      }
    );
    expect(conflict.hasConflict).toBe(true);
  });
});
