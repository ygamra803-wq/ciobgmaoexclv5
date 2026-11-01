import { memo } from 'react';
import { SkeletonL2Page } from '../../../components/common/skeleton/GmaoSkeletonPrimitives';

/**
 * TypeSkeletonView (L2 Referentiel Page Skeleton)
 * Pixel-matched to TypeView:
 * 1. Top Header Banner (Free PageHeaderIcon + Title + 2 Circular 3D Action Buttons)
 * 2. 2-Column IndustrialFilterCard (Search + Sort)
 * 3. 5-Column GmaoIndustrialDataGrid (+ N° col = 6 cols) + Pagination
 */
function TypeSkeletonViewComponent() {
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
        minWidth: 'min-w-[800px]',
        rowsCount: 8,
        hasPagination: true,
        columns: [
          { headerW: 'w-20', type: 'code', colClass: 'w-36' },
          { headerW: 'w-36', type: 'text', colClass: 'min-w-[220px]' },
          { headerW: 'w-28', type: 'badge', colClass: 'w-40' },
          { headerW: 'w-24', type: 'badge', colClass: 'w-36' },
          { headerW: 'w-16', type: 'actions', align: 'right', colClass: 'w-24' },
        ],
      }}
    />
  );
}

export const TypeSkeletonView = memo(TypeSkeletonViewComponent);
export default TypeSkeletonView;
