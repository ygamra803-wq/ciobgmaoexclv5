import type { RefObject } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  Factory,
  Layers,
  MapPin,
  Tag,
} from 'lucide-react';
import CustomSelect from '../../../components/common/CustomSelect';
import IndustrialFilterCard, {
  FilterField,
  FilterSearchInput,
} from '../../../components/common/IndustrialFilterCard';
import { isPartNature } from '../../../../core/domain/EntrepotItem';
import type { IPartGroup } from '../../../../types/domain';
import type {
  EntrepotCatalogFamily,
  EntrepotCatalogType,
} from '../hooks/useEntrepotController';

export interface EntrepotFilterBarProps {
  t: (key: string, paramsOrFallback?: Record<string, unknown> | string) => string;
  filteredCount: number;
  totalCount: number;
  hasActiveFilters: boolean;
  onReset: () => void;
  onExportExcel: () => void;
  presets: Array<{
    key: string;
    label: string;
    count: number;
    colorDot: string | null;
    isActive: boolean;
    onClick: () => void;
  }>;
  activeFilters: Array<{ key: string; label: string; onRemove: () => void }>;
  activeWarehouseTab: 'COMPONENTS' | 'PARTS';
  localSearch: string;
  setLocalSearch: (val: string) => void;
  setWhSearch?: (val: string) => void;
  currentNatureFilter: string;
  changeNatureFilter: (val: string) => void;
  setActiveKpiFilter: (val: string) => void;
  currentPartGroupFilter: string;
  changePartGroupFilter: (val: string) => void;
  effectivePartGroups: IPartGroup[];
  currentTypeFilter: string;
  changeTypeFilter: (val: string) => void;
  types: EntrepotCatalogType[];
  currentFamilyFilter: string;
  changeFamilyFilter: (val: string) => void;
  changeTemplateFilter?: (val: string) => void;
  families: EntrepotCatalogFamily[];
  currentRattachementFilter: string;
  changeRattachementFilter: (val: string) => void;
  sortMenuRef: RefObject<HTMLDivElement | null>;
  showSortMenu: boolean;
  setShowSortMenu: (val: boolean) => void;
  sortField: string;
  sortOrder: 'asc' | 'desc';
  handleSort: (field: string) => void;
}

export function EntrepotFilterBar({
  t,
  filteredCount,
  totalCount,
  hasActiveFilters,
  onReset,
  onExportExcel,
  presets,
  activeFilters,
  activeWarehouseTab,
  localSearch,
  setLocalSearch,
  setWhSearch,
  currentNatureFilter,
  changeNatureFilter,
  setActiveKpiFilter,
  currentPartGroupFilter,
  changePartGroupFilter,
  effectivePartGroups,
  currentTypeFilter,
  changeTypeFilter,
  types,
  currentFamilyFilter,
  changeFamilyFilter,
  changeTemplateFilter,
  families,
  currentRattachementFilter,
  changeRattachementFilter,
  sortMenuRef,
  showSortMenu,
  setShowSortMenu,
  sortField,
  sortOrder,
  handleSort,
}: EntrepotFilterBarProps) {
  const isPartsMode = activeWarehouseTab === 'PARTS' || isPartNature(currentNatureFilter);

  return (
    <IndustrialFilterCard
      title={t('common.filters.title')}
      subtitle={t('entrepot.filters.subtitle')}
      color="amber"
      filteredCount={filteredCount}
      totalCount={totalCount}
      hasActiveFilters={hasActiveFilters}
      onReset={onReset}
      onExportExcel={onExportExcel}
      exportLabel={t('entrepot.filters.export_excel')}
      presets={presets}
      presetsLabel={t('entrepot.filters.status_label')}
      activeFilters={activeFilters}
      onClearAll={onReset}
    >
      <div
        className={`grid grid-cols-1 sm:grid-cols-2 ${
          isPartsMode ? 'lg:grid-cols-6' : 'lg:grid-cols-5'
        } gap-3.5 items-end`}
      >
        {/* 1. Omni-Text Search */}
        <FilterSearchInput
          value={localSearch}
          onChange={setLocalSearch}
          onClear={() => {
            setLocalSearch('');
            if (setWhSearch) setWhSearch('');
          }}
          placeholder={t('entrepot.filters.search_placeholder')}
          colBadge="Omni"
          colBadgeColor="slate"
          focusRingColor="focus:ring-amber-500"
          className="w-full sm:col-span-2 lg:col-span-1"
        />

        {/* 2. Nature Twin Filter (Col. B) */}
        <FilterField label={t('entrepot.modal.nature')} colBadge="Col. B" colBadgeColor="amber">
          <CustomSelect
            value={currentNatureFilter}
            prefixIcon={
              <span className="w-5 h-5 rounded-md bg-amber-100 border border-amber-300/80 flex items-center justify-center text-amber-700 shadow-2xs">
                <Layers className="w-3 h-3" />
              </span>
            }
            onChange={(val) => {
              changeNatureFilter(val);
              setActiveKpiFilter('ALL');
            }}
            options={[
              { value: 'ALL', label: t('entrepot.filters.all_statuses'), badge: '[B]', badgeColor: 'bg-teal-50 text-teal-800' },
              { value: 'COMPONENT', label: t('entrepot.modal.nature_component'), badge: '[B]', badgeColor: 'bg-blue-50 text-blue-800' },
              { value: 'PART', label: t('entrepot.modal.nature_part'), badge: '[B]', badgeColor: 'bg-indigo-50 text-indigo-800' },
            ]}
          />
        </FilterField>

        {/* 2b. Groupe de Parts (Niv 1) when in PARTS mode */}
        {isPartsMode && (
          <FilterField
            label={t('part_types.filter_group_label', 'Groupe Part (Niv 1)')}
            colBadge="Niv 1"
            colBadgeColor="teal"
          >
            <CustomSelect
              value={currentPartGroupFilter}
              prefixIcon={
                <span className="w-5 h-5 rounded-md bg-teal-100 border border-teal-300/80 flex items-center justify-center text-teal-700 shadow-2xs">
                  <Layers className="w-3 h-3" />
                </span>
              }
              onChange={(val) => {
                changePartGroupFilter(val);
                changeTypeFilter('ALL');
              }}
              options={[
                {
                  value: 'ALL',
                  label: `${t('part_types.all_groups', 'Tous les Groupes')} (${effectivePartGroups.length})`,
                },
                ...effectivePartGroups.map((g: IPartGroup) => ({
                  value: String(g.id_group || g.id_groupe || g.code || ''),
                  label: `${g.code || g.id_group} — ${g.libelle}`,
                })),
                {
                  value: 'UNASSIGNED',
                  label: t('part_types.unassigned_group', 'Non classés'),
                },
              ]}
            />
          </FilterField>
        )}

        {/* 3. Classification (Famille or Type) */}
        <FilterField
          label={isPartsMode ? t('entrepot.modal.type') : t('entrepot.filters.family_label')}
          colBadge={isPartsMode ? 'Col. B' : 'Col. D'}
          colBadgeColor="amber"
        >
          {isPartsMode ? (
            <CustomSelect
              value={currentTypeFilter}
              prefixIcon={
                <span className="w-5 h-5 rounded-md bg-amber-100 border border-amber-300/80 flex items-center justify-center text-amber-700 shadow-2xs">
                  <Tag className="w-3 h-3" />
                </span>
              }
              onChange={(val) => changeTypeFilter(val)}
              options={[
                { value: 'ALL', label: `${t('entrepot.filters.all_types')} (${types.length})` },
                ...types
                  .filter((tObj: EntrepotCatalogType) => {
                    if (currentPartGroupFilter === 'ALL') return true;
                    const gId = String(tObj.id_group || tObj.id_groupe || '').trim().toUpperCase();
                    if (currentPartGroupFilter === 'UNASSIGNED') return !gId;
                    return gId === String(currentPartGroupFilter).trim().toUpperCase();
                  })
                  .map((tObj: EntrepotCatalogType) => ({
                    value: String(tObj.id_type || ''),
                    label: `${tObj.libelle} (${tObj.id_type})`,
                  })),
              ]}
            />
          ) : (
            <CustomSelect
              value={currentFamilyFilter}
              prefixIcon={
                <span className="w-5 h-5 rounded-md bg-amber-100 border border-amber-300/80 flex items-center justify-center text-amber-700 shadow-2xs">
                  <Factory className="w-3 h-3" />
                </span>
              }
              onChange={(val) => {
                changeFamilyFilter(val);
                if (changeTemplateFilter) changeTemplateFilter('ALL');
              }}
              options={[
                { value: 'ALL', label: `${t('entrepot.filters.all_families')} (${families.length})` },
                ...families.map((f) => ({
                  value: f.id_family,
                  label: `${f.libelle} (${f.id_family})`,
                })),
              ]}
            />
          )}
        </FilterField>

        {/* 4. Rattachement & Emplacement (Col. E) */}
        <FilterField label={t('entrepot.filters.rattachement_label')} colBadge="Col. E" colBadgeColor="amber">
          <CustomSelect
            value={currentRattachementFilter}
            prefixIcon={
              <span className="w-5 h-5 rounded-md bg-amber-100 border border-amber-300/80 flex items-center justify-center text-amber-700 shadow-2xs">
                <MapPin className="w-3 h-3" />
              </span>
            }
            onChange={(val) => changeRattachementFilter(val)}
            options={[
              { value: 'ALL', label: t('entrepot.filters.all_rattachements') },
              { value: 'MACHINE', label: '🏭 Machine', badge: '[E]', badgeColor: 'bg-teal-50 text-teal-800' },
              { value: 'ZONE', label: '📍 Zone / Atelier', badge: '[F]', badgeColor: 'bg-purple-50 text-purple-800' },
              { value: 'ENTREPOT', label: '🏢 Entrepôt Central', badge: '[E]', badgeColor: 'bg-slate-100 text-slate-800' },
            ]}
          />
        </FilterField>

        {/* 5. Sort Menu Button & Popover */}
        <div className="relative" ref={sortMenuRef}>
          <div className="flex items-center justify-between mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-800">
            <span>{t('entrepot.filters.sort_label')}</span>
            <span className="px-1.5 py-0.2 rounded text-[9.5px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80">
              Ordre
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowSortMenu(!showSortMenu)}
            className={`w-full h-9 px-2.5 rounded-xl border text-xs font-semibold transition flex items-center justify-between cursor-pointer ${
              showSortMenu || sortField !== 'id_warehouse_item' || sortOrder !== 'asc'
                ? 'bg-amber-50/80 text-amber-950 border-amber-300 ring-1 ring-amber-200'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center gap-2 truncate">
              <span className="w-5 h-5 rounded-md bg-amber-100 border border-amber-300/80 flex items-center justify-center text-amber-700 shrink-0 shadow-2xs">
                <ArrowUpDown className="w-3 h-3" />
              </span>
              <span className="truncate">
                {t('entrepot.filters.sort_by')}{' '}
                <b className="font-mono text-slate-900">{sortField.slice(0, 10).toUpperCase()}</b> (
                {sortOrder === 'asc' ? t('entrepot.filters.order_asc') : t('entrepot.filters.order_desc')})
              </span>
            </div>
            <ChevronDown
              className={`w-3 h-3 text-slate-400 transition-transform shrink-0 ${showSortMenu ? 'rotate-180' : ''}`}
            />
          </button>

          {showSortMenu && (
            <div className="absolute right-0 mt-1 w-64 bg-white rounded-2xl border border-slate-200 shadow-xl z-50 p-2.5 space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <span>{t('entrepot.filters.sort_label')}</span>
                <span>A→H</span>
              </div>
              <div className="grid grid-cols-1 gap-1 text-xs max-h-60 overflow-y-auto pr-0.5">
                {[
                  { key: 'id_warehouse_item', label: t('entrepot.filters.code_col') },
                  { key: 'nature', label: t('entrepot.modal.nature') },
                  { key: 'designation', label: t('entrepot.filters.designation_col') },
                  { key: 'id_family', label: t('entrepot.filters.family_col') },
                  { key: 'rattachement_type', label: t('entrepot.filters.rattachement_col') },
                  { key: 'emplacement', label: t('entrepot.filters.location_col') },
                  { key: 'status', label: t('entrepot.filters.status_col') },
                  { key: 'stockActuel', label: t('entrepot.filters.stock_col') },
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
