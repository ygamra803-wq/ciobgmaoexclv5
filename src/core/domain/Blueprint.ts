import { filterActiveMachines } from '../../utils/activeMachines';

export interface BlueprintPreventivePlanItem {
  id: string;
  action_code?: string;
  composant?: string;
  component_ref?: string;
  id_composant?: string;
  id_part?: string;
  pdr_refs?: string[];
  frequence: string;
  description?: string;
  duree_min?: number;
}

export interface BlueprintCommonFailureItem {
  id: string;
  title: string;
  description?: string;
  type_panne?: string;
  urgence?: string;
  recommended_action?: string;
  pdr_ref?: string;
  pdr_refs?: string[];
  component_ref?: string;
  id_part?: string;
}

export interface BlueprintPdrItem {
  id_pdr: string;
  libelle?: string;
  qte?: number;
  criticite?: string;
  parent_component_key?: string;
  parent_component_code?: string;
}

const ACTION_LABELS: Record<string, string> = {
  C: 'Contrôle',
  N: 'Nettoyage',
  G: 'Graissage',
  V: 'Vérification',
  R: 'Révision',
  S: 'Serrage',
  L: 'Lubrification',
};

function buildWeeklyPlanning(frequency: string, actionCode = 'C'): Record<string, string> {
  const planning: Record<string, string> = {};
  let step = 4;
  const f = String(frequency || 'Mensuel').toLowerCase();
  if (f.includes('quotid') || f.includes('jour') || (f.includes('hebdo') && !f.includes('bi'))) step = 1;
  else if (f.includes('bi')) step = 2;
  else if (f.includes('mensuel') || f === '1m') step = 4;
  else if (f.includes('trimestr') || f === '3m') step = 12;
  else if (f.includes('semestr') || f === '6m') step = 26;
  else if (f.includes('annuel') || f === '12m' || f === '1a') step = 52;

  for (let w = 1; w <= 52; w += step) {
    planning[`S${w}`] = actionCode;
  }
  return planning;
}

function normalizeToken(val: any): string {
  return String(val || '')
    .trim()
    .toLowerCase()
    .replace(/[-_\s]+/g, ' ');
}

export function applyBlueprintPlanToActiveMachines(
  blueprintData: any,
  machines: any[] = [],
  existingTasks: any[] = [],
  warehouseItems: any[] = []
) {
  const bpId = blueprintData?.id_blueprint || blueprintData?.id;
  const planItems: BlueprintPreventivePlanItem[] = Array.isArray(blueprintData?.preventivePlanItems)
    ? blueprintData.preventivePlanItems
    : [];
  const bpPdrList: BlueprintPdrItem[] = Array.isArray(blueprintData?.pdr_theoriques)
    ? blueprintData.pdr_theoriques
    : [];

  const activeLinkedMachines = filterActiveMachines(machines).filter(
    (m) => m.id_blueprint === bpId
  );

  if (!bpId || planItems.length === 0 || activeLinkedMachines.length === 0) {
    return {
      addedTasks: [],
      updatedTasks: Array.isArray(existingTasks) ? existingTasks : [],
      targetMachinesCount: activeLinkedMachines.length,
    };
  }

  const currentTasks = Array.isArray(existingTasks) ? existingTasks : [];
  const addedTasks: any[] = [];
  const nowIso = new Date().toISOString();
  const today = nowIso.split('T')[0];

  activeLinkedMachines.forEach((m) => {
    const machineId = String(m.id_machine_registered || m.code_machine || m.id || '')
      .trim()
      .toUpperCase();
    if (!machineId) return;

    const cleanMach = machineId.replace(/[^a-zA-Z0-9]/g, '');
    const zone = m.id_zone_default || m.id_zone || m.zone || 'AFM';
    const tech = m.technician || m.technicien_responsable || m.technicien || 'Technicien';
    const machineName = m.designation || m.nom || `Machine ${machineId}`;

    // Discover warehouse components & parts attached to this machine for automatic FK binding (P1 / P5)
    const machineWhItems = (Array.isArray(warehouseItems) ? warehouseItems : []).filter((w) => {
      if (!w) return false;
      const wMach = String(w.id_machine_registered || w.id_machine || w.code_machine || '')
        .trim()
        .toUpperCase();
      return wMach === machineId;
    });

    planItems.forEach((item, idx) => {
      const itemId = item.id || `BP-ITEM-${idx + 1}`;
      const alreadyExists =
        currentTasks.some(
          (t) =>
            String(t.id_machine || '').toUpperCase() === machineId &&
            t.id_blueprint === bpId &&
            t.blueprint_item_id === itemId
        ) ||
        addedTasks.some(
          (t) =>
            String(t.id_machine || '').toUpperCase() === machineId &&
            t.id_blueprint === bpId &&
            t.blueprint_item_id === itemId
        );

      if (alreadyExists) return;

      const compName = String(item.composant || 'Machine entière').trim() || 'Machine entière';
      const cleanComp = compName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase() || 'COMP';
      const actCode = String(item.action_code || 'C').trim().toUpperCase() || 'C';
      const freq = String(item.frequence || 'Mensuel').trim() || 'Mensuel';
      const dureeMin = Number(item.duree_min) > 0 ? Number(item.duree_min) : 15;
      const seqNum = currentTasks.length + addedTasks.length + 1;
      const taskSeq = String(seqNum).padStart(4, '0');
      const desc =
        item.description?.trim() ||
        `Exécuter ${ACTION_LABELS[actCode] || actCode} sur ${compName}`;

      // Resolve optional Component or Part on the target machine matching item.composant / item.component_ref
      let resolvedIdComposant = item.id_composant || '';
      let resolvedNomComposant = '';
      let resolvedIdPart = item.id_part || '';
      let resolvedNomPart = '';

      if (compName.toLowerCase() !== 'machine entière') {
        const compToken = normalizeToken(compName);
        const refToken = normalizeToken(item.component_ref);

        const matchedWh = machineWhItems.find((w) => {
          const wId = normalizeToken(w.id_warehouse_item || w.id);
          const wDes = normalizeToken(w.designation || w.nom_composant || w.nom);
          const wTpl = normalizeToken(w.id_templates || w.id_comp_template);
          return (
            (refToken && (wId === refToken || wTpl === refToken || wDes.includes(refToken))) ||
            (compToken && (wDes === compToken || wDes.includes(compToken) || compToken.includes(wDes)))
          );
        });

        if (matchedWh) {
          const whId = String(matchedWh.id_warehouse_item || matchedWh.id || '').trim();
          const whName = String(matchedWh.designation || matchedWh.nom || compName).trim();
          const nature = String(matchedWh.nature || '').trim().toUpperCase();
          if (nature === 'PART') {
            resolvedIdPart = resolvedIdPart || whId;
            resolvedNomPart = whName;
          } else {
            resolvedIdComposant = resolvedIdComposant || whId;
            resolvedNomComposant = whName;
          }
        }
      }

      // Resolve recommended PDRs from planItem.pdr_refs + Blueprint semi-hierarchical BOM (parent_component_key)
      const pdrRefSet = new Set<string>();
      if (Array.isArray(item.pdr_refs)) {
        item.pdr_refs.forEach((r) => {
          if (r && String(r).trim()) pdrRefSet.add(String(r).trim());
        });
      }
      bpPdrList.forEach((pdr) => {
        const parentKey = pdr?.parent_component_key || pdr?.parent_component_code;
        if (!pdr?.id_pdr || !parentKey) return;
        const parentNorm = normalizeToken(parentKey);
        if (
          parentNorm &&
          (parentNorm === normalizeToken(compName) ||
            parentNorm === normalizeToken(item.component_ref))
        ) {
          pdrRefSet.add(String(pdr.id_pdr).trim());
        }
      });

      const pdrRequises = Array.from(pdrRefSet).map((ref) => {
        const bpMatch = bpPdrList.find(
          (p) => String(p.id_pdr || '').trim().toUpperCase() === ref.toUpperCase()
        );
        const designation = bpMatch?.libelle || ref;
        return {
          ref,
          nom: designation,
          designation,
          quantite: Math.max(1, Number(bpMatch?.qte || 1)),
        };
      });

      addedTasks.push({
        id: `ID-PREV-${cleanMach}-${cleanComp}-${freq.slice(0, 3).toUpperCase()}-${taskSeq}`,
        id_plan: `ID-PLAN-${bpId}-${cleanMach}`,
        id_blueprint: bpId,
        blueprint_item_id: itemId,
        code: `PREV-${machineId}-${cleanComp}-${taskSeq.slice(-3)}`,
        ref: `Plan-BP-${bpId}-${machineId}`,
        id_machine: machineId,
        nom_machine: machineName,
        id_zone: zone,
        section: `Sections: ${zone}`,
        composant: compName,
        ...(resolvedIdComposant ? { id_composant: resolvedIdComposant } : {}),
        ...(resolvedNomComposant ? { nom_composant: resolvedNomComposant } : {}),
        ...(resolvedIdPart ? { id_part: resolvedIdPart } : {}),
        ...(resolvedNomPart ? { nom_part: resolvedNomPart } : {}),
        ...(pdrRequises.length > 0
          ? { pdr_requises: pdrRequises, pdr_ref: pdrRequises[0].ref }
          : {}),
        type_intervention: ACTION_LABELS[actCode] || 'Contrôle',
        action_code: actCode,
        frequence: freq,
        planning: buildWeeklyPlanning(freq, actCode),
        is_global_machine: compName.toLowerCase() === 'machine entière',
        duree_estimee: `${dureeMin} min`,
        duree_min: dureeMin,
        description: desc,
        consigne: desc,
        responsable: tech,
        etat: 'À faire',
        priorite: 'Normale',
        prochaine_echeance: today,
        derniere_realisation: null,
        id_corrective: null,
        created_at: nowIso,
      });
    });
  });

  return {
    addedCount: addedTasks.length,
    addedTasks,
    updatedTasks: [...addedTasks, ...currentTasks],
    targetMachinesCount: activeLinkedMachines.length,
  };
}

/**
 * P2, P4 & N1 Smart BOM PDR Ranking:
 * Ranks consumable `stockItems` so that PDRs linked to the target Component, Machine/Blueprint BOM,
 * or Nexus As-Built Ledger (`machineElementsLedger`) appear first (`isBomRecommended: true`, `bomPriority: 1 | 2`),
 * while keeping the rest of the warehouse `stockItems` available right below (`isBomRecommended: false`, `bomPriority: 3`).
 */
export function rankStockItemsByMachineBom<T extends Record<string, any>>(
  firstArg: string | T[] = '',
  secondArg: T[] | string = [],
  machines: any[] = [],
  blueprints: any[] = [],
  componentRefOrName: string = '',
  taskOrExplicitPdrs?: any,
  machineElementsLedger: any[] = []
): Array<
  T & {
    isBomRecommended: boolean;
    bomPriority: 1 | 2 | 3;
    bomSourceLabel?: string;
    bomReason?: string;
  }
> {
  const stockItems: T[] = Array.isArray(firstArg)
    ? firstArg
    : Array.isArray(secondArg)
    ? secondArg
    : [];
  const machineCodeOrId: string =
    typeof firstArg === 'string'
      ? firstArg
      : typeof secondArg === 'string'
      ? secondArg
      : '';

  if (!Array.isArray(stockItems) || stockItems.length === 0) return [];

  const targetMachNorm = normalizeToken(machineCodeOrId);
  const targetCompNorm = normalizeToken(componentRefOrName);

  const componentPdrRefs = new Set<string>();
  const blueprintPdrRefs = new Set<string>();
  const nexusPdrRefs = new Set<string>();

  // 1. Explicit task-level PDRs (highest priority)
  if (Array.isArray(taskOrExplicitPdrs)) {
    taskOrExplicitPdrs.forEach((p: any) => {
      const r = String(p?.reference || p?.ref || p || '').trim().toUpperCase();
      if (r) componentPdrRefs.add(r);
    });
  } else if (taskOrExplicitPdrs && typeof taskOrExplicitPdrs === 'object') {
    if (taskOrExplicitPdrs.pdr_ref) {
      const r = String(taskOrExplicitPdrs.pdr_ref).trim().toUpperCase();
      if (r) componentPdrRefs.add(r);
    }
    if (Array.isArray(taskOrExplicitPdrs.pdr_requises)) {
      taskOrExplicitPdrs.pdr_requises.forEach((p: any) => {
        const r = String(p?.reference || p?.ref || '').trim().toUpperCase();
        if (r) componentPdrRefs.add(r);
      });
    }
  }

  // 2. Discover Machine, its linked Blueprint, and its Nexus As-Built Ledger (N1)
  if (targetMachNorm) {
    const matchedMachine = (machines || []).find((m) => {
      if (!m) return false;
      const candidates = [
        m.id_machine_registered,
        m.code_machine,
        m.code,
        m.id,
        m.id_machine,
        m.nom,
        m.designation,
      ];
      return candidates.some((c) => c && normalizeToken(c) === targetMachNorm);
    });

    const machineAliases = new Set<string>([targetMachNorm]);
    if (matchedMachine) {
      [
        matchedMachine.id_machine_registered,
        matchedMachine.code_machine,
        matchedMachine.code,
        matchedMachine.id,
        matchedMachine.id_machine,
      ].forEach((c) => {
        if (c) machineAliases.add(normalizeToken(c));
      });
    }

    // Machine-level historical/theoretical PDRs if present
    const machPdrs = matchedMachine?.pdr_theoriques || matchedMachine?.pdr_historique || [];
    if (Array.isArray(machPdrs)) {
      machPdrs.forEach((p: any) => {
        const r = String(p?.id_pdr || p?.ref || '').trim().toUpperCase();
        if (r) blueprintPdrRefs.add(r);
      });
    }

    // N1: Read consumable PDR elements mounted on this machine in Nexus (machineElementsLedger)
    if (Array.isArray(machineElementsLedger) && machineElementsLedger.length > 0) {
      machineElementsLedger.forEach((entry: any) => {
        if (!entry) return;
        const entryMachNorm = normalizeToken(
          entry.id_machine_registered || entry.id_machine || entry.code_machine || entry.machine
        );
        if (!entryMachNorm || !machineAliases.has(entryMachNorm)) return;

        // Only rank consumable PDRs (never COMPONENT or PART)
        const elType = String(entry.element_type || 'PDR').trim().toUpperCase();
        if (elType === 'COMPONENT' || elType === 'COMPOSANT' || elType === 'PART' || elType === 'ORGANE') {
          return;
        }

        const r = String(entry.ref_element || entry.ref || entry.id_pdr || '').trim().toUpperCase();
        if (!r) return;

        const locCandidates = [
          entry.emplacement_machine,
          entry.parent_component_key,
          entry.id_composant,
          entry.composant,
          entry.id_part,
        ]
          .map((v) => normalizeToken(v))
          .filter(Boolean);

        const matchesOrgane =
          Boolean(targetCompNorm) &&
          locCandidates.some(
            (loc) =>
              loc === targetCompNorm ||
              loc.includes(targetCompNorm) ||
              targetCompNorm.includes(loc)
          );

        if (matchesOrgane) {
          componentPdrRefs.add(r);
        } else {
          nexusPdrRefs.add(r);
          blueprintPdrRefs.add(r);
        }
      });
    }

    const bpId = matchedMachine?.id_blueprint;
    const tplId = matchedMachine?.id_templates || matchedMachine?.id_machine_template || matchedMachine?.template;

    const matchedBlueprints = (blueprints || []).filter((b) => {
      if (!b) return false;
      if (bpId && String(b.id_blueprint || b.id || '').trim() === String(bpId).trim()) return true;
      if (tplId && String(b.id_templates || '').trim() === String(tplId).trim()) return true;
      return false;
    });

    matchedBlueprints.forEach((bp) => {
      // Also allow matching component via Blueprint composants_lies (code_type -> nom_composant)
      const bpCompAliases = new Set<string>();
      if (targetCompNorm) {
        bpCompAliases.add(targetCompNorm);
        if (Array.isArray(bp.composants_lies)) {
          bp.composants_lies.forEach((c: any) => {
            const cCode = normalizeToken(c?.code_type || c?.id_comp_type);
            const cName = normalizeToken(c?.nom_composant || c?.designation);
            if (cCode === targetCompNorm || cName === targetCompNorm) {
              if (cCode) bpCompAliases.add(cCode);
              if (cName) bpCompAliases.add(cName);
            }
          });
        }
      }

      const matchesTargetComp = (candidateNorm: string) => {
        if (!targetCompNorm || !candidateNorm) return false;
        for (const alias of bpCompAliases) {
          if (
            candidateNorm === alias ||
            alias.includes(candidateNorm) ||
            candidateNorm.includes(alias)
          ) {
            return true;
          }
        }
        return false;
      };

      // Blueprint pdr_theoriques (with optional parent_component_key / parent_component_code)
      if (Array.isArray(bp.pdr_theoriques)) {
        bp.pdr_theoriques.forEach((p: any) => {
          const r = String(p?.id_pdr || p?.ref || '').trim().toUpperCase();
          if (!r) return;
          const parentNorm = normalizeToken(p?.parent_component_key || p?.parent_component_code);
          if (matchesTargetComp(parentNorm)) {
            componentPdrRefs.add(r);
          } else {
            blueprintPdrRefs.add(r);
          }
        });
      }

      // Blueprint preventivePlanItems pdr_refs
      if (Array.isArray(bp.preventivePlanItems)) {
        bp.preventivePlanItems.forEach((pi: any) => {
          const refs = Array.isArray(pi?.pdr_refs) ? pi.pdr_refs : [];
          const piCompNorm = normalizeToken(pi?.composant || pi?.component_ref);
          refs.forEach((rawRef: any) => {
            const r = String(rawRef || '').trim().toUpperCase();
            if (!r) return;
            if (matchesTargetComp(piCompNorm)) {
              componentPdrRefs.add(r);
            } else {
              blueprintPdrRefs.add(r);
            }
          });
        });
      }

      // Blueprint commonFailures pdr_ref
      if (Array.isArray(bp.commonFailures)) {
        bp.commonFailures.forEach((cf: any) => {
          const r = String(cf?.pdr_ref || '').trim().toUpperCase();
          if (!r) return;
          const cfCompNorm = normalizeToken(cf?.component_ref);
          if (matchesTargetComp(cfCompNorm)) {
            componentPdrRefs.add(r);
          } else {
            blueprintPdrRefs.add(r);
          }
        });
      }
    });
  }

  const annotated = stockItems.map((item) => {
    const refUpper = String(item.ref || item.reference || item.code_article || item.code || '')
      .trim()
      .toUpperCase();
    if (refUpper && componentPdrRefs.has(refUpper)) {
      return {
        ...item,
        isBomRecommended: true,
        bomPriority: 1 as const,
        bomSourceLabel: 'BOM Organe / Tâche',
        bomReason: 'BOM Composant / Tâche',
      };
    }
    if (refUpper && blueprintPdrRefs.has(refUpper)) {
      const isNexusOnly = nexusPdrRefs.has(refUpper);
      return {
        ...item,
        isBomRecommended: true,
        bomPriority: 2 as const,
        bomSourceLabel: isNexusOnly ? 'BOM Machine / Nexus' : 'BOM Machine / Blueprint',
        bomReason: isNexusOnly ? 'BOM Machine / Nexus' : 'BOM Machine / Blueprint',
      };
    }
    return {
      ...item,
      isBomRecommended: false,
      bomPriority: 3 as const,
      bomSourceLabel: undefined,
      bomReason: undefined,
    };
  });

  // Stable sort: Component BOM (1) -> Blueprint/Nexus Machine BOM (2) -> General Stock (3)
  return annotated.sort((a, b) => a.bomPriority - b.bomPriority);
}

/**
 * N2 Unified As-Built Machine View:
 * Combines explicit `machineElementsLedger` records for `machineId` with mounted `warehouseItems`
 * (`MONTE` / `En service` / `Opérationnel`) attached to the same machine, without merging underlying storage tables.
 */
export function buildUnifiedMachineNexusElements(
  machineId: string,
  machineElementsLedger: any[] = [],
  warehouseItems: any[] = []
): any[] {
  const targetMachNorm = normalizeToken(machineId);
  if (!targetMachNorm) return [];

  const seenRefs = new Set<string>();
  const unified: any[] = [];

  // 1. Explicit As-Built ledger entries for this machine
  if (Array.isArray(machineElementsLedger)) {
    machineElementsLedger.forEach((item) => {
      if (!item) return;
      const itemMachNorm = normalizeToken(
        item.id_machine_registered || item.id_machine || item.code_machine || item.machine
      );
      if (itemMachNorm !== targetMachNorm) return;

      const refNorm = normalizeToken(item.ref_element || item.ref);
      if (refNorm) seenRefs.add(refNorm);

      unified.push({
        ...item,
        _source: item._source || 'LEDGER',
      });
    });
  }

  // 2. Mounted Entrepôt components & structural parts attached to this machine (MONTE / En service)
  if (Array.isArray(warehouseItems)) {
    warehouseItems.forEach((w) => {
      if (!w) return;
      const wMachRaw = w.id_machine_registered || w.id_machine || w.code_machine || w.machine || '';
      if (normalizeToken(wMachRaw) !== targetMachNorm) return;

      const rattach = String(w.rattachement_type || '').trim().toUpperCase();
      if (rattach === 'ZONE' || rattach === 'RESERVE' || rattach === 'STOCK') return;

      const rawStatus = String(w.status || w.statut || w.etat || '').trim().toLowerCase();
      const isUnmountedStatus =
        rawStatus.includes('stock') ||
        rawStatus.includes('réserve') ||
        rawStatus.includes('reserve') ||
        rawStatus.includes('bobinage') ||
        rawStatus.includes('réparation') ||
        rawStatus.includes('reparation') ||
        rawStatus.includes('hors service') ||
        rawStatus.includes('archivé') ||
        rawStatus.includes('archive') ||
        rawStatus.includes('rebut');

      if (isUnmountedStatus) return;

      const whCode = String(w.id_warehouse_item || w.ref || w.code || w.id || '').trim();
      const whRefAlt = String(w.ref || '').trim();
      if (!whCode) return;

      const codeNorm = normalizeToken(whCode);
      const altNorm = normalizeToken(whRefAlt);
      if ((codeNorm && seenRefs.has(codeNorm)) || (altNorm && seenRefs.has(altNorm))) {
        return;
      }

      if (codeNorm) seenRefs.add(codeNorm);
      if (altNorm) seenRefs.add(altNorm);

      const natureRaw = String(w.nature || w.category || w.type || '').trim().toUpperCase();
      const isPart =
        natureRaw === 'PART' ||
        natureRaw === 'PARTIE' ||
        natureRaw === 'ORGANE' ||
        Boolean(w.part_type || w.id_part || w.id_part_designation);

      const mappedStatut =
        rawStatus.includes('remplacer') || rawStatus.includes('alerte')
          ? 'A_REMPLACER'
          : rawStatus.includes('révision') || rawStatus.includes('revision') || rawStatus.includes('contrôle')
          ? 'EN_REVISION'
          : 'OPERATIONNEL';

      unified.push({
        id: `WH-MOUNTED-${whCode}`,
        id_machine_registered: String(wMachRaw || machineId).trim(),
        element_type: isPart ? 'PART' : 'COMPONENT',
        ref_element: whCode,
        designation: String(
          w.designation || w.designation_part || w.nom_composant || w.nom || whCode
        ).trim(),
        qte_montee: Number(w.qte ?? w.quantite ?? w.stockActuel ?? w.stockInitial ?? 1) || 1,
        unite: w.unite || 'U',
        criticalite: w.criticalite || 'MAJEURE',
        duree_vie_estimee_heures: Number(w.duree_vie_estimee_heures) || 5000,
        heures_actuelles: Number(w.heures_actuelles) || 0,
        date_installation: w.date_installation || w.date_montage || '',
        emplacement_machine: w.emplacement || w.emplacement_machine || 'Monté (Entrepôt)',
        technicien: w.technician || w.technicien || 'Entrepôt',
        statut: mappedStatut,
        remarques: w.remarques || '',
        _source: 'ENTREPOT',
        _warehouseItemId: w.id_warehouse_item || w.id || whCode,
        _warehouseStatus: w.status || 'Monté / En service',
      });
    });
  }

  return unified;
}

/**
 * N3 — Initialiser depuis Blueprint:
 * Pure domain function that extracts missing theoretical PDRs, Components, and Parts from a Machine's Blueprint
 * into new `machineElementsLedger` records without duplicating existing machine+ref entries and without touching `warehouseItems`.
 */
export function buildLedgerEntriesFromBlueprint(
  machine: any,
  blueprintOrBlueprints: any,
  existingLedger: any[] = [],
  stockItems: any[] = []
): {
  addedEntries: any[];
  skippedCount: number;
  blueprintId: string | null;
} {
  if (!machine) {
    return { addedEntries: [], skippedCount: 0, blueprintId: null };
  }

  const machineId = String(
    machine.id_machine_registered || machine.code_machine || machine.code || machine.id || ''
  ).trim();
  const targetMachNorm = normalizeToken(machineId);
  if (!targetMachNorm) {
    return { addedEntries: [], skippedCount: 0, blueprintId: null };
  }

  // Resolve target blueprint from either a single blueprint object or a blueprints array
  let matchedBlueprint: any = null;
  if (Array.isArray(blueprintOrBlueprints)) {
    const bpId = String(machine.id_blueprint || '').trim();
    const tplId = String(
      machine.id_templates || machine.id_machine_template || machine.template || ''
    ).trim();

    if (bpId) {
      matchedBlueprint = blueprintOrBlueprints.find(
        (b) => b && String(b.id_blueprint || b.id || '').trim() === bpId
      );
    }
    if (!matchedBlueprint && tplId) {
      matchedBlueprint = blueprintOrBlueprints.find(
        (b) => b && String(b.id_templates || '').trim() === tplId
      );
    }
  } else if (blueprintOrBlueprints && typeof blueprintOrBlueprints === 'object') {
    matchedBlueprint = blueprintOrBlueprints;
  }

  if (!matchedBlueprint) {
    return { addedEntries: [], skippedCount: 0, blueprintId: null };
  }

  const bpId = String(matchedBlueprint.id_blueprint || matchedBlueprint.id || 'BP').trim();
  const today = new Date().toISOString().split('T')[0];
  const defaultTech = String(
    machine.technician || machine.technicien_responsable || machine.technicien || 'tech'
  ).trim();

  // Existing normalized refs for this machine in machineElementsLedger
  const existingRefsForMachine = new Set<string>();
  if (Array.isArray(existingLedger)) {
    existingLedger.forEach((item) => {
      if (!item) return;
      const itemMachNorm = normalizeToken(
        item.id_machine_registered || item.id_machine || item.code_machine || item.machine
      );
      if (itemMachNorm === targetMachNorm) {
        const refNorm = normalizeToken(item.ref_element || item.ref);
        if (refNorm) existingRefsForMachine.add(refNorm);
      }
    });
  }

  const mapCriticite = (raw?: string): string => {
    const c = String(raw || '').trim().toUpperCase();
    if (c.includes('CRIT') || c.includes('HAUT')) return 'CRITIQUE';
    if (c.includes('MIN') || c.includes('BASS') || c.includes('FAIB')) return 'MINEURE';
    return 'MAJEURE';
  };

  const addedEntries: any[] = [];
  let skippedCount = 0;

  const tryAddEntry = (candidate: {
    element_type: 'PDR' | 'COMPONENT' | 'PART';
    ref_element: string;
    designation: string;
    qte_montee: number;
    criticalite: string;
    emplacement_machine: string;
    parent_component_key?: string;
  }) => {
    const refClean = String(candidate.ref_element || '').trim();
    const refNorm = normalizeToken(refClean);
    if (!refNorm) return;

    if (existingRefsForMachine.has(refNorm)) {
      skippedCount++;
      return;
    }

    existingRefsForMachine.add(refNorm);
    const seqIdx = addedEntries.length + 1;
    addedEntries.push({
      id: `BOM-${machineId}-${refClean.replace(/[^a-zA-Z0-9]/g, '')}-${seqIdx}`,
      id_machine_registered: machineId,
      element_type: candidate.element_type,
      ref_element: refClean,
      designation: candidate.designation || refClean,
      qte_montee: Math.max(1, Number(candidate.qte_montee) || 1),
      unite: 'U',
      criticalite: candidate.criticalite || 'CRITIQUE',
      duree_vie_estimee_heures: 5000,
      heures_actuelles: 0,
      date_installation: today,
      emplacement_machine: candidate.emplacement_machine || '',
      ...(candidate.parent_component_key
        ? { parent_component_key: candidate.parent_component_key }
        : {}),
      technicien: defaultTech,
      statut: 'OPERATIONNEL',
      remarques: `Initialisé depuis Blueprint ${bpId}`,
    });
  };

  // 1. Theoretical PDRs from Blueprint
  if (Array.isArray(matchedBlueprint.pdr_theoriques)) {
    matchedBlueprint.pdr_theoriques.forEach((p: any) => {
      if (!p) return;
      const ref = String(p.id_pdr || p.ref || p.code || '').trim();
      if (!ref) return;
      const stockMatch = Array.isArray(stockItems)
        ? stockItems.find(
            (s) => s && normalizeToken(s.ref || s.id_article || s.code) === normalizeToken(ref)
          )
        : null;
      const parentKey = String(p.parent_component_key || p.parent_component_code || '').trim();
      tryAddEntry({
        element_type: 'PDR',
        ref_element: ref,
        designation: String(
          p.libelle || p.designation || stockMatch?.designation || stockMatch?.nom || ref
        ).trim(),
        qte_montee: Number(p.qte) || 1,
        criticalite: mapCriticite(p.criticite || 'Haute'),
        emplacement_machine: parentKey || String(p.emplacement || '').trim(),
        parent_component_key: parentKey || undefined,
      });
    });
  }

  // 2. Theoretical Components from Blueprint (recorded as COMPONENT entries in ledger — zero warehouse stock mutation)
  if (Array.isArray(matchedBlueprint.components_theoriques)) {
    matchedBlueprint.components_theoriques.forEach((c: any) => {
      if (!c) return;
      const ref = String(c.id_component || c.ref || c.code || c.id || '').trim();
      if (!ref) return;
      tryAddEntry({
        element_type: 'COMPONENT',
        ref_element: ref,
        designation: String(c.libelle || c.designation || c.nom || ref).trim(),
        qte_montee: Number(c.qte) || 1,
        criticalite: mapCriticite(c.criticite || 'Majeure'),
        emplacement_machine: String(c.emplacement || c.libelle || '').trim(),
      });
    });
  }

  // 3. Theoretical Structural Parts from Blueprint (if defined)
  if (Array.isArray(matchedBlueprint.parts_theoriques)) {
    matchedBlueprint.parts_theoriques.forEach((pt: any) => {
      if (!pt) return;
      const ref = String(pt.id_part || pt.ref || pt.code || pt.id || '').trim();
      if (!ref) return;
      tryAddEntry({
        element_type: 'PART',
        ref_element: ref,
        designation: String(pt.libelle || pt.designation || pt.nom || ref).trim(),
        qte_montee: Number(pt.qte) || 1,
        criticalite: mapCriticite(pt.criticite || 'Majeure'),
        emplacement_machine: String(pt.emplacement || pt.libelle || '').trim(),
      });
    });
  }

  return {
    addedEntries,
    skippedCount,
    blueprintId: bpId,
  };
}

/**
 * N4 — Post-Sortie Ledger Reset Helper:
 * Finds the matching `machineElementsLedger` record for a completed `Sortie` movement on `id_machine_registered` + `ref`
 * (or explicit `ledgerElementId`) and resets its wear counter (`heures_actuelles = 0`), `date_installation`, and `statut = 'OPERATIONNEL'`.
 */
export function applyReplacementMovementToLedger(
  machineElementsLedger: any[] = [],
  movementPayload: {
    id_machine_registered?: string;
    ref?: string;
    date?: string;
    technicien?: string;
    ledgerElementId?: string;
  } = {}
): {
  updatedLedger: any[];
  updatedElement: any | null;
} {
  if (!Array.isArray(machineElementsLedger) || machineElementsLedger.length === 0) {
    return { updatedLedger: [], updatedElement: null };
  }

  const targetMachNorm = normalizeToken(movementPayload.id_machine_registered);
  const targetRefNorm = normalizeToken(movementPayload.ref);
  const targetId = String(movementPayload.ledgerElementId || '').trim();

  if (!targetId && (!targetMachNorm || !targetRefNorm)) {
    return { updatedLedger: machineElementsLedger, updatedElement: null };
  }

  const installDate = movementPayload.date || new Date().toISOString().slice(0, 10);
  let updatedElement: any | null = null;

  const updatedLedger = machineElementsLedger.map((item) => {
    if (!item || updatedElement) return item;

    const matchById = targetId && String(item.id || '').trim() === targetId;
    const itemMachNorm = normalizeToken(
      item.id_machine_registered || item.id_machine || item.code_machine
    );
    const itemRefNorm = normalizeToken(item.ref_element || item.ref);
    const matchByMachAndRef =
      Boolean(targetMachNorm && targetRefNorm) &&
      itemMachNorm === targetMachNorm &&
      itemRefNorm === targetRefNorm;

    if (matchById || matchByMachAndRef) {
      updatedElement = {
        ...item,
        heures_actuelles: 0,
        date_installation: installDate,
        technicien: movementPayload.technicien || item.technicien || 'Technicien',
        statut: 'OPERATIONNEL',
      };
      return updatedElement;
    }
    return item;
  });

  return { updatedLedger, updatedElement };
}

export function doesTaskMatchBlueprint(
  task: any,
  blueprintId: string,
  machines: any[] = []
): boolean {
  if (!blueprintId || blueprintId === 'ALL') return true;
  if (!task) return false;

  const targetBp = String(blueprintId).trim();
  if (task.id_blueprint && String(task.id_blueprint).trim() === targetBp) {
    return true;
  }

  const taskMachId = String(task.id_machine || task.code_machine || '')
    .trim()
    .toUpperCase();
  if (!taskMachId || !Array.isArray(machines)) return false;

  const norm = (s: any) =>
    String(s || '')
      .trim()
      .toUpperCase()
      .replace(/[-_\s]/g, '');
  const taskMachNorm = norm(taskMachId);

  const matchedMachine = machines.find((m) => {
    if (!m) return false;
    const mId = m.id_machine_registered || m.code_machine || m.id || m.id_machine || m.code;
    return String(mId || '').trim().toUpperCase() === taskMachId || norm(mId) === taskMachNorm;
  });

  return Boolean(matchedMachine && String(matchedMachine.id_blueprint || '').trim() === targetBp);
}

export function filterTasksByBlueprint(
  tasks: any[] = [],
  blueprintId: string,
  machines: any[] = []
): any[] {
  if (!Array.isArray(tasks)) return [];
  if (!blueprintId || blueprintId === 'ALL') return tasks;
  return tasks.filter((t) => doesTaskMatchBlueprint(t, blueprintId, machines));
}

export function getBlueprintCommonFailuresForMachine(
  machineCodeOrObj: any,
  machines: any[] = [],
  blueprints: any[] = []
): BlueprintCommonFailureItem[] {
  if (!machineCodeOrObj || !Array.isArray(blueprints) || blueprints.length === 0) {
    return [];
  }

  let bpId = '';
  if (typeof machineCodeOrObj === 'object' && machineCodeOrObj !== null) {
    bpId = String(machineCodeOrObj.id_blueprint || '').trim();
  }

  if (!bpId) {
    const targetCode = String(
      typeof machineCodeOrObj === 'object'
        ? machineCodeOrObj.code || machineCodeOrObj.id_machine_registered || machineCodeOrObj.id || ''
        : machineCodeOrObj
    )
      .trim()
      .toUpperCase();
    if (!targetCode) return [];

    const norm = (s: any) =>
      String(s || '')
        .trim()
        .toUpperCase()
        .replace(/[-_\s]/g, '');
    const targetNorm = norm(targetCode);

    const activeMachines = filterActiveMachines(machines);
    const matchedMachine = activeMachines.find((m) => {
      if (!m) return false;
      const mId = m.id_machine_registered || m.code_machine || m.code || m.id || m.id_machine;
      return String(mId || '').trim().toUpperCase() === targetCode || norm(mId) === targetNorm;
    });

    if (!matchedMachine || !matchedMachine.id_blueprint) return [];
    bpId = String(matchedMachine.id_blueprint).trim();
  }

  if (!bpId) return [];
  const matchedBlueprint = blueprints.find(
    (b) => b && String(b.id_blueprint || b.id || '').trim() === bpId
  );
  if (!matchedBlueprint || !Array.isArray(matchedBlueprint.commonFailures)) {
    return [];
  }
  return matchedBlueprint.commonFailures;
}

export class Blueprint {
  id: any;
  specs: any;
  components_theoriques: any[];
  parts_theoriques: any[];
  pdr_theoriques: any[];
  preventivePlanItems: BlueprintPreventivePlanItem[];
  commonFailures: BlueprintCommonFailureItem[];

  constructor(data: any = {}) {
    this.id = data.id_blueprint || data.id;
    this.specs = data.specs || {};
    this.components_theoriques = data.components_theoriques || [];
    this.parts_theoriques = data.parts_theoriques || [];
    this.pdr_theoriques = data.pdr_theoriques || [];
    this.preventivePlanItems = Array.isArray(data.preventivePlanItems)
      ? data.preventivePlanItems
      : [];
    this.commonFailures = Array.isArray(data.commonFailures) ? data.commonFailures : [];
  }

  isSameSpecs(other: any) {
    const clean = (s: any) =>
      Object.fromEntries(
        Object.entries(s || {}).filter(([_, v]) => v != null && String(v).trim() !== '')
      );
    return JSON.stringify(clean(this.specs)) === JSON.stringify(clean(other.specs));
  }

  isTwin(other: any) {
    const key = (arr: any[], field: string) =>
      JSON.stringify(
        [...(arr || [])]
          .map((x) => ({ id: String(x[field] || '').trim(), q: Number(x.qte || 1) }))
          .sort((a, b) => a.id.localeCompare(b.id))
      );
    return (
      this.isSameSpecs(other) &&
      key(this.components_theoriques, 'id_component') ===
        key(other.components_theoriques || other.components_reels, 'id_component') &&
      key(this.parts_theoriques, 'id_part') ===
        key(other.parts_theoriques || other.parts_reels, 'id_part') &&
      key(this.pdr_theoriques, 'id_pdr') ===
        key(other.pdr_theoriques || other.pdr_historique, 'id_pdr')
    );
  }

  extractFromNexus(machine: any, mouvements: any[]) {
    const related = mouvements.filter(
      (m) => m.id_machine_registered === machine.id_machine_registered
    );
    this.components_theoriques = machine.components_reels || [];
    this.pdr_theoriques = related.map((m) => ({
      id_pdr: m.ref || m.id_article,
      qte: 1,
      criticite: 'Moyenne',
    }));
  }

  getMachinesLiees(machines: any[] = []) {
    return (machines || []).filter((m) => m.id_blueprint === this.id);
  }

  getActiveMachinesLiees(machines: any[] = []) {
    return filterActiveMachines(machines).filter((m) => m.id_blueprint === this.id);
  }

  getMachinesLieesCount(machines: any[] = []) {
    return this.getMachinesLiees(machines).length;
  }

  getBOMSummary() {
    return `Comp:${this.components_theoriques.length} Parts:${this.parts_theoriques.length} PDR:${this.pdr_theoriques.length} PM:${this.preventivePlanItems.length}`;
  }
}