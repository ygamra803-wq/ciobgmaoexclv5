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
        title="Articles au Catalogue"
        value={stockKPIs.totalArticles}
        unit="réfs"
        icon={Package}
        color="blue"
        valueColored={false}
        badgePrefix={`${types.length} catégories`}
        badgeText={`${stockKPIs.ok} normaux`}
        footerLabel="Santé stock :"
        footerValue={`${normalStockRate}% conforme`}
        onClick={onNavigateToStock}
      />

      {/* 2. Physical Stock Balance */}
      <GmaoKpiCard
        id="kpi-card-stock-balance"
        title="Unités Physiques en Stock"
        value={stockKPIs.totalStockActuel}
        unit="pièces"
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
        footerLabel="Flux cumulés :"
        footerValue={`Net : ${(Number(stockKPIs.totalEntrees) || 0) - (Number(stockKPIs.totalSorties) || 0)}`}
        onClick={onNavigateToStock}
      />

      {/* 3. Critical Alerts & Ruptures */}
      <GmaoKpiCard
        id="kpi-card-critical-alerts"
        title="Seuils Critiques & Alertes"
        value={totalAlerts}
        unit="articles"
        icon={totalAlerts > 0 ? AlertTriangle : CheckCircle2}
        color={totalAlerts > 0 ? 'rose' : 'emerald'}
        valueColored={true}
        pulseIcon={totalAlerts > 0}
        badges={
          <>
            <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold text-[10px] font-mono border border-rose-200/80">
              {stockKPIs.ruptures} Ruptures
            </span>
            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[10px] font-mono border border-amber-200/80">
              {stockKPIs.alertes} Alertes
            </span>
          </>
        }
        footerLabel="Réappro :"
        footerValue={
          <span className="flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
            <span>Traiter les alertes</span>
            <ArrowUpRight className="w-3 h-3" />
          </span>
        }
        onClick={onNavigateToStock}
      />

      {/* 4. Machines & Asset Fleet */}
      <GmaoKpiCard
        id="kpi-card-machines-fleet"
        title="Parc Machines Actif"
        value={machineHealth.total}
        unit="équipements"
        icon={Factory}
        color="purple"
        valueColored={false}
        badges={
          <>
            <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/80 font-mono">
              {machineHealth.enService} en service
            </span>
            <span>•</span>
            <span className="text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/80 font-mono">
              {machineHealth.enMaintenance} en maint.
            </span>
          </>
        }
        footerLabel="Disponibilité :"
        footerValue={`${machineAvailability}% dispo`}
        onClick={onNavigateToMachines}
      />
    </GmaoKpiGrid>
  );
}
