import { memo } from 'react';
import { SkeletonL2Page } from '../../../components/common/skeleton/GmaoSkeletonPrimitives';

/**
 * PartDesignationSkeletonView (L2 Warehouse Part Designations Page Skeleton)
 * Pixel-matched to PartDesignationView:
 * 1. Top Header Banner (Free PageHeaderIcon + Title + 2 Circular 3D Action Buttons)
 * 2. 3-Column IndustrialFilterCard (Search, Part Type Filter, Sort)
 * 3. 7-Column GmaoIndustrialDataGrid (+ N° col = 8 cols) + Pagination
 */
function PartDesignationSkeletonViewComponent() {
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
        minWidth: 'min-w-[920px]',
        rowsCount: 7,
        hasPagination: true,
        columns: [
          { headerW: 'w-28', type: 'code', colClass: 'w-36' },
          { headerW: 'w-44', type: 'double', colClass: 'min-w-[200px]' },
          { headerW: 'w-36', type: 'badge', colClass: 'w-40' },
          { headerW: 'w-20', type: 'number', align: 'right', colClass: 'w-28' },
          { headerW: 'w-28', type: 'code', colClass: 'w-32' },
          { headerW: 'w-36', type: 'badge', colClass: 'w-40' },
          { headerW: 'w-16', type: 'actions', align: 'right', colClass: 'w-24' },
        ],
      }}
    />
  );
}

export const PartDesignationSkeletonView = memo(PartDesignationSkeletonViewComponent);
export default PartDesignationSkeletonView;
