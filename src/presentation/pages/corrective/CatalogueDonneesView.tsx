import { useState, useMemo } from 'react';
import {
  Database,
  Wrench,
  ShieldAlert,
  BookOpen,
  Users,
  RefreshCw,
  FileSpreadsheet,
} from 'lucide-react';
import ReferentielPannesTravauxTab from './ReferentielPannesTravauxTab';
import Action3DButton from '../../components/common/Action3DButton';
import { useI18n } from '../../../i18n/I18nContext';
import * as XLSX from 'xlsx';

export default function CatalogueDonneesView({
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
  onNavigateToTab,
}) {
  const { t } = useI18n();
  const [activeSubTab, setActiveSubTab] = useState('pannes'); // 'pannes', 'travaux', 'actions', 'intervenants'
  const [isSyncing, setIsSyncing] = useState(false);

  // Dynamic Relational Formula:
  // Intervenants = FILTER(Utilisateurs/Technicians)
  // TotalInterventions = COUNTIFS(Interventions, intervenant === tech.nom)
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
        total: count,
      };
    });
  }, [technicians, intervenants, interventions]);

  // Counts for tabs & badges (Truthful zero-tolerant calculations)
  const totalPannesCount = useMemo(() => {
    let count = 0;
    Object.values(panneCategories || {}).forEach((pannes) => {
      if (Array.isArray(pannes)) count += pannes.length;
    });
    return count;
  }, [panneCategories]);

  const totalTravauxCount = (travauxAFaire || []).length;
  const totalActionsKeysCount = Object.keys(actionsByPanne || {}).length;
  const totalIntervenantsCount = resolvedIntervenants.length;

  const handleForceSync = () => {
    setIsSyncing(true);
    try {
      if (typeof onForceSyncSeed === 'function') {
        const res = onForceSyncSeed();
        showToast?.(
          `Données réelles synchronisées avec succès : ${res?.interventionsCount ?? res?.interventions?.length ?? (interventions || []).length} Interventions, ${res?.travauxCount ?? (travauxAFaire || []).length} Travaux, ${res?.pannesCount ?? totalPannesCount} Pannes !`,
          'success'
        );
      } else {
        showToast?.('Synchronisation effectuée avec succès !', 'success');
      }
    } catch (e) {
      console.error(e);
      showToast?.('Erreur lors de la synchronisation', 'error');
    } finally {
      setTimeout(() => setIsSyncing(false), 500);
    }
  };

  const handleExportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Pannes
      const pannesData = [];
      Object.entries(panneCategories || {}).forEach(([cat, pannes]) => {
        if (Array.isArray(pannes)) {
          pannes.forEach((p) => {
            pannesData.push({
              Catégorie: cat,
              Code_Anomalie: p,
              Actions_Recommandées: (actionsByPanne[p] || []).length,
            });
          });
        }
      });
      const wsPannes = XLSX.utils.json_to_sheet(pannesData);
      XLSX.utils.book_append_sheet(wb, wsPannes, 'Pannes_Cataloguées');

      // Sheet 2: Travaux
      const travauxData = (travauxAFaire || []).map((t, idx) => ({
        N_Ordre: idx + 1,
        Description_Tâche_Standard: t,
      }));
      const wsTravaux = XLSX.utils.json_to_sheet(travauxData);
      XLSX.utils.book_append_sheet(wb, wsTravaux, 'Travaux_Standard');

      // Sheet 3: Intervenants (Calculés dynamiquement depuis Utilisateurs & BTs)
      const techData = (resolvedIntervenants || []).map((i) => ({
        ID_Technicien: i.id_technician || i.id || '',
        Nom_Prenom: i.nom || i.name || '',
        Zone_Atelier: i.id_zone || '',
        Specialite: i.specialite || '',
        Nombre_Interventions_BT: i.total || 0,
        Statut: 'Habilité GMAO',
      }));
      const wsTech = XLSX.utils.json_to_sheet(techData);
      XLSX.utils.book_append_sheet(wb, wsTech, 'Équipe_Intervenants');

      XLSX.writeFile(wb, `GMAO_Catalogue_Donnees_${new Date().toISOString().split('T')[0]}.xlsx`);
      showToast?.('Export Excel du catalogue généré avec succès (.xlsx)', 'success');
    } catch (e) {
      console.error(e);
      showToast?.('Erreur lors de l\'export Excel', 'error');
    }
  };

  const subTabsConfig = [
    {
      id: 'pannes',
      label: t('corrective.catalogue.tab_pannes', '1. Pannes Catalogue'),
      icon: ShieldAlert,
      badge: totalPannesCount,
      badgeColor: 'bg-amber-100 text-amber-900 border border-amber-300',
    },
    {
      id: 'travaux',
      label: t('corrective.catalogue.tab_travaux', '2. Travaux Standards'),
      icon: BookOpen,
      badge: totalTravauxCount,
      badgeColor: 'bg-blue-100 text-blue-900 border border-blue-300',
    },
    {
      id: 'actions',
      label: t('corrective.catalogue.tab_actions', '3. Matrices Actions'),
      icon: Wrench,
      badge: totalActionsKeysCount,
      badgeColor: 'bg-emerald-100 text-emerald-900 border border-emerald-300',
    },
    {
      id: 'intervenants',
      label: t('corrective.catalogue.tab_intervenants', '4. Équipe Intervenants'),
      icon: Users,
      badge: totalIntervenantsCount,
      badgeColor: 'bg-purple-100 text-purple-900 border border-purple-300',
    },
  ];

  return (
    <div className="space-y-6 select-none font-sans max-w-[2200px] mx-auto pb-12">
      {/* 1. Single Unified Executive Header Card for Catalogue & Données GMAO */}
      <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200/90 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16)] transition-all flex flex-col gap-5 relative overflow-hidden group/header">
        {/* Subtle Ambient Background Highlight */}
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-amber-500/5 rounded-full blur-2xl pointer-events-none group-hover/header:bg-amber-500/10 transition-colors duration-500" />

        {/* Top Section: Title & 3D Circular Action Buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5 border-b border-slate-100/90 pb-5 relative">
          {/* Left Column: Icon, Title & Description */}
          <div className="min-w-0 flex-1 flex items-start sm:items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-300/80 shadow-[0_4px_12px_rgba(245,158,11,0.12)] flex items-center justify-center text-amber-700 shrink-0 group-hover/header:scale-105 transition-all duration-300">
              <Database className="w-6 h-6 text-amber-700" />
            </div>

            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                {t('corrective.catalogue.title', 'Catalogue & Données GMAO (الكواليس)')}
              </h2>
              <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
                {t('corrective.catalogue.subtitle', 'Espace réservé à la configuration et sauvegarde des référentiels maîtres : pannes cataloguées, tâches standards, matrices d\'actions correctives et techniciens habilités.')}
              </p>
            </div>
          </div>

          {/* Right Column: Iconic 3D Circular Action Buttons */}
          <div className="flex items-center justify-end gap-2 shrink-0">
            {/* 3D Circular Refresh/Sync Button */}
            <Action3DButton
              variant="circle"
              color="amber"
              icon={RefreshCw}
              onClick={handleForceSync}
              disabled={isSyncing}
              title={t('corrective.catalogue.sync_data', 'Actualiser & Synchroniser les Données Usine')}
              ariaLabel="Actualiser Données"
            />

            {/* 3D Circular Export Excel Button */}
            <Action3DButton
              variant="circle"
              color="emerald"
              icon={FileSpreadsheet}
              onClick={handleExportExcel}
              title={t('corrective.catalogue.export_excel', 'Exporter le Référentiel GMAO (.xlsx)')}
              ariaLabel="Exporter Excel"
            />

            {/* 3D Circular Return to Corrective Hub Button */}
            <Action3DButton
              variant="circle"
              color="slate"
              icon={Wrench}
              onClick={() => {
                if (typeof onNavigateToTab === 'function') {
                  onNavigateToTab('corrective');
                }
              }}
              title={t('corrective.catalogue.return_hub', 'Retour au Correctif Hub')}
              ariaLabel="Correctif Hub"
            />
          </div>
        </div>

        {/* Bottom Section: Integrated 4 Sub-Tabs Row inside the Header Card */}
        <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pt-0.5">
          <div className="inline-flex items-center p-1 bg-slate-100/90 rounded-2xl border border-slate-200/90 shadow-2xs select-none max-w-full overflow-x-auto gap-1">
            {subTabsConfig.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeSubTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveSubTab(tab.id)}
                  className={`py-1.5 px-3.5 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap active:scale-95 ${
                    isActive
                      ? 'bg-white text-amber-950 shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-slate-200/60 font-black'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 border border-transparent'
                  }`}
                >
                  <Icon
                    className={`w-3.5 h-3.5 shrink-0 transition-transform ${
                      isActive ? 'text-amber-600 scale-105' : 'text-slate-500'
                    }`}
                  />
                  <span>{tab.label}</span>
                  <span
                    className={`text-[10px] font-mono font-extrabold px-1.5 py-0.2 rounded-full shadow-2xs ${
                      isActive
                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                        : tab.badgeColor || 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {tab.badge}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. Main Catalog Content Area */}
      <ReferentielPannesTravauxTab
        activeSubTab={activeSubTab}
        onSubTabChange={setActiveSubTab}
        hideHeaderCard={true}
        panneCategories={panneCategories}
        travauxAFaire={travauxAFaire}
        actionsByPanne={actionsByPanne}
        intervenants={resolvedIntervenants}
        technicians={technicians}
        interventions={interventions}
        onAddDemandeWithPreset={onAddDemandeWithPreset}
        onForceSyncSeed={onForceSyncSeed}
        onAddActionForPanne={onAddActionForPanne}
        onUpdateActionForPanne={onUpdateActionForPanne}
        onDeleteActionForPanne={onDeleteActionForPanne}
        onAddPanne={onAddPanne}
        onUpdatePanne={onUpdatePanne}
        onDeletePanne={onDeletePanne}
        onAddTravail={onAddTravail}
        onUpdateTravail={onUpdateTravail}
        onDeleteTravail={onDeleteTravail}
        onAddTechnician={onAddTechnician}
        onUpdateTechnician={onUpdateTechnician}
        onDeleteTechnician={onDeleteTechnician}
        zones={zones}
        showToast={showToast}
      />
    </div>
  );
}
