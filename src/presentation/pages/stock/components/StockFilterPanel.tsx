import type { Dispatch, RefObject, SetStateAction } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Boxes,
  ChevronDown,
  Download,
  MapPin,
  Package,
  Upload,
} from 'lucide-react';
import CustomSelect from '../../../components/common/CustomSelect';
import IndustrialFilterCard, {
  FilterField,
  FilterSearchInput,
} from '../../../components/common/IndustrialFilterCard';
import { listPdrTypesByGroup } from '../../../../domain/stock/pdrHierarchyService';
import { downloadPdrCatalogWorkbook } from '../../../../services/pdrHierarchyExcelService';
import type { IStockItem, IType, PdrGroup, StockType } from '../../../../types/domain';

interface StockFilterPanelProps {
  t: (key: string, fallback?: string) => string;
  stockItems: IStockItem[];
  filteredCount: number;
  effectivePdrGroups: PdrGroup[];
  types: IType[];
  availableTypes: IType[];
  emplacements: string[];
  localSearch: string;
  setLocalSearch: Dispatch<SetStateAction<string>>;
  setStockSearch: (val: string) => void;
  stockGroupFilter: string;
  setStockGroupFilter: Dispatch<SetStateAction<string>>;
  stockTypeFilter: string;
  setStockTypeFilter: (val: string) => void;
  activeKpiFilter: string;
  setActiveKpiFilter: Dispatch<SetStateAction<string>>;
  stockAlertOnly: boolean;
  setStockAlertOnly: (val: boolean) => void;
  stockEmplacementFilter: string;
  setStockEmplacementFilter: Dispatch<SetStateAction<string>>;
  stockCriticiteFilter: string;
  setStockCriticiteFilter: Dispatch<SetStateAction<string>>;
  stockDomaineFilter: string;
  setStockDomaineFilter: Dispatch<SetStateAction<string>>;
  sortField: string;
  sortOrder: 'asc' | 'desc';
  showSortMenu: boolean;
  setShowSortMenu: Dispatch<SetStateAction<boolean>>;
  sortMenuRef: RefObject<HTMLDivElement | null>;
  handleSort: (field: string) => void;
  hasActiveFilters: boolean;
  clearAllFilters: () => void;
  handleExportExcel: () => void;
  stockFilterPresets: Array<{
    key: string;
    label: string;
    count: number;
    activeBg: string;
    colorDot?: string;
    onClick: () => void;
    isActive: boolean;
  }>;
  activeStockFilterChips: Array<{ key: string; label: string; onRemove: () => void }>;
  canEditStock: boolean;
  onOpenPdrExcelModal: () => void;
  onOpenGroupsModal: () => void;
}

export function StockFilterPanel({
  t,
  stockItems,
  filteredCount,
  effectivePdrGroups,
  types,
  availableTypes,
  emplacements,
  localSearch,
  setLocalSearch,
  setStockSearch,
  stockGroupFilter,
  setStockGroupFilter,
  stockTypeFilter,
  setStockTypeFilter,
  activeKpiFilter,
  setActiveKpiFilter,
  stockAlertOnly,
  setStockAlertOnly,
  stockEmplacementFilter,
  setStockEmplacementFilter,
  stockCriticiteFilter,
  setStockCriticiteFilter,
  stockDomaineFilter,
  setStockDomaineFilter,
  sortField,
  sortOrder,
  showSortMenu,
  setShowSortMenu,
  sortMenuRef,
  handleSort,
  hasActiveFilters,
  clearAllFilters,
  handleExportExcel,
  stockFilterPresets,
  activeStockFilterChips,
  canEditStock,
  onOpenPdrExcelModal,
  onOpenGroupsModal,
}: StockFilterPanelProps) {
  return (
    <IndustrialFilterCard
      title={t('common.filters.title')}
      subtitle={t('stock.filters_subtitle', 'Catalogue Pièces de Rechange • Liaisons Excel Colonnes B → K')}
      color="amber"
      filteredCount={filteredCount}
      totalCount={stockItems.length}
      hasActiveFilters={hasActiveFilters}
      onReset={clearAllFilters}
      onExportExcel={handleExportExcel}
      exportLabel={t('common.filters.export_excel')}
      presets={stockFilterPresets}
      presetsLabel={t('common.filters.state')}
      activeFilters={activeStockFilterChips}
      onClearAll={clearAllFilters}
    >
      {/* PDR Hierarchy Summary & Management */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-amber-100/90">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
            Hiérarchie PDR (N1 ➔ N2 ➔ SKU) :
          </span>
          <span className="px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 font-mono text-[10.5px] font-bold">
            Groupe ({effectivePdrGroups.length})
          </span>
          <span className="text-slate-400 text-xs font-bold">➔</span>
          <span className="px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 font-mono text-[10.5px] font-bold">
            Type ({availableTypes.length})
          </span>
          <span className="text-slate-400 text-xs font-bold">➔</span>
          <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700 font-mono text-[10.5px] font-bold">
            SKU / Ref ({stockItems.length})
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() =>
              downloadPdrCatalogWorkbook({
                pdrGroups: effectivePdrGroups,
                types: types as StockType[],
                rawStock: stockItems,
              })
            }
            data-testid="btn-quick-export-pdr-catalog"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs cursor-pointer active:scale-95"
            title="Exporter le catalogue PDR à 3 feuilles (PDR_GROUPS, PDR_TYPES, PDR_ITEMS)"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exporter catalogue PDR (Groupes / Types / Articles)</span>
          </button>
          {canEditStock && (
            <>
              <button
                type="button"
                onClick={onOpenPdrExcelModal}
                data-testid="btn-open-pdr-excel-modal"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-xs cursor-pointer active:scale-95"
                title="Importer ou exporter un classeur Excel PDR hiérarchique (.xlsx)"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Importer Catalogue PDR (.xlsx)</span>
              </button>
              <button
                type="button"
                onClick={onOpenGroupsModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition shadow-xs cursor-pointer active:scale-95"
              >
                <Package className="w-3.5 h-3.5 text-indigo-300" />
                <span>Gérer Groupes PDR</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* 5-Column Multi-Criteria Filter Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 items-end">
        <FilterSearchInput
          value={localSearch}
          onChange={setLocalSearch}
          onClear={() => {
            setLocalSearch('');
            setStockSearch('');
          }}
          placeholder={t('stock.search_placeholder', 'Ref, désignation, emplacement...')}
          colBadge="Col. B+C"
          colBadgeColor="slate"
          focusRingColor="focus:ring-amber-500"
          className="w-full sm:col-span-2 lg:col-span-1"
        />

        <FilterField label={t('stock.pdr_group', 'Groupe PDR')} colBadge="Niveau 1" colBadgeColor="indigo">
          <CustomSelect
            value={stockGroupFilter}
            prefixIcon={
              <span className="w-5 h-5 rounded-md bg-indigo-100 border border-indigo-300/80 flex items-center justify-center text-indigo-700 shadow-2xs">
                <Package className="w-3 h-3" />
              </span>
            }
            onChange={(val: string) => {
              setStockGroupFilter(val);
              if (val !== 'ALL' && stockTypeFilter !== 'ALL') {
                const subTypes = listPdrTypesByGroup(types, val);
                const stillValid = subTypes.some(
                  (tItem) => (tItem.id_type || tItem.libelle) === stockTypeFilter
                );
                if (!stillValid) setStockTypeFilter('ALL');
              }
            }}
            options={[
              { value: 'ALL', label: `Tous les Groupes (${effectivePdrGroups.length})` },
              { value: 'UNCLASSIFIED', label: 'Non classé / Sans groupe' },
              ...effectivePdrGroups.map((g) => ({
                value: g.id,
                label: `${g.code} — ${g.libelle}`,
              })),
            ]}
          />
        </FilterField>

        <FilterField label={t('stock.piece_type', 'Type de Pièce')} colBadge="Niveau 2" colBadgeColor="amber">
          <CustomSelect
            value={stockTypeFilter}
            prefixIcon={
              <span className="w-5 h-5 rounded-md bg-amber-100 border border-amber-300/80 flex items-center justify-center text-amber-700 shadow-2xs">
                <Boxes className="w-3 h-3" />
              </span>
            }
            onChange={(val: string) => setStockTypeFilter(val)}
            options={[
              {
                value: 'ALL',
                label: `${t('stock.all_types', 'Tous les Types')} (${availableTypes.length})`,
              },
              ...availableTypes.map((tItem) => {
                const val = typeof tItem === 'string' ? tItem : tItem.id_type || tItem.libelle;
                const label = typeof tItem === 'string' ? tItem : tItem.libelle || tItem.id_type;
                return { value: val, label: `${label}` };
              }),
            ]}
          />
        </FilterField>

        <FilterField label={t('stock.state_alert', 'État / Alerte')} colBadge="Col. J" colBadgeColor="amber">
          <CustomSelect
            value={activeKpiFilter !== 'ALL' ? activeKpiFilter : stockAlertOnly ? 'ALL_ALERTS' : 'ALL'}
            prefixIcon={
              <span className="w-5 h-5 rounded-md bg-amber-100 border border-amber-300/80 flex items-center justify-center text-amber-700 shadow-2xs">
                <AlertTriangle className="w-3 h-3" />
              </span>
            }
            onChange={(val: string) => {
              if (val === 'ALL') {
                setActiveKpiFilter('ALL');
                setStockAlertOnly(false);
              } else if (val === 'ALL_ALERTS') {
                setActiveKpiFilter('ALL');
                setStockAlertOnly(true);
              } else {
                setActiveKpiFilter(val);
                setStockAlertOnly(false);
              }
            }}
            options={[
              { value: 'ALL', label: t('stock.all_states', 'Tous États') },
              { value: 'OK', label: t('stock.state_ok', '🟢 Stock Normal (OK)') },
              { value: 'ALERTE', label: t('stock.state_alert_opt', '🟡 Alerte Seuil') },
              { value: 'RUPTURE', label: t('stock.state_rupture_opt', '🔴 Rupture de Stock') },
              { value: 'ALL_ALERTS', label: t('stock.all_alerts', '⚡ Toutes Alertes') },
            ]}
          />
        </FilterField>

        <FilterField label={t('stock.emplacement', 'Emplacement')} colBadge="Col. K" colBadgeColor="amber">
          <CustomSelect
            value={stockEmplacementFilter}
            prefixIcon={
              <span className="w-5 h-5 rounded-md bg-amber-100 border border-amber-300/80 flex items-center justify-center text-amber-700 shadow-2xs">
                <MapPin className="w-3 h-3" />
              </span>
            }
            onChange={(val: string) => setStockEmplacementFilter(val)}
            options={[
              { value: 'ALL', label: t('stock.all_emplacements', 'Tous Emplacements') },
              ...emplacements.map((emp) => ({ value: emp, label: emp })),
            ]}
          />
        </FilterField>

        <FilterField label="Criticité (ABC)" colBadge="ABC" colBadgeColor="rose">
          <CustomSelect
            value={stockCriticiteFilter}
            prefixIcon={
              <span className="w-5 h-5 rounded-md bg-rose-100 border border-rose-300/80 flex items-center justify-center text-rose-700 shadow-2xs font-mono text-[10px] font-black">
                {stockCriticiteFilter === 'ALL' ? 'ABC' : stockCriticiteFilter}
              </span>
            }
            onChange={(val: string) => setStockCriticiteFilter(val)}
            options={[
              { value: 'ALL', label: 'Toutes Criticités (A/B/C)' },
              { value: 'A', label: '🔴 Classe A — Vital / Critique' },
              { value: 'B', label: '🟡 Classe B — Majeur / Important' },
              { value: 'C', label: '🟢 Classe C — Standard / Courant' },
            ]}
          />
        </FilterField>

        <FilterField label="Domaine Technique" colBadge="Métier" colBadgeColor="indigo">
          <CustomSelect
            value={stockDomaineFilter}
            prefixIcon={
              <span className="w-5 h-5 rounded-md bg-indigo-100 border border-indigo-300/80 flex items-center justify-center text-indigo-700 shadow-2xs font-mono text-[9px] font-black">
                DOM
              </span>
            }
            onChange={(val: string) => setStockDomaineFilter(val)}
            options={[
              { value: 'ALL', label: 'Tous Domaines Techniques' },
              { value: 'MECANIQUE', label: '⚙️ MÉCANIQUE' },
              { value: 'ELECTRIQUE', label: '⚡ ÉLECTRIQUE' },
              { value: 'HYDRAULIQUE', label: '💧 HYDRAULIQUE' },
              { value: 'PNEUMATIQUE', label: '💨 PNEUMATIQUE' },
              { value: 'AUTOMATISME', label: '🤖 AUTOMATISME' },
              { value: 'LUBRIFIANTS', label: '🛢️ LUBRIFIANTS' },
              { value: 'CONSOMMABLES', label: '🧰 CONSOMMABLES' },
            ]}
          />
        </FilterField>

        {/* Sort Menu Button & Popover */}
        <div className="relative" ref={sortMenuRef}>
          <div className="flex items-center justify-between mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-800">
            <span>{t('common.filters.sort_and_order', 'Tri & Ordre')}</span>
            <span className="px-1.5 py-0.2 rounded text-[9.5px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80">
              Col. B→K
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowSortMenu(!showSortMenu)}
            className={`w-full h-9 px-2.5 rounded-xl border text-xs font-semibold transition flex items-center justify-between cursor-pointer ${
              showSortMenu || sortField !== 'type' || sortOrder !== 'asc'
                ? 'bg-amber-50/80 text-amber-950 border-amber-300 ring-1 ring-amber-200'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center gap-2 truncate">
              <span className="w-5 h-5 rounded-md bg-amber-100 border border-amber-300/80 flex items-center justify-center text-amber-700 shrink-0 shadow-2xs">
                <ArrowUpDown className="w-3 h-3" />
              </span>
              <span className="truncate">
                {t('common.filters.sort_prefix', 'Tri :')}{' '}
                <b className="font-mono text-slate-900">{sortField.slice(0, 10).toUpperCase()}</b> (
                {sortOrder === 'asc' ? t('common.filters.asc', 'A→Z') : t('common.filters.desc', 'Z→A')})
              </span>
            </div>
            <ChevronDown
              className={`w-3 h-3 text-slate-400 transition-transform shrink-0 ${showSortMenu ? 'rotate-180' : ''}`}
            />
          </button>

          {showSortMenu && (
            <div className="absolute right-0 mt-1 w-64 bg-white rounded-2xl border border-slate-200 shadow-xl z-50 p-2.5 space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <span>{t('common.filters.sort_columns_title', 'Sélectionner la Colonne de Tri')}</span>
                <span>B→K</span>
              </div>
              <div className="grid grid-cols-1 gap-1 text-xs max-h-60 overflow-y-auto pr-0.5">
                {[
                  { key: 'ref', label: t('stock.columns.ref', 'REF (Col. B)') },
                  { key: 'designation', label: t('stock.columns.designation', 'Désignation (Col. C)') },
                  { key: 'type', label: t('stock.columns.type', 'Type de Pièce (Col. D)') },
                  { key: 'stockInitial', label: t('stock.columns.initial', 'Stock Initial (Col. E)') },
                  { key: 'entrees', label: t('stock.columns.entrees', 'Entrées Réappro (Col. F)') },
                  { key: 'sorties', label: t('stock.columns.sorties', 'Sorties Totales (Col. G)') },
                  { key: 'stockActuel', label: t('stock.columns.actuel', 'Stock Actuel (Col. H)') },
                  { key: 'seuil', label: t('stock.columns.seuil', 'Seuil Critique (Col. I)') },
                  { key: 'alerte', label: t('stock.columns.alerte', 'Alerte & État (Col. J)') },
                  { key: 'emplacement', label: t('stock.columns.emplacement', 'Emplacement (Col. K)') },
                ].map((col) => (
                  <button
                    key={col.key}
                    type="button"
                    onClick={() => {
                      handleSort(col.key);
                      setShowSortMenu(false);
                    }}
                    className={`px-2.5 py-1.5 rounded-lg border text-left font-medium text-[11px] flex items-center justify-between transition cursor-pointer ${
                      sortField === col.key
                        ? 'bg-amber-50 text-amber-950 border-amber-300 font-bold'
                        : 'bg-slate-50 text-slate-700 border-slate-200/80 hover:bg-slate-100'
                    }`}
                  >
                    <span>{col.label}</span>
                    {sortField === col.key &&
                      (sortOrder === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-amber-700" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-amber-700" />
                      ))}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </IndustrialFilterCard>
  );
}
