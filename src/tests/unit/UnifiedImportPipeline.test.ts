import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import { beforeEach, describe, expect, it } from 'vitest';
import { DataGateway } from '../../application/DataGateway';
import reactiveEngine from '../../services/reactiveCalculationEngine';
import {
  exportAssetsMachinesBundle,
  exportCmCatalogBundle,
  exportEntrepotBomBundle,
  exportPmCatalogBundle,
  exportRefParcBundle,
  exportRefPdrBundle,
  exportRefPersonnelBundle,
  getAssetsMachinesOfficialTemplate,
  getCmCatalogOfficialTemplate,
  getEntrepotBomOfficialTemplate,
  getPmCatalogOfficialTemplate,
  getRefParcOfficialTemplate,
  getRefPdrOfficialTemplate,
  getRefPersonnelOfficialTemplate,
  registerPipelineCommitListener,
  runUnifiedImportPipeline,
  validateAndCommitAssetsMachinesBundle,
  validateAndCommitCmCatalogBundle,
  validateAndCommitDemoBundle,
  validateAndCommitEntrepotBomBundle,
  validateAndCommitPmCatalogBundle,
  validateAndCommitRefParcBundle,
  validateAndCommitRefPdrBundle,
  validateAndCommitRefPersonnelBundle,
} from '../../services/import/unifiedImportPipeline';
import {
  buildTypeAExcelWorkbookBuffer,
  parseTypeAExcelWorkbook,
  TYPE_A_README_SHEET,
} from '../../services/import/typeAExcelBridge';
import { useGmaoStore } from '../../store/useGmaoStore';
import { executeGuardedGlobalFileImport } from '../../hooks/useAppExcelOperations';
import PreventiveService from '../../application/services/PreventiveService';
import { ExecutionService } from '../../application/services/preventive/ExecutionService';

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

describe('UnifiedImportPipeline & Backdoor Closure (7 Official Bundles + DEMO_BUNDLE)', () => {
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

    it('validates and commits the official templates (REF_PARC.template.json -> ASSETS_MACHINES.template.json) with zero errors', async () => {
      await DataGateway.clearAllForRealFactory(useGmaoStore.getState());

      const parcTemplate = getRefParcOfficialTemplate();
      const machinesTemplate = getAssetsMachinesOfficialTemplate();

      const parcReport = runUnifiedImportPipeline(parcTemplate, { mode: 'MERGE' });
      expect(parcReport.success).toBe(true);
      expect(parcReport.rejected).toHaveLength(0);

      const machinesReport = runUnifiedImportPipeline(machinesTemplate, { mode: 'MERGE' });
      expect(machinesReport.success).toBe(true);
      expect(machinesReport.rejected).toHaveLength(0);
      expect(useGmaoStore.getState().machines).toHaveLength(2);
    });
  });

  describe('4. REF_PERSONNEL Bundle (02_PERSONNEL — Technicians & Operations)', () => {
    beforeEach(() => {
      runUnifiedImportPipeline(getRefParcOfficialTemplate(), { mode: 'MERGE' });
    });

    it('validates and commits the official REF_PERSONNEL.template.json after REF_PARC.template.json with zero auth secrets', () => {
      const personnelTemplate = getRefPersonnelOfficialTemplate();
      const report = runUnifiedImportPipeline(personnelTemplate, { mode: 'MERGE' });

      expect(report.success).toBe(true);
      expect(report.committed).toBe(true);
      expect(report.rejected).toHaveLength(0);

      const state = useGmaoStore.getState();
      expect(state.technicians).toHaveLength(1);
      expect(state.operations).toHaveLength(1);
      expect(state.users).toHaveLength(2);
      // Verify zero passwordHash or auth account pollution
      expect(state.users.every((u: any) => !('passwordHash' in u))).toBe(true);
    });

    it('rejects technicians or operations referencing a non-existent code_zone (BROKEN_FK)', () => {
      const report = validateAndCommitRefPersonnelBundle({
        technicians: [
          {
            code_technician: 'TECH-GHOST',
            nom: 'Karim Ghost',
            code_zone: 'Z-INCONNUE',
            type_profil: 'TECHNICIEN',
            specialite: 'ELECTRIQUE',
          },
        ],
        operations: [
          {
            code_operation: 'OP-GHOST',
            nom: 'Said Ghost',
            code_zone: 'Z-INCONNUE',
          },
        ],
      });

      expect(report.success).toBe(false);
      expect(report.committed).toBe(false);
      expect(report.rejected).toHaveLength(2);
      expect(report.rejected.every((r) => r.code === 'BROKEN_FK')).toBe(true);
      expect(useGmaoStore.getState().technicians).toHaveLength(0);
    });

    it('rejects duplicate code_technician (DUPLICATE_KEY) and forbidden auth fields (passwordHash/password -> FORBIDDEN_BUNDLE_FIELD)', () => {
      const report = validateAndCommitRefPersonnelBundle({
        technicians: [
          {
            code_technician: 'TECH-DUP',
            nom: 'Youssef 1',
            code_zone: 'Z-ATELIER-01',
          },
          {
            code_technician: 'TECH-DUP',
            nom: 'Youssef 2',
            code_zone: 'Z-ATELIER-01',
            passwordHash: 'sha256-secret-leak',
          } as any,
        ],
      });

      expect(report.success).toBe(false);
      expect(report.committed).toBe(false);
      expect(report.rejected.map((r) => r.code)).toContain('DUPLICATE_KEY');
      expect(report.rejected.map((r) => r.code)).toContain('FORBIDDEN_BUNDLE_FIELD');
    });

    it('guards REPLACE_CATALOG when an existing technician is referenced by an active BT or PM task (REFERENCED_BY_ACTIVE_RECORDS)', () => {
      runUnifiedImportPipeline(getRefPersonnelOfficialTemplate(), { mode: 'MERGE' });

      const replaceReport = validateAndCommitRefPersonnelBundle(
        {
          technicians: [
            {
              code_technician: 'TECH-02',
              nom: 'Hicham Benali',
              code_zone: 'Z-ATELIER-01',
              type_profil: 'TECHNICIEN',
              specialite: 'MECANIQUE',
            },
          ],
          operations: [],
        },
        {
          mode: 'REPLACE_CATALOG',
          actorRole: 'ADMIN',
          existingCorrectiveInterventions: [
            {
              id: 'BT-99',
              num_bt: 'BT-2026-099',
              id_technician: 'TECH-01',
              statut: 'EN_COURS',
            } as any,
          ],
          existingPreventiveTasks: [
            {
              id_task: 'PM-01',
              id_technician: 'TECH-01',
              machine: 'CNC-01',
            } as any,
          ],
        }
      );

      expect(replaceReport.success).toBe(false);
      expect(replaceReport.committed).toBe(false);
      expect(replaceReport.rejected).toHaveLength(1);
      expect(replaceReport.rejected[0].code).toBe('REFERENCED_BY_ACTIVE_RECORDS');
      expect(replaceReport.rejected[0].identifier).toBe('TECH-01');
      expect(replaceReport.rejected[0].referencedCount).toBe(2);
      expect(replaceReport.rejected[0].referenceBreakdown).toEqual({
        machines: 0,
        preventiveTasks: 1,
        correctiveInterventions: 1,
        mouvements: 0,
      });
    });

    it('exports REF_PERSONNEL with canonical code_technician and code_operation and round-trips via MERGE', () => {
      runUnifiedImportPipeline(getRefPersonnelOfficialTemplate(), { mode: 'MERGE' });

      const exported = exportRefPersonnelBundle();
      expect(exported.bundleType).toBe('REF_PERSONNEL');
      expect(exported.technicians.map((t) => t.code_technician)).toEqual(['TECH-01']);
      expect(exported.operations?.map((o) => o.code_operation)).toEqual(['RESP-01']);

      const reimport = runUnifiedImportPipeline(exported, { mode: 'MERGE' });
      expect(reimport.success).toBe(true);
      expect(reimport.rejected).toHaveLength(0);
    });
  });

  describe('5. REF_PDR Bundle (04_PDR — Groups -> Types -> Items wrapping pdrExcelValidator)', () => {
    it('validates and commits the official REF_PDR.template.json with 0 rejected and zero movements created', () => {
      const pdrTemplate = getRefPdrOfficialTemplate();
      const report = runUnifiedImportPipeline(pdrTemplate, { mode: 'MERGE' });

      expect(report.success).toBe(true);
      expect(report.committed).toBe(true);
      expect(report.rejected).toHaveLength(0);

      const state = useGmaoStore.getState();
      expect(state.pdrGroups).toHaveLength(1);
      expect(state.types).toHaveLength(1);
      expect(state.rawStock).toHaveLength(2);
      expect(state.mouvements).toHaveLength(0); // Zero movements generated
      expect(state.rawStock[0].stockInitial).toBe(10);
      expect(state.rawStock[1].stockInitial).toBe(0);
    });

    it('rejects an item referencing a broken code_type (BROKEN_FK) with zero store writes', () => {
      const report = validateAndCommitRefPdrBundle({
        groups: [{ code_group: 'ROUL', libelle: 'Roulements' }],
        types: [{ code_type: 'TYP-ROUL', code_group: 'ROUL', libelle: 'Roulements billes' }],
        items: [
          {
            ref: 'SKF-9999',
            designation: 'Roulement Orphelin',
            code_type: 'TYP-INCONNU',
            code_group: 'ROUL',
          },
        ],
      });

      expect(report.success).toBe(false);
      expect(report.committed).toBe(false);
      expect(report.rejected).toHaveLength(1);
      expect(report.rejected[0].code).toBe('BROKEN_FK');
      expect(report.rejected[0].stage).toBe('04_PDR_ITEMS');
      expect(useGmaoStore.getState().rawStock).toHaveLength(0);
    });

    it('rejects duplicate ref (DUPLICATE_KEY) with zero store writes', () => {
      const report = validateAndCommitRefPdrBundle({
        groups: [{ code_group: 'ROUL', libelle: 'Roulements' }],
        types: [{ code_type: 'TYP-ROUL', code_group: 'ROUL', libelle: 'Roulements billes' }],
        items: [
          {
            ref: 'SKF-DUP',
            designation: 'Roulement 1',
            code_type: 'TYP-ROUL',
            code_group: 'ROUL',
          },
          {
            ref: 'SKF-DUP',
            designation: 'Roulement 2',
            code_type: 'TYP-ROUL',
            code_group: 'ROUL',
          },
        ],
      });

      expect(report.success).toBe(false);
      expect(report.committed).toBe(false);
      expect(report.rejected).toHaveLength(1);
      expect(report.rejected[0].code).toBe('DUPLICATE_KEY');
      expect(useGmaoStore.getState().rawStock).toHaveLength(0);
    });

    it('rejects forbidden mouvements or auth fields inside REF_PDR (FORBIDDEN_BUNDLE_FIELD)', () => {
      const report = validateAndCommitRefPdrBundle({
        groups: [{ code_group: 'ROUL', libelle: 'Roulements' }],
        types: [{ code_type: 'TYP-ROUL', code_group: 'ROUL', libelle: 'Roulements billes' }],
        items: [],
        mouvements: [{ ref: 'SKF-6205', type: 'Entrée', quantite: 5 }],
      } as any);

      expect(report.success).toBe(false);
      expect(report.committed).toBe(false);
      expect(report.rejected.map((r) => r.code)).toContain('FORBIDDEN_BUNDLE_FIELD');
    });

    it('exports REF_PDR with canonical code_group, code_type, and ref and round-trips via MERGE', () => {
      runUnifiedImportPipeline(getRefPdrOfficialTemplate(), { mode: 'MERGE' });

      const exported = exportRefPdrBundle();
      expect(exported.bundleType).toBe('REF_PDR');
      expect(exported.groups.map((g) => g.code_group)).toEqual(['ROUL']);
      expect(exported.types.map((t) => t.code_type)).toEqual(['TYP-ROUL-BILLE']);
      expect(exported.items.map((i) => i.ref)).toEqual(['SKF-6205-2RS', 'SKF-6206-2RS']);

      const reimport = runUnifiedImportPipeline(exported, { mode: 'MERGE' });
      expect(reimport.success).toBe(true);
      expect(reimport.rejected).toHaveLength(0);
    });
  });

  describe('6. PM_CATALOG Bundle (05_PM_ACTIONS -> 05_PM_GUIDES — Level 2 Only)', () => {
    it('validates and commits the official PM_CATALOG.template.json after REF_PDR with 0 rejected and 0 tasks created', () => {
      runUnifiedImportPipeline(getRefPdrOfficialTemplate(), { mode: 'MERGE' });
      const pmTemplate = getPmCatalogOfficialTemplate();
      const report = runUnifiedImportPipeline(pmTemplate, { mode: 'MERGE' });

      expect(report.success).toBe(true);
      expect(report.committed).toBe(true);
      expect(report.rejected).toHaveLength(0);

      const state = useGmaoStore.getState();
      expect(state.preventiveActions).toHaveLength(3);
      expect(state.preventiveGuides).toHaveLength(1);
      expect(state.preventiveTasks).toHaveLength(0);
      expect(state.preventiveExecutions).toHaveLength(0);
    });

    it('rejects a guide referencing an unknown code_action (BROKEN_FK) with zero store writes', () => {
      const report = validateAndCommitPmCatalogBundle({
        actions: [{ code_action: 'C', libelle: 'Contrôle' }],
        guides: [
          {
            code_guide: 'GUIDE-TEST',
            composant_nom: 'Moteur',
            actions_liees: ['C', 'UNKNOWN_ACT'],
          },
        ],
      });

      expect(report.success).toBe(false);
      expect(report.committed).toBe(false);
      expect(report.rejected.some((r) => r.code === 'BROKEN_FK' && r.stage === '05_PM_GUIDES')).toBe(true);
      expect(useGmaoStore.getState().preventiveActions).toHaveLength(0);
      expect(useGmaoStore.getState().preventiveGuides).toHaveLength(0);
    });

    it('rejects a guide referencing a missing PDR ref when REF_PDR catalog is loaded (BROKEN_FK)', () => {
      runUnifiedImportPipeline(getRefPdrOfficialTemplate(), { mode: 'MERGE' });

      const report = validateAndCommitPmCatalogBundle({
        actions: [{ code_action: 'C', libelle: 'Contrôle' }],
        guides: [
          {
            code_guide: 'GUIDE-MISSING-PDR',
            composant_nom: 'Palier',
            actions_liees: ['C'],
            pieces_rechange: [{ ref: 'PDR-INEXISTANTE', quantite: 1 }],
          },
        ],
      });

      expect(report.success).toBe(false);
      expect(report.committed).toBe(false);
      expect(report.rejected[0].code).toBe('BROKEN_FK');
      expect(report.rejected[0].identifier).toBe('PDR-INEXISTANTE');
    });

    it('rejects duplicate code_action / code_guide (DUPLICATE_KEY) and forbidden machine/task fields (FORBIDDEN_BUNDLE_FIELD)', () => {
      const dupReport = validateAndCommitPmCatalogBundle({
        actions: [
          { code_action: 'C', libelle: 'Contrôle 1' },
          { code_action: 'c', libelle: 'Contrôle 2' },
        ],
        guides: [],
      });
      expect(dupReport.success).toBe(false);
      expect(dupReport.rejected.map((r) => r.code)).toContain('DUPLICATE_KEY');

      const forbiddenReport = validateAndCommitPmCatalogBundle({
        actions: [{ code_action: 'C', libelle: 'Contrôle' }],
        guides: [],
        preventiveTasks: [{ id: 'T-01', action_code: 'C' }],
      } as any);
      expect(forbiddenReport.success).toBe(false);
      expect(forbiddenReport.rejected.map((r) => r.code)).toContain('FORBIDDEN_BUNDLE_FIELD');
    });

    it('guards REPLACE_CATALOG when an existing action is referenced by preventiveTasks (REFERENCED_BY_ACTIVE_RECORDS)', () => {
      runUnifiedImportPipeline(getPmCatalogOfficialTemplate(), { mode: 'MERGE' });
      useGmaoStore.getState().setPreventiveTasks([
        { id: 'PM-T1', action_code: 'G', titre: 'Graissage hebdo' },
      ]);

      const blocked = validateAndCommitPmCatalogBundle(
        {
          actions: [{ code_action: 'C', libelle: 'Contrôle seul' }],
          guides: [],
        },
        { mode: 'REPLACE_CATALOG', actorRole: 'ADMIN' }
      );

      expect(blocked.success).toBe(false);
      expect(blocked.committed).toBe(false);
      expect(blocked.rejected[0].code).toBe('REFERENCED_BY_ACTIVE_RECORDS');
      expect(blocked.rejected[0].identifier).toBe('G');
    });

    it('exports PM_CATALOG with canonical code_action and code_guide and round-trips via MERGE', () => {
      runUnifiedImportPipeline(getRefPdrOfficialTemplate(), { mode: 'MERGE' });
      runUnifiedImportPipeline(getPmCatalogOfficialTemplate(), { mode: 'MERGE' });

      const exported = exportPmCatalogBundle();
      expect(exported.bundleType).toBe('PM_CATALOG');
      expect(exported.actions.map((a) => a.code_action)).toEqual(['C', 'G', 'N']);
      expect(exported.guides.map((g) => g.code_guide)).toEqual(['GUIDE-ROULEMENT-CG']);

      const reimport = runUnifiedImportPipeline(exported, { mode: 'MERGE' });
      expect(reimport.success).toBe(true);
      expect(reimport.rejected).toHaveLength(0);
    });
  });

  describe('7. INGEST-P5 — Unified DemoBundle & loadDemoData Referential Integrity', () => {
    it('validates and commits the official DEMO_BUNDLE across all 7 structured layers with zero rejected records', () => {
      const demoBundle = DataGateway.getOfficialDemoBundle();
      const report = validateAndCommitDemoBundle(demoBundle, { mode: 'MERGE' });

      expect(report.bundleType).toBe('DEMO_BUNDLE');
      expect(report.success).toBe(true);
      expect(report.committed).toBe(true);
      expect(report.rejected).toHaveLength(0);

      // Verify all 20 pipeline stages across 7 layers were accepted in causal order
      const stages = report.accepted.map((a) => a.stage);
      expect(stages).toEqual([
        '01_ZONES',
        '03_FAMILIES',
        '03_TEMPLATES',
        '03_GENERAL_SYSTEM_TYPES',
        '02_PERSONNEL',
        '02_PERSONNEL',
        '03_MACHINES',
        '04_PDR_GROUPS',
        '04_PDR_TYPES',
        '04_PDR_ITEMS',
        '05_PM_ACTIONS',
        '05_PM_GUIDES',
        '06_COMP_GROUPS',
        '06_COMP_FAMILIES',
        '06_COMP_TEMPLATES',
        '06_PART_GROUPS',
        '06_PART_TYPES',
        '06_PART_DESIGNATIONS',
        '07_PANNE_CATEGORIES',
        '07_PANNE_ACTIONS',
      ]);

      // Verify legacy zone labels on demo machines and technicians were normalized to canonical code_zone
      const pce01 = useGmaoStore
        .getState()
        .machines.find((m) => m.id_machine_registered === 'PCE-01');
      expect(pce01?.id_zone_default).toBe('PCE');
      expect(pce01?.id_family).toBe('FAM-MEC');
      expect(pce01?.id_templates).toBe('TPL-MACHINE');

      const tech02 = useGmaoStore
        .getState()
        .technicians.find((t) => t.id_technician === 'TECH-02');
      expect(tech02?.id_zone).toBe('POLISSAG');
    });

    it('routes DataGateway.loadDemoData through UnifiedImportPipeline and keeps Mode A empty after clearAllForRealFactory', async () => {
      const res = DataGateway.loadDemoData(useGmaoStore.getState());
      expect(res.pipelineReport.success).toBe(true);
      expect(res.pipelineReport.rejected).toHaveLength(0);
      expect(res.machinesCount).toBeGreaterThan(300);
      expect(res.stockCount).toBe(28);

      // Verify generalSystemTypes preserve canonical SYS-* IDs
      expect(useGmaoStore.getState().generalSystemTypes.map((t) => t.id)).toEqual([
        'SYS-AIR',
        'SYS-SEC',
        'SYS-EAU',
        'SYS-ECL',
        'SYS-ASC',
      ]);

      // Clear all for real factory (Mode A)
      await DataGateway.clearAllForRealFactory(useGmaoStore.getState());
      expect(useGmaoStore.getState().zones).toHaveLength(0);
      expect(useGmaoStore.getState().machines).toHaveLength(0);
      expect(useGmaoStore.getState().rawStock).toHaveLength(0);
      expect(useGmaoStore.getState().preventiveActions).toHaveLength(0);
      expect(useGmaoStore.getState().preventiveGuides).toHaveLength(0);
    });

    it('aborts DEMO_BUNDLE atomically if a machine references an unknown family (BROKEN_FK)', () => {
      const brokenBundle = DataGateway.getOfficialDemoBundle();
      brokenBundle.assetsMachines.machines = [
        {
          code_machine: 'BROKEN-M1',
          designation: 'Machine Orpheline',
          code_zone: 'DETOURAG',
          asset_class: 'PRODUCTION',
          code_family: 'FAM-INEXISTANTE',
          code_template: 'TPL-MACHINE',
        },
      ];

      const report = runUnifiedImportPipeline(brokenBundle, { mode: 'MERGE' });
      expect(report.success).toBe(false);
      expect(report.committed).toBe(false);
      expect(report.rejected.some((r) => r.code === 'BROKEN_FK' && r.stage === '03_MACHINES')).toBe(
        true
      );
      expect(useGmaoStore.getState().machines).toHaveLength(0);
    });
  });

  describe('8. INGEST-P6 — Closed Legacy Import Backdoors & Guarded Gateways', () => {
    it('blocks raw .xlsx Type B workbooks and arbitrary JSON overwrites in global file import while routing Type A JSON through UnifiedImportPipeline', () => {
      const xlsxBlocked = executeGuardedGlobalFileImport('GMAO_Topology_Master.xlsx', {
        kind: 'XLSX',
        sheetNames: ['Stock_Actuel', 'Mouvements', 'Machines_Registered'],
      });
      expect(xlsxBlocked.accepted).toBe(false);
      expect(xlsxBlocked.code).toBe('TYPE_B_EXCEL_BLOCKED');

      const rawJsonBlocked = executeGuardedGlobalFileImport('legacy_backup.json', {
        kind: 'JSON',
        payload: {
          Stock_Actuel: [{ ref: 'ORPHAN-1', stockInitial: 99 }],
          Mouvements: [{ id: 'MVT-BAD', quantite: 10 }],
        },
      });
      expect(rawJsonBlocked.accepted).toBe(false);
      expect(rawJsonBlocked.code).toBe('UNRECOGNIZED_JSON_BLOCKED');
      expect(useGmaoStore.getState().rawStock).toHaveLength(0);

      // Valid Type A JSON bundle passes strictly through UnifiedImportPipeline
      const typeAAccepted = executeGuardedGlobalFileImport(
        'REF_PARC.template.json',
        {
          kind: 'JSON',
          payload: getRefParcOfficialTemplate(),
        },
        { actorRole: 'ADMIN' }
      );
      expect(typeAAccepted.accepted).toBe(true);
      expect(typeAAccepted.code).toBe('TYPE_A_PIPELINE_COMMITTED');
      expect(useGmaoStore.getState().zones.length).toBeGreaterThan(0);
    });

    it('routes DataGateway.initRealStock and loadDemoSection (zones, parc, stock, preventive) through UnifiedImportPipeline validation', () => {
      const stockInit = DataGateway.initRealStock(useGmaoStore.getState());
      expect(stockInit.stockCount).toBe(28);
      expect(stockInit.pipelineReport.success).toBe(true);
      expect(useGmaoStore.getState().pdrGroups.length).toBeGreaterThan(0);
      expect(useGmaoStore.getState().types.length).toBeGreaterThan(0);

      DataGateway.loadDemoSection('zones', useGmaoStore.getState());
      const tech02 = useGmaoStore
        .getState()
        .technicians.find((t) => t.id_technician === 'TECH-02');
      expect(tech02?.id_zone).toBe('POLISSAG');

      DataGateway.loadDemoSection('parc', useGmaoStore.getState());
      const pce01 = useGmaoStore
        .getState()
        .machines.find((m) => m.id_machine_registered === 'PCE-01');
      expect(pce01?.id_zone_default).toBe('PCE');

      DataGateway.loadDemoSection('preventive', useGmaoStore.getState());
      expect(useGmaoStore.getState().preventiveActions.length).toBeGreaterThan(0);
      expect(useGmaoStore.getState().preventiveGuides.length).toBeGreaterThan(0);
    });

    it('guards PreventiveService.bulkImportTasks against orphan/GLOBAL machines and blocks replace when executions exist', () => {
      runUnifiedImportPipeline(getRefParcOfficialTemplate(), { mode: 'MERGE' });
      runUnifiedImportPipeline(getAssetsMachinesOfficialTemplate(), { mode: 'MERGE' });

      expect(() =>
        PreventiveService.bulkImportTasks([
          { id_machine: 'UNKNOWN-999', composant: 'Pompe', action_code: 'C' },
        ])
      ).toThrow(/introuvable ou archivée/);

      expect(() =>
        PreventiveService.bulkImportTasks([
          { id_machine: 'GLOBAL', composant: 'Pompe', action_code: 'C' },
        ])
      ).toThrow(/obligatoire et non GLOBAL/);

      const activeMachineId = useGmaoStore.getState().machines[0].id_machine_registered;
      const imported = PreventiveService.bulkImportTasks([
        { id_machine: activeMachineId, composant: 'Moteur', action_code: 'C' },
      ]);
      expect(imported).toHaveLength(1);
      expect(imported[0].id_machine).toBe(activeMachineId);

      // Record an execution and verify replace=true is strictly blocked
      ExecutionService.recordExecution(imported[0], {
        date_realisation: '2026-11-15',
        executorName: 'Admin',
        actorRole: 'ADMIN',
      });
      expect(() =>
        PreventiveService.bulkImportTasks(
          [{ id_machine: activeMachineId, composant: 'Moteur', action_code: 'C' }],
          true,
          { actorRole: 'ADMIN' }
        )
      ).toThrow(/REFERENCED_BY_ACTIVE_RECORDS/);
    });
  });

  describe('9. INGEST-P7 — Type A Excel (.xlsx) Bridge, Global Type A Routing, REPLACE_CATALOG RBAC & Commit Sync Hook', () => {
    it('supports full Type A .xlsx round-trip across all 5 bundles (REF_PARC -> REF_PERSONNEL -> ASSETS_MACHINES -> REF_PDR -> PM_CATALOG) with origin=EXCEL', () => {
      const parcXlsx = buildTypeAExcelWorkbookBuffer('REF_PARC', getRefParcOfficialTemplate());
      const parsedParc = parseTypeAExcelWorkbook(parcXlsx);
      expect(parsedParc.ok).toBe(true);
      expect(parsedParc.sheetNames[0]).toBe(TYPE_A_README_SHEET);
      const parcReport = runUnifiedImportPipeline(parsedParc.payload, {
        mode: 'MERGE',
        origin: 'EXCEL',
        dryRun: false,
      });
      expect(parcReport.success).toBe(true);
      expect(parcReport.origin).toBe('EXCEL');
      expect(useGmaoStore.getState().zones.length).toBeGreaterThan(0);

      const persXlsx = buildTypeAExcelWorkbookBuffer(
        'REF_PERSONNEL',
        getRefPersonnelOfficialTemplate()
      );
      const parsedPers = parseTypeAExcelWorkbook(persXlsx);
      expect(parsedPers.ok).toBe(true);
      const persReport = runUnifiedImportPipeline(parsedPers.payload, {
        mode: 'MERGE',
        origin: 'EXCEL',
        dryRun: false,
      });
      expect(persReport.success).toBe(true);
      expect(useGmaoStore.getState().technicians.length).toBeGreaterThan(0);

      const machinesXlsx = buildTypeAExcelWorkbookBuffer(
        'ASSETS_MACHINES',
        getAssetsMachinesOfficialTemplate()
      );
      const parsedMachines = parseTypeAExcelWorkbook(machinesXlsx);
      expect(parsedMachines.ok).toBe(true);
      const machinesReport = runUnifiedImportPipeline(parsedMachines.payload, {
        mode: 'MERGE',
        origin: 'EXCEL',
        dryRun: false,
      });
      expect(machinesReport.success).toBe(true);
      expect(useGmaoStore.getState().machines.length).toBeGreaterThan(0);

      const pdrXlsx = buildTypeAExcelWorkbookBuffer('REF_PDR', getRefPdrOfficialTemplate());
      const parsedPdr = parseTypeAExcelWorkbook(pdrXlsx);
      expect(parsedPdr.ok).toBe(true);
      const pdrReport = runUnifiedImportPipeline(parsedPdr.payload, {
        mode: 'MERGE',
        origin: 'EXCEL',
        dryRun: false,
      });
      expect(pdrReport.success).toBe(true);
      expect(useGmaoStore.getState().rawStock.length).toBeGreaterThan(0);

      const pmXlsx = buildTypeAExcelWorkbookBuffer('PM_CATALOG', getPmCatalogOfficialTemplate());
      const parsedPm = parseTypeAExcelWorkbook(pmXlsx);
      expect(parsedPm.ok).toBe(true);
      const pmReport = runUnifiedImportPipeline(parsedPm.payload, {
        mode: 'MERGE',
        origin: 'EXCEL',
        dryRun: false,
      });
      expect(pmReport.success).toBe(true);
      expect(useGmaoStore.getState().preventiveActions.length).toBeGreaterThan(0);
      expect(useGmaoStore.getState().preventiveGuides.length).toBeGreaterThan(0);

      // Re-export live state via Type A Excel Round-Trip and verify idempotent dryRun
      const exportedPmXlsx = buildTypeAExcelWorkbookBuffer('PM_CATALOG', exportPmCatalogBundle());
      const reparsedPm = parseTypeAExcelWorkbook(exportedPmXlsx);
      expect(reparsedPm.ok).toBe(true);
      const dryPmReport = runUnifiedImportPipeline(reparsedPm.payload, {
        mode: 'MERGE',
        origin: 'EXCEL',
        dryRun: true,
      });
      expect(dryPmReport.success).toBe(true);
      expect(dryPmReport.accepted[0].unchanged).toBeGreaterThan(0);
    });

    it('rejects Type B Excel workbooks without README_TYPE_A while committing authenticated Type A .xlsx via executeGuardedGlobalFileImport', () => {
      // Build an arbitrary Type B workbook (no README_TYPE_A)
      const wbTypeB = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        wbTypeB,
        XLSX.utils.json_to_sheet([{ Ref: 'ORPHAN-1', Stock: 50 }]),
        'Stock_Actuel'
      );
      XLSX.utils.book_append_sheet(
        wbTypeB,
        XLSX.utils.json_to_sheet([{ ID: 'MVT-1', Qty: 10 }]),
        'Mouvements'
      );
      const typeBBytes = XLSX.write(wbTypeB, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;

      const parsedTypeB = parseTypeAExcelWorkbook(typeBBytes);
      expect(parsedTypeB.ok).toBe(false);
      expect(parsedTypeB.code).toBe('TYPE_B_OR_UNRECOGNIZED_EXCEL');

      const globalTypeBResult = executeGuardedGlobalFileImport('GMAO_Export_TypeB.xlsx', {
        kind: 'XLSX',
        buffer: typeBBytes,
        sheetNames: ['Stock_Actuel', 'Mouvements'],
      });
      expect(globalTypeBResult.accepted).toBe(false);
      expect(globalTypeBResult.code).toBe('TYPE_B_EXCEL_BLOCKED');
      expect(useGmaoStore.getState().rawStock).toHaveLength(0);

      // Now pass an authentic Type A REF_PARC .xlsx workbook through global guarded import
      const parcTypeABytes = buildTypeAExcelWorkbookBuffer(
        'REF_PARC',
        getRefParcOfficialTemplate()
      );
      const globalTypeAResult = executeGuardedGlobalFileImport(
        'REF_PARC.template.xlsx',
        {
          kind: 'XLSX',
          buffer: parcTypeABytes,
        },
        { actorRole: 'ADMIN' }
      );
      expect(globalTypeAResult.accepted).toBe(true);
      expect(globalTypeAResult.code).toBe('TYPE_A_PIPELINE_COMMITTED');
      expect(globalTypeAResult.report?.origin).toBe('EXCEL');
      expect(useGmaoStore.getState().zones.length).toBeGreaterThan(0);
    });

    it('enforces ADMIN RBAC on REPLACE_CATALOG and triggers commit sync notifications on non-dryRun commits', () => {
      const events: Array<{ bundleType: string; mode: string; origin: string }> = [];
      const unsubscribe = registerPipelineCommitListener((info) => {
        events.push({ bundleType: info.bundleType, mode: info.mode, origin: info.origin });
      });

      try {
        // Non-ADMIN denied on REPLACE_CATALOG
        const denied = validateAndCommitRefParcBundle(getRefParcOfficialTemplate(), {
          mode: 'REPLACE_CATALOG',
          actorRole: 'MAGASINIER',
          dryRun: false,
        });
        expect(denied.success).toBe(false);
        expect(denied.committed).toBe(false);
        expect(denied.rejected.some((r) => r.code === 'RBAC_DENIED')).toBe(true);
        expect(events).toHaveLength(0);

        // Dry-run does not notify commit sync listener
        const dryOk = validateAndCommitRefParcBundle(getRefParcOfficialTemplate(), {
          mode: 'REPLACE_CATALOG',
          actorRole: 'ADMIN',
          dryRun: true,
        });
        expect(dryOk.success).toBe(true);
        expect(dryOk.committed).toBe(false);
        expect(events).toHaveLength(0);

        // Actual ADMIN commit notifies sync listener and stamps gmao_local_modified_at
        const committedOk = validateAndCommitRefParcBundle(getRefParcOfficialTemplate(), {
          mode: 'REPLACE_CATALOG',
          actorRole: 'ADMIN',
          origin: 'EXCEL',
          dryRun: false,
        });
        expect(committedOk.success).toBe(true);
        expect(committedOk.committed).toBe(true);
        expect(events).toEqual([
          { bundleType: 'REF_PARC', mode: 'REPLACE_CATALOG', origin: 'EXCEL' },
        ]);
        expect(localStorage.getItem('gmao_local_modified_at')).toBeTruthy();
      } finally {
        unsubscribe();
      }
    });
  });

  describe('10. INGEST-P8 — ENTREPOT_BOM (6-Stage Level 2) & CM_CATALOG (2-Stage Fault Catalog)', () => {
    it('supports full ENTREPOT_BOM JSON and Type A .xlsx round-trip while rejecting broken FKs, mismatches, negative seuil, and forbidden live fields', () => {
      const template = getEntrepotBomOfficialTemplate();
      const jsonReport = validateAndCommitEntrepotBomBundle(template, {
        mode: 'MERGE',
        origin: 'JSON_BUNDLE',
        dryRun: false,
        actorRole: 'ADMIN',
      });

      expect(jsonReport.success).toBe(true);
      expect(jsonReport.committed).toBe(true);
      expect(useGmaoStore.getState().compGroups.length).toBeGreaterThanOrEqual(2);
      expect(useGmaoStore.getState().compFamilies.length).toBeGreaterThanOrEqual(2);
      expect(useGmaoStore.getState().compTemplates.length).toBeGreaterThanOrEqual(1);
      expect(useGmaoStore.getState().partGroups.length).toBeGreaterThanOrEqual(2);
      expect(useGmaoStore.getState().partTypes.length).toBeGreaterThanOrEqual(2);
      expect(useGmaoStore.getState().partDesignations.length).toBeGreaterThanOrEqual(2);

      // Export live catalog and verify Type A .xlsx round-trip idempotency including specs JSON
      const exported = exportEntrepotBomBundle();
      const xlsxBytes = buildTypeAExcelWorkbookBuffer('ENTREPOT_BOM', exported);
      const parsedXlsx = parseTypeAExcelWorkbook(xlsxBytes);
      expect(parsedXlsx.ok).toBe(true);
      expect(parsedXlsx.bundleType).toBe('ENTREPOT_BOM');

      const dryXlsxReport = runUnifiedImportPipeline(parsedXlsx.payload!, {
        mode: 'MERGE',
        origin: 'EXCEL',
        dryRun: true,
      });
      expect(dryXlsxReport.success).toBe(true);
      expect(dryXlsxReport.accepted.some((a) => a.stage === '06_COMP_TEMPLATES' && a.unchanged > 0)).toBe(true);
      expect(dryXlsxReport.staging.nextCompTemplates[0].specs).toEqual(
        template.compTemplates![0].specs
      );

      // Broken FK, family/group mismatch, duplicate key, negative seuil, and forbidden physical instance fields
      const badReport = validateAndCommitEntrepotBomBundle(
        {
          bundleType: 'ENTREPOT_BOM',
          warehouseItems: [{ id: 'WH-LIVE-1' }],
          compGroups: [
            { code_comp_group: 'GRP-MOTEUR-001', libelle: 'Moteurs' },
            { code_comp_group: 'GRP-MOTEUR-001', libelle: 'Doublon' },
          ],
          compFamilies: [
            { code_comp_family: 'FAM-BAD', code_comp_group: 'GRP-UNKNOWN', libelle: 'Orphan' },
          ],
          compTemplates: [
            {
              code_comp_template: 'TPL-BAD',
              code_comp_family: 'FAM-MOT-3PH-001',
              code_comp_group: 'GRP-REDUCTEUR-001',
              libelle: 'Mismatch Group',
            },
          ],
          partGroups: [{ code_part_group: 'GRP-PRT-MEC', libelle: 'Mécanique' }],
          partTypes: [
            { code_part_type: 'TYPE-BAD', code_part_group: 'GRP-MISSING', libelle: 'Orphan' },
          ],
          partDesignations: [
            {
              ref: 'PART-BAD',
              code_part_type: 'TYPE-MEC',
              code_part_group: 'GRP-PRT-FIX',
              designation: 'Seuil négatif & mismatch',
              seuil: -3,
            },
          ],
        },
        { dryRun: true }
      );

      expect(badReport.success).toBe(false);
      expect(badReport.rejected.some((r) => r.code === 'FORBIDDEN_BUNDLE_FIELD')).toBe(true);
      expect(badReport.rejected.some((r) => r.code === 'DUPLICATE_KEY')).toBe(true);
      expect(badReport.rejected.some((r) => r.code === 'BROKEN_FK')).toBe(true);
      expect(badReport.rejected.some((r) => r.code === 'TEMPLATE_FAMILY_MISMATCH')).toBe(true);
    });

    it('enforces ADMIN RBAC and REFERENCED_BY_ACTIVE_RECORDS on ENTREPOT_BOM REPLACE_CATALOG', () => {
      const template = getEntrepotBomOfficialTemplate();
      validateAndCommitEntrepotBomBundle(template, { dryRun: false, actorRole: 'ADMIN' });

      const denied = validateAndCommitEntrepotBomBundle(template, {
        mode: 'REPLACE_CATALOG',
        actorRole: 'TECHNICIEN',
        dryRun: false,
      });
      expect(denied.success).toBe(false);
      expect(denied.rejected.some((r) => r.code === 'RBAC_DENIED')).toBe(true);

      // Replacing catalog by dropping MEC-01 & TPL-MOT-3PH-40KW-1430-001 must be blocked when active warehouse/BOM ledger rows reference them
      const slimmed = {
        bundleType: 'ENTREPOT_BOM' as const,
        compGroups: template.compGroups,
        compFamilies: template.compFamilies,
        compTemplates: [
          {
            code_comp_template: 'TPL-RED-COAX-OTHER',
            code_comp_family: 'FAM-RED-COAX-001',
            code_comp_group: 'GRP-REDUCTEUR-001',
            libelle: 'Réducteur Coaxial Standard',
          },
        ],
        partGroups: template.partGroups,
        partTypes: template.partTypes,
        partDesignations: template.partDesignations!.filter((p) => p.ref !== 'MEC-01'),
      };

      const blockedReport = validateAndCommitEntrepotBomBundle(slimmed, {
        mode: 'REPLACE_CATALOG',
        actorRole: 'ADMIN',
        dryRun: true,
        existingWarehouseItems: [
          {
            id: 'WH-001',
            id_templates: 'TPL-MOT-3PH-40KW-1430-001',
          } as any,
        ],
        existingMachineElementsLedger: [
          {
            id: 'ME-001',
            id_machine: 'CNC-01',
            ref: 'MEC-01',
            designation: 'Courroie Plate',
            category: 'PART',
            quantite: 1,
          } as any,
        ],
      });

      expect(blockedReport.success).toBe(false);
      const refIssues = blockedReport.rejected.filter(
        (r) => r.code === 'REFERENCED_BY_ACTIVE_RECORDS'
      );
      expect(refIssues.length).toBeGreaterThanOrEqual(2);
    });

    it('supports full CM_CATALOG JSON & Type A .xlsx round-trip and enforces FK, forbidden live BT fields, and REPLACE_CATALOG active guards', () => {
      const cmXlsx = buildTypeAExcelWorkbookBuffer(
        'CM_CATALOG',
        getCmCatalogOfficialTemplate()
      );
      const globalResult = executeGuardedGlobalFileImport(
        'CM_CATALOG.template.xlsx',
        { kind: 'XLSX', buffer: cmXlsx },
        { actorRole: 'ADMIN' }
      );
      expect(globalResult.accepted).toBe(true);
      expect(globalResult.code).toBe('TYPE_A_PIPELINE_COMMITTED');
      expect(globalResult.report?.origin).toBe('EXCEL');
      expect(Object.keys(useGmaoStore.getState().correctivePanneCategories)).toEqual([
        'M',
        'E',
        'H',
        'P',
      ]);
      expect(
        useGmaoStore.getState().correctiveActionsByPanne[
          'Vibrations anormales palier / roulement'
        ]?.length
      ).toBe(3);

      // Round-trip export -> Excel -> dryRun
      const exported = exportCmCatalogBundle();
      const reparsed = parseTypeAExcelWorkbook(
        buildTypeAExcelWorkbookBuffer('CM_CATALOG', exported)
      );
      expect(reparsed.ok).toBe(true);
      const dryReport = validateAndCommitCmCatalogBundle(reparsed.payload as any, {
        mode: 'MERGE',
        origin: 'EXCEL',
        dryRun: true,
      });
      expect(dryReport.success).toBe(true);
      expect(dryReport.accepted.find((a) => a.entity === 'CM_FAULTS')?.unchanged).toBe(4);

      // Forbidden live BT/password fields + broken category + duplicate fault
      const invalidCm = validateAndCommitCmCatalogBundle(
        {
          bundleType: 'CM_CATALOG',
          correctiveInterventions: [{ id: 'BT-1' }],
          categories: [{ code_category: 'M', libelle: 'Mécanique' }],
          faults: [
            {
              code_fault: 'PANNE-X-01',
              code_category: 'Z_UNKNOWN',
              panne: 'Panne inconnue',
              actions: ['Action 1'],
            },
            {
              code_fault: 'PANNE-M-DUP',
              code_category: 'M',
              panne: 'Fuite joint',
            },
            {
              code_fault: 'PANNE-M-DUP',
              code_category: 'M',
              panne: 'Fuite joint',
            },
          ],
        },
        { dryRun: true }
      );

      expect(invalidCm.success).toBe(false);
      expect(invalidCm.rejected.some((r) => r.code === 'FORBIDDEN_BUNDLE_FIELD')).toBe(true);
      expect(invalidCm.rejected.some((r) => r.code === 'BROKEN_FK')).toBe(true);
      expect(invalidCm.rejected.some((r) => r.code === 'DUPLICATE_KEY')).toBe(true);

      // REPLACE_CATALOG active reference check against existing corrective interventions
      const blockedReplace = validateAndCommitCmCatalogBundle(
        {
          bundleType: 'CM_CATALOG',
          categories: [{ code_category: 'M', libelle: 'Mécanique' }],
          faults: [
            {
              code_fault: 'PANNE-M-99',
              code_category: 'M',
              panne: 'Autre panne uniquement',
              actions: ['Contrôle'],
            },
          ],
        },
        {
          mode: 'REPLACE_CATALOG',
          actorRole: 'ADMIN',
          dryRun: true,
          existingCorrectiveInterventions: [
            {
              id: 'BT-ACTIVE-01',
              type_panne: 'E',
              anomalie: 'Vibrations anormales palier / roulement',
            } as any,
          ],
        }
      );

      expect(blockedReplace.success).toBe(false);
      expect(
        blockedReplace.rejected.filter((r) => r.code === 'REFERENCED_BY_ACTIVE_RECORDS').length
      ).toBe(2);
    });
  });
});
