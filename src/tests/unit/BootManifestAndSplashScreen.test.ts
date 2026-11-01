import { describe, it, expect, beforeEach } from 'vitest';
import {
  BOOT_MANIFEST,
  inspectBootEntity,
  type BootEntityItem,
} from '../../application/bootManifest';
import { STORAGE_KEYS } from '../../infrastructure/persistence/storageKeys';
import { storageService } from '../../utils/storageService';
import { useGmaoStore } from '../../store/useGmaoStore';

describe('BOOT_MANIFEST & Boot Inspection (SSOT Discipline)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('contains valid canonical keys from STORAGE_KEYS for all entities', () => {
    const validStorageKeys = new Set(Object.values(STORAGE_KEYS));

    expect(BOOT_MANIFEST.length).toBeGreaterThanOrEqual(9);

    for (const item of BOOT_MANIFEST) {
      expect(validStorageKeys.has(item.storageKey)).toBe(true);
      expect(item.id).toBeTruthy();
      expect(item.labelFr).toBeTruthy();
      expect(item.sheetName).toBeTruthy();
    }
  });

  it('contains at least the mandatory entities requested by the constitution', () => {
    const ids = BOOT_MANIFEST.map((item) => item.id);
    expect(ids).toContain('zones');
    expect(ids).toContain('machines');
    expect(ids).toContain('rawStock');
    expect(ids).toContain('mouvements');
    expect(ids).toContain('preventiveTasks');
    expect(ids).toContain('preventiveExecutions');
    expect(ids).toContain('correctiveInterventions');
    expect(ids).toContain('sortieDemands');
    expect(ids).toContain('warehouseItems');
  });

  it('reports count 0 and empty status without injecting demo seeds when collection is empty', () => {
    // Clear rawStock in Zustand store
    useGmaoStore.getState().setRawStock([]);
    storageService.setItem(STORAGE_KEYS.RAW_STOCK, []);

    const rawStockItem = BOOT_MANIFEST.find((item) => item.id === 'rawStock');
    expect(rawStockItem).toBeDefined();

    const inspection = inspectBootEntity(rawStockItem!);
    expect(inspection.count).toBe(0);
    expect(inspection.sample).toBeUndefined();

    // Verify ZERO silent reinjection
    expect(storageService.getItem(STORAGE_KEYS.RAW_STOCK)).toEqual([]);
  });

  it('correctly extracts count and sample of up to 3 items when rawStock is populated', () => {
    const mockStock = [
      { id: 'ART-1', ref: 'ROUL-6000', designation: 'Roulement standard', stockInitial: 12, stockActuel: 15, seuil: 4 },
      { id: 'ART-2', ref: 'COURR-B52', designation: 'Courroie trapézoïdale', stockInitial: 5, stockActuel: 2, seuil: 3 },
      { id: 'ART-3', ref: 'JOINT-VITON', designation: 'Joint haute température', stockInitial: 20, stockActuel: 18, seuil: 5 },
      { id: 'ART-4', ref: 'FILTRE-AIR', designation: 'Filtre compresseur', stockInitial: 8, stockActuel: 8, seuil: 2 },
    ];

    useGmaoStore.getState().setRawStock(mockStock as any);

    const rawStockItem = BOOT_MANIFEST.find((item) => item.id === 'rawStock')!;
    const inspection = inspectBootEntity(rawStockItem);

    expect(inspection.count).toBe(4);
    expect(inspection.sample).toBeDefined();
    expect(inspection.sample?.length).toBe(3);
    expect(inspection.sample?.[0].ref).toBe('ROUL-6000');
    expect(inspection.sample?.[1].ref).toBe('COURR-B52');
    expect(inspection.sample?.[2].ref).toBe('JOINT-VITON');
  });
});
