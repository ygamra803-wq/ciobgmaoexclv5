import { useState, useCallback, type ChangeEvent, type RefObject } from 'react';
import * as XLSX from 'xlsx';
import { storageService } from '../utils/storageService';
import { Logger } from '../core/logger/LoggerService';
import { excelEngineService } from '../services/excelEngineService';
import { runUnifiedImportPipeline } from '../services/import/unifiedImportPipeline';
import { parseTypeAExcelWorkbook } from '../services/import/typeAExcelBridge';
import type { ImportReport, PipelineBundleType } from '../services/import/types/unifiedImportTypes';
import type {
  IBlueprint,
  ICompFamily,
  ICompGroup,
  ICompTemplate,
  IDiagnostic,
  IMachine,
  IMachineFamily,
  IMachineTemplate,
  IMouvement,
  IOperation,
  IPartDesignation,
  IPartType,
  IStockItem,
  ITechnician,
  IType,
  IWarehouseItem,
  IZone,
} from '../types/domain';
import type {
  CorrectiveInterventionItem,
  MachineElement,
  PreventiveTaskItem,
  SortieExterneItem,
  StateUpdater,
} from '../types/store';

export interface FileSystemWritableLike {
  write: (data: ArrayBuffer | Uint8Array | Blob | string) => Promise<void>;
  close: () => Promise<void>;
}

export interface FileSystemFileHandleLike {
  getFile: () => Promise<File>;
  createWritable: () => Promise<FileSystemWritableLike>;
}

export interface ExcelOperationsStoreState {
  rawStock: IStockItem[];
  setRawStock: (stock: StateUpdater<IStockItem[]>) => void;
  mouvements: IMouvement[];
  setMouvements: (mvts: StateUpdater<IMouvement[]>) => void;
  machines: IMachine[];
  setMachines: (machines: StateUpdater<IMachine[]>) => void;
  warehouseItems: IWarehouseItem[];
  setWarehouseItems: (items: StateUpdater<IWarehouseItem[]>) => void;
  families: IMachineFamily[];
  setFamilies: (families: StateUpdater<IMachineFamily[]>) => void;
  templates: IMachineTemplate[];
  setTemplates: (templates: StateUpdater<IMachineTemplate[]>) => void;
  blueprints: IBlueprint[];
  setBlueprints: (blueprints: StateUpdater<IBlueprint[]>) => void;
  zones: IZone[];
  setZones: (zones: StateUpdater<IZone[]>) => void;
  technicians: ITechnician[];
  setTechnicians: (techs: StateUpdater<ITechnician[]>) => void;
  operations: IOperation[];
  setOperations: (ops: StateUpdater<IOperation[]>) => void;
  types: IType[];
  compGroups: ICompGroup[];
  setCompGroups?: (groups: StateUpdater<ICompGroup[]>) => void;
  compFamilies: ICompFamily[];
  setCompFamilies: (families: StateUpdater<ICompFamily[]>) => void;
  compTemplates: ICompTemplate[];
  setCompTemplates: (templates: StateUpdater<ICompTemplate[]>) => void;
  partTypes: IPartType[];
  setPartTypes: (types: StateUpdater<IPartType[]>) => void;
  partDesignations: IPartDesignation[];
  setPartDesignations: (designations: StateUpdater<IPartDesignation[]>) => void;
  machineElementsLedger?: MachineElement[];
  setMachineElementsLedger?: (ledger: StateUpdater<MachineElement[]>) => void;
  sortiesExterne?: SortieExterneItem[];
  setSortiesExterne?: (sorties: StateUpdater<SortieExterneItem[]>) => void;
  preventiveTasks?: PreventiveTaskItem[];
  setPreventiveTasks?: (tasks: StateUpdater<PreventiveTaskItem[]>) => void;
  setCorrectiveInterventions?: (interventions: StateUpdater<CorrectiveInterventionItem[]>) => void;
  demandes?: CorrectiveInterventionItem[];
  bonsTravail?: CorrectiveInterventionItem[];
}

export interface UseAppExcelOperationsParams {
  state: ExcelOperationsStoreState;
  stockItems?: IStockItem[];
  diagnostics?: IDiagnostic[];
  showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
}

const SUPPORTED_TYPE_A_BUNDLES = new Set<PipelineBundleType>([
  'REF_PARC',
  'REF_PERSONNEL',
  'ASSETS_MACHINES',
  'REF_PDR',
  'PM_CATALOG',
  'ENTREPOT_BOM',
  'CM_CATALOG',
  'DEMO_BUNDLE',
]);

export interface GuardedGlobalImportResult {
  accepted: boolean;
  code:
    | 'TYPE_A_PIPELINE_COMMITTED'
    | 'TYPE_A_PIPELINE_REJECTED'
    | 'TYPE_B_EXCEL_BLOCKED'
    | 'UNRECOGNIZED_JSON_BLOCKED';
  message: string;
  report?: ImportReport<unknown>;
}

/**
 * Guarded global file import router (`INGEST-P6` / `INGEST-P7`):
 * - Accepts ONLY recognized Type A JSON bundles or official Type A `.xlsx` workbooks (`README_TYPE_A` + `TYPE_A_BUNDLE_ROUND_TRIP`)
 *   and routes them strictly through `runUnifiedImportPipeline`.
 * - Rejects raw `.xlsx` Type B operational workbooks and non-Type-A JSON overwrites (`Type B` external exports
 *   never mutate live `rawStock`, `mouvements`, `machines`, `preventiveTasks`, or `correctiveInterventions`).
 */
export function executeGuardedGlobalFileImport(
  fileName: string,
  input:
    | { kind: 'JSON'; payload: unknown }
    | { kind: 'XLSX'; buffer?: ArrayBuffer | Uint8Array; sheetNames?: string[] },
  options: { actorRole?: string; actorId?: string; actorName?: string } = {}
): GuardedGlobalImportResult {
  if (input.kind === 'XLSX') {
    if (input.buffer) {
      const parsedXlsx = parseTypeAExcelWorkbook(input.buffer);
      if (parsedXlsx.ok) {
        const report = runUnifiedImportPipeline(parsedXlsx.payload, {
          mode: 'MERGE',
          origin: 'EXCEL',
          dryRun: false,
          actorRole: options.actorRole || 'ADMIN',
          actorId: options.actorId || 'ADMIN',
          actorName: options.actorName || `Import Excel Type A (${fileName})`,
        });
        if (report.success && report.committed) {
          return {
            accepted: true,
            code: 'TYPE_A_PIPELINE_COMMITTED',
            message: `Classeur Excel Type A (${report.bundleType}) validé et engagé via UnifiedImportPipeline.`,
            report,
          };
        }
        const firstReject = report.rejected[0];
        return {
          accepted: false,
          code: 'TYPE_A_PIPELINE_REJECTED',
          message: `Classeur Excel Type A (${report.bundleType}) rejeté (${report.rejected.length} erreur(s)) : ${
            firstReject ? `[${firstReject.code}] ${firstReject.message}` : 'Validation échouée'
          }`,
          report,
        };
      }

      if (parsedXlsx.code === 'SCHEMA_MISMATCH') {
        return {
          accepted: false,
          code: 'TYPE_A_PIPELINE_REJECTED',
          message: `Classeur "${fileName}" invalide : ${parsedXlsx.message}`,
        };
      }
    }

    const sheetsHint =
      Array.isArray(input.sheetNames) && input.sheetNames.length > 0
        ? ` (feuilles détectées : ${input.sheetNames.slice(0, 4).join(', ')})`
        : '';
    return {
      accepted: false,
      code: 'TYPE_B_EXCEL_BLOCKED',
      message: `Import direct de "${fileName}" bloqué${sheetsHint} : les classeurs Excel opérationnels (Type B) ne peuvent plus écraser les tables en direct. Utilisez Paramètres ➔ Ingestion Structurée (Type A JSON ou XLSX officiel).`,
    };
  }

  const payloadObj =
    input.payload && typeof input.payload === 'object' && !Array.isArray(input.payload)
      ? (input.payload as Record<string, unknown>)
      : null;
  const bundleTypeRaw = payloadObj
    ? String(payloadObj.bundleType || '').trim().toUpperCase()
    : '';

  if (!SUPPORTED_TYPE_A_BUNDLES.has(bundleTypeRaw as PipelineBundleType)) {
    return {
      accepted: false,
      code: 'UNRECOGNIZED_JSON_BLOCKED',
      message: `Import direct de "${fileName}" bloqué : seul un paquet officiel Type A (REF_PARC, REF_PERSONNEL, ASSETS_MACHINES, REF_PDR, PM_CATALOG, ENTREPOT_BOM, CM_CATALOG) est autorisé. Pour restaurer un Snapshot, utilisez le Centre de Sauvegarde.`,
    };
  }

  const report = runUnifiedImportPipeline(
    payloadObj as Parameters<typeof runUnifiedImportPipeline>[0],
    {
      mode: 'MERGE',
      origin: 'JSON_BUNDLE',
      dryRun: false,
      actorRole: options.actorRole || 'ADMIN',
      actorId: options.actorId || 'ADMIN',
      actorName: options.actorName || `Import Global (${fileName})`,
    }
  );

  if (report.success && report.committed) {
    return {
      accepted: true,
      code: 'TYPE_A_PIPELINE_COMMITTED',
      message: `Paquet Type A (${report.bundleType}) validé et engagé via UnifiedImportPipeline.`,
      report,
    };
  }

  const firstReject = report.rejected[0];
  return {
    accepted: false,
    code: 'TYPE_A_PIPELINE_REJECTED',
    message: `Paquet ${report.bundleType} rejeté (${report.rejected.length} erreur(s)) : ${
      firstReject ? `[${firstReject.code}] ${firstReject.message}` : 'Validation échouée'
    }`,
    report,
  };
}

function isFileAccessBlockedError(err: unknown): { aborted: boolean; crossOrigin: boolean } {
  if (!(err instanceof Error)) return { aborted: false, crossOrigin: false };
  const aborted = err.name === 'AbortError';
  const crossOrigin =
    err.name === 'SecurityError' ||
    err.name === 'NotAllowedError' ||
    Boolean(err.message && err.message.toLowerCase().includes('cross origin'));
  return { aborted, crossOrigin };
}

/**
 * Hook to handle Excel Export, Import, Direct File System Linking and Save, with automatic versioned backups
 */
export function useAppExcelOperations({
  state,
  stockItems = [],
  diagnostics = [],
  showToast,
  fileInputRef,
}: UseAppExcelOperationsParams) {
  const {
    rawStock,
    mouvements,
    machines,
    warehouseItems,
    families,
    templates,
    blueprints,
    zones,
    technicians,
    operations,
    types,
    compGroups,
    compFamilies,
    compTemplates,
    partTypes,
    partDesignations,
    machineElementsLedger,
  } = state;

  const [linkedFileHandle, setLinkedFileHandle] = useState<FileSystemFileHandleLike | null>(null);
  const [linkedFileName, setLinkedFileName] = useState('');
  const [operationProgress, setOperationProgress] = useState({ active: false, percent: 0, status: '' });

  // AUTOMATIC BACKUP CREATOR
  const createAutomaticBackup = useCallback(
    (reason = 'Importation Excel') => {
      try {
        const now = new Date();
        const dateStr =
          now.toLocaleDateString('fr-FR') +
          ' À ' +
          now.toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          });
        const backupKey = `gmao_backup_${now.getTime()}`;
        const backupData = {
          timestamp: now.toISOString(),
          dateFormatted: dateStr,
          reason,
          data: {
            rawStock,
            mouvements,
            machines,
            warehouseItems,
            families,
            templates,
            zones,
            technicians,
            operations,
            types,
            diagnostics,
            compGroups,
            compFamilies,
            compTemplates,
            partTypes,
            partDesignations,
          },
        };

        storageService.setItem(backupKey, backupData);

        const backupList = storageService.getItem('gmao_backups_list') || [];
        const updatedList = [
          {
            key: backupKey,
            date: dateStr,
            reason,
            itemsCount: (rawStock || []).length,
            mvtsCount: (mouvements || []).length,
          },
          ...backupList,
        ].slice(0, 15);

        storageService.setItem('gmao_backups_list', updatedList);
        return dateStr;
      } catch (err: unknown) {
        const { aborted, crossOrigin } = isFileAccessBlockedError(err);
        if (aborted) return;
        if (crossOrigin) {
          showToast("Liaison bloquée par le navigateur (iframe). Basculement vers l'import classique.", 'info');
          fileInputRef.current?.click();
          return;
        }
        Logger.error('[ExcelOperations] Backup creation error:', err);
        return new Date().toLocaleString('fr-FR');
      }
    },
    [
      rawStock,
      mouvements,
      machines,
      warehouseItems,
      families,
      templates,
      zones,
      technicians,
      operations,
      types,
      diagnostics,
      compGroups,
      compFamilies,
      compTemplates,
      partTypes,
      partDesignations,
    ]
  );

  // HELPER TO BUILD COMPLETE EXCEL WORKBOOK
  const buildWorkbook = useCallback(() => {
    const wb = XLSX.utils.book_new();

    const autoFit = (ws: XLSX.WorkSheet, rows: Array<Record<string, unknown>>) => {
      if (!rows || rows.length === 0) return;
      const keys = Object.keys(rows[0] || {});
      ws['!cols'] = keys.map((key) => {
        let maxLen = String(key).length;
        rows.slice(0, 100).forEach((r) => {
          const val = r[key];
          if (val != null) {
            const len = String(val).length;
            if (len > maxLen) maxLen = len;
          }
        });
        return { wch: Math.min(Math.max(maxLen + 3, 12), 45) };
      });
    };

    const appendSheetWithAutofit = (name: string, data: unknown[]) => {
      if (Array.isArray(data) && data.length > 0) {
        const ws = XLSX.utils.json_to_sheet(data);
        autoFit(ws, data as Array<Record<string, unknown>>);
        XLSX.utils.book_append_sheet(wb, ws, name);
      }
    };

    // 1. Stock_Actuel
    const stockData = stockItems.map((s) => ({
      Ref: s.ref,
      Désignation: s.designation,
      ID_Type: s.id_type,
      ID_Diagnostic: s.id_diag,
      'Stock Initial': s.stockInitial,
      Entrées: s.entrees,
      Sorties: s.sorties,
      'Stock Actuel': s.stockActuel,
      Seuil: s.seuil,
      Alerte: s.alerte,
      Emplacement: s.emplacement,
    }));
    appendSheetWithAutofit('Stock_Actuel', stockData);

    // 2. Machines_Registered
    const mchData = machines.map((m) => ({
      'Code Machine (Ref)': m.id_machine_registered,
      Désignation: m.designation,
      ID_Family: m.id_family,
      ID_Template: m.id_templates,
      Zone_Default: m.id_zone_default,
      Technicien: m.technician,
      Statut: m.status,
    }));
    appendSheetWithAutofit('Machines_Registered', mchData);

    // 3. Warehouse_Items (Entrepôt)
    const warehouseData = warehouseItems.map((w) => ({
      'Code Entrepôt (Ref)': w.id_warehouse_item || w.id_machine_registered,
      Désignation: w.designation,
      Nature: w.nature || 'COMPOSANT',
      ID_Family: w.id_family,
      ID_Template: w.id_templates,
      Rattachement: w.rattachement_type || 'NON_ASSIGNE',
      'Machine Associée': w.id_machine_associee || '',
      Zone: w.id_zone_default,
      Responsable: w.technician,
      Statut: w.status,
      Quantité: w.quantite || 1,
      Emplacement: w.emplacement || '',
    }));
    appendSheetWithAutofit('Warehouse_Items', warehouseData);

    // 4. Mouvements
    appendSheetWithAutofit('Mouvements', mouvements);

    // 5. Sorties Externes (Bobinage)
    if (state.sortiesExterne && state.sortiesExterne.length > 0) {
      appendSheetWithAutofit('Sortie_Externe', state.sortiesExterne);
    }

    // 6. Demandes d'Intervention
    if (state.demandes && state.demandes.length > 0) {
      appendSheetWithAutofit('Demandes_Intervention', state.demandes);
    }

    // 7. Bons de Travail
    if (state.bonsTravail && state.bonsTravail.length > 0) {
      appendSheetWithAutofit('Bons_Travail', state.bonsTravail);
    }

    // 8. Preventive S1..S52
    if (state.preventiveTasks && state.preventiveTasks.length > 0) {
      appendSheetWithAutofit('Preventive_S1_S52', state.preventiveTasks);
    }

    // 9. Types
    appendSheetWithAutofit('Types', types);

    // 10. Diagnostics
    appendSheetWithAutofit('Diagnostics', diagnostics);

    // 11. Families
    appendSheetWithAutofit('Families', families);

    // 12. Templates
    appendSheetWithAutofit('Templates', templates);

    // 13. Zones
    appendSheetWithAutofit('Zones', zones);

    // 14. Technicians
    appendSheetWithAutofit('Technicians', technicians);

    // 15. Operations
    appendSheetWithAutofit('Operations', operations);

    // 15b. Comp_Groups
    if (compGroups && compGroups.length > 0) {
      appendSheetWithAutofit('Comp_Groups', compGroups);
    }

    // 16. Comp_Families
    if (compFamilies && compFamilies.length > 0) {
      appendSheetWithAutofit('Comp_Families', compFamilies);
    }

    // 17. Comp_Templates
    if (compTemplates && compTemplates.length > 0) {
      appendSheetWithAutofit('Comp_Templates', compTemplates);
    }

    // 18. Part_Types
    if (partTypes && partTypes.length > 0) {
      appendSheetWithAutofit('Part_Types', partTypes);
    }

    // 19. Part_Designations
    if (partDesignations && partDesignations.length > 0) {
      appendSheetWithAutofit('Part_Designations', partDesignations);
    }

    // 20. Blueprints (Technical plans)
    if (blueprints && blueprints.length > 0) {
      appendSheetWithAutofit('Blueprints', blueprints);
    }

    // 21. Machine_BOM_Ledger (Nomenclature & Pièces Montées)
    if (machineElementsLedger && machineElementsLedger.length > 0) {
      appendSheetWithAutofit('Machine_BOM_Ledger', machineElementsLedger);
    }

    return wb;
  }, [
    stockItems,
    machines,
    warehouseItems,
    mouvements,
    types,
    diagnostics,
    families,
    templates,
    zones,
    technicians,
    operations,
    compGroups,
    compFamilies,
    compTemplates,
    partTypes,
    partDesignations,
    blueprints,
    state.sortiesExterne,
    state.demandes,
    state.bonsTravail,
    state.preventiveTasks,
  ]);

  // Full dataset provider for live Excel Engine
  const getFullDataset = useCallback(() => ({
    stockItems,
    rawStock,
    mouvements,
    machines,
    warehouseItems,
    zones,
    technicians,
    operations,
    types,
    diagnostics,
    families,
    templates,
    compGroups,
    compFamilies,
    compTemplates,
    partTypes,
    partDesignations,
    sortiesExterne: state.sortiesExterne,
    demandes: state.demandes,
    bonsTravail: state.bonsTravail,
    preventiveTasks: state.preventiveTasks,
  }), [
    stockItems,
    rawStock,
    mouvements,
    machines,
    warehouseItems,
    zones,
    technicians,
    operations,
    types,
    diagnostics,
    families,
    templates,
    compGroups,
    compFamilies,
    compTemplates,
    partTypes,
    partDesignations,
    state.sortiesExterne,
    state.demandes,
    state.bonsTravail,
    state.preventiveTasks,
  ]);

  // EXCEL EXPORT HANDLER WITH LIVE FORMULAS & FALLBACK (Type B External Consultation)
  const handleExportExcel = useCallback(async () => {
    try {
      showToast('Génération du classeur Excel (Type B — Consultation externe)...', 'info');
      await excelEngineService.downloadGmaoExcel(getFullDataset(), 'GMAO_Master_Live');
      showToast('Export Excel externe (Type B — non réimportable) téléchargé avec succès !', 'success');
    } catch (err) {
      Logger.warn('[ExcelOperations] ExcelJS export fallback to XLSX:', err);
      const wb = buildWorkbook();
      XLSX.writeFile(wb, `GMAO_Light_Export_${new Date().toISOString().slice(0, 10)}.xlsx`);
      showToast('Export Excel externe (Type B — non réimportable) généré et téléchargé.', 'success');
    }
  }, [buildWorkbook, getFullDataset, showToast]);

  // GUARDED FILE IMPORT HANDLER (INGEST-P6): Type A JSON bundles -> UnifiedImportPipeline ; Type B Excel/raw overwrite blocked
  const handleImportFile = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (file.size > 10 * 1024 * 1024) {
        showToast('Fichier trop volumineux. La taille maximale est de 10 MB.', 'error');
        return;
      }

      const validExtensions = ['.json', '.xlsx', '.xls'];
      const validMimeTypes = [
        'application/json',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
      ];
      const dotIdx = file.name.lastIndexOf('.');
      const fileExt = dotIdx >= 0 ? file.name.substring(dotIdx).toLowerCase() : '';

      if (!validExtensions.includes(fileExt) || (file.type && !validMimeTypes.includes(file.type))) {
        showToast('Format de fichier non supporté. Seuls JSON (Type A) et XLSX.', 'error');
        return;
      }

      const reader = new FileReader();
      reader.onerror = () => {
        showToast('Erreur de lecture du fichier sélectionné.', 'error');
      };

      reader.onload = async (evt: ProgressEvent<FileReader>) => {
        setOperationProgress({ active: true, percent: 40, status: 'Vérification du contrat Type A/B...' });
        try {
          const resultPayload = evt.target?.result;

          if (fileExt === '.json') {
            const parsedJson = JSON.parse(typeof resultPayload === 'string' ? resultPayload : '{}');
            const backupDate = createAutomaticBackup('Import Type A : ' + file.name);
            const res = executeGuardedGlobalFileImport(file.name, {
              kind: 'JSON',
              payload: parsedJson,
            });
            if (res.accepted) {
              showToast(`${res.message} (Backup : ${backupDate})`, 'success');
              Logger.info('[ExcelOperations] Guarded Type A JSON import committed', {
                file: file.name,
                bundleType: res.report?.bundleType,
              });
            } else {
              showToast(res.message, 'error');
              Logger.warn('[ExcelOperations] Guarded JSON import rejected', {
                file: file.name,
                code: res.code,
              });
            }
            return;
          }

          // Excel workbooks (.xlsx/.xls): accept ONLY authenticated Type A templates/exports (README_TYPE_A); block Type B
          const buffer = resultPayload instanceof ArrayBuffer ? resultPayload : new ArrayBuffer(0);
          let sheetNames: string[] = [];
          try {
            const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
            sheetNames = workbook.SheetNames || [];
          } catch {
            sheetNames = [];
          }

          const xlsxRes = executeGuardedGlobalFileImport(file.name, {
            kind: 'XLSX',
            buffer,
            sheetNames,
          });
          if (xlsxRes.accepted) {
            const backupDate = createAutomaticBackup('Import Type A Excel : ' + file.name);
            showToast(`${xlsxRes.message} (Backup : ${backupDate})`, 'success');
            Logger.info('[ExcelOperations] Guarded Type A Excel import committed (INGEST-P7)', {
              file: file.name,
              bundleType: xlsxRes.report?.bundleType,
            });
          } else {
            showToast(xlsxRes.message, 'error');
            Logger.warn('[ExcelOperations] Excel import blocked/rejected', {
              file: file.name,
              code: xlsxRes.code,
              sheetNames,
            });
          }
        } catch (err: unknown) {
          const { aborted, crossOrigin } = isFileAccessBlockedError(err);
          if (aborted) return;
          if (crossOrigin) {
            showToast("Liaison bloquée par le navigateur (iframe). Basculement vers l'import classique.", 'info');
            fileInputRef.current?.click();
            return;
          }
          showToast('Erreur lors de la lecture ou de la validation JSON du fichier.', 'error');
          Logger.error('[ExcelOperations] Guarded import error:', err);
        } finally {
          setOperationProgress({ active: false, percent: 100, status: '' });
        }
      };

      if (fileExt === '.json') {
        reader.readAsText(file);
      } else {
        reader.readAsArrayBuffer(file);
      }
    },
    [createAutomaticBackup, fileInputRef, showToast]
  );

  // DIRECT FILE SYSTEM ACCESS API LINK (Outbound Mirror Only — INGEST-P6: no raw overwrite of live tables)
  const handleDirectFileLink = useCallback(async () => {
    if (!('showOpenFilePicker' in window)) {
      showToast(
        "Liaison miroir directe disponible sur Chrome/Edge. Pour importer des données, utilisez Paramètres ➔ Ingestion Structurée (Type A).",
        'info'
      );
      return;
    }

    try {
      const winWithPicker = window as Window & {
        showOpenFilePicker?: (opts: {
          types: Array<{ description: string; accept: Record<string, string[]> }>;
          multiple: boolean;
        }) => Promise<FileSystemFileHandleLike[]>;
      };
      if (!winWithPicker.showOpenFilePicker) {
        return;
      }
      const [handle] = await winWithPicker.showOpenFilePicker({
        types: [
          {
            description: 'Classeur Miroir Sortant Excel (.xlsx — Type B)',
            accept: {
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [
                '.xlsx',
                '.xls',
              ],
            },
          },
        ],
        multiple: false,
      });

      const file = await handle.getFile();
      setLinkedFileHandle(handle);
      setLinkedFileName(file.name);
      showToast(
        `🔗 "${file.name}" lié en mode Miroir Sortant uniquement (Type B — lecture/écrasement direct du stock et du parc désactivé).`,
        'info'
      );
    } catch (err: unknown) {
      const { aborted, crossOrigin } = isFileAccessBlockedError(err);
      if (aborted) return;
      if (crossOrigin) {
        showToast("Liaison directe bloquée par le navigateur (iframe).", 'info');
        return;
      }
      Logger.error('[ExcelOperations] Direct link error:', err);
      showToast("Erreur lors de l'accès au fichier sélectionné.", 'error');
    }
  }, [showToast]);

  // DIRECT FILE SYSTEM SAVE HANDLER WITH LIVE FORMULAS
  const handleDirectSave = useCallback(async () => {
    if (!linkedFileHandle) {
      handleExportExcel();
      return;
    }

    try {
      let buffer: ArrayBuffer | Uint8Array;
      try {
        const workbook = await excelEngineService.buildGmaoWorkbook(getFullDataset());
        buffer = (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
      } catch (eEngineErr) {
        Logger.warn('[ExcelOperations] ExcelJS save fallback to XLSX:', eEngineErr);
        const wb = buildWorkbook();
        buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as Uint8Array;
      }

      const writable = await linkedFileHandle.createWritable();
      await writable.write(buffer);
      await writable.close();

      showToast(`💾 Écriture directe avec formules vivantes réussie dans "${linkedFileName}" !`, 'success');
    } catch (err: unknown) {
      const { aborted, crossOrigin } = isFileAccessBlockedError(err);
      if (aborted) return;
      if (crossOrigin) {
        showToast("Liaison bloquée par le navigateur (iframe). Basculement vers l'import classique.", 'info');
        fileInputRef.current?.click();
        return;
      }
      Logger.error('[ExcelOperations] Direct save error:', err);
      showToast('Écriture directe impossible. Exportation standard...', 'info');
      handleExportExcel();
    }
  }, [buildWorkbook, fileInputRef, getFullDataset, handleExportExcel, linkedFileHandle, linkedFileName, showToast]);

  // BLANK MASTER TEMPLATE EXPORT HANDLER
  const handleDownloadBlankTemplate = useCallback(async () => {
    try {
      showToast('Génération du gabarit Excel vierge...', 'info');
      await excelEngineService.downloadGmaoBlankTemplate();
      showToast('Gabarit Excel vierge (.xlsx) téléchargé avec succès !', 'success');
    } catch (err) {
      Logger.error('[ExcelOperations] Blank template download error:', err);
      showToast('Erreur lors du téléchargement du gabarit vierge.', 'error');
    }
  }, [showToast]);

  // 3-WORKBOOK INDUSTRIAL TOPOLOGY DEDICATED EXPORTERS (Type B — Consultation / Archive, non réimportable)
  // 1. Master Topology & Assets (Topology.xlsx)
  const exportMasterTopologyWorkbook = useCallback(() => {
    try {
      const wb = XLSX.utils.book_new();
      const usersData = (technicians || []).map((t) => ({
        ID: t.id_technician || t.id,
        Nom: t.nom || t.prenom || '',
        Role: t.role || 'Technicien',
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(usersData), 'Utilisateurs');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(zones || []), 'Zones');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(families || []), 'Family_Machines');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(templates || []), 'Templates_Machines');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(machines || []), 'Machines_Registered');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(machineElementsLedger || []), 'Machine_BOM_Ledger');
      XLSX.writeFile(wb, 'GMAO_Topology_Master.xlsx');
      showToast?.('Classeur 1 (Type B — Export externe, non réimportable) : GMAO_Topology_Master.xlsx exporté !', 'success');
    } catch {
      showToast?.("Erreur lors de l'export du classeur de topologie.", 'error');
    }
  }, [technicians, zones, families, templates, machines, machineElementsLedger, showToast]);

  // 2. Inventory & Materials (Inventory.xlsx)
  const exportInventoryMaterialsWorkbook = useCallback(() => {
    try {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(stockItems || rawStock || []), 'PDR_Articles');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(warehouseItems || []), 'Warehouse_Components');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(compGroups || []), 'Comp_Groups');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(compFamilies || []), 'Comp_Families');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(compTemplates || []), 'Comp_Templates');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(partTypes || []), 'Part_Types');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(partDesignations || []), 'Part_Designations');
      XLSX.writeFile(wb, 'GMAO_Inventory_Materials.xlsx');
      showToast?.('Classeur 2 (Type B — Export externe, non réimportable) : GMAO_Inventory_Materials.xlsx exporté !', 'success');
    } catch {
      showToast?.("Erreur lors de l'export du classeur d'inventaire.", 'error');
    }
  }, [stockItems, rawStock, warehouseItems, compGroups, compFamilies, compTemplates, partTypes, partDesignations, showToast]);

  // 3. Unified Movements & Gateway (Movements.xlsx)
  const exportMovementsUnifiedWorkbook = useCallback(() => {
    try {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(mouvements || []), 'Mouvements');
      if (state.sortiesExterne && state.sortiesExterne.length > 0) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(state.sortiesExterne), 'Sortie_Externe');
      }
      XLSX.writeFile(wb, 'GMAO_Movements_Unified.xlsx');
      showToast?.('Classeur 3 (Type B — Export externe, non réimportable) : GMAO_Movements_Unified.xlsx exporté !', 'success');
    } catch {
      showToast?.("Erreur lors de l'export du classeur de mouvements.", 'error');
    }
  }, [mouvements, state.sortiesExterne, showToast]);

  return {
    linkedFileHandle,
    linkedFileName,
    buildWorkbook,
    handleExportExcel,
    handleDownloadBlankTemplate,
    exportMasterTopologyWorkbook,
    exportInventoryMaterialsWorkbook,
    exportMovementsUnifiedWorkbook,
    handleImportFile,
    handleDirectFileLink,
    handleDirectSave,
    createAutomaticBackup,
    operationProgress,
  };
}
