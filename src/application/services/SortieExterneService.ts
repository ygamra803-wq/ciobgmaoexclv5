/**
 * Application service for External Subcontracting (Bobinage / Repair) and Internal
 * Mechanical Workshop Orders (`BON-ATEL-*` / `SORT-EXT-*`).
 *
 * Identifier model:
 *  - `ref`: External slip / bobinage vendor reference (`BS-*` / `BA-*`)
 *  - `code`: Internal sequence code (`SORT-EXT-xxx` or `BON-ATEL-xxx`)
 *  - `id`: Deterministic asset-movement passport (`ID-SORT-EXT-{SEQ}-{MACHINE}-{ORGANE}-...`)
 */

import { Logger } from '../../core/logger/LoggerService';
import { storageService } from '../../utils/storageService';
import { STORAGE_KEYS } from '../../infrastructure/persistence/storageKeys';
import { loadCollection } from '../../infrastructure/persistence/migrateStorage';
import initialSorties from '../../data/movements/seedSortiesExternes.json';
import type { SortieExterneItem, SortieMountedPayload } from '../../types/store';

const STORAGE_KEY = STORAGE_KEYS.SORTIE_EXTERNE;

export const INITIAL_SORTIES_BOBINAGE: SortieExterneItem[] =
  initialSorties as unknown as SortieExterneItem[];

export interface SortieWarehouseItemLike {
  id?: string | number;
  id_warehouse_item?: string;
  code?: string;
  designation?: string;
  nom?: string;
  rattachement_type?: 'MACHINE' | 'STOCK' | string;
  id_machine?: string;
  id_machine_registered?: string;
  emplacement?: string;
  status?: string;
  statut?: string;
  etat?: string;
  technician?: string;
  historique_bobinage?: Array<Record<string, unknown>>;
  updated_at?: string;
  [key: string]: unknown;
}

export interface SortieBtReference {
  id?: string | number;
  num_bt?: string;
  code_bt?: string;
  id_sortie_atelier?: string;
  code_sortie_atelier?: string;
  [key: string]: unknown;
}

export interface SortieReturnInput {
  date_arrivee_reelle?: string;
  cout_bobinage?: number;
  note?: string;
  technicien_reception?: string;
  [key: string]: unknown;
}

export interface SortieStatsSummary {
  total: number;
  enCours: number;
  retournes: number;
  montes: number;
  atelierCount: number;
  externeCount: number;
  totalCout: number;
}

export class SortieExterneService {
  /** Loads external/workshop orders from canonical storage without silent seed reinjection. */
  static getSorties(): SortieExterneItem[] {
    return loadCollection<SortieExterneItem[]>(STORAGE_KEY, {
      allowDemoFallback: false,
      demoSeed: [],
    });
  }

  /** Persists external/workshop orders to canonical storage. */
  static saveSorties(sorties: SortieExterneItem[]): void {
    try {
      storageService.setItem(STORAGE_KEY, sorties);
    } catch (e) {
      Logger.error('Erreur sauvegarde sorties externes:', e);
    }
  }

  /** Generates the next sequential internal code (`SORT-EXT-xxx` or `BON-ATEL-xxx`). */
  static getNextCode(
    existingSorties?: SortieExterneItem[],
    categorieFlux = 'SOUS_TRAITANCE_EXTERNE'
  ): string {
    const list = Array.isArray(existingSorties) ? existingSorties : this.getSorties();
    const isAtelier = String(categorieFlux || '').trim().toUpperCase() === 'ATELIER_MECANIQUE';
    const prefix = isAtelier ? 'BON-ATEL' : 'SORT-EXT';
    const regex = isAtelier ? /BON-ATEL-(\d+)/i : /SORT-EXT-(\d+)/i;

    let maxSeq = 0;
    list.forEach((s) => {
      const m = String(s.code || '').match(regex);
      if (m && m[1]) {
        const val = parseInt(m[1], 10);
        if (val > maxSeq) maxSeq = val;
      }
    });
    const nextSeq = maxSeq + 1;
    return `${prefix}-${String(nextSeq).padStart(3, '0')}`;
  }

  /** Returns true while the external/workshop dossier is still active (not returned, mounted, scrapped, or closed). */
  static isWorkshopOrderOpen(etat?: string | null): boolean {
    const norm = String(etat || '')
      .trim()
      .toUpperCase();
    if (!norm) return true;
    if (
      norm.includes('RETOURNE') ||
      norm.includes('RETOURNÉ') ||
      norm.includes('TERMINE') ||
      norm.includes('TERMINÉ') ||
      norm.includes('MONTE') ||
      norm.includes('MONTÉ') ||
      norm.includes('STOCK') ||
      norm.includes('CLOTURE') ||
      norm.includes('REFORME') ||
      norm.includes('RÉFORMÉ')
    ) {
      return false;
    }
    return true;
  }

  /**
   * Checks whether a linked external/workshop order has reached a terminal state (`Retourné OK`,
   * `Monté`, `Stock`, `Clôturé`, or `Réformé`), unblocking parent Work Order (`BT`) closure.
   */
  static isWorkshopOrderReadyForClosure(etat?: string | null): boolean {
    return !this.isWorkshopOrderOpen(etat);
  }

  /** Returns all external/workshop orders linked to a given Work Order (`BT`) ID or code. */
  static getLinkedOrdersForBt(
    btOrId: string | SortieBtReference | null | undefined,
    existingList?: SortieExterneItem[]
  ): SortieExterneItem[] {
    const list = Array.isArray(existingList) ? existingList : this.getSorties();
    if (!btOrId || !Array.isArray(list) || list.length === 0) return [];

    const keys = new Set<string>();
    if (typeof btOrId === 'string') {
      const k = btOrId.trim().toUpperCase();
      if (k) keys.add(k);
    } else if (typeof btOrId === 'object') {
      [
        btOrId.id,
        btOrId.num_bt,
        btOrId.code_bt,
        btOrId.id_sortie_atelier,
        btOrId.code_sortie_atelier,
      ].forEach((val) => {
        const clean = String(val || '').trim().toUpperCase();
        if (clean) keys.add(clean);
      });
    }

    if (keys.size === 0) return [];

    return list.filter((s) => {
      if (!s || typeof s !== 'object') return false;
      const sId = String(s.id || '').trim().toUpperCase();
      const sCode = String(s.code || '').trim().toUpperCase();
      const sBt = String(s.id_corrective || '').trim().toUpperCase();
      return (
        (Boolean(sId) && keys.has(sId)) ||
        (Boolean(sCode) && keys.has(sCode)) ||
        (Boolean(sBt) && keys.has(sBt))
      );
    });
  }

  /**
   * Builds a deterministic Passport ID encoding code, machine, component, reference, and vendor:
   * `ID-SORT-EXT-{SEQ}-{MACHINE}-{ORGANE}-{REF}-{FOURNISSEUR}`.
   */
  static generatePassportId({
    code,
    machine,
    moteurReel,
    refMoteur,
    fournisseur,
  }: {
    code?: string;
    machine?: string;
    moteurReel?: string;
    refMoteur?: string;
    fournisseur?: string;
  }): string {
    const cleanCode = String(code || 'SORT-EXT-000').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const cleanMach = String(machine || 'NOMACH').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const cleanMot = String(moteurReel || 'NOMOT').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const cleanRef = String(refMoteur || 'NOREF').substring(0, 10).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const cleanFourn = String(fournisseur || 'EXT').substring(0, 10).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    return `ID-${cleanCode}-${cleanMach}-${cleanMot}-${cleanRef}-${cleanFourn}`;
  }

  /** Creates and persists a new external repair or internal mechanical workshop order. */
  static addSortie(
    payload: Partial<SortieExterneItem> & Record<string, unknown>,
    existingList?: SortieExterneItem[]
  ): SortieExterneItem {
    const currentList = Array.isArray(existingList) ? [...existingList] : this.getSorties();
    const categorieFlux =
      String(payload?.categorie_flux || '').trim().toUpperCase() === 'ATELIER_MECANIQUE'
        ? 'ATELIER_MECANIQUE'
        : 'SOUS_TRAITANCE_EXTERNE';
    const isAtelier = categorieFlux === 'ATELIER_MECANIQUE';

    const code = String(payload.code || this.getNextCode(currentList, categorieFlux));
    const organeCode = String(
      payload.code_moteur_reel ||
        payload.id_composant ||
        payload.id_part ||
        (isAtelier ? 'ORG-MECA-01' : 'mot 01')
    );
    const prestataire = String(
      payload.fournisseur_externe ||
        (isAtelier ? 'Atelier Mécanique Interne' : 'Bobinage Casa')
    );

    const id = String(
      payload.id ||
        this.generatePassportId({
          code,
          machine: typeof payload.id_machine === 'string' ? payload.id_machine : undefined,
          moteurReel: organeCode,
          refMoteur: String(payload.ref_moteur || payload.nature_travail || ''),
          fournisseur: prestataire,
        })
    );

    const now = new Date().toISOString();
    const defaultEtat = isAtelier ? 'En cours atelier' : 'En réparation externe';
    const newEntry: SortieExterneItem = {
      id,
      code,
      categorie_flux: categorieFlux,
      nature_travail: String(
        payload.nature_travail ||
          (isAtelier ? 'Rectification / Usinage' : 'Bobinage & Révision')
      ),
      ref: String(
        payload.ref ||
          `${isAtelier ? 'BA' : 'BS'}-${new Date().getFullYear()}-${String(
            Math.floor(Math.random() * 900) + 100
          )}`
      ),
      id_machine: String(payload.id_machine || 'DET-01'),
      code_moteur_reel: organeCode,
      id_composant: String(payload.id_composant || ''),
      id_part: String(payload.id_part || ''),
      id_groupe: String(payload.id_groupe || (isAtelier ? 'GRP-MECA-001' : 'GRP-MOTEUR-001')),
      id_family: String(
        payload.id_family || (isAtelier ? 'FAM-ORGANE-MECA-001' : 'FAM-MOTEUR-ELEC-001')
      ),
      id_template: String(
        payload.id_template || (isAtelier ? 'TPL-MECA-STD-001' : 'TPL-MOT-ASYNC-001')
      ),
      ref_moteur: String(payload.ref_moteur || ''),
      designation_moteur: String(payload.designation_moteur || ''),
      date_demontage: String(payload.date_demontage || new Date().toISOString().split('T')[0]),
      technicien_demontage: String(payload.technicien_demontage || ''),
      type_probleme: String(
        payload.type_probleme || (isAtelier ? 'usinage / rectification' : 'grille')
      ),
      observation_probleme: String(payload.observation_probleme || ''),
      date_expedition: String(payload.date_expedition || new Date().toISOString().split('T')[0]),
      fournisseur_externe: prestataire,
      date_arrivee_prevue: String(payload.date_arrivee_prevue || ''),
      date_arrivee_reelle: (payload.date_arrivee_reelle as string | null) ?? null,
      technicien_montage: (payload.technicien_montage as string | null) ?? null,
      date_montage: (payload.date_montage as string | null) ?? null,
      etat: String(payload.etat || defaultEtat),
      cout_bobinage: Number(payload.cout_bobinage ?? payload.cout_atelier) || 0,
      duree_usinage_heures: Number(payload.duree_usinage_heures) || 0,
      note: String(payload.note || ''),
      id_corrective: String(payload.id_corrective || ''),
      created_at: now,
      updated_at: now,
    };

    const updated = [newEntry, ...currentList];
    this.saveSorties(updated);
    return newEntry;
  }

  /** Updates an existing external/workshop dossier by ID and persists the updated list. */
  static updateSortie(
    id: string | number,
    updates: Partial<SortieExterneItem> & Record<string, unknown>,
    existingList?: SortieExterneItem[]
  ): SortieExterneItem | null {
    const currentList = Array.isArray(existingList) ? [...existingList] : this.getSorties();
    const index = currentList.findIndex((s) => s.id === id);
    if (index === -1) return null;

    const updatedRecord: SortieExterneItem = {
      ...currentList[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };

    currentList[index] = updatedRecord;
    this.saveSorties(currentList);
    return updatedRecord;
  }

  /** Marks an order as `Retourné OK` with arrival date, final repair cost, and reception technician. */
  static markAsReturned(
    id: string | number,
    returnDataOrCost: number | SortieReturnInput = {},
    existingList?: SortieExterneItem[]
  ): SortieExterneItem | null {
    const opts: SortieReturnInput =
      typeof returnDataOrCost === 'number'
        ? { cout_bobinage: returnDataOrCost }
        : returnDataOrCost || {};
    const { date_arrivee_reelle, cout_bobinage, note, technicien_reception } = opts;
    return this.updateSortie(
      id,
      {
        etat: 'Retourné OK',
        date_arrivee_reelle: date_arrivee_reelle || new Date().toISOString().split('T')[0],
        cout_bobinage: cout_bobinage !== undefined ? Number(cout_bobinage) : undefined,
        note: note || 'Retour atelier contrôlé OK',
        technicien_reception: technicien_reception || '',
      },
      existingList
    );
  }

  /** Marks a repaired motor/organ as remounted on the target machine after load verification. */
  static markAsMounted(
    id: string | number,
    { technicien_montage, date_montage, id_machine_cible, note }: SortieMountedPayload,
    existingList?: SortieExterneItem[]
  ): SortieExterneItem | null {
    return this.updateSortie(
      id,
      {
        etat: 'Monté',
        technicien_montage: technicien_montage || 'Ismaayl',
        date_montage: date_montage || new Date().toISOString().split('T')[0],
        id_machine: id_machine_cible || undefined,
        note: note || 'Organe remonté et testé en charge OK',
      },
      existingList
    );
  }

  /** Deletes an external/workshop order by ID and persists the remaining list. */
  static deleteSortie(
    id: string | number,
    existingList?: SortieExterneItem[]
  ): SortieExterneItem[] {
    const currentList = Array.isArray(existingList) ? existingList : this.getSorties();
    const filtered = currentList.filter((s) => s.id !== id);
    this.saveSorties(filtered);
    return filtered;
  }

  /** Clears all external/workshop orders for clean factory initialization. */
  static clearAll(): SortieExterneItem[] {
    this.saveSorties([]);
    return [];
  }

  /** Restores baseline seed archive orders when explicitly requested by admin. */
  static resetToBaseline(): SortieExterneItem[] {
    const baseline = Array.isArray(INITIAL_SORTIES_BOBINAGE) ? [...INITIAL_SORTIES_BOBINAGE] : [];
    this.saveSorties(baseline);
    return baseline;
  }

  /**
   * Synchronizes the physical motor/component attachment (`MACHINE` vs `STOCK`) and its
   * `historique_bobinage` repair timeline inside `warehouseItems` when a sortie changes state.
   */
  static syncWarehouseItemsWithSortie<
    TWarehouse extends SortieWarehouseItemLike = SortieWarehouseItemLike,
  >(
    warehouseItems: TWarehouse[] = [],
    sortieRecord?: SortieExterneItem | null
  ): TWarehouse[] {
    if (!Array.isArray(warehouseItems) || !sortieRecord || typeof sortieRecord !== 'object') {
      return warehouseItems;
    }

    const motorCode = String(sortieRecord.code_moteur_reel || '').trim().toLowerCase();
    if (!motorCode) return warehouseItems;

    let changed = false;
    const nextList = warehouseItems.map((item) => {
      if (!item || typeof item !== 'object') return item;
      const itemCode = String(item.id_warehouse_item || item.code || '').trim().toLowerCase();
      if (itemCode !== motorCode) return item;

      changed = true;
      const existingHistory: Array<Record<string, unknown>> = Array.isArray(item.historique_bobinage)
        ? [...item.historique_bobinage]
        : [];
      const historyEntry: Record<string, unknown> = {
        id_sortie: sortieRecord.id,
        code_sortie: sortieRecord.code,
        bon_ref: sortieRecord.ref,
        id_machine: sortieRecord.id_machine,
        fournisseur: sortieRecord.fournisseur_externe,
        type_probleme: sortieRecord.type_probleme,
        date_expedition: sortieRecord.date_expedition,
        date_arrivee_reelle: sortieRecord.date_arrivee_reelle || null,
        date_montage: sortieRecord.date_montage || null,
        etat: sortieRecord.etat,
        cout_bobinage: Number(sortieRecord.cout_bobinage) || 0,
        note: sortieRecord.note || '',
      };

      const histIdx = existingHistory.findIndex(
        (h) => h && (h.id_sortie === sortieRecord.id || h.code_sortie === sortieRecord.code)
      );
      if (histIdx !== -1) {
        existingHistory[histIdx] = { ...existingHistory[histIdx], ...historyEntry };
      } else {
        existingHistory.unshift(historyEntry);
      }

      const etatUpper = String(sortieRecord.etat || '').trim().toUpperCase();
      if (etatUpper.includes('MONTE') || etatUpper.includes('MONTÉ')) {
        const targetMachine = String(
          sortieRecord.id_machine || item.id_machine_registered || item.id_machine || ''
        );
        return {
          ...item,
          rattachement_type: 'MACHINE' as const,
          id_machine: targetMachine,
          id_machine_registered: targetMachine,
          emplacement: targetMachine,
          status: 'Actif',
          statut: 'Actif',
          etat: 'Actif',
          technician: String(sortieRecord.technicien_montage || item.technician || ''),
          historique_bobinage: existingHistory,
          updated_at: new Date().toISOString(),
        };
      }

      if (
        etatUpper.includes('RETOURNE') ||
        etatUpper.includes('RETOURNÉ') ||
        etatUpper.includes('TERMINE') ||
        etatUpper.includes('TERMINÉ') ||
        etatUpper.includes('STOCK')
      ) {
        return {
          ...item,
          rattachement_type: 'STOCK' as const,
          status: 'Retourné OK',
          statut: 'Retourné OK',
          etat: 'Retourné OK',
          historique_bobinage: existingHistory,
          updated_at: new Date().toISOString(),
        };
      }

      return {
        ...item,
        status: 'En réparation externe',
        statut: 'En réparation externe',
        etat: 'En réparation externe',
        historique_bobinage: existingHistory,
        updated_at: new Date().toISOString(),
      };
    });

    return changed ? nextList : warehouseItems;
  }

  /** Computes live KPI summary counters for the external subcontracting / workshop dashboard. */
  static getStats(sortiesList: SortieExterneItem[] = []): SortieStatsSummary {
    const list = sortiesList.length > 0 ? sortiesList : this.getSorties();
    const total = list.length;
    const enCours = list.filter((s) => this.isWorkshopOrderOpen(s.etat)).length;
    const retournes = list.filter(
      (s) => s.etat === 'Retourné OK' || s.etat === 'Terminé Atelier OK'
    ).length;
    const montes = list.filter((s) => s.etat === 'Monté' || s.etat === 'En stock').length;
    const atelierCount = list.filter(
      (s) =>
        String(s.categorie_flux || '').toUpperCase() === 'ATELIER_MECANIQUE' ||
        String(s.code || '').toUpperCase().startsWith('BON-ATEL')
    ).length;
    const externeCount = total - atelierCount;
    const totalCout = list.reduce((sum, s) => sum + (Number(s.cout_bobinage) || 0), 0);

    return {
      total,
      enCours,
      retournes,
      montes,
      atelierCount,
      externeCount,
      totalCout,
    };
  }
}

export default SortieExterneService;
