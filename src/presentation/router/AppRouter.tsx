import { Suspense } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import ErrorBoundary from '../components/common/ErrorBoundary';
import LoadingSkeleton from '../components/common/LoadingSkeleton';
import usePageOrchestrator from '../components/common/usePageOrchestrator';

import DashboardView from '../pages/dashboard/DashboardView';
import MonthlyExecutiveReportView from '../components/views/MonthlyExecutiveReportView';
import StockView from '../pages/stock/StockView';
import TypeView from '../pages/referentiel/TypeView';
import DesignationView from '../pages/referentiel/DesignationView';
import MachinesRegisteredView from '../pages/machines/MachinesRegisteredView';
import EntrepotView from '../pages/warehouse/EntrepotView';
import CompGroupView from '../pages/referentiel/CompGroupView';
import CompFamilyView from '../pages/referentiel/CompFamilyView';
import CompTemplateView from '../pages/referentiel/CompTemplateView';
import PartTypeView from '../pages/referentiel/PartTypeView';
import PartDesignationView from '../pages/referentiel/PartDesignationView';
import FamilyView from '../pages/machines/FamilyView';
import TemplatesView from '../pages/machines/TemplatesView';
import BlueprintMachineView from '../pages/machines/BlueprintMachineView';
import ZonesView from '../pages/referentiel/ZonesView';
import UtilisateursView from '../pages/utilisateurs/UtilisateursView';
import SortieRapideView from '../pages/movements/SortieRapideView';
import SettingsView from '../pages/settings/SettingsView';
import NexusView from '../pages/system/NexusView';
import GuideView from '../pages/system/GuideView';
import PreventiveView from '../pages/preventive/PreventiveView';
import PreventiveSecondaryView from '../pages/preventive/PreventiveSecondaryView';
import CorrectiveView from '../pages/corrective/CorrectiveView';
import CatalogueDonneesView from '../pages/corrective/CatalogueDonneesView';

import {
  PreventiveContext,
  SortieExterneContext,
  StockContext,
  WarehouseContext,
  MachinesContext,
  CorrectiveContext,
} from '../../context/GmaoDomainContext';
import { useAuth } from '../../context/AuthContext';
import { AuthorizationService } from '../../core/security/AuthorizationService';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export default function AppRouter({
  currentTab, setCurrentTab: _setCurrentTab, props
}) {
  const { user: currentUser } = useAuth();
  // Page load orchestrator: manages per-tab first load skeletons and instant visited transitions
  const { isCurrentTabLoading } = usePageOrchestrator(currentTab);

  const isTabAllowed = !currentUser || AuthorizationService.canAccessTab(currentUser, currentTab);

  return (
    <StockContext.Provider value={props.stock}>
      <WarehouseContext.Provider value={props.entrepot}>
        <MachinesContext.Provider value={props.machines}>
          <PreventiveContext.Provider value={props.preventive}>
            <SortieExterneContext.Provider value={props.sortie}>
              <CorrectiveContext.Provider value={props.corrective}>
                <div className="w-full min-w-0 relative">
                {!isTabAllowed ? (
                  <div className="max-w-xl mx-auto my-12 p-6 sm:p-8 rounded-3xl bg-white border border-amber-200 shadow-lg text-center space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto">
                      <ShieldAlert className="w-7 h-7" />
                    </div>
                    <div className="space-y-1.5">
                      <h2 className="text-lg font-black text-slate-900 tracking-tight">
                        Accès Restreint par Rôle (RBAC)
                      </h2>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Votre profil actuel (<span className="font-bold text-slate-900">{currentUser?.titleFr || currentUser?.role}</span>) ne dispose pas des privilèges requis pour accéder à la section <code className="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-slate-800">{currentTab}</code>.
                      </p>
                    </div>
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => _setCurrentTab('dashboard')}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs transition cursor-pointer"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Retour au Tableau de Bord</span>
                      </button>
                    </div>
                  </div>
                ) : (
                <AnimatePresence mode="wait">
                  {isCurrentTabLoading ? (
                    <motion.div
                      key={`skel-${currentTab}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.16, ease: 'easeOut' }}
                      className="w-full min-w-0"
                    >
                      <LoadingSkeleton currentTab={currentTab} />
                    </motion.div>
                  ) : (
                    <Suspense fallback={<LoadingSkeleton currentTab={currentTab} />}>
                      <div
                        key={`view-${currentTab}`}
                        className="w-full min-w-0"
                      >
                      {currentTab === 'dashboard' && (
                        <ErrorBoundary sectionName="Tableau de Bord Operations">
                          <DashboardView {...props.dashboard} />
                        </ErrorBoundary>
                      )}

                      {currentTab === 'executive_report' && (
                        <ErrorBoundary sectionName="Rapport Mensuel Exécutif (Direction)">
                          <MonthlyExecutiveReportView {...props.executiveReport} />
                        </ErrorBoundary>
                      )}

                      {currentTab === 'stock' && (
                        <ErrorBoundary sectionName="Gestion de Stock & PDR">
                          <StockView {...props.stock} />
                        </ErrorBoundary>
                      )}

                      {currentTab === 'sortie' && (
                        <ErrorBoundary sectionName="Saisie Directe & Sortie Rapide">
                          <SortieRapideView {...props.sortie} />
                        </ErrorBoundary>
                      )}

                      {currentTab === 'entrepot' && (
                        <ErrorBoundary sectionName="Magasin & Entrepôt Réserve">
                          <EntrepotView {...props.entrepot} />
                        </ErrorBoundary>
                      )}

                      {currentTab === 'types' && (
                        <ErrorBoundary sectionName="Référentiel Types d'Équipements">
                          <TypeView {...props.types} />
                        </ErrorBoundary>
                      )}

                      {currentTab === 'designations' && (
                        <ErrorBoundary sectionName="Référentiel Désignations & Diagnostic">
                          <DesignationView {...props.designations} />
                        </ErrorBoundary>
                      )}

                      {currentTab === 'machines' && (
                        <ErrorBoundary sectionName="Parc Machines Enregistrées">
                          <MachinesRegisteredView {...props.machines} />
                        </ErrorBoundary>
                      )}

                      {currentTab === 'preventive' && (
                        <ErrorBoundary sectionName="Planning & Matrice Préventive">
                          <PreventiveView {...props.preventive} />
                        </ErrorBoundary>
                      )}

                      {currentTab === 'preventive_referentiel' && (
                        <ErrorBoundary sectionName="Ingénierie & Référentiel Préventif">
                          <PreventiveSecondaryView {...props.preventiveReferentiel} />
                        </ErrorBoundary>
                      )}

                      {currentTab === 'comp_groups' && (
                        <ErrorBoundary sectionName="Groupes d'Organes">
                          <CompGroupView {...props.compGroups} />
                        </ErrorBoundary>
                      )}

                      {currentTab === 'comp_families' && (
                        <ErrorBoundary sectionName="Familles d'Organes">
                          <CompFamilyView {...props.compFamilies} />
                        </ErrorBoundary>
                      )}

                      {currentTab === 'comp_templates' && (
                        <ErrorBoundary sectionName="Modèles d'Organes">
                          <CompTemplateView {...props.compTemplates} />
                        </ErrorBoundary>
                      )}

                      {currentTab === 'part_types' && (
                        <ErrorBoundary sectionName="Types de Pièces Détachées">
                          <PartTypeView {...props.partTypes} />
                        </ErrorBoundary>
                      )}

                      {currentTab === 'part_designations' && (
                        <ErrorBoundary sectionName="Désignations Pièces Détachées">
                          <PartDesignationView {...props.partDesignations} />
                        </ErrorBoundary>
                      )}

                      {currentTab === 'families' && (
                        <ErrorBoundary sectionName="Familles de Machines">
                          <FamilyView {...props.families} />
                        </ErrorBoundary>
                      )}

                      {currentTab === 'templates' && (
                        <ErrorBoundary sectionName="Modèles de Machines">
                          <TemplatesView {...props.templates} />
                        </ErrorBoundary>
                      )}

                      {currentTab === 'blueprints' && (
                        <ErrorBoundary sectionName="Plans d'Arborescence Machines">
                          <BlueprintMachineView {...props.blueprints} />
                        </ErrorBoundary>
                      )}

                      {currentTab === 'zones' && (
                        <ErrorBoundary sectionName="Référentiel Zones & Seteur">
                          <ZonesView {...props.zones} />
                        </ErrorBoundary>
                      )}

                      {currentTab === 'utilisateurs' && (
                        <ErrorBoundary sectionName="Gestion des Utilisateurs">
                          <UtilisateursView {...props.utilisateurs} />
                        </ErrorBoundary>
                      )}

                      {currentTab === 'settings' && (
                        <ErrorBoundary sectionName="Paramètres & Sauvegardes">
                          <SettingsView {...props.settings} />
                        </ErrorBoundary>
                      )}

                      {currentTab === 'nexus' && (
                        <ErrorBoundary sectionName="Nexus Assistant IA">
                          <NexusView {...props.nexus} />
                        </ErrorBoundary>
                      )}

                      {currentTab === 'guide' && (
                        <ErrorBoundary sectionName="Manuel & Guide Utilisateur">
                          <GuideView {...props.guide} />
                        </ErrorBoundary>
                      )}

                      {currentTab === 'corrective_referentiel' && (
                        <ErrorBoundary sectionName="Catalogue & Données GMAO (الكواليس)">
                          <CatalogueDonneesView
                            {...props.corrective}
                            onNavigateToTab={_setCurrentTab}
                            onNavigateBack={() => _setCurrentTab('corrective')}
                          />
                        </ErrorBoundary>
                      )}

                      {(currentTab === 'corrective' || (currentTab.startsWith('corrective_') && currentTab !== 'corrective_referentiel')) && (
                        <ErrorBoundary sectionName="Maintenance Corrective Nexus">
                          <CorrectiveView
                            {...props.corrective}
                            subTab={currentTab === 'corrective' ? 'corrective_di' : currentTab}
                            onSubTabChange={_setCurrentTab}
                          />
                        </ErrorBoundary>
                      )}
                      </div>
                    </Suspense>
                  )}
                </AnimatePresence>
                )}
              </div>
              </CorrectiveContext.Provider>
            </SortieExterneContext.Provider>
          </PreventiveContext.Provider>
        </MachinesContext.Provider>
      </WarehouseContext.Provider>
    </StockContext.Provider>
  );
}
