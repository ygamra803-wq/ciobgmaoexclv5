import { memo } from 'react';
import { SkeletonL1Page } from '../../../components/common/skeleton/GmaoSkeletonPrimitives';

/**
 * MachinesRegisteredSkeletonView (L1 Operational Page Skeleton)
 * Pixel-matched to MachinesRegisteredView:
 * 1. Top Header Banner (PageHeaderIcon + Title + 2 Circular 3D Action Buttons)
 * 2. 4-Card Mature Light Excel KPI Grid (MachinesKPIBar: Parc Total, En Service, En Maintenance, Interventions)
 * 3. 5-Column IndustrialFilterCard with Asset Class Segmented Bar (Production / Systèmes Généraux)
 * 4. 8-Column GmaoIndustrialDataGrid + Pagination
 */
function MachinesRegisteredSkeletonViewComponent() {
  return (
    <SkeletonL1Page
      header={{
        circleButtonsCount: 2,
        titleBadgesCount: 1,
      }}
      kpiColumns={4}
      kpiCards={[
        { titleW: 'w-28', valueW: 'w-14', unitW: 'w-16', badgeW: 'w-28', footerLeftW: 'w-24', footerRightW: 'w-16' },
        { titleW: 'w-28', valueW: 'w-14', unitW: 'w-16', badgeW: 'w-32', footerLeftW: 'w-24', footerRightW: 'w-12' },
        { titleW: 'w-32', valueW: 'w-10', unitW: 'w-14', badgeW: 'w-24', footerLeftW: 'w-18', footerRightW: 'w-24' },
        { titleW: 'w-28', valueW: 'w-14', unitW: 'w-16', badgeW: 'w-28', footerLeftW: 'w-18', footerRightW: 'w-20' },
      ]}
      filter={{
        columns: 5,
        hasAssetClassBar: true,
        hasExportButton: true,
      }}
      grid={{
        minWidth: 'min-w-[980px]',
        rowsCount: 7,
        hasPagination: true,
        columns: [
          { headerW: 'w-24', type: 'code', colClass: 'w-32' },
          { headerW: 'w-36', type: 'double', colClass: 'min-w-[200px]' },
          { headerW: 'w-36', type: 'dual-badge', colClass: 'min-w-[190px]' },
          { headerW: 'w-24', type: 'code', colClass: 'min-w-[150px]' },
          { headerW: 'w-32', type: 'dual-badge', colClass: 'min-w-[190px]' },
          { headerW: 'w-16', type: 'badge', align: 'center', colClass: 'w-28' },
          { headerW: 'w-16', type: 'number', align: 'right', colClass: 'w-24' },
          { headerW: 'w-16', type: 'actions', align: 'center', colClass: 'w-24' },
        ],
      }}
    />
  );
}

export const MachinesRegisteredSkeletonView = memo(MachinesRegisteredSkeletonViewComponent);
export default MachinesRegisteredSkeletonView;
