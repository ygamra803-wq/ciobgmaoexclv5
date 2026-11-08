// src/application/services/SortieExterneService.js
// SERVICE SORTIE EXTERNE BOBINAGE & REPARATION
// ARCHITECTURE: ref (Coordonnées externes / Bon bobinier) | code (Adresse interne SORT-EXT-xxx) | id (Passeport unique complet)

import { Logger } from '../../core/logger/LoggerService';
import { storageService } from '../../utils/storageService';
import { STORAGE_KEYS } from '../../infrastructure/persistence/storageKeys';
import { loadCollection } from '../../infrastructure/persistence/migrateStorage';
import initialSorties from '../../data/movements/seedSortiesExternes.json';

const STORAGE_KEY = STORAGE_KEYS.SORTIE_EXTERNE;

// Seed Initial issu des archives de l'usine
export const INITIAL_SORTIES_BOBINAGE = initialSorties;

export class SortieExterneService {
  /**
   * Charge la liste des sorties depuis storageService ou le seed démo si activé
   */
  static getSorties() {
    return loadCollection(STORAGE_KEY, {
      allowDemoFallback: false,
      demoSeed: [],
    });
  }

  /**
   * Sauvegarde les données dans le stockage
   */
  static saveSorties(sorties) {
    try {
      storageService.setItem(STORAGE_KEY, sorties);
    } catch (e) {
      Logger.error('Erreur sauvegarde sorties externes:', e);
    }
  }

  /**
   * Génère le prochain code interne (SORT-EXT-001 ou BON-ATEL-001 selon categorieFlux)
   */
  static getNextCode(existingSorties?: any[], categorieFlux = 'SOUS_TRAITANCE_EXTERNE') {
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

  /**
   * Vérifie si un bon d'atelier / sortie externe est encore ouvert (non réceptionné et non monté).
   */
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
   * Vérifie si un bon d'atelier / sortie externe est terminé (réceptionné OK ou monté sur machine)
   * et permet donc la clôture définitive du Bon de Travail (BT) parent.
   */
  static isWorkshopOrderReadyForClosure(etat?: string | null): boolean {
    return !this.isWorkshopOrderOpen(etat);
  }

  /**
   * Retourne tous les bons d'atelier / sorties externes rattachés à un Bon de Travail (BT).
   */
  static getLinkedOrdersForBt(btOrId: any, existingList?: any[]): any[] {
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
        (sId && keys.has(sId)) ||
        (sCode && keys.has(sCode)) ||
        (sBt && keys.has(sBt))
      );
    });
  }

  /**
   * Construit le Passport ID unique selon la philosophie convenue:
   * ID-SORT-EXT-{SEQ}-{MACHINE}-{MOTEUR}-{REF}-{FOURNISSEUR}
   */
  static generatePassportId({ code, machine, moteurReel, refMoteur, fournisseur }) {
    const cleanCode = String(code || 'SORT-EXT-000').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const cleanMach = String(machine || 'NOMACH').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const cleanMot = String(moteurReel || 'NOMOT').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const cleanRef = String(refMoteur || 'NOREF').substring(0, 10).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const cleanFourn = String(fournisseur || 'EXT').substring(0, 10).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    return `ID-${cleanCode}-${cleanMach}-${cleanMot}-${cleanRef}-${cleanFourn}`;
  }

  /**
   * Ajoute une nouvelle sortie externe bobinage ou bon d'atelier mécanique (rectification / usinage)
   */
  static addSortie(payload, existingList?: any[]) {
    const currentList = Array.isArray(existingList) ? [...existingList] : this.getSorties();
    const categorieFlux =
      String(payload?.categorie_flux || '').trim().toUpperCase() === 'ATELIER_MECANIQUE'
        ? 'ATELIER_MECANIQUE'
        : 'SOUS_TRAITANCE_EXTERNE';
    const isAtelier = categorieFlux === 'ATELIER_MECANIQUE';

    const code = payload.code || this.getNextCode(currentList, categorieFlux);
    const organeCode =
      payload.code_moteur_reel ||
      payload.id_composant ||
      payload.id_part ||
      (isAtelier ? 'ORG-MECA-01' : 'mot 01');
    const prestataire =
      payload.fournisseur_externe ||
      (isAtelier ? 'Atelier Mécanique Interne' : 'Bobinage Casa');

    const id =
      payload.id ||
      this.generatePassportId({
        code,
        machine: payload.id_machine,
        moteurReel: organeCode,
        refMoteur: payload.ref_moteur || payload.nature_travail,
        fournisseur: prestataire,
      });

    const now = new Date().toISOString();
    const defaultEtat = isAtelier ? 'En cours atelier' : 'En réparation externe';
    const newEntry = {
      id,
      code,
      categorie_flux: categorieFlux,
      nature_travail:
        payload.nature_travail ||
        (isAtelier ? 'Rectification / Usinage' : 'Bobinage & Révision'),
      ref:
        payload.ref ||
        `${isAtelier ? 'BA' : 'BS'}-${new Date().getFullYear()}-${String(
          Math.floor(Math.random() * 900) + 100
        )}`,
      id_machine: payload.id_machine || 'DET-01',
      code_moteur_reel: organeCode,
      id_composant: payload.id_composant || '',
      id_part: payload.id_part || '',
      id_groupe: payload.id_groupe || (isAtelier ? 'GRP-MECA-001' : 'GRP-MOTEUR-001'),
      id_family: payload.id_family || (isAtelier ? 'FAM-ORGANE-MECA-001' : 'FAM-MOTEUR-ELEC-001'),
      id_template: payload.id_template || (isAtelier ? 'TPL-MECA-STD-001' : 'TPL-MOT-ASYNC-001'),
      ref_moteur: payload.ref_moteur || '',
      designation_moteur: payload.designation_moteur || '',
      date_demontage: payload.date_demontage || new Date().toISOString().split('T')[0],
      technicien_demontage: payload.technicien_demontage || '',
      type_probleme: payload.type_probleme || (isAtelier ? 'usinage / rectification' : 'grille'),
      observation_probleme: payload.observation_probleme || '',
      date_expedition: payload.date_expedition || new Date().toISOString().split('T')[0],
      fournisseur_externe: prestataire,
      date_arrivee_prevue: payload.date_arrivee_prevue || '',
      date_arrivee_reelle: payload.date_arrivee_reelle || null,
      technicien_montage: payload.technicien_montage || null,
      date_montage: payload.date_montage || null,
      etat: payload.etat || defaultEtat,
      cout_bobinage: Number(payload.cout_bobinage ?? payload.cout_atelier) || 0,
      duree_usinage_heures: Number(payload.duree_usinage_heures) || 0,
      note: payload.note || '',
      id_corrective: payload.id_corrective || '',
      created_at: now,
      updated_at: now,
    };

    const updated = [newEntry, ...currentList];
    this.saveSorties(updated);
    return newEntry;
  }

  /**
   * Met à jour un enregistrement existant
   */
  static updateSortie(id, updates, existingList?: any[]) {
    const currentList = Array.isArray(existingList) ? [...existingList] : this.getSorties();
    const index = currentList.findIndex((s) => s.id === id);
    if (index === -1) return null;

    const updatedRecord = {
      ...currentList[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };

    currentList[index] = updatedRecord;
    this.saveSorties(currentList);
    return updatedRecord;
  }

  /**
   * Marque une sortie comme "Retourné OK" avec date de retour réelle et coût final
   */
  static markAsReturned(id, returnDataOrCost: any = {}, existingList?: any[]) {
    const opts =
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

  /**
   * Marque le moteur / organe comme remonté sur sa machine
   */
  static markAsMounted(id, { technicien_montage, date_montage, id_machine_cible, note }, existingList?: any[]) {
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

  /**
   * Supprime une sortie
   */
  static deleteSortie(id, existingList?: any[]) {
    const currentList = Array.isArray(existingList) ? existingList : this.getSorties();
    const filtered = currentList.filter((s) => s.id !== id);
    this.saveSorties(filtered);
    return filtered;
  }

  /**
   * Vide toutes les sorties externes (pour usine réelle)
   */
  static clearAll() {
    this.saveSorties([]);
    return [];
  }

  /**
   * Réinitialise les sorties externes avec l'archive de base
   */
  static resetToBaseline() {
    const baseline = Array.isArray(INITIAL_SORTIES_BOBINAGE) ? [...INITIAL_SORTIES_BOBINAGE] : [];
    this.saveSorties(baseline);
    return baseline;
  }

  /**
   * Synchronise automatiquement l'état du moteur/composant dans warehouseItems
   * ainsi que son historique_bobinage lors d'une sortie externe, d'un retour ou d'un remontage.
   */
  static syncWarehouseItemsWithSortie(warehouseItems: any[] = [], sortieRecord: any): any[] {
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
      const existingHistory = Array.isArray(item.historique_bobinage) ? [...item.historique_bobinage] : [];
      const historyEntry = {
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
        (h: any) => h && (h.id_sortie === sortieRecord.id || h.code_sortie === sortieRecord.code)
      );
      if (histIdx !== -1) {
        existingHistory[histIdx] = { ...existingHistory[histIdx], ...historyEntry };
      } else {
        existingHistory.unshift(historyEntry);
      }

      const etatUpper = String(sortieRecord.etat || '').trim().toUpperCase();
      if (etatUpper.includes('MONTE') || etatUpper.includes('MONTÉ')) {
        const targetMachine = sortieRecord.id_machine || item.id_machine_registered || item.id_machine;
        return {
          ...item,
          rattachement_type: 'MACHINE',
          id_machine: targetMachine,
          id_machine_registered: targetMachine,
          emplacement: targetMachine,
          status: 'Actif',
          statut: 'Actif',
          etat: 'Actif',
          technician: sortieRecord.technicien_montage || item.technician,
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
          rattachement_type: 'STOCK',
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

  /**
   * Calcule les KPIs en direct pour le tableau de bord
   */
  static getStats(sortiesList = []) {
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
