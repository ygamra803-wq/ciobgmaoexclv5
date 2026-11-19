import { CheckCircle2, Warehouse } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import PageHeaderIcon from '../../../components/common/PageHeaderIcon';
import FormulasModalButton from '../../../components/common/FormulasModalButton';
import Action3DButton from '../../../components/common/Action3DButton';
import { GmaoKpiCard, GmaoKpiGrid } from '../../../components/common/GmaoKpiCard';
import { CubeIcon } from '../../../components/common/icons/CubeIcon';
import { LayersIcon } from '../../../components/common/icons/LayersIcon';
import { isComponentNature, isPartNature } from '../../../../core/domain/EntrepotItem';

export interface EntrepotHeaderAndKpisProps {
  t: (key: string, paramsOrFallback?: Record<string, unknown> | string) => string;
  totalWarehouseCount: number;
  activeWarehouseTab: 'COMPONENTS' | 'PARTS';
  onTabSwitch: (tab: 'COMPONENTS' | 'PARTS') => void;
  canCreateStock: boolean;
  onOpenFormulas: () => void;
  onOpenAddModal: () => void;
  kpis: {
    total: number;
    components: number;
    parts: number;
    enService: number;
    enStock: number;
    enRevision: number;
  };
  activeKpiFilter: string;
  setActiveKpiFilter: (val: string) => void;
  currentNatureFilter: string;
  changeNatureFilter: (val: string) => void;
}

export function EntrepotHeaderAndKpis({
  t,
  totalWarehouseCount,
  activeWarehouseTab,
  onTabSwitch,
  canCreateStock,
  onOpenFormulas,
  onOpenAddModal,
  kpis,
  activeKpiFilter,
  setActiveKpiFilter,
  currentNatureFilter,
  changeNatureFilter,
}: EntrepotHeaderAndKpisProps) {
  return (
    <>
      {/* 1. Top Banner */}
      <div className="bg-white px-4 py-3.5 md:px-5 md:py-4 rounded-2xl border border-slate-200/90 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3.5 relative overflow-hidden group/header">
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none group-hover/header:bg-indigo-500/10 transition-colors duration-500" />

        <div className="min-w-0 flex-1 flex items-start sm:items-center gap-3 relative">
          <PageHeaderIcon icon={Warehouse} colorClass="text-indigo-700" />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg md:text-xl font-black text-slate-900 tracking-tight">
                {t('entrepot.title')}
              </h2>
              <span className="px-2.5 py-0.5 text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full">
                {t('entrepot.registered_count', { count: totalWarehouseCount })}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 max-w-3xl leading-snug line-clamp-1">
              {t('entrepot.subtitle')}
            </p>
          </div>
        </div>

        {/* Unified Single-Row Tab Switcher + Action Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 shrink-0 relative">
          <div className="inline-grid grid-cols-2 p-1 bg-slate-100/90 rounded-2xl border border-slate-200/90 shadow-2xs w-full sm:w-[320px] select-none">
            <button
              type="button"
              onClick={() => onTabSwitch('COMPONENTS')}
              className={`w-full py-1.5 px-3 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeWarehouseTab === 'COMPONENTS'
                  ? 'bg-white text-blue-950 shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 border border-transparent'
              }`}
            >
              <CubeIcon className={`w-4 h-4 shrink-0 ${activeWarehouseTab === 'COMPONENTS' ? 'text-blue-600' : 'text-slate-500'}`} />
              <span className="truncate">{t('entrepot.tabs.components')} ({kpis.components})</span>
            </button>

            <button
              type="button"
              onClick={() => onTabSwitch('PARTS')}
              className={`w-full py-1.5 px-3 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeWarehouseTab === 'PARTS'
                  ? 'bg-white text-indigo-950 shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 border border-transparent'
              }`}
            >
              <LayersIcon className={`w-4 h-4 shrink-0 ${activeWarehouseTab === 'PARTS' ? 'text-indigo-600' : 'text-slate-500'}`} />
              <span className="truncate">{t('entrepot.tabs.parts')} ({kpis.parts})</span>
            </button>
          </div>

          <div className="flex items-center justify-end gap-2">
            <FormulasModalButton
              onClick={onOpenFormulas}
              title={t('entrepot.buttons.view_formulas')}
            />

            {canCreateStock && (
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={`action-btn-${activeWarehouseTab}`}
                  initial={{ scale: 0.82, rotate: -12, opacity: 0 }}
                  animate={{ scale: 1, rotate: 0, opacity: 1 }}
                  exit={{ scale: 0.82, rotate: 12, opacity: 0 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                >
                  <Action3DButton
                    variant="circle"
                    color={activeWarehouseTab === 'COMPONENTS' ? 'blue' : 'indigo'}
                    icon={activeWarehouseTab === 'COMPONENTS' ? CubeIcon : LayersIcon}
                    showAddBadge={true}
                    onClick={onOpenAddModal}
                    title={
                      activeWarehouseTab === 'COMPONENTS'
                        ? t('entrepot.buttons.add_component')
                        : t('entrepot.buttons.add_part')
                    }
                  />
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        </div>
      </div>

      {/* 2. Top Metric Cards */}
      <GmaoKpiGrid columns={4}>
        <GmaoKpiCard
          title={t('entrepot.stats.global_inventory')}
          value={kpis.total}
          unit="éléments"
          icon={Warehouse}
          color="teal"
          valueColored={false}
          isActive={activeKpiFilter === 'ALL' && currentNatureFilter === 'ALL'}
          onClick={() => {
            setActiveKpiFilter('ALL');
            changeNatureFilter('ALL');
          }}
          badgeText={t('entrepot.stats.global_sub')}
          footerLabel="Feuille Entrepôt :"
          footerValue="Vue complète"
        />

        <GmaoKpiCard
          title={t('entrepot.stats.components_title')}
          value={kpis.components}
          unit="ensembles"
          icon={CubeIcon}
          color="blue"
          isActive={isComponentNature(currentNatureFilter) || isComponentNature(activeKpiFilter)}
          onClick={() => {
            setActiveKpiFilter('COMPONENT');
            changeNatureFilter('COMPONENT');
          }}
          badgeText={t('entrepot.stats.components_sub')}
          footerLabel="Architecture :"
          footerValue="Sous-systèmes"
        />

        <GmaoKpiCard
          title={t('entrepot.stats.parts_title')}
          value={kpis.parts}
          unit="pièces"
          icon={LayersIcon}
          color="indigo"
          isActive={isPartNature(currentNatureFilter) || isPartNature(activeKpiFilter)}
          onClick={() => {
            setActiveKpiFilter('PART');
            changeNatureFilter('PART');
          }}
          badgeText={t('entrepot.stats.parts_sub')}
          footerLabel="Nomenclature :"
          footerValue="Pièces élémentaires"
        />

        <GmaoKpiCard
          title={t('entrepot.stats.active_service')}
          value={kpis.enService}
          unit="actifs"
          icon={CheckCircle2}
          color="emerald"
          isActive={activeKpiFilter === 'SERVICE'}
          onClick={() => setActiveKpiFilter('SERVICE')}
          badgeText={t('entrepot.stats.active_service_sub')}
          footerLabel="Taux affectation :"
          footerValue={`${kpis.total ? Math.round((kpis.enService / kpis.total) * 100) : 0}%`}
        />
      </GmaoKpiGrid>
    </>
  );
}
