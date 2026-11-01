import { memo } from 'react';
import { SkeletonL2Page } from '../../../components/common/skeleton/GmaoSkeletonPrimitives';

/**
 * CompFamilySkeletonView (L2 Warehouse Component Families Page Skeleton)
 * Pixel-matched to CompFamilyView:
 * 1. Top Header Banner (Free PageHeaderIcon + Title + 2 Circular 3D Action Buttons)
 * 2. 3-Column IndustrialFilterCard (Search, Group Filter, Sort)
 * 3. 6-Column GmaoIndustrialDataGrid (+ N° col = 7 cols) + Pagination
 */
function CompFamilySkeletonViewComponent() {
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
        minWidth: 'min-w-[850px]',
        rowsCount: 7,
        hasPagination: true,
        columns: [
          { headerW: 'w-24', type: 'code', colClass: 'w-32' },
          { headerW: 'w-44', type: 'double', colClass: 'min-w-[200px]' },
          { headerW: 'w-28', type: 'badge', colClass: 'w-36' },
          { headerW: 'w-32', type: 'badge', colClass: 'w-40' },
          { headerW: 'w-32', type: 'badge', colClass: 'w-40' },
          { headerW: 'w-16', type: 'actions', align: 'right', colClass: 'w-24' },
        ],
      }}
    />
  );
}

export const CompFamilySkeletonView = memo(CompFamilySkeletonViewComponent);
export default CompFamilySkeletonView;
