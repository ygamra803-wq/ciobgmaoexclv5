import fs from 'fs';
import path from 'path';
import { beforeEach, describe, expect, it } from 'vitest';
import { DataGateway } from '../../application/DataGateway';
import reactiveEngine from '../../services/reactiveCalculationEngine';
import {
  exportAssetsMachinesBundle,
  exportRefParcBundle,
  runUnifiedImportPipeline,
  validateAndCommitAssetsMachinesBundle,
  validateAndCommitRefParcBundle,
} from '../../services/import/unifiedImportPipeline';
import { useGmaoStore } from '../../store/useGmaoStore';

function collectProductionFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let results: string[] = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'tests' || e.name === '__tests__' || e.name === 'data') continue;
      results = results.concat(collectProductionFiles(full));
    } else if (
      /\.(ts|tsx)$/.test(e.name) &&
      !e.name.endsWith('.test.ts') &&
      !e.name.endsWith('.test.tsx')
    ) {
      results.push(full);
    }
  }
  return results;
}

describe('UnifiedImportPipeline & Backdoor Closure (REF_PARC & ASSETS_MACHINES)', () => {
  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    await DataGateway.clearAllForRealFactory(useGmaoStore.getState());
  });

  describe('1. Backdoor Closure & SSOT Hygiene', () => {
    it('enforces that DataGateway.ts is the ONLY production module importing src/data/*.json', () => {
      const srcDir = path.resolve(process.cwd(), 'src');
      const prodFiles = collectProductionFiles(srcDir);
      const offenders: string[] = [];

      for (const file of prodFiles) {
        const rel = path.relative(srcDir, file).replace(/\\/g, '/');
        if (rel === 'application/DataGateway.ts') continue;
        const content = fs.readFileSync(file, 'utf8');
        if (/from\s+['"][^'"]*data\/[^'"]+\.json['"]/.test(content)) {
          offenders.push(rel);
        }
      }

      expect(offenders).toEqual([]);
      expect(fs.existsSync(path.resolve(srcDir, 'data/machines/seedZones.json'))).toBe(false);
      expect(fs.existsSync(path.resolve(srcDir, 'data/responsableTemplates.ts'))).toBe(false);
      expect(fs.existsSync(path.resolve(srcDir, 'domain/users/responsableTemplates.ts'))).toBe(
        true
      );
    });

    it('never silently injects seed stockInitial when an imported item omits stockInitial', () => {
      const computed = reactiveEngine.recalculateStockReactive(
        [
          {
            ref: 'Raccord01', // Exists in seedStockItems.json with non-zero stockInitial
            designation: 'Raccord Test',
            seuil: 2,
          } as any,
        ],
        []
      );

      expect(computed).toHaveLength(1);
      expect(computed[0].stockInitial).toBe(0);
      expect(computed[0].stockActuel).toBe(0);
    });
  });

  describe('2. REF_PARC Bundle (ZONES -> FAMILIES -> TEMPLATES -> GENERAL_SYSTEM_TYPES)', () => {
    it('validates and commits a clean REF_PARC bundle in dependency order with normalized code_zone', () => {
      const report = validateAndCommitRefParcBundle({
        zones: [
          { code_zone: ' detourag ', libelle: 'Détourage', description: 'Atelier Détourage' },
          { code_zone: 'Z-UTILITY', libelle: 'Salle Compresseurs & Utilités' },
        ],
        families: [
          { code_family: 'FAM-CNC', libelle: "Centres d'usinage" },
          { code_family: 'FAM-PRESSE', libelle: 'Presses Hydrauliques' },
        ],
        templates: [
          {
            code_template: 'TPL-CNC-3AX',
            code_family: 'FAM-CNC',
            libelle: 'CNC 3 axes standard',
            constructeur: 'SCM',
          },
        ],
        generalSystemTypes: [{ code_system_type: 'SYS-AIR', libelle: 'Air Comprimé' }],
      });

      expect(report.success).toBe(true);
      expect(report.committed).toBe(true);
      expect(report.rejected).toHaveLength(0);

      const state = useGmaoStore.getState();
      expect(state.zones).toHaveLength(2);
      expect(state.zones[0].code_zone).toBe('DETOURAG');
      expect(state.zones[0].id_zone).toBe('DETOURAG');
      expect(state.families).toHaveLength(2);
      expect(state.templates).toHaveLength(1);
      expect(state.templates[0].famille_lib).toBe("Centres d'usinage");
      expect(state.generalSystemTypes).toHaveLength(1);
    });

    it('rejects a template referencing a non-existent family (BROKEN_FK) with zero store writes', () => {
      const report = validateAndCommitRefParcBundle({
        zones: [{ code_zone: 'Z-SCIAGE', libelle: 'Atelier Sciage' }],
        families: [{ code_family: 'FAM-CNC', libelle: "Centres d'usinage" }],
        templates: [
          {
            code_template: 'TPL-ORPHAN',
            code_family: 'FAM-NON-EXISTENT',
            libelle: 'Modèle Orphelin',
          },
        ],
      });

      expect(report.success).toBe(false);
      expect(report.committed).toBe(false);
      expect(report.rejected).toHaveLength(1);
      expect(report.rejected[0].code).toBe('BROKEN_FK');
      expect(report.rejected[0].stage).toBe('03_TEMPLATES');

      // Atomic rollback guarantee: store remains empty
      expect(useGmaoStore.getState().zones).toHaveLength(0);
      expect(useGmaoStore.getState().families).toHaveLength(0);
      expect(useGmaoStore.getState().templates).toHaveLength(0);
    });

    it('rejects pseudo-zones like DIVERS and forbids embedding machines inside REF_PARC', () => {
      const report = validateAndCommitRefParcBundle({
        zones: [{ code_zone: 'DIVERS', libelle: 'Divers' }],
        machines: [{ code_machine: 'M-01', designation: 'Test', code_zone: 'DIVERS' }],
      } as any);

      expect(report.success).toBe(false);
      expect(report.committed).toBe(false);
      expect(report.rejected.map((r) => r.code)).toContain('FORBIDDEN_BUNDLE_FIELD');
      expect(report.rejected.map((r) => r.code)).toContain('SCHEMA_MISMATCH');
    });
  });

  describe('3. ASSETS_MACHINES Bundle (Dependency Gate, Zone Compatibility & Hierarchy Validation)', () => {
    beforeEach(() => {
      validateAndCommitRefParcBundle({
        zones: [
          { code_zone: 'DETOURAG', libelle: 'Détourage' },
          { code_zone: 'Z-SCIAGE', libelle: 'Atelier Sciage' },
          { code_zone: 'Z-UTILITY', libelle: 'Utilités' },
        ],
        families: [
          { code_family: 'FAM-CNC', libelle: "Centres d'usinage" },
          { code_family: 'FAM-PRESSE', libelle: 'Presses Hydrauliques' },
        ],
        templates: [
          { code_template: 'TPL-CNC-3AX', code_family: 'FAM-CNC', libelle: 'CNC 3 axes' },
          { code_template: 'TPL-PRH-200T', code_family: 'FAM-PRESSE', libelle: 'Presse 200T' },
        ],
        generalSystemTypes: [{ code_system_type: 'SYS-AIR', libelle: 'Air Comprimé' }],
      });
    });

    it('accepts PRODUCTION and SYSTEM_GENERAL machines when all references are valid', () => {
      const report = validateAndCommitAssetsMachinesBundle({
        machines: [
          {
            code_machine: 'CNC-01',
            designation: 'Centre usinage ligne A',
            code_zone: 'Z-SCIAGE',
            asset_class: 'PRODUCTION',
            code_family: 'FAM-CNC',
            code_template: 'TPL-CNC-3AX',
          },
          {
            code_machine: 'AIR-01',
            designation: 'Compresseur principal',
            code_zone: 'Z-UTILITY',
            asset_class: 'SYSTEM_GENERAL',
            code_system_type: 'SYS-AIR',
          },
        ],
      });

      expect(report.success).toBe(true);
      expect(report.committed).toBe(true);
      expect(report.rejected).toHaveLength(0);

      const machines = useGmaoStore.getState().machines;
      expect(machines).toHaveLength(2);
      const cnc = machines.find((m) => m.id_machine_registered === 'CNC-01');
      const air = machines.find((m) => m.id_machine_registered === 'AIR-01');
      expect(cnc?.asset_class).toBe('PRODUCTION');
      expect(cnc?.id_family).toBe('FAM-CNC');
      expect(air?.asset_class).toBe('SYSTEM_GENERAL');
      expect(air?.id_general_system_type).toBe('SYS-AIR');
    });

    it('normalizes legacy zone libelle ("Détourage") to canonical code_zone ("DETOURAG") and emits a LEGACY_ZONE_NORMALIZED warning', () => {
      const report = validateAndCommitAssetsMachinesBundle({
        machines: [
          {
            code_machine: 'DET-01',
            designation: 'Détoureuse CNC 1',
            code_zone: 'Détourage', // Legacy label instead of canonical DETOURAG
            asset_class: 'PRODUCTION',
            code_family: 'FAM-CNC',
            code_template: 'TPL-CNC-3AX',
          },
        ],
      });

      expect(report.success).toBe(true);
      expect(report.committed).toBe(true);
      expect(report.warnings).toHaveLength(1);
      expect(report.warnings[0].code).toBe('LEGACY_ZONE_NORMALIZED');

      const det01 = useGmaoStore
        .getState()
        .machines.find((m) => m.id_machine_registered === 'DET-01');
      expect(det01?.id_zone_default).toBe('DETOURAG');
      expect(det01?.id_zone).toBe('DETOURAG');
    });

    it('rejects broken zone FK, missing family, and template-family mismatch without committing', () => {
      const report = validateAndCommitAssetsMachinesBundle({
        machines: [
          {
            code_machine: 'X-01',
            designation: 'Machine Zone Inconnue',
            code_zone: 'Z-NOEXIST',
            asset_class: 'PRODUCTION',
            code_family: 'FAM-CNC',
            code_template: 'TPL-CNC-3AX',
          },
          {
            code_machine: 'X-02',
            designation: 'Machine Famille Inconnue',
            code_zone: 'Z-SCIAGE',
            asset_class: 'PRODUCTION',
            code_family: 'FAM-MEC',
            code_template: 'TPL-CNC-3AX',
          },
          {
            code_machine: 'X-03',
            designation: 'Machine Modèle Incohérent',
            code_zone: 'Z-SCIAGE',
            asset_class: 'PRODUCTION',
            code_family: 'FAM-PRESSE',
            code_template: 'TPL-CNC-3AX', // Belongs to FAM-CNC!
          },
        ],
      });

      expect(report.success).toBe(false);
      expect(report.committed).toBe(false);
      expect(report.rejected).toHaveLength(3);
      expect(report.rejected.map((r) => r.code)).toEqual([
        'BROKEN_FK',
        'BROKEN_FK',
        'TEMPLATE_FAMILY_MISMATCH',
      ]);
      expect(useGmaoStore.getState().machines).toHaveLength(0);
    });

    it('detects circular parent_code_machine hierarchy and blocks commit, while allowing valid child-before-parent order without inheriting zone/family', () => {
      const cycleReport = validateAndCommitAssetsMachinesBundle({
        machines: [
          {
            code_machine: 'LINE-A',
            designation: 'Ligne A',
            code_zone: 'Z-SCIAGE',
            asset_class: 'PRODUCTION',
            code_family: 'FAM-CNC',
            code_template: 'TPL-CNC-3AX',
            asset_level: 'LINE',
            parent_code_machine: 'CNC-02',
          },
          {
            code_machine: 'CNC-02',
            designation: 'Machine CNC 02',
            code_zone: 'Z-SCIAGE',
            asset_class: 'PRODUCTION',
            code_family: 'FAM-CNC',
            code_template: 'TPL-CNC-3AX',
            parent_code_machine: 'LINE-A',
          },
        ],
      });

      expect(cycleReport.success).toBe(false);
      expect(cycleReport.committed).toBe(false);
      expect(cycleReport.rejected.some((r) => r.code === 'CIRCULAR_HIERARCHY')).toBe(true);

      // Valid child-before-parent order in same file without inheriting parent's zone or family
      const validHierarchyReport = validateAndCommitAssetsMachinesBundle({
        machines: [
          {
            code_machine: 'CHILD-PRESS-01',
            designation: 'Presse Finition',
            code_zone: 'DETOURAG',
            asset_class: 'PRODUCTION',
            code_family: 'FAM-PRESSE',
            code_template: 'TPL-PRH-200T',
            asset_level: 'MACHINE',
            parent_code_machine: 'LINE-MASTER',
          },
          {
            code_machine: 'LINE-MASTER',
            designation: 'Ligne Principale Sciage',
            code_zone: 'Z-SCIAGE',
            asset_class: 'PRODUCTION',
            code_family: 'FAM-CNC',
            code_template: 'TPL-CNC-3AX',
            asset_level: 'LINE',
          },
        ],
      });

      expect(validHierarchyReport.success).toBe(true);
      const child = useGmaoStore
        .getState()
        .machines.find((m) => m.id_machine_registered === 'CHILD-PRESS-01');
      expect(child?.parent_id).toBe('LINE-MASTER');
      expect(child?.id_zone_default).toBe('DETOURAG'); // Preserves own zone, not parent's Z-SCIAGE
      expect(child?.id_family).toBe('FAM-PRESSE'); // Preserves own family, not parent's FAM-CNC
    });

    it('guards REPLACE_CATALOG when an existing machine is referenced by corrective BTs or movements and reports reference counts', () => {
      validateAndCommitAssetsMachinesBundle({
        machines: [
          {
            code_machine: 'CNC-01',
            designation: 'Centre usinage ligne A',
            code_zone: 'Z-SCIAGE',
            asset_class: 'PRODUCTION',
            code_family: 'FAM-CNC',
            code_template: 'TPL-CNC-3AX',
          },
        ],
      });

      // Attempt REPLACE_CATALOG dropping CNC-01 while an active BT and movement reference it
      const replaceReport = validateAndCommitAssetsMachinesBundle(
        {
          machines: [
            {
              code_machine: 'AIR-01',
              designation: 'Compresseur principal',
              code_zone: 'Z-UTILITY',
              asset_class: 'SYSTEM_GENERAL',
              code_system_type: 'SYS-AIR',
            },
          ],
        },
        {
          mode: 'REPLACE_CATALOG',
          actorRole: 'ADMIN',
          existingCorrectiveInterventions: [
            {
              id: 'BT-1',
              num_bt: 'BT-2026-001',
              code_machine: 'CNC-01',
              statut: 'EN_COURS',
            } as any,
          ],
          existingMouvements: [
            {
              id: 'MV-1',
              type: 'Sortie',
              id_machine_registered: 'CNC-01',
              quantite: 2,
            } as any,
          ],
        }
      );

      expect(replaceReport.success).toBe(false);
      expect(replaceReport.committed).toBe(false);
      expect(replaceReport.rejected).toHaveLength(1);
      expect(replaceReport.rejected[0].code).toBe('REFERENCED_BY_ACTIVE_RECORDS');
      expect(replaceReport.rejected[0].identifier).toBe('CNC-01');
      expect(replaceReport.rejected[0].referencedCount).toBe(2);
      expect(replaceReport.rejected[0].referenceBreakdown).toEqual({
        preventiveTasks: 0,
        correctiveInterventions: 1,
        mouvements: 1,
        warehouseItems: 0,
      });
      expect(useGmaoStore.getState().machines[0].id_machine_registered).toBe('CNC-01');
    });

    it('exports REF_PARC and ASSETS_MACHINES with stable code_* keys and round-trips via MERGE', () => {
      runUnifiedImportPipeline({
        bundleType: 'ASSETS_MACHINES',
        machines: [
          {
            code_machine: 'CNC-01',
            designation: 'Centre usinage ligne A',
            code_zone: 'Z-SCIAGE',
            asset_class: 'PRODUCTION',
            code_family: 'FAM-CNC',
            code_template: 'TPL-CNC-3AX',
          },
        ],
      });

      const exportedParc = exportRefParcBundle();
      const exportedMachines = exportAssetsMachinesBundle();

      expect(exportedParc.zones.map((z) => z.code_zone)).toContain('Z-SCIAGE');
      expect(exportedMachines.machines[0].code_machine).toBe('CNC-01');
      expect(exportedMachines.machines[0].code_zone).toBe('Z-SCIAGE');

      const reimportParc = runUnifiedImportPipeline(exportedParc, { mode: 'MERGE' });
      const reimportMachines = runUnifiedImportPipeline(exportedMachines, { mode: 'MERGE' });

      expect(reimportParc.success).toBe(true);
      expect(reimportMachines.success).toBe(true);
    });
  });
});
