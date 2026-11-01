import { memo } from 'react';
import { SkeletonL1Page } from '../../../components/common/skeleton/GmaoSkeletonPrimitives';

/**
 * ZonesSkeletonView (L1 Operational Page Skeleton)
 * Pixel-matched to ZonesView:
 * 1. Top Header Banner (PageHeaderIcon + Title + 2 Circular 3D Action Buttons)
 * 2. 4-Card Mature Light Excel KPI Grid (Total Zones, Machines Rattachées, Techniciens Affectés, Opérateurs & Responsables)
 * 3. 2-Column Filter Card (Search + Sort)
 * 4. 5-Column GmaoIndustrialDataGrid + Pagination
 */
function ZonesSkeletonViewComponent() {
  return (
    <SkeletonL1Page
      header={{
        circleButtonsCount: 2,
        titleBadgesCount: 0,
      }}
      kpiColumns={4}
      kpiCards={[
        { titleW: 'w-32', valueW: 'w-12', unitW: 'w-14', badgeW: 'w-28', footerLeftW: 'w-20', footerRightW: 'w-16' },
        { titleW: 'w-32', valueW: 'w-14', unitW: 'w-18', badgeW: 'w-24', footerLeftW: 'w-16', footerRightW: 'w-28' },
        { titleW: 'w-32', valueW: 'w-12', unitW: 'w-18', badgeW: 'w-28', footerLeftW: 'w-20', footerRightW: 'w-24' },
        { titleW: 'w-36', valueW: 'w-12', unitW: 'w-14', badgeW: 'w-32', footerLeftW: 'w-20', footerRightW: 'w-20' },
      ]}
      filter={{
        columns: 2,
        hasExportButton: false,
      }}
      grid={{
        minWidth: 'min-w-[820px]',
        rowsCount: 6,
        hasPagination: true,
        columns: [
          { headerW: 'w-28', type: 'double', colClass: 'min-w-[150px]' },
          { headerW: 'w-36', type: 'triple', colClass: 'min-w-[230px]' },
          { headerW: 'w-32', type: 'dual-badge', colClass: 'min-w-[190px]' },
          { headerW: 'w-24', type: 'badge', colClass: 'min-w-[130px]' },
          { headerW: 'w-12', type: 'actions', align: 'center', colClass: 'w-24' },
        ],
      }}
    />
  );
}

export const ZonesSkeletonView = memo(ZonesSkeletonViewComponent);
export default ZonesSkeletonView;
