import {
  AlertTriangle,
  BookOpen,
  Calendar,
  Compass,
  Factory,
  FileSpreadsheet,
  LayoutDashboard,
  ShieldCheck,
  ShoppingCart,
  User,
  Warehouse,
  Wrench,
} from 'lucide-react';
import PageHeaderIcon from '../../../components/common/PageHeaderIcon';
import FormulasModalButton from '../../../components/common/FormulasModalButton';
import Action3DButton from '../../../components/common/Action3DButton';
import SortieEntreeIcon from '../../../components/common/SortieEntreeIcon';

export interface DashboardHeaderBannerProps {
  t: (key: string) => string;
  isTechUser: boolean;
  isStoreManager: boolean;
  isOperatorRole: boolean;
  isViewerRole: boolean;
  techBadgeLabel: string;
  canManageSettings: boolean;
  canCreateMovement: boolean;
  canExportData: boolean;
  canAccessPreventiveTab: boolean;
  canAccessCorrectiveTab: boolean;
  canAccessCorrectiveDiTab: boolean;
  canAccessSortieTab: boolean;
  onToggleOnboarding: () => void;
  onOpenFormulas: () => void;
  onOpenNewOrder: () => void;
  onNavigateToPreventive?: () => void;
  onNavigateToCorrective?: (tab?: string) => void;
  onNavigateToSortie?: () => void;
  onExportExcel?: () => void;
}

export function DashboardHeaderBanner({
  t,
  isTechUser,
  isStoreManager,
  isOperatorRole,
  isViewerRole,
  techBadgeLabel,
  canManageSettings,
  canCreateMovement,
  canExportData,
  canAccessPreventiveTab,
  canAccessCorrectiveTab,
  canAccessCorrectiveDiTab,
  canAccessSortieTab,
  onToggleOnboarding,
  onOpenFormulas,
  onOpenNewOrder,
  onNavigateToPreventive,
  onNavigateToCorrective,
  onNavigateToSortie,
  onExportExcel,
}: DashboardHeaderBannerProps) {
  return (
    <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200/90 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden group/header">
      <div className="absolute -top-12 -right-12 w-48 h-48 bg-blue-500/5 rounded-full blur-2xl pointer-events-none group-hover/header:bg-blue-500/10 transition-colors duration-500" />

      <div className="min-w-0 flex-1 flex items-start sm:items-center gap-3.5 relative">
        <PageHeaderIcon icon={LayoutDashboard} colorClass="text-blue-700" />

        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
              {isTechUser
                ? t('dashboard.header.techTitle')
                : isStoreManager
                ? t('dashboard.header.storeTitle')
                : isOperatorRole
                ? t('dashboard.header.operatorTitle')
                : isViewerRole
                ? t('dashboard.header.viewerTitle')
                : t('dashboard.header.adminTitle')}
            </h1>
            {isTechUser ? (
              <span
                data-testid="tech-dashboard-badge"
                className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-100/90 text-emerald-900 border border-emerald-300 flex items-center gap-1.5 shadow-2xs font-mono"
              >
                <User className="w-3.5 h-3.5 text-emerald-700" />
                <span>{t('dashboard.header.techBadgePrefix')} · {techBadgeLabel}</span>
              </span>
            ) : isStoreManager ? (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-teal-100/90 text-teal-900 border border-teal-300 flex items-center gap-1 shadow-2xs font-mono">
                <Warehouse className="w-3.5 h-3.5 text-teal-700" />
                <span>{t('dashboard.header.storeBadge')}</span>
              </span>
            ) : isOperatorRole ? (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100/90 text-amber-900 border border-amber-300 flex items-center gap-1 shadow-2xs font-mono">
                <Factory className="w-3.5 h-3.5 text-amber-700" />
                <span>{t('dashboard.header.operatorBadge')}</span>
              </span>
            ) : isViewerRole ? (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-700 border border-slate-300 flex items-center gap-1 shadow-2xs font-mono">
                <BookOpen className="w-3.5 h-3.5 text-slate-600" />
                <span>{t('dashboard.header.viewerBadge')}</span>
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100/90 text-emerald-800 border border-emerald-200/80 flex items-center gap-1 shadow-2xs">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>{t('dashboard.header.twinBadge')}</span>
              </span>
            )}
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200/60 font-mono">
              {t('dashboard.header.offlineBadge')}
            </span>
            {!isTechUser && canManageSettings && (
              <button
                type="button"
                onClick={onToggleOnboarding}
                data-testid="c4-open-onboarding-btn"
                className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-mono transition cursor-pointer inline-flex items-center gap-1.5"
              >
                <Compass className="w-3 h-3 text-slate-600" />
                <span>{t('dashboard.header.factoryWizardBtn')}</span>
              </button>
            )}
          </div>
          <p className="text-xs text-slate-500 max-w-3xl leading-relaxed">
            {isTechUser
              ? t('dashboard.header.techSubtitle')
              : isStoreManager
              ? t('dashboard.header.storeSubtitle')
              : isOperatorRole
              ? t('dashboard.header.operatorSubtitle')
              : isViewerRole
              ? t('dashboard.header.viewerSubtitle')
              : t('dashboard.header.adminSubtitle')}
          </p>
        </div>
      </div>

      {/* Action Buttons — 3D Circular Archetype */}
      <div className="flex items-center gap-2.5 shrink-0 relative self-end md:self-auto">
        {isOperatorRole && canAccessCorrectiveDiTab && onNavigateToCorrective && (
          <button
            type="button"
            onClick={() => onNavigateToCorrective('corrective_di')}
            className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-2xs transition flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{t('dashboard.header.reportBreakdownBtn')}</span>
          </button>
        )}

        {!isTechUser && (
          <>
            <FormulasModalButton
              onClick={onOpenFormulas}
              title={t('dashboard.header.formulasTitle')}
            />
            {canCreateMovement && (
              <Action3DButton
                variant="circle"
                color="amber"
                icon={ShoppingCart}
                showAddBadge={true}
                onClick={onOpenNewOrder}
                title={t('dashboard.header.newOrderTitle')}
                ariaLabel={t('dashboard.header.newOrderAria')}
              />
            )}
          </>
        )}

        {isTechUser && canAccessPreventiveTab && onNavigateToPreventive && (
          <Action3DButton
            variant="circle"
            color="indigo"
            icon={Calendar}
            onClick={onNavigateToPreventive}
            title={t('dashboard.header.myPreventiveTasksTitle')}
            ariaLabel={t('dashboard.header.myPreventiveTasksAria')}
          />
        )}

        {canAccessCorrectiveTab && onNavigateToCorrective && (
          <Action3DButton
            variant="circle"
            color="amber"
            icon={Wrench}
            onClick={() => onNavigateToCorrective('corrective')}
            title={t('dashboard.header.correctiveNexusTitle')}
            ariaLabel={t('dashboard.header.correctiveNexusAria')}
          />
        )}

        {canAccessSortieTab && onNavigateToSortie && (
          <Action3DButton
            variant="circle"
            color="teal"
            icon={SortieEntreeIcon}
            onClick={onNavigateToSortie}
            title={t('dashboard.header.quickMovementTitle')}
            ariaLabel={t('dashboard.header.quickMovementAria')}
          />
        )}

        {!isTechUser && canExportData && onExportExcel && (
          <Action3DButton
            variant="circle"
            color="emerald"
            icon={FileSpreadsheet}
            onClick={onExportExcel}
            title={t('dashboard.header.exportExcelTitle')}
            ariaLabel={t('dashboard.header.exportExcelAria')}
          />
        )}
      </div>
    </div>
  );
}
