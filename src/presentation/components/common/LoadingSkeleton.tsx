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
  SortieRapideSkeleton,
  GenericTableSkeleton,
  GuidanceCardsTableSkeleton,
  SettingsSkeleton,
} from './PageSkeletons';

export default function LoadingSkeleton({ currentTab = 'dashboard' }) {
  switch (currentTab) {
    case 'dashboard':
      return <DashboardSkeleton />;
    case 'stock':
      return <StockSkeletonView />;
    case 'types':
      return <TypeSkeletonView />;
    case 'designations':
      return <DesignationSkeletonView />;
    case 'utilisateurs':
    case 'operations':
    case 'technicians':
      return <UtilisateurSkeletonView />;
    case 'zones':
      return <ZonesSkeletonView />;
    case 'entrepot':
    case 'warehouse':
      return <EntrepotSkeletonView />;
    case 'part_types':
      return <PartTypeSkeletonView />;
    case 'part_designations':
      return <PartDesignationSkeletonView />;
    case 'comp_families':
      return <CompFamilySkeletonView />;
    case 'comp_templates':
      return <CompTemplateSkeletonView />;
    case 'machines':
      return <MachinesRegisteredSkeletonView />;
    case 'families':
      return <FamilySkeletonView />;
    case 'templates':
    case 'machineTemplates':
      return <TemplatesSkeletonView />;
    case 'blueprints':
      return <BlueprintMachineSkeletonView />;
    case 'sortie':
    case 'mouvements':
      return <SortieRapideSkeleton />;
    case 'diagnostics':
      return <GuidanceCardsTableSkeleton />;
    case 'nexus':
    case 'guide':
      return <GenericTableSkeleton />;
    case 'settings':
      return <SettingsSkeleton />;
    default:
      return <DashboardSkeleton />;
  }
}




