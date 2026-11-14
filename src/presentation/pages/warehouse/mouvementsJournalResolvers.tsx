import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import type {
  IMachine,
  IMouvement,
  IOperation,
  IStockItem,
  ITechnician,
  IWarehouseItem,
  IZone,
} from '../../../types/domain';

export type JournalMovementInput = Partial<IMouvement> & {
  num_commande?: string;
  source_category?: string;
  id_type?: string;
  demandeur?: string;
  prestataire_externe?: string;
  prestataire?: string;
  stock_avant?: number;
  stock_apres?: number;
  seuil_min?: number;
  unit?: string;
};

export interface JournalStockArticleOption extends Partial<IStockItem> {
  id_article?: string;
}

export interface JournalWarehouseItemOption extends Partial<IWarehouseItem> {
  seuil?: number;
}

export interface JournalMachineOption extends Partial<IMachine> {
  id_zone?: string;
}

export interface JournalLookupContext {
  stockItems?: JournalStockArticleOption[];
  warehouseItems?: JournalWarehouseItemOption[];
  machines?: JournalMachineOption[];
  zones?: Array<Partial<IZone>>;
  technicians?: Array<Partial<ITechnician>>;
  operations?: Array<Partial<IOperation>>;
}

export interface TableFilterOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string;
}

export interface TableFilterSelectProps {
  value: string;
  onChange: (value: string) => void;
  options?: TableFilterOption[];
  icon?: React.ReactNode;
  className?: string;
}

/**
 * Smart OT / Commande resolver:
 * Fallback to INCONNU if empty, null, undefined or whitespace
 */
export const getSmartOtCommande = (m: JournalMovementInput = {}) => {
  if (!m) return 'INCONNU';
  const val = m.num_commande != null ? String(m.num_commande).trim() : '';
  if (val === '' || val.toUpperCase() === 'NULL' || val.toUpperCase() === 'UNDEFINED') {
    return 'INCONNU';
  }
  return val;
};

/**
 * Smart Flux Type Resolver (Column B)
 */
export const getSmartFluxType = (m: JournalMovementInput = {}) => {
  if (!m) return 'Sortie Interne';
  const rawType = String(m.type || '').trim();
  const rawAction = String(m.action_id || '').toUpperCase();

  if (rawType === 'COMMANDE' || rawAction === 'ACHAT_DIRECT' || rawAction === 'COMMANDE') {
    return 'COMMANDE';
  }
  if (
    rawType === 'Bon de Sortie' ||
    rawType === 'Sortie Externe' ||
    rawAction === 'REPARATION_EXTERNE' ||
    rawAction === 'ETALONNAGE_CONTROLE' ||
    rawAction === 'GARANTIE_ECHANGE'
  ) {
    return 'Bon de Sortie';
  }
  if (rawType.toLowerCase().includes('entrée') || rawType.toLowerCase().includes('entree')) {
    if (rawAction === 'REAPPRO' || m.fournisseur) {
      return 'Entrée Externe';
    }
    return 'Entrée Interne';
  }
  if (rawType.toLowerCase().includes('sortie')) {
    return 'Sortie Interne';
  }
  return rawType || 'Sortie Interne';
};

/**
 * Smart Article Info Resolver (Column D)
 */
export const resolveArticleInfo = (
  m: JournalMovementInput = {},
  { stockItems = [], warehouseItems = [] }: Pick<JournalLookupContext, 'stockItems' | 'warehouseItems'> = {}
) => {
  const rawRef = String(m.ref || '').trim();

  // Source category identification
  const sourceCat =
    m.source_category ||
    (rawRef.startsWith('MCH-') || rawRef.startsWith('PARTIE-') || rawRef.startsWith('MOT-') || rawRef.startsWith('POM-')
      ? 'WAREHOUSE_PARTIE'
      : rawRef.startsWith('COMP-')
        ? 'WAREHOUSE_COMPOSANT'
        : 'STOCK_PDR');

  // Lookup in Stock PDR
  const rawRefLower = rawRef.toLowerCase();
  const matchedStock = stockItems.find(
    (s) =>
      String(s.ref || '').trim().toLowerCase() === rawRefLower ||
      String(s.designation || '').trim().toLowerCase() === rawRefLower
  );

  // Lookup in Warehouse
  const matchedWarehouse = warehouseItems.find(
    (w) =>
      (w.id_warehouse_item && String(w.id_warehouse_item).trim().toLowerCase() === rawRefLower) ||
      (w.designation && String(w.designation).trim().toLowerCase() === rawRefLower)
  );

  let type = String(
    m.id_type ||
    matchedStock?.type ||
    matchedWarehouse?.id_type ||
    matchedWarehouse?.nature ||
    ''
  ).trim();

  let designation = String(
    m.designation ||
    matchedStock?.designation ||
    matchedWarehouse?.designation ||
    ''
  ).trim();

  // Smart heuristic if type is empty
  if (!type || type === 'null' || type === 'undefined') {
    if (sourceCat === 'WAREHOUSE_PARTIE') {
      type = 'Équipement (Machine)';
    } else if (sourceCat === 'WAREHOUSE_COMPOSANT') {
      type = 'Composant Révisé';
    } else if (/^ROUL/i.test(rawRef) || /roulement/i.test(designation)) {
      type = 'Roulement & Palier';
    } else if (/^COUR/i.test(rawRef) || /courroie/i.test(designation)) {
      type = 'Courroie & Transmission';
    } else if (/^DISQ/i.test(rawRef) || /disque/i.test(designation)) {
      type = 'Outillage & Coupe';
    } else if (/^HUILE/i.test(rawRef) || /^GRAIS/i.test(rawRef) || /lubrif/i.test(designation)) {
      type = 'Lubrification & Huiles';
    } else if (/^RACC/i.test(rawRef) || /raccord/i.test(designation) || /flexible/i.test(designation)) {
      type = 'Raccord Pneumatique / Hyd';
    } else if (/^FORET/i.test(rawRef) || /foret/i.test(designation)) {
      type = 'Outillage & Perçage';
    } else {
      type = 'Pièce de Rechange';
    }
  }

  if (!designation || designation === 'null' || designation === 'undefined') {
    designation = rawRef || 'Article sans désignation';
  }

  return {
    ref: rawRef || 'RÉF-INCONNUE',
    designation: String(designation),
    type: String(type),
    sourceCat,
  };
};

/**
 * Smart Destination Resolver (Column G)
 */
export const resolveDestinationInfo = (
  m: JournalMovementInput = {},
  { machines = [], zones = [] }: JournalLookupContext = {}
) => {
  const flux = getSmartFluxType(m);
  const action = String(m.action_id || '').toUpperCase();

  // Helper to format Zone label
  const resolveZoneText = (zoneId?: string | null) => {
    if (!zoneId) return '';
    const clean = String(zoneId).trim().toLowerCase();
    const found = zones.find(
      (z) =>
        (z.id_zone && String(z.id_zone).trim().toLowerCase() === clean) ||
        (z.libelle && String(z.libelle).trim().toLowerCase() === clean)
    );
    if (found) {
      return `${found.id_zone} • ${found.libelle || found.id_zone}`;
    }
    return String(zoneId).trim();
  };

  // Helper to lookup registered machine
  const resolveMachine = (mchId?: string | null, rawComment?: string | null) => {
    if (mchId) {
      const cleanMch = String(mchId).trim().toLowerCase();
      const found = machines.find(
        (mc) =>
          (mc.id_machine_registered &&
            String(mc.id_machine_registered).trim().toLowerCase() === cleanMch) ||
          (mc.designation && String(mc.designation).trim().toLowerCase() === cleanMch)
      );
      if (found) {
        return {
          code: String(found.id_machine_registered || ''),
          designation: String(found.designation || found.id_machine_registered || ''),
          zone: String(found.id_zone_default || found.id_zone || ''),
          isRegistered: true,
        };
      }
      return {
        code: String(mchId).trim(),
        designation: String(mchId).trim(),
        zone: '',
        isRegistered: true,
      };
    }

    if (rawComment) {
      const commentStr = String(rawComment).trim().toLowerCase();
      const matchRegistered = machines.find(
        (mc) =>
          (mc.designation && String(mc.designation).trim().toLowerCase().includes(commentStr)) ||
          (mc.id_machine_registered &&
            String(mc.id_machine_registered).trim().toLowerCase() === commentStr)
      );
      if (matchRegistered) {
        return {
          code: String(matchRegistered.id_machine_registered || ''),
          designation: String(matchRegistered.designation || ''),
          zone: String(matchRegistered.id_zone_default || ''),
          isRegistered: true,
          fromComment: true,
        };
      }

      const rawCommentStr = String(rawComment).trim();
      if (/^(ZONE-DET-\d+|MCH-\d+|LIGNE-\d+|PRESSE|TOUR|CNC|ENSACHEUSE|RCF)/i.test(rawCommentStr)) {
        return {
          code: rawCommentStr,
          designation: `${rawCommentStr} (Non assignée)`,
          zone: rawCommentStr.startsWith('ZONE-DET-') ? 'ZONE-DET' : '',
          isRegistered: false,
          isLegacyHint: true,
        };
      }
    }

    return null;
  };

  // 1. SORTIE INTERNE (Standard Workshop Machine Outflow)
  if (flux === 'Sortie Interne' || flux === 'Sortie') {
    if (action === 'USAGE') {
      const beneficiary =
        m.technicien || m.demandeur || m.operation || m.usage_type || 'Dotation Poste';
      const resolvedZone = resolveZoneText(m.id_zone) || 'ZONE ATELIER';
      return {
        category: 'USAGE PERSONNEL • POSTE',
        title: `Bénéficiaire : ${beneficiary}`,
        code: resolvedZone,
        isUnknown: false,
        badgeType: 'usage',
      };
    }

    const mchData = resolveMachine(m.id_machine_registered, m.commentaire);
    const resolvedZoneId = m.id_zone || mchData?.zone || '';
    const zoneDisplay =
      resolveZoneText(resolvedZoneId) || (resolvedZoneId ? resolvedZoneId : 'ZONE ATELIER');

    if (mchData) {
      return {
        category: zoneDisplay,
        title: mchData.designation,
        code: mchData.code,
        isRegistered: mchData.isRegistered,
        isUnknown: !mchData.isRegistered && !m.id_machine_registered,
        badgeType: 'machine',
      };
    }

    return {
      category: zoneDisplay || 'ZONE NON SPÉCIFIÉE',
      title: 'Machine : Non assignée',
      code: 'INCONNU',
      isUnknown: true,
      badgeType: 'unknown',
    };
  }

  // 2. ENTRÉE INTERNE (Retour atelier / Réintégration en stock)
  if (flux === 'Entrée Interne') {
    const emplacement = m.emplacement || m.emplacement_reception || 'Magasin Central';
    return {
      category: 'RÉINTÉGRATION • ATELIER',
      title: 'Stock PDR (Magasin Central)',
      code: `Emplacement : ${emplacement}`,
      isUnknown: false,
      badgeType: 'stock',
    };
  }

  // 3. ENTRÉE EXTERNE (Réapprovisionnement fournisseur)
  if (flux === 'Entrée Externe') {
    const fourn = m.fournisseur || m.demandeur || '';
    const emplacement = m.emplacement_reception || m.emplacement || 'Zone Réception PDR';
    return {
      category: 'RÉCEPTION • FOURNISSEUR',
      title: fourn ? `Stock PDR (${fourn})` : 'Stock PDR (Magasin)',
      code: `Emplacement : ${emplacement}`,
      isUnknown: false,
      badgeType: 'reception',
    };
  }

  // 4. BON DE SORTIE
  if (flux === 'Bon de Sortie') {
    const prest = m.prestataire_externe || m.fournisseur || m.prestataire || 'Atelier Externe';
    const machOrig = m.id_machine_registered ? `Origine : [${m.id_machine_registered}]` : '';
    const codeBon = m.code_bon ? `N° Bon : ${m.code_bon}` : 'EN RÉPARATION EXTERNE';
    return {
      category: 'SOUS-TRAITANCE • SORTIE EXTERNE',
      title: `Prestataire : ${prest}`,
      code: machOrig ? `${machOrig} • ${codeBon}` : codeBon,
      isUnknown: false,
      badgeType: 'external',
    };
  }

  // 5. COMMANDE
  if (flux === 'COMMANDE') {
    const fourn = m.fournisseur || 'Fournisseur non assigné';
    return {
      category: "DEMANDE D'ACHAT • ATTENTE",
      title: `Stock PDR (${fourn})`,
      code: m.num_commande && m.num_commande !== 'INCONNU' ? m.num_commande : 'CMD-EN-COURS',
      isUnknown: false,
      badgeType: 'order',
    };
  }

  // Fallback
  const fallbackMch = resolveMachine(m.id_machine_registered, m.commentaire);
  const fallbackZone = resolveZoneText(m.id_zone) || 'ZONE ATELIER';
  return {
    category: fallbackZone,
    title: fallbackMch ? fallbackMch.designation : 'Machine : Non assignée',
    code: fallbackMch ? fallbackMch.code : 'INCONNU',
    isUnknown: !fallbackMch,
    badgeType: 'fallback',
  };
};

/**
 * Smart Intervenant & Demandeur Resolver (Column H)
 */
export const resolveIntervenantInfo = (
  m: JournalMovementInput = {},
  { technicians = [], operations = [] }: Pick<JournalLookupContext, 'technicians' | 'operations'> = {}
) => {
  const flux = getSmartFluxType(m);
  const action = String(m.action_id || '').toUpperCase();
  const usageType = String(m.usage_type || '').toLowerCase();

  const rawTech = String(m.technicien || m.id_technician || '').trim();
  const rawOp = String(m.operation || m.id_operation || m.demandeur || '').trim();
  const rawFourn = String(m.fournisseur || m.prestataire || '').trim();

  const lookupTech = (val: string) => {
    if (!val) return null;
    const clean = val.toLowerCase();
    return (
      technicians.find(
        (t) =>
          String(t.nom || '').trim().toLowerCase() === clean ||
          String(t.id_technician || '').trim().toLowerCase() === clean
      ) || null
    );
  };

  const lookupOperation = (val: string) => {
    if (!val) return null;
    const clean = val.toLowerCase();
    return (
      operations.find(
        (op) =>
          String(op.nom || '').trim().toLowerCase() === clean ||
          String(op.id_operation || '').trim().toLowerCase() === clean
      ) || null
    );
  };

  const matchedTech = lookupTech(rawTech) || (rawOp ? lookupTech(rawOp) : null);
  const matchedOp = lookupOperation(rawOp) || (rawTech ? lookupOperation(rawTech) : null);

  if (action === 'USAGE' || usageType) {
    if (usageType === 'technician' || (!usageType && matchedTech && !matchedOp)) {
      const tech = matchedTech;
      const nom = tech ? tech.nom : rawTech || 'Technicien';
      const id = tech ? tech.id_technician : (rawTech.startsWith('TECH-') ? rawTech : (m.id_technician || 'TECH-01'));
      return {
        role: 'TECHNICIEN (USAGE)',
        name: nom,
        id: id,
        isUnknown: !rawTech && !tech,
      };
    }

    if (
      usageType === 'chef' ||
      usageType === 'responsable' ||
      (!usageType && (matchedOp?.type_profil === 'RESPONSABLE' || matchedOp?.type_profil === 'CHEF' || String(matchedOp?.id_operation).startsWith('RESP') || String(matchedOp?.id_operation).startsWith('CHEF')))
    ) {
      const resp = matchedOp;
      const nom = resp ? resp.nom : rawOp || rawTech || 'Demandeur Responsable';
      const id = resp
        ? resp.id_operation
        : (rawOp.startsWith('RESP-') || rawOp.startsWith('CHEF-') ? rawOp : (m.id_operation || 'RESP-01'));
      return {
        role: 'DEMANDEUR RESPONSABLE (USAGE)',
        name: nom,
        id: id,
        isUnknown: !rawOp && !rawTech && !resp,
      };
    }

    if (usageType === 'operation' || (!usageType && matchedOp?.type_profil === 'OPERATEUR')) {
      const op = matchedOp;
      const nom = op ? op.nom : rawOp || 'Opérateur';
      const id = op ? op.id_operation : (rawOp.startsWith('OP-') ? rawOp : (m.id_operation || 'OP-01'));
      return {
        role: 'OPÉRATEUR (USAGE)',
        name: nom,
        id: id,
        isUnknown: !rawOp && !op,
      };
    }

    const nom = rawTech || rawOp;
    if (nom) {
      return {
        role: 'DEMANDEUR (USAGE)',
        name: nom,
        id: nom.startsWith('TECH-') || nom.startsWith('OP-') || nom.startsWith('RESP-') || nom.startsWith('CHEF-') ? nom : 'USAGE-PERSO',
        isUnknown: false,
      };
    }
  }

  if (flux === 'Entrée Externe' || action === 'REAPPRO' || action === 'ACHAT_DIRECT') {
    if (rawFourn) {
      return {
        role: 'FOURNISSEUR / TIERS',
        name: rawFourn,
        id: m.num_commande && m.num_commande !== 'INCONNU' ? m.num_commande : 'EXT-FOURN',
        isUnknown: false,
      };
    }
    if (matchedTech || rawTech) {
      return {
        role: 'RÉCEPTIONNAIRE PDR',
        name: matchedTech ? matchedTech.nom : rawTech,
        id: matchedTech ? matchedTech.id_technician : (m.id_technician || 'TECH-PDR'),
        isUnknown: false,
      };
    }
  }

  if (
    flux === 'Bon de Sortie' ||
    action === 'REPARATION_EXTERNE' ||
    action === 'ETALONNAGE_CONTROLE' ||
    action === 'GARANTIE_ECHANGE'
  ) {
    if (matchedTech || rawTech) {
      return {
        role: 'TECHNICIEN ÉMETTEUR',
        name: matchedTech ? matchedTech.nom : rawTech,
        id: matchedTech ? matchedTech.id_technician : (m.id_technician || 'TECH-EMETTEUR'),
        isUnknown: false,
      };
    }
    if (rawFourn) {
      return {
        role: 'PRESTATAIRE EXTERNE',
        name: rawFourn,
        id: m.code_bon || 'SOUS-TRAITANT',
        isUnknown: false,
      };
    }
  }

  if (flux === 'COMMANDE') {
    if (matchedTech || rawTech) {
      return {
        role: "DEMANDEUR D'ACHAT",
        name: matchedTech ? matchedTech.nom : rawTech,
        id: matchedTech ? matchedTech.id_technician : (m.id_technician || 'TECH-CMD'),
        isUnknown: false,
      };
    }
    if (rawFourn) {
      return {
        role: 'FOURNISSEUR VISÉ',
        name: rawFourn,
        id: m.num_commande && m.num_commande !== 'INCONNU' ? m.num_commande : 'CMD-PDR',
        isUnknown: false,
      };
    }
  }

  if (action === 'INVENTAIRE') {
    const nom = matchedTech ? matchedTech.nom : (rawTech || (matchedOp ? matchedOp.nom : rawOp) || 'Auditeur Stock');
    const id = matchedTech ? matchedTech.id_technician : (matchedOp ? matchedOp.id_operation : 'INV-STOCK');
    return {
      role: 'RESPONSABLE INVENTAIRE',
      name: nom,
      id: id,
      isUnknown: !rawTech && !rawOp,
    };
  }

  const isRespProfile =
    matchedOp?.type_profil === 'RESPONSABLE' ||
    matchedOp?.type_profil === 'CHEF' ||
    String(matchedOp?.id_operation).startsWith('RESP') ||
    String(matchedOp?.id_operation).startsWith('CHEF');

  if (matchedTech && matchedOp && isRespProfile) {
    return {
      role: `TECHNICIEN • RESPONSABLE`,
      name: `${matchedTech.nom}`,
      id: `${matchedTech.id_technician} • ${matchedOp.id_operation}`,
      supervisor: matchedOp.nom,
      isUnknown: false,
    };
  }

  if (matchedTech) {
    return {
      role: 'TECHNICIEN GMAO',
      name: matchedTech.nom,
      id: matchedTech.id_technician,
      isUnknown: false,
    };
  }

  if (matchedOp) {
    return {
      role: isRespProfile ? 'RESPONSABLE (RESP)' : 'OPÉRATEUR DE LIGNE',
      name: matchedOp.nom,
      id: matchedOp.id_operation,
      isUnknown: false,
    };
  }

  if (rawTech) {
    const isTechCode = /^TECH-\d+/i.test(rawTech);
    return {
      role: isTechCode ? 'TECHNICIEN GMAO' : 'INTERVENANT',
      name: rawTech,
      id: isTechCode ? rawTech : (m.id_technician || 'TECH-GMAO'),
      isUnknown: false,
    };
  }

  if (rawOp) {
    const isRespCode = /^(?:RESP|CHEF)-\d+/i.test(rawOp);
    const isOpCode = /^OP-\d+/i.test(rawOp);
    return {
      role: isRespCode ? 'RESPONSABLE (RESP)' : isOpCode ? 'OPÉRATEUR' : 'DEMANDEUR',
      name: rawOp,
      id: isRespCode || isOpCode ? rawOp : (m.id_operation || 'INTERV-01'),
      isUnknown: false,
    };
  }

  return {
    role: 'INTERVENANT',
    name: 'INCONNU',
    id: 'INCONNU',
    isUnknown: true,
  };
};

/**
 * Smart Stock Progression & Equation Resolver (Column E)
 */
export const resolveStockEquation = (
  m: JournalMovementInput = {},
  { stockItems = [], warehouseItems = [] }: Pick<JournalLookupContext, 'stockItems' | 'warehouseItems'> = {}
) => {
  const isOutflow = String(m.type || '').toLowerCase().includes('sortie');
  const qte = Number(m.quantite) || 0;

  let stockAvant = m.stock_avant !== undefined && m.stock_avant !== null ? Number(m.stock_avant) : null;
  let stockApres = m.stock_apres !== undefined && m.stock_apres !== null ? Number(m.stock_apres) : null;
  let seuilMin = m.seuil_min !== undefined && m.seuil_min !== null ? Number(m.seuil_min) : null;

  const rawRef = String(m.ref || '').trim();
  const rawRefLower = rawRef.toLowerCase();
  const matchedStock = stockItems.find(
    (s) =>
      (s.ref && String(s.ref).trim().toLowerCase() === rawRefLower) ||
      (s.id_article && String(s.id_article).trim().toLowerCase() === rawRefLower) ||
      (s.designation && String(s.designation).trim().toLowerCase() === rawRefLower)
  );
  const matchedWarehouse = warehouseItems.find(
    (w) =>
      (w.id_warehouse_item && String(w.id_warehouse_item).trim().toLowerCase() === rawRefLower) ||
      (w.code && String(w.code).trim().toLowerCase() === rawRefLower) ||
      (w.designation && String(w.designation).trim().toLowerCase() === rawRefLower)
  );

  if (seuilMin === null || isNaN(seuilMin)) {
    seuilMin = Number(matchedStock?.seuil ?? matchedWarehouse?.seuil ?? 5);
  }

  if (stockAvant === null || isNaN(stockAvant)) {
    if (matchedStock) {
      const current = Number(matchedStock.stockActuel ?? matchedStock.stockInitial ?? 0);
      stockAvant = isOutflow ? Math.max(0, current + qte) : Math.max(0, current - qte);
    } else if (matchedWarehouse) {
      const current = Number(matchedWarehouse.quantite ?? 1);
      stockAvant = isOutflow ? Math.max(0, current + qte) : Math.max(0, current - qte);
    } else {
      stockAvant = isOutflow ? qte + 5 : 0;
    }
  }

  if (stockApres === null || isNaN(stockApres)) {
    stockApres = isOutflow ? stockAvant - qte : stockAvant + qte;
  }

  let apresClass;
  if (stockApres <= 0) {
    apresClass = 'text-rose-600 font-extrabold';
  } else if (stockApres < seuilMin) {
    apresClass = 'text-amber-600 font-extrabold';
  } else {
    apresClass = 'text-slate-900 font-bold';
  }

  return {
    isOutflow,
    qte,
    stockAvant,
    stockApres,
    seuilMin,
    operator: isOutflow ? '−' : '+',
    operatorClass: isOutflow ? 'text-rose-600 font-bold' : 'text-emerald-600 font-bold',
    qteClass: isOutflow ? 'text-rose-600 font-bold' : 'text-emerald-600 font-bold',
    apresClass,
    unit: m.unit || 'pcs',
  };
};

/**
 * Custom Select Helper component
 */
export function TableFilterSelect({
  value,
  onChange,
  options = [],
  icon,
  className = '',
}: TableFilterSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && e.target instanceof Node && !ref.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find((o) => o.value === value) || options[0];

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full h-8 px-2.5 rounded-xl border text-xs font-semibold transition flex items-center justify-between cursor-pointer ${
          value !== 'ALL'
            ? 'bg-indigo-50 text-indigo-900 border-indigo-300 ring-1 ring-indigo-200'
            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
        }`}
      >
        <div className="flex items-center gap-1.5 truncate">
          {icon && <span className="shrink-0">{icon}</span>}
          <span className="truncate">{selectedOption?.label}</span>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform shrink-0 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1 w-56 bg-white rounded-xl border border-slate-200 shadow-xl z-50 p-1 space-y-0.5 animate-in fade-in">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
              className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition cursor-pointer ${
                opt.value === value
                  ? 'bg-indigo-50 text-indigo-950 font-bold'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="truncate flex items-center gap-2">
                {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                <span className="truncate">{opt.label}</span>
              </div>
              {opt.badge && (
                <span className="text-[9.5px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 shrink-0 ml-1">
                  {opt.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
