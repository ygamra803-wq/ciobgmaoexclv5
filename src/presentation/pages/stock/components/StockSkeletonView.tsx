import { memo } from 'react';
import { SkeletonL1Page } from '../../../components/common/skeleton/GmaoSkeletonPrimitives';

/**
 * StockSkeletonView (L1 Operational Page Skeleton)
 * Pixel-matched to StockView:
 * 1. BDR Light Excel Header (PageHeaderIcon + Title + 2-line Subtitle + 2 Circular 3D Action Buttons)
 * 2. 4-Card Mature Light Excel KPI Grid (StockKPIBar)
 * 3. 4-Column IndustrialFilterCard (Search, Type, Alerte, Sort)
 * 4. 11-Column GmaoIndustrialDataGrid (Col A → Col M) + Pagination
 */
function StockSkeletonViewComponent() {
  return (
    <SkeletonL1Page
      header={{
        circleButtonsCount: 2,
        titleBadgesCount: 1,
        twoLineSubtitle: true,
      }}
      kpiColumns={4}
      kpiCards={[
        { titleW: 'w-28', valueW: 'w-16', unitW: 'w-16', badgeW: 'w-32', footerLeftW: 'w-20', footerRightW: 'w-14' },
        { titleW: 'w-28', valueW: 'w-14', unitW: 'w-16', badgeW: 'w-28', footerLeftW: 'w-24', footerRightW: 'w-12' },
        { titleW: 'w-32', valueW: 'w-12', unitW: 'w-14', badgeW: 'w-28', footerLeftW: 'w-18', footerRightW: 'w-24' },
        { titleW: 'w-28', valueW: 'w-12', unitW: 'w-14', badgeW: 'w-28', footerLeftW: 'w-16', footerRightW: 'w-20' },
      ]}
      filter={{
        columns: 4,
        hasExportButton: true,
      }}
      grid={{
        minWidth: 'min-w-[1020px]',
        rowsCount: 8,
        hasPagination: true,
        columns: [
          { headerW: 'w-20', type: 'code', colClass: 'w-28' },
          { headerW: 'w-36', type: 'double', colClass: 'min-w-[200px]' },
          { headerW: 'w-20', type: 'badge', colClass: 'w-28' },
          { headerW: 'w-14', type: 'number', align: 'right', colClass: 'w-20' },
          { headerW: 'w-14', type: 'number', align: 'right', colClass: 'w-20' },
          { headerW: 'w-14', type: 'number', align: 'right', colClass: 'w-20' },
          { headerW: 'w-16', type: 'number', align: 'right', colClass: 'w-24' },
          { headerW: 'w-14', type: 'number', align: 'right', colClass: 'w-20' },
          { headerW: 'w-16', type: 'badge', align: 'center', colClass: 'w-24' },
          { headerW: 'w-20', type: 'code', colClass: 'w-28' },
          { headerW: 'w-16', type: 'actions', align: 'center', colClass: 'w-24' },
        ],
      }}
    />
  );
}

export const StockSkeletonView = memo(StockSkeletonViewComponent);
export default StockSkeletonView;
