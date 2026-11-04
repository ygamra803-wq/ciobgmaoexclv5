import {
  Package,
  Boxes,
  AlertTriangle,
  Factory,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  CheckCircle2,
} from 'lucide-react';
import { GmaoKpiCard, GmaoKpiGrid } from '../../../components/common/GmaoKpiCard';
import { useTranslation } from '../../../../i18n/I18nContext';

export default function DashboardKPIs({
  stockKPIs = {
    totalArticles: 0,
    totalStockActuel: 0,
    totalEntrees: 0,
    totalSorties: 0,
    ruptures: 0,
    alertes: 0,
    ok: 0,
  },
  types = [],
  machineHealth = {
    total: 0,
    enService: 0,
    enMaintenance: 0,
    arret: 0,
  },
  onNavigateToStock,
  onNavigateToMachines,
}) {
  const { t } = useTranslation();

  const totalArts = Number(stockKPIs.totalArticles) || 1;
  const normalStockRate = Math.round(((Number(stockKPIs.ok) || 0) / totalArts) * 100);

  const totalMchs = Number(machineHealth.total) || 1;
  const machineAvailability = Math.round(((Number(machineHealth.enService) || 0) / totalMchs) * 100);

  const totalAlerts = (Number(stockKPIs.ruptures) || 0) + (Number(stockKPIs.alertes) || 0);

  return (
    <GmaoKpiGrid id="dashboard-kpis-container" columns={4}>
      {/* 1. Total Catalog Articles */}
      <GmaoKpiCard
        id="kpi-card-total-articles"
        title={t('dashboard.kpis.catalogArticles')}
        value={stockKPIs.totalArticles}
        unit={t('dashboard.kpis.refsUnit')}
        icon={Package}
        color="blue"
        valueColored={false}
        badgePrefix={`${types.length} ${t('dashboard.kpis.categoriesCount')}`}
        badgeText={`${stockKPIs.ok} ${t('dashboard.kpis.normalItems')}`}
        footerLabel={t('dashboard.kpis.stockHealth')}
        footerValue={`${normalStockRate}% ${t('dashboard.kpis.compliant')}`}
        onClick={onNavigateToStock}
      />

      {/* 2. Physical Stock Balance */}
      <GmaoKpiCard
        id="kpi-card-stock-balance"
        title={t('dashboard.kpis.physicalStockUnits')}
        value={stockKPIs.totalStockActuel}
        unit={t('dashboard.kpis.piecesUnit')}
        icon={Boxes}
        color="emerald"
        valueColored={false}
        badges={
          <>
            <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/80 font-mono flex items-center gap-0.5">
              <TrendingUp className="w-3 h-3" />+{stockKPIs.totalEntrees}
            </span>
            <span className="text-rose-700 font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200/80 font-mono flex items-center gap-0.5">
              <TrendingDown className="w-3 h-3" />-{stockKPIs.totalSorties}
            </span>
          </>
        }
        footerLabel={t('dashboard.kpis.cumulativeFlows')}
        footerValue={`${t('dashboard.kpis.net')} : ${(Number(stockKPIs.totalEntrees) || 0) - (Number(stockKPIs.totalSorties) || 0)}`}
        onClick={onNavigateToStock}
      />

      {/* 3. Critical Alerts & Ruptures */}
      <GmaoKpiCard
        id="kpi-card-critical-alerts"
        title={t('dashboard.kpis.criticalThresholds')}
        value={totalAlerts}
        unit={t('dashboard.kpis.articlesUnit')}
        icon={totalAlerts > 0 ? AlertTriangle : CheckCircle2}
        color={totalAlerts > 0 ? 'rose' : 'emerald'}
        valueColored={true}
        pulseIcon={totalAlerts > 0}
        badges={
          <>
            <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold text-[10px] font-mono border border-rose-200/80">
              {stockKPIs.ruptures} {t('dashboard.kpis.ruptures')}
            </span>
            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[10px] font-mono border border-amber-200/80">
              {stockKPIs.alertes} {t('dashboard.kpis.alerts')}
            </span>
          </>
        }
        footerLabel={t('dashboard.kpis.restock')}
        footerValue={
          <span className="flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
            <span>{t('dashboard.kpis.handleAlerts')}</span>
            <ArrowUpRight className="w-3 h-3" />
          </span>
        }
        onClick={onNavigateToStock}
      />

      {/* 4. Machines & Asset Fleet */}
      <GmaoKpiCard
        id="kpi-card-machines-fleet"
        title={t('dashboard.kpis.activeFleet')}
        value={machineHealth.total}
        unit={t('dashboard.kpis.equipmentUnit')}
        icon={Factory}
        color="purple"
        valueColored={false}
        badges={
          <>
            <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/80 font-mono">
              {machineHealth.enService} {t('dashboard.kpis.inService')}
            </span>
            <span>•</span>
            <span className="text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/80 font-mono">
              {machineHealth.enMaintenance} {t('dashboard.kpis.inMaint')}
            </span>
          </>
        }
        footerLabel={t('dashboard.kpis.availability')}
        footerValue={`${machineAvailability}% ${t('dashboard.kpis.availShort')}`}
        onClick={onNavigateToMachines}
      />
    </GmaoKpiGrid>
  );
}

