import type {
  IStockItem,
  IMouvement,
  IMachine,
  IZone,
  ITechnician,
  IOperation,
} from '../../../../types/domain';
import type {
  PreventiveTaskItem,
  CorrectiveInterventionItem,
} from '../../../../types/store';

export interface DiscoveredAuditItem {
  code: string;
  count: number;
  sourceList: string;
  sample?: string;
  inferredRole?: 'CHEF' | 'OPERATEUR' | 'TECHNICIEN';
  entityType: 'machine' | 'article' | 'zone' | 'user';
}

interface DiscoveredCandidateAccumulator {
  count: number;
  sources: Set<string>;
  sample: string;
}

interface DiscoveredUserAccumulator {
  count: number;
  techCount: number;
  opCount: number;
  demandeurCount: number;
  sources: Set<string>;
}

export interface ComputeDiscoveredAuditItemsInput {
  auditTarget: string;
  mouvements: IMouvement[];
  rawStock: IStockItem[];
  machines: IMachine[];
  zones: IZone[];
  technicians: ITechnician[];
  operations: IOperation[];
  correctiveInterventions: CorrectiveInterventionItem[];
  preventiveTasks: PreventiveTaskItem[];
}

export function computeDiscoveredAuditItems({
  auditTarget,
  mouvements,
  rawStock,
  machines,
  zones,
  technicians,
  operations,
  correctiveInterventions,
  preventiveTasks,
}: ComputeDiscoveredAuditItemsInput): DiscoveredAuditItem[] {
  const candidates: Record<string, DiscoveredCandidateAccumulator> = {};

  if (auditTarget === 'machines') {
    const registeredIds = new Set(
      (machines || [])
        .map((m: IMachine) => String(m.id_machine_registered || '').toLowerCase().trim())
        .filter(Boolean)
    );

    (mouvements || []).forEach((m: IMouvement, idx: number) => {
      const code = String(m.id_machine_registered || '').trim();
      if (code && !registeredIds.has(code.toLowerCase())) {
        if (!candidates[code]) {
          candidates[code] = { count: 0, sources: new Set<string>(), sample: `Mouvement #${idx + 1}` };
        }
        candidates[code].count += 1;
        candidates[code].sources.add('Mouvements');
      }
    });

    (correctiveInterventions || []).forEach((ci: CorrectiveInterventionItem) => {
      const code = String(ci.id_machine || ci.machine_id || '').trim();
      if (code && !registeredIds.has(code.toLowerCase())) {
        if (!candidates[code]) {
          candidates[code] = {
            count: 0,
            sources: new Set<string>(),
            sample: `Correctif (${ci.id || ci.code_bon || 'BT'})`,
          };
        }
        candidates[code].count += 1;
        candidates[code].sources.add('Correctif Hub');
      }
    });

    (preventiveTasks || []).forEach((pt: PreventiveTaskItem) => {
      const code = String(pt.machine_id || pt.id_machine || '').trim();
      if (code && !registeredIds.has(code.toLowerCase())) {
        if (!candidates[code]) {
          candidates[code] = {
            count: 0,
            sources: new Set<string>(),
            sample: `Préventif (${pt.id || pt.code || 'Tâche'})`,
          };
        }
        candidates[code].count += 1;
        candidates[code].sources.add('Planning Préventif');
      }
    });

    const mchRegex = /\b([A-Z]{2,4}-\d{2,3}|[A-Z]{2,4}-\d{1,2})\b/gi;
    const scanTexts = (text: string | undefined, sourceLabel: string) => {
      if (!text) return;
      let match: RegExpExecArray | null;
      mchRegex.lastIndex = 0;
      while ((match = mchRegex.exec(text)) !== null) {
        const code = match[1].toUpperCase();
        if (
          [
            'B1', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6',
            'A1', 'A2', 'A3', 'A4', 'A5', 'A6',
            'REF', 'TPL', 'FAM', 'ZONE', 'TECH', 'CHEF', 'OP', 'MCH', 'PDR', 'STOCK',
          ].includes(code)
        ) {
          continue;
        }

        if (!registeredIds.has(code.toLowerCase())) {
          if (!candidates[code]) {
            candidates[code] = { count: 0, sources: new Set<string>(), sample: sourceLabel };
          }
          candidates[code].count += 1;
          candidates[code].sources.add(sourceLabel);
        }
      }
    };

    (mouvements || []).forEach((m: IMouvement, idx: number) => {
      scanTexts(m.commentaire, `Commentaire Mvt #${idx + 1}`);
    });

    return Object.entries(candidates)
      .map(([code, meta]) => ({
        code,
        count: meta.count,
        sourceList: Array.from(meta.sources).join(', '),
        sample: meta.sample,
        entityType: 'machine' as const,
      }))
      .sort((a, b) => b.count - a.count);
  } else if (auditTarget === 'articles') {
    const registeredRefs = new Set(
      (rawStock || [])
        .map((s: IStockItem) => String(s.ref || '').toUpperCase().trim())
        .filter(Boolean)
    );

    (mouvements || []).forEach((m: IMouvement, idx: number) => {
      const ref = String(m.ref || '').trim();
      if (ref && !registeredRefs.has(ref.toUpperCase())) {
        if (!candidates[ref]) {
          candidates[ref] = {
            count: 0,
            sources: new Set<string>(),
            sample: `Mvt #${idx + 1} (${m.type || 'Mvt'} ${m.quantite || 1})`,
          };
        }
        candidates[ref].count += 1;
        candidates[ref].sources.add('Journal Mouvements');
      }
    });

    return Object.entries(candidates)
      .map(([code, meta]) => ({
        code,
        count: meta.count,
        sourceList: Array.from(meta.sources).join(', '),
        sample: meta.sample,
        entityType: 'article' as const,
      }))
      .sort((a, b) => b.count - a.count);
  } else if (auditTarget === 'zones') {
    const registeredZones = new Set(
      [
        ...(zones || []).map((z: IZone) => String(z.id_zone || '').toLowerCase().trim()),
        ...(zones || []).map((z: IZone) => String(z.libelle || '').toLowerCase().trim()),
        ...(zones || []).map((z: IZone) => String(z.nom || '').toLowerCase().trim()),
      ].filter(Boolean)
    );

    (mouvements || []).forEach((m: IMouvement, idx: number) => {
      const code = String(m.id_zone || '').trim();
      if (code && !registeredZones.has(code.toLowerCase())) {
        if (!candidates[code]) {
          candidates[code] = { count: 0, sources: new Set<string>(), sample: `Mouvement #${idx + 1}` };
        }
        candidates[code].count += 1;
        candidates[code].sources.add('Mouvements');
      }
    });

    (machines || []).forEach((m: IMachine) => {
      const code = String(m.id_zone_default || m.id_zone || '').trim();
      if (code && !registeredZones.has(code.toLowerCase())) {
        if (!candidates[code]) {
          candidates[code] = {
            count: 0,
            sources: new Set<string>(),
            sample: `Machine ${m.id_machine_registered}`,
          };
        }
        candidates[code].count += 1;
        candidates[code].sources.add('Parc Machines');
      }
    });

    return Object.entries(candidates)
      .map(([code, meta]) => ({
        code,
        count: meta.count,
        sourceList: Array.from(meta.sources).join(', '),
        sample: meta.sample,
        entityType: 'zone' as const,
      }))
      .sort((a, b) => b.count - a.count);
  } else if (auditTarget === 'utilisateurs') {
    const registeredNames = new Set(
      [
        ...(technicians || []).map((t: ITechnician) => String(t.nom || '').toLowerCase().trim()),
        ...(technicians || []).map((t: ITechnician) => String(t.id_technician || '').toLowerCase().trim()),
        ...(operations || []).map((o: IOperation) => String(o.nom || '').toLowerCase().trim()),
        ...(operations || []).map((o: IOperation) => String(o.id_operation || '').toLowerCase().trim()),
      ].filter(Boolean)
    );

    const userMap: Record<string, DiscoveredUserAccumulator> = {};
    const addCandidate = (rawName: string | undefined, sourceField: string) => {
      if (!rawName) return;
      const name = String(rawName).trim();
      if (!name) return;
      if (registeredNames.has(name.toLowerCase())) return;
      if (/^(OP-|CHEF-|TECH-)/i.test(name)) return;

      if (!userMap[name]) {
        userMap[name] = {
          count: 0,
          techCount: 0,
          opCount: 0,
          demandeurCount: 0,
          sources: new Set<string>(),
        };
      }
      userMap[name].count += 1;
      userMap[name].sources.add(sourceField);
      if (sourceField === 'Technicien') userMap[name].techCount += 1;
      if (sourceField === 'Opération/Chef') userMap[name].opCount += 1;
      if (sourceField === 'Demandeur') userMap[name].demandeurCount += 1;
    };

    (mouvements || []).forEach((m: IMouvement) => {
      if (m.technicien) addCandidate(m.technicien, 'Technicien');
      if (m.operation) addCandidate(m.operation, 'Opération/Chef');
      if (m.demandeur) addCandidate(String(m.demandeur), 'Demandeur');
    });

    (correctiveInterventions || []).forEach((ci: CorrectiveInterventionItem) => {
      if (ci.technicien_id || ci.technicien)
        addCandidate(String(ci.technicien_id || ci.technicien), 'Technicien');
      if (ci.demandeur) addCandidate(ci.demandeur, 'Demandeur');
    });

    (machines || []).forEach((m: IMachine) => {
      if (m.technician) addCandidate(m.technician, 'Parc Machine');
    });

    return Object.entries(userMap)
      .map(([name, meta]) => {
        let inferredRole: 'CHEF' | 'OPERATEUR' | 'TECHNICIEN';
        if (/\bchef\b/i.test(name) || /\bsuperviseur\b/i.test(name)) {
          inferredRole = 'CHEF';
        } else if (/\bop/i.test(name) || /\bopér/i.test(name) || meta.opCount > meta.techCount) {
          inferredRole = 'OPERATEUR';
        } else {
          inferredRole = 'TECHNICIEN';
        }
        const sourceList = Array.from(meta.sources).join(', ');
        return {
          code: name,
          count: meta.count,
          inferredRole,
          sourceList,
          entityType: 'user' as const,
        };
      })
      .sort((a, b) => b.count - a.count);
  } else if (auditTarget === 'correctif') {
    const registeredMachines = new Set(
      (machines || [])
        .map((m: IMachine) => String(m.id_machine_registered || '').toUpperCase().trim())
        .filter(Boolean)
    );
    (correctiveInterventions || []).forEach((ci: CorrectiveInterventionItem) => {
      const mKey = String(ci.id_machine || ci.machine_id || '').trim();
      if (mKey && !registeredMachines.has(mKey.toUpperCase())) {
        if (!candidates[mKey]) {
          candidates[mKey] = {
            count: 0,
            sources: new Set<string>(),
            sample: `Intervention ${ci.id || ci.code_bon || 'Sans ID'}`,
          };
        }
        candidates[mKey].count += 1;
        candidates[mKey].sources.add('Bons de Travail');
      }
    });
    return Object.entries(candidates)
      .map(([code, meta]) => ({
        code,
        count: meta.count,
        sourceList: Array.from(meta.sources).join(', '),
        sample: meta.sample,
        entityType: 'machine' as const,
      }))
      .sort((a, b) => b.count - a.count);
  } else if (auditTarget === 'preventif') {
    const registeredMachines = new Set(
      (machines || [])
        .map((m: IMachine) => String(m.id_machine_registered || '').toUpperCase().trim())
        .filter(Boolean)
    );
    (preventiveTasks || []).forEach((pt: PreventiveTaskItem) => {
      const mKey = String(pt.machine_id || pt.id_machine || '').trim();
      if (mKey && !registeredMachines.has(mKey.toUpperCase())) {
        if (!candidates[mKey]) {
          candidates[mKey] = {
            count: 0,
            sources: new Set<string>(),
            sample: `Tâche ${pt.id || pt.code || 'Sans ID'}`,
          };
        }
        candidates[mKey].count += 1;
        candidates[mKey].sources.add('Tâches Préventives');
      }
    });
    return Object.entries(candidates)
      .map(([code, meta]) => ({
        code,
        count: meta.count,
        sourceList: Array.from(meta.sources).join(', '),
        sample: meta.sample,
        entityType: 'machine' as const,
      }))
      .sort((a, b) => b.count - a.count);
  }

  return [];
}

export function getNextUserIdFromCatalog(
  type: string,
  technicians: ITechnician[],
  operations: IOperation[]
): string {
  if (type === 'TECHNICIEN') {
    const nums = technicians
      .map((t: ITechnician) => {
        const m = String(t.id_technician || '').match(/TECH-(\d+)/i);
        return m ? parseInt(m[1], 10) : 0;
      })
      .filter((n: number) => !isNaN(n));
    const max = nums.length > 0 ? Math.max(...nums) : 0;
    return `TECH-${String(max + 1).padStart(2, '0')}`;
  } else if (type === 'OPERATEUR') {
    const nums = operations
      .filter((o: IOperation) => o.type_profil === 'OPERATEUR')
      .map((o: IOperation) => {
        const m = String(o.id_operation || '').match(/OP-(\d+)/i);
        return m ? parseInt(m[1], 10) : 0;
      })
      .filter((n: number) => !isNaN(n));
    const max = nums.length > 0 ? Math.max(...nums) : 0;
    return `OP-${String(max + 1).padStart(2, '0')}`;
  } else if (type === 'CHEF') {
    const nums = operations
      .filter((o: IOperation) => o.type_profil === 'CHEF')
      .map((o: IOperation) => {
        const m = String(o.id_operation || '').match(/CHEF-(\d+)/i);
        return m ? parseInt(m[1], 10) : 0;
      })
      .filter((n: number) => !isNaN(n));
    const max = nums.length > 0 ? Math.max(...nums) : 0;
    return `CHEF-${String(max + 1).padStart(2, '0')}`;
  }
  return '';
}

export function getNextZoneIdFromCatalog(zones: IZone[]): string {
  const nums = zones
    .map((z: IZone) => {
      const m = String(z.id_zone || '').match(/ZONE-(\d+)/i);
      return m ? parseInt(m[1], 10) : 0;
    })
    .filter((n: number) => !isNaN(n));
  const max = nums.length > 0 ? Math.max(...nums) : 0;
  return `ZONE-${String(max + 1).padStart(2, '0')}`;
}
