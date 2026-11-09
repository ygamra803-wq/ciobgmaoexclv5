import { Package, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { useI18n } from '../../../../i18n/I18nContext';
import { GmaoKpiCard, GmaoKpiGrid } from '../../../components/common/GmaoKpiCard';

export default function StockKPIBar({
  stockItems = [],
  stockKPIs = {},
  types = [],
  activeKpiFilter,
  setActiveKpiFilter,
  stockAlertOnly,
  setStockAlertOnly,
}: any) {
  const { t } = useI18n();

  const totalCount = stockItems.length;
  const okCount = Number(stockKPIs.ok) || 0;
  const alerteCount = Number(stockKPIs.alertes) || 0;
  const ruptureCount = Number(stockKPIs.ruptures) || 0;
  const conformingRate = totalCount > 0 ? Math.round((okCount / totalCount) * 100) : 0;

  return (
    <GmaoKpiGrid id="stock-kpis-grid" columns={4}>
      {/* Card 1: Total Références */}
      <GmaoKpiCard
        id="stock-kpi-total"
        title={t('stock.kpis.global_catalog', 'Catalogue Global')}
        value={totalCount}
        unit="réfs"
        icon={Package}
        color="cyan"
        valueColored={false}
        isActive={activeKpiFilter === 'ALL' && !stockAlertOnly}
        onClick={() => {
          setActiveKpiFilter('ALL');
          setStockAlertOnly(false);
        }}
        badgeText={t('stock.kpis.types_count', { count: types.length })}
        footerLabel="Formule Stock :"
        footerValue="=Init+Entrées-Sorties"
      />

      {/* Card 2: Stock Normal (OK) */}
      <GmaoKpiCard
        id="stock-kpi-ok"
        title={t('stock.kpis.conforming_stock', 'Stock Conforme (OK)')}
        value={okCount}
        unit="articles"
        icon={CheckCircle2}
        color="emerald"
        valueColored={true}
        isActive={activeKpiFilter === 'OK'}
        onClick={() => {
          setActiveKpiFilter(activeKpiFilter === 'OK' ? 'ALL' : 'OK');
          setStockAlertOnly(false);
        }}
        badgeText="Seuil respecté"
        footerLabel="Taux conformité :"
        footerValue={`${conformingRate}% stable`}
      />

      {/* Card 3: Alertes Seuil */}
      <GmaoKpiCard
        id="stock-kpi-alerte"
        title={t('stock.kpis.under_threshold', 'Sous Seuil (ALERTE)')}
        value={alerteCount}
        unit="en alerte"
        icon={AlertTriangle}
        color="amber"
        valueColored={true}
        isActive={activeKpiFilter === 'ALERTE'}
        onClick={() => {
          setActiveKpiFilter(activeKpiFilter === 'ALERTE' ? 'ALL' : 'ALERTE');
          setStockAlertOnly(false);
        }}
        badgeText={t('stock.kpis.reorder_required', 'Réapprovisionnement requis')}
        footerLabel="Condition :"
        footerValue="0 < Stock ≤ Seuil"
      />

      {/* Card 4: Ruptures de Stock */}
      <GmaoKpiCard
        id="stock-kpi-rupture"
        title={t('stock.kpis.total_rupture', 'Rupture Totale')}
        value={ruptureCount}
        unit="ruptures"
        icon={XCircle}
        color="rose"
        valueColored={true}
        pulseIcon={ruptureCount > 0}
        isActive={activeKpiFilter === 'RUPTURE'}
        onClick={() => {
          setActiveKpiFilter(activeKpiFilter === 'RUPTURE' ? 'ALL' : 'RUPTURE');
          setStockAlertOnly(false);
        }}
        badgeText={t('stock.kpis.stock_zero', 'Stock = 0 (Bloquant)')}
        footerLabel="Criticité :"
        footerValue={ruptureCount > 0 ? 'Urgence achat' : 'Aucune rupture'}
      />
    </GmaoKpiGrid>
  );
}
