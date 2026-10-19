/**
 * 🏛️ GMAO Advanced Excel Engine & Data Injection Service
 * Conforme à la Constitution GMAO : Formules jumelles Excel vivantes (SUMIFS, COUNTIFS, IF),
 * liaisons multi-feuilles (Cross-Sheet Referencing), et styles industriels haute fidélité avec ExcelJS.
 */
import ExcelJS from 'exceljs';
import { Logger } from '../core/logger/LoggerService';
import { GmaoFormulaSanitizer } from '../utils/gmaoAdvancedEngine';

class ExcelEngineService {
  /**
   * Palette de styles industriels GMAO
   */
  getStyles() {
    return {
      headerFill: {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E293B' }, // Slate 800
      },
      headerFont: {
        name: 'Segoe UI',
        size: 10,
        bold: true,
        color: { argb: 'FFFFFFFF' },
      },
      accentHeaderFill: {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0F766E' }, // Teal 700
      },
      kpiTitleFill: {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF334155' }, // Slate 700
      },
      zebraFill: {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF8FAFC' }, // Slate 50
      },
      alertFill: {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFEE2E2' }, // Red 100
      },
      alertFont: {
        name: 'Segoe UI',
        size: 9.5,
        bold: true,
        color: { argb: 'FF991B1B' }, // Red 800
      },
      okFill: {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFDCFCE7' }, // Emerald 100
      },
      okFont: {
        name: 'Segoe UI',
        size: 9.5,
        bold: true,
        color: { argb: 'FF166534' }, // Emerald 800
      },
      thinBorder: {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      },
      regularFont: {
        name: 'Segoe UI',
        size: 9.5,
        color: { argb: 'FF1E293B' },
      },
      monoFont: {
        name: 'Consolas',
        size: 9.5,
        bold: true,
        color: { argb: 'FF0F172A' },
      },
    };
  }

  /**
   * Génère un classeur Excel complet avec formules multi-feuilles vivantes et styles
   */
  async buildGmaoWorkbook({
    stockItems = [],
    rawStock = [],
    mouvements = [],
    machines = [],
    warehouseItems = [],
    zones = [],
    technicians = [],
    operations = [],
    types = [],
    diagnostics = [],
    families = [],
    templates = [],
    sortiesExterne = [],
    demandes = [],
    bonsTravail = [],
    preventiveTasks = [],
  } = {}) {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'GMAO Industrial Engine';
    wb.lastModifiedBy = 'GMAO Industrial Engine';
    wb.created = new Date();
    wb.modified = new Date();

    const styles = this.getStyles();

    // ==========================================
    // FEUILLE 1 : SYNTHÈSE & TABLEAU DE BORD GMAO
    // ==========================================
    const wsDashboard = wb.addWorksheet('Synthèse_GMAO', {
      views: [{ showGridLines: true }],
    });

    wsDashboard.columns = [
      { width: 4 },
      { width: 32 },
      { width: 22 },
      { width: 4 },
      { width: 32 },
      { width: 22 },
    ];

    // Titre Principal
    wsDashboard.mergeCells('B2:F2');
    const titleCell = wsDashboard.getCell('B2');
    titleCell.value = 'RÉSUMÉ EXÉCUTIF & FORMULES JUMELLES GMAO';
    titleCell.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = styles.headerFill;
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    wsDashboard.getRow(2).height = 36;

    // Bloc Métriques Stock
    wsDashboard.getCell('B4').value = 'MÉTRIQUES STOCKS & MAGASIN PDR';
    wsDashboard.getCell('B4').font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    wsDashboard.getCell('B4').fill = styles.kpiTitleFill;
    wsDashboard.mergeCells('B4:C4');

    const stockMetrics = [
      { label: "Nombre total d'articles PDR", formula: '=COUNTA(Stock_Actuel!A2:A5000)' },
      { label: 'Articles en Seuil Critique / Alerte', formula: '=COUNTIF(Stock_Actuel!J2:J5000, "ALERTE")' },
      { label: 'Quantité totale en Stock Actuel', formula: '=SUM(Stock_Actuel!H2:H5000)' },
      { label: 'Total cumulé des Entrées PDR', formula: '=SUM(Stock_Actuel!F2:F5000)' },
      { label: 'Total cumulé des Sorties PDR', formula: '=SUM(Stock_Actuel!G2:G5000)' },
    ];

    stockMetrics.forEach((m, idx) => {
      const r = 5 + idx;
      wsDashboard.getCell(`B${r}`).value = m.label;
      wsDashboard.getCell(`B${r}`).font = styles.regularFont;
      wsDashboard.getCell(`B${r}`).border = styles.thinBorder;

      const valCell = wsDashboard.getCell(`C${r}`);
      valCell.value = { formula: m.formula };
      valCell.font = styles.monoFont;
      valCell.alignment = { horizontal: 'right' };
      valCell.border = styles.thinBorder;
      valCell.numFmt = '#,##0';
    });

    // Bloc Métriques Opérations & Parc
    wsDashboard.getCell('E4').value = 'MÉTRIQUES PARC & OPÉRATIONS';
    wsDashboard.getCell('E4').font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    wsDashboard.getCell('E4').fill = styles.kpiTitleFill;
    wsDashboard.mergeCells('E4:F4');

    const opsMetrics = [
      { label: 'Parc Machines Enregistrées', formula: '=COUNTA(Machines_Registered!A2:A2000)' },
      { label: 'Lignes du Journal des Mouvements', formula: '=COUNTA(Mouvements!A2:A20000)' },
      { label: 'Bons de Travail Curatifs (BT)', formula: '=COUNTA(Bons_Travail!A2:A5000)' },
      { label: 'Demandes d\'Intervention (DI)', formula: '=COUNTA(Demandes_Intervention!A2:A5000)' },
      { label: 'Tâches de Maintenance Préventive', formula: '=COUNTA(Preventive_S1_S52!A2:A5000)' },
    ];

    opsMetrics.forEach((m, idx) => {
      const r = 5 + idx;
      wsDashboard.getCell(`E${r}`).value = m.label;
      wsDashboard.getCell(`E${r}`).font = styles.regularFont;
      wsDashboard.getCell(`E${r}`).border = styles.thinBorder;

      const valCell = wsDashboard.getCell(`F${r}`);
      valCell.value = { formula: m.formula };
      valCell.font = styles.monoFont;
      valCell.alignment = { horizontal: 'right' };
      valCell.border = styles.thinBorder;
      valCell.numFmt = '#,##0';
    });

    // ==========================================
    // FEUILLE 2 : STOCK ACTUEL AVEC FORMULES VIVANTES
    // ==========================================
    const wsStock = wb.addWorksheet('Stock_Actuel', {
      views: [{ state: 'frozen', ySplit: 1, showGridLines: true }],
    });

    const stockHeaders = [
      { header: 'Ref', key: 'ref', width: 16 },
      { header: 'Désignation', key: 'designation', width: 34 },
      { header: 'ID_Type', key: 'id_type', width: 15 },
      { header: 'ID_Diagnostic', key: 'id_diag', width: 15 },
      { header: 'Stock Initial', key: 'stockInitial', width: 14 },
      { header: 'Entrées (Formule)', key: 'entrees', width: 16 },
      { header: 'Sorties (Formule)', key: 'sorties', width: 16 },
      { header: 'Stock Actuel (Formule)', key: 'stockActuel', width: 18 },
      { header: 'Seuil', key: 'seuil', width: 12 },
      { header: 'Alerte (Formule)', key: 'alerte', width: 14 },
      { header: 'Emplacement', key: 'emplacement', width: 18 },
    ];
    wsStock.columns = stockHeaders;

    // Ligne d'en-tête
    const stockHeaderRow = wsStock.getRow(1);
    stockHeaderRow.height = 24;
    stockHeaderRow.eachCell((cell) => {
      cell.fill = styles.headerFill;
      cell.font = styles.headerFont;
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = styles.thinBorder;
    });

    // Remplissage avec Formules Multi-Feuilles Vivantes
    const itemsSource = stockItems.length > 0 ? stockItems : rawStock;
    itemsSource.forEach((s, idx) => {
      const rowNum = idx + 2;
      const ref = s.ref || `ART-${idx + 1}`;
      const stockInitial = Number(s.stockInitial) || 0;
      const seuil = Number(s.seuil) || 0;
      const cachedEntrees = Number(s.entrees) || 0;
      const cachedSorties = Number(s.sorties) || 0;
      const cachedActuel = Number(s.stockActuel ?? (stockInitial + cachedEntrees - cachedSorties));

      // Formules jumelles Excel strictes pointant vers l'onglet Mouvements
      // Col B dans Mouvements = ref, Col C = quantite, Col D = type ('Entrée'/'Sortie')
      const formulaEntrees = `SUMIFS(Mouvements!C:C, Mouvements!B:B, A${rowNum}, Mouvements!D:D, "Entrée")`;
      const formulaSorties = `SUMIFS(Mouvements!C:C, Mouvements!B:B, A${rowNum}, Mouvements!D:D, "Sortie")`;
      const formulaActuel = `E${rowNum}+F${rowNum}-G${rowNum}`;
      const formulaAlerte = `IF(H${rowNum}<=I${rowNum},"ALERTE","OK")`;

      const row = wsStock.addRow({
        ref: GmaoFormulaSanitizer.sanitize(ref),
        designation: GmaoFormulaSanitizer.sanitize(s.designation || ''),
        id_type: GmaoFormulaSanitizer.sanitize(s.id_type || ''),
        id_diag: GmaoFormulaSanitizer.sanitize(s.id_diag || ''),
        stockInitial,
        entrees: { formula: formulaEntrees, result: cachedEntrees },
        sorties: { formula: formulaSorties, result: cachedSorties },
        stockActuel: { formula: formulaActuel, result: cachedActuel },
        seuil,
        alerte: { formula: formulaAlerte, result: cachedActuel <= seuil ? 'ALERTE' : 'OK' },
        emplacement: GmaoFormulaSanitizer.sanitize(s.emplacement || 'Magasin PDR'),
      });

      row.height = 20;

      // Stylisation des cellules
      row.getCell('ref').font = styles.monoFont;
      row.getCell('ref').border = styles.thinBorder;

      row.getCell('designation').font = styles.regularFont;
      row.getCell('designation').border = styles.thinBorder;

      row.getCell('id_type').font = styles.regularFont;
      row.getCell('id_type').border = styles.thinBorder;

      row.getCell('id_diag').font = styles.regularFont;
      row.getCell('id_diag').border = styles.thinBorder;

      // Valeurs numériques avec formatage
      ['stockInitial', 'entrees', 'sorties', 'stockActuel', 'seuil'].forEach((k) => {
        const c = row.getCell(k);
        c.font = styles.monoFont;
        c.border = styles.thinBorder;
        c.alignment = { horizontal: 'right', vertical: 'middle' };
        c.numFmt = '#,##0';
      });

      // Cellule Alerte avec couleur conditionnelle pré-calculée
      const alerteCell = row.getCell('alerte');
      alerteCell.border = styles.thinBorder;
      alerteCell.alignment = { horizontal: 'center', vertical: 'middle' };
      if (cachedActuel <= seuil) {
        alerteCell.fill = styles.alertFill;
        alerteCell.font = styles.alertFont;
      } else {
        alerteCell.fill = styles.okFill;
        alerteCell.font = styles.okFont;
      }

      row.getCell('emplacement').font = styles.regularFont;
      row.getCell('emplacement').border = styles.thinBorder;
    });

    // ==========================================
    // FEUILLE 3 : JOURNAL DES MOUVEMENTS
    // ==========================================
    const wsMvts = wb.addWorksheet('Mouvements', {
      views: [{ state: 'frozen', ySplit: 1, showGridLines: true }],
    });

    const mvtHeaders = [
      { header: 'ID_Mouvement', key: 'id', width: 14 },
      { header: 'Ref Article', key: 'ref', width: 16 },
      { header: 'Quantité', key: 'quantite', width: 14 },
      { header: 'Type Mouvement', key: 'type', width: 16 },
      { header: 'Date', key: 'date', width: 18 },
      { header: 'Machine Associée', key: 'machine', width: 18 },
      { header: 'Zone', key: 'zone', width: 16 },
      { header: 'Intervenant / Demandeur', key: 'technicien', width: 22 },
      { header: 'Commentaire', key: 'commentaire', width: 35 },
    ];
    wsMvts.columns = mvtHeaders;

    const mvtHeaderRow = wsMvts.getRow(1);
    mvtHeaderRow.height = 24;
    mvtHeaderRow.eachCell((cell) => {
      cell.fill = styles.accentHeaderFill;
      cell.font = styles.headerFont;
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = styles.thinBorder;
    });

    (mouvements || []).forEach((m, idx) => {
      const qte = Number(m.quantite) || 0;
      const row = wsMvts.addRow({
        id: m.id || `MVT-${String(idx + 1).padStart(4, '0')}`,
        ref: m.ref || '',
        quantite: qte,
        type: m.type || 'Sortie',
        date: m.date || new Date().toISOString().slice(0, 10),
        machine: m.id_machine_registered || m.machine || '',
        zone: m.id_zone || m.zone || '',
        technicien: m.technicien || m.demandeur || m.technician || '',
        commentaire: m.commentaire || '',
      });

      row.height = 20;
      row.getCell('id').font = styles.monoFont;
      row.getCell('ref').font = styles.monoFont;
      row.getCell('quantite').font = styles.monoFont;
      row.getCell('quantite').numFmt = '#,##0';
      row.getCell('quantite').alignment = { horizontal: 'right' };

      const typeCell = row.getCell('type');
      typeCell.alignment = { horizontal: 'center' };
      if (m.type === 'Entrée') {
        typeCell.font = styles.okFont;
        typeCell.fill = styles.okFill;
      } else {
        typeCell.font = styles.alertFont;
        typeCell.fill = styles.alertFill;
      }

      ['id', 'ref', 'quantite', 'type', 'date', 'machine', 'zone', 'technicien', 'commentaire'].forEach((k) => {
        row.getCell(k).border = styles.thinBorder;
      });
    });

    // ==========================================
    // FEUILLE 4 : MACHINES REGISTERED
    // ==========================================
    const wsMachines = wb.addWorksheet('Machines_Registered', {
      views: [{ state: 'frozen', ySplit: 1, showGridLines: true }],
    });

    wsMachines.columns = [
      { header: 'Code Machine (Ref)', key: 'id_machine_registered', width: 20 },
      { header: 'Désignation', key: 'designation', width: 32 },
      { header: 'ID_Family', key: 'id_family', width: 16 },
      { header: 'ID_Template', key: 'id_templates', width: 16 },
      { header: 'Zone_Default', key: 'id_zone_default', width: 16 },
      { header: 'Technicien Référent', key: 'technician', width: 22 },
      { header: 'Statut Opérationnel', key: 'status', width: 18 },
    ];

    wsMachines.getRow(1).height = 24;
    wsMachines.getRow(1).eachCell((cell) => {
      cell.fill = styles.headerFill;
      cell.font = styles.headerFont;
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = styles.thinBorder;
    });

    (machines || []).forEach((m) => {
      const row = wsMachines.addRow({
        id_machine_registered: m.id_machine_registered || '',
        designation: m.designation || '',
        id_family: m.id_family || '',
        id_templates: m.id_templates || '',
        id_zone_default: m.id_zone_default || '',
        technician: m.technician || '',
        status: m.status || 'En service',
      });
      row.height = 20;
      row.getCell('id_machine_registered').font = styles.monoFont;
      row.eachCell((c) => (c.border = styles.thinBorder));
    });

    // ==========================================
    // FEUILLES ANNEXES (Warehouse, Interventions, Préventif, Référentiels)
    // ==========================================
    this.appendGenericTableSheet(wb, 'Warehouse_Items', warehouseItems, styles);
    this.appendGenericTableSheet(wb, 'Demandes_Intervention', demandes, styles);
    this.appendGenericTableSheet(wb, 'Bons_Travail', bonsTravail, styles);
    this.appendGenericTableSheet(wb, 'Preventive_S1_S52', preventiveTasks, styles);
    this.appendGenericTableSheet(wb, 'Sortie_Externe', sortiesExterne, styles);
    this.appendGenericTableSheet(wb, 'Zones', zones, styles);
    this.appendGenericTableSheet(wb, 'Technicians', technicians, styles);
    this.appendGenericTableSheet(wb, 'Operations', operations, styles);
    this.appendGenericTableSheet(wb, 'Types', types, styles);
    this.appendGenericTableSheet(wb, 'Diagnostics', diagnostics, styles);
    this.appendGenericTableSheet(wb, 'Families', families, styles);
    this.appendGenericTableSheet(wb, 'Templates', templates, styles);

    return wb;
  }

  /**
   * Helper pour injecter une table générique dans une feuille dédiée
   */
  appendGenericTableSheet(workbook, sheetName, items, styles) {
    if (!Array.isArray(items) || items.length === 0) return;

    const ws = workbook.addWorksheet(sheetName, {
      views: [{ state: 'frozen', ySplit: 1, showGridLines: true }],
    });

    const sample = items[0] || {};
    const keys = Object.keys(sample).filter((k) => typeof sample[k] !== 'function');

    ws.columns = keys.map((key) => {
      let maxLen = String(key).length;
      items.slice(0, 100).forEach((item) => {
        const val = item[key];
        if (val != null) {
          const l = String(val).length;
          if (l > maxLen) maxLen = l;
        }
      });
      return {
        header: key,
        key,
        width: Math.min(Math.max(maxLen + 3, 14), 45),
      };
    });

    const headerRow = ws.getRow(1);
    headerRow.height = 24;
    headerRow.eachCell((cell) => {
      cell.fill = styles.headerFill;
      cell.font = styles.headerFont;
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = styles.thinBorder;
    });

    items.forEach((item) => {
      const row = ws.addRow(item);
      row.height = 20;
      row.eachCell((cell) => {
        cell.font = styles.regularFont;
        cell.border = styles.thinBorder;
      });
    });
  }

  /**
   * Génère le fichier binaire sous forme de Buffer / Blob pour téléchargement navigateur
   */
  async exportToBlob(dataset) {
    try {
      const workbook = await this.buildGmaoWorkbook(dataset);
      const buffer = await workbook.xlsx.writeBuffer();
      return new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
    } catch (error) {
      Logger.error('[ExcelEngineService] Export error:', error);
      throw error;
    }
  }

  /**
   * Déclenche le téléchargement direct dans le navigateur
   */
  async downloadGmaoExcel(dataset, fileNamePrefix = 'GMAO_Master_Live') {
    const blob = await this.exportToBlob(dataset);
    const dateStr = new Date().toISOString().slice(0, 10);
    const fullFileName = `${fileNamePrefix}_${dateStr}.xlsx`;

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fullFileName;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    return fullFileName;
  }

  /**
   * Analyse et décode un fichier Excel (.xlsx) avec extraction rigoureuse des valeurs calculées (Data-Only Evaluation)
   */
  async parseWorkbookFile(fileOrBuffer) {
    const wb = new ExcelJS.Workbook();
    if (fileOrBuffer instanceof ArrayBuffer || ArrayBuffer.isView(fileOrBuffer)) {
      await wb.xlsx.load(fileOrBuffer);
    } else if (fileOrBuffer.arrayBuffer) {
      const buf = await fileOrBuffer.arrayBuffer();
      await wb.xlsx.load(buf);
    } else {
      throw new Error('Type de fichier ou tampon non reconnu');
    }

    const result = {
      Stock_Actuel: [],
      Mouvements: [],
      Machines_Registered: [],
      Warehouse_Items: [],
      Demandes_Intervention: [],
      Bons_Travail: [],
      Preventive_S1_S52: [],
      Sortie_Externe: [],
      Zones: [],
      Technicians: [],
      Operations: [],
      Types: [],
      Diagnostics: [],
      Families: [],
      Templates: [],
      Comp_Families: [],
      Comp_Templates: [],
      Part_Types: [],
      Part_Designations: [],
      Blueprints: [],
    };

    const extractCellValue = (cell) => {
      if (!cell) return '';
      const v = cell.value;
      if (v === null || v === undefined) return '';
      if (typeof v === 'object') {
        if (v.result !== undefined && v.result !== null) return v.result;
        if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join('');
        if (v.text !== undefined) return v.text;
      }
      return v;
    };

    const extractSheetRows = (sheet) => {
      if (!sheet || sheet.rowCount < 2) return [];
      const headers = [];
      const firstRow = sheet.getRow(1);
      firstRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        headers[colNumber] = String(cell.value || '').trim();
      });

      const rows = [];
      for (let r = 2; r <= sheet.rowCount; r++) {
        const row = sheet.getRow(r);
        let hasData = false;
        const rowData = {};

        headers.forEach((header, colIdx) => {
          if (!header) return;
          const val = extractCellValue(row.getCell(colIdx));
          if (val !== '' && val !== null && val !== undefined) {
            hasData = true;
          }
          rowData[header] = val;
        });

        if (hasData) {
          rows.push(rowData);
        }
      }
      return rows;
    };

    wb.eachSheet((ws) => {
      const name = ws.name.trim();
      const lower = name.toLowerCase();

      if (lower === 'stock_actuel' || lower === 'stock' || lower === 'articles' || lower === 'pdr_articles') {
        const rawRows = extractSheetRows(ws);
        result.Stock_Actuel = rawRows
          .map((r) => ({
            ref: r.Ref || r.ref || r['Référence'] || r['Ref Article'] || '',
            designation: r['Désignation'] || r.designation || r.Designation || '',
            id_type: r.ID_Type || r.id_type || '',
            id_diag: r.ID_Diagnostic || r.id_diag || '',
            stockInitial: Number(r['Stock Initial'] ?? r.stockInitial) || 0,
            entrees: Number(r['Entrées (Formule)'] ?? r.Entrées ?? r.entrees) || 0,
            sorties: Number(r['Sorties (Formule)'] ?? r.Sorties ?? r.sorties) || 0,
            stockActuel: Number(r['Stock Actuel (Formule)'] ?? r['Stock Actuel'] ?? r.stockActuel) || 0,
            seuil: Number(r.Seuil ?? r.seuil) || 0,
            alerte: String(r['Alerte (Formule)'] ?? r.Alerte ?? r.alerte ?? 'OK'),
            emplacement: r.Emplacement || r.emplacement || '',
          }))
          .filter((item) => item.ref);
      } else if (lower === 'mouvements' || lower === 'journal') {
        const rawRows = extractSheetRows(ws);
        result.Mouvements = rawRows
          .map((r, idx) => ({
            id: r.ID_Mouvement || r.id || `MVT-${idx + 1}`,
            ref: r['Ref Article'] || r.ref || r.Ref || '',
            quantite: Number(r['Quantité'] ?? r.quantite) || 0,
            type: r['Type Mouvement'] || r.type || 'Sortie',
            date: r.Date || r.date || new Date().toISOString().slice(0, 10),
            id_machine_registered: r['Machine Associée'] || r.machine || r.id_machine_registered || '',
            id_zone: r.Zone || r.zone || r.id_zone || '',
            technicien: r['Intervenant / Demandeur'] || r.technicien || r.demandeur || '',
            commentaire: r.Commentaire || r.commentaire || '',
          }))
          .filter((m) => m.ref);
      } else if (lower === 'machine_bom_ledger' || lower === 'bom_ledger' || lower === 'bom') {
        result.Machine_BOM_Ledger = extractSheetRows(ws);
      } else if (lower.includes('machine')) {
        result.Machines_Registered = extractSheetRows(ws);
      } else if (lower.includes('warehouse') || lower.includes('entrepot')) {
        result.Warehouse_Items = extractSheetRows(ws);
      } else if (lower.includes('demande')) {
        result.Demandes_Intervention = extractSheetRows(ws);
      } else if (lower.includes('bon') || lower === 'bt' || lower.includes('travail')) {
        result.Bons_Travail = extractSheetRows(ws);
      } else if (lower.includes('preventif') || lower.includes('preventive')) {
        result.Preventive_S1_S52 = extractSheetRows(ws);
      } else if (lower.includes('sortie_externe')) {
        result.Sortie_Externe = extractSheetRows(ws);
      } else if (lower === 'zones') {
        result.Zones = extractSheetRows(ws);
      } else if (lower === 'technicians' || lower === 'techniciens' || lower === 'utilisateurs' || lower === 'users') {
        result.Technicians = extractSheetRows(ws);
      } else if (lower === 'operations') {
        result.Operations = extractSheetRows(ws);
      } else if (lower === 'types') {
        result.Types = extractSheetRows(ws);
      } else if (lower === 'diagnostics') {
        result.Diagnostics = extractSheetRows(ws);
      } else if (lower === 'families' || lower === 'family_machines') {
        result.Families = extractSheetRows(ws);
      } else if (lower === 'templates' || lower === 'templates_machines') {
        result.Templates = extractSheetRows(ws);
      } else if (lower === 'part_types') {
        result.Part_Types = extractSheetRows(ws);
      } else if (lower === 'part_designations') {
        result.Part_Designations = extractSheetRows(ws);
      }
    });

    return result;
  }

  /**
   * Génère le gabarit Excel vierge (Template .XLSX) pré-calibré avec les formules d'usine
   */
  async downloadGmaoBlankTemplate() {
    const sampleStock = [
      {
        ref: 'PDR-SAMPLE-01',
        designation: 'Exemple Roulement à billes 6204',
        id_type: 'ROULEMENT',
        id_diag: 'MECANIQUE',
        stockInitial: 10,
        seuil: 3,
        emplacement: 'Rayon A-01',
      },
      {
        ref: 'PDR-SAMPLE-02',
        designation: 'Exemple Filtre hydraulique 10µ',
        id_type: 'FILTRE',
        id_diag: 'HYDRAULIQUE',
        stockInitial: 5,
        seuil: 2,
        emplacement: 'Rayon B-04',
      },
    ];

    const sampleMouvements = [
      {
        id: 'MVT-0001',
        ref: 'PDR-SAMPLE-01',
        quantite: 5,
        type: 'Entrée',
        machine: 'MCH-01',
        zone: 'Zone Atelier',
        technicien: 'Tech 1',
        commentaire: 'Livraison initiale fournisseur',
      },
      {
        id: 'MVT-0002',
        ref: 'PDR-SAMPLE-01',
        quantite: 2,
        type: 'Sortie',
        machine: 'MCH-01',
        zone: 'Zone Atelier',
        technicien: 'Tech 1',
        commentaire: 'Remplacement préventif',
      },
    ];

    const sampleMachines = [
      {
        id_machine_registered: 'MCH-01',
        designation: 'Exemple Presse Injection PRI-01',
        id_family: 'PRESSE_INJ',
        id_templates: 'TMP-PRESSE',
        id_zone_default: 'Zone Atelier',
        technician: 'Tech 1',
        status: 'En service',
      },
    ];

    return this.downloadGmaoExcel(
      {
        stockItems: sampleStock,
        mouvements: sampleMouvements,
        machines: sampleMachines,
        warehouseItems: [],
        zones: [{ id_zone: 'Zone Atelier', code: 'ZA', libelle: 'Atelier Principal de Production' }],
        technicians: [{ matricule: 'TECH-01', nom: 'Technicien Exemple', role: 'Technicien' }],
      },
      'GMAO_Gabarit_Vierge_Template'
    );
  }
}

export const excelEngineService = new ExcelEngineService();
export default excelEngineService;
