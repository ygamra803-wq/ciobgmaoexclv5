import React, { useState, useRef } from 'react';
import {
  Sliders,
  Layers,
  Cpu,
  Users,
  Activity,
  Wrench,
  FileSpreadsheet,
  Trash2,
  Package,
  Calendar,
  Power,
  CheckCircle2,
  Database,
  AlertTriangle,
  Upload,
  Download,
  ShieldCheck,
  XCircle,
  KeyRound,
  ArrowRight,
} from 'lucide-react';
import { SettingsSectionCard, SETTINGS_BUTTON_STYLES } from './settingsUi';
import { confirmAction } from '../../../../utils/confirmAction';
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
  validateAndCommitAssetsMachinesBundle,
  validateAndCommitCmCatalogBundle,
  validateAndCommitEntrepotBomBundle,
  validateAndCommitPmCatalogBundle,
  validateAndCommitRefParcBundle,
  validateAndCommitRefPdrBundle,
  validateAndCommitRefPersonnelBundle,
} from '../../../../services/import/unifiedImportPipeline';
import {
  downloadTypeAExcelWorkbook,
  parseTypeAExcelWorkbook,
  type TypeAExcelBundleKind,
} from '../../../../services/import/typeAExcelBridge';
import type {
  ImportMode,
  ImportReport,
  ImportSourceOrigin,
} from '../../../../services/import/types/unifiedImportTypes';

const BUNDLE_META: Record<
  TypeAExcelBundleKind,
  {
    jsonFilename: string;
    xlsxFilename: string;
    exportPrefix: string;
  }
> = {
  REF_PARC: {
    jsonFilename: 'REF_PARC.template.json',
    xlsxFilename: 'REF_PARC.template.xlsx',
    exportPrefix: 'CIOB_REF_PARC',
  },
  REF_PERSONNEL: {
    jsonFilename: 'REF_PERSONNEL.template.json',
    xlsxFilename: 'REF_PERSONNEL.template.xlsx',
    exportPrefix: 'CIOB_REF_PERSONNEL',
  },
  ASSETS_MACHINES: {
    jsonFilename: 'ASSETS_MACHINES.template.json',
    xlsxFilename: 'ASSETS_MACHINES.template.xlsx',
    exportPrefix: 'CIOB_ASSETS_MACHINES',
  },
  REF_PDR: {
    jsonFilename: 'REF_PDR.template.json',
    xlsxFilename: 'REF_PDR.template.xlsx',
    exportPrefix: 'CIOB_REF_PDR',
  },
  PM_CATALOG: {
    jsonFilename: 'PM_CATALOG.template.json',
    xlsxFilename: 'PM_CATALOG.template.xlsx',
    exportPrefix: 'CIOB_PM_CATALOG',
  },
  ENTREPOT_BOM: {
    jsonFilename: 'ENTREPOT_BOM.template.json',
    xlsxFilename: 'ENTREPOT_BOM.template.xlsx',
    exportPrefix: 'CIOB_ENTREPOT_BOM',
  },
  CM_CATALOG: {
    jsonFilename: 'CM_CATALOG.template.json',
    xlsxFilename: 'CM_CATALOG.template.xlsx',
    exportPrefix: 'CIOB_CM_CATALOG',
  },
};

/**
 * Data Injection Hub:
 * 1) Mode B — Structured Bundle Ingestion & Reverse Export (UnifiedImportPipeline: JSON & Excel Type A)
 * 2) Mode C — Demo Dataset Control via DataGateway
 * 3) Mode A — Empty Factory Reset (`START_MODE = 'empty'`)
 */
export default function SettingsInjectionTab({
  handleInjectAll,
  initialStock = [],
  handleInjectGroup,
  handleClearGroup,
  initialMachines = [],
  initialZones = [],
  initialTechnicians = [],
  initialMouvements = [],
  initialCorrectiveInterventions = [],
  warehouseCount = 0,
  preventiveCount = 0,
  isDemoMode,
  setIsDemoMode,
  onToggleDemoMode,
  onDownloadBlankTemplate,
  showToast,
  handleSaveSettings,
  handleResetToZero,
  currentUser,
  onNavigateToUsers,
}: any) {
  const [selectedDemoSection, setSelectedDemoSection] = useState('all');

  const actorRole = String(currentUser?.role || '').trim().toUpperCase();
  const isAdmin = actorRole === 'ADMIN';
  const [importMode, setImportMode] = useState<ImportMode>('MERGE');
  const effectiveMode: ImportMode =
    importMode === 'REPLACE_CATALOG' && isAdmin ? 'REPLACE_CATALOG' : 'MERGE';

  // P1..P8: Structured Pipeline State (7 official Level 2 & Level 1 Type A bundles)
  const [bundleTextByKind, setBundleTextByKind] = useState<Record<TypeAExcelBundleKind, string>>({
    REF_PARC: '',
    REF_PERSONNEL: '',
    ASSETS_MACHINES: '',
    REF_PDR: '',
    PM_CATALOG: '',
    ENTREPOT_BOM: '',
    CM_CATALOG: '',
  });
  const [originByKind, setOriginByKind] = useState<
    Record<TypeAExcelBundleKind, ImportSourceOrigin>
  >({
    REF_PARC: 'JSON_BUNDLE',
    REF_PERSONNEL: 'JSON_BUNDLE',
    ASSETS_MACHINES: 'JSON_BUNDLE',
    REF_PDR: 'JSON_BUNDLE',
    PM_CATALOG: 'JSON_BUNDLE',
    ENTREPOT_BOM: 'JSON_BUNDLE',
    CM_CATALOG: 'JSON_BUNDLE',
  });
  const [lastImportReport, setLastImportReport] = useState<ImportReport<any> | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [showPersonnelAuthHint, setShowPersonnelAuthHint] = useState(false);

  const refParcFileInputRef = useRef<HTMLInputElement | null>(null);
  const refPersonnelFileInputRef = useRef<HTMLInputElement | null>(null);
  const assetsMachinesFileInputRef = useRef<HTMLInputElement | null>(null);
  const refPdrFileInputRef = useRef<HTMLInputElement | null>(null);
  const pmCatalogFileInputRef = useRef<HTMLInputElement | null>(null);
  const entrepotBomFileInputRef = useRef<HTMLInputElement | null>(null);
  const cmCatalogFileInputRef = useRef<HTMLInputElement | null>(null);

  const setCardText = (
    kind: TypeAExcelBundleKind,
    text: string,
    origin: ImportSourceOrigin = 'JSON_BUNDLE'
  ) => {
    setBundleTextByKind((prev) => ({ ...prev, [kind]: text }));
    setOriginByKind((prev) => ({ ...prev, [kind]: origin }));
  };

  const downloadJsonFile = (filename: string, payload: unknown) => {
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getTemplatePayload = (kind: TypeAExcelBundleKind) => {
    switch (kind) {
      case 'REF_PARC':
        return getRefParcOfficialTemplate();
      case 'REF_PERSONNEL':
        return getRefPersonnelOfficialTemplate();
      case 'ASSETS_MACHINES':
        return getAssetsMachinesOfficialTemplate();
      case 'REF_PDR':
        return getRefPdrOfficialTemplate();
      case 'PM_CATALOG':
        return getPmCatalogOfficialTemplate();
      case 'ENTREPOT_BOM':
        return getEntrepotBomOfficialTemplate();
      case 'CM_CATALOG':
        return getCmCatalogOfficialTemplate();
    }
  };

  const getExportPayload = (kind: TypeAExcelBundleKind) => {
    switch (kind) {
      case 'REF_PARC':
        return exportRefParcBundle();
      case 'REF_PERSONNEL':
        return exportRefPersonnelBundle();
      case 'ASSETS_MACHINES':
        return exportAssetsMachinesBundle();
      case 'REF_PDR':
        return exportRefPdrBundle();
      case 'PM_CATALOG':
        return exportPmCatalogBundle();
      case 'ENTREPOT_BOM':
        return exportEntrepotBomBundle();
      case 'CM_CATALOG':
        return exportCmCatalogBundle();
    }
  };

  const handleDownloadTemplateJson = (kind: TypeAExcelBundleKind) => {
    const template = getTemplatePayload(kind);
    setCardText(kind, JSON.stringify(template, null, 2), 'JSON_BUNDLE');
    downloadJsonFile(BUNDLE_META[kind].jsonFilename, template);
    showToast?.(
      `Modèle officiel ${BUNDLE_META[kind].jsonFilename} téléchargé (Contrat Type A).`,
      'success'
    );
  };

  const handleDownloadTemplateXlsx = (kind: TypeAExcelBundleKind) => {
    const template = getTemplatePayload(kind);
    setCardText(kind, JSON.stringify(template, null, 2), 'EXCEL');
    downloadTypeAExcelWorkbook(BUNDLE_META[kind].xlsxFilename, kind, template);
    showToast?.(
      `Modèle officiel Excel ${BUNDLE_META[kind].xlsxFilename} téléchargé (Contrat Type A).`,
      'success'
    );
  };

  const handleExportBundleJson = (kind: TypeAExcelBundleKind) => {
    const bundle = getExportPayload(kind);
    const dateTag = new Date().toISOString().slice(0, 10);
    setCardText(kind, JSON.stringify(bundle, null, 2), 'JSON_BUNDLE');
    downloadJsonFile(`${BUNDLE_META[kind].exportPrefix}_${dateTag}.json`, bundle);
    showToast?.(`Paquet ${kind} (Type A Round-Trip .JSON) exporté avec succès.`, 'success');
  };

  const handleExportBundleXlsx = (kind: TypeAExcelBundleKind) => {
    const bundle = getExportPayload(kind);
    const dateTag = new Date().toISOString().slice(0, 10);
    setCardText(kind, JSON.stringify(bundle, null, 2), 'EXCEL');
    downloadTypeAExcelWorkbook(`${BUNDLE_META[kind].exportPrefix}_${dateTag}_TypeA.xlsx`, kind, bundle);
    showToast?.(`Classeur ${kind} (Type A Round-Trip .XLSX) exporté avec succès.`, 'success');
  };

  const handleFileLoad = (
    e: React.ChangeEvent<HTMLInputElement>,
    target: TypeAExcelBundleKind
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    const isExcel = lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls');
    const reader = new FileReader();

    reader.onload = () => {
      if (isExcel) {
        const buffer = reader.result instanceof ArrayBuffer ? reader.result : new ArrayBuffer(0);
        const parsedXlsx = parseTypeAExcelWorkbook(buffer);
        if (!parsedXlsx.ok) {
          setParseError(parsedXlsx.message);
          showToast?.(parsedXlsx.message, 'error');
          return;
        }
        if (parsedXlsx.bundleType !== target) {
          const mismatchMsg = `Le classeur Excel sélectionné correspond au paquet '${parsedXlsx.bundleType}' et non à '${target}'. Veuillez l'importer dans la carte correspondante.`;
          setParseError(mismatchMsg);
          showToast?.(mismatchMsg, 'error');
          return;
        }
        setCardText(target, JSON.stringify(parsedXlsx.payload, null, 2), 'EXCEL');
        setParseError(null);
        showToast?.(
          `Classeur Type A (${target}) chargé avec succès. Lancez « Vérifier (dryRun) » puis « Importer ».`,
          'info'
        );
        return;
      }

      const content = typeof reader.result === 'string' ? reader.result : '';
      setCardText(target, content, 'JSON_BUNDLE');
      setParseError(null);
    };

    if (isExcel) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
    e.target.value = '';
  };

  const handleRunPipeline = async (kind: TypeAExcelBundleKind, dryRun: boolean) => {
    setParseError(null);
    const rawText = bundleTextByKind[kind] || '';
    if (!rawText.trim()) {
      setParseError(
        `Veuillez charger un fichier (.json ou .xlsx Type A) ou coller le contenu du paquet ${kind}.`
      );
      return;
    }

    let parsed: any;
    try {
      parsed = JSON.parse(rawText);
    } catch (err: any) {
      setParseError(`JSON ${kind} invalide : ${err?.message || 'Erreur de syntaxe JSON'}`);
      return;
    }

    if (!dryRun && effectiveMode === 'REPLACE_CATALOG') {
      const confirmed = await confirmAction({
        title: `Confirmation REPLACE_CATALOG — ${kind}`,
        message: `Attention : le mode REPLACE_CATALOG remplace l'intégralité du catalogue '${kind}' (protégé par les références actives REFERENCED_BY_ACTIVE_RECORDS). Voulez-vous continuer ?`,
        confirmText: 'Confirmer le remplacement',
        cancelText: 'Annuler',
        variant: 'danger',
        isDestructive: true,
      });
      if (!confirmed) return;
    }

    const opts = {
      mode: effectiveMode,
      origin: originByKind[kind] || 'JSON_BUNDLE',
      dryRun,
      actorRole: effectiveMode === 'REPLACE_CATALOG' ? actorRole : actorRole || 'ADMIN',
      actorId: String(currentUser?.id || currentUser?.username || 'ADMIN'),
      actorName: String(currentUser?.name || currentUser?.username || 'Settings Pipeline UI'),
    };

    let report: ImportReport<any>;
    if (kind === 'REF_PARC') {
      report = validateAndCommitRefParcBundle(parsed, opts);
    } else if (kind === 'REF_PERSONNEL') {
      report = validateAndCommitRefPersonnelBundle(parsed, opts);
    } else if (kind === 'ASSETS_MACHINES') {
      report = validateAndCommitAssetsMachinesBundle(parsed, opts);
    } else if (kind === 'REF_PDR') {
      report = validateAndCommitRefPdrBundle(parsed, opts);
    } else if (kind === 'PM_CATALOG') {
      report = validateAndCommitPmCatalogBundle(parsed, opts);
    } else if (kind === 'ENTREPOT_BOM') {
      report = validateAndCommitEntrepotBomBundle(parsed, opts);
    } else {
      report = validateAndCommitCmCatalogBundle(parsed, opts);
    }

    setLastImportReport(report);

    if (report.success) {
      if (kind === 'REF_PERSONNEL' && !dryRun && report.committed) {
        setShowPersonnelAuthHint(true);
      }
      showToast?.(
        dryRun
          ? `Validation ${kind} (dryRun — ${effectiveMode}) réussie : 0 erreur bloquante.`
          : `Import ${effectiveMode} ${kind} engagé dans DataGateway avec succès.`,
        'success'
      );
    } else {
      showToast?.(
        `Échec validation ${kind} : ${report.rejected.length} rejet(s) détecté(s).`,
        'error'
      );
    }
  };

  const sectionLabels: Record<string, string> = {
    all: 'Toute l’Usine (Tous les Tableaux)',
    stock: 'Stock & Articles PDR',
    parc: 'Parc Machines & Modèles',
    entrepot: 'Entrepôt & Organes',
    zones: 'Zones & Équipes Techniques',
    mouvements: 'Mouvements & Sorties Externes',
    preventive: 'Maintenance Préventive',
    corrective: 'Interventions Correctives',
  };

  const handleApplyDemoSwitch = (nextActive: boolean) => {
    if (typeof onToggleDemoMode === 'function') {
      onToggleDemoMode(nextActive, selectedDemoSection);
      return;
    }
    setIsDemoMode?.(nextActive);
    if (nextActive) {
      if (selectedDemoSection === 'all') {
        handleInjectAll?.();
      } else {
        handleInjectGroup?.(selectedDemoSection);
      }
    } else {
      if (selectedDemoSection === 'all') {
        handleResetToZero?.();
      } else {
        handleClearGroup?.(selectedDemoSection);
      }
    }
  };

  const moduleCards = [
    {
      key: 'stock',
      title: `Stock & Articles PDR (${initialStock.length})`,
      icon: Layers,
      desc: 'Nomenclature des articles de stock PDR, groupes, types, désignations, seuils et emplacements.',
      injectLabel: 'Injecter le Stock',
      clearLabel: 'Vider',
    },
    {
      key: 'parc',
      title: `Parc Machines (${initialMachines.length})`,
      icon: Cpu,
      desc: "Machines enregistrées de l'usine, familles d'équipements, modèles constructeurs et Blueprints.",
      injectLabel: 'Injecter le Parc',
      clearLabel: 'Vider',
    },
    {
      key: 'entrepot',
      title: `Entrepôt & Organes (${warehouseCount})`,
      icon: Package,
      desc: "Organes rotatifs (Components) et pièces d'usinage (Parts), groupes, familles et modèles.",
      injectLabel: "Injecter l'Entrepôt",
      clearLabel: 'Vider',
    },
    {
      key: 'zones',
      title: `Zones & Équipes (${initialZones.length + initialTechnicians.length})`,
      icon: Users,
      desc: "Zones géographiques d'ateliers, superviseurs d'opérations et techniciens qualifiés.",
      injectLabel: 'Injecter les Équipes',
      clearLabel: 'Vider',
    },
    {
      key: 'mouvements',
      title: `Mouvements Historiques (${initialMouvements.length})`,
      icon: Activity,
      desc: 'Écritures de mouvements de stock (Sorties/Entrées internes, externes et commandes).',
      injectLabel: 'Injecter Mouvements',
      clearLabel: 'Vider',
    },
    {
      key: 'preventive',
      title: `Maintenance Préventive (${preventiveCount})`,
      icon: Calendar,
      desc: "Planning préventif calendaire et compteur, gammes d'actions et guides d'entretien.",
      injectLabel: 'Injecter le Préventif',
      clearLabel: 'Vider',
    },
    {
      key: 'corrective',
      title: `Interventions Correctives & Catalogue Pannes (${initialCorrectiveInterventions.length})`,
      icon: Wrench,
      desc: 'Historique des bons de travail (BT), demandes de dépannage et catalogue des pannes.',
      injectLabel: 'Injecter le Correctif',
      clearLabel: 'Vider le Correctif',
      fullSpan: true,
    },
  ];

  const bundleCardsConfig: Array<{
    kind: TypeAExcelBundleKind;
    title: string;
    badge: string;
    badgeClass: string;
    subtitle: React.ReactNode;
    placeholder: string;
    inputRef: React.RefObject<HTMLInputElement | null>;
    testIdSlug: string;
    fullSpan?: boolean;
  }> = [
    {
      kind: 'REF_PARC',
      title: '1. Paquet Référentiel Parc (REF_PARC — Niveau 2)',
      badge: 'ZONES ➔ FAMILIES ➔ TEMPLATES',
      badgeClass: 'bg-sky-100 text-sky-800',
      subtitle: (
        <>
          Clés stables : <code className="font-mono">code_zone</code>,{' '}
          <code className="font-mono">code_family</code>,{' '}
          <code className="font-mono">code_template</code>,{' '}
          <code className="font-mono">code_system_type</code>.
        </>
      ),
      placeholder:
        '{"bundleType":"REF_PARC","zones":[...],"families":[...],"templates":[...],"generalSystemTypes":[...]}',
      inputRef: refParcFileInputRef,
      testIdSlug: 'ref-parc',
    },
    {
      kind: 'REF_PERSONNEL',
      title: '2. Paquet Équipes & Intervenants (REF_PERSONNEL — Niveau 2)',
      badge: '02_PERSONNEL',
      badgeClass: 'bg-emerald-100 text-emerald-800',
      subtitle: (
        <>
          Clés stables : <code className="font-mono">code_technician</code>,{' '}
          <code className="font-mono">code_operation</code>,{' '}
          <code className="font-mono">code_zone</code> (Zéro compte de connexion / secret).
        </>
      ),
      placeholder:
        '{"bundleType":"REF_PERSONNEL","technicians":[{"code_technician":"TECH-01","nom":"...","code_zone":"Z-ATELIER-01","specialite":"ELECTRIQUE"}],"operations":[...]}',
      inputRef: refPersonnelFileInputRef,
      testIdSlug: 'ref-personnel',
    },
    {
      kind: 'ASSETS_MACHINES',
      title: '3. Paquet Machines Enregistrées (ASSETS_MACHINES — Niveau 1)',
      badge: '03_MACHINES',
      badgeClass: 'bg-indigo-100 text-indigo-800',
      subtitle: (
        <>
          Validation <code className="font-mono">PRODUCTION</code> vs{' '}
          <code className="font-mono">SYSTEM_GENERAL</code>, normalisation{' '}
          <code className="font-mono">code_zone</code> et hiérarchie{' '}
          <code className="font-mono">parent_code_machine</code>.
        </>
      ),
      placeholder:
        '{"bundleType":"ASSETS_MACHINES","machines":[{"code_machine":"CNC-01","designation":"...","code_zone":"Z-ATELIER-01","asset_class":"PRODUCTION","code_family":"...","code_template":"..."}]}',
      inputRef: assetsMachinesFileInputRef,
      testIdSlug: 'assets-machines',
    },
    {
      kind: 'REF_PDR',
      title: '4. Paquet Catalogue Stock PDR (REF_PDR — Niveau 2)',
      badge: '04_PDR (GROUPS ➔ TYPES ➔ ITEMS)',
      badgeClass: 'bg-amber-100 text-amber-800',
      subtitle: (
        <>
          Clés stables : <code className="font-mono">code_group</code>,{' '}
          <code className="font-mono">code_type</code>, <code className="font-mono">ref</code>{' '}
          (Catalogue pur — zéro mouvement de stock).
        </>
      ),
      placeholder:
        '{"bundleType":"REF_PDR","groups":[{"code_group":"ROUL","libelle":"..."}],"types":[{"code_type":"TYP-ROUL-BILLE","code_group":"ROUL","libelle":"..."}],"items":[{"ref":"SKF-6205-2RS","designation":"...","code_type":"TYP-ROUL-BILLE","code_group":"ROUL"}]}',
      inputRef: refPdrFileInputRef,
      testIdSlug: 'ref-pdr',
    },
    {
      kind: 'PM_CATALOG',
      title: '5. Paquet Catalogue Préventif (PM_CATALOG — Niveau 2 Uniquement)',
      badge: '05_PM_ACTIONS ➔ 05_PM_GUIDES',
      badgeClass: 'bg-purple-100 text-purple-800',
      subtitle: (
        <>
          Clés stables : <code className="font-mono">code_action</code>,{' '}
          <code className="font-mono">code_guide</code> (Catalogue standardisé — aucune tâche machine ni exécution).
        </>
      ),
      placeholder:
        '{"bundleType":"PM_CATALOG","actions":[{"code_action":"C","libelle":"Contrôle"}],"guides":[{"code_guide":"GUIDE-ROULEMENT-CG","composant_nom":"Roulement","actions_liees":["C"]}]}',
      inputRef: pmCatalogFileInputRef,
      testIdSlug: 'pm-catalog',
    },
    {
      kind: 'ENTREPOT_BOM',
      title: '6. Paquet Référentiels Organes & Pièces (ENTREPOT_BOM — Niveau 2)',
      badge: 'COMP (3) + PART (3)',
      badgeClass: 'bg-teal-100 text-teal-800',
      subtitle: (
        <>
          Classification <code className="font-mono">code_comp_group/family/template</code> &amp;{' '}
          <code className="font-mono">code_part_group/type/ref</code> (Zéro instance entrepôt ni BOM machine).
        </>
      ),
      placeholder:
        '{"bundleType":"ENTREPOT_BOM","compGroups":[...],"compFamilies":[...],"compTemplates":[...],"partGroups":[...],"partTypes":[...],"partDesignations":[...]}',
      inputRef: entrepotBomFileInputRef,
      testIdSlug: 'entrepot-bom',
    },
    {
      kind: 'CM_CATALOG',
      title: '7. Paquet Catalogue Pannes & Actions (CM_CATALOG — Niveau 2)',
      badge: '07_CATEGORIES ➔ 07_FAULTS',
      badgeClass: 'bg-rose-100 text-rose-800',
      subtitle: (
        <>
          Clés stables : <code className="font-mono">code_category</code>,{' '}
          <code className="font-mono">code_fault</code>, matrice d&apos;actions standardisées (Zéro BT ni demande).
        </>
      ),
      placeholder:
        '{"bundleType":"CM_CATALOG","categories":[{"code_category":"M","libelle":"Mécanique"}],"faults":[{"code_fault":"PANNE-M-01","code_category":"M","panne":"...","actions":["..."]}]}',
      inputRef: cmCatalogFileInputRef,
      testIdSlug: 'cm-catalog',
      fullSpan: true,
    },
  ];

  return (
    <div className="space-y-6">
      {/* 0. Mode B — UnifiedImportPipeline (JSON & Official Type A Excel .xlsx) */}
      <SettingsSectionCard
        title="Pipeline d'Ingestion Structurée par Paquets (Mode B — Contrat Type A : JSON & Excel .XLSX)"
        description="Téléchargez le modèle officiel (.json ou .xlsx), remplissez vos lignes, validez (dryRun), puis importez (MERGE ou REPLACE_CATALOG réservé ADMIN). Les exports externes d'écrans (Type B) ne sont jamais réimportables."
        icon={<ShieldCheck />}
        headerRight={
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
            <span className="text-[11px] font-bold text-slate-700">Mode d&apos;import :</span>
            <select
              value={effectiveMode}
              onChange={(e) =>
                setImportMode(e.target.value === 'REPLACE_CATALOG' ? 'REPLACE_CATALOG' : 'MERGE')
              }
              data-testid="select-import-mode"
              className="text-xs font-extrabold text-slate-900 bg-transparent focus:outline-none cursor-pointer"
              title="MERGE fusionne sans suppression ; REPLACE_CATALOG (ADMIN uniquement) remplace le catalogue en bloquant toute suppression référencée."
            >
              <option value="MERGE">MERGE (Fusion sécurisée)</option>
              <option value="REPLACE_CATALOG" disabled={!isAdmin}>
                REPLACE_CATALOG {isAdmin ? '(ADMIN — Remplacement)' : '(Réservé ADMIN)'}
              </option>
            </select>
          </div>
        }
      >
        <div className="mb-3.5 px-3.5 py-2.5 rounded-xl bg-sky-50/80 border border-sky-200/80 text-[11px] text-slate-700 flex flex-wrap items-center justify-between gap-2">
          <span>
            <b>Contrat Type A (Round-Trip .JSON &amp; .XLSX) :</b> Modèles officiels{' '}
            <code className="font-mono">REF_PARC</code>,{' '}
            <code className="font-mono">REF_PERSONNEL</code>,{' '}
            <code className="font-mono">ASSETS_MACHINES</code>,{' '}
            <code className="font-mono">REF_PDR</code>,{' '}
            <code className="font-mono">PM_CATALOG</code>,{' '}
            <code className="font-mono">ENTREPOT_BOM</code> &amp;{' '}
            <code className="font-mono">CM_CATALOG</code> (onglet verrouillé{' '}
            <code className="font-mono">README_TYPE_A</code>).
          </span>
          <span className="font-mono text-[10px] text-slate-500">
            Type B (Exports tableaux/mouvements) = Consultation externe uniquement
          </span>
        </div>

        {effectiveMode === 'REPLACE_CATALOG' && (
          <div
            data-testid="replace-catalog-warning"
            className="mb-3.5 px-3.5 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-[11px] font-semibold text-rose-900 flex items-center gap-2"
          >
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-700" />
            <span>
              <b>Mode REPLACE_CATALOG actif (ADMIN) :</b> les éléments absents du paquet seront supprimés du catalogue s&apos;ils ne sont liés à aucun enregistrement actif (sinon blocage{' '}
              <code className="font-mono">REFERENCED_BY_ACTIVE_RECORDS</code>). Exécutez{' '}
              <b>Vérifier (dryRun)</b> avant d&apos;importer.
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {bundleCardsConfig.map((card) => (
            <div
              key={card.kind}
              className={`${
                card.fullSpan ? 'lg:col-span-2 ' : ''
              }p-4 rounded-2xl border border-slate-200 bg-slate-50/70 flex flex-col justify-between gap-3`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-extrabold text-slate-900">{card.title}</h4>
                  <span
                    className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded ${card.badgeClass}`}
                  >
                    {card.badge}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mt-1">{card.subtitle}</p>
                <textarea
                  value={bundleTextByKind[card.kind]}
                  onChange={(e) => setCardText(card.kind, e.target.value, 'JSON_BUNDLE')}
                  rows={4}
                  placeholder={card.placeholder}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-[11px] font-mono text-slate-800 focus:outline-none focus:border-sky-600"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/80">
                <input
                  ref={card.inputRef}
                  type="file"
                  accept=".json,.xlsx,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={(e) => handleFileLoad(e, card.kind)}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => handleDownloadTemplateJson(card.kind)}
                  className={SETTINGS_BUTTON_STYLES.secondary}
                  data-testid={`btn-template-${card.testIdSlug}`}
                  title={`Télécharger le modèle officiel ${BUNDLE_META[card.kind].jsonFilename}`}
                >
                  <Download className="w-3.5 h-3.5 text-sky-700" />
                  <span>Modèle .JSON</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadTemplateXlsx(card.kind)}
                  className={SETTINGS_BUTTON_STYLES.secondary}
                  data-testid={`btn-template-xlsx-${card.testIdSlug}`}
                  title={`Télécharger le modèle officiel Excel ${BUNDLE_META[card.kind].xlsxFilename} (Type A)`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Modèle .XLSX</span>
                </button>
                <button
                  type="button"
                  onClick={() => card.inputRef.current?.click()}
                  className={SETTINGS_BUTTON_STYLES.secondary}
                  data-testid={`btn-load-${card.testIdSlug}`}
                  title="Charger un fichier .json ou un classeur officiel Type A (.xlsx)"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Charger (.JSON / .XLSX)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleRunPipeline(card.kind, true)}
                  className={SETTINGS_BUTTON_STYLES.secondary}
                  data-testid={`btn-dryrun-${card.testIdSlug}`}
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-sky-700" />
                  <span>Vérifier (dryRun)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleRunPipeline(card.kind, false)}
                  className={
                    effectiveMode === 'REPLACE_CATALOG'
                      ? SETTINGS_BUTTON_STYLES.dangerSoft
                      : SETTINGS_BUTTON_STYLES.primary
                  }
                  data-testid={`btn-merge-${card.testIdSlug}`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>
                    {effectiveMode === 'REPLACE_CATALOG'
                      ? 'Remplacer (REPLACE_CATALOG)'
                      : 'Importer (MERGE)'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => handleExportBundleJson(card.kind)}
                  className={SETTINGS_BUTTON_STYLES.secondary}
                  data-testid={`btn-export-${card.testIdSlug}`}
                  title="Exporter au format Paquet Round-Trip .JSON (Type A)"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Export .JSON (Type A)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleExportBundleXlsx(card.kind)}
                  className={SETTINGS_BUTTON_STYLES.secondary}
                  data-testid={`btn-export-xlsx-${card.testIdSlug}`}
                  title="Exporter au format Classeur Round-Trip .XLSX (Type A)"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Export .XLSX (Type A)</span>
                </button>
              </div>
            </div>
          ))}
        </div>

        {showPersonnelAuthHint && (
          <div
            data-testid="personnel-auth-hint"
            className="mt-3 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 flex flex-wrap items-center justify-between gap-3"
          >
            <div className="flex items-start gap-2.5">
              <KeyRound className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <div className="font-extrabold">
                  Rappel Sécurité Auth — Équipes engagées sans identifiants de connexion
                </div>
                <p className="text-[11px] text-amber-900 mt-0.5">
                  Les techniciens et responsables importés via <code className="font-mono">REF_PERSONNEL</code> n&apos;ont aucun PIN ni mot de passe par sécurité. Si certains intervenants doivent se connecter à l&apos;application, activez leurs accès dans <b>Utilisateurs &amp; Accès</b>.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {typeof onNavigateToUsers === 'function' && (
                <button
                  type="button"
                  onClick={onNavigateToUsers}
                  data-testid="btn-goto-users-after-personnel"
                  className={SETTINGS_BUTTON_STYLES.primary}
                >
                  <span>Ouvrir Utilisateurs &amp; Accès</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowPersonnelAuthHint(false)}
                className={SETTINGS_BUTTON_STYLES.secondary}
              >
                <span>Masquer</span>
              </button>
            </div>
          </div>
        )}

        {parseError && (
          <div className="mt-3 px-4 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800 flex items-center gap-2">
            <XCircle className="w-4 h-4 shrink-0" />
            <span>{parseError}</span>
          </div>
        )}

        {lastImportReport && (
          <div
            data-testid="unified-import-report"
            className={`mt-4 p-4 rounded-2xl border ${
              lastImportReport.success
                ? 'bg-emerald-50/60 border-emerald-200'
                : 'bg-rose-50/60 border-rose-200'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200/80">
              <div className="flex items-center gap-2">
                {lastImportReport.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-700" />
                )}
                <span className="text-xs font-extrabold text-slate-900">
                  Rapport {lastImportReport.bundleType} ({lastImportReport.mode} ·{' '}
                  {lastImportReport.origin}) —{' '}
                  {lastImportReport.dryRun
                    ? 'Simulation (dryRun)'
                    : lastImportReport.committed
                    ? 'Engagé dans DataGateway'
                    : 'Annulé (0 écriture)'}
                </span>
              </div>
              <span className="text-[11px] font-mono text-slate-600">
                Rejets: {lastImportReport.rejected.length} | Avertissements:{' '}
                {lastImportReport.warnings.length} | {lastImportReport.durationMs} ms
              </span>
            </div>

            {lastImportReport.accepted.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-2">
                {lastImportReport.accepted.map((acc) => (
                  <span
                    key={`${acc.stage}-${acc.entity}`}
                    className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-mono text-slate-700"
                  >
                    <b>{acc.entity}</b>: +{acc.created} créés, ~{acc.updated} maj, ={acc.unchanged}{' '}
                    inchangés
                  </span>
                ))}
              </div>
            )}

            {lastImportReport.warnings.length > 0 && (
              <div className="mt-3 space-y-1">
                <div className="text-[11px] font-bold text-amber-900">
                  Avertissements de compatibilité ({lastImportReport.warnings.length}) :
                </div>
                {lastImportReport.warnings.map((w, idx) => (
                  <div
                    key={`warn-${idx}`}
                    className="text-[11px] font-mono text-amber-900 bg-amber-100/70 px-2.5 py-1 rounded-lg"
                  >
                    [{w.code}] ({w.stage}) {w.message}
                  </div>
                ))}
              </div>
            )}

            {lastImportReport.rejected.length > 0 && (
              <div className="mt-3 space-y-1">
                <div className="text-[11px] font-bold text-rose-900">
                  Erreurs bloquantes ({lastImportReport.rejected.length}) :
                </div>
                {lastImportReport.rejected.map((r, idx) => (
                  <div
                    key={`rej-${idx}`}
                    className="text-[11px] font-mono text-rose-900 bg-rose-100/70 px-2.5 py-1 rounded-lg"
                  >
                    [{r.code}] ({r.stage} — Ligne {r.row}) {r.message}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </SettingsSectionCard>

      {/* 1. Global & Targeted Demo Mode Control (tone="warning") */}
      <SettingsSectionCard
        tone="warning"
        title={
          <span className="flex items-center gap-2 flex-wrap">
            <span>Mode Données Démo Usine (Contrôle Global &amp; Par Section)</span>
            <span
              className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full border ${
                isDemoMode
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              {isDemoMode ? 'MODE DÉMO ACTIF' : 'MODE USINE VIERGE'}
            </span>
          </span>
        }
        description="Activez ou videz les jeux d'essai sur toute l'application ou ciblez uniquement une section précise sans altérer le reste de vos données."
        icon={<Power />}
        headerRight={
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedDemoSection}
              onChange={(e) => setSelectedDemoSection(e.target.value)}
              className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-800 focus:outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100 cursor-pointer"
              title="Choisir la section cible"
            >
              {Object.entries(sectionLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  Cible : {label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => handleApplyDemoSwitch(true)}
              className={SETTINGS_BUTTON_STYLES.primary}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Activer / Injecter ({selectedDemoSection === 'all' ? 'Tout' : 'Section'})</span>
            </button>

            <button
              type="button"
              onClick={() => handleApplyDemoSwitch(false)}
              className={SETTINGS_BUTTON_STYLES.dangerSoft}
            >
              <Trash2 className="w-4 h-4" />
              <span>Désactiver / Vider ({selectedDemoSection === 'all' ? 'Tout' : 'Section'})</span>
            </button>
          </div>
        }
      >
        <div className="text-xs text-slate-600 bg-white/80 px-4 py-3 rounded-xl border border-amber-200/60 flex flex-wrap items-center justify-between gap-2">
          <span>
            Règle SSOT : Aucune donnée de démonstration n&apos;est réinjectée silencieusement au rechargement (F5) lorsque le mode usine vierge est actif.
          </span>
          <span className="font-mono text-[11px] text-slate-500">
            DataGateway.loadDemoData / clearDemoSection
          </span>
        </div>
      </SettingsSectionCard>

      {/* 2. Granular Per-Module Demo Injection Grid (Mode C) */}
      <SettingsSectionCard
        title="Mode C — Injection ou Purge Granulaire des Jeux d'Essai Démo"
        description="Chargez ou videz individuellement les données de démonstration (validées via UnifiedImportPipeline). Pour vos données réelles d'usine, utilisez uniquement la section Mode B (Contrat Type A) ci-dessus."
        icon={<Sliders />}
        headerRight={
          <button
            type="button"
            onClick={handleInjectAll}
            className={SETTINGS_BUTTON_STYLES.primary}
          >
            <Database className="w-4 h-4" />
            <span>Injecter Toutes les Données Usine</span>
          </button>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {moduleCards.map((mod) => {
            const Icon = mod.icon;
            return (
              <div
                key={mod.key}
                className={`p-4 rounded-2xl border border-slate-200/90 bg-slate-50/50 hover:border-slate-300 hover:bg-white transition-all flex flex-col justify-between gap-3 ${
                  mod.fullSpan ? 'col-span-1 sm:col-span-2 lg:col-span-3' : ''
                }`}
              >
                <div>
                  <h4 className="text-xs font-extrabold text-slate-900 flex items-center gap-2">
                    <Icon className="w-4 h-4 text-sky-700 shrink-0" />
                    <span>{mod.title}</span>
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">{mod.desc}</p>
                </div>
                <div className="flex items-center gap-2 pt-2.5 border-t border-slate-200/70">
                  <button
                    type="button"
                    onClick={() => handleInjectGroup?.(mod.key)}
                    className={`${SETTINGS_BUTTON_STYLES.secondary} flex-1`}
                  >
                    <span>{mod.injectLabel}</span>
                  </button>
                  {handleClearGroup && (
                    <button
                      type="button"
                      onClick={() => handleClearGroup(mod.key)}
                      className={SETTINGS_BUTTON_STYLES.dangerSoft}
                      title={`Vider uniquement : ${mod.title}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{mod.clearLabel}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </SettingsSectionCard>

      {/* 3. Startup Preference & Full Factory Reset (tone="danger") */}
      <SettingsSectionCard
        tone="danger"
        title="Préférence de Démarrage & Réinitialisation Complète d'Usine"
        description="Configurez le comportement par défaut au lancement ou effacez l'intégralité des tables pour démarrer l'exploitation réelle à zéro."
        icon={<AlertTriangle />}
        footer={
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
            <label className="inline-flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={Boolean(isDemoMode)}
                onChange={(e) => {
                  const next = e.target.checked;
                  setIsDemoMode?.(next);
                  onToggleDemoMode?.(next);
                }}
                className="w-4 h-4 rounded text-sky-700 border-slate-300 focus:ring-sky-600 cursor-pointer"
              />
              <span>Afficher les maquettes et fiches d&apos;exemples au démarrage</span>
            </label>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (typeof onDownloadBlankTemplate === 'function') {
                    onDownloadBlankTemplate();
                  } else {
                    showToast?.('Téléchargement du gabarit vierge déclenché !', 'success');
                  }
                }}
                className={SETTINGS_BUTTON_STYLES.secondary}
                title="Gabarit miroir multi-feuilles (Type B — consultation externe uniquement ; pour l'import structuré, utilisez les modèles Type A ci-dessus)"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Classeur Miroir (.XLSX — Type B)</span>
              </button>

              <button
                type="button"
                onClick={handleSaveSettings}
                className={SETTINGS_BUTTON_STYLES.primary}
              >
                <span>Enregistrer ma préférence</span>
              </button>

              <button
                type="button"
                onClick={handleResetToZero}
                className={SETTINGS_BUTTON_STYLES.danger}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Effacer tout et démarrer à vide</span>
              </button>
            </div>
          </div>
        }
      >
        <div className="text-xs text-rose-900 bg-rose-50/60 px-4 py-3 rounded-xl border border-rose-200/80">
          <b>Attention :</b> L&apos;action « Effacer tout et démarrer à vide » purge toutes les tables transactionnelles et référentielles (0 enregistrement) et verrouille <code className="font-mono">START_MODE = &apos;empty&apos;</code>. Exportez un Snapshot JSON au préalable si nécessaire.
        </div>
      </SettingsSectionCard>
    </div>
  );
}
