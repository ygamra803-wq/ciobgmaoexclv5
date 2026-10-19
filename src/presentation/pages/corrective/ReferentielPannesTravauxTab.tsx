import { useState, useMemo } from 'react';
import {
  Database,
  Search,
  BookOpen,
  Wrench,
  RefreshCw,
  FileSpreadsheet,
  Users,
  ShieldAlert,
  SlidersHorizontal,
  X,
  Filter,
  RotateCcw,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import CustomSelect from '../../components/common/CustomSelect';
import PannesCatalogTab from './referentiel/PannesCatalogTab';
import TravauxStandardTab from './referentiel/TravauxStandardTab';
import MatricesActionsTab from './referentiel/MatricesActionsTab';
import EquipeIntervenantsTab from './referentiel/EquipeIntervenantsTab';
import { useI18n } from '../../../i18n/I18nContext';

const CATEGORY_META = {
  E: { label: 'Électrique', color: 'bg-amber-100 text-amber-900 border-amber-300', dot: 'bg-amber-500' },
  M: { label: 'Mécanique', color: 'bg-blue-100 text-blue-900 border-blue-300', dot: 'bg-blue-500' },
  H: { label: 'Hydraulique', color: 'bg-cyan-100 text-cyan-900 border-cyan-300', dot: 'bg-cyan-500' },
  P: { label: 'Pneumatique', color: 'bg-teal-100 text-teal-900 border-teal-300', dot: 'bg-teal-500' },
  E_M: { label: 'Électro-Mécanique', color: 'bg-indigo-100 text-indigo-900 border-indigo-300', dot: 'bg-indigo-500' },
  E_H: { label: 'Électro-Hydraulique', color: 'bg-purple-100 text-purple-900 border-purple-300', dot: 'bg-purple-500' },
  E_P: { label: 'Électro-Pneumatique', color: 'bg-pink-100 text-pink-900 border-pink-300', dot: 'bg-pink-500' },
  M_P: { label: 'Mécanique-Pneumatique', color: 'bg-sky-100 text-sky-900 border-sky-300', dot: 'bg-sky-500' },
  M_H: { label: 'Mécanique-Hydraulique', color: 'bg-emerald-100 text-emerald-900 border-emerald-300', dot: 'bg-emerald-500' },
  AUTRE: { label: 'Autres Anomalies', color: 'bg-slate-100 text-slate-800 border-slate-300', dot: 'bg-slate-500' },
};

function formatPanneName(str) {
  if (!str) return '';
  return String(str)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function ReferentielPannesTravauxTab({
  activeSubTab,
  onSubTabChange,
  hideHeaderCard = false,
  panneCategories = {},
  travauxAFaire = [],
  actionsByPanne = {},
  intervenants = [],
  technicians = [],
  interventions = [],
  onAddDemandeWithPreset,
  onForceSyncSeed,
  onAddActionForPanne,
  onUpdateActionForPanne,
  onDeleteActionForPanne,
  onAddPanne,
  onUpdatePanne,
  onDeletePanne,
  onAddTravail,
  onUpdateTravail,
  onDeleteTravail,
  onAddTechnician,
  onUpdateTechnician,
  onDeleteTechnician,
  zones = [],
  showToast,
}) {
  const { t } = useI18n();
  const [internalSubTab, setInternalSubTab] = useState('pannes'); // 'pannes', 'travaux', 'actions', 'intervenants'
  const subTab = activeSubTab || internalSubTab;
  const setSubTab = (val) => {
    setInternalSubTab(val);
    if (typeof onSubTabChange === 'function') {
      onSubTabChange(val);
    }
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [expandedPanne, setExpandedPanne] = useState(null);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Dynamic Relational Formula for Intervenants (Utilisateurs SSOT)
  const resolvedIntervenants = useMemo(() => {
    const baseList = Array.isArray(technicians) && technicians.length > 0 
      ? technicians 
      : (Array.isArray(intervenants) && intervenants.length > 0 ? intervenants : []);

    return baseList.map((tech) => {
      const techName = String(tech.nom || tech.name || '').trim().toLowerCase();
      const count = (interventions || []).filter((bt) => {
        const btTech = String(bt.intervenant || '').trim().toLowerCase();
        return btTech && (btTech === techName || btTech.includes(techName) || techName.includes(btTech));
      }).length;

      return {
        id: tech.id_technician || tech.id || `TECH-${tech.nom}`,
        id_technician: tech.id_technician || tech.id || `TECH-${tech.nom}`,
        nom: tech.nom || tech.name || 'Technicien',
        name: tech.nom || tech.name || 'Technicien',
        id_zone: tech.id_zone || 'Toutes zones',
        specialite: tech.specialite || 'Maintenance & Dépannage',
        role: tech.role || 'Technicien Correctif',
        total: tech.total !== undefined ? tech.total : count,
      };
    });
  }, [technicians, intervenants, interventions]);

  // 1. Calculations & Counts
  const allCategories = useMemo(() => {
    return Object.keys(panneCategories);
  }, [panneCategories]);

  const flatPannes = useMemo(() => {
    const list = [];
    Object.entries(panneCategories).forEach(([cat, pannes]) => {
      if (Array.isArray(pannes)) {
        pannes.forEach((p) => {
          list.push({
            id: `${cat}_${p}`,
            category: cat,
            code: p,
            name: formatPanneName(p),
            actions: actionsByPanne[p] || actionsByPanne[p.replace(/_/g, ' ')] || actionsByPanne[p.replace(/\s+/g, '_')] || [],
          });
        });
      }
    });
    return list;
  }, [panneCategories, actionsByPanne]);

  const totalPannesCount = flatPannes.length;
  const totalTravauxCount = (travauxAFaire || []).length;
  const totalActionsKeysCount = Object.keys(actionsByPanne || {}).length;
  const totalIntervenantsCount = resolvedIntervenants.length;

  // 2. Filtered Pannes
  const filteredPannes = useMemo(() => {
    return flatPannes.filter((item) => {
      if (selectedCategory !== 'ALL' && item.category !== selectedCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = item.name.toLowerCase().includes(q);
        const matchCode = item.code.toLowerCase().includes(q);
        const translatedCat = t(`corrective.categories.${item.category}`, CATEGORY_META[item.category]?.label || '').toLowerCase();
        const matchCat = (CATEGORY_META[item.category]?.label || '').toLowerCase().includes(q) || translatedCat.includes(q);
        return matchName || matchCode || matchCat;
      }
      return true;
    });
  }, [flatPannes, selectedCategory, searchQuery, t]);

  // 3. Filtered Travaux à Faire
  const filteredTravaux = useMemo(() => {
    if (!Array.isArray(travauxAFaire)) return [];
    if (!searchQuery.trim()) return travauxAFaire;
    const q = searchQuery.toLowerCase();
    return travauxAFaire.filter((t) => String(t).toLowerCase().includes(q));
  }, [travauxAFaire, searchQuery]);

  // 4. Filtered Actions Matrix
  const filteredActionsMatrix = useMemo(() => {
    const entries = Object.entries(actionsByPanne || {});
    if (!searchQuery.trim()) return entries;
    const q = searchQuery.toLowerCase();
    return entries.filter(([panneKey, acts]) => {
      if (panneKey.toLowerCase().includes(q)) return true;
      if (Array.isArray(acts) && acts.some((a) => String(a).toLowerCase().includes(q))) return true;
      return false;
    });
  }, [actionsByPanne, searchQuery]);

  // 5. Filtered Intervenants (Excel Search on Name, Zone, Specialite, ID)
  const filteredIntervenants = useMemo(() => {
    if (!searchQuery.trim()) return resolvedIntervenants;
    const q = searchQuery.toLowerCase();
    return resolvedIntervenants.filter((i) => {
      const nom = String(i.nom || i.name || '').toLowerCase();
      const spec = String(i.specialite || '').toLowerCase();
      const zone = String(i.id_zone || '').toLowerCase();
      const id = String(i.id_technician || i.id || '').toLowerCase();
      return nom.includes(q) || spec.includes(q) || zone.includes(q) || id.includes(q);
    });
  }, [resolvedIntervenants, searchQuery]);

  // Handlers
  const handleCopyText = (text, idx) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedIndex(idx);
      setTimeout(() => setCopiedIndex(null), 2000);
      showToast?.(t('corrective.catalogue.toast_copied', 'Texte copié dans le presse-papier !'), 'success');
    } catch {
      showToast?.(t('corrective.catalogue.toast_copy_error', 'Impossible de copier le texte'), 'error');
    }
  };

  const handleForceSync = () => {
    setIsSyncing(true);
    try {
      if (typeof onForceSyncSeed === 'function') {
        const res = onForceSyncSeed();
        showToast?.(
          t('corrective.catalogue.toast_sync_success_detailed', `Données réelles synchronisées avec succès : {{interventions}} Interventions, {{travaux}} Travaux, {{pannes}} Pannes, {{actions}} Actions !`, {
            interventions: res?.interventionsCount ?? 0,
            travaux: res?.travauxCount ?? (travauxAFaire || []).length,
            pannes: res?.pannesCount ?? flatPannes.length,
            actions: res?.actionsCount ?? Object.keys(actionsByPanne || {}).length
          }),
          'success'
        );
      } else {
        showToast?.(t('corrective.catalogue.toast_sync_success', 'Synchronisation effectuée avec succès !'), 'success');
      }
    } catch (e) {
      console.error(e);
      showToast?.(t('corrective.catalogue.toast_sync_error', 'Erreur lors de la synchronisation'), 'error');
    } finally {
      setTimeout(() => setIsSyncing(false), 500);
    }
  };

  const handleExportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Pannes
      const pannesData = flatPannes.map((p) => ({
        Catégorie_Code: p.category,
        Catégorie_Nom: t(`corrective.categories.${p.category}`, CATEGORY_META[p.category]?.label || p.category),
        Anomalie_Code: p.code,
        Anomalie_Libellé: p.name,
        Nombre_Actions_Standard: p.actions.length,
      }));
      const wsPannes = XLSX.utils.json_to_sheet(pannesData);
      XLSX.utils.book_append_sheet(wb, wsPannes, 'Pannes_Par_Categorie');

      // Sheet 2: Travaux
      const travauxData = (travauxAFaire || []).map((t, idx) => ({
        N_Ordre: idx + 1,
        Description_Travail_Standard: t,
      }));
      const wsTravaux = XLSX.utils.json_to_sheet(travauxData);
      XLSX.utils.book_append_sheet(wb, wsTravaux, 'Travaux_A_Faire_114');

      // Sheet 3: Actions Matrix
      const actionsData = [];
      Object.entries(actionsByPanne || {}).forEach(([p, acts]) => {
        (acts || []).forEach((a, i) => {
          actionsData.push({
            Anomalie_Panne: p,
            N_Action: i + 1,
            Action_Corrective_Recommandée: a,
          });
        });
      });
      const wsActions = XLSX.utils.json_to_sheet(actionsData);
      XLSX.utils.book_append_sheet(wb, wsActions, 'Actions_Par_Panne');

      // Sheet 4: Intervenants (Calculés dynamiquement depuis Utilisateurs SSOT)
      const techData = (resolvedIntervenants || []).map((i) => ({
        ID_Technicien: i.id_technician || i.id || '',
        Nom: i.nom || i.name || '',
        Zone_Atelier: i.id_zone || '',
        Specialite: i.specialite || '',
        Total_Interventions_BT: i.total || 0,
      }));
      const wsTech = XLSX.utils.json_to_sheet(techData);
      XLSX.utils.book_append_sheet(wb, wsTech, 'Intervenants_Equipe');

      XLSX.writeFile(wb, `GMAO_Referentiel_Pannes_Travaux_${new Date().toISOString().split('T')[0]}.xlsx`);
      showToast?.(t('corrective.catalogue.toast_export_success', 'Export Excel du catalogue complet généré avec succès (.xlsx)'), 'success');
    } catch (e) {
      console.error(e);
      showToast?.(t('corrective.catalogue.toast_export_error', 'Erreur lors de l\'export Excel'), 'error');
    }
  };

  // Category options formatted for CustomSelect
  const categoryOptions = useMemo(() => {
    const list = [
      {
        value: 'ALL',
        label: `${t('components.family.all_groups', 'Toutes les Catégories')} (${totalPannesCount})`,
        badge: totalPannesCount,
        badgeColor: 'bg-slate-100 text-slate-800 border-slate-300',
      },
    ];

    allCategories.forEach((cat) => {
      const meta = CATEGORY_META[cat] || { label: cat };
      const count = (panneCategories[cat] || []).length;
      list.push({
        value: cat,
        label: `${cat} - ${meta.label} (${count})`,
        badge: count,
        badgeColor: meta.color || 'bg-amber-100 text-amber-900 border-amber-300',
      });
    });

    return list;
  }, [allCategories, panneCategories, totalPannesCount, t]);

  return (
    <div className="space-y-6">
      {/* 1. Header & KPI Metrics Card */}
      {!hideHeaderCard && (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 md:p-6 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16)] transition-all relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />

          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 pb-5 border-b border-slate-100">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-300/80 flex items-center justify-center text-amber-700 shadow-2xs shrink-0">
                <Database className="w-6 h-6 text-amber-700" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">
                    {t('corrective.catalogue.title', 'Catalogue & Référentiel Données GMAO (الكواليس)')}
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 font-mono font-black">
                    {t('corrective.catalogue.secondary_page', 'Page Secondaire (Coulisses)')}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-slate-100 text-slate-800 border border-slate-300 font-mono">
                    {t('corrective.catalogue.access_restricted', 'Accès Responsables & Administrateurs')}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
                  {t('corrective.catalogue.subtitle_with_counts', "Espace réservé à la configuration et sauvegarde des référentiels maîtres : {{pannes}} pannes cataloguées, {{travaux}} tâches standards, {{actions}} matrices d'actions correctives et {{intervenants}} techniciens habilités.", {
                    pannes: totalPannesCount,
                    travaux: totalTravauxCount,
                    actions: totalActionsKeysCount,
                    intervenants: totalIntervenantsCount
                  })}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <button
                onClick={handleForceSync}
                disabled={isSyncing}
                className={`h-9 px-3.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs transition flex items-center gap-2 cursor-pointer shadow-2xs active:scale-95 ${
                  isSyncing ? 'opacity-70 animate-pulse' : ''
                }`}
                title={t('corrective.catalogue.sync_data', 'Resynchroniser le Référentiel')}
              >
                <RefreshCw className={`w-3.5 h-3.5 text-amber-700 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? t('corrective.catalogue.sync_data_loading', 'Synchronisation...') : t('corrective.catalogue.sync_data', 'Actualiser Données Usine')}</span>
              </button>

              <button
                onClick={handleExportExcel}
                className="h-9 px-3.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-bold text-xs transition flex items-center gap-2 cursor-pointer shadow-2xs active:scale-95"
                title={t('corrective.catalogue.export_excel', 'Exporter le Référentiel (.xlsx)')}
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                <span>{t('corrective.catalogue.export_excel', 'Export Référentiel (.xlsx)')}</span>
              </button>
            </div>
          </div>

          {/* 4 Interactive Statistics Counters (Click to jump to sub-tab) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-5">
            <div
              onClick={() => {
                setSubTab('pannes');
                setSearchQuery('');
              }}
              className={`p-3.5 rounded-xl border transition cursor-pointer select-none ${
                subTab === 'pannes'
                  ? 'bg-amber-500/10 border-amber-300 shadow-2xs ring-1 ring-amber-300'
                  : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold uppercase tracking-wider mb-1">
                <span>{t('corrective.catalogue.kpi_pannes_title', 'Pannes Répertoriées')}</span>
                <ShieldAlert className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-2xl font-black text-slate-900 font-mono">{totalPannesCount}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{t('corrective.catalogue.kpi_pannes_desc', '10 catégories industrielles')}</div>
            </div>

            <div
              onClick={() => {
                setSubTab('travaux');
                setSearchQuery('');
              }}
              className={`p-3.5 rounded-xl border transition cursor-pointer select-none ${
                subTab === 'travaux'
                  ? 'bg-blue-500/10 border-blue-300 shadow-2xs ring-1 ring-blue-300'
                  : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold uppercase tracking-wider mb-1">
                <span>{t('corrective.catalogue.kpi_travaux_title', 'Travaux Standard')}</span>
                <BookOpen className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl font-black text-slate-900 font-mono">{totalTravauxCount}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{t('corrective.catalogue.kpi_travaux_desc', 'Ordres & tâches d\'atelier')}</div>
            </div>

            <div
              onClick={() => {
                setSubTab('actions');
                setSearchQuery('');
              }}
              className={`p-3.5 rounded-xl border transition cursor-pointer select-none ${
                subTab === 'actions'
                  ? 'bg-emerald-500/10 border-emerald-300 shadow-2xs ring-1 ring-emerald-300'
                  : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold uppercase tracking-wider mb-1">
                <span>{t('corrective.catalogue.kpi_actions_title', 'Matrices Actions')}</span>
                <Wrench className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-black text-slate-900 font-mono">{totalActionsKeysCount}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{t('corrective.catalogue.kpi_actions_desc', 'Pannes avec solutions types')}</div>
            </div>

            <div
              onClick={() => {
                setSubTab('intervenants');
                setSearchQuery('');
              }}
              className={`p-3.5 rounded-xl border transition cursor-pointer select-none ${
                subTab === 'intervenants'
                  ? 'bg-purple-500/10 border-purple-300 shadow-2xs ring-1 ring-purple-300'
                  : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold uppercase tracking-wider mb-1">
                <span>{t('corrective.catalogue.kpi_intervenants_title', 'Équipe Intervenants')}</span>
                <Users className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-2xl font-black text-slate-900 font-mono">{totalIntervenantsCount}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{t('corrective.catalogue.kpi_intervenants_desc', 'Fiches techniciens usine')}</div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Unified Multi-Criteria Filter & Search Card Archetype */}
      <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200/90 shadow-[0_10px_25px_-5px_rgba(0,0,0,0.05),0_4px_10px_-2px_rgba(0,0,0,0.02)] space-y-4">
        {/* Header Row: Title with Icon, Dynamic Count & Reset Button */}
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100/90">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-transparent border border-amber-300/80 flex items-center justify-center text-amber-700 shadow-2xs">
              <Filter className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>{t('components.group.filters_title', 'Filtres & Recherche Avancée')}</span>
                <span className="px-2 py-0.5 rounded-md text-[10.5px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200/80">
                  {subTab === 'pannes'
                    ? `${filteredPannes.length} / ${totalPannesCount} ${t('corrective.catalogue.tab_pannes', 'Pannes')}`
                    : subTab === 'travaux'
                    ? `${filteredTravaux.length} / ${totalTravauxCount} ${t('corrective.catalogue.tab_travaux', 'Travaux')}`
                    : subTab === 'actions'
                    ? `${filteredActionsMatrix.length} / ${totalActionsKeysCount} ${t('corrective.catalogue.tab_actions', 'Matrices')}`
                    : `${filteredIntervenants.length} / ${totalIntervenantsCount} ${t('corrective.catalogue.tab_intervenants', 'Intervenants')}`}
                </span>
              </h3>
            </div>
          </div>

          {/* Reset Filters 3D Button */}
          {(searchQuery || selectedCategory !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('ALL');
              }}
              className="px-3 py-1.5 rounded-xl border border-rose-200/90 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95 animate-in fade-in"
              title={t('components.group.reset_filters', 'Réinitialiser tous les filtres')}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('components.group.reset_filters', 'Réinitialiser')}</span>
            </button>
          )}
        </div>

        {/* 2. Grid Row: Omni-Text Search Input & Category Dropdown */}
        <div className={`grid grid-cols-1 ${subTab === 'pannes' ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-1'} gap-3.5 items-end`}>
          {/* Omni Search Input */}
          <div className={subTab === 'pannes' ? 'sm:col-span-1 lg:col-span-2' : 'w-full'}>
            <div className="flex items-center justify-between mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-800 font-mono">
              <span>{t('components.group.search_title', 'Recherche Multi-Critères')}</span>
              <span className="px-1.5 py-0.2 rounded text-[9.5px] font-mono font-bold bg-slate-100 text-slate-600 border border-slate-200/80">
                {t('components.group.search_badge', 'Mots-Clés / Codes')}
              </span>
            </div>
            <div className="relative">
              <div className="absolute left-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shadow-2xs pointer-events-none">
                <Search className="w-3.5 h-3.5" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  subTab === 'pannes'
                    ? t('corrective.pannes.search_placeholder', 'Rechercher dans les pannes cataloguées...')
                    : subTab === 'travaux'
                    ? t('corrective.travaux.search_placeholder', 'Rechercher dans les travaux standards...')
                    : subTab === 'actions'
                    ? t('corrective.actions.search_placeholder', 'Rechercher dans les matrices d\'actions...')
                    : t('corrective.intervenants.search_placeholder', 'Rechercher dans les techniciens habilités...')
                }
                className="w-full h-10 pl-10 pr-8 rounded-xl border border-slate-200/90 bg-slate-50/80 text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all shadow-inner"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-600 cursor-pointer p-0.5"
                  title="Effacer la recherche"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Category CustomSelect Dropdown (When in pannes tab) */}
          {subTab === 'pannes' && (
            <div>
              <div className="flex items-center justify-between mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-800 font-mono">
                <span>{t('corrective.pannes.col_category', 'Catégorie D\'Anomalie')}</span>
                <span className="px-1.5 py-0.2 rounded text-[9.5px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200/80">
                  {t('corrective.pannes.category_families', 'Families')}
                </span>
              </div>
              <CustomSelect
                value={selectedCategory}
                onChange={(val) => setSelectedCategory(val)}
                options={categoryOptions}
                placeholder={t('components.family.group_select_label', 'Sélectionner une catégorie...')}
                prefixIcon={ShieldAlert}
                prefixIconClassName="text-amber-600"
                className="h-10 text-xs font-semibold"
              />
            </div>
          )}
        </div>

        {/* 3. Category Fast Pills Row (When in pannes tab) */}
        {subTab === 'pannes' && (
          <div className="pt-3 border-t border-slate-100/90 flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1 font-mono">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
              {t('corrective.catalogue.fast_filter', 'Filtre Rapide :')}
            </span>

            <button
              type="button"
              onClick={() => setSelectedCategory('ALL')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer active:scale-95 ${
                selectedCategory === 'ALL'
                  ? 'bg-slate-900 text-white shadow-2xs font-black'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200/60'
              }`}
            >
              {t('corrective.catalogue.filter_all', 'Toutes')} ({totalPannesCount})
            </button>

            {allCategories.map((cat) => {
              const meta = CATEGORY_META[cat] || { label: cat, color: 'bg-slate-100 text-slate-800' };
              const count = (panneCategories[cat] || []).length;
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                    isSelected
                      ? `${meta.color} ring-2 ring-amber-500/40 shadow-2xs font-black`
                      : 'bg-slate-100/90 text-slate-600 hover:bg-slate-200/80 border border-slate-200/60'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${meta.dot || 'bg-slate-400'}`} />
                  <span>{t(`corrective.categories.${cat}`, meta.label)}</span>
                  <span className="px-1.5 py-0.2 text-[9.5px] font-mono font-bold rounded-md bg-white/80 border border-slate-200/50">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. SUB-TABS CONTENT MODULES */}
      {subTab === 'pannes' && (
        <PannesCatalogTab
          filteredPannes={filteredPannes}
          totalPannesCount={totalPannesCount}
          selectedCategory={selectedCategory}
          CATEGORY_META={CATEGORY_META}
          expandedPanne={expandedPanne}
          setExpandedPanne={setExpandedPanne}
          onAddDemandeWithPreset={onAddDemandeWithPreset}
          setSearchQuery={setSearchQuery}
          setSelectedCategory={setSelectedCategory}
          onAddPanne={onAddPanne}
          onUpdatePanne={onUpdatePanne}
          onDeletePanne={onDeletePanne}
          showToast={showToast}
        />
      )}

      {subTab === 'travaux' && (
        <TravauxStandardTab
          filteredTravaux={filteredTravaux}
          totalTravauxCount={totalTravauxCount}
          copiedIndex={copiedIndex}
          handleCopyText={handleCopyText}
          onAddDemandeWithPreset={onAddDemandeWithPreset}
          setSearchQuery={setSearchQuery}
          onAddTravail={onAddTravail}
          onUpdateTravail={onUpdateTravail}
          onDeleteTravail={onDeleteTravail}
          showToast={showToast}
        />
      )}

      {subTab === 'actions' && (
        <MatricesActionsTab
          filteredActionsMatrix={filteredActionsMatrix}
          totalActionsKeysCount={totalActionsKeysCount}
          copiedIndex={copiedIndex}
          handleCopyText={handleCopyText}
          formatPanneName={formatPanneName}
          onAddDemandeWithPreset={onAddDemandeWithPreset}
          onAddActionForPanne={onAddActionForPanne}
          onUpdateActionForPanne={onUpdateActionForPanne}
          onDeleteActionForPanne={onDeleteActionForPanne}
          panneCategories={panneCategories}
          showToast={showToast}
        />
      )}

      {subTab === 'intervenants' && (
        <EquipeIntervenantsTab
          filteredIntervenants={filteredIntervenants}
          totalIntervenantsCount={totalIntervenantsCount}
          onAddDemandeWithPreset={onAddDemandeWithPreset}
          setSearchQuery={setSearchQuery}
          onAddTechnician={onAddTechnician}
          onUpdateTechnician={onUpdateTechnician}
          onDeleteTechnician={onDeleteTechnician}
          zones={zones}
          showToast={showToast}
        />
      )}
    </div>
  );
}
