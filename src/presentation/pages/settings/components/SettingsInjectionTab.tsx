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
} from 'lucide-react';
import { SettingsSectionCard, SETTINGS_BUTTON_STYLES } from './settingsUi';
import {
  exportAssetsMachinesBundle,
  exportRefParcBundle,
  exportRefPdrBundle,
  exportRefPersonnelBundle,
  getAssetsMachinesOfficialTemplate,
  getRefParcOfficialTemplate,
  getRefPdrOfficialTemplate,
  getRefPersonnelOfficialTemplate,
  validateAndCommitAssetsMachinesBundle,
  validateAndCommitRefParcBundle,
  validateAndCommitRefPdrBundle,
  validateAndCommitRefPersonnelBundle,
} from '../../../../services/import/unifiedImportPipeline';
import type { ImportReport } from '../../../../services/import/types/unifiedImportTypes';

/**
 * Data Injection Hub:
 * 1) Mode B — Structured Bundle Ingestion & Reverse Export (UnifiedImportPipeline: REF_PARC, REF_PERSONNEL, ASSETS_MACHINES & REF_PDR)
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
}: any) {
  const [selectedDemoSection, setSelectedDemoSection] = useState('all');

  // P1 / P1.1 / P2 / P3: Structured Pipeline State (REF_PARC, REF_PERSONNEL, ASSETS_MACHINES & REF_PDR)
  const [refParcJsonText, setRefParcJsonText] = useState('');
  const [refPersonnelJsonText, setRefPersonnelJsonText] = useState('');
  const [assetsMachinesJsonText, setAssetsMachinesJsonText] = useState('');
  const [refPdrJsonText, setRefPdrJsonText] = useState('');
  const [lastImportReport, setLastImportReport] = useState<ImportReport<any> | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const refParcFileInputRef = useRef<HTMLInputElement | null>(null);
  const refPersonnelFileInputRef = useRef<HTMLInputElement | null>(null);
  const assetsMachinesFileInputRef = useRef<HTMLInputElement | null>(null);
  const refPdrFileInputRef = useRef<HTMLInputElement | null>(null);

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

  const handleDownloadRefParcTemplate = () => {
    const template = getRefParcOfficialTemplate();
    setRefParcJsonText(JSON.stringify(template, null, 2));
    downloadJsonFile('REF_PARC.template.json', template);
    showToast?.(
      'Modèle officiel REF_PARC.template.json téléchargé (Contrat Type A).',
      'success'
    );
  };

  const handleDownloadRefPersonnelTemplate = () => {
    const template = getRefPersonnelOfficialTemplate();
    setRefPersonnelJsonText(JSON.stringify(template, null, 2));
    downloadJsonFile('REF_PERSONNEL.template.json', template);
    showToast?.(
      'Modèle officiel REF_PERSONNEL.template.json téléchargé (Contrat Type A).',
      'success'
    );
  };

  const handleDownloadAssetsMachinesTemplate = () => {
    const template = getAssetsMachinesOfficialTemplate();
    setAssetsMachinesJsonText(JSON.stringify(template, null, 2));
    downloadJsonFile('ASSETS_MACHINES.template.json', template);
    showToast?.(
      'Modèle officiel ASSETS_MACHINES.template.json téléchargé (Contrat Type A).',
      'success'
    );
  };

  const handleDownloadRefPdrTemplate = () => {
    const template = getRefPdrOfficialTemplate();
    setRefPdrJsonText(JSON.stringify(template, null, 2));
    downloadJsonFile('REF_PDR.template.json', template);
    showToast?.(
      'Modèle officiel REF_PDR.template.json téléchargé (Contrat Type A).',
      'success'
    );
  };

  const handleExportRefParc = () => {
    const bundle = exportRefParcBundle();
    setRefParcJsonText(JSON.stringify(bundle, null, 2));
    downloadJsonFile(`CIOB_REF_PARC_${new Date().toISOString().slice(0, 10)}.json`, bundle);
    showToast?.(
      'Paquet REF_PARC (Type A Round-Trip) exporté avec succès (code_zone, code_family, code_template).',
      'success'
    );
  };

  const handleExportRefPersonnel = () => {
    const bundle = exportRefPersonnelBundle();
    setRefPersonnelJsonText(JSON.stringify(bundle, null, 2));
    downloadJsonFile(`CIOB_REF_PERSONNEL_${new Date().toISOString().slice(0, 10)}.json`, bundle);
    showToast?.(
      'Paquet REF_PERSONNEL (Type A Round-Trip) exporté avec succès (code_technician, code_operation).',
      'success'
    );
  };

  const handleExportAssetsMachines = () => {
    const bundle = exportAssetsMachinesBundle();
    setAssetsMachinesJsonText(JSON.stringify(bundle, null, 2));
    downloadJsonFile(`CIOB_ASSETS_MACHINES_${new Date().toISOString().slice(0, 10)}.json`, bundle);
    showToast?.(
      'Paquet ASSETS_MACHINES (Type A Round-Trip) exporté avec succès (code_machine, code_zone).',
      'success'
    );
  };

  const handleExportRefPdr = () => {
    const bundle = exportRefPdrBundle();
    setRefPdrJsonText(JSON.stringify(bundle, null, 2));
    downloadJsonFile(`CIOB_REF_PDR_${new Date().toISOString().slice(0, 10)}.json`, bundle);
    showToast?.(
      'Paquet REF_PDR (Type A Round-Trip) exporté avec succès (code_group, code_type, ref).',
      'success'
    );
  };

  const handleFileLoad = (
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'REF_PARC' | 'REF_PERSONNEL' | 'ASSETS_MACHINES' | 'REF_PDR'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : '';
      if (target === 'REF_PARC') {
        setRefParcJsonText(content);
      } else if (target === 'REF_PERSONNEL') {
        setRefPersonnelJsonText(content);
      } else if (target === 'ASSETS_MACHINES') {
        setAssetsMachinesJsonText(content);
      } else {
        setRefPdrJsonText(content);
      }
      setParseError(null);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleRunRefParcPipeline = (dryRun: boolean) => {
    setParseError(null);
    if (!refParcJsonText.trim()) {
      setParseError('Veuillez charger un fichier JSON ou coller le contenu du paquet REF_PARC.');
      return;
    }
    try {
      const parsed = JSON.parse(refParcJsonText);
      const report = validateAndCommitRefParcBundle(parsed, {
        mode: 'MERGE',
        origin: 'JSON_BUNDLE',
        dryRun,
      });
      setLastImportReport(report);
      if (report.success) {
        showToast?.(
          dryRun
            ? 'Validation REF_PARC (dryRun) réussie : 0 erreur bloquante.'
            : 'Import MERGE REF_PARC engagé dans DataGateway avec succès.',
          'success'
        );
      } else {
        showToast?.(
          `Échec validation REF_PARC : ${report.rejected.length} rejet(s) détecté(s).`,
          'error'
        );
      }
    } catch (err: any) {
      setParseError(`JSON REF_PARC invalide : ${err?.message || 'Erreur de syntaxe JSON'}`);
    }
  };

  const handleRunRefPersonnelPipeline = (dryRun: boolean) => {
    setParseError(null);
    if (!refPersonnelJsonText.trim()) {
      setParseError(
        'Veuillez charger un fichier JSON ou coller le contenu du paquet REF_PERSONNEL.'
      );
      return;
    }
    try {
      const parsed = JSON.parse(refPersonnelJsonText);
      const report = validateAndCommitRefPersonnelBundle(parsed, {
        mode: 'MERGE',
        origin: 'JSON_BUNDLE',
        dryRun,
      });
      setLastImportReport(report);
      if (report.success) {
        showToast?.(
          dryRun
            ? 'Validation REF_PERSONNEL (dryRun) réussie : 0 erreur bloquante.'
            : 'Import MERGE REF_PERSONNEL engagé dans DataGateway avec succès.',
          'success'
        );
      } else {
        showToast?.(
          `Échec validation REF_PERSONNEL : ${report.rejected.length} rejet(s) détecté(s).`,
          'error'
        );
      }
    } catch (err: any) {
      setParseError(`JSON REF_PERSONNEL invalide : ${err?.message || 'Erreur de syntaxe JSON'}`);
    }
  };

  const handleRunAssetsMachinesPipeline = (dryRun: boolean) => {
    setParseError(null);
    if (!assetsMachinesJsonText.trim()) {
      setParseError(
        'Veuillez charger un fichier JSON ou coller le contenu du paquet ASSETS_MACHINES.'
      );
      return;
    }
    try {
      const parsed = JSON.parse(assetsMachinesJsonText);
      const report = validateAndCommitAssetsMachinesBundle(parsed, {
        mode: 'MERGE',
        origin: 'JSON_BUNDLE',
        dryRun,
      });
      setLastImportReport(report);
      if (report.success) {
        showToast?.(
          dryRun
            ? 'Validation ASSETS_MACHINES (dryRun) réussie : 0 erreur bloquante.'
            : 'Import MERGE ASSETS_MACHINES engagé dans DataGateway avec succès.',
          'success'
        );
      } else {
        showToast?.(
          `Échec validation ASSETS_MACHINES : ${report.rejected.length} rejet(s) détecté(s).`,
          'error'
        );
      }
    } catch (err: any) {
      setParseError(`JSON ASSETS_MACHINES invalide : ${err?.message || 'Erreur de syntaxe JSON'}`);
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

  return (
    <div className="space-y-6">
      {/* 0. Mode B — UnifiedImportPipeline (REF_PARC, REF_PERSONNEL, ASSETS_MACHINES & REF_PDR) */}
      <SettingsSectionCard
        title="Pipeline d'Ingestion Structurée par Paquets (Mode B — Contrat Type A : REF_PARC, REF_PERSONNEL, ASSETS_MACHINES & REF_PDR)"
        description="Téléchargez le modèle officiel, remplissez vos lignes, puis validez (dryRun) ou importez (MERGE). Seuls les modèles officiels et les exports Round-Trip (Type A) sont réimportables ; les exports externes d'écrans (Type B) ne sont pas des contrats d'import."
        icon={<ShieldCheck />}
      >
        <div className="mb-3.5 px-3.5 py-2.5 rounded-xl bg-sky-50/80 border border-sky-200/80 text-[11px] text-slate-700 flex flex-wrap items-center justify-between gap-2">
          <span>
            <b>Contrat Type A (Round-Trip) :</b> Modèles officiels{' '}
            <code className="font-mono">REF_PARC.template.json</code>,{' '}
            <code className="font-mono">REF_PERSONNEL.template.json</code>,{' '}
            <code className="font-mono">ASSETS_MACHINES.template.json</code> &amp;{' '}
            <code className="font-mono">REF_PDR.template.json</code> + exports issus de cette carte.
          </span>
          <span className="font-mono text-[10px] text-slate-500">
            Type B (Exports tableaux/impression) = Consultation externe uniquement
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Card 1: REF_PARC */}
          <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-extrabold text-slate-900">
                  1. Paquet Référentiel Parc (REF_PARC — Niveau 2)
                </h4>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded bg-sky-100 text-sky-800">
                  ZONES ➔ FAMILIES ➔ TEMPLATES
                </span>
              </div>
              <p className="text-[11px] text-slate-600 mt-1">
                Clés stables : <code className="font-mono">code_zone</code>,{' '}
                <code className="font-mono">code_family</code>,{' '}
                <code className="font-mono">code_template</code>,{' '}
                <code className="font-mono">code_system_type</code>.
              </p>
              <textarea
                value={refParcJsonText}
                onChange={(e) => setRefParcJsonText(e.target.value)}
                rows={4}
                placeholder='{"bundleType":"REF_PARC","zones":[...],"families":[...],"templates":[...],"generalSystemTypes":[...]}'
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-[11px] font-mono text-slate-800 focus:outline-none focus:border-sky-600"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/80">
              <input
                ref={refParcFileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={(e) => handleFileLoad(e, 'REF_PARC')}
                className="hidden"
              />
              <button
                type="button"
                onClick={handleDownloadRefParcTemplate}
                className={SETTINGS_BUTTON_STYLES.secondary}
                data-testid="btn-template-ref-parc"
                title="Télécharger le modèle officiel REF_PARC.template.json"
              >
                <Download className="w-3.5 h-3.5 text-sky-700" />
                <span>Télécharger le modèle</span>
              </button>
              <button
                type="button"
                onClick={() => refParcFileInputRef.current?.click()}
                className={SETTINGS_BUTTON_STYLES.secondary}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Charger JSON</span>
              </button>
              <button
                type="button"
                onClick={() => handleRunRefParcPipeline(true)}
                className={SETTINGS_BUTTON_STYLES.secondary}
                data-testid="btn-dryrun-ref-parc"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-sky-700" />
                <span>Vérifier (dryRun)</span>
              </button>
              <button
                type="button"
                onClick={() => handleRunRefParcPipeline(false)}
                className={SETTINGS_BUTTON_STYLES.primary}
                data-testid="btn-merge-ref-parc"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Importer (MERGE)</span>
              </button>
              <button
                type="button"
                onClick={handleExportRefParc}
                className={SETTINGS_BUTTON_STYLES.secondary}
                data-testid="btn-export-ref-parc"
                title="Exporter le référentiel actuel au format Paquet Round-Trip (Type A)"
              >
                <Download className="w-3.5 h-3.5 text-emerald-700" />
                <span>Exporter (Round-Trip Type A)</span>
              </button>
            </div>
          </div>

          {/* Card 2: REF_PERSONNEL */}
          <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-extrabold text-slate-900">
                  2. Paquet Équipes &amp; Intervenants (REF_PERSONNEL — Niveau 2)
                </h4>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded bg-emerald-100 text-emerald-800">
                  02_PERSONNEL
                </span>
              </div>
              <p className="text-[11px] text-slate-600 mt-1">
                Clés stables : <code className="font-mono">code_technician</code>,{' '}
                <code className="font-mono">code_operation</code>,{' '}
                <code className="font-mono">code_zone</code> (Zéro compte de connexion / secret).
              </p>
              <textarea
                value={refPersonnelJsonText}
                onChange={(e) => setRefPersonnelJsonText(e.target.value)}
                rows={4}
                placeholder='{"bundleType":"REF_PERSONNEL","technicians":[{"code_technician":"TECH-01","nom":"...","code_zone":"DETOURAG","type_profil":"TECHNICIEN","specialite":"ELECTRIQUE"}],"operations":[...]}'
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-[11px] font-mono text-slate-800 focus:outline-none focus:border-sky-600"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/80">
              <input
                ref={refPersonnelFileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={(e) => handleFileLoad(e, 'REF_PERSONNEL')}
                className="hidden"
              />
              <button
                type="button"
                onClick={handleDownloadRefPersonnelTemplate}
                className={SETTINGS_BUTTON_STYLES.secondary}
                data-testid="btn-template-ref-personnel"
                title="Télécharger le modèle officiel REF_PERSONNEL.template.json"
              >
                <Download className="w-3.5 h-3.5 text-sky-700" />
                <span>Télécharger le modèle</span>
              </button>
              <button
                type="button"
                onClick={() => refPersonnelFileInputRef.current?.click()}
                className={SETTINGS_BUTTON_STYLES.secondary}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Charger JSON</span>
              </button>
              <button
                type="button"
                onClick={() => handleRunRefPersonnelPipeline(true)}
                className={SETTINGS_BUTTON_STYLES.secondary}
                data-testid="btn-dryrun-ref-personnel"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-sky-700" />
                <span>Vérifier (dryRun)</span>
              </button>
              <button
                type="button"
                onClick={() => handleRunRefPersonnelPipeline(false)}
                className={SETTINGS_BUTTON_STYLES.primary}
                data-testid="btn-merge-ref-personnel"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Importer (MERGE)</span>
              </button>
              <button
                type="button"
                onClick={handleExportRefPersonnel}
                className={SETTINGS_BUTTON_STYLES.secondary}
                data-testid="btn-export-ref-personnel"
                title="Exporter les équipes actuelles au format Paquet Round-Trip (Type A)"
              >
                <Download className="w-3.5 h-3.5 text-emerald-700" />
                <span>Exporter (Round-Trip Type A)</span>
              </button>
            </div>
          </div>

          {/* Card 3: ASSETS_MACHINES */}
          <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-extrabold text-slate-900">
                  3. Paquet Machines Enregistrées (ASSETS_MACHINES — Niveau 1)
                </h4>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded bg-indigo-100 text-indigo-800">
                  03_MACHINES
                </span>
              </div>
              <p className="text-[11px] text-slate-600 mt-1">
                Validation <code className="font-mono">PRODUCTION</code> vs{' '}
                <code className="font-mono">SYSTEM_GENERAL</code>, normalisation{' '}
                <code className="font-mono">code_zone</code> et hiérarchie{' '}
                <code className="font-mono">parent_code_machine</code>.
              </p>
              <textarea
                value={assetsMachinesJsonText}
                onChange={(e) => setAssetsMachinesJsonText(e.target.value)}
                rows={4}
                placeholder='{"bundleType":"ASSETS_MACHINES","machines":[{"code_machine":"CNC-01","designation":"...","code_zone":"DETOURAG","asset_class":"PRODUCTION","code_family":"...","code_template":"..."}]}'
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-[11px] font-mono text-slate-800 focus:outline-none focus:border-sky-600"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/80">
              <input
                ref={assetsMachinesFileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={(e) => handleFileLoad(e, 'ASSETS_MACHINES')}
                className="hidden"
              />
              <button
                type="button"
                onClick={handleDownloadAssetsMachinesTemplate}
                className={SETTINGS_BUTTON_STYLES.secondary}
                data-testid="btn-template-assets-machines"
                title="Télécharger le modèle officiel ASSETS_MACHINES.template.json"
              >
                <Download className="w-3.5 h-3.5 text-sky-700" />
                <span>Télécharger le modèle</span>
              </button>
              <button
                type="button"
                onClick={() => assetsMachinesFileInputRef.current?.click()}
                className={SETTINGS_BUTTON_STYLES.secondary}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Charger JSON</span>
              </button>
              <button
                type="button"
                onClick={() => handleRunAssetsMachinesPipeline(true)}
                className={SETTINGS_BUTTON_STYLES.secondary}
                data-testid="btn-dryrun-assets-machines"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-sky-700" />
                <span>Vérifier (dryRun)</span>
              </button>
              <button
                type="button"
                onClick={() => handleRunAssetsMachinesPipeline(false)}
                className={SETTINGS_BUTTON_STYLES.primary}
                data-testid="btn-merge-assets-machines"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Importer (MERGE)</span>
              </button>
              <button
                type="button"
                onClick={handleExportAssetsMachines}
                className={SETTINGS_BUTTON_STYLES.secondary}
                data-testid="btn-export-assets-machines"
                title="Exporter le parc machines actuel au format Paquet Round-Trip (Type A)"
              >
                <Download className="w-3.5 h-3.5 text-emerald-700" />
                <span>Exporter (Round-Trip Type A)</span>
              </button>
            </div>
          </div>

          {/* Card 4: REF_PDR */}
          <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-extrabold text-slate-900">
                  4. Paquet Catalogue Stock PDR (REF_PDR — Niveau 2)
                </h4>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded bg-amber-100 text-amber-800">
                  04_PDR (GROUPS ➔ TYPES ➔ ITEMS)
                </span>
              </div>
              <p className="text-[11px] text-slate-600 mt-1">
                Clés stables : <code className="font-mono">code_group</code>,{' '}
                <code className="font-mono">code_type</code>,{' '}
                <code className="font-mono">ref</code> (Catalogue pur — zéro mouvement de stock).
              </p>
              <textarea
                value={refPdrJsonText}
                onChange={(e) => setRefPdrJsonText(e.target.value)}
                rows={4}
                placeholder='{"bundleType":"REF_PDR","groups":[{"code_group":"ROUL","libelle":"..."}],"types":[{"code_type":"TYP-ROUL-BILLE","code_group":"ROUL","libelle":"..."}],"items":[{"ref":"SKF-6205-2RS","designation":"...","code_type":"TYP-ROUL-BILLE","code_group":"ROUL"}]}'
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-[11px] font-mono text-slate-800 focus:outline-none focus:border-sky-600"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/80">
              <input
                ref={refPdrFileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={(e) => handleFileLoad(e, 'REF_PDR')}
                className="hidden"
              />
              <button
                type="button"
                onClick={handleDownloadRefPdrTemplate}
                className={SETTINGS_BUTTON_STYLES.secondary}
                data-testid="btn-template-ref-pdr"
                title="Télécharger le modèle officiel REF_PDR.template.json"
              >
                <Download className="w-3.5 h-3.5 text-sky-700" />
                <span>Télécharger le modèle</span>
              </button>
              <button
                type="button"
                onClick={() => refPdrFileInputRef.current?.click()}
                className={SETTINGS_BUTTON_STYLES.secondary}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Charger JSON</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setParseError(null);
                  if (!refPdrJsonText.trim()) {
                    setParseError(
                      'Veuillez charger un fichier JSON ou coller le contenu du paquet REF_PDR.'
                    );
                    return;
                  }
                  try {
                    const parsed = JSON.parse(refPdrJsonText);
                    const report = validateAndCommitRefPdrBundle(parsed, {
                      mode: 'MERGE',
                      origin: 'JSON_BUNDLE',
                      dryRun: true,
                    });
                    setLastImportReport(report);
                    if (report.success) {
                      showToast?.(
                        'Validation REF_PDR (dryRun) réussie : 0 erreur bloquante.',
                        'success'
                      );
                    } else {
                      showToast?.(
                        `Échec validation REF_PDR : ${report.rejected.length} rejet(s) détecté(s).`,
                        'error'
                      );
                    }
                  } catch (err: any) {
                    setParseError(
                      `JSON REF_PDR invalide : ${err?.message || 'Erreur de syntaxe JSON'}`
                    );
                  }
                }}
                className={SETTINGS_BUTTON_STYLES.secondary}
                data-testid="btn-dryrun-ref-pdr"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-sky-700" />
                <span>Vérifier (dryRun)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setParseError(null);
                  if (!refPdrJsonText.trim()) {
                    setParseError(
                      'Veuillez charger un fichier JSON ou coller le contenu du paquet REF_PDR.'
                    );
                    return;
                  }
                  try {
                    const parsed = JSON.parse(refPdrJsonText);
                    const report = validateAndCommitRefPdrBundle(parsed, {
                      mode: 'MERGE',
                      origin: 'JSON_BUNDLE',
                      dryRun: false,
                    });
                    setLastImportReport(report);
                    if (report.success) {
                      showToast?.(
                        'Import MERGE REF_PDR engagé dans DataGateway avec succès.',
                        'success'
                      );
                    } else {
                      showToast?.(
                        `Échec validation REF_PDR : ${report.rejected.length} rejet(s) détecté(s).`,
                        'error'
                      );
                    }
                  } catch (err: any) {
                    setParseError(
                      `JSON REF_PDR invalide : ${err?.message || 'Erreur de syntaxe JSON'}`
                    );
                  }
                }}
                className={SETTINGS_BUTTON_STYLES.primary}
                data-testid="btn-merge-ref-pdr"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Importer (MERGE)</span>
              </button>
              <button
                type="button"
                onClick={handleExportRefPdr}
                className={SETTINGS_BUTTON_STYLES.secondary}
                data-testid="btn-export-ref-pdr"
                title="Exporter le catalogue PDR actuel au format Paquet Round-Trip (Type A)"
              >
                <Download className="w-3.5 h-3.5 text-emerald-700" />
                <span>Exporter (Round-Trip Type A)</span>
              </button>
            </div>
          </div>
        </div>

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
                  Rapport {lastImportReport.bundleType} —{' '}
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

      {/* 2. Granular Per-Module Injection Grid */}
      <SettingsSectionCard
        title="Injection ou Purge Granulaire par Module"
        description="Chargez ou videz individuellement chaque référentiel métier (Stock PDR, Parc Machines, Entrepôt, Préventif, Correctif, Mouvements, Équipes)."
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
                title="Télécharger le modèle Excel vierge pour préparer vos données réelles"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Gabarit Vierge (.XLSX)</span>
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
