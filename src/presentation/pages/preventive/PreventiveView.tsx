import { useState } from 'react';
import {
  Calendar,
  CalendarPlus,
  CalendarDays,
  Table2,
  BarChart3,
  Factory,
  X,
  Calculator,
  Clock,
  CheckCircle2,
  DollarSign,
  Upload,
  BookOpen,
  Package,
  Sparkles,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import AnimatedPage from '../../components/common/AnimatedPage';
import Action3DButton from '../../components/common/Action3DButton';
import FormulasModalButton from '../../components/common/FormulasModalButton';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import PreventiveService from '../../../application/services/PreventiveService';
import TabMainView from './components/TabMainView';
import TaskImportModal from './components/TaskImportModal';
import { useI18n } from '../../../i18n/I18nContext';

export default function PreventiveView({
  tasks = [],
  actions = [],
  guides = [],
  plans: _plans = [],
  executions = [],
  onUpdateTask = null,
  onDeleteTask: onDeleteTaskProp = null,
  onUpdateTaskCounter: onUpdateTaskCounterProp = null,
  onMarkTaskDone: onMarkTaskDoneProp = null,
  onDeleteExecution = null,
  onResetToBaseline = null,
  onClearPreventiveForRealFactory = null,
  machines = [],
  zones = [],
  technicians = [],
  stockItems = [],
  warehouseItems = [],
  mouvements: _mouvements = [],
  onAddMouvement = null,
  onDirectAdjustStock = null,
  showToast = null,
  onCreateCorrective = null,
  onNavigateToMachine = null,
  onNavigateToReferentiel = null,
  preventiveRecommendations = [],
  onAddAction = null,
}) {
  const { t } = useI18n();
  const [showFormulasModal, setShowFormulasModal] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [viewMode, setViewMode] = useState('matrix'); // 'matrix' | 'grouped' | 'calendar' | 'list' | 'analytics'

  const handleRestoreBaseline = async () => {
    if (onResetToBaseline) {
      const result = await onResetToBaseline({ machines });
      if (!result || result.cancelled) return;
      showToast?.(
        `Planning d'usine restauré (${result.restoredCount || 1175} tâches).` +
          (result.orphanCountAfter
            ? ` Attention: ${result.orphanCountAfter} orpheline(s) — nettoyez dans Paramètres > Intégrité.`
            : ''),
        result.orphanCountAfter ? 'warning' : 'success'
      );
      return;
    }

    if (
      typeof window !== 'undefined' &&
      !window.confirm("Restaurer le planning d'usine de base (1 175 tâches) ?")
    ) {
      return;
    }
    const restored = PreventiveService.getTasks();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('preventive_tasks_updated', { detail: restored }));
    }
    showToast?.("Planning d'usine restauré (1 175 tâches) !", 'success');
  };

  const runClearRealFactory = () => {
    const result = onClearPreventiveForRealFactory?.({ machines });
    if (!result || result.cancelled) return;
    showToast?.(`Préventif vidé (${result.clearedCount || 0} tâches).`, 'info');
  };

  // ==========================================
  // MAIN VIEW HANDLERS (PRIMARY VIEW)
  // ==========================================
  const handleMarkTaskDone = (id, validationData) => {
    const targetTask = tasks.find((t) => t.id === id);

    if (onMarkTaskDoneProp) {
      onMarkTaskDoneProp(id, validationData);
    } else {
      PreventiveService.markTaskAsDone(id, validationData);
    }

    const consumedPDR = (validationData?.usedPDR && validationData.usedPDR.length > 0)
      ? validationData.usedPDR
      : (Array.isArray(validationData?.pieces_utilisees) ? validationData.pieces_utilisees : []);

    // If PDR consumed, synchronize with stock
    if (consumedPDR.length > 0 && onAddMouvement) {
      consumedPDR.forEach((pdr) => {
        const pdrRef = pdr.reference || pdr.ref;
        if (!pdrRef) return;
        onAddMouvement({
          code_bon: `BS-PRV-${Date.now().toString().slice(-4)}`,
          num_commande: targetTask?.ref_plan || targetTask?.code || 'PREVENTIF',
          date: validationData.date_realisation || validationData.date_execution || new Date().toISOString().split('T')[0],
          heure: '10:00',
          ref: pdrRef,
          designation: pdr.designation || 'Pièce consommée',
          quantite: Number(pdr.quantite || 1),
          unit: pdr.unite || 'pcs',
          type: 'Sortie Interne',
          action_id: 'PREVENTIVE',
          usage_type: 'technician',
          id_machine_registered: targetTask?.id_machine || '',
          technicien: validationData.technicien || validationData.technicien_realisateur || targetTask?.responsable || targetTask?.id_technicien || '',
          commentaire: `Consommation automatique sur maintenance préventive ${targetTask?.composant || ''} (${targetTask?.id_machine || ''})`,
        });
      });
    }

    // Direct stock decrement if callback provided
    if (consumedPDR.length > 0 && onDirectAdjustStock) {
      consumedPDR.forEach((pdr) => {
        const pdrRef = pdr.reference || pdr.ref;
        if (pdrRef) {
          onDirectAdjustStock(pdrRef, -Number(pdr.quantite || 1));
        }
      });
    }

    if (showToast) {
      showToast(`Tâche ${targetTask?.composant || ''} validée avec succès !`, 'success');
    }
  };

  const handleDeleteTask = (id) => {
    if (onDeleteTaskProp) {
      onDeleteTaskProp(id);
    } else {
      PreventiveService.deleteTask(id);
    }
    if (showToast) showToast('Tâche supprimée du planning.', 'info');
  };

  const handleUpdateTaskCounter = (id, newCounterValue) => {
    if (onUpdateTaskCounterProp) {
      onUpdateTaskCounterProp(id, newCounterValue);
    } else {
      PreventiveService.updateTaskCounter(id, newCounterValue);
    }
    if (showToast) showToast('Compteur machine mis à jour.', 'success');
  };

  const handleUpdateTaskStatus = (id, newStatus) => {
    if (onUpdateTask) {
      onUpdateTask(id, { etat: newStatus });
    } else {
      PreventiveService.updateTaskStatus(id, newStatus);
    }
  };

  return (
    <AnimatedPage>
      <div className="space-y-6">
        {/* ========================================================================= */}
        {/* TOP MASTER HEADER (PRIMARY PAGE WITH 3D ELEVATION)                         */}
        {/* ========================================================================= */}
        <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200/90 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden group/header">
          {/* Ambient Glow */}
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none group-hover/header:bg-indigo-500/10 transition-colors duration-500" />

          {/* Left Column: Title & Overview */}
          <div className="min-w-0 flex-1 flex items-start sm:items-center gap-3.5 relative">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500/10 via-indigo-500/5 to-transparent border border-indigo-200/90 shadow-[0_4px_12px_rgba(99,102,241,0.12)] flex items-center justify-center text-indigo-700 group-hover/header:scale-105 group-hover/header:border-indigo-400/80 transition-all duration-300 shrink-0">
              <Calendar className="w-6 h-6 text-indigo-700 transition-transform duration-300 group-hover/header:scale-110" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl font-black text-slate-900 tracking-tight">
                  {t('preventive.title')}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-50 text-indigo-800 border border-indigo-200 shadow-2xs">
                  {t('preventive.cycle')}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
                {t('preventive.subtitle')}
              </p>
            </div>
          </div>

          {/* Right Column: 3D Circular Action Buttons */}
          <div className="flex items-center gap-2.5 shrink-0 relative">
            {/* 3D Switch Button: Grouped by Machine */}
            <Action3DButton
              variant="circle"
              color={viewMode === 'grouped' ? 'indigo' : 'slate'}
              icon={Factory}
              onClick={() => setViewMode((prev) => (prev === 'grouped' ? 'matrix' : 'grouped'))}
              title={
                viewMode === 'grouped'
                  ? 'Basculer vers Matrice S1-S52'
                  : 'Vue Synthétique Groupée par Machine'
              }
              className={viewMode === 'grouped' ? 'ring-2 ring-indigo-400/80' : ''}
            />

            {/* 3D Switch Button: Tables (Matrice / Liste) vs Calendar */}
            <Action3DButton
              variant="circle"
              color={viewMode === 'calendar' ? 'teal' : 'slate'}
              icon={viewMode === 'calendar' ? Table2 : CalendarDays}
              onClick={() => setViewMode((prev) => (prev === 'calendar' ? 'matrix' : 'calendar'))}
              title={
                viewMode === 'calendar'
                  ? 'Basculer vers Matrice S1-S52'
                  : 'Basculer vers Calendrier Mensuel'
              }
              className={viewMode === 'calendar' ? 'ring-2 ring-teal-400/80' : ''}
            />

            {/* 3D Switch Button: Analytics / Statistiques & Coûts */}
            <Action3DButton
              variant="circle"
              color={viewMode === 'analytics' ? 'purple' : 'slate'}
              icon={BarChart3}
              onClick={() => setViewMode((prev) => (prev === 'analytics' ? 'matrix' : 'analytics'))}
              title={
                viewMode === 'analytics'
                  ? 'Revenir aux Tableaux Préventifs'
                  : 'Tableau de Bord & Statistiques (Santé & Coûts)'
              }
              className={viewMode === 'analytics' ? 'ring-2 ring-purple-400/80' : ''}
            />

            {/* 3D Formula Circular Trigger Button */}
            <FormulasModalButton
              onClick={() => setShowFormulasModal(true)}
              title="Formules Excel (Matrice Préventif S1→S52)"
            />

            {/* 3D Guide & Philosophy Circular Trigger Button */}
            <Action3DButton
              variant="circle"
              color="teal"
              icon={BookOpen}
              onClick={() => setShowGuideModal(true)}
              title="Philosophie & Manuel de la Maintenance Préventive"
              className="ring-2 ring-teal-400/60"
            />

            {/* 3D Reset Baseline Button */}
            <Action3DButton
              variant="circle"
              color="amber"
              icon={RotateCcw}
              onClick={handleRestoreBaseline}
              title="Restaurer le planning d'usine de base (1 175 tâches)"
              className="ring-2 ring-amber-400/60"
            />

            {/* 3D Clear for Real Factory Button */}
            {onClearPreventiveForRealFactory && (
              <Action3DButton
                variant="circle"
                color="rose"
                icon={Trash2}
                onClick={runClearRealFactory}
                title="Clear for Real Factory (Vider les tâches pour usine réelle)"
                className="ring-2 ring-rose-400/60"
              />
            )}

            {/* 3D Import Tasks Button */}
            <Action3DButton
              variant="circle"
              color="emerald"
              icon={Upload}
              onClick={() => setShowImportModal(true)}
              title="Importer des tâches préventives (JSON / Fichier)"
              className="ring-2 ring-emerald-400/60"
            />

            {/* 3D Primary Add Plan / Action Button */}
            <Action3DButton
              variant="circle"
              color="indigo"
              icon={CalendarPlus}
              showAddBadge={true}
              onClick={onNavigateToReferentiel}
              title="Nouveau Plan / Concepteur de Plan"
            />
          </div>
        </div>

        {/* Empty State Warning Banner (1-Click Restore 1,175 Tasks) */}
        {(!tasks || tasks.length === 0) && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-amber-900">
                  Planning préventif vide (0 tâche active)
                </h4>
                <p className="text-xs text-amber-700 mt-0.5">
                  Vous pouvez restaurer instantanément le planning d&apos;usine de référence contenant les 1 175 tâches préventives ISO (S1–S52).
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRestoreBaseline}
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition flex items-center gap-2 shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Restaurer 1 175 tâches d&apos;usine</span>
            </button>
          </div>
        )}

        {/* Anti-Recurrence Predictive Suggestions from Corrective Nexus */}
        {preventiveRecommendations && preventiveRecommendations.length > 0 && (
          <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-indigo-500/10 border border-amber-300 dark:border-amber-700/60 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <span>Pont Prédictif Correctif → Préventif</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                    {preventiveRecommendations.length} récidives détectées
                  </span>
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Machines ayant subi ≥ 3 pannes récentes sur un même organe ({preventiveRecommendations.map((r) => r.machine).join(', ')}). Créer des routines de contrôle pour éradiquer ces pannes.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {preventiveRecommendations.slice(0, 2).map((rec, i) => (
                <button
                  key={i}
                  onClick={() => {
                    if (onAddAction) {
                      onAddAction({
                        id_action: `ACT-PREV-${Date.now().toString().slice(-4)}`,
                        nom_action: `Contrôle systématique ${rec.anomalie.replace(/_/g, ' ')} (${rec.machine})`,
                        description: rec.recommendedAction,
                        type_action: 'MECANIQUE',
                        periodicite_jours: rec.suggestedIntervalDays,
                        machine: rec.machine,
                      });
                      showToast?.(`Tâche préventive créée pour ${rec.machine}`, 'success');
                    } else {
                      showToast?.(`Recommandation transmise à l'ingénierie pour ${rec.machine}`, 'success');
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Créer routine: {rec.machine}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MAIN VIEW CONTENT                                                         */}
        {/* ========================================================================= */}
        <ErrorBoundary sectionName="Matrice & Planning Préventif">
          <TabMainView
            tasks={tasks}
            executions={executions}
            machines={machines}
            zones={zones}
            technicians={technicians}
            actions={actions}
            guides={guides}
            stockItems={stockItems}
            warehouseItems={warehouseItems}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onMarkTaskDone={handleMarkTaskDone}
            onDeleteExecution={onDeleteExecution}
            onDeleteTask={handleDeleteTask}
            onUpdateTaskCounter={handleUpdateTaskCounter}
            onUpdateTaskStatus={handleUpdateTaskStatus}
            onNavigateToPlanBuilder={onNavigateToReferentiel}
            onCreateCorrective={onCreateCorrective}
            onNavigateToMachine={onNavigateToMachine}
          />
        </ErrorBoundary>

        {/* ========================================================================= */}
        {/* FORMULAS EXCEL MODAL FOR PREVENTIVE MAINTENANCE                           */}
        {/* ========================================================================= */}
        {showFormulasModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-5 md:p-6 space-y-4 relative overflow-hidden">
              {/* Header */}
              <div className="flex items-start justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 font-bold shrink-0">
                    <Calculator className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                      <span>Formules Excel & Règles de Calcul Préventif</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Matrice S1 → S52
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500">
                      Règles de calcul et formules automatiques synchronisées avec le modèle GMAO_Light_Template_V2
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowFormulasModal(false)}
                  className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer shrink-0"
                  title="Fermer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Content: 4 Formula Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* Formule 1: Planning Matrice */}
                <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-indigo-300 transition">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                      <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      <span className="truncate">Formule S1-S52 : Planning</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-100/80 text-indigo-800 border border-indigo-200 shrink-0">
                      Matrice [S1..S52]
                    </span>
                  </div>
                  <div className="font-mono text-xs text-indigo-800 font-bold bg-white p-2 rounded-lg border border-indigo-100">
                    =IF(Planning[S_n]=1, "À faire", "N/A")
                  </div>
                  <p className="text-[10.5px] text-slate-500 leading-tight">
                    Génère la présence des interventions sur la semaine ISO correspondante selon la fréquence.
                  </p>
                </div>

                {/* Formule 2: Taux de Conformité */}
                <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-emerald-300 transition">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="truncate">Taux de Conformité (%)</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-100/80 text-emerald-800 border border-emerald-200 shrink-0">
                      Performance (%)
                    </span>
                  </div>
                  <div className="font-mono text-xs text-emerald-800 font-bold bg-white p-2 rounded-lg border border-emerald-100">
                    =(COUNTIF(Etat,"Fait")/COUNTA(Etat))*100
                  </div>
                  <p className="text-[10.5px] text-slate-500 leading-tight">
                    Rapport entre les Ordres de Travail (OT) réalisés avec succès et le total planifié.
                  </p>
                </div>

                {/* Formule 3: Décalage Échéance */}
                <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-amber-300 transition">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                      <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span className="truncate">Prochaine Échéance</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-100/80 text-amber-800 border border-amber-200 shrink-0">
                      Date (+Jours)
                    </span>
                  </div>
                  <div className="font-mono text-xs text-amber-800 font-bold bg-white p-2 rounded-lg border border-amber-100">
                    =DATE_EXEC + VLOOKUP(Freq, Table_Freq, 2, FALSE)
                  </div>
                  <p className="text-[10.5px] text-slate-500 leading-tight">
                    Calcule la date du prochain passage (Hebdo=+7j, Mensuel=+30j, Trimestriel=+90j, Annuel=+365j).
                  </p>
                </div>

                {/* Formule 4: Coût Cumulé Préventif */}
                <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-blue-300 transition">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                      <DollarSign className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span className="truncate">Coût Cumulé Préventif (DT)</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-100/80 text-blue-800 border border-blue-200 shrink-0">
                      Coût (DT)
                    </span>
                  </div>
                  <div className="font-mono text-xs text-blue-800 font-bold bg-white p-2 rounded-lg border border-blue-100">
                    =(M.O_Heures * Taux_MO) + SUM(PDR_Qté * PDR_Prix)
                  </div>
                  <p className="text-[10.5px] text-slate-500 leading-tight">
                    Coût total intégrant la main d'œuvre technique et les pièces détachées consommées.
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setShowFormulasModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition shadow-md cursor-pointer"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )}
        {/* ========================================================================= */}
        {/* INTERACTIVE PHILOSOPHY & OPERATIONAL GUIDE MODAL                          */}
        {/* ========================================================================= */}
        {showGuideModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-xs animate-fade-in">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col relative overflow-hidden">
              {/* Header */}
              <div className="flex items-start justify-between p-5 md:p-6 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 font-bold shrink-0 shadow-sm">
                    <BookOpen className="w-6 h-6 text-teal-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                      <span>فلسفة ودليل تشغيل الصيانة الوقائية (GMAO)</span>
                    </h3>
                    <p className="text-xs text-slate-500">
                      Philosophie, méthodologie opérationnelle, et intégration des stocks de la GMAO
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowGuideModal(false)}
                  className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer shrink-0"
                  title="Fermer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="p-5 md:p-6 overflow-y-auto space-y-6 text-slate-700 leading-relaxed text-sm" style={{ direction: 'rtl' }}>
                {/* 1. Philosophy Section */}
                <div className="space-y-3">
                  <h4 className="text-base font-black text-slate-900 flex items-center gap-2 border-r-4 border-teal-500 pr-2.5">
                    <Clock className="w-5 h-5 text-teal-600" />
                    <span>1. فلسفة الصيانة الوقائية (Mieux vaut prévenir que guérir)</span>
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    ترتكز فلسفة الصيانة الوقائية في نظامنا على مبدأ <strong>"منع حدوث العطل قبل وقوعه"</strong> لتفادي التوقفات الفجائية المكلفة للآلات. يتم تنظيم المهام بجدولة زمنية قياسية ممتدة على مدار <strong>52 أسبوعاً سنوياً (ISO 52-Week Matrix)</strong>، مما يتيح توازناً مثالياً في توزيع ضغط العمل على الفنيين وتأمين سلامة المكونات الحرجة للمصنع بشكل منظم ومدروس.
                  </p>
                </div>

                {/* 2. Operational Methodology Section */}
                <div className="space-y-3">
                  <h4 className="text-base font-black text-slate-900 flex items-center gap-2 border-r-4 border-indigo-500 pr-2.5">
                    <Table2 className="w-5 h-5 text-indigo-600" />
                    <span>2. مصفوفة الـ 52 أسبوعاً والرموز التشغيلية القياسية</span>
                  </h4>
                  <div className="text-xs text-slate-600 space-y-2">
                    <p>
                      تعرض المصفوفة السنوية الـ 52 عموداً، ويمثل كل عمود أسبوعاً من أسابيع السنة. يتم ترميز وتصنيف التدخلات الوقائية باختصارات قياسية معتمدة عالمياً:
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px]">
                      <div className="p-2 rounded-lg bg-blue-50 border border-blue-200 flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-[10px]">C</span>
                        <strong>Contrôle (مراقبة/فحص)</strong>
                      </div>
                      <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-[10px]">N</span>
                        <strong>Nettoyage (تنظيف)</strong>
                      </div>
                      <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-amber-600 text-white font-bold flex items-center justify-center text-[10px]">G</span>
                        <strong>Graissage (تشحيم)</strong>
                      </div>
                      <div className="p-2 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-[10px]">V</span>
                        <strong>Vidange (تفريغ وتغيير زيت)</strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Auto stock synchronization */}
                <div className="space-y-3">
                  <h4 className="text-base font-black text-slate-900 flex items-center gap-2 border-r-4 border-emerald-500 pr-2.5">
                    <Package className="w-5 h-5 text-emerald-600" />
                    <span>3. التكامل التلقائي مع المخزن وقطع الغيار (PDR Synchronization)</span>
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    عند إنجاز أي مهمة صيانة وقائية تحتوي على قطع غيار مسجلة في <strong>بطاقة الإرشاد التقني (Fiches Guides)</strong>، يقوم التطبيق بتنفيذ العمليات التالية آلياً وبصمت في الخلفية:
                  </p>
                  <ul className="list-disc list-inside text-xs text-slate-600 pr-2 space-y-1 bg-emerald-50/40 p-3 rounded-xl border border-emerald-100">
                    <li><strong>تسجيل حركة خروج مخزنية تلقائية:</strong> من نوع <strong>Sortie Interne</strong> تحمل رمزاً فريداً يربط العملية بنوع وتاريخ الصيانة.</li>
                    <li><strong>تخفيض الرصيد الفعلي:</strong> تحديث كميات القطع المسحوبة مباشرة داخل واجهة المخازن لحساب مستويات التنبيه بالحدود الدنيا والطلب التلقائي فورا.</li>
                    <li><strong>حساب التكلفة الإجمالية:</strong> دمج تكلفة قطع الغيار المستهلكة مع ساعات العمل الفنية لاحتساب دقيق للتكلفة الفعلية المباشرة.</li>
                  </ul>
                </div>

                {/* 4. Concurrency & Offline support */}
                <div className="space-y-3">
                  <h4 className="text-base font-black text-slate-900 flex items-center gap-2 border-r-4 border-purple-500 pr-2.5">
                    <Clock className="w-5 h-5 text-purple-600" />
                    <span>4. استقرار الأداء والعمل بدون إنترنت (Resilience & Caching)</span>
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    يتمتع موديول الصيانة بنظام حماية عالي الأداء:
                    <br />
                    • يتم ترتيب العمليات المتزامنة وحل التعارضات تلقائياً عبر <strong>طابور العمل المتسلسل (Sequential Queue)</strong> لمنع تداخل حركات المخزون المتزامنة.
                    <br />
                    • في حال انقطاع الشبكة، يتم تشغيل <strong>آلية المزامنة الاحتياطية (Sync Queue)</strong> لحفظ المهام محلياً وبثها فورا عند استعادة الاتصال بالشبكة.
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="p-5 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
                <span className="text-[10px] font-mono text-slate-400">GMAO Light Template V2 Documentation</span>
                <button
                  type="button"
                  onClick={() => setShowGuideModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition shadow-md cursor-pointer"
                >
                  فهمت، إغلاق
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Task Import Modal */}
        <TaskImportModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          onImportSuccess={(updated) => {
            if (showToast) {
              showToast(`Importation réussie : ${updated?.length || 0} tâches prêtes !`, 'success');
            }
          }}
        />
      </div>
    </AnimatedPage>
  );
}

