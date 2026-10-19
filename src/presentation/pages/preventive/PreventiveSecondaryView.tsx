import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  BookOpen,
  Settings2,
  Wrench,
  Package,
  Calendar,
} from 'lucide-react';
import AnimatedPage from '../../components/common/AnimatedPage';
import Action3DButton from '../../components/common/Action3DButton';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import PreventiveService from '../../../application/services/PreventiveService';
import TabPlanBuilder from './components/TabPlanBuilder';
import TabGuide from './components/TabGuide';
import TabActions from './components/TabActions';
import { useI18n } from '../../../i18n/I18nContext';

export default function PreventiveSecondaryView({
  actions = [],
  guides = [],
  plans: _plans = [],
  onAddAction = null,
  onUpdateAction = null,
  onDeleteAction = null,
  onAddGuide = null,
  onUpdateGuide = null,
  onDeleteGuide = null,
  onCreatePlanWithTasks = null,
  onResetToBaseline: _onResetToBaseline = null,
  onClearPreventiveForRealFactory: _onClearPreventiveForRealFactory = null,
  machines = [],
  zones = [],
  technicians = [],
  stockItems = [],
  warehouseItems = [],
  blueprints = [],
  onNavigateToMainView,
  showToast,
  initialSubTab = 'BUILDER',
}) {
  const { t } = useI18n();
  // Active secondary sub-tab: 'BUILDER' | 'GUIDE' | 'ACTIONS'
  const [activeSubTab, setActiveSubTab] = useState(initialSubTab);

  // ==========================================
  // ACTIONS HANDLERS
  // ==========================================
  const handleAddAction = (actionData) => {
    if (onAddAction) {
      onAddAction(actionData);
    } else {
      PreventiveService.addAction(actionData);
    }
    if (showToast) showToast(`Action ${actionData.code} (${actionData.libelle}) créée avec succès !`, 'success');
  };

  const handleUpdateAction = (id, actionData) => {
    if (onUpdateAction) {
      onUpdateAction(id, actionData);
    } else {
      PreventiveService.updateAction(id, actionData);
    }
    if (showToast) showToast(`Action mise à jour avec succès !`, 'success');
  };

  const handleDeleteAction = (id) => {
    if (onDeleteAction) {
      onDeleteAction(id);
    } else {
      PreventiveService.deleteAction(id);
    }
    if (showToast) showToast(`Action supprimée.`, 'info');
  };

  // ==========================================
  // GUIDES HANDLERS
  // ==========================================
  const handleAddGuide = (guideData) => {
    if (onAddGuide) {
      onAddGuide(guideData);
    } else {
      PreventiveService.addGuide(guideData);
    }
    if (showToast) showToast(`Fiche guide pour ${guideData.composant_nom} créée !`, 'success');
  };

  const handleUpdateGuide = (id, guideData) => {
    if (onUpdateGuide) {
      onUpdateGuide(id, guideData);
    } else {
      PreventiveService.updateGuide(id, guideData);
    }
    if (showToast) showToast(`Fiche guide mise à jour !`, 'success');
  };

  const handleDeleteGuide = (id) => {
    if (onDeleteGuide) {
      onDeleteGuide(id);
    } else {
      PreventiveService.deleteGuide(id);
    }
    if (showToast) showToast(`Fiche guide supprimée.`, 'info');
  };

  // ==========================================
  // PLAN BUILDER HANDLER
  // ==========================================
  const handleCreatePlanWithTasks = (planData, taskItems) => {
    let result;
    if (onCreatePlanWithTasks) {
      result = onCreatePlanWithTasks(planData, taskItems);
    } else {
      result = PreventiveService.createPlanWithTasks(planData, taskItems);
    }
    
    if (showToast) {
      showToast(`Plan ${result?.plan?.code || planData.code} généré avec succès (${result?.tasks?.length || taskItems.length} tâches programmées) !`, 'success');
    }
    // Navigate to primary view to see the generated planning
    if (onNavigateToMainView) {
      onNavigateToMainView();
    }
  };

  // Quick stats calculation
  const totalActions = actions.length;
  const totalGuides = guides.length;
  const totalPdrLinked = guides.reduce((acc, g) => acc + (g.pieces_rechange?.length || 0), 0);

  return (
    <AnimatedPage>
      <div className="space-y-5">
        {/* 3D TACTILE SECONDARY HEADER CARD */}
        <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200/90 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 relative overflow-hidden group/secHeader">
          {/* Ambient Subtle Glow */}
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-purple-500/5 rounded-full blur-2xl pointer-events-none group-hover/secHeader:bg-purple-500/10 transition-colors duration-500" />

          {/* Left Side: Title & Description */}
          <div className="min-w-0 flex-1 flex items-start sm:items-center gap-3.5 relative">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500/10 via-indigo-500/10 to-transparent border border-purple-200/90 shadow-[0_4px_12px_rgba(168,85,247,0.12)] flex items-center justify-center text-purple-700 shrink-0">
              <Settings2 className="w-6 h-6 text-purple-700" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl font-black text-slate-900 tracking-tight">
                  {t('preventive.referentiel.title', 'Ingénierie & Référentiel Préventif (Page Secondaire)')}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-50 text-purple-800 border border-purple-200 shadow-2xs">
                  {t('preventive.referentiel.subtitle_badge', 'MODULES DE CONFIGURATION')}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
                {t('preventive.referentiel.subtitle', 'Configurez le concepteur de plans récurrents, le guide organe-action avec liaison PDR stock, et le catalogue des actions normalisées AFNOR.')}
              </p>
            </div>
          </div>

          {/* Right Side: Segmented Sub-Tabs Navigation & 3D Tactile Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0 relative w-full lg:w-auto">
            {/* Sub-tabs pills */}
            <div className="inline-flex items-center p-1 bg-slate-100/90 rounded-2xl border border-slate-200/90 shadow-2xs select-none w-full sm:w-auto overflow-x-auto">
              {/* SUB-TAB 1: CONCEPTEUR DE PLANS */}
              <button
                type="button"
                onClick={() => setActiveSubTab('BUILDER')}
                className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap flex-1 sm:flex-initial ${
                  activeSubTab === 'BUILDER'
                    ? 'bg-white text-emerald-950 shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 border border-transparent'
                }`}
              >
                <Sparkles className={`w-3.5 h-3.5 shrink-0 ${activeSubTab === 'BUILDER' ? 'text-emerald-600' : 'text-slate-500'}`} />
                <span>{t('preventive.referentiel.tab_builder', 'Concepteur de Plans')}</span>
              </button>

              {/* SUB-TAB 2: GUIDE ORGANES & PDR */}
              <button
                type="button"
                onClick={() => setActiveSubTab('GUIDE')}
                className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap flex-1 sm:flex-initial ${
                  activeSubTab === 'GUIDE'
                    ? 'bg-white text-purple-950 shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 border border-transparent'
                }`}
              >
                <BookOpen className={`w-3.5 h-3.5 shrink-0 ${activeSubTab === 'GUIDE' ? 'text-purple-600' : 'text-slate-500'}`} />
                <span>{t('preventive.referentiel.tab_guide', 'Guide & PDR')} ({totalGuides})</span>
              </button>

              {/* SUB-TAB 3: CATALOGUE ACTIONS */}
              <button
                type="button"
                onClick={() => setActiveSubTab('ACTIONS')}
                className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap flex-1 sm:flex-initial ${
                  activeSubTab === 'ACTIONS'
                    ? 'bg-white text-indigo-950 shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 border border-transparent'
                }`}
              >
                <Wrench className={`w-3.5 h-3.5 shrink-0 ${activeSubTab === 'ACTIONS' ? 'text-indigo-600' : 'text-slate-500'}`} />
                <span>{t('preventive.referentiel.tab_actions', 'Catalogue Actions')} ({totalActions})</span>
              </button>
            </div>

            {/* 3D Action Buttons */}
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              {onNavigateToMainView && (
                <Action3DButton
                  variant="circle"
                  color="indigo"
                  icon={Calendar}
                  onClick={onNavigateToMainView}
                  title="Retour à la Matrice & Planning Annuel"
                />
              )}
            </div>
          </div>
        </div>

        {/* QUICK SECONDARY KPI SUMMARY BAR */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-[0_4px_16px_rgba(0,0,0,0.04)] flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center font-black text-xs shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider truncate">{t('preventive.referentiel.stat_builder', 'Assistant Plan')}</p>
              <p className="text-xs font-black text-slate-800 truncate">{t('preventive.referentiel.stat_builder_desc', 'Génération Clé en Main')}</p>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-[0_4px_16px_rgba(0,0,0,0.04)] flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 flex items-center justify-center font-black text-xs shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider truncate">{t('preventive.referentiel.stat_guide', 'Fiches Guides')}</p>
              <p className="text-xs font-black text-slate-800 truncate">{t('preventive.referentiel.stat_guide_desc', '{{count}} Organes Métier', { count: totalGuides })}</p>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-[0_4px_16px_rgba(0,0,0,0.04)] flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center font-black text-xs shrink-0">
              <Package className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider truncate">{t('preventive.referentiel.stat_pdr', 'PDR Associées')}</p>
              <p className="text-xs font-black text-slate-800 truncate">{t('preventive.referentiel.stat_pdr_desc', '{{count}} Pièces au Stock', { count: totalPdrLinked })}</p>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-[0_4px_16px_rgba(0,0,0,0.04)] flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center font-black text-xs shrink-0">
              <Wrench className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider truncate">{t('preventive.referentiel.stat_actions', 'Actions AFNOR')}</p>
              <p className="text-xs font-black text-slate-800 truncate">{t('preventive.referentiel.stat_actions_desc', '{{count}} Codes Standards', { count: totalActions })}</p>
            </div>
          </div>
        </div>

        {/* SUB-VIEW TRANSITIONS */}
        <AnimatePresence mode="wait">
          {activeSubTab === 'BUILDER' && (
            <motion.div
              key="sec-tab-builder"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              <ErrorBoundary sectionName="Concepteur de Plans Récurrents">
                <TabPlanBuilder
                  machines={machines}
                  zones={zones}
                  technicians={technicians}
                  guides={guides}
                  actions={actions}
                  stockItems={stockItems}
                  warehouseItems={warehouseItems}
                  blueprints={blueprints}
                  onCreatePlanWithTasks={handleCreatePlanWithTasks}
                  onNavigateToMainView={onNavigateToMainView}
                />
              </ErrorBoundary>
            </motion.div>
          )}

          {activeSubTab === 'GUIDE' && (
            <motion.div
              key="sec-tab-guide"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              <ErrorBoundary sectionName="Fiches Guides & PDR Métier">
                <TabGuide
                  guides={guides}
                  actions={actions}
                  stockItems={stockItems}
                  warehouseItems={warehouseItems}
                  onAddGuide={handleAddGuide}
                  onUpdateGuide={handleUpdateGuide}
                  onDeleteGuide={handleDeleteGuide}
                />
              </ErrorBoundary>
            </motion.div>
          )}

          {activeSubTab === 'ACTIONS' && (
            <motion.div
              key="sec-tab-actions"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              <ErrorBoundary sectionName="Catalogue des Actions AFNOR">
                <TabActions
                  actions={actions}
                  onAddAction={handleAddAction}
                  onUpdateAction={handleUpdateAction}
                  onDeleteAction={handleDeleteAction}
                />
              </ErrorBoundary>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AnimatedPage>
  );
}
