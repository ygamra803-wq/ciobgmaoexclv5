import { Package, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { useI18n } from '../../../../i18n/I18nContext';

export default function StockKPIBar({
  stockItems = [],
  stockKPIs = {},
  types = [],
  activeKpiFilter,
  setActiveKpiFilter,
  stockAlertOnly,
  setStockAlertOnly,
}) {
  const { t } = useI18n();

  return (
    <div id="stock-kpis-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
      {/* Card 1: Total Références */}
      <div
        id="stock-kpi-total"
        onClick={() => {
          setActiveKpiFilter('ALL');
          setStockAlertOnly(false);
        }}
        className={`group bg-white p-4 rounded-2xl border transition-all cursor-pointer shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 ease-out flex items-center justify-between ${
          activeKpiFilter === 'ALL' && !stockAlertOnly
            ? 'border-cyan-500 ring-2 ring-cyan-100 bg-cyan-50/20'
            : 'border-slate-200/90 hover:border-cyan-300'
        }`}
      >
        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            {t('stock.kpis.global_catalog', 'Catalogue Global')}
          </span>
          <span className="text-2xl font-black text-slate-900 mt-0.5 block font-mono">
            {stockItems.length}
          </span>
          <span className="text-[11px] text-slate-500 mt-0.5 block">
            {t('stock.kpis.types_count', { count: types.length })}
          </span>
        </div>
        <div className="w-11 h-11 rounded-xl bg-cyan-50 text-cyan-700 flex items-center justify-center shrink-0 border border-cyan-200/60 group-hover:scale-110 group-hover:border-cyan-300 transition-transform duration-300">
          <Package className="w-5 h-5 text-cyan-700" />
        </div>
      </div>

      {/* Card 2: Stock Normal (OK) */}
      <div
        id="stock-kpi-ok"
        onClick={() => {
          setActiveKpiFilter(activeKpiFilter === 'OK' ? 'ALL' : 'OK');
          setStockAlertOnly(false);
        }}
        className={`group bg-white p-4 rounded-2xl border transition-all cursor-pointer shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 ease-out flex items-center justify-between ${
          activeKpiFilter === 'OK'
            ? 'border-emerald-500 ring-2 ring-emerald-100 bg-emerald-50/30'
            : 'border-slate-200/90 hover:border-emerald-300'
        }`}
      >
        <div>
          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">
            {t('stock.kpis.conforming_stock', 'Stock Conforme (OK)')}
          </span>
          <span className="text-2xl font-black text-emerald-700 mt-0.5 block font-mono">
            {stockKPIs.ok || 0}
          </span>
          <span className="text-[11px] text-emerald-600/80 mt-0.5 block">
            {t('stock.kpis.stable_percent', {
              percent: stockItems.length > 0 ? Math.round(((stockKPIs.ok || 0) / stockItems.length) * 100) : 0,
            })}
          </span>
        </div>
        <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200/60 group-hover:scale-110 group-hover:border-emerald-300 transition-transform duration-300">
          <CheckCircle2 className="w-5 h-5" />
        </div>
      </div>

      {/* Card 3: Alertes Seuil */}
      <div
        id="stock-kpi-alerte"
        onClick={() => {
          setActiveKpiFilter(activeKpiFilter === 'ALERTE' ? 'ALL' : 'ALERTE');
          setStockAlertOnly(false);
        }}
        className={`group bg-white p-4 rounded-2xl border transition-all cursor-pointer shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 ease-out flex items-center justify-between ${
          activeKpiFilter === 'ALERTE'
            ? 'border-amber-500 ring-2 ring-amber-100 bg-amber-50/30'
            : 'border-slate-200/90 hover:border-amber-300'
        }`}
      >
        <div>
          <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">
            {t('stock.kpis.under_threshold', 'Sous Seuil (ALERTE)')}
          </span>
          <span className="text-2xl font-black text-amber-700 mt-0.5 block font-mono">
            {stockKPIs.alertes || 0}
          </span>
          <span className="text-[11px] text-amber-600/80 mt-0.5 block">
            {t('stock.kpis.reorder_required', 'Réapprovisionnement requis')}
          </span>
        </div>
        <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200/60 group-hover:scale-110 group-hover:border-amber-300 transition-transform duration-300">
          <AlertTriangle className="w-5 h-5" />
        </div>
      </div>

      {/* Card 4: Ruptures de Stock */}
      <div
        id="stock-kpi-rupture"
        onClick={() => {
          setActiveKpiFilter(activeKpiFilter === 'RUPTURE' ? 'ALL' : 'RUPTURE');
          setStockAlertOnly(false);
        }}
        className={`group bg-white p-4 rounded-2xl border transition-all cursor-pointer shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 ease-out flex items-center justify-between ${
          activeKpiFilter === 'RUPTURE'
            ? 'border-rose-500 ring-2 ring-rose-100 bg-rose-50/30'
            : 'border-slate-200/90 hover:border-rose-300'
        }`}
      >
        <div>
          <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider block">
            {t('stock.kpis.total_rupture', 'Rupture Totale')}
          </span>
          <span className="text-2xl font-black text-rose-700 mt-0.5 block font-mono">
            {stockKPIs.ruptures || 0}
          </span>
          <span className="text-[11px] text-rose-600/80 mt-0.5 block">
            {t('stock.kpis.stock_zero', 'Stock = 0 (Bloquant)')}
          </span>
        </div>
        <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center shrink-0 border border-rose-200/60 group-hover:scale-110 group-hover:border-rose-300 transition-transform duration-300">
          <XCircle className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}
