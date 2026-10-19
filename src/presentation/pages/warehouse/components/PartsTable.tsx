import { useMemo } from 'react';
import {
  Tag,
  Hash,
  Copy,
  Package,
  Layers as LayersIcon,
  MapPin,
  Warehouse,
  Factory,
  User,
  Activity,
  TrendingUp,
  Wrench,
  MoreVertical,
  CheckCircle2,
  Plus,
  Scale,
  Info,
  Edit2,
  Trash2,
} from 'lucide-react';
import GmaoIndustrialDataGrid from '../../../components/common/GmaoIndustrialDataGrid';
import { EntrepotItem } from '../../../../core/domain';
import { useTranslation } from '../../../../i18n/I18nContext';

export default function PartsTable({
  displayedData = [],
  rawLength: _rawLength = 0,
  isTableReady = true,
  startIndex = 0,
  sortField: _sortField = 'id_warehouse_item',
  sortOrder: _sortOrder = 'asc',
  handleSort,
  renderSortIcon,
  types = [],
  diagnostics = [],
  zones = [],
  machines = [],
  activeActionMenuId = null,
  setActiveActionMenuId,
  handleOpenQuickModal,
  setSelectedDetails,
  handleOpenEditModal,
  setToDelete,
  canEditStock = true,
  canDeleteStock = true,
  onNavigateToType,
  onNavigateToPartTypes,
  onNavigateToDiag,
  onNavigateToMachine,
  onNavigateToZone,
  handleOpenAddModal,
}) {
  const { t } = useTranslation();
  const columns = useMemo(
    () => [
      {
        key: 'id_warehouse_item',
        label: t('entrepot.columns.code_ref'),
        colLetter: 'A',
        icon: Tag,
        sortable: true,
        headerClassName: 'whitespace-nowrap',
      },
      {
        key: 'id_type',
        label: t('entrepot.columns.type_class'),
        colLetter: 'D',
        icon: LayersIcon,
        sortable: true,
        headerClassName: 'whitespace-nowrap',
      },
      {
        key: 'designation',
        label: t('entrepot.columns.designation'),
        colLetter: 'C',
        icon: Package,
        sortable: true,
        headerClassName: 'min-w-[220px]',
      },
      {
        key: 'rattachement_type',
        label: t('entrepot.columns.rattachement'),
        colLetter: 'E',
        icon: MapPin,
        sortable: true,
        headerClassName: 'whitespace-nowrap',
      },
      {
        key: 'technician',
        label: t('entrepot.columns.responsible'),
        colLetter: 'F',
        icon: User,
        sortable: true,
        headerClassName: 'whitespace-nowrap',
      },
      {
        key: 'statut',
        label: t('entrepot.columns.status'),
        colLetter: 'G',
        icon: Activity,
        sortable: true,
        headerClassName: 'whitespace-nowrap',
      },
      {
        key: 'stock',
        label: t('entrepot.columns.stock'),
        colLetter: 'H',
        icon: TrendingUp,
        sortable: true,
        align: 'right',
        headerClassName: 'min-w-[130px]',
      },
      {
        key: 'actions',
        label: '•••',
        align: 'center',
        headerClassName: 'w-20 tracking-widest text-slate-400 font-bold',
      },
    ],
    [t]
  );
  return (
    <GmaoIndustrialDataGrid
      title={t('entrepot.table.title')}
      icon={<LayersIcon className="w-4 h-4 text-indigo-600" />}
      excelMapping="id_warehouse_item (A) | nature: PART (B) | designation (C) | type/diag (D) | rattachement/magasin (E) | responsable (F) | statut (G) | stock (H)"
      bannerColor="indigo"
      columns={columns}
      data={displayedData}
      isLoading={!isTableReady}
      loadingRowsCount={8}
      sortField={_sortField}
      sortOrder={_sortOrder}
      onSort={handleSort}
      renderSortIcon={renderSortIcon}
      startIndex={startIndex}
      showRowNumber={true}
      minWidth="min-w-[980px]"
      maxHeight="max-h-[62vh]"
      emptyIcon={<LayersIcon className="w-10 h-10 text-indigo-300 stroke-1" />}
      emptyMessage={t('entrepot.table.empty_msg')}
      emptyAction={
        handleOpenAddModal ? (
          <button
            onClick={handleOpenAddModal}
            className="mt-2 px-4 py-2 rounded-xl bg-indigo-50 text-indigo-700 font-bold hover:bg-indigo-100 border border-indigo-200 transition cursor-pointer"
          >
            {t('entrepot.buttons.add_part')}
          </button>
        ) : null
      }
      renderRow={(item, idx) => {
        const realIndex = startIndex + idx;
        if (item.__isEmptyPlaceholder) {
          return (
            <tr key={`empty-part-${realIndex}-${idx}`} className="border-b border-slate-100 bg-white/40 select-none">
              <td className="py-2.5 px-3 text-center font-mono text-[10.5px] text-slate-300 bg-slate-100/30 border-r border-slate-200/60">
                {realIndex + 1}
              </td>
              <td colSpan={8} className="py-2.5 px-3 text-center text-slate-300 font-mono text-[11px]">
                —
              </td>
            </tr>
          );
        }
                const domainItem = new EntrepotItem(item);
                const typeObj = types.find((t) => t.id_type === item.id_type);
                const diagObj = diagnostics.find((d) => d.id_diag === item.id_diag);
                const isActionOpen = activeActionMenuId === item.id_warehouse_item;

                return (
                  <tr
                    key={`part-row-${item.id || item.id_warehouse_item || 'p'}-${realIndex}`}
                    className="even:bg-slate-50/70 odd:bg-white hover:bg-indigo-50/30 transition-colors border-b border-slate-100"
                  >
                    {/* Row N° Column */}
                    <td className="py-2.5 px-3 text-center font-mono text-[10.5px] font-bold text-slate-400 bg-slate-100/30 border-r border-slate-200/60 shrink-0">
                      {realIndex + 1}
                    </td>

                    {/* Col 1: Code Part & Réf Fabricant & Passport ID (A) */}
                    <td className="py-2.5 px-3.5 whitespace-nowrap">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-mono font-bold text-xs border shadow-2xs bg-indigo-50 text-indigo-900 border-indigo-200/90"
                            title={`Code Part: ${item.code || item.id_warehouse_item}`}
                          >
                            <Hash className="w-3 h-3 text-indigo-600 shrink-0" />
                            <span>{item.code || item.id_warehouse_item}</span>
                          </span>
                          {item.id && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard?.writeText(item.id);
                              }}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 font-mono text-[9.5px] border border-slate-200 transition cursor-pointer"
                              title={`Passport ID: ${item.id}\n(Cliquer pour copier)`}
                            >
                              <Copy className="w-2.5 h-2.5" />
                              <span>ID</span>
                            </button>
                          )}
                        </div>
                        {item.ref && (
                          <div
                            className="flex items-center gap-1 font-mono text-[10px] text-slate-500 font-medium"
                            title={`Réf Fabricant: ${item.ref}`}
                          >
                            <span className="text-slate-400 text-[9px] uppercase font-bold">Réf:</span>
                            <span className="font-semibold text-slate-700 truncate max-w-[140px]">{item.ref}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Col 2: Type de Part & Diagnostic / Diag (D / B) */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="space-y-1">
                        <button
                          type="button"
                          onClick={() => {
                            if (onNavigateToPartTypes) onNavigateToPartTypes(item.id_type);
                            else if (onNavigateToType) onNavigateToType(item.id_type);
                          }}
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-indigo-50/80 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/70 font-semibold text-[11px] transition cursor-pointer max-w-[190px] truncate"
                          title={`Type de Part: ${typeObj?.libelle || item.id_type}`}
                        >
                          <LayersIcon className="w-3 h-3 text-indigo-600 shrink-0" />
                          <span className="truncate">{typeObj?.libelle || item.id_type || 'Type'}</span>
                        </button>
                        {diagObj && (
                          <button
                            type="button"
                            onClick={() => onNavigateToDiag && onNavigateToDiag(item.id_type)}
                            className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-100/90 hover:bg-slate-200 text-slate-600 border border-slate-200/70 text-[10px] transition cursor-pointer max-w-[190px] truncate"
                            title={`Diagnostic / Désignation: ${diagObj.libelle}`}
                          >
                            <Tag className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                            <span className="truncate">{diagObj.libelle}</span>
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Col 3: Désignation & Emplacement & Remarques (C) */}
                    <td className="py-2.5 px-3.5 max-w-[320px]">
                      <div className="flex items-start gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0 border border-indigo-200/80 mt-0.5 shadow-2xs">
                          <Package className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-slate-900 text-xs sm:text-[12.5px] leading-snug" title={item.designation}>
                            {item.designation}
                          </div>

                          <div className="flex items-center gap-2 mt-0.5 text-[10.5px] text-slate-500 truncate">
                            {item.emplacement && (
                              <span className="inline-flex items-center gap-1 font-mono font-semibold text-slate-600 bg-slate-100/90 px-1.5 py-0.5 rounded border border-slate-200/70 shrink-0">
                                <MapPin className="w-2.5 h-2.5 text-slate-400" />
                                {item.emplacement}
                              </span>
                            )}
                            {item.remarques ? (
                              <span className="truncate italic text-slate-400 text-[10px]" title={item.remarques}>
                                {item.remarques}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[10px]">Pièce de rechange gérée en PDR</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Col 4: Rattachement & Magasin (E) */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="space-y-1">
                        {item.rattachement_type === 'MACHINE' && (item.id_machine_registered || item.id_machine) ? (
                          <div className="space-y-0.5">
                            <button
                              type="button"
                              onClick={() =>
                                onNavigateToMachine &&
                                onNavigateToMachine(item.id_machine_registered || item.id_machine)
                              }
                              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200/80 font-mono font-bold text-[11px] transition cursor-pointer"
                            >
                              <Factory className="w-3 h-3 text-purple-600 shrink-0" />
                              <span>{item.id_machine_registered || item.id_machine}</span>
                            </button>
                            <span className="text-[10px] text-slate-400 block truncate max-w-[180px]">
                              {machines.find((m) => m.id_machine_registered === (item.id_machine_registered || item.id_machine))?.designation || 'Dédié Machine'}
                            </span>
                          </div>
                        ) : item.rattachement_type === 'ZONE' && item.id_zone ? (
                          <div className="space-y-0.5">
                            <button
                              type="button"
                              onClick={() => onNavigateToZone && onNavigateToZone(item.id_zone)}
                              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200/80 font-semibold text-[11px] transition cursor-pointer"
                            >
                              <MapPin className="w-3 h-3 text-amber-600 shrink-0" />
                              <span>{item.id_zone}</span>
                            </button>
                            <span className="text-[10px] text-slate-400 block truncate max-w-[180px]">
                              {zones.find((z) => z.id_zone === item.id_zone)?.libelle || 'Zone atelier'}
                            </span>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 font-semibold text-[11px]">
                              <Warehouse className="w-3 h-3 text-slate-500 shrink-0" />
                              <span>Magasin Central PDR</span>
                            </span>
                            <span className="text-[10px] text-slate-400 block">Stock Général Pièces</span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Col 5: Responsable / Magasinier (F) */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center justify-center font-bold text-xs shrink-0">
                          <User className="w-3 h-3 text-indigo-600" />
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 text-xs block leading-tight">
                            {item.technician || 'Magasinier Central'}
                          </span>
                          <span className="text-[9.5px] text-slate-400 font-medium block">
                            {item.technician ? 'Responsable Stock' : 'Gestionnaire PDR'}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Col 6: Statut Stock (G) */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {String(item.status).includes('service') ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          <span>Disponible</span>
                        </span>
                      ) : String(item.status).includes('stock') || String(item.status).includes('dispo') ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-sky-50 text-sky-700 border border-sky-200 shadow-2xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
                          <span>En stock</span>
                        </span>
                      ) : String(item.status).includes('rev') || String(item.status).includes('ext') ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                          <span>En commande</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                          <span>{item.status || 'Rupture'}</span>
                        </span>
                      )}
                    </td>

                    {/* Col 7: Stock Actuel & Seuil (H) */}
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <div className="flex flex-col items-end">
                        <span
                          className={`px-2.5 py-0.5 rounded-lg font-mono font-bold text-xs ${
                            (item.stockActuel || 0) <= 0
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : (item.stockActuel || 0) <= (item.seuil || 2)
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-indigo-50 text-indigo-800 border border-indigo-200/80'
                          }`}
                        >
                          {domainItem.getStockActuel()} u
                        </span>
                        <span className="text-[9.5px] font-mono text-slate-400 mt-0.5">
                          Init: {item.stockInitial || 1} • Seuil: {item.seuil || 2}
                        </span>
                      </div>
                    </td>

                    {/* Col 8: Action & Dropdown (•••) */}
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <div className="relative inline-flex items-center justify-end action-menu-container">
                        <div className="inline-flex rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
                          {/* Primary Action Button */}
                          <button
                            type="button"
                            onClick={() => handleOpenQuickModal(item, 'Sortie Interne', 'CORRECTIVE')}
                            className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 text-xs font-bold transition flex items-center gap-1 cursor-pointer border-r border-slate-200"
                            title="Sortie directe PDR"
                          >
                            <Wrench className="w-3.5 h-3.5 text-slate-500" />
                            <span className="hidden sm:inline">Sortie</span>
                          </button>

                          {/* Dropdown Toggle */}
                          <button
                            type="button"
                            onClick={() =>
                              setActiveActionMenuId(isActionOpen ? null : item.id_warehouse_item)
                            }
                            className={`p-1.5 hover:bg-slate-100 transition cursor-pointer ${
                              isActionOpen ? 'bg-slate-100 text-indigo-800' : 'text-slate-500'
                            }`}
                            title="Options et Flux PDR"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Popover Action Menu */}
                        {isActionOpen && (
                          <div className="absolute right-0 top-full mt-1.5 w-60 bg-white rounded-2xl shadow-xl border border-slate-200 p-1.5 z-40 text-left animate-fadeIn">
                            <div className="px-3 py-1.5 border-b border-slate-100 mb-1">
                              <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">
                                Actions Pièce PDR
                              </div>
                              <div className="font-mono font-bold text-xs text-slate-800 truncate">
                                {item.id_warehouse_item}
                              </div>
                            </div>

                            <div className="space-y-0.5">
                              <button
                                type="button"
                                onClick={() => handleOpenQuickModal(item, 'Sortie Interne', 'CORRECTIVE')}
                                className="w-full px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:text-rose-700 hover:bg-rose-50 flex items-center gap-2 transition cursor-pointer"
                              >
                                <Wrench className="w-3.5 h-3.5 text-rose-500" />
                                <span>Sortie PDR (Atelier / Machine)</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleOpenQuickModal(item, 'Entrée Interne', 'RETOUR_ATELIER')}
                                className="w-full px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:text-blue-700 hover:bg-blue-50 flex items-center gap-2 transition cursor-pointer"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />
                                <span>Retour Atelier (Surplus / Récupération)</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleOpenQuickModal(item, 'Entrée Externe', 'REAPPRO')}
                                className="w-full px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:text-emerald-700 hover:bg-emerald-50 flex items-center gap-2 transition cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5 text-emerald-500" />
                                <span>Réapprovisionnement Fournisseur</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleOpenQuickModal(item, 'Ajustement & Recalibrage', 'INVENTAIRE')}
                                className="w-full px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:text-amber-700 hover:bg-amber-50 flex items-center gap-2 transition cursor-pointer"
                              >
                                <Scale className="w-3.5 h-3.5 text-amber-500" />
                                <span>Ajustement Inventaire / Solde</span>
                              </button>
                            </div>

                            <div className="my-1 border-t border-slate-100" />

                            <div className="space-y-0.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedDetails(item);
                                  setActiveActionMenuId(null);
                                }}
                                className="w-full px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:text-indigo-700 hover:bg-indigo-50 flex items-center gap-2 transition cursor-pointer"
                              >
                                <Info className="w-3.5 h-3.5 text-indigo-600" />
                                <span>Fiche Technique & Détails</span>
                              </button>

                              {canEditStock && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditModal(item)}
                                  className="w-full px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:text-indigo-700 hover:bg-indigo-50 flex items-center gap-2 transition cursor-pointer"
                                >
                                  <Edit2 className="w-3.5 h-3.5 text-indigo-600" />
                                  <span>Modifier les Paramètres</span>
                                </button>
                              )}

                              {canDeleteStock && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setToDelete(item);
                                    setActiveActionMenuId(null);
                                  }}
                                  className="w-full px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:text-rose-800 hover:bg-rose-50 flex items-center gap-2 transition cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                  <span>Supprimer de l'entrepôt</span>
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              }}
    />
  );
}
