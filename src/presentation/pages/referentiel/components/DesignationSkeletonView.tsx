import { memo } from 'react';
import { SkeletonL2Page } from '../../../components/common/skeleton/GmaoSkeletonPrimitives';

/**
 * DesignationSkeletonView (L2 Referentiel Page Skeleton)
 * Pixel-matched to DesignationView:
 * 1. Top Header Banner (Free PageHeaderIcon + Title + 2 Circular 3D Action Buttons)
 * 2. 3-Column IndustrialFilterCard (Search, Type Parente, Sort)
 * 3. 7-Column GmaoIndustrialDataGrid (+ N° col = 8 cols) + Pagination
 */
function DesignationSkeletonViewComponent() {
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
        rowsCount: 8,
        hasPagination: true,
        columns: [
          { headerW: 'w-20', type: 'code', colClass: 'w-32' },
          { headerW: 'w-36', type: 'double', colClass: 'min-w-[220px]' },
          { headerW: 'w-24', type: 'badge', colClass: 'w-36' },
          { headerW: 'w-16', type: 'number', align: 'right', colClass: 'w-24' },
          { headerW: 'w-20', type: 'code', colClass: 'w-28' },
          { headerW: 'w-24', type: 'badge', align: 'center', colClass: 'w-32' },
          { headerW: 'w-16', type: 'actions', align: 'right', colClass: 'w-24' },
        ],
      }}
    />
  );
}

export const DesignationSkeletonView = memo(DesignationSkeletonViewComponent);
export default DesignationSkeletonView;
