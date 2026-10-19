import { describe, it, expect, beforeEach } from 'vitest';
import { DataGateway } from '../../application/DataGateway';
import { STORAGE_KEYS } from '../../infrastructure/persistence/storageKeys';
import { storageService } from '../../utils/storageService';
import { loadCollection } from '../../infrastructure/persistence/migrateStorage';
import { PreventiveService } from '../../application/services/PreventiveService';
import { indexedDBService } from '../../infrastructure/database/IndexedDBService';

describe('DATA-04: Preventive Persistence & Clear Factory SSOT Audit', () => {
  beforeEach(async () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    DataGateway.clearAllForRealFactory();
    try {
      await indexedDBService.clearAll();
    } catch {
      // Ignore if FakeIndexedDB not mounted
    }
  });

  it('clears all canonical and legacy preventive keys and prevents Stage 2 legacy resurrection on F5', () => {
    // 1. Simulate legacy preventive keys holding old 1175 tasks
    const legacyTasks = [
      { id: 'LEGACY-1', machine: 'DET-01', task_description: 'Graissage roulements' },
      { id: 'LEGACY-2', machine: 'DET-02', task_description: 'Nettoyage filtre' },
    ];
    localStorage.setItem('gmao_preventive_tasks_v8', JSON.stringify(legacyTasks));
    localStorage.setItem('gmao_preventive_tasks', JSON.stringify(legacyTasks));
    storageService.setItem(STORAGE_KEYS.PREVENTIVE_TASKS, legacyTasks);

    expect(PreventiveService.getTasks()).toHaveLength(2);

    // 2. Execute clearAllForRealFactory
    let stateTasks: any[] = legacyTasks;
    DataGateway.clearAllForRealFactory({
      setPreventiveTasks: (val: any[]) => {
        stateTasks = val;
      },
    });

    // 3. Verify immediate state and canonical storage
    expect(stateTasks).toEqual([]);
    expect(PreventiveService.getTasks()).toEqual([]);
    expect(storageService.getItem(STORAGE_KEYS.START_MODE, null)).toBe('empty');
    expect(storageService.getItem(STORAGE_KEYS.DEMO_MODE, null)).toBe(false);

    // 4. Verify legacy keys were purged
    expect(localStorage.getItem('gmao_preventive_tasks_v8')).toBeNull();
    expect(localStorage.getItem('gmao_preventive_tasks')).toBeNull();

    // 5. Simulate F5 reload via loadCollection — must return [] and never resurrect legacy tasks
    const reloaded = loadCollection(STORAGE_KEYS.PREVENTIVE_TASKS, legacyTasks);
    expect(reloaded).toEqual([]);
  });

  it('prevents hydrateFromIndexedDB from overwriting an empty canonical key when START_MODE is empty', async () => {
    // 1. Set factory to empty mode via clearAllForRealFactory
    DataGateway.clearAllForRealFactory();
    expect(PreventiveService.getTasks()).toEqual([]);

    // 2. Simulate hydration race call after clear
    const hydrated = await storageService.hydrateFromIndexedDB(STORAGE_KEYS.PREVENTIVE_TASKS);
    expect(hydrated).toEqual([]);
    expect(PreventiveService.getTasks()).toEqual([]);
  });

  it('persists newly added preventive tasks after clearAllForRealFactory and survives F5 reload', () => {
    // 1. Start from cleared factory
    DataGateway.clearAllForRealFactory();
    expect(PreventiveService.getTasks()).toEqual([]);

    // 2. Add 3 preventive tasks via PreventiveService / DataGateway
    const newTasks = [
      { id: 'T-01', machine: 'DET-05', task_description: 'Inspection courroie', status: 'Pending' },
      { id: 'T-02', machine: 'PCE-01', task_description: 'Graissage palier', status: 'Pending' },
      { id: 'T-03', machine: 'FRL-01', task_description: 'Purge filtre air', status: 'Done' },
    ];
    PreventiveService.saveTasks(newTasks);

    // 3. Verify PreventiveService and DataGateway read the exact 3 tasks
    expect(PreventiveService.getTasks()).toHaveLength(3);
    expect(PreventiveService.getTasks()).toHaveLength(3);

    // 4. Simulate F5 reload via loadCollection
    const afterF5 = loadCollection(STORAGE_KEYS.PREVENTIVE_TASKS, []);
    expect(afterF5).toHaveLength(3);
    expect(afterF5.map((t: any) => t.id)).toEqual(['T-01', 'T-02', 'T-03']);
  });
});
