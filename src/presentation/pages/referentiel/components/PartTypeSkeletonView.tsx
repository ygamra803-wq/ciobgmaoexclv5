import { memo } from 'react';
import { SkeletonL2Page } from '../../../components/common/skeleton/GmaoSkeletonPrimitives';

/**
 * PartTypeSkeletonView (L2 Warehouse Part Types Page Skeleton)
 * Pixel-matched to PartTypeView:
 * 1. Top Header Banner (Free PageHeaderIcon + Title + 2 Circular 3D Action Buttons)
 * 2. 2-Column IndustrialFilterCard (Search + Sort)
 * 3. 5-Column GmaoIndustrialDataGrid (+ N° col = 6 cols) + Pagination
 */
function PartTypeSkeletonViewComponent() {
  return (
    <SkeletonL2Page
      header={{
        circleButtonsCount: 2,
        titleBadgesCount: 1,
      }}
      filter={{
        columns: 2,
        hasExportButton: true,
      }}
      grid={{
        minWidth: 'min-w-[780px]',
        rowsCount: 7,
        hasPagination: true,
        columns: [
          { headerW: 'w-24', type: 'code', colClass: 'w-32' },
          { headerW: 'w-44', type: 'text', colClass: 'min-w-[200px]' },
          { headerW: 'w-36', type: 'badge', colClass: 'w-40' },
          { headerW: 'w-36', type: 'badge', colClass: 'w-40' },
          { headerW: 'w-16', type: 'actions', align: 'right', colClass: 'w-24' },
        ],
      }}
    />
  );
}

export const PartTypeSkeletonView = memo(PartTypeSkeletonViewComponent);
export default PartTypeSkeletonView;
