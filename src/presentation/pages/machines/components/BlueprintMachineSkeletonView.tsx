import { memo } from 'react';
import { SkeletonL2Page } from '../../../components/common/skeleton/GmaoSkeletonPrimitives';

/**
 * BlueprintMachineSkeletonView (L2 Engineering Blueprints & BOM Page Skeleton)
 * Pixel-matched to BlueprintMachineView:
 * 1. Top Header Banner (Free PageHeaderIcon + Title + 2 Circular 3D Action Buttons)
 * 2. 4-Card Summary KPI Strip
 * 3. 3-Column IndustrialFilterCard (Search, Machine/Template Filter, Sort)
 * 4. 6-Column GmaoIndustrialDataGrid (+ N° col = 7 cols) + Pagination
 */
function BlueprintMachineSkeletonViewComponent() {
  return (
    <SkeletonL2Page
      header={{
        circleButtonsCount: 2,
        titleBadgesCount: 1,
      }}
      kpiColumns={4}
      kpiCards={[
        { titleW: 'w-28', valueW: 'w-12', unitW: 'w-14', badgeW: 'w-28', footerLeftW: 'w-20', footerRightW: 'w-16' },
        { titleW: 'w-28', valueW: 'w-12', unitW: 'w-16', badgeW: 'w-24', footerLeftW: 'w-20', footerRightW: 'w-16' },
        { titleW: 'w-32', valueW: 'w-14', unitW: 'w-14', badgeW: 'w-28', footerLeftW: 'w-20', footerRightW: 'w-20' },
        { titleW: 'w-28', valueW: 'w-10', unitW: 'w-14', badgeW: 'w-24', footerLeftW: 'w-16', footerRightW: 'w-20' },
      ]}
      filter={{
        columns: 3,
        hasExportButton: true,
      }}
      grid={{
        minWidth: 'min-w-[900px]',
        rowsCount: 7,
        hasPagination: true,
        columns: [
          { headerW: 'w-28', type: 'code', colClass: 'w-36' },
          { headerW: 'w-36', type: 'double', colClass: 'min-w-[200px]' },
          { headerW: 'w-40', type: 'dual-badge', colClass: 'min-w-[190px]' },
          { headerW: 'w-32', type: 'badge', colClass: 'min-w-[150px]' },
          { headerW: 'w-20', type: 'badge', align: 'center', colClass: 'w-28' },
          { headerW: 'w-16', type: 'actions', align: 'right', colClass: 'w-24' },
        ],
      }}
    />
  );
}

export const BlueprintMachineSkeletonView = memo(BlueprintMachineSkeletonViewComponent);
export default BlueprintMachineSkeletonView;
