import { useState } from 'react';
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
} from 'lucide-react';
import { SettingsSectionCard, SETTINGS_BUTTON_STYLES } from './settingsUi';

/**
 * Data Injection Hub: Seed factory baseline data, reset datasets, toggle demo mode.
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
