import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { validateImportedData } from '../utils/validation';
import { sanitizeObject } from '../utils/sanitize';
import { storageService } from '../utils/storageService';
import { Logger } from '../core/logger/LoggerService';
import { excelEngineService } from '../services/excelEngineService';

/**
 * Hook to handle Excel Export, Import, Direct File System Linking and Save, with automatic versioned backups
 */
export function useAppExcelOperations({
  state,
  stockItems = [],
  diagnostics = [],
  showToast,
  fileInputRef,
}) {
  const {
    rawStock,
    setRawStock,
    mouvements,
    setMouvements,
    machines,
    setMachines,
    warehouseItems,
    setWarehouseItems,
    families,
    setFamilies,
    templates,
    setTemplates,
    blueprints,
    setBlueprints,
    zones,
    setZones,
    technicians,
    setTechnicians,
    operations,
    setOperations,
    types,
    compFamilies,
    setCompFamilies,
    compTemplates,
    setCompTemplates,
    partTypes,
    setPartTypes,
    partDesignations,
    setPartDesignations,
    machineElementsLedger,
    setMachineElementsLedger,
    setSortiesExterne,
    setPreventiveTasks,
    setCorrectiveInterventions,
  } = state;

  const [linkedFileHandle, setLinkedFileHandle] = useState(null);
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
      } catch (err) {
      if (err.name === "AbortError") return;
      if (err.name === "SecurityError" || err.name === "NotAllowedError" || (err.message && err.message.toLowerCase().includes("cross origin"))) {
        showToast("Liaison bloquée par le navigateur (iframe). Basculement vers l'import classique.", "info");
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
    ]
  );

  // HELPER TO BUILD COMPLETE EXCEL WORKBOOK
  const buildWorkbook = useCallback(() => {
    const wb = XLSX.utils.book_new();

    const autoFit = (ws, rows) => {
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

    const appendSheetWithAutofit = (name, data) => {
      if (Array.isArray(data) && data.length > 0) {
        const ws = XLSX.utils.json_to_sheet(data);
        autoFit(ws, data);
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
    state.sortiesExterne,
    state.demandes,
    state.bonsTravail,
    state.preventiveTasks,
  ]);

  // EXCEL EXPORT HANDLER WITH LIVE FORMULAS & FALLBACK
  const handleExportExcel = useCallback(async () => {
    try {
      showToast('Génération du classeur Excel avec formules vivantes...', 'info');
      await excelEngineService.downloadGmaoExcel(getFullDataset(), 'GMAO_Master_Live');
      showToast('Export Excel interactif (Formules & Styles) téléchargé avec succès !', 'success');
    } catch (err) {
      Logger.warn('[ExcelOperations] ExcelJS export fallback to XLSX:', err);
      const wb = buildWorkbook();
      XLSX.writeFile(wb, `GMAO_Light_Export_${new Date().toISOString().slice(0, 10)}.xlsx`);
      showToast('Export Excel standard généré et téléchargé.', 'success');
    }
  }, [buildWorkbook, getFullDataset, showToast]);

  // FILE IMPORT HANDLER WITH AUTOMATIC DATED BACKUP
  const handleImportFile = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (file.size > 10 * 1024 * 1024) {
        showToast('Fichier trop volumineux. La taille maximale est de 10 MB.', 'error');
        return;
      }

      const validExtensions = ['.json', '.xlsx'];
      const validMimeTypes = [
        'application/json',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ];
      const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

      if (!validExtensions.includes(fileExt) || (file.type && !validMimeTypes.includes(file.type))) {
        showToast('Format de fichier non supporté. Seuls JSON et XLSX.', 'error');
        return;
      }

      const backupDate = createAutomaticBackup('Importation : ' + file.name);
      showToast('Lecture et importation du fichier en cours...', 'info');
      const reader = new FileReader();

      reader.onerror = () => {
        showToast('Erreur de lecture du fichier sélectionné.', 'error');
      };

      reader.onload = async (evt) => {
        setOperationProgress({ active: true, percent: 30, status: 'Traitement du fichier...' });
        try {
          let importedData = {};
          if (file.name.endsWith('.json')) {
            importedData = JSON.parse(evt.target.result);
          } else {
            try {
              importedData = await excelEngineService.parseWorkbookFile(file);
            } catch (engineErr) {
              Logger.warn('[ExcelOperations] ExcelJS parse error, falling back to XLSX:', engineErr);
              const data = new Uint8Array(evt.target.result);
              const workbook = XLSX.read(data, { type: 'array' });

              if (workbook.SheetNames.includes('Stock_Actuel')) {
                importedData.Stock_Actuel = XLSX.utils.sheet_to_json(workbook.Sheets['Stock_Actuel']);
              }
              if (workbook.SheetNames.includes('Mouvements')) {
                importedData.Mouvements = XLSX.utils.sheet_to_json(workbook.Sheets['Mouvements']);
              }
              if (workbook.SheetNames.includes('Machines_Registered')) {
                importedData.Machines_Registered = XLSX.utils.sheet_to_json(
                  workbook.Sheets['Machines_Registered']
                );
              }
              if (workbook.SheetNames.includes('Warehouse_Items')) {
                importedData.Warehouse_Items = XLSX.utils.sheet_to_json(
                  workbook.Sheets['Warehouse_Items']
                );
              } else if (workbook.SheetNames.includes('Entrepot')) {
                importedData.Warehouse_Items = XLSX.utils.sheet_to_json(workbook.Sheets['Entrepot']);
              }
            }
          }

          const rawMouvements = importedData.Mouvements || importedData.Mouvement || [];

          const validation = validateImportedData({
            ...importedData,
            Mouvement: rawMouvements,
          });

          if (!validation.valid) {
            const errorMsgs = [];
            if (validation.errors.stock.length > 0)
              errorMsgs.push('Erreurs Stock: ' + validation.errors.stock.length);
            if (validation.errors.movements.length > 0)
              errorMsgs.push('Erreurs Mouvements: ' + validation.errors.movements.length);
            if (validation.errors.general.length > 0) errorMsgs.push(...validation.errors.general);

            showToast('Import échoué: données invalides. ' + errorMsgs.join(', '), 'error');
            Logger.error('[ExcelOperations] Validation failed on import', validation.errors);
            return;
          }

          if (importedData.Stock_Actuel && importedData.Stock_Actuel.length > 0)
            setRawStock(sanitizeObject(importedData.Stock_Actuel));
          if (rawMouvements && rawMouvements.length > 0)
            setMouvements(sanitizeObject(rawMouvements));
          if (importedData.Machines_Registered && importedData.Machines_Registered.length > 0)
            setMachines(sanitizeObject(importedData.Machines_Registered));
          if (importedData.Warehouse_Items && importedData.Warehouse_Items.length > 0)
            setWarehouseItems(sanitizeObject(importedData.Warehouse_Items));
          if (importedData.Families && importedData.Families.length > 0)
            setFamilies(sanitizeObject(importedData.Families));
          if (importedData.Templates && importedData.Templates.length > 0)
            setTemplates(sanitizeObject(importedData.Templates));
          if (importedData.Blueprints && importedData.Blueprints.length > 0)
            setBlueprints(sanitizeObject(importedData.Blueprints));
          if (importedData.Zones && importedData.Zones.length > 0)
            setZones(sanitizeObject(importedData.Zones));
          if (importedData.Technicians && importedData.Technicians.length > 0)
            setTechnicians(sanitizeObject(importedData.Technicians));
          if (importedData.Operations && importedData.Operations.length > 0)
            setOperations(sanitizeObject(importedData.Operations));
          if (importedData.Comp_Families && importedData.Comp_Families.length > 0)
            setCompFamilies(sanitizeObject(importedData.Comp_Families));
          if (importedData.Comp_Templates && importedData.Comp_Templates.length > 0)
            setCompTemplates(sanitizeObject(importedData.Comp_Templates));
          if (importedData.Part_Types && importedData.Part_Types.length > 0)
            setPartTypes(sanitizeObject(importedData.Part_Types));
          if (importedData.Part_Designations && importedData.Part_Designations.length > 0)
            setPartDesignations(sanitizeObject(importedData.Part_Designations));

          // Nomenclature & Pièces montées (Machine BOM Ledger)
          const bomData = importedData.Machine_BOM_Ledger || importedData.Elements_Machines || importedData.BOM;
          if (bomData && Array.isArray(bomData) && bomData.length > 0 && typeof setMachineElementsLedger === 'function') {
            setMachineElementsLedger(sanitizeObject(bomData));
          }

          // Entités opérationnelles avancées (Sorties Ext., Préventif, Correctif)
          if (importedData.Sortie_Externe && importedData.Sortie_Externe.length > 0 && typeof setSortiesExterne === 'function') {
            setSortiesExterne(sanitizeObject(importedData.Sortie_Externe));
          }
          if (importedData.Preventive_S1_S52 && importedData.Preventive_S1_S52.length > 0 && typeof setPreventiveTasks === 'function') {
            setPreventiveTasks(sanitizeObject(importedData.Preventive_S1_S52));
          }
          if ((importedData.Bons_Travail?.length > 0 || importedData.Demandes_Intervention?.length > 0) && typeof setCorrectiveInterventions === 'function') {
            const mergedCorrectif = [
              ...(importedData.Demandes_Intervention || []),
              ...(importedData.Bons_Travail || []),
            ];
            if (mergedCorrectif.length > 0) {
              setCorrectiveInterventions(sanitizeObject(mergedCorrectif));
            }
          }

          showToast('Import réussi مع استخراج ذكي! (Backup بتاريخ ' + backupDate + ')', 'success');
          Logger.info('[ExcelOperations] File imported successfully with smart parser', { file: file.name });
        } catch (err) {
          if (err.name === "AbortError") return;
          if (err.name === "SecurityError" || err.name === "NotAllowedError" || (err.message && err.message.toLowerCase().includes("cross origin"))) {
            showToast("Liaison bloquée par le navigateur (iframe). Basculement vers l'import classique.", "info");
            fileInputRef.current?.click();
            return;
          }
          showToast('Erreur lors de la lecture du fichier.', 'error');
          Logger.error('[ExcelOperations] Import error:', err);
        } finally {
          setOperationProgress({ active: false, percent: 100, status: '' });
        }
      };

      if (file.name.endsWith('.json')) {
        reader.readAsText(file);
      } else {
        reader.readAsArrayBuffer(file);
      }
    },
    [
      createAutomaticBackup,
      showToast,
      setRawStock,
      setMouvements,
      setMachines,
      setWarehouseItems,
      setFamilies,
      setTemplates,
      setBlueprints,
      setZones,
      setTechnicians,
      setOperations,
      setCompFamilies,
      setCompTemplates,
      setPartTypes,
      setPartDesignations,
    ]
  );

  // DIRECT FILE SYSTEM ACCESS API LINK
  const handleDirectFileLink = useCallback(async () => {
    if (!('showOpenFilePicker' in window)) {
      showToast(
        "Liaison directe disponible sur Chrome/Edge. Basculement vers l'import classique.",
        'info'
      );
      fileInputRef.current?.click();
      return;
    }

    try {
      const [handle] = await window.showOpenFilePicker({
        types: [
          {
            description: 'Fichiers Excel GMAO (.xlsx)',
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
      const backupDate = createAutomaticBackup(`Avant Liaison Directe : ${file.name}`);

      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array', cellDates: true });

      const importedData = {};
      if (workbook.SheetNames.includes('Stock_Actuel')) {
        importedData.Stock_Actuel = XLSX.utils.sheet_to_json(workbook.Sheets['Stock_Actuel']);
      }
      if (workbook.SheetNames.includes('Machines_Registered')) {
        importedData.Machines = XLSX.utils.sheet_to_json(workbook.Sheets['Machines_Registered']);
      }
      if (workbook.SheetNames.includes('Mouvements')) {
        importedData.Mouvement = XLSX.utils.sheet_to_json(workbook.Sheets['Mouvements']);
      }

      const validation = validateImportedData(importedData);
      if (!validation.valid && (validation.errors.stock.length > 0 || validation.errors.movements.length > 0)) {
        showToast(
          `⚠️ Données liées avec des avertissements (${validation.errors.stock.length} erreurs stock, ${validation.errors.movements.length} erreurs mouvements)`,
          'warning'
        );
      }

      if (importedData.Stock_Actuel && importedData.Stock_Actuel.length > 0) {
        setRawStock(importedData.Stock_Actuel.map(sanitizeObject));
      }
      if (importedData.Machines && importedData.Machines.length > 0) {
        setMachines(importedData.Machines.map(sanitizeObject));
      }
      if (importedData.Mouvement && importedData.Mouvement.length > 0) {
        setMouvements(importedData.Mouvement.map(sanitizeObject));
      }

      setLinkedFileHandle(handle);
      setLinkedFileName(file.name);
      showToast(
        `🔗 Fichier "${file.name}" lié en direct ! (Backup sauvegardé : ${backupDate})`,
        'success'
      );
    } catch (err) {
      if (err.name === "AbortError") return;
      if (err.name === "SecurityError" || err.name === "NotAllowedError" || (err.message && err.message.toLowerCase().includes("cross origin"))) {
        showToast("Liaison bloquée par le navigateur (iframe). Basculement vers l'import classique.", "info");
        fileInputRef.current?.click();
        return;
      }
      if (err.name !== 'AbortError') {
        Logger.error('[ExcelOperations] Direct link error:', err);
        showToast("Erreur lors de l'accès au fichier sélectionné.", 'error');
      }
    }
  }, [createAutomaticBackup, fileInputRef, setMachines, setMouvements, setRawStock, showToast]);

  // DIRECT FILE SYSTEM SAVE HANDLER WITH LIVE FORMULAS
  const handleDirectSave = useCallback(async () => {
    if (!linkedFileHandle) {
      handleExportExcel();
      return;
    }

    try {
      let buffer;
      try {
        const workbook = await excelEngineService.buildGmaoWorkbook(getFullDataset());
        buffer = await workbook.xlsx.writeBuffer();
      } catch (eEngineErr) {
        Logger.warn('[ExcelOperations] ExcelJS save fallback to XLSX:', eEngineErr);
        const wb = buildWorkbook();
        buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      }

      const writable = await linkedFileHandle.createWritable();
      await writable.write(buffer);
      await writable.close();

      showToast(`💾 Écriture directe avec formules vivantes réussie dans "${linkedFileName}" !`, 'success');
    } catch (err) {
      if (err.name === "AbortError") return;
      if (err.name === "SecurityError" || err.name === "NotAllowedError" || (err.message && err.message.toLowerCase().includes("cross origin"))) {
        showToast("Liaison bloquée par le navigateur (iframe). Basculement vers l'import classique.", "info");
        fileInputRef.current?.click();
        return;
      }
      Logger.error('[ExcelOperations] Direct save error:', err);
      showToast('Écriture directe impossible. Exportation standard...', 'info');
      handleExportExcel();
    }
  }, [buildWorkbook, getFullDataset, handleExportExcel, linkedFileHandle, linkedFileName, showToast]);

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

  // 3-WORKBOOK INDUSTRIAL TOPOLOGY DEDICATED EXPORTERS
  // 1. Master Topology & Assets (Topology.xlsx)
  const exportMasterTopologyWorkbook = useCallback(() => {
    try {
      const wb = XLSX.utils.book_new();
      const usersData = (technicians || []).map((t) => ({ ID: t.id_technicien || t.id, Nom: t.nom || t.name, Role: t.role || 'Technicien' }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(usersData), 'Utilisateurs');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(zones || []), 'Zones');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(families || []), 'Family_Machines');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(templates || []), 'Templates_Machines');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(machines || []), 'Machines_Registered');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(machineElementsLedger || []), 'Machine_BOM_Ledger');
      XLSX.writeFile(wb, 'GMAO_Topology_Master.xlsx');
      showToast?.('Classeur 1: GMAO_Topology_Master.xlsx exporté avec succès !', 'success');
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
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(partTypes || []), 'Part_Types');
      XLSX.writeFile(wb, 'GMAO_Inventory_Materials.xlsx');
      showToast?.('Classeur 2: GMAO_Inventory_Materials.xlsx exporté avec succès !', 'success');
    } catch {
      showToast?.("Erreur lors de l'export du classeur d'inventaire.", 'error');
    }
  }, [stockItems, rawStock, warehouseItems, partTypes, showToast]);

  // 3. Unified Movements & Gateway (Movements.xlsx)
  const exportMovementsUnifiedWorkbook = useCallback(() => {
    try {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(mouvements || []), 'Mouvements');
      if (state.sortiesExterne && state.sortiesExterne.length > 0) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(state.sortiesExterne), 'Sortie_Externe');
      }
      XLSX.writeFile(wb, 'GMAO_Movements_Unified.xlsx');
      showToast?.('Classeur 3: GMAO_Movements_Unified.xlsx exporté avec succès !', 'success');
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
