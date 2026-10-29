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

class SortieExterneService {
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
   * Génère le prochain code interne (SORT-EXT-001, SORT-EXT-002, ...)
   */
  static getNextCode(existingSorties = []) {
    const list = existingSorties.length > 0 ? existingSorties : this.getSorties();
    let maxSeq = 0;
    list.forEach((s) => {
      const m = String(s.code || '').match(/SORT-EXT-(\d+)/i);
      if (m && m[1]) {
        const val = parseInt(m[1], 10);
        if (val > maxSeq) maxSeq = val;
      }
    });
    const nextSeq = maxSeq + 1;
    return `SORT-EXT-${String(nextSeq).padStart(3, '0')}`;
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
   * Ajoute une nouvelle sortie externe bobinage
   */
  static addSortie(payload) {
    const currentList = this.getSorties();
    const code = payload.code || this.getNextCode(currentList);
    const id = payload.id || this.generatePassportId({
      code,
      machine: payload.id_machine,
      moteurReel: payload.code_moteur_reel,
      refMoteur: payload.ref_moteur,
      fournisseur: payload.fournisseur_externe,
    });

    const now = new Date().toISOString();
    const newEntry = {
      id,
      code,
      ref: payload.ref || `BS-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`,
      id_machine: payload.id_machine || 'DET-01',
      code_moteur_reel: payload.code_moteur_reel || 'mot 01',
      id_groupe: payload.id_groupe || 'GRP-MOTEUR-001',
      id_family: payload.id_family || 'FAM-MOTEUR-ELEC-001',
      id_template: payload.id_template || 'TPL-MOT-ASYNC-001',
      ref_moteur: payload.ref_moteur || '',
      designation_moteur: payload.designation_moteur || '',
      date_demontage: payload.date_demontage || new Date().toISOString().split('T')[0],
      technicien_demontage: payload.technicien_demontage || '',
      type_probleme: payload.type_probleme || 'grille',
      observation_probleme: payload.observation_probleme || '',
      date_expedition: payload.date_expedition || new Date().toISOString().split('T')[0],
      fournisseur_externe: payload.fournisseur_externe || 'Bobinage Casa',
      date_arrivee_prevue: payload.date_arrivee_prevue || '',
      date_arrivee_reelle: payload.date_arrivee_reelle || null,
      technicien_montage: payload.technicien_montage || null,
      date_montage: payload.date_montage || null,
      etat: payload.etat || 'En réparation externe',
      cout_bobinage: Number(payload.cout_bobinage) || 0,
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
  static updateSortie(id, updates) {
    const currentList = this.getSorties();
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
  static markAsReturned(id, { date_arrivee_reelle, cout_bobinage, note, technicien_reception }) {
    return this.updateSortie(id, {
      etat: 'Retourné OK',
      date_arrivee_reelle: date_arrivee_reelle || new Date().toISOString().split('T')[0],
      cout_bobinage: cout_bobinage !== undefined ? Number(cout_bobinage) : undefined,
      note: note || 'Retour atelier contrôlé OK',
      technicien_reception: technicien_reception || '',
    });
  }

  /**
   * Marque le moteur comme remonté sur sa machine
   */
  static markAsMounted(id, { technicien_montage, date_montage, id_machine_cible, note }) {
    return this.updateSortie(id, {
      etat: 'Monté',
      technicien_montage: technicien_montage || 'Ismaayl',
      date_montage: date_montage || new Date().toISOString().split('T')[0],
      id_machine: id_machine_cible || undefined,
      note: note || 'Moteur remonté et testé en charge OK',
    });
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

      if (etatUpper.includes('RETOURNE') || etatUpper.includes('RETOURNÉ') || etatUpper.includes('STOCK')) {
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
    const enCours = list.filter((s) => s.etat === 'En réparation externe').length;
    const retournes = list.filter((s) => s.etat === 'Retourné OK').length;
    const montes = list.filter((s) => s.etat === 'Monté' || s.etat === 'En stock').length;
    const totalCout = list.reduce((sum, s) => sum + (Number(s.cout_bobinage) || 0), 0);

    return {
      total,
      enCours,
      retournes,
      montes,
      totalCout,
    };
  }
}

export default SortieExterneService;
