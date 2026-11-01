import DashboardSkeleton from './DashboardSkeleton';
import StockSkeletonView from '../../pages/stock/components/StockSkeletonView';
import TypeSkeletonView from '../../pages/referentiel/components/TypeSkeletonView';
import DesignationSkeletonView from '../../pages/referentiel/components/DesignationSkeletonView';
import UtilisateurSkeletonView from '../../pages/utilisateurs/components/UtilisateurSkeletonView';
import ZonesSkeletonView from '../../pages/referentiel/components/ZonesSkeletonView';
import EntrepotSkeletonView from '../../pages/warehouse/components/EntrepotSkeletonView';
import PartTypeSkeletonView from '../../pages/referentiel/components/PartTypeSkeletonView';
import PartDesignationSkeletonView from '../../pages/referentiel/components/PartDesignationSkeletonView';
import CompFamilySkeletonView from '../../pages/referentiel/components/CompFamilySkeletonView';
import CompTemplateSkeletonView from '../../pages/referentiel/components/CompTemplateSkeletonView';
import MachinesRegisteredSkeletonView from '../../pages/machines/components/MachinesRegisteredSkeletonView';
import FamilySkeletonView from '../../pages/machines/components/FamilySkeletonView';
import TemplatesSkeletonView from '../../pages/machines/components/TemplatesSkeletonView';
import BlueprintMachineSkeletonView from '../../pages/machines/components/BlueprintMachineSkeletonView';
import {
  PreventiveSkeleton,
  CorrectiveSkeleton,
  CompGroupSkeleton,
  PreventiveReferentielSkeleton,
  CatalogueDonneesSkeleton,
  ValidationCenterSkeleton,
  ExecutiveReportSkeleton,
  SortieRapideSkeleton,
  GenericTableSkeleton,
  GuidanceCardsTableSkeleton,
  SettingsSkeleton,
} from './PageSkeletons';

/**
 * Central Skeleton Dispatcher
 * Maps every L1, L2, and Special route in AppRouter to its exact pixel-matched skeleton.
 */
export default function LoadingSkeleton({ currentTab = 'dashboard' }: { currentTab?: string }) {
  if (currentTab.startsWith('corrective') && currentTab !== 'corrective_referentiel') {
    return <CorrectiveSkeleton subTab={currentTab === 'corrective' ? 'corrective_di' : currentTab} />;
  }

  switch (currentTab) {
    // ─── Special Pages ───
    case 'dashboard':
      return <DashboardSkeleton />;
    case 'validation_center':
      return <ValidationCenterSkeleton />;
    case 'shift_weekly_report':
    case 'executive_report':
      return <ExecutiveReportSkeleton />;
    case 'settings':
      return <SettingsSkeleton />;
    case 'nexus':
    case 'guide':
      return <GenericTableSkeleton />;

    // ─── L1 Operational Pages ───
    case 'stock':
      return <StockSkeletonView />;
    case 'machines':
      return <MachinesRegisteredSkeletonView />;
    case 'preventive':
      return <PreventiveSkeleton />;
    case 'entrepot':
    case 'warehouse':
      return <EntrepotSkeletonView />;
    case 'zones':
      return <ZonesSkeletonView />;
    case 'utilisateurs':
    case 'operations':
    case 'technicians':
      return <UtilisateurSkeletonView />;

    // ─── L2 Engineering, Referentiel & Operational Sub-Pages ───
    case 'sortie':
    case 'mouvements':
      return <SortieRapideSkeleton />;
    case 'types':
      return <TypeSkeletonView />;
    case 'designations':
      return <DesignationSkeletonView />;
    case 'families':
      return <FamilySkeletonView />;
    case 'templates':
    case 'machineTemplates':
      return <TemplatesSkeletonView />;
    case 'blueprints':
      return <BlueprintMachineSkeletonView />;
    case 'preventive_referentiel':
      return <PreventiveReferentielSkeleton />;
    case 'corrective_referentiel':
      return <CatalogueDonneesSkeleton />;
    case 'comp_groups':
      return <CompGroupSkeleton />;
    case 'comp_families':
      return <CompFamilySkeletonView />;
    case 'comp_templates':
      return <CompTemplateSkeletonView />;
    case 'part_types':
      return <PartTypeSkeletonView />;
    case 'part_designations':
      return <PartDesignationSkeletonView />;
    case 'diagnostics':
      return <GuidanceCardsTableSkeleton />;

    default:
      return <GenericTableSkeleton />;
  }
}
