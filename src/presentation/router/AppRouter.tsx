import { Suspense } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import ErrorBoundary from '../components/common/ErrorBoundary';
import LoadingSkeleton from '../components/common/LoadingSkeleton';
import usePageOrchestrator from '../components/common/usePageOrchestrator';

import DashboardView from '../pages/dashboard/DashboardView';
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

export default function AppRouter({
  currentTab, setCurrentTab: _setCurrentTab, props
}) {
  // Page load orchestrator: manages per-tab first load skeletons and instant visited transitions
  const { isCurrentTabLoading } = usePageOrchestrator(currentTab);

  return (
    <StockContext.Provider value={props.stock}>
      <WarehouseContext.Provider value={props.entrepot}>
        <MachinesContext.Provider value={props.machines}>
          <PreventiveContext.Provider value={props.preventive}>
            <SortieExterneContext.Provider value={props.sortie}>
              <CorrectiveContext.Provider value={props.corrective}>
                <div className="w-full min-w-0 relative">
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
              </div>
              </CorrectiveContext.Provider>
            </SortieExterneContext.Provider>
          </PreventiveContext.Provider>
        </MachinesContext.Provider>
      </WarehouseContext.Provider>
    </StockContext.Provider>
  );
}
