import { memo } from 'react';
import { SkeletonL1Page } from '../../../components/common/skeleton/GmaoSkeletonPrimitives';

/**
 * EntrepotSkeletonView (L1 Operational Page Skeleton)
 * Pixel-matched to EntrepotView:
 * 1. Top Header Banner (PageHeaderIcon + Title + 2 Circular 3D Action Buttons)
 * 2. 4-Card Mature Light Excel KPI Grid (Inventaire Global, Composants, Pièces, En Service Actif)
 * 3. 5-Column IndustrialFilterCard
 * 4. Sub-Tab Switcher (Components / Parts) + 9-Column GmaoIndustrialDataGrid + Pagination
 */
function EntrepotSkeletonViewComponent() {
  return (
    <SkeletonL1Page
      header={{
        circleButtonsCount: 2,
        titleBadgesCount: 1,
      }}
      kpiColumns={4}
      kpiCards={[
        { titleW: 'w-28', valueW: 'w-14', unitW: 'w-16', badgeW: 'w-28', footerLeftW: 'w-24', footerRightW: 'w-20' },
        { titleW: 'w-28', valueW: 'w-12', unitW: 'w-16', badgeW: 'w-28', footerLeftW: 'w-20', footerRightW: 'w-24' },
        { titleW: 'w-28', valueW: 'w-14', unitW: 'w-12', badgeW: 'w-28', footerLeftW: 'w-24', footerRightW: 'w-24' },
        { titleW: 'w-28', valueW: 'w-12', unitW: 'w-12', badgeW: 'w-24', footerLeftW: 'w-24', footerRightW: 'w-12' },
      ]}
      filter={{
        columns: 5,
        hasExportButton: true,
      }}
      grid={{
        topTabsCount: 2,
        minWidth: 'min-w-[1020px]',
        rowsCount: 7,
        hasPagination: true,
        columns: [
          { headerW: 'w-24', type: 'code', colClass: 'w-32' },
          { headerW: 'w-36', type: 'double', colClass: 'min-w-[200px]' },
          { headerW: 'w-32', type: 'dual-badge', colClass: 'min-w-[180px]' },
          { headerW: 'w-24', type: 'badge', colClass: 'min-w-[140px]' },
          { headerW: 'w-24', type: 'code', colClass: 'min-w-[130px]' },
          { headerW: 'w-16', type: 'number', align: 'right', colClass: 'w-24' },
          { headerW: 'w-14', type: 'number', align: 'right', colClass: 'w-20' },
          { headerW: 'w-18', type: 'badge', align: 'center', colClass: 'w-28' },
          { headerW: 'w-16', type: 'actions', align: 'center', colClass: 'w-24' },
        ],
      }}
    />
  );
}

export const EntrepotSkeletonView = memo(EntrepotSkeletonViewComponent);
export default EntrepotSkeletonView;
