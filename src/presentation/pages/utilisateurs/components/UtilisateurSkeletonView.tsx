import { memo } from 'react';
import { SkeletonL1Page } from '../../../components/common/skeleton/GmaoSkeletonPrimitives';

/**
 * UtilisateurSkeletonView (L1 Operational Page Skeleton)
 * Pixel-matched to UtilisateursView:
 * 1. Top Header Banner (PageHeaderIcon + Title + 2 Circular 3D Action Buttons)
 * 2. 4-Card Mature Light Excel KPI Grid (Total Membres, Techniciens, Opérateurs, Responsables)
 * 3. 4-Column Filter Card (Search, Role/Profil, Zone, Sort)
 * 4. 6-Column GmaoIndustrialDataGrid + Pagination
 */
function UtilisateurSkeletonViewComponent() {
  return (
    <SkeletonL1Page
      header={{
        circleButtonsCount: 2,
        titleBadgesCount: 1,
      }}
      kpiColumns={4}
      kpiCards={[
        { titleW: 'w-28', valueW: 'w-12', unitW: 'w-16', badgeW: 'w-28', footerLeftW: 'w-24', footerRightW: 'w-24' },
        { titleW: 'w-28', valueW: 'w-12', unitW: 'w-18', badgeW: 'w-28', footerLeftW: 'w-20', footerRightW: 'w-28' },
        { titleW: 'w-28', valueW: 'w-10', unitW: 'w-16', badgeW: 'w-28', footerLeftW: 'w-16', footerRightW: 'w-24' },
        { titleW: 'w-28', valueW: 'w-10', unitW: 'w-14', badgeW: 'w-28', footerLeftW: 'w-20', footerRightW: 'w-28' },
      ]}
      filter={{
        columns: 4,
        hasExportButton: true,
      }}
      grid={{
        minWidth: 'min-w-[860px]',
        rowsCount: 7,
        hasPagination: true,
        columns: [
          { headerW: 'w-24', type: 'code', colClass: 'w-32' },
          { headerW: 'w-32', type: 'avatar-double', colClass: 'min-w-[200px]' },
          { headerW: 'w-28', type: 'badge', colClass: 'min-w-[150px]' },
          { headerW: 'w-32', type: 'code', colClass: 'min-w-[150px]' },
          { headerW: 'w-32', type: 'text', colClass: 'min-w-[180px]' },
          { headerW: 'w-12', type: 'actions', align: 'center', colClass: 'w-24' },
        ],
      }}
    />
  );
}

export const UtilisateurSkeletonView = memo(UtilisateurSkeletonViewComponent);
export default UtilisateurSkeletonView;
