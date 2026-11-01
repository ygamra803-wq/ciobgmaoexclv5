import { STORAGE_KEYS } from '../infrastructure/persistence/storageKeys';
import { storageService } from '../utils/storageService';
import { useGmaoStore } from '../store/useGmaoStore';
import { Logger } from '../core/logger/LoggerService';

export interface BootEntityItem {
  readonly id: string;
  readonly storageKey: string;
  readonly sheetName: string;
  readonly labelFr: string;
  readonly descriptionFr: string;
}

export type BootEntityStatus = 'pending' | 'loading' | 'ok' | 'empty' | 'error';

export interface BootEntityState {
  id: string;
  status: BootEntityStatus;
  count: number;
  error?: string;
}

export interface StockSampleItem {
  ref: string;
  designation: string;
  stockInitial: number;
  stockActuel: number;
  seuil: number;
}

/**
 * 🏛️ SSOT Boot Manifest
 * Exact real entities mapped to canonical STORAGE_KEYS and real Excel twin sheet names.
 * Strictly avoids non-existent sheets or marketing placeholders.
 */
export const BOOT_MANIFEST: readonly BootEntityItem[] = [
  {
    id: 'zones',
    storageKey: STORAGE_KEYS.ZONES,
    sheetName: 'Zones',
    labelFr: 'Zones & Emplacements',
    descriptionFr: 'Topologie usine et secteurs',
  },
  {
    id: 'machines',
    storageKey: STORAGE_KEYS.MACHINES,
    sheetName: 'Machines_Registered',
    labelFr: 'Machines & Équipements',
    descriptionFr: 'Parc machines et actifs',
  },
  {
    id: 'rawStock',
    storageKey: STORAGE_KEYS.RAW_STOCK,
    sheetName: 'Stock_Actuel',
    labelFr: 'Stock Pièces de Rechange (PDR)',
    descriptionFr: 'Articles, seuils et stocks initiaux',
  },
  {
    id: 'mouvements',
    storageKey: STORAGE_KEYS.MOUVEMENTS,
    sheetName: 'Mouvements',
    labelFr: 'Journal des Mouvements',
    descriptionFr: 'Entrées, sorties et traçabilité',
  },
  {
    id: 'preventiveTasks',
    storageKey: STORAGE_KEYS.PREVENTIVE_TASKS,
    sheetName: 'Preventive_Tasks',
    labelFr: 'Maintenance Préventive',
    descriptionFr: 'Gammes opératoires et périodicités',
  },
  {
    id: 'preventiveExecutions',
    storageKey: STORAGE_KEYS.PREVENTIVE_EXECUTIONS,
    sheetName: 'Preventive_Executions',
    labelFr: 'Historique Préventif',
    descriptionFr: 'Exécutions et validations de gammes',
  },
  {
    id: 'correctiveInterventions',
    storageKey: STORAGE_KEYS.CORRECTIVE_INTERVENTIONS,
    sheetName: 'Corrective_Interventions',
    labelFr: 'Bons de Travail (BT) Correctif',
    descriptionFr: 'Interventions, pannes et arrêts',
  },
  {
    id: 'sortieDemands',
    storageKey: STORAGE_KEYS.SORTIE_DEMANDS,
    sheetName: 'Sortie_Demands',
    labelFr: 'Demandes de Sortie PDR',
    descriptionFr: 'Bons de sortie en attente',
  },
  {
    id: 'warehouseItems',
    storageKey: STORAGE_KEYS.WAREHOUSE_ITEMS,
    sheetName: 'Warehouse_Items',
    labelFr: 'Composants Entrepôt',
    descriptionFr: 'Sous-ensembles et catalogue',
  },
  {
    id: 'sortiesExterne',
    storageKey: STORAGE_KEYS.SORTIE_EXTERNE,
    sheetName: 'Sortie_Externe_Bobinage',
    labelFr: 'Sorties Externes Bobinage',
    descriptionFr: 'Suivi des prestataires extérieurs',
  },
] as const;

/**
 * Inspects a canonical boot entity from the Zustand SSOT or storageService.
 * Returns exact record count and up to 3 sample items (for rawStock) without injecting any demo seeds.
 */
export function inspectBootEntity(item: BootEntityItem): {
  count: number;
  sample?: StockSampleItem[];
} {
  let records: unknown[] = [];

  // Primary: Zustand Master Store (in-memory SSOT)
  try {
    const storeState = useGmaoStore.getState() as unknown as Record<string, unknown>;
    const storeVal = storeState[item.id];
    if (Array.isArray(storeVal)) {
      records = storeVal;
    }
  } catch (err) {
    Logger.debug(`[inspectBootEntity] Zustand store read skipped for ${item.id}`, err);
  }

  // Secondary fallback: storageService canonical storage
  if (records.length === 0) {
    try {
      const saved = storageService.getItem(item.storageKey);
      if (Array.isArray(saved)) {
        records = saved;
      } else if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
        records = Object.values(saved);
      }
    } catch (err) {
      Logger.debug(`[inspectBootEntity] storageService read skipped for ${item.storageKey}`, err);
    }
  }

  const count = records.length;
  let sample: StockSampleItem[] | undefined;

  if (item.id === 'rawStock' && count > 0) {
    sample = (records as any[]).slice(0, 3).map((s) => ({
      ref: String(s.ref || s.code_article || s.id || '').trim(),
      designation: String(s.designation || s.nom || '').trim(),
      stockInitial: Number(s.stockInitial ?? s.qte_initiale ?? 0),
      stockActuel: Number(s.stockActuel ?? s.stockInitial ?? s.qte_initiale ?? 0),
      seuil: Number(s.seuil ?? 0),
    }));
  }

  return { count, sample };
}
