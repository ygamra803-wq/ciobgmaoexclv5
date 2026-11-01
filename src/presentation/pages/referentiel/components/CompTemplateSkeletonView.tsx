import { memo } from 'react';
import { SkeletonL2Page } from '../../../components/common/skeleton/GmaoSkeletonPrimitives';

/**
 * CompTemplateSkeletonView (L2 Warehouse Component Templates Page Skeleton)
 * Pixel-matched to CompTemplateView:
 * 1. Top Header Banner (Free PageHeaderIcon + Title + 2 Circular 3D Action Buttons)
 * 2. 3-Column IndustrialFilterCard (Search, Component Family Filter, Sort)
 * 3. 5-Column GmaoIndustrialDataGrid (+ N° col = 6 cols) + Pagination
 */
function CompTemplateSkeletonViewComponent() {
  return (
    <SkeletonL2Page
      header={{
        circleButtonsCount: 2,
        titleBadgesCount: 1,
      }}
      filter={{
        columns: 3,
        hasExportButton: true,
      }}
      grid={{
        minWidth: 'min-w-[820px]',
        rowsCount: 7,
        hasPagination: true,
        columns: [
          { headerW: 'w-28', type: 'code', colClass: 'w-36' },
          { headerW: 'w-40', type: 'double', colClass: 'min-w-[200px]' },
          { headerW: 'w-44', type: 'badge', colClass: 'w-44' },
          { headerW: 'w-36', type: 'badge', colClass: 'w-40' },
          { headerW: 'w-16', type: 'actions', align: 'right', colClass: 'w-24' },
        ],
      }}
    />
  );
}

export const CompTemplateSkeletonView = memo(CompTemplateSkeletonViewComponent);
export default CompTemplateSkeletonView;
