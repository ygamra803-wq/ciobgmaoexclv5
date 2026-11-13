import { useState, useMemo, useRef, useEffect } from 'react';
import AnimatedPage from '../../components/common/AnimatedPage';
import Action3DButton from '../../components/common/Action3DButton';
import PageHeaderIcon from '../../components/common/PageHeaderIcon';
import GmaoIndustrialDataGrid from '../../components/common/GmaoIndustrialDataGrid';
import CustomSelect from '../../components/common/CustomSelect';
import { usePermission } from '../../components/common/PermissionGate';
import { useI18n } from '../../../i18n/I18nContext';
import { useGmaoStore } from '../../../store/useGmaoStore';
import { PdrGroup, MaterialPolicyTag } from '../../../types/domain';
import {
  computePdrGroupStats,
  safeDeleteOrDeactivatePdrGroup,
  validateAndUpsertPdrGroup,
} from '../../../domain/stock/pdrHierarchyService';
import {
  Boxes,
  FolderTree,
  FileText,
  Tag,
  Package,
  Search,
  Edit2,
  Trash2,
  Power,
  ShieldCheck,
  AlertTriangle,
  SlidersHorizontal,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ArrowRight,
  RotateCcw,
  MoreVertical,
  X,
  FileSpreadsheet,
  Check,
  Hash,
} from 'lucide-react';

const AVAILABLE_POLICY_TAGS: { value: MaterialPolicyTag; label: string }[] = [
  { value: 'REPLACING', label: 'REPLACING (Remplacement Standard PDR)' },
  { value: 'REPAIRABLE', label: 'REPAIRABLE (Réparable / Révision)' },
  { value: 'MODIFYING', label: 'MODIFYING (Modification / Adaptation)' },
];

interface PdrGroupViewProps {
  pdrGroups?: PdrGroup[];
  setPdrGroups?: (updater: PdrGroup[] | ((prev: PdrGroup[]) => PdrGroup[])) => void;
  types?: any[];
  stockItems?: any[];
  onNavigateToTypesByGroup?: (groupId: string) => void;
  onNavigateToStockByGroup?: (groupId: string) => void;
  showToast?: (message: string, type?: string) => void;
}

export default function PdrGroupView({
  pdrGroups: propPdrGroups,
  setPdrGroups: propSetPdrGroups,
  types: propTypes,
  stockItems: propStockItems,
  onNavigateToTypesByGroup,
  onNavigateToStockByGroup,
  showToast,
}: PdrGroupViewProps) {
  const { t } = useI18n();
  const canCreateStock = usePermission('stock.create');
  const canEditStock = usePermission('stock.edit');
  const canDeleteStock = usePermission('stock.delete');

  const storePdrGroups = useGmaoStore((s) => s.pdrGroups) || [];
  const storeSetPdrGroups = useGmaoStore((s) => s.setPdrGroups);
  const storeTypes = useGmaoStore((s) => s.types) || [];
  const storeRawStock = useGmaoStore((s) => s.rawStock) || [];

  const pdrGroups = propPdrGroups ?? storePdrGroups;
  const setPdrGroups = propSetPdrGroups ?? storeSetPdrGroups;
  const types = propTypes ?? storeTypes;
  const stockItems = propStockItems ?? storeRawStock;

  const [localSearch, setLocalSearch] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [sortField, setSortField] = useState('sort_order');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeActionMenuId, setActiveActionMenuId] = useState<string | null>(null);

  const [showFormModal, setShowFormModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<PdrGroup | null>(null);
  const [deletingGroup, setDeletingGroup] = useState<PdrGroup | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [form, setForm] = useState<{
    code: string;
    libelle: string;
    description: string;
    domaine_technique: string;
    default_policy_tags: MaterialPolicyTag[];
    sort_order: number;
    is_active: boolean;
  }>({
    code: '',
    libelle: '',
    description: '',
    domaine_technique: '',
    default_policy_tags: ['REPLACING'],
    sort_order: 1,
    is_active: true,
  });

  const sortMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(localSearch), 180);
    return () => clearTimeout(timer);
  }, [localSearch]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (sortMenuRef.current && target && !sortMenuRef.current.contains(target)) {
        setShowSortMenu(false);
      }
      if (target && !target.closest('.action-menu-container')) {
        setActiveActionMenuId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const groupStatsMap = useMemo(() => {
    const map: Record<string, { typesCount: number; itemsCount: number; hasChildren: boolean }> = {};
    for (const g of pdrGroups) {
      if (!g || !g.id) continue;
      map[g.id] = computePdrGroupStats(g, types, stockItems);
    }
    return map;
  }, [pdrGroups, types, stockItems]);

  const filtered = useMemo(() => {
    return (pdrGroups || []).filter((g) => {
      if (!g) return false;
      const isActive = g.is_active !== false;
      if (statusFilter === 'ACTIVE' && !isActive) return false;
      if (statusFilter === 'INACTIVE' && isActive) return false;

      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const codeMatch = String(g.code || '').toLowerCase().includes(q);
        const libMatch = String(g.libelle || '').toLowerCase().includes(q);
        const descMatch = String(g.description || '').toLowerCase().includes(q);
        const idMatch = String(g.id || '').toLowerCase().includes(q);
        return codeMatch || libMatch || descMatch || idMatch;
      }
      return true;
    });
  }, [pdrGroups, statusFilter, search]);

  const sortedData = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      const statsA = groupStatsMap[a.id] || { typesCount: 0, itemsCount: 0 };
      const statsB = groupStatsMap[b.id] || { typesCount: 0, itemsCount: 0 };

      let valA: string | number = '';
      let valB: string | number = '';

      if (sortField === 'sort_order') {
        valA = Number(a.sort_order ?? 999);
        valB = Number(b.sort_order ?? 999);
      } else if (sortField === 'code') {
        valA = String(a.code || '').toLowerCase();
        valB = String(b.code || '').toLowerCase();
      } else if (sortField === 'libelle') {
        valA = String(a.libelle || '').toLowerCase();
        valB = String(b.libelle || '').toLowerCase();
      } else if (sortField === 'typesCount') {
        valA = statsA.typesCount;
        valB = statsB.typesCount;
      } else if (sortField === 'itemsCount') {
        valA = statsA.itemsCount;
        valB = statsB.itemsCount;
      } else if (sortField === 'is_active') {
        valA = a.is_active !== false ? 1 : 0;
        valB = b.is_active !== false ? 1 : 0;
      } else {
        valA = String((a as any)[sortField] || '').toLowerCase();
        valB = String((b as any)[sortField] || '').toLowerCase();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return String(a.code || '').localeCompare(String(b.code || ''));
    });
    return list;
  }, [filtered, sortField, sortOrder, groupStatsMap]);

  const totalItems = sortedData.length;
  const effectivePageSize = pageSize === 0 ? totalItems : pageSize;
  const startIndex = (currentPage - 1) * effectivePageSize;
  const displayedData =
    pageSize === 0 ? sortedData : sortedData.slice(startIndex, startIndex + effectivePageSize);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const renderSortIcon = (field: string) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-300 group-hover:text-cyan-600 transition shrink-0" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-cyan-700 shrink-0 font-bold" />
    ) : (
      <ArrowDown className="w-3 h-3 text-cyan-700 shrink-0 font-bold" />
    );
  };

  const handleOpenCreate = () => {
    setEditingGroup(null);
    setErrorMsg(null);
    setForm({
      code: '',
      libelle: '',
      description: '',
      domaine_technique: '',
      default_policy_tags: ['REPLACING'],
      sort_order: (pdrGroups?.length || 0) + 1,
      is_active: true,
    });
    setShowFormModal(true);
  };

  const handleOpenEdit = (group: PdrGroup) => {
    setEditingGroup(group);
    setErrorMsg(null);
    setForm({
      code: group.code || '',
      libelle: group.libelle || '',
      description: group.description || '',
      domaine_technique: group.domaine_technique || '',
      default_policy_tags:
        Array.isArray(group.default_policy_tags) && group.default_policy_tags.length > 0
          ? group.default_policy_tags
          : ['REPLACING'],
      sort_order: Number(group.sort_order ?? 1),
      is_active: group.is_active !== false,
    });
    setShowFormModal(true);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingGroup ? !canEditStock : !canCreateStock) return;

    const result = validateAndUpsertPdrGroup(pdrGroups, form, editingGroup?.id || null);
    if (!result.ok) {
      setErrorMsg(result.error || 'Erreur de validation.');
      return;
    }

    setPdrGroups(result.groups);
    showToast?.(
      editingGroup
        ? `Groupe PDR "${result.savedGroup?.code}" mis à jour avec succès.`
        : `Groupe PDR "${result.savedGroup?.code}" créé avec succès.`,
      'success'
    );
    setShowFormModal(false);
    setEditingGroup(null);
  };

  const handleToggleActive = (group: PdrGroup) => {
    if (!canEditStock) return;
    const nextActive = group.is_active === false ? true : false;
    const nextGroups = pdrGroups.map((g) =>
      g.id === group.id ? { ...g, is_active: nextActive } : g
    );
    setPdrGroups(nextGroups);
    showToast?.(
      nextActive
        ? `Groupe PDR "${group.code}" réactivé.`
        : `Groupe PDR "${group.code}" désactivé (Safe-Archive).`,
      'info'
    );
  };

  const handleConfirmDeleteOrDeactivate = () => {
    if (!deletingGroup) return;
    const outcome = safeDeleteOrDeactivatePdrGroup(
      pdrGroups,
      deletingGroup.id,
      types,
      stockItems
    );

    if (outcome.mode === 'DEACTIVATED') {
      setPdrGroups(outcome.groups);
      showToast?.(
        `Suppression remplacée par une désactivation sécurisée : le groupe "${deletingGroup.code}" est lié à ${outcome.typesCount} type(s) et ${outcome.itemsCount} article(s).`,
        'warning'
      );
    } else if (outcome.mode === 'DELETED') {
      setPdrGroups(outcome.groups);
      showToast?.(`Groupe PDR "${deletingGroup.code}" supprimé définitivement.`, 'info');
    }
    setDeletingGroup(null);
  };

  const handleExportExcel = () => {
    const headers = [
      'ID Groupe',
      'Code Groupe',
      'Libellé Groupe PDR',
      'Description',
      'Policy Tags',
      'Ordre',
      'Statut',
      'Nb Types Liés',
      'Nb Articles Stock',
    ];
    const rows = sortedData.map((g) => {
      const stats = groupStatsMap[g.id] || { typesCount: 0, itemsCount: 0 };
      return [
        g.id || '',
        g.code || '',
        g.libelle || '',
        g.description || '',
        (g.default_policy_tags || ['REPLACING']).join('|'),
        g.sort_order ?? 1,
        g.is_active !== false ? 'ACTIF' : 'INACTIF',
        stats.typesCount,
        stats.itemsCount,
      ];
    });
    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `groupes_pdr_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const togglePolicyTagInForm = (tag: MaterialPolicyTag) => {
    setForm((prev) => {
      const current = Array.isArray(prev.default_policy_tags) ? prev.default_policy_tags : [];
      const exists = current.includes(tag);
      const next = exists ? current.filter((t) => t !== tag) : [...current, tag];
      return {
        ...prev,
        default_policy_tags: next.length > 0 ? next : ['REPLACING'],
      };
    });
  };

  const columns = useMemo(
    () => [
      {
        key: 'code',
        label: 'CODE GROUPE',
        colLetter: 'A',
        icon: Boxes,
        sortable: true,
        render: (group: PdrGroup) => (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-xs font-mono font-bold text-indigo-800 shadow-2xs">
              <Boxes className="w-3 h-3 text-indigo-600" />
              <span>{group.code}</span>
            </span>
          </div>
        ),
      },
      {
        key: 'libelle',
        label: 'LIBELLÉ DU GROUPE PDR',
        colLetter: 'B',
        icon: FolderTree,
        sortable: true,
        render: (group: PdrGroup) => (
          <div>
            <div className="font-semibold text-slate-900 text-[13px]">{group.libelle}</div>
            <div className="text-[10.5px] font-mono text-slate-400">{group.id}</div>
          </div>
        ),
      },
      {
        key: 'description',
        label: 'DESCRIPTION & PÉRIMÈTRE',
        colLetter: 'C',
        icon: FileText,
        render: (group: PdrGroup) => (
          <span className="max-w-xs text-slate-500 text-[11.5px] leading-relaxed line-clamp-2 block">
            {group.description || '—'}
          </span>
        ),
      },
      {
        key: 'default_policy_tags',
        label: 'DOMAINE & POLITIQUE',
        colLetter: 'D',
        icon: Tag,
        render: (group: PdrGroup) => {
          const tags =
            Array.isArray(group.default_policy_tags) && group.default_policy_tags.length > 0
              ? group.default_policy_tags
              : ['REPLACING'];
          return (
            <div className="flex flex-wrap gap-1">
              {group.domaine_technique && (
                <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-800 border border-indigo-200 text-[10px] font-mono font-bold">
                  {group.domaine_technique}
                </span>
              )}
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded-md bg-cyan-50 text-cyan-800 border border-cyan-200 text-[10px] font-mono font-bold"
                >
                  {tag}
                </span>
              ))}
            </div>
          );
        },
      },
      {
        key: 'typesCount',
        label: 'TYPES PDR (NIV 2)',
        colLetter: 'E',
        icon: Tag,
        sortable: true,
        align: 'center',
        render: (group: PdrGroup) => {
          const stats = groupStatsMap[group.id] || { typesCount: 0, itemsCount: 0 };
          return (
            <button
              type="button"
              onClick={() => onNavigateToTypesByGroup?.(group.id)}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 text-xs font-semibold transition group/btn shadow-2xs cursor-pointer"
              title="Filtrer les Types PDR rattachés à ce groupe"
            >
              <Tag className="w-3.5 h-3.5 text-amber-700" />
              <span>{stats.typesCount} types</span>
              <ArrowRight className="w-3 h-3 text-amber-700 group-hover/btn:translate-x-0.5 transition-transform" />
            </button>
          );
        },
      },
      {
        key: 'itemsCount',
        label: 'ARTICLES STOCK (SKU)',
        colLetter: 'F',
        icon: Package,
        sortable: true,
        align: 'center',
        render: (group: PdrGroup) => {
          const stats = groupStatsMap[group.id] || { typesCount: 0, itemsCount: 0 };
          return (
            <button
              type="button"
              onClick={() => onNavigateToStockByGroup?.(group.id)}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-cyan-50 text-cyan-800 hover:bg-cyan-100 border border-cyan-200 text-xs font-semibold transition group/btn shadow-2xs cursor-pointer"
              title="Voir les articles du stock rattachés à ce groupe"
            >
              <Package className="w-3.5 h-3.5 text-cyan-700" />
              <span>{stats.itemsCount} SKU</span>
              <ArrowRight className="w-3 h-3 text-cyan-700 group-hover/btn:translate-x-0.5 transition-transform" />
            </button>
          );
        },
      },
      {
        key: 'sort_order',
        label: 'ORDRE',
        colLetter: 'G',
        icon: Hash,
        sortable: true,
        align: 'center',
        render: (group: PdrGroup) => (
          <span className="font-mono text-xs font-bold text-slate-600">
            #{group.sort_order ?? 1}
          </span>
        ),
      },
      {
        key: 'is_active',
        label: 'STATUT',
        colLetter: 'H',
        icon: ShieldCheck,
        sortable: true,
        align: 'center',
        render: (group: PdrGroup) =>
          group.is_active !== false ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
              <span>Actif</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
              <span>Désactivé</span>
            </span>
          ),
      },
      {
        key: 'actions',
        label: '•••',
        align: 'center',
        headerClassName: 'w-24 text-center font-bold text-slate-400 tracking-widest select-none',
        render: (group: PdrGroup) => {
          const stats = groupStatsMap[group.id] || { typesCount: 0, itemsCount: 0, hasChildren: false };
          return (
            <div className="relative inline-flex items-center justify-center action-menu-container">
              <div className="inline-flex rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
                {canEditStock && (
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(group)}
                    className="p-1.5 bg-white hover:bg-slate-100/80 text-slate-700 hover:text-indigo-700 transition flex items-center justify-center cursor-pointer border-r border-slate-200"
                    title="Modifier ce groupe PDR"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() =>
                    setActiveActionMenuId(activeActionMenuId === group.id ? null : group.id)
                  }
                  className={`p-1.5 hover:bg-slate-100 transition cursor-pointer ${
                    activeActionMenuId === group.id
                      ? 'bg-slate-100 text-indigo-700 font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Actions du groupe PDR"
                >
                  <MoreVertical className="w-3.5 h-3.5" />
                </button>
              </div>

              {activeActionMenuId === group.id && (
                <div className="absolute right-0 top-full mt-1.5 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 p-1.5 text-left animate-in fade-in slide-in-from-top-2 duration-150 space-y-0.5">
                  <div className="px-3 py-2 border-b border-slate-100 mb-1 bg-slate-50/80 rounded-xl">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Groupe PDR (Niveau 1)
                    </span>
                    <span className="text-xs font-mono font-bold text-indigo-700 truncate block">
                      {group.code} — {group.libelle}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveActionMenuId(null);
                      onNavigateToTypesByGroup?.(group.id);
                    }}
                    className="w-full px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-amber-50 hover:text-amber-800 rounded-xl transition flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Tag className="w-3.5 h-3.5 text-amber-600" />
                      <span>Voir Types PDR (Niveau 2)</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200">
                      {stats.typesCount}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveActionMenuId(null);
                      onNavigateToStockByGroup?.(group.id);
                    }}
                    className="w-full px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-cyan-50 hover:text-cyan-800 rounded-xl transition flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Package className="w-3.5 h-3.5 text-cyan-600" />
                      <span>Voir Articles Stock (SKU)</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-cyan-50 text-cyan-800 border border-cyan-200">
                      {stats.itemsCount}
                    </span>
                  </button>

                  {(canEditStock || canDeleteStock) && (
                    <div className="border-t border-slate-100 my-1" />
                  )}

                  {canEditStock && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveActionMenuId(null);
                          handleOpenEdit(group);
                        }}
                        className="w-full px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-xl transition flex items-center gap-2 cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Modifier ce Groupe</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setActiveActionMenuId(null);
                          handleToggleActive(group);
                        }}
                        className="w-full px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-amber-50 hover:text-amber-800 rounded-xl transition flex items-center gap-2 cursor-pointer"
                      >
                        <Power className="w-3.5 h-3.5 text-amber-600" />
                        <span>
                          {group.is_active !== false ? 'Désactiver le Groupe' : 'Réactiver le Groupe'}
                        </span>
                      </button>
                    </>
                  )}

                  {(canDeleteStock || canEditStock) && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveActionMenuId(null);
                        setDeletingGroup(group);
                      }}
                      className="w-full px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition flex items-center gap-2 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                      <span>
                        {stats.hasChildren ? 'Désactiver (Safe-Archive)' : 'Supprimer ce Groupe'}
                      </span>
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        },
      },
    ],
    [
      groupStatsMap,
      activeActionMenuId,
      canEditStock,
      canDeleteStock,
      onNavigateToTypesByGroup,
      onNavigateToStockByGroup,
    ]
  );

  return (
    <AnimatedPage className="space-y-4">
      {/* Top Banner */}
      <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200/90 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden group/header">
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none group-hover/header:bg-indigo-500/10 transition-colors duration-500" />

        <div className="min-w-0 flex-1 flex items-start sm:items-center gap-3.5 relative">
          <PageHeaderIcon icon={Boxes} colorClass="text-indigo-700" />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                {t('pdr_groups.title', 'Groupes PDR (Niveau 1 — Magasin Pièces de Rechange)')}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200">
                Groupe ➔ Type ➔ Désignation / SKU
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
              {t(
                'pdr_groups.subtitle',
                'Référentiel de premier niveau du magasin PDR (ex: Roulements, Courroies, Électricité, Hydraulique). Alimente les Types PDR et structure le catalogue sans affecter les soldes de stock.'
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 relative">
          {canCreateStock && (
            <Action3DButton
              variant="circle"
              color="indigo"
              icon={Boxes}
              showAddBadge={true}
              onClick={handleOpenCreate}
              title="Nouveau Groupe PDR"
            />
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="relative z-30 bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-200/80 flex items-center justify-center text-indigo-700 shadow-2xs shrink-0">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                  Filtres & Recherche Groupes PDR
                </span>
                <span className="bg-indigo-50 text-indigo-800 px-2.5 py-0.5 rounded-lg text-[11px] font-bold border border-indigo-200/70 shadow-2xs font-mono">
                  {filtered.length} / {pdrGroups.length}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                Classification Magasin PDR (`gmao_pdr_groups_v1`) • Colonnes A → H
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleExportExcel}
              className="h-8 px-3 rounded-xl border border-emerald-200/80 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
              title="Exporter les Groupes PDR vers CSV / Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export Excel</span>
            </button>

            {(localSearch || statusFilter !== 'ALL' || sortField !== 'sort_order' || sortOrder !== 'asc') && (
              <button
                type="button"
                onClick={() => {
                  setLocalSearch('');
                  setStatusFilter('ALL');
                  setSortField('sort_order');
                  setSortOrder('asc');
                }}
                title="Réinitialiser les filtres"
                className="w-8 h-8 rounded-full border border-rose-200/80 bg-rose-50 hover:bg-rose-100 text-rose-700 transition flex items-center justify-center cursor-pointer shadow-2xs active:scale-95"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          {/* Free Search */}
          <div className="w-full">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-800">
                RECHERCHE LIBRE (CODE / LIBELLÉ)
              </label>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide bg-slate-100 text-slate-700 border border-slate-200">
                Col. A + B
              </span>
            </div>
            <div className="relative flex items-center">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-md bg-indigo-100 border border-indigo-300/80 flex items-center justify-center text-indigo-700 pointer-events-none z-10">
                <Search className="w-3 h-3" />
              </span>
              <input
                type="text"
                placeholder="Rechercher par code (ROUL, COUR...) ou libellé..."
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                className="w-full h-10 pl-9 pr-8 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
              />
              {localSearch && (
                <button
                  type="button"
                  onClick={() => setLocalSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer z-10"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Status Filter */}
          <div className="w-full">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-800">
                STATUT DU GROUPE
              </label>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide bg-slate-100 text-slate-700 border border-slate-200">
                Col. H
              </span>
            </div>
            <CustomSelect
              value={statusFilter}
              onChange={(val) => setStatusFilter(val as 'ALL' | 'ACTIVE' | 'INACTIVE')}
              options={[
                { value: 'ALL', label: `Tous les Groupes (${pdrGroups.length})` },
                {
                  value: 'ACTIVE',
                  label: `Groupes Actifs (${pdrGroups.filter((g) => g.is_active !== false).length})`,
                },
                {
                  value: 'INACTIVE',
                  label: `Groupes Désactivés (${pdrGroups.filter((g) => g.is_active === false).length})`,
                },
              ]}
            />
          </div>

          {/* Sort Dropdown */}
          <div className="w-full relative" ref={sortMenuRef}>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-800">
                TRI DES GROUPES
              </label>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide bg-slate-100 text-slate-700 border border-slate-200">
                Ordre
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowSortMenu(!showSortMenu)}
              className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-indigo-100 border border-indigo-300/80 flex items-center justify-center text-indigo-700 shrink-0">
                  <ArrowUpDown className="w-3 h-3" />
                </span>
                <span>
                  Tri : <b className="font-mono text-slate-900">{sortField.toUpperCase()}</b> (
                  {sortOrder === 'asc' ? 'Asc' : 'Desc'})
                </span>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                  showSortMenu ? 'rotate-180' : ''
                }`}
              />
            </button>

            {showSortMenu && (
              <div className="absolute left-0 right-0 mt-2 bg-white rounded-2xl border border-slate-200 shadow-xl z-50 p-2 space-y-1 text-xs">
                {[
                  { key: 'sort_order', label: 'Ordre d’affichage (G)' },
                  { key: 'code', label: 'Code Groupe (A)' },
                  { key: 'libelle', label: 'Libellé du Groupe (B)' },
                  { key: 'typesCount', label: 'Nb Types PDR liés (E)' },
                  { key: 'itemsCount', label: 'Nb Articles Stock (F)' },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => {
                      handleSort(opt.key);
                      setShowSortMenu(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl font-medium transition cursor-pointer ${
                      sortField === opt.key
                        ? 'bg-indigo-50 text-indigo-800 font-bold'
                        : 'hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {sortField === opt.key &&
                      (sortOrder === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-indigo-600" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-indigo-600" />
                      ))}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Industrial Data Grid */}
      <GmaoIndustrialDataGrid
        title="Tableau des Groupes PDR (Niveau 1) • Colonnes A → H"
        icon={<Boxes className="w-4 h-4 text-indigo-600" />}
        excelMapping="code (A) | libelle (B) | description (C) | default_policy_tags (D) | nb_types (E) | nb_articles (F) | sort_order (G) | is_active (H)"
        bannerColor="slate"
        columns={columns}
        data={displayedData}
        sortField={sortField}
        sortOrder={sortOrder}
        onSort={handleSort}
        renderSortIcon={renderSortIcon}
        startIndex={startIndex}
        showRowNumber={true}
        emptyIcon={<Boxes className="w-8 h-8 text-slate-300" />}
        emptyMessage="Aucun groupe PDR trouvé"
        pagination={{
          currentPage,
          setCurrentPage,
          pageSize,
          setPageSize,
          totalItems,
          pageSizeOptions: [20, 50, 100, 0],
          color: 'indigo',
          itemLabel: 'groupes PDR',
        }}
      />

      {/* Add / Edit Modal */}
      {showFormModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowFormModal(false);
              setEditingGroup(null);
            }
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700">
                  <Boxes className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900">
                    {editingGroup ? `Modifier Groupe PDR : ${editingGroup.code}` : 'Nouveau Groupe PDR'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Classification de niveau 1 du Magasin Pièces de Rechange
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowFormModal(false);
                  setEditingGroup(null);
                }}
                className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveForm} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                    Code Groupe *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ex: ROUL"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-xs font-mono font-bold outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                    Libellé du Groupe *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ex: Roulements & Paliers industriels"
                    value={form.libelle}
                    onChange={(e) => setForm({ ...form, libelle: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-xs font-semibold outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                  Description / Périmètre
                </label>
                <input
                  type="text"
                  placeholder="ex: Roulements à billes, rouleaux, rotules et paliers..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-xs outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                    Domaine Technique (P3)
                  </label>
                  <select
                    value={form.domaine_technique}
                    onChange={(e) => setForm({ ...form, domaine_technique: e.target.value })}
                    className="w-full h-10 px-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-xs font-bold outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="">— Multi-domaines —</option>
                    <option value="MECANIQUE">MÉCANIQUE</option>
                    <option value="ELECTRIQUE">ÉLECTRIQUE</option>
                    <option value="HYDRAULIQUE">HYDRAULIQUE</option>
                    <option value="PNEUMATIQUE">PNEUMATIQUE</option>
                    <option value="AUTOMATISME">AUTOMATISME</option>
                    <option value="LUBRIFIANTS">LUBRIFIANTS</option>
                    <option value="CONSOMMABLES">CONSOMMABLES</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                    Ordre d’affichage
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={form.sort_order}
                    onChange={(e) =>
                      setForm({ ...form, sort_order: Math.max(1, Number(e.target.value) || 1) })
                    }
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-xs font-mono font-bold outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Groupe Actif</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block mb-1.5">
                  Politique Matière par Défaut (`default_policy_tags`)
                </label>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_POLICY_TAGS.map((tagOpt) => {
                    const selected = (form.default_policy_tags || []).includes(tagOpt.value);
                    return (
                      <button
                        key={tagOpt.value}
                        type="button"
                        onClick={() => togglePolicyTagInForm(tagOpt.value)}
                        className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition cursor-pointer flex items-center gap-1.5 ${
                          selected
                            ? 'bg-indigo-50 text-indigo-800 border-indigo-300'
                            : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {selected && <Check className="w-3 h-3 text-indigo-600" />}
                        <span>{tagOpt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowFormModal(false);
                    setEditingGroup(null);
                  }}
                  className="flex-1 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  {editingGroup ? 'Mettre à jour' : 'Enregistrer le Groupe'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Safe Delete / Deactivate Confirmation Modal */}
      {deletingGroup && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 border border-slate-200 space-y-4">
            <div className="flex flex-col items-center text-center">
              <AlertTriangle className="w-9 h-9 text-amber-600 mb-2" />
              <h3 className="font-black text-base text-slate-900">
                {groupStatsMap[deletingGroup.id]?.hasChildren
                  ? `Désactiver le groupe "${deletingGroup.code}" ?`
                  : `Supprimer le groupe "${deletingGroup.code}" ?`}
              </h3>
            </div>
            <p className="text-xs text-center text-slate-600 leading-relaxed">
              {groupStatsMap[deletingGroup.id]?.hasChildren ? (
                <>
                  Ce groupe est rattaché à{' '}
                  <b>{groupStatsMap[deletingGroup.id]?.typesCount || 0} type(s)</b> et{' '}
                  <b>{groupStatsMap[deletingGroup.id]?.itemsCount || 0} article(s)</b>. Conformément
                  à la politique <b>Safe-Archive</b>, il sera <b>désactivé (`is_active = false`)</b>{' '}
                  sans supprimer les types ni les articles liés.
                </>
              ) : (
                <>
                  Aucun type ni article n’est rattaché au groupe{' '}
                  <b>
                    {deletingGroup.code} ({deletingGroup.libelle})
                  </b>
                  . Confirmez-vous sa suppression définitive ?
                </>
              )}
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingGroup(null)}
                className="flex-1 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteOrDeactivate}
                className={`flex-1 h-10 rounded-xl text-white text-xs font-bold cursor-pointer ${
                  groupStatsMap[deletingGroup.id]?.hasChildren
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {groupStatsMap[deletingGroup.id]?.hasChildren
                  ? 'Désactiver (Safe-Archive)'
                  : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AnimatedPage>
  );
}
