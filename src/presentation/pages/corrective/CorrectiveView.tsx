import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Wrench,
  Play,
  FileText,
  BarChart3,
  Flame,
  RefreshCw,
  FileSpreadsheet,
} from 'lucide-react';
import DemandesInterventionTab from './DemandesInterventionTab';
import BonsTravailTab from './BonsTravailTab';
import InterventionLiveTab from './InterventionLiveTab';
import ClotureRapportsTab from './ClotureRapportsTab';
import AnalyseCorrectiveTab from './AnalyseCorrectiveTab';
import CorrectiveFormulasModal from './CorrectiveFormulasModal';
import Action3DButton from '../../components/common/Action3DButton';
import FormulasModalButton from '../../components/common/FormulasModalButton';
import { useI18n } from '../../../i18n/I18nContext';
import * as XLSX from 'xlsx';

export default function CorrectiveView({
  subTab = 'corrective_di',
  onSubTabChange,
  interventions = [],
  activeLiveId,
  setActiveLiveId,
  kpis = {},
  paretoAnomalies = [],
  paretoMachines = [],
  preventiveRecommendations = [],
  onAddDemande,
  onConvertToBt,
  onStartLive,
  onClotureIntervention,
  onUpdateIntervention,
  onDeleteIntervention: _onDeleteIntervention,
  onResetToSeed,
  actionsByPanne = {},
  panneCategories = {},
  travauxAFaire = [],
  intervenants = [],
  getActionsForPanne,
  onAddActionForPanne,
  onResetActionsToSeed,
  onForceSyncSeed: _onForceSyncSeed,
  machines = [],
  technicians = [],
  stockItems = [],
  warehouseItems = [],
  onAddMouvement,
  onAddPreventiveTask,
  showToast,
  onNavigateToTab: _onNavigateToTab,
}) {
  const { t } = useI18n();

  // Local active tab fallback if not controlled from router
  const [activeTab, setActiveTab] = useState(subTab || 'corrective_di');
  const [showFormulasModal, setShowFormulasModal] = useState(false);
  const [triggerCreateDiModal, setTriggerCreateDiModal] = useState(false);
  const [diPresetData, setDiPresetData] = useState(null);

  useEffect(() => {
    if (subTab) {
      setActiveTab(subTab);
    }
  }, [subTab]);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    if (typeof onSubTabChange === 'function') {
      onSubTabChange(tabId);
    }
  };

  const handleAddDemandeWithPreset = (preset) => {
    setDiPresetData(preset);
    handleTabChange('corrective_di');
    setTriggerCreateDiModal(true);
  };

  // Quick export all corrective interventions to Excel (.xlsx)
  const handleExportAllCorrective = () => {
    try {
      const headers = [
        'ID',
        'N° BT (B)',
        'Code Machine (A)',
        'Demandeur',
        'Date Demande (C)',
        'Heure Demande (C)',
        'Intervenant (D)',
        'Date Début (E)',
        'Heure Début (E)',
        'Date Fin (F)',
        'Heure Fin (F)',
        'Temps d\'intervention calculé (G)',
        'Arrêt Machine (H)',
        'Type Panne (I)',
        'Anomalie (J)',
        'Travail Réalisé (K)',
        'PDR Utilisée (L)',
        'Marque Pièce (M)',
        'État Pièce (N)',
        'Statut',
      ];

      const dataRows = (interventions || []).map((item) => [
        item.id || '',
        item.num_bt || '',
        item.code_machine || '',
        item.demandeur || 'Production',
        item.date_demande || '',
        item.heure_demande || '',
        item.intervenant || '',
        item.date_debut || '',
        item.heure_debut || '',
        item.date_fin || '',
        item.heure_fin || '',
        item.temps_intervention_calc || item.temps_intervention || '',
        item.arret_machine ? 'OUI' : 'NON',
        item.type_panne || '',
        item.anomalie || '',
        item.travail_a_faire || item.action_realisee || '',
        item.pdr || (item.pdr_ref ? `${item.pdr_ref} - ${item.pdr_designation || ''}` : ''),
        item.marque || '',
        item.etat_piece || 'Neuve',
        item.statut || '',
      ]);

      const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Rapport_Correctif');
      XLSX.writeFile(wb, `GMAO_Correctif_Export_${new Date().toISOString().split('T')[0]}.xlsx`);

      showToast?.('Export Excel du rapport correctif généré avec succès (.xlsx)', 'success');
    } catch (err) {
      console.error('Error exporting corrective data:', err);
      showToast?.('Erreur lors de l\'export Excel', 'error');
    }
  };

  // Badge counts
  const pendingDiCount = interventions.filter(
    (i) => i.statut === 'DEMANDE' || i.statut === 'DEMANDE_CREEE' || i.statut === 'EN_ATTENTE_VALIDATION'
  ).length;
  const inProgressBtCount = interventions.filter(
    (i) => (i.statut === 'EN_COURS' || i.statut === 'BT_PLANIFIE') && i.num_bt
  ).length;
  const closedCount = interventions.filter((i) => i.statut === 'CLOTURE').length;
  const isLiveRunning = Boolean(activeLiveId);

  const tabs = [
    {
      id: 'corrective_di',
      label: t('corrective.tabs.di'),
      icon: Flame,
      badge: pendingDiCount,
      badgeColor: 'bg-amber-100 text-amber-900 border border-amber-300',
    },
    {
      id: 'corrective_bt',
      label: t('corrective.tabs.bt'),
      icon: Wrench,
      badge: inProgressBtCount,
      badgeColor: 'bg-blue-100 text-blue-900 border border-blue-300',
    },
    {
      id: 'corrective_live',
      label: t('corrective.tabs.live'),
      icon: Play,
      isPulsing: isLiveRunning,
    },
    {
      id: 'corrective_cloture',
      label: t('corrective.tabs.cloture'),
      icon: FileText,
      badge: closedCount,
      badgeColor: 'bg-emerald-100 text-emerald-900 border border-emerald-300',
    },
    {
      id: 'corrective_analyse',
      label: t('corrective.tabs.analyse'),
      icon: BarChart3,
    },
  ];

  return (
    <div className="space-y-6 select-none font-sans max-w-[2200px] mx-auto pb-12">
      {/* 1. Top Executive Banner & Action Buttons + Integrated Sub-Tabs (BDR Light GMAO Header Card Archetype) */}
      <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200/90 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5 relative overflow-hidden group/header">
        {/* Subtle Ambient Gradient Background Highlight */}
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-amber-500/5 rounded-full blur-2xl pointer-events-none group-hover/header:bg-amber-500/10 transition-colors duration-500" />

        {/* Left Column: Title, 3D Icon & Description */}
        <div className="min-w-0 flex-1 flex items-start sm:items-center gap-3.5 relative">
          {/* 3D Elevated Page Badge Icon */}
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-200/90 shadow-[0_4px_12px_rgba(245,158,11,0.12)] flex items-center justify-center text-amber-700 group-hover/header:scale-105 group-hover/header:border-amber-400/80 transition-all duration-300 shrink-0">
            <Wrench className="w-6 h-6 text-amber-700 transition-transform duration-300 group-hover/header:scale-110" />
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>{t('corrective.title')}</span>
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 font-mono">
                Feuilles Rapport & Base
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono">
                {t('corrective.interventions_count', { count: interventions.length.toLocaleString() })}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
              {t('corrective.subtitle')}
            </p>
          </div>
        </div>

        {/* Right Column: Action Buttons on Top, Navigation Tabs Directly Below */}
        <div className="flex flex-col items-stretch sm:items-end gap-2.5 shrink-0 relative">
          {/* Top Row: Iconic 3D Circular Action Buttons */}
          <div className="flex items-center justify-end gap-2">
            {/* 3D Formula Circular Trigger Button */}
            <FormulasModalButton
              onClick={() => setShowFormulasModal(true)}
              title={t('corrective.buttons.formulas')}
            />

            {/* 3D Circular Nouvelle Demande DI Button */}
            <Action3DButton
              variant="circle"
              color="amber"
              icon={Flame}
              showAddBadge={true}
              onClick={() => {
                handleTabChange('corrective_di');
                setTriggerCreateDiModal(true);
              }}
              title={t('corrective.buttons.new_di')}
              ariaLabel={t('corrective.buttons.new_di')}
            />

            {/* 3D Circular Exporter Excel Button */}
            <Action3DButton
              variant="circle"
              color="emerald"
              icon={FileSpreadsheet}
              onClick={handleExportAllCorrective}
              title={t('corrective.buttons.export_excel')}
              ariaLabel="Exporter Excel"
            />

            {/* 3D Circular Reset Seed Button */}
            <Action3DButton
              variant="circle"
              color="slate"
              icon={RefreshCw}
              onClick={async () => {
                const result = await onResetToSeed?.({ machines });
                if (result?.cancelled) return;
                // Dictionaries only if interventions reset succeeded
                await onResetActionsToSeed?.();
                showToast?.(
                  `Correctif réinitialisé (${result?.restoredCount ?? (result?.items || []).length} interventions).` +
                    (result?.orphanCountAfter
                      ? ` ${result.orphanCountAfter} orpheline(s) possibles — Paramètres > Intégrité.`
                      : ''),
                  result?.orphanCountAfter ? 'warning' : 'success'
                );
              }}
              title={t('corrective.buttons.reset_seed')}
              ariaLabel="Réinitialiser données"
            />
          </div>

          {/* Bottom Row: Navigation SubTabs Container (5 Main Daily Operational Pages) */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-1.5 overflow-x-auto max-w-full">
            <div className="inline-flex items-center p-1 bg-slate-100/90 rounded-2xl border border-slate-200/90 shadow-2xs select-none max-w-full overflow-x-auto">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => handleTabChange(tab.id)}
                    className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap active:scale-95 ${
                      isActive
                        ? 'bg-white text-amber-950 shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-slate-200/60 font-black'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 border border-transparent'
                    }`}
                  >
                    <Icon
                      className={`w-3.5 h-3.5 shrink-0 transition-transform ${
                        tab.isPulsing
                          ? 'animate-pulse text-amber-600'
                          : isActive
                          ? 'text-amber-600 scale-105'
                          : 'text-slate-500'
                      }`}
                    />
                    <span>{tab.label}</span>
                    {tab.badge !== undefined && tab.badge > 0 && (
                      <span
                        className={`text-[10px] font-mono font-extrabold px-1.5 py-0.2 rounded-full shadow-2xs ${
                          isActive
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : tab.badgeColor || 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {tab.badge}
                      </span>
                    )}
                    {tab.isPulsing && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping inline-block" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Sub-Tab Dynamic Contents with Smooth Animated Transitions */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="w-full min-w-0"
        >
          {activeTab === 'corrective_di' && (
            <DemandesInterventionTab
              interventions={interventions}
              onAddDemande={onAddDemande}
              onConvertToBt={onConvertToBt}
              machines={machines}
              technicians={technicians}
              stockItems={stockItems}
              warehouseItems={warehouseItems}
              actionsByPanne={actionsByPanne}
              panneCategories={panneCategories}
              travauxAFaire={travauxAFaire}
              intervenants={intervenants}
              getActionsForPanne={getActionsForPanne}
              onAddActionForPanne={onAddActionForPanne}
              showToast={showToast}
              onNavigateToTab={handleTabChange}
              onAddDemandeWithPreset={handleAddDemandeWithPreset}
              autoOpenCreate={triggerCreateDiModal}
              onResetAutoOpen={() => setTriggerCreateDiModal(false)}
              presetData={diPresetData}
              onClearPreset={() => setDiPresetData(null)}
            />
          )}

          {activeTab === 'corrective_bt' && (
            <BonsTravailTab
              interventions={interventions}
              machines={machines}
              onStartLive={onStartLive}
              onUpdateIntervention={onUpdateIntervention}
              onNavigateToTab={handleTabChange}
              stockItems={stockItems}
              warehouseItems={warehouseItems}
              technicians={technicians}
              intervenants={intervenants}
              panneCategories={panneCategories}
              actionsByPanne={actionsByPanne}
              travauxAFaire={travauxAFaire}
              showToast={showToast}
            />
          )}

          {activeTab === 'corrective_live' && (
            <InterventionLiveTab
              interventions={interventions}
              machines={machines}
              technicians={technicians}
              activeLiveId={activeLiveId}
              setActiveLiveId={setActiveLiveId}
              onClotureIntervention={onClotureIntervention}
              onUpdateIntervention={onUpdateIntervention}
              onNavigateToTab={handleTabChange}
              stockItems={stockItems}
              warehouseItems={warehouseItems}
              onAddMouvement={onAddMouvement}
              actionsByPanne={actionsByPanne}
              travauxAFaire={travauxAFaire}
              getActionsForPanne={getActionsForPanne}
              onAddActionForPanne={onAddActionForPanne}
              showToast={showToast}
            />
          )}

          {activeTab === 'corrective_cloture' && (
            <ClotureRapportsTab
              interventions={interventions}
              machines={machines}
              stockItems={stockItems}
              warehouseItems={warehouseItems}
              technicians={technicians}
              onUpdateIntervention={onUpdateIntervention}
              showToast={showToast}
            />
          )}

          {activeTab === 'corrective_analyse' && (
            <AnalyseCorrectiveTab
              interventions={interventions}
              machines={machines}
              stockItems={stockItems}
              kpis={kpis}
              paretoAnomalies={paretoAnomalies}
              paretoMachines={paretoMachines}
              preventiveRecommendations={preventiveRecommendations}
              onNavigateToTab={handleTabChange}
              onAddPreventiveTask={onAddPreventiveTask}
              showToast={showToast}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Excel Formulas Documentation Modal */}
      <CorrectiveFormulasModal
        isOpen={showFormulasModal}
        onClose={() => setShowFormulasModal(false)}
      />
    </div>
  );
}
