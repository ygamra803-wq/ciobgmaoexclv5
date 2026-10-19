import { useState, useEffect } from 'react';
import { STORAGE_KEYS } from '../infrastructure/persistence/storageKeys';
import { loadCollection } from '../infrastructure/persistence/migrateStorage';
import { DataGateway } from '../application/DataGateway';
import initialMouvements from '../data/movements/seedMouvements.json';
import { safeNum } from '../utils/formulaEngine';

/**
 * Normalizes an individual movement entry ensuring Excel-twin compatibility
 */
export function normalizeMovement(m, idx = 0) {
  return {
    id: m.id || idx + 1,
    code_bon:
      m.code_bon ||
      m['Code_Bon'] ||
      m['Code Bon'] ||
      m['N° Bon'] ||
      `Bon-${String(idx + 1).padStart(3, '0')}`,
    num_commande: (() => {
      const direct =
        m.num_commande ||
        m['N° Commande'] ||
        m['Num_Commande'] ||
        m['N° Demande'] ||
        m['Code Demande'] ||
        m.num_demande ||
        m['N° OT'] ||
        m['Num_OT'] ||
        m['OT'] ||
        m.ot ||
        m.num_ot;
      if (
        direct &&
        String(direct).trim() !== '' &&
        String(direct).trim().toUpperCase() !== 'NULL' &&
        String(direct).trim().toUpperCase() !== 'UNDEFINED'
      ) {
        return String(direct).trim();
      }
      const com = m.commentaire || m['Commentaire / Motif'] || '';
      if (com) {
        const match = String(com).match(
          /\b(OT[-_ ]?[0-9A-Za-z]+|CMD[-_ ]?[0-9A-Za-z]+|BC[-_ ]?[0-9A-Za-z]+|DA[-_ ]?[0-9A-Za-z]+)\b/i
        );
        if (match) return match[1].toUpperCase();
      }
      const mType = m.type || m['Type (Entrée/Sortie)'] || '';
      const mBon = m.code_bon || m['Code_Bon'] || m['Code Bon'] || '';
      if (String(mType).toUpperCase().includes('COMMANDE') && mBon) {
        return `CMD-${String(mBon).replace(/^Bon-/i, '')}`;
      }
      return 'INCONNU';
    })(),
    date:
      m.date || (m.Date ? String(m.Date).split('T')[0] : new Date().toISOString().split('T')[0]),
    ref: m.ref || m['Référence'] || m['Reference'] || '',
    quantite: safeNum(
      m.quantite != null ? m.quantite : m['Quantité'] != null ? m['Quantité'] : m['Quantite'],
      1
    ),
    type: (() => {
      const rawType = m.type || m['Type (Entrée/Sortie)'] || '';
      const str = String(rawType).trim();
      const lower = str.toLowerCase();
      if (!str || lower === 'sortie' || lower === 'sortie interne') return 'Sortie Interne';
      if (lower === 'bon de sortie' || lower === 'sortie externe') return 'Bon de Sortie';
      if (lower === 'entrée interne' || lower === 'entree interne') return 'Entrée Interne';
      if (lower === 'entrée externe' || lower === 'entree externe') return 'Entrée Externe';
      if (lower === 'entrée' || lower === 'entree') {
        const act = String(m.action_id || m['Action_ID'] || '').toUpperCase();
        if (act === 'REAPPRO' || m.fournisseur || m.Fournisseur) return 'Entrée Externe';
        return 'Entrée Interne';
      }
      if (lower.includes('commande') || lower.includes('achat')) return 'COMMANDE';
      if (lower.includes('sort')) return 'Sortie Interne';
      if (lower.includes('entr')) return 'Entrée Interne';
      return str;
    })(),
    action_id: m.action_id || m['Action_ID'] || 'CORRECTIVE',
    technicien: m.technicien || m.id_technician || 'Rachid',
    id_zone: m.id_zone || 'ZONE-01',
    id_machine_registered: m.id_machine_registered || '',
    operation: m.operation || m.id_operation || '',
    commentaire: m.commentaire || m['Commentaire / Motif'] || '',
    demandeur: m.demandeur || m.Demandeur || '',
    fournisseur: m.fournisseur || m.Fournisseur || '',
    emplacement_reception: m.emplacement_reception || m['Emplacement'] || '',
    usage_type: m.usage_type || '',
  };
}

/**
 * Hook managing Movements log and transactions.
 * Enforces SSOT: canonical STORAGE_KEYS.MOUVEMENTS only, no length >= 300 threshold, no silent seed replacement.
 */
export function useMovementSubState(groupedState = {}) {
  const [mouvements, setMouvements] = useState(() => {
    if (Array.isArray(groupedState.mouvements)) {
      return groupedState.mouvements.map((m, idx) => normalizeMovement(m, idx));
    }
    const loaded = loadCollection(STORAGE_KEYS.MOUVEMENTS, {
      allowDemoFallback: true,
      demoSeed: initialMouvements,
    });
    return loaded.map((m, idx) => normalizeMovement(m, idx));
  });

  useEffect(() => {
    DataGateway.saveMouvements(mouvements);
  }, [mouvements]);

  return {
    mouvements,
    setMouvements,
  };
}
