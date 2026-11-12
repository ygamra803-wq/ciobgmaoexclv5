import {  useState, useRef, useMemo, useEffect  } from 'react';
import AnimatedPage from '../../components/common/AnimatedPage';
import Action3DButton from '../../components/common/Action3DButton';
import FormulasModalButton from '../../components/common/FormulasModalButton';
import PageHeaderIcon from '../../components/common/PageHeaderIcon';
import GmaoIndustrialDataGrid from '../../components/common/GmaoIndustrialDataGrid';
import CustomSelect from '../../components/common/CustomSelect';
import PartInfoIcon from '../../components/common/icons/PartInfoIcon';
import { LayersIcon } from '../../components/common/icons/LayersIcon';
import { useI18n } from '../../../i18n/I18nContext';
import { usePermission } from '../../components/common/PermissionGate';
import {
  Search,
  Tag,
  ArrowRight,
  Trash2,
  Edit2,
  Warehouse,
  SlidersHorizontal,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  RotateCcw,
  X,
  MapPin,
  AlertTriangle,
  Calculator,
  MoreVertical,
  FileSpreadsheet,
} from 'lucide-react';
import {
  getEffectivePolicyTags,
  POLICY_TAG_LABELS,
  type MaterialPolicyTag,
} from '../../../domain/corrective/needRequestService';
import { getGroupId, getGroupRecordId } from '../../../domain/stock/pdrHierarchyService';

export default function PartDesignationView({
  partDesignations = [],
  partTypes = [],
  partGroups = [],
  warehouseItems = [],
  partDesignationTypeFilter = '',
  setPartDesignationTypeFilter,
  onAddPartDesignation,
  onUpdatePartDesignation,
  onDeletePartDesignation,
  onNavigateToPartGroups,
  onNavigateToPartTypes,
  onNavigateToEntrepotByPart,
  _onNavigateToQuickSortie,
}: any) {
  const { t } = useI18n();
  const canCreateStock = usePermission('stock.create');
  const canEditStock = usePermission('stock.edit');
  const canDeleteStock = usePermission('stock.delete');
  const [search, setSearch] = useState('');
  const [partGroupFilter, setPartGroupFilter] = useState('ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showFormulasModal, setShowFormulasModal] = useState(false);
  const [toEdit, setToEdit] = useState<any>(null);
  const [toDelete, setToDelete] = useState<any>(null);
  const [activeActionMenuId, setActiveActionMenuId] = useState<any>(null);
  const [sortField, setSortField] = useState('ref');
  const [sortOrder, setSortOrder] = useState('asc');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortMenuRef = useRef<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const partGroupMap = useMemo(() => {
    const map: Record<string, any> = {};
    (partGroups || []).forEach((g: any) => {
      const k1 = getGroupRecordId(g).toUpperCase();
      const k2 = String(g.code || '').trim().toUpperCase();
      if (k1) map[k1] = g;
      if (k2) map[k2] = g;
    });
    return map;
  }, [partGroups]);

  useEffect(() => {
    const handleClickOutside = (event: any) => {
      if (!event.target.closest('.action-menu-container')) {
        setActiveActionMenuId(null);
      }
      if (sortMenuRef.current && !sortMenuRef.current.contains(event.target)) {
        setShowSortMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Form state
  const [form, setForm] = useState({
    id_part: '',
    ref: '',
    designation: '',
    id_group: '',
    id_type: '',
    seuil: 5,
    emplacement: '',
    matiere_nuance: '',
    ref_plan: '',
    dimensions_brut: '',
    traitement_thermique: '',
    policy_tags: ['REPAIRABLE', 'REPLACING'] as MaterialPolicyTag[],
  });

  // Filter
  const filtered = useMemo(() => {
    return partDesignations.filter((d: any) => {
      const q = search.toLowerCase();
      const typeObj = partTypes.find((t: any) => t.id_type === d.id_type);
      const effectiveGroupId = (getGroupId(d) || getGroupId(typeObj)).toUpperCase();

      const matchSearch =
        !q ||
        d.ref?.toLowerCase().includes(q) ||
        d.id_part?.toLowerCase().includes(q) ||
        d.designation?.toLowerCase().includes(q) ||
        d.id_type?.toLowerCase().includes(q) ||
        d.emplacement?.toLowerCase().includes(q) ||
        d.matiere_nuance?.toLowerCase().includes(q) ||
        d.ref_plan?.toLowerCase().includes(q) ||
        d.dimensions_brut?.toLowerCase().includes(q) ||
        d.traitement_thermique?.toLowerCase().includes(q) ||
        effectiveGroupId.toLowerCase().includes(q);

      const matchGroup =
        partGroupFilter === 'ALL' ||
        (partGroupFilter === 'UNASSIGNED'
          ? !effectiveGroupId
          : effectiveGroupId === String(partGroupFilter).trim().toUpperCase());

      const matchType = !partDesignationTypeFilter || d.id_type === partDesignationTypeFilter;
      return matchSearch && matchGroup && matchType;
    });
  }, [partDesignations, partTypes, search, partGroupFilter, partDesignationTypeFilter]);

  // Sort
  const sortedData = useMemo(() => {
    if (!sortField) return filtered;
    return [...filtered].sort((a, b) => {
      let valA = a[sortField] ?? '';
      let valB = b[sortField] ?? '';
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filtered, sortField, sortOrder]);

  const totalItems = sortedData.length;
  const effectivePageSize = pageSize === 0 ? totalItems : pageSize;
  const startIndex = (currentPage - 1) * effectivePageSize;
  const rawDisplayedData =
    pageSize === 0 ? sortedData : sortedData.slice(startIndex, startIndex + effectivePageSize);
  const displayedData = rawDisplayedData;

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const renderSortIcon = (field) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-300 group-hover:text-slate-500 transition shrink-0" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-teal-700 shrink-0 font-bold" />
    ) : (
      <ArrowDown className="w-3 h-3 text-teal-700 shrink-0 font-bold" />
    );
  };

  const getSortFieldLabel = (field) => {
    switch (field) {
      case 'ref':
        return t('part_designations.col_ref', 'Référence');
      case 'designation':
        return t('part_designations.col_designation', 'Désignation');
      case 'id_type':
        return t('part_designations.col_type', 'Type de Part');
      case 'seuil':
        return t('part_designations.col_seuil', 'Seuil');
      case 'emplacement':
        return t('part_designations.col_emplacement', 'Emplacement');
      default:
        return field?.toUpperCase() || '';
    }
  };

  const handleExportExcel = () => {
    const headers = [
      'Référence',
      'Désignation Part',
      'Groupe Part (Niv 1)',
      'Type Parent (Niv 2)',
      'Matière / Nuance',
      'Réf. Plan',
      'Dimensions Brut',
      'Traitement Thermique',
      'Stock Actuel',
      'Emplacement',
    ];
    const rows = filtered.map((d: any) => {
      const dKey = d.ref || d.id_part || d.id_diag || d.id;
      const typeObj = partTypes.find((t: any) => t.id_type === d.id_type);
      const grpId = getGroupId(d) || getGroupId(typeObj);
      const matchingItems = warehouseItems.filter(
        (w: any) =>
          (w.nature === 'PART' || w.nature === 'COMPOSANT') &&
          (w.id_warehouse_item === dKey ||
            w.ref === dKey ||
            w.id_diag === dKey ||
            w.id_part_designation === dKey ||
            w.designation === d.designation)
      );
      const totalStock = matchingItems.reduce(
        (sum: number, w: any) => sum + (Number(w.stockActuel ?? w.quantite ?? 1) || 0),
        0
      );
      return [
        d.ref || d.id_part || '',
        d.designation || '',
        grpId,
        d.id_type || '',
        d.matiere_nuance || '',
        d.ref_plan || '',
        d.dimensions_brut || '',
        d.traitement_thermique || '',
        totalStock,
        d.emplacement || '',
      ];
    });
    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `designations_parts_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSubmit = (e: any) => {
    e.preventDefault();
    if (!canCreateStock) return;
    if (!form.ref || !form.designation || !form.id_type) return;
    const cleanRef = form.ref.trim().toUpperCase();
    const matchedTypeObj = partTypes.find((t: any) => t.id_type === form.id_type);
    const effectiveGroup = form.id_group || getGroupId(matchedTypeObj) || undefined;
    onAddPartDesignation({
      ...form,
      id: cleanRef,
      id_part: cleanRef,
      ref: cleanRef,
      id_group: effectiveGroup,
      // TODO(ALIAS-ID-GROUP): keep id_groupe temporarily for legacy consumers
      id_groupe: effectiveGroup,
      matiere_nuance: form.matiere_nuance.trim(),
      ref_plan: form.ref_plan.trim(),
      dimensions_brut: form.dimensions_brut.trim(),
      traitement_thermique: form.traitement_thermique.trim() || undefined,
      seuil: Number(form.seuil) || 0,
      policy_tags:
        form.policy_tags && form.policy_tags.length > 0
          ? form.policy_tags
          : (['REPAIRABLE', 'REPLACING'] as MaterialPolicyTag[]),
    });
    setForm({
      id_part: '',
      ref: '',
      designation: '',
      id_group: '',
      id_type: '',
      seuil: 5,
      emplacement: '',
      matiere_nuance: '',
      ref_plan: '',
      dimensions_brut: '',
      traitement_thermique: '',
      policy_tags: ['REPAIRABLE', 'REPLACING'],
    });
    setShowAddModal(false);
  };

  const partDesignationColumns = useMemo(
    () => [
      {
        key: 'ref',
        label: t('designations.col_code', 'REF / CODE'),
        colLetter: 'A',
        icon: Tag,
        sortable: true,
        render: (item) => (
          <span className="px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200 font-mono font-bold text-xs">
            {item.ref || item.id_part}
          </span>
        ),
      },
      {
        key: 'designation',
        label: t('designations.col_name', 'DÉSIGNATION & SPÉCIFICATIONS ATELIER'),
        colLetter: 'B',
        icon: PartInfoIcon,
        sortable: true,
        render: (item: any) => (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <PartInfoIcon className="w-4 h-4 text-blue-600 shrink-0 animate-pulse-slow" />
              <span className="font-semibold text-slate-800 text-[13px]">{item.designation}</span>
            </div>
            {(item.matiere_nuance || item.ref_plan || item.dimensions_brut || item.traitement_thermique) && (
              <div className="flex items-center gap-1.5 flex-wrap pl-6">
                {item.matiere_nuance && (
                  <span
                    className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200 font-mono text-[10px] font-bold"
                    title={`Matière / Nuance : ${item.matiere_nuance}`}
                  >
                    Matière: {item.matiere_nuance}
                  </span>
                )}
                {item.ref_plan && (
                  <span
                    className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200 font-mono text-[10px] font-bold"
                    title={`Référence Plan d'usinage : ${item.ref_plan}`}
                  >
                    Plan: {item.ref_plan}
                  </span>
                )}
                {item.dimensions_brut && (
                  <span
                    className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-mono text-[10px] font-semibold"
                    title={`Dimensions Brut Atelier : ${item.dimensions_brut}`}
                  >
                    Brut: {item.dimensions_brut}
                  </span>
                )}
                {item.traitement_thermique && (
                  <span
                    className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200 font-mono text-[10px] font-bold"
                    title={`Traitement thermique / Dureté : ${item.traitement_thermique}`}
                  >
                    TT: {item.traitement_thermique}
                  </span>
                )}
              </div>
            )}
          </div>
        ),
      },
      {
        key: 'id_type',
        label: t('designations.col_parent_type', 'GROUPE (NIV 1) & TYPE (NIV 2)'),
        colLetter: 'C',
        icon: LayersIcon,
        sortable: true,
        render: (item: any) => {
          const typeObj = partTypes.find((t: any) => t.id_type === item.id_type);
          const rawGroupKey = String(
            item.id_group || item.id_groupe || typeObj?.id_group || typeObj?.id_groupe || ''
          )
            .trim()
            .toUpperCase();
          const grpObj = rawGroupKey ? partGroupMap[rawGroupKey] : null;
          return (
            <div className="flex flex-col items-start gap-1">
              {grpObj && (
                <button
                  type="button"
                  onClick={() =>
                    onNavigateToPartGroups &&
                    onNavigateToPartGroups(grpObj.id_group || grpObj.code)
                  }
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-[10px] font-mono font-bold transition cursor-pointer"
                  title={`Groupe de Parts (Niv 1): ${grpObj.libelle}`}
                >
                  <span>{grpObj.code || grpObj.id_group}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() =>
                  onNavigateToPartTypes && onNavigateToPartTypes(item.id_type)
                }
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-semibold transition cursor-pointer"
                title={t('designations.view_parent_type', 'Voir le type de part parent')}
              >
                <LayersIcon className="w-3 h-3 text-emerald-600" />
                <span className="font-mono">{item.id_type}</span>
                {typeObj && <span className="text-slate-500 font-normal"> ({typeObj.libelle})</span>}
              </button>
            </div>
          );
        },
      },
      {
        key: 'seuil',
        label: t('designations.col_alert', "SEUIL D'ALERTE"),
        colLetter: 'D',
        icon: AlertTriangle,
        render: (item) => (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-xs font-mono font-bold">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            {item.seuil ?? 3}
          </span>
        ),
      },
      {
        key: 'emplacement',
        label: t('designations.col_location', 'EMPLACEMENT'),
        colLetter: 'E',
        icon: MapPin,
        render: (item) => (
          <span className="inline-flex items-center gap-1 text-slate-600 text-xs font-mono font-medium">
            <MapPin className="w-3 h-3 text-slate-400" />
            {item.emplacement || t('common.unassigned', 'Non assigné')}
          </span>
        ),
      },
      {
        key: 'warehouse_parts',
        label: t('designations.col_warehouse', 'PARTS EN ENTREPÔT'),
        colLetter: 'F',
        icon: Warehouse,
        render: (item) => {
          const dKey = item.ref || item.id_part || item.id_diag || item.id;
          const pCount = warehouseItems.filter(
            (w) =>
              (w.nature === 'PART' || w.nature === 'COMPOSANT') &&
              (w.id_warehouse_item === dKey ||
                w.ref === dKey ||
                w.id_diag === dKey ||
                w.id_part_designation === dKey ||
                w.designation === item.designation)
          ).length;
          return (
            <button
              type="button"
              onClick={() =>
                onNavigateToEntrepotByPart &&
                onNavigateToEntrepotByPart(item.ref || item.id_part, item.id_type)
              }
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 text-xs font-semibold transition group shadow-2xs cursor-pointer"
              title={t('designations.filter_warehouse', 'Filtrer Entrepôt sur cette désignation de part')}
            >
              <Warehouse className="w-3.5 h-3.5 text-emerald-600" />
              <span>{pCount} {t('designations.part_unit', 'parts')}</span>
              <ArrowRight className="w-3 h-3 text-emerald-600 group-hover:translate-x-0.5 transition-transform" />
            </button>
          );
        },
      },
      {
        key: 'policy_tags',
        label: 'POLITIQUE MAINTENANCE',
        colLetter: 'G',
        icon: Tag,
        render: (item) => {
          const tags = getEffectivePolicyTags(item, 'PART');
          return (
            <div className="flex items-center gap-1 flex-wrap">
              {tags.map((t) => (
                <span
                  key={t}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${
                    t === 'REPAIRABLE'
                      ? 'bg-amber-50 text-amber-900 border-amber-200'
                      : t === 'MODIFYING'
                      ? 'bg-purple-50 text-purple-900 border-purple-200'
                      : 'bg-sky-50 text-sky-900 border-sky-200'
                  }`}
                >
                  {t}
                </span>
              ))}
            </div>
          );
        },
      },
      {
        key: 'actions',
        label: '•••',
        colLetter: '',
        align: 'center',
        render: (item) => {
          const rowKey = item.ref || item.id_part || item.id_diag || item.id || '';
          const pCount = warehouseItems.filter(
            (w) =>
              (w.nature === 'PART' || w.nature === 'COMPOSANT') &&
              (w.id_warehouse_item === rowKey ||
                w.ref === rowKey ||
                w.id_diag === rowKey ||
                w.id_part_designation === rowKey ||
                w.designation === item.designation)
          ).length;
          return (
            <div className="relative inline-flex items-center justify-center action-menu-container">
              <div className="inline-flex rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
                <button
                  type="button"
                  onClick={() => {
                    if (onNavigateToEntrepotByPart) {
                      onNavigateToEntrepotByPart(item.ref || item.id_part, item.id_type);
                    }
                  }}
                  className="p-1.5 bg-white hover:bg-slate-100/80 text-slate-800 hover:text-black transition flex items-center justify-center cursor-pointer border-r border-slate-200"
                  title={t('designations.filter_warehouse', 'Filtrer l\'entrepôt sur cette désignation')}
                >
                  <Warehouse className="w-3.5 h-3.5 text-slate-900" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveActionMenuId(activeActionMenuId === rowKey ? null : rowKey);
                  }}
                  className={`p-1.5 hover:bg-slate-100 transition cursor-pointer ${
                    activeActionMenuId === rowKey
                      ? 'bg-slate-100 text-emerald-700 font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title={t('designations.action_menu_title', 'Actions et options')}
                >
                  <MoreVertical className="w-3.5 h-3.5" />
                </button>
              </div>

              {activeActionMenuId === rowKey && (
                <div className="absolute right-0 top-full mt-1.5 w-60 bg-white rounded-2xl shadow-xl border border-slate-200/90 z-50 p-1.5 animate-in fade-in zoom-in-95 duration-150 text-left space-y-0.5">
                  <div className="px-3 py-2 border-b border-slate-100 mb-1 bg-slate-50/80 rounded-xl">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      {t('designations.action_menu_header', 'Actions Désignation Part')}
                    </span>
                    <span className="text-xs font-mono font-bold text-emerald-700 truncate block mt-0.5">
                      {rowKey}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveActionMenuId(null);
                      if (onNavigateToEntrepotByPart) {
                        onNavigateToEntrepotByPart(item.ref || item.id_part, item.id_type);
                      }
                    }}
                    className="w-full px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 rounded-xl transition flex items-center gap-2.5 cursor-pointer group"
                  >
                    <Warehouse className="w-3.5 h-3.5 text-emerald-600 group-hover:scale-110 transition-transform" />
                    <span>{t('designations.menu_filter_warehouse', "Filtrer l'Entrepôt")} ({pCount})</span>
                  </button>
                  {canEditStock && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveActionMenuId(null);
                        setToEdit({
                          ...item,
                          policy_tags: getEffectivePolicyTags(item, 'PART'),
                        });
                      }}
                      className="w-full px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-teal-50 hover:text-teal-800 rounded-xl transition flex items-center gap-2.5 cursor-pointer border-t border-slate-100 mt-1 pt-2"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-teal-600" />
                      <span>{t('designations.menu_edit', 'Modifier la Désignation')}</span>
                    </button>
                  )}
                  {canDeleteStock && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveActionMenuId(null);
                        setToDelete(item);
                      }}
                      className="w-full px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition flex items-center gap-2.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                      <span>{t('designations.menu_delete', 'Supprimer du Référentiel')}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        },
      },
    ],
    [t, partTypes, partGroupMap, warehouseItems, activeActionMenuId, onNavigateToEntrepotByPart, onNavigateToPartTypes, onNavigateToPartGroups, canEditStock, canDeleteStock]
  );

  return (
    <AnimatedPage className="space-y-4">
      {/* Top Banner (BDR Light GMAO Header Card with 3D Tactile Elevation) */}
      <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200/90 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden group/header">
        {/* Subtle Ambient Gradient Background Highlight */}
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none group-hover/header:bg-indigo-500/10 transition-colors duration-500" />

        <div className="min-w-0 flex-1 flex items-start sm:items-center gap-3.5 relative">
          <PageHeaderIcon icon={PartInfoIcon} colorClass="text-indigo-700" />
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              {t('nav.designation_pdr', 'Désignations de Parts d’Entrepôt')}
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
              {t('designations.subtitle', 'Catalogue des désignations et spécifications de pièces détachées rattachées aux Types de Parts.')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 relative">
          <FormulasModalButton
            onClick={() => setShowFormulasModal(true)}
            title={t('header.formulas_excel', 'Formules Excel (Désignations Parts)')}
          />

          {canCreateStock && (
            <Action3DButton
              variant="circle"
              color="blue"
              icon={PartInfoIcon}
              showAddBadge={true}
              onClick={() => {
                const nextIdx = partDesignations.length + 1;
                setForm({
                  id_part: `PRT-${String(nextIdx).padStart(2, '0')}`,
                  ref: `PRT-${String(nextIdx).padStart(2, '0')}`,
                  designation: '',
                  id_type: partTypes[0]?.id_type || '',
                  seuil: 5,
                  emplacement: '',
                  policy_tags: ['REPAIRABLE', 'REPLACING'],
                });
                setShowAddModal(true);
              }}
              title={t('common.add', 'Nouvelle Désignation Part')}
            />
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="relative z-30 bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out space-y-4">
        {/* Header Toolbar: Icon + Title + Count Badge + Excel Export + Circular Reset */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-200/80 flex items-center justify-center text-amber-700 shadow-2xs shrink-0">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                  {t('common.filters.title', 'Filtres & Recherche Avancée')}
                </span>
                <span className="bg-amber-50 text-amber-800 px-2.5 py-0.5 rounded-lg text-[11px] font-bold border border-amber-200/70 shadow-2xs font-mono">
                  {filtered.length} / {partDesignations.length}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                {t('designations.filters_subtitle', 'Référentiel des Désignations de Pièces Entrepôt • Colonnes A → F')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Export Excel Button */}
            <button
              onClick={handleExportExcel}
              className="h-8 px-3 rounded-xl border border-emerald-200/80 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
              title={t('common.filters.export_excel', 'Exporter le tableau vers Excel / CSV')}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>{t('common.filters.export_excel', 'Export Excel')}</span>
            </button>

            {/* Circular Reset Button */}
            {(search || partGroupFilter !== 'ALL' || partDesignationTypeFilter || sortField !== 'ref' || sortOrder !== 'asc') && (
              <button
                onClick={() => {
                  setSearch('');
                  setPartGroupFilter('ALL');
                  setPartDesignationTypeFilter && setPartDesignationTypeFilter('');
                  setSortField('ref');
                  setSortOrder('asc');
                }}
                title={t('common.filters.reset_tooltip', 'Réinitialiser tous les filtres actifs')}
                className="w-8 h-8 rounded-full border border-rose-200/80 bg-rose-50 hover:bg-rose-100 text-rose-700 transition flex items-center justify-center cursor-pointer shadow-2xs active:scale-95 animate-in fade-in shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          {/* Search */}
          <div className="w-full">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-800">
                {t('common.filters.search', 'RECHERCHE LIBRE')}
              </label>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs">
                {t('common.all', 'Tous champs')}
              </span>
            </div>
            <div className="relative flex items-center">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-md bg-amber-100 border border-amber-300/80 flex items-center justify-center text-amber-700 shadow-2xs pointer-events-none z-10">
                <Search className="w-3 h-3" />
              </span>
              <input
                type="text"
                placeholder="Réf, désignation, matière (42CrMo4), plan..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-10 pl-9 pr-8 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer z-10"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Group Filter CustomSelect (Niv 1) */}
          <div className="w-full">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-800">
                GROUPE DE PARTS (NIV 1)
              </label>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide bg-teal-50 text-teal-800 border border-teal-200 shadow-2xs">
                Niv 1
              </span>
            </div>
            <CustomSelect
              prefixIcon={
                <span className="w-5 h-5 rounded-md bg-teal-100 border border-teal-300/80 flex items-center justify-center text-teal-700 shadow-2xs shrink-0">
                  <LayersIcon className="w-3 h-3" />
                </span>
              }
              value={partGroupFilter}
              onChange={(val) => {
                setPartGroupFilter(val);
                if (setPartDesignationTypeFilter) setPartDesignationTypeFilter('');
              }}
              options={[
                {
                  value: 'ALL',
                  label: `Tous les Groupes (${partGroups.length})`,
                },
                ...partGroups.map((g: any) => ({
                  value: String(g.id_group || g.id_groupe || g.code || ''),
                  label: `${g.code || g.id_group} — ${g.libelle}`,
                })),
                {
                  value: 'UNASSIGNED',
                  label: 'Non classés',
                },
              ]}
            />
          </div>

          {/* Type Filter CustomSelect */}
          <div className="w-full">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-800">
                {t('common.type', 'TYPE DE PART (NIV 2)')}
              </label>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs">
                Col. C
              </span>
            </div>
            <CustomSelect
              prefixIcon={
                <span className="w-5 h-5 rounded-md bg-amber-100 border border-amber-300/80 flex items-center justify-center text-amber-700 shadow-2xs shrink-0">
                  <Tag className="w-3 h-3" />
                </span>
              }
              value={partDesignationTypeFilter || 'ALL'}
              onChange={(val) =>
                setPartDesignationTypeFilter && setPartDesignationTypeFilter(val === 'ALL' ? '' : val)
              }
              options={[
                {
                  value: 'ALL',
                  label: `${t('common.all', 'Tous les types de parts')} (${partTypes.length})`,
                  badge: `${partDesignations.length}`,
                  badgeColor: 'bg-slate-100 text-slate-700 font-bold',
                },
                ...partTypes
                  .filter((t: any) => {
                    if (partGroupFilter === 'ALL') return true;
                    const gId = String(t.id_group || t.id_groupe || '').trim().toUpperCase();
                    if (partGroupFilter === 'UNASSIGNED') return !gId;
                    return gId === String(partGroupFilter).trim().toUpperCase();
                  })
                  .map((t: any) => {
                    const count = partDesignations.filter((d: any) => d.id_type === t.id_type).length;
                    return {
                      value: t.id_type,
                      label: `${t.id_type} - ${t.libelle}`,
                      badge: `${count}`,
                      badgeColor: 'bg-amber-50 text-amber-800 font-bold',
                    };
                  }),
              ]}
            />
          </div>

          {/* Sort Dropdown */}
          <div className="w-full relative" ref={sortMenuRef}>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-800">
                {t('common.filters.sort_and_order', 'TRI DES ENREGISTREMENTS')}
              </label>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs">
                {sortOrder === 'asc' ? t('common.filters.order_asc', 'Ordre A-Z') : t('common.filters.order_desc', 'Ordre Z-A')}
              </span>
            </div>
            <button
              onClick={() => setShowSortMenu(!showSortMenu)}
              className={`w-full h-10 px-3 rounded-xl border text-xs font-semibold transition flex items-center justify-between cursor-pointer ${
                showSortMenu || sortField !== 'ref' || sortOrder !== 'asc'
                  ? 'bg-amber-50 text-amber-800 border-amber-300 ring-1 ring-amber-200 shadow-2xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-amber-100 border border-amber-300/80 flex items-center justify-center text-amber-700 shadow-2xs shrink-0">
                  <ArrowUpDown className="w-3 h-3" />
                </span>
                <span>
                  {t('common.filters.sort_prefix', 'Tri :')} <b className="font-semibold text-slate-900">{getSortFieldLabel(sortField)}</b> ({sortOrder === 'asc' ? t('common.filters.order_asc_short', 'A→Z') : t('common.filters.order_desc_short', 'Z→A')})
                </span>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 transition-transform ${showSortMenu ? 'rotate-180' : ''}`}
              />
            </button>

            {showSortMenu && (
              <div className="absolute left-0 right-0 mt-2 bg-white rounded-2xl border border-slate-200 shadow-xl z-50 p-3 space-y-2 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <span className="flex items-center gap-1.5 text-slate-700 font-semibold">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-amber-600" />
                    {t('common.filters.sort_by', 'Trier par')}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-1 text-xs">
                  <button
                    onClick={() => {
                      if (sortField === 'ref') {
                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortField('ref');
                        setSortOrder('asc');
                      }
                    }}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg font-medium transition cursor-pointer ${
                      sortField === 'ref'
                        ? 'bg-amber-50 text-amber-800 font-bold'
                        : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>{t('part_designations.sort_ref', 'Référence / Code (A)')}</span>
                    {sortField === 'ref' &&
                      (sortOrder === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      ))}
                  </button>

                  <button
                    onClick={() => {
                      if (sortField === 'designation') {
                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortField('designation');
                        setSortOrder('asc');
                      }
                    }}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg font-medium transition cursor-pointer ${
                      sortField === 'designation'
                        ? 'bg-amber-50 text-amber-800 font-bold'
                        : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>{t('part_designations.sort_designation', 'Désignation / Libellé (B)')}</span>
                    {sortField === 'designation' &&
                      (sortOrder === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      ))}
                  </button>

                  <button
                    onClick={() => {
                      if (sortField === 'id_type') {
                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortField('id_type');
                        setSortOrder('asc');
                      }
                    }}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg font-medium transition cursor-pointer ${
                      sortField === 'id_type'
                        ? 'bg-amber-50 text-amber-800 font-bold'
                        : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>{t('part_designations.sort_type', 'Type de Part (C)')}</span>
                    {sortField === 'id_type' &&
                      (sortOrder === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      ))}
                  </button>

                  <button
                    onClick={() => {
                      if (sortField === 'seuil') {
                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortField('seuil');
                        setSortOrder('asc');
                      }
                    }}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg font-medium transition cursor-pointer ${
                      sortField === 'seuil'
                        ? 'bg-amber-50 text-amber-800 font-bold'
                        : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>{t('part_designations.sort_seuil', "Seuil d'Alerte (D)")}</span>
                    {sortField === 'seuil' &&
                      (sortOrder === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      ))}
                  </button>

                  <button
                    onClick={() => {
                      if (sortField === 'emplacement') {
                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortField('emplacement');
                        setSortOrder('asc');
                      }
                    }}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg font-medium transition cursor-pointer ${
                      sortField === 'emplacement'
                        ? 'bg-amber-50 text-amber-800 font-bold'
                        : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>{t('part_designations.sort_emplacement', 'Emplacement (E)')}</span>
                    {sortField === 'emplacement' &&
                      (sortOrder === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      ))}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Active Filter Chips */}
        {(search || partDesignationTypeFilter) && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('common.filters.active_filters', 'Filtres actifs :')}</span>
            {search && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
                <Search className="w-3 h-3 text-amber-600" />
                {t('common.filters.search_prefix', 'Recherche :')} &quot;{search}&quot;
                <button
                  onClick={() => setSearch('')}
                  className="hover:bg-amber-200/60 p-0.5 rounded-full transition cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {partDesignationTypeFilter && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
                <Tag className="w-3 h-3 text-amber-600" />
                {t('common.type', 'Type')} : {partDesignationTypeFilter}
                <button
                  onClick={() => setPartDesignationTypeFilter && setPartDesignationTypeFilter('')}
                  className="hover:bg-amber-200/60 p-0.5 rounded-full transition cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Unified Industrial Data Grid */}
      <GmaoIndustrialDataGrid
        title={t('designations.grid_title', 'Tableau Désignations de Parts (Entrepôt)')}
        icon={<PartInfoIcon className="w-4 h-4 text-blue-600" />}
        excelMapping="ref (A) | designation (B) | id_type (C) | seuil (D) | emplacement (E) | warehouse_parts (F)"
        bannerColor="slate"
        columns={partDesignationColumns}
        data={displayedData}
        sortField={sortField}
        sortOrder={sortOrder}
        onSort={handleSort}
        renderSortIcon={renderSortIcon}
        startIndex={startIndex}
        showRowNumber={true}
        emptyIcon={<PartInfoIcon className="w-8 h-8 text-slate-300" />}
        emptyMessage={t('designations.empty', 'Aucune désignation de part trouvée')}
        pagination={{
          currentPage,
          setCurrentPage,
          pageSize,
          setPageSize,
          totalItems,
          pageSizeOptions: [25, 50, 100, 200, 0],
          color: 'emerald',
          itemLabel: t('designations.item_label', 'désignations'),
        }}
      />

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="font-bold text-base text-slate-900 mb-1">
              {t('part_designations.add_title', 'Nouvelle Désignation de Part')}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              {t('part_designations.add_desc', 'Référence et description d’une pièce détachée stockée en entrepôt.')}
            </p>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {t('part_designations.col_ref', 'Référence / Code Part (Clé Unique)')} *
                </label>
                <input
                  type="text"
                  required
                  value={form.ref}
                  onChange={(e) => setForm({ ...form, ref: e.target.value })}
                  placeholder="ex: FIX-01, MEC-01, PNE-01"
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {t('part_designations.col_designation', 'Désignation de la Pièce')} *
                </label>
                <input
                  type="text"
                  required
                  value={form.designation}
                  onChange={(e) => setForm({ ...form, designation: e.target.value })}
                  placeholder="ex: Cheville Filetée Haute Résistance 12x100"
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {t('part_designations.col_type', 'Type de Part Parent')} *
                </label>
                <select
                  required
                  value={form.id_type}
                  onChange={(e) => setForm({ ...form, id_type: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-teal-500 cursor-pointer"
                >
                  <option value="">{t('part_designations.select_type', 'Sélectionnez un type de part...')}</option>
                  {partTypes.map((t) => (
                    <option key={t.id_type} value={t.id_type}>
                      {t.id_type} - {t.libelle}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    {t('part_designations.col_seuil', 'Seuil d’Alerte')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.seuil}
                    onChange={(e) => setForm({ ...form, seuil: Number(e.target.value) || 0 })}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    {t('part_designations.col_emplacement', 'Emplacement Entrepôt')}
                  </label>
                  <input
                    type="text"
                    value={form.emplacement}
                    onChange={(e) => setForm({ ...form, emplacement: e.target.value })}
                    placeholder="ex: E-MAG-RAYON-C01"
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              {/* Spécifications Atelier (P2 + P3): Matière / Nuance, Réf. Plan, Dimensions Brut, Traitement Thermique */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block">
                    Matière / Nuance
                  </label>
                  <input
                    type="text"
                    value={form.matiere_nuance}
                    onChange={(e) => setForm({ ...form, matiere_nuance: e.target.value })}
                    placeholder="ex: 42CrMo4, Inox 316L"
                    className="w-full mt-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block">
                    Réf. Plan Usinage
                  </label>
                  <input
                    type="text"
                    value={form.ref_plan}
                    onChange={(e) => setForm({ ...form, ref_plan: e.target.value })}
                    placeholder="ex: PLN-MEC-204"
                    className="w-full mt-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block">
                    Dimensions Brut
                  </label>
                  <input
                    type="text"
                    value={form.dimensions_brut}
                    onChange={(e) => setForm({ ...form, dimensions_brut: e.target.value })}
                    placeholder="ex: Ø60 x 240 mm"
                    className="w-full mt-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block">
                    Traitement Thermique (P3)
                  </label>
                  <input
                    type="text"
                    value={form.traitement_thermique || ''}
                    onChange={(e) => setForm({ ...form, traitement_thermique: e.target.value })}
                    placeholder="ex: Trempé revenu 58 HRC"
                    className="w-full mt-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Politique de Maintenance & Orientation Pièce (`POLICY-TAGS`)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {(['REPLACING', 'REPAIRABLE', 'MODIFYING'] as MaterialPolicyTag[]).map((tag) => {
                    const active = (form.policy_tags || []).includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          const prev = form.policy_tags || [];
                          const next = active ? prev.filter((t) => t !== tag) : [...prev, tag];
                          if (next.length === 0) return;
                          setForm({ ...form, policy_tags: next });
                        }}
                        className={`p-2 rounded-xl border text-left transition cursor-pointer text-xs ${
                          active
                            ? 'bg-slate-900 text-white border-slate-900 font-bold shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10.5px]">{tag}</span>
                          {active && <span className="text-amber-400 text-[10px]">● Actif</span>}
                        </div>
                        <div className={`text-[9.5px] mt-0.5 ${active ? 'text-slate-300' : 'text-slate-500'}`}>
                          {POLICY_TAG_LABELS[tag]}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  {t('common.cancel', 'Annuler')}
                </button>

                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-xl shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out cursor-pointer"
                >
                  {t('common.save', 'Enregistrer')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {toEdit && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="font-bold text-base text-slate-900 mb-1">
              {t('part_designations.edit_title', 'Modifier Désignation de Part')}
            </h3>
            <p className="text-xs font-mono text-teal-700 mb-4">{toEdit.ref || toEdit.id_part}</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!canEditStock) return;
                const matchedTypeObj = partTypes.find((t: any) => t.id_type === toEdit.id_type);
                const effectiveGroup =
                  toEdit.id_group || matchedTypeObj?.id_group || matchedTypeObj?.id_groupe || undefined;
                onUpdatePartDesignation(toEdit.id || toEdit.ref || toEdit.id_part, {
                  ...toEdit,
                  id_group: effectiveGroup,
                  id_groupe: effectiveGroup,
                });
                setToEdit(null);
              }}
              className="space-y-3"
            >
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {t('part_designations.col_designation', 'Désignation')} *
                </label>
                <input
                  type="text"
                  required
                  value={toEdit.designation || ''}
                  onChange={(e) => setToEdit({ ...toEdit, designation: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {t('part_designations.col_type', 'Type de Part Parent')} *
                </label>
                <select
                  required
                  value={toEdit.id_type || ''}
                  onChange={(e) => setToEdit({ ...toEdit, id_type: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-teal-500 cursor-pointer"
                >
                  {partTypes.map((t: any) => (
                    <option key={t.id_type} value={t.id_type}>
                      {t.id_type} - {t.libelle}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    {t('part_designations.col_seuil', 'Seuil d’Alerte')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={toEdit.seuil ?? 3}
                    onChange={(e) =>
                      setToEdit({ ...toEdit, seuil: Number(e.target.value) || 0 })
                    }
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    {t('part_designations.col_emplacement', 'Emplacement')}
                  </label>
                  <input
                    type="text"
                    value={toEdit.emplacement || ''}
                    onChange={(e) => setToEdit({ ...toEdit, emplacement: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              {/* Spécifications Atelier (P2 + P3) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block">
                    Matière / Nuance
                  </label>
                  <input
                    type="text"
                    value={toEdit.matiere_nuance || ''}
                    onChange={(e) => setToEdit({ ...toEdit, matiere_nuance: e.target.value })}
                    placeholder="ex: 42CrMo4, Inox 316L"
                    className="w-full mt-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block">
                    Réf. Plan Usinage
                  </label>
                  <input
                    type="text"
                    value={toEdit.ref_plan || ''}
                    onChange={(e) => setToEdit({ ...toEdit, ref_plan: e.target.value })}
                    placeholder="ex: PLN-MEC-204"
                    className="w-full mt-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block">
                    Dimensions Brut
                  </label>
                  <input
                    type="text"
                    value={toEdit.dimensions_brut || ''}
                    onChange={(e) => setToEdit({ ...toEdit, dimensions_brut: e.target.value })}
                    placeholder="ex: Ø60 x 240 mm"
                    className="w-full mt-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block">
                    Traitement Thermique (P3)
                  </label>
                  <input
                    type="text"
                    value={toEdit.traitement_thermique || ''}
                    onChange={(e) => setToEdit({ ...toEdit, traitement_thermique: e.target.value })}
                    placeholder="ex: Trempé revenu 58 HRC"
                    className="w-full mt-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Politique de Maintenance & Orientation Pièce (`POLICY-TAGS`)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {(['REPLACING', 'REPAIRABLE', 'MODIFYING'] as MaterialPolicyTag[]).map((tag) => {
                    const active = (toEdit.policy_tags || []).includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          const prev = toEdit.policy_tags || [];
                          const next = active ? prev.filter((t) => t !== tag) : [...prev, tag];
                          if (next.length === 0) return;
                          setToEdit({ ...toEdit, policy_tags: next });
                        }}
                        className={`p-2 rounded-xl border text-left transition cursor-pointer text-xs ${
                          active
                            ? 'bg-slate-900 text-white border-slate-900 font-bold shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10.5px]">{tag}</span>
                          {active && <span className="text-amber-400 text-[10px]">● Actif</span>}
                        </div>
                        <div className={`text-[9.5px] mt-0.5 ${active ? 'text-slate-300' : 'text-slate-500'}`}>
                          {POLICY_TAG_LABELS[tag]}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setToEdit(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  {t('common.cancel', 'Annuler')}
                </button>

                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-xl shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out cursor-pointer"
                >
                  {t('common.update', 'Mettre à jour')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {toDelete && (() => {
        const delKey = toDelete.ref || toDelete.id_part || toDelete.id_diag || toDelete.id;
        const linkedWarehouseCount = warehouseItems.filter(
          (w) =>
            (w.nature === 'PART' || w.nature === 'COMPOSANT') &&
            (w.id_warehouse_item === delKey ||
              w.ref === delKey ||
              w.id_diag === delKey ||
              w.id_part_designation === delKey ||
              w.designation === toDelete.designation)
        ).length;
        return (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 border border-slate-200">
              <h3 className="font-bold text-base text-slate-900 mb-1">
                {t('part_designations.delete_title', 'Supprimer cette Désignation de Part ?')}
              </h3>
              <p className="text-xs text-slate-500 mb-3">
                {t('part_designations.delete_confirm', 'Êtes-vous sûr de vouloir supprimer')}{' '}
                <strong className="text-slate-900 font-mono">
                  {toDelete.ref || toDelete.id_part}
                </strong>{' '}
                ({toDelete.designation}) ?
              </p>
              {linkedWarehouseCount > 0 && (
                <div className="mb-4 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] font-semibold text-amber-800 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    Suppression bloquée : {linkedWarehouseCount} pièce(s) active(s) dans l&apos;entrepôt utilisent cette désignation.
                  </span>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setToDelete(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  {t('common.cancel', 'Annuler')}
                </button>

                <button
                  disabled={linkedWarehouseCount > 0}
                  onClick={() => {
                    if (!canDeleteStock || linkedWarehouseCount > 0) return;
                    onDeletePartDesignation(toDelete.id || toDelete.ref || toDelete.id_part);
                    setToDelete(null);
                  }}
                  className={`px-4 py-2 text-xs font-bold text-white rounded-xl transition-all duration-300 ease-out ${
                    linkedWarehouseCount > 0
                      ? 'bg-slate-300 cursor-not-allowed'
                      : 'bg-rose-600 hover:bg-rose-700 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 cursor-pointer'
                  }`}
                >
                  {t('common.delete', 'Supprimer')}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Excel Formulas Modal */}
      {showFormulasModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden p-5 md:p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center">
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">{t('part_designations.formulas_title', 'Formules Excel — Désignations de Parts (Entrepôt)')}</h3>
                  <p className="text-xs text-slate-500">{t('part_designations.formulas_subtitle', 'Formules miroir de l’onglet Part_Designations (GMAO)')}</p>
                </div>
              </div>
              <button
                onClick={() => setShowFormulasModal(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 max-h-[60vh] overflow-y-auto pr-1">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/90 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">{t('part_designations.formula_ref_title', 'Formule B — Référence Pièce (ID Part)')}</span>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-teal-100 text-teal-800">REF_UNIOUE</span>
                </div>
                <div className="font-mono text-xs text-teal-800 font-bold bg-white p-2 rounded-lg border border-teal-100">
                  =[@id_part] (ex: PRT-01)
                </div>
                <p className="text-[11px] text-slate-500">{t('part_designations.formula_ref_desc', 'Identifiant et référence unique de la pièce dans l’entrepôt.')}</p>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/90 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">{t('part_designations.formula_link_title', 'Formule D — Liaison Type de Part')}</span>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-100 text-cyan-800">LIAISON</span>
                </div>
                <div className="font-mono text-xs text-cyan-800 font-bold bg-white p-2 rounded-lg border border-cyan-100">
                  =[@id_type] (Clé étrangère vers Part_Types)
                </div>
                <p className="text-[11px] text-slate-500">{t('part_designations.formula_link_desc', 'Rattache la désignation au type de part parent.')}</p>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/90 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">{t('part_designations.formula_stock_title', 'Formule G — Stock Entrepôt Associé')}</span>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">COUNTIF</span>
                </div>
                <div className="font-mono text-xs text-emerald-800 font-bold bg-white p-2 rounded-lg border border-emerald-100">
                  =COUNTIF(Entrepot_Items!C:C, [@ref])
                </div>
                <p className="text-[11px] text-slate-500">{t('part_designations.formula_stock_desc', 'Compte les occurrences de la référence dans les mouvements et lignes d’entrepôt.')}</p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">Modèle GMAO_Light_Template_V2</span>
              <button
                onClick={() => setShowFormulasModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out cursor-pointer"
              >
                {t('common.close', 'Fermer')}
              </button>
            </div>
          </div>
        </div>
      )}
    </AnimatedPage>
  );
}
