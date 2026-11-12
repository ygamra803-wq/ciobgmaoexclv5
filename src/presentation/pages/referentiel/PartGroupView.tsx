import { useState, useMemo, useEffect, useRef } from 'react';
import AnimatedPage from '../../components/common/AnimatedPage';
import Action3DButton from '../../components/common/Action3DButton';
import FormulasModalButton from '../../components/common/FormulasModalButton';
import PageHeaderIcon from '../../components/common/PageHeaderIcon';
import GmaoIndustrialDataGrid from '../../components/common/GmaoIndustrialDataGrid';
import CustomSelect from '../../components/common/CustomSelect';
import { useI18n } from '../../../i18n/I18nContext';
import { usePermission } from '../../components/common/PermissionGate';
import {
  Search,
  ArrowRight,
  Trash2,
  Edit2,
  SlidersHorizontal,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  RotateCcw,
  X,
  Copy,
  Check,
  FileSpreadsheet,
  FileText,
  Hash,
  Boxes,
  FolderTree,
  MoreVertical,
  Tags,
  Layers,
  Wrench,
  CheckCircle2,
  Archive,
  Power,
  AlertTriangle,
} from 'lucide-react';
import type { IPartGroup, IPartType, IPartDesignation, IWarehouseItem, MaterialPolicyTag } from '../../../types/domain';

const POLICY_TAG_META: Record<
  MaterialPolicyTag,
  { label: string; shortLabel: string; badgeClass: string }
> = {
  REPAIRABLE: {
    label: 'Réparable / Rectifiable (Atelier)',
    shortLabel: 'REPAIRABLE',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  REPLACING: {
    label: 'Remplacement Standard',
    shortLabel: 'REPLACING',
    badgeClass: 'bg-sky-50 text-sky-800 border-sky-200',
  },
  MODIFYING: {
    label: 'Modification / Adaptation',
    shortLabel: 'MODIFYING',
    badgeClass: 'bg-purple-50 text-purple-800 border-purple-200',
  },
};

export interface PartGroupViewProps {
  partGroups?: IPartGroup[];
  partTypes?: IPartType[];
  partDesignations?: IPartDesignation[];
  warehouseItems?: IWarehouseItem[];
  onAddPartGroup?: (grp: IPartGroup) => void;
  onUpdatePartGroup?: (id: string, grp: IPartGroup) => void;
  onDeletePartGroup?: (id: string) => void;
  onNavigateToPartTypesByGroup?: (groupId: string) => void;
  onNavigateToEntrepotByPartGroup?: (groupId: string) => void;
}

export default function PartGroupView({
  partGroups = [],
  partTypes = [],
  partDesignations = [],
  warehouseItems = [],
  onAddPartGroup,
  onUpdatePartGroup,
  onDeletePartGroup,
  onNavigateToPartTypesByGroup,
  onNavigateToEntrepotByPartGroup,
}: PartGroupViewProps) {
  const { t } = useI18n();
  const canCreateStock = usePermission('stock.create');
  const canEditStock = usePermission('stock.edit');
  const canDeleteStock = usePermission('stock.delete');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [sortField, setSortField] = useState('code');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<IPartGroup | null>(null);
  const [deletingGroup, setDeletingGroup] = useState<IPartGroup | null>(null);
  const [showFormulasModal, setShowFormulasModal] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [form, setForm] = useState<{
    id: string;
    code: string;
    libelle: string;
    description: string;
    default_policy_tags: MaterialPolicyTag[];
    sort_order: number;
    is_active: boolean;
  }>({
    id: '',
    code: '',
    libelle: '',
    description: '',
    default_policy_tags: ['REPLACING'],
    sort_order: 1,
    is_active: true,
  });

  // Pagination & Action Popovers
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [activeActionMenuId, setActiveActionMenuId] = useState<string | null>(null);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && !target.closest('.action-menu-container')) {
        setActiveActionMenuId(null);
      }
      if (sortMenuRef.current && target && !sortMenuRef.current.contains(target)) {
        setShowSortMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleCopyId = (idVal: string) => {
    navigator.clipboard.writeText(idVal);
    setCopiedId(idVal);
    setTimeout(() => setCopiedId(null), 1800);
  };

  // Group stats: linked PartTypes (Niv 2), PartDesignations (Niv 3), and Warehouse PART items
  const groupStats = useMemo(() => {
    const map: Record<
      string,
      { typesCount: number; designationsCount: number; itemsCount: number }
    > = {};

    const safeGroups = Array.isArray(partGroups) ? partGroups : [];
    const safeTypes = Array.isArray(partTypes) ? partTypes : [];
    const safeDesignations = Array.isArray(partDesignations) ? partDesignations : [];
    const safeWh = Array.isArray(warehouseItems) ? warehouseItems : [];

    safeGroups.forEach((g) => {
      const gId = String(g.id || g.id_group || g.id_groupe || '');
      const gCode = String(g.code || '');
      const linkedTypes = safeTypes.filter((pt) => {
        const ptGrp = String(pt.id_group || pt.id_groupe || '');
        return Boolean(ptGrp && (ptGrp === gId || (gCode && ptGrp === gCode)));
      });
      const typeIds = new Set(linkedTypes.map((pt) => String(pt.id_type || pt.id || '')));

      const linkedDesignations = safeDesignations.filter((pd) => {
        const pdGrp = String(pd.id_group || pd.id_groupe || '');
        const pdType = String(pd.id_type || pd.type || '');
        return (
          (pdGrp && (pdGrp === gId || (gCode && pdGrp === gCode))) ||
          (pdType && typeIds.has(pdType))
        );
      });

      const linkedWhItems = safeWh.filter((w) => {
        const n = String(w.nature || '').toUpperCase();
        const isPart = n === 'PART' || n.includes('PART') || n.includes('PIECE') || n.includes('PIÈCE') || Boolean(w.id_type);
        if (!isPart) return false;
        const wGrp = String(w.id_group || w.id_groupe || '');
        const wType = String(w.id_type || w.id_part_type || '');
        return (
          (wGrp && (wGrp === gId || (gCode && wGrp === gCode))) ||
          (wType && typeIds.has(wType))
        );
      });

      map[gId] = {
        typesCount: linkedTypes.length,
        designationsCount: linkedDesignations.length,
        itemsCount: linkedWhItems.length,
      };
    });

    return map;
  }, [partGroups, partTypes, partDesignations, warehouseItems]);

  const unassignedStats = useMemo(() => {
    const safeGroups = Array.isArray(partGroups) ? partGroups : [];
    const validIds = new Set<string>();
    safeGroups.forEach((g) => {
      const gId = String(g.id || g.id_group || g.id_groupe || '').trim();
      const gCode = String(g.code || '').trim();
      if (gId) validIds.add(gId);
      if (gCode) validIds.add(gCode);
    });
    const unassignedTypes = (partTypes || []).filter((pt) => {
      const grp = String(pt.id_group || pt.id_groupe || '').trim();
      return !grp || !validIds.has(grp);
    }).length;
    return { unassignedTypes };
  }, [partGroups, partTypes]);

  const filtered = useMemo(() => {
    return (partGroups || []).filter((g) => {
      const isActive = g.is_active !== false;
      if (statusFilter === 'ACTIVE' && !isActive) return false;
      if (statusFilter === 'INACTIVE' && isActive) return false;

      const q = search.trim().toLowerCase();
      if (!q) return true;
      const idStr = String(g.id || g.id_group || g.id_groupe || '').toLowerCase();
      const codeStr = String(g.code || '').toLowerCase();
      const libStr = String(g.libelle || '').toLowerCase();
      const descStr = String(g.description || '').toLowerCase();
      return (
        idStr.includes(q) ||
        codeStr.includes(q) ||
        libStr.includes(q) ||
        descStr.includes(q)
      );
    });
  }, [partGroups, search, statusFilter]);

  const sortedData = useMemo(() => {
    const data = [...filtered];
    data.sort((a, b) => {
      const aId = String(a.id || a.id_group || a.id_groupe || '');
      const bId = String(b.id || b.id_group || b.id_groupe || '');

      let aVal: any = a[sortField] ?? '';
      let bVal: any = b[sortField] ?? '';

      if (sortField === 'typesCount') {
        aVal = groupStats[aId]?.typesCount || 0;
        bVal = groupStats[bId]?.typesCount || 0;
      } else if (sortField === 'itemsCount') {
        aVal = groupStats[aId]?.itemsCount || 0;
        bVal = groupStats[bId]?.itemsCount || 0;
      }

      if (typeof aVal === 'string') {
        return sortOrder === 'asc'
          ? aVal.localeCompare(String(bVal))
          : String(bVal).localeCompare(aVal);
      }
      return sortOrder === 'asc' ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal);
    });
    return data;
  }, [filtered, sortField, sortOrder, groupStats]);

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
      return <ArrowUpDown className="w-3 h-3 text-slate-300 group-hover:text-slate-500 transition shrink-0" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-teal-700 shrink-0 font-bold" />
    ) : (
      <ArrowDown className="w-3 h-3 text-teal-700 shrink-0 font-bold" />
    );
  };

  const togglePolicyTag = (tag: MaterialPolicyTag) => {
    setForm((prev) => {
      const current = Array.isArray(prev.default_policy_tags) ? prev.default_policy_tags : [];
      const exists = current.includes(tag);
      const next = exists ? current.filter((t) => t !== tag) : [...current, tag];
      return { ...prev, default_policy_tags: next };
    });
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreateStock) return;
    setFormError(null);
    const cleanCode = form.code.trim().toUpperCase().replace(/\s+/g, '-');
    const cleanLibelle = form.libelle.trim();
    if (!cleanCode || !cleanLibelle) {
      setFormError('Le code et le libellé du groupe de parts sont obligatoires.');
      return;
    }

    const duplicateCode = (partGroups || []).some(
      (g) => String(g.code || '').trim().toUpperCase() === cleanCode
    );
    if (duplicateCode) {
      setFormError(`Le code groupe "${cleanCode}" existe déjà dans les Groupes Parts.`);
      return;
    }

    const autoId =
      form.id.trim().toUpperCase() ||
      `GRP-PRT-${cleanCode}-${String((partGroups || []).length + 1).padStart(2, '0')}`;

    onAddPartGroup?.({
      id: autoId,
      id_groupe: autoId,
      id_group: autoId,
      code: cleanCode,
      libelle: cleanLibelle,
      description: form.description.trim(),
      default_policy_tags: form.default_policy_tags,
      sort_order: Number(form.sort_order) || (partGroups || []).length + 1,
      is_active: form.is_active !== false,
      created_at: new Date().toISOString().slice(0, 10),
    });

    setShowAddModal(false);
    setFormError(null);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditStock || !editingGroup) return;
    setFormError(null);
    const targetId = String(editingGroup.id || editingGroup.id_group || editingGroup.id_groupe || '');
    const cleanCode = form.code.trim().toUpperCase().replace(/\s+/g, '-');
    const cleanLibelle = form.libelle.trim();
    if (!cleanCode || !cleanLibelle) {
      setFormError('Le code et le libellé du groupe de parts sont obligatoires.');
      return;
    }

    const duplicateCode = (partGroups || []).some((g) => {
      const gId = String(g.id || g.id_group || g.id_groupe || '');
      return gId !== targetId && String(g.code || '').trim().toUpperCase() === cleanCode;
    });
    if (duplicateCode) {
      setFormError(`Le code groupe "${cleanCode}" est déjà utilisé par un autre groupe.`);
      return;
    }

    onUpdatePartGroup?.(targetId, {
      ...editingGroup,
      id: targetId,
      id_groupe: targetId,
      id_group: targetId,
      code: cleanCode,
      libelle: cleanLibelle,
      description: form.description.trim(),
      default_policy_tags: form.default_policy_tags,
      sort_order: Number(form.sort_order) || 1,
      is_active: form.is_active !== false,
    });

    setEditingGroup(null);
    setFormError(null);
  };

  const handleToggleActive = (group: IPartGroup) => {
    if (!canEditStock) return;
    const gId = String(group.id || group.id_group || group.id_groupe || '');
    const nextActive = group.is_active === false;
    onUpdatePartGroup?.(gId, {
      ...group,
      is_active: nextActive,
    });
  };

  const getSortFieldLabel = (field: string) => {
    switch (field) {
      case 'code':
        return 'Code Groupe Part';
      case 'libelle':
        return 'Libellé';
      case 'typesCount':
        return 'Types Parts (Niv 2)';
      case 'itemsCount':
        return 'Parts en Entrepôt';
      default:
        return field?.toUpperCase() || '';
    }
  };

  const handleExportExcel = () => {
    const headers = [
      'ID Groupe Part',
      'Code Groupe',
      'Libellé Groupe',
      'Description',
      'Politiques Matières',
      'Statut',
      'Nb Types Parts (Niv 2)',
      'Nb Désignations Parts (Niv 3)',
      'Nb Parts Entrepôt',
    ];
    const rows = filtered.map((g) => {
      const gId = String(g.id || g.id_group || g.id_groupe || '');
      const stats = groupStats[gId] || { typesCount: 0, designationsCount: 0, itemsCount: 0 };
      return [
        gId,
        g.code || '',
        g.libelle || '',
        g.description || '',
        (g.default_policy_tags || []).join('|'),
        g.is_active === false ? 'INACTIF' : 'ACTIF',
        stats.typesCount,
        stats.designationsCount,
        stats.itemsCount,
      ];
    });
    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `groupes_parts_entrepot_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const groupColumns = useMemo(
    () => [
      {
        key: 'code',
        label: 'CODE GROUPE PART (NIV 1)',
        colLetter: 'A',
        icon: Boxes,
        sortable: true,
        render: (group: IPartGroup) => {
          const gId = String(group.id || group.id_group || group.id_groupe || '');
          const isActive = group.is_active !== false;
          return (
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-mono font-bold shadow-2xs ${
                  isActive
                    ? 'bg-teal-50 border-teal-200/80 text-teal-800'
                    : 'bg-slate-100 border-slate-200 text-slate-500 line-through'
                }`}
              >
                <Boxes className={`w-3 h-3 ${isActive ? 'text-teal-600' : 'text-slate-400'}`} />
                <span>{group.code || gId}</span>
              </span>
              {!isActive && (
                <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 text-[9px] font-bold uppercase">
                  Inactif
                </span>
              )}
            </div>
          );
        },
      },
      {
        key: 'libelle',
        label: 'DÉSIGNATION / LIBELLÉ GROUPE PART',
        colLetter: 'B',
        icon: FolderTree,
        sortable: true,
        render: (group: IPartGroup) => (
          <div>
            <span className="font-semibold text-slate-800 text-[13px] block">{group.libelle}</span>
            {group.description && (
              <span className="max-w-xs text-slate-500 text-[11px] leading-relaxed line-clamp-1 block mt-0.5">
                {group.description}
              </span>
            )}
          </div>
        ),
      },
      {
        key: 'default_policy_tags',
        label: 'POLITIQUES MATIÈRES PAR DÉFAUT',
        colLetter: 'C',
        icon: Wrench,
        render: (group: IPartGroup) => {
          const tags = Array.isArray(group.default_policy_tags) ? group.default_policy_tags : [];
          if (tags.length === 0) {
            return <span className="text-slate-400 text-[11px] italic">Aucune</span>;
          }
          return (
            <div className="flex flex-wrap gap-1">
              {tags.map((tag) => {
                const meta = POLICY_TAG_META[tag];
                if (!meta) return null;
                return (
                  <span
                    key={tag}
                    className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${meta.badgeClass}`}
                    title={meta.label}
                  >
                    {meta.shortLabel}
                  </span>
                );
              })}
            </div>
          );
        },
      },
      {
        key: 'typesCount',
        label: 'TYPES PARTS (NIV 2)',
        colLetter: 'D',
        icon: Tags,
        sortable: true,
        align: 'center' as const,
        render: (group: IPartGroup) => {
          const gId = String(group.id || group.id_group || group.id_groupe || '');
          const stats = groupStats[gId] || { typesCount: 0 };
          return (
            <button
              type="button"
              onClick={() => onNavigateToPartTypesByGroup?.(gId)}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-teal-50 text-teal-800 hover:bg-teal-100 border border-teal-200 text-xs font-semibold transition group/btn shadow-2xs cursor-pointer"
              title="Voir les Types Parts rattachés à ce groupe"
            >
              <Tags className="w-3.5 h-3.5 text-teal-700" />
              <span>{stats.typesCount} type(s)</span>
              <ArrowRight className="w-3 h-3 text-teal-700 group-hover/btn:translate-x-0.5 transition-transform" />
            </button>
          );
        },
      },
      {
        key: 'itemsCount',
        label: 'PARTS EN ENTREPÔT',
        colLetter: 'E',
        icon: Layers,
        sortable: true,
        align: 'center' as const,
        render: (group: IPartGroup) => {
          const gId = String(group.id || group.id_group || group.id_groupe || '');
          const stats = groupStats[gId] || { itemsCount: 0, designationsCount: 0 };
          return (
            <button
              type="button"
              onClick={() => onNavigateToEntrepotByPartGroup?.(gId)}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 text-xs font-semibold transition group/btn shadow-2xs cursor-pointer"
              title="Filtrer l'Entrepôt (Parts) sur ce groupe"
            >
              <Layers className="w-3.5 h-3.5 text-amber-700" />
              <span>{stats.itemsCount} part(s)</span>
              <ArrowRight className="w-3 h-3 text-amber-700 group-hover/btn:translate-x-0.5 transition-transform" />
            </button>
          );
        },
      },
      {
        key: 'passport_id',
        label: 'ID GROUPE',
        colLetter: 'F',
        icon: Hash,
        render: (group: IPartGroup) => {
          const gId = String(group.id || group.id_group || group.id_groupe || '');
          const isCopied = copiedId === gId;
          return (
            <div className="flex items-center gap-1.5">
              <code className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[11px] text-slate-700 font-mono">
                {gId}
              </code>
              <button
                type="button"
                onClick={() => handleCopyId(gId)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded transition cursor-pointer"
                title="Copier l'ID du groupe"
              >
                {isCopied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          );
        },
      },
      {
        key: 'actions',
        label: '•••',
        align: 'center' as const,
        headerClassName: 'w-24 text-center font-bold text-slate-400 tracking-widest select-none',
        render: (group: IPartGroup) => {
          const gId = String(group.id || group.id_group || group.id_groupe || '');
          const stats = groupStats[gId] || { typesCount: 0, itemsCount: 0 };
          return (
            <div className="relative inline-flex items-center justify-center action-menu-container">
              <div className="inline-flex rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
                <button
                  type="button"
                  onClick={() => {
                    onNavigateToPartTypesByGroup?.(gId);
                    setActiveActionMenuId(null);
                  }}
                  className="p-1.5 bg-white hover:bg-slate-100/80 text-slate-800 hover:text-black transition flex items-center justify-center cursor-pointer border-r border-slate-200"
                  title="Voir les Types Parts de ce groupe"
                >
                  <Tags className="w-3.5 h-3.5 text-teal-700" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveActionMenuId(activeActionMenuId === gId ? null : gId);
                  }}
                  className={`p-1.5 hover:bg-slate-100 transition cursor-pointer ${
                    activeActionMenuId === gId
                      ? 'bg-slate-100 text-teal-700 font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Actions et options du groupe"
                >
                  <MoreVertical className="w-3.5 h-3.5" />
                </button>
              </div>

              {activeActionMenuId === gId && (
                <div className="absolute right-0 top-full mt-1.5 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 p-1.5 text-left animate-in fade-in slide-in-from-top-2 duration-150 space-y-0.5">
                  <div className="px-3 py-2 border-b border-slate-100 mb-1 bg-slate-50/80 rounded-xl">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Actions Groupe Part (Entrepôt)
                    </span>
                    <span className="text-xs font-mono font-bold text-teal-700 truncate block">
                      {group.code || gId} — {group.libelle}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveActionMenuId(null);
                      onNavigateToPartTypesByGroup?.(gId);
                    }}
                    className="w-full px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-teal-50 hover:text-teal-800 rounded-xl transition flex items-center justify-between cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5">
                      <Tags className="w-3.5 h-3.5 text-teal-600 group-hover:scale-110 transition-transform" />
                      <span>Voir Types Parts (Niveau 2)</span>
                    </div>
                    <span className="text-[10px] font-mono text-teal-700 bg-teal-50 px-1.5 py-0.2 rounded font-bold border border-teal-200/60">
                      {stats.typesCount}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveActionMenuId(null);
                      onNavigateToEntrepotByPartGroup?.(gId);
                    }}
                    className="w-full px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-amber-50 hover:text-amber-800 rounded-xl transition flex items-center justify-between cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5">
                      <Layers className="w-3.5 h-3.5 text-amber-600 group-hover:scale-110 transition-transform" />
                      <span>Voir Parts en Entrepôt</span>
                    </div>
                    <span className="text-[10px] font-mono text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded font-bold border border-amber-200/60">
                      {stats.itemsCount}
                    </span>
                  </button>

                  {(canEditStock || canDeleteStock) && <div className="border-t border-slate-100 my-1" />}

                  {canEditStock && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveActionMenuId(null);
                          setFormError(null);
                          setEditingGroup(group);
                          setForm({
                            id: gId,
                            code: group.code || '',
                            libelle: group.libelle || '',
                            description: group.description || '',
                            default_policy_tags: Array.isArray(group.default_policy_tags)
                              ? group.default_policy_tags
                              : ['REPLACING'],
                            sort_order: Number(group.sort_order) || 1,
                            is_active: group.is_active !== false,
                          });
                        }}
                        className="w-full px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition flex items-center gap-2.5 cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                        <span>Modifier ce groupe</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setActiveActionMenuId(null);
                          handleToggleActive(group);
                        }}
                        className="w-full px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition flex items-center gap-2.5 cursor-pointer"
                      >
                        <Power className="w-3.5 h-3.5 text-amber-600" />
                        <span>
                          {group.is_active === false ? 'Réactiver ce groupe' : 'Désactiver ce groupe'}
                        </span>
                      </button>
                    </>
                  )}

                  {canDeleteStock && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveActionMenuId(null);
                        setDeletingGroup(group);
                      }}
                      className="w-full px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition flex items-center gap-2.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                      <span>Supprimer / Archiver</span>
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
      copiedId,
      groupStats,
      activeActionMenuId,
      onNavigateToPartTypesByGroup,
      onNavigateToEntrepotByPartGroup,
      canEditStock,
      canDeleteStock,
    ]
  );

  return (
    <AnimatedPage className="space-y-4">
      {/* Top Banner */}
      <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200/90 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden group/header">
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-teal-500/5 rounded-full blur-2xl pointer-events-none group-hover/header:bg-teal-500/10 transition-colors duration-500" />

        <div className="min-w-0 flex-1 flex items-start sm:items-center gap-3.5 relative">
          <PageHeaderIcon icon={Boxes} colorClass="text-teal-700" />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                {t('parts.group.title', "Groupes de Parts d'Entrepôt (Niveau 1)")}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-teal-50 text-teal-700 border border-teal-200">
                Hiérarchie Parts 3 Niveaux
              </span>
              {unassignedStats.unassignedTypes > 0 && (
                <button
                  type="button"
                  onClick={() => onNavigateToPartTypesByGroup?.('UNASSIGNED')}
                  className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition cursor-pointer"
                >
                  {unassignedStats.unassignedTypes} type(s) non classé(s)
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
              Structure parente dédiée aux Parts d'Entrepôt (Organes Mécaniques, Fixation, Hydraulique/Pneumatique, Électrique). Totalement indépendante des Groupes de Composants et des Groupes PDR.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 relative">
          <FormulasModalButton
            onClick={() => setShowFormulasModal(true)}
            title="Aide & Architecture Groupes Parts"
          />

          {canCreateStock && (
            <Action3DButton
              variant="circle"
              color="teal"
              icon={Boxes}
              showAddBadge={true}
              onClick={() => {
                const nextIdx = (partGroups || []).length + 1;
                setFormError(null);
                setForm({
                  id: `GRP-PRT-${String(nextIdx).padStart(3, '0')}`,
                  code: '',
                  libelle: '',
                  description: '',
                  default_policy_tags: ['REPLACING'],
                  sort_order: nextIdx,
                  is_active: true,
                });
                setShowAddModal(true);
              }}
              title="Nouveau Groupe de Parts"
            />
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="relative z-30 bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-teal-500/10 border border-teal-200/80 flex items-center justify-center text-teal-700 shadow-2xs shrink-0">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                  Filtres & Recherche Avancée
                </span>
                <span className="bg-teal-50 text-teal-800 px-2.5 py-0.5 rounded-lg text-[11px] font-bold border border-teal-200/70 shadow-2xs font-mono">
                  {filtered.length} / {(partGroups || []).length}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                Nomenclature Niveau 1 • Groupes Parts ➔ Types Parts ➔ Désignations Parts
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleExportExcel}
              className="h-8 px-3 rounded-xl border border-emerald-200/80 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
              title="Exporter les groupes parts vers CSV/Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export Excel</span>
            </button>

            {(search || statusFilter !== 'ALL' || sortField !== 'code' || sortOrder !== 'asc') && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setStatusFilter('ALL');
                  setSortField('code');
                  setSortOrder('asc');
                }}
                title="Réinitialiser tous les filtres"
                className="w-8 h-8 rounded-full border border-rose-200/80 bg-rose-50 hover:bg-rose-100 text-rose-700 transition flex items-center justify-center cursor-pointer shadow-2xs active:scale-95 shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          {/* Search */}
          <div className="relative w-full">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-800">
                RECHERCHE LIBRE
              </label>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs">
                Code + Libellé + ID
              </span>
            </div>
            <div className="relative flex items-center">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-md bg-teal-100 border border-teal-300/80 flex items-center justify-center text-teal-700 shadow-2xs pointer-events-none z-10">
                <Search className="w-3 h-3" />
              </span>
              <input
                type="text"
                placeholder="Filtrer par code, libellé, description..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full h-10 pl-9 pr-8 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer z-10"
                >
                  <X className="w-3.5 h-3.5" />
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
              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide bg-teal-50 text-teal-700 border border-teal-200">
                Cycle de vie
              </span>
            </div>
            <CustomSelect
              value={statusFilter}
              onChange={(val) => {
                setStatusFilter((val as 'ALL' | 'ACTIVE' | 'INACTIVE') || 'ALL');
                setCurrentPage(1);
              }}
              options={[
                { value: 'ALL', label: `Tous les groupes (${(partGroups || []).length})` },
                {
                  value: 'ACTIVE',
                  label: `Actifs uniquement (${(partGroups || []).filter((g) => g.is_active !== false).length})`,
                },
                {
                  value: 'INACTIVE',
                  label: `Inactifs / Archivés (${(partGroups || []).filter((g) => g.is_active === false).length})`,
                },
              ]}
              placeholder="Filtrer par statut..."
              icon={CheckCircle2}
            />
          </div>

          {/* Sort Dropdown */}
          <div className="w-full relative" ref={sortMenuRef}>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-800">
                TRI DES ENREGISTREMENTS
              </label>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs">
                {sortOrder === 'asc' ? 'Ordre A-Z' : 'Ordre Z-A'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowSortMenu(!showSortMenu)}
              className={`w-full h-10 px-3 rounded-xl border text-xs font-semibold transition flex items-center justify-between cursor-pointer ${
                showSortMenu || sortField !== 'code' || sortOrder !== 'asc'
                  ? 'bg-teal-50 text-teal-800 border-teal-300 ring-1 ring-teal-200 shadow-2xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-teal-100 border border-teal-300/80 flex items-center justify-center text-teal-700 shadow-2xs shrink-0">
                  <ArrowUpDown className="w-3 h-3" />
                </span>
                <span>
                  Tri : <b className="font-semibold text-slate-900">{getSortFieldLabel(sortField)}</b> (
                  {sortOrder === 'asc' ? 'A→Z' : 'Z→A'})
                </span>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 transition-transform ${showSortMenu ? 'rotate-180' : ''}`}
              />
            </button>

            {showSortMenu && (
              <div className="absolute left-0 right-0 mt-2 bg-white rounded-2xl border border-slate-200 shadow-xl z-50 p-3 space-y-2 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="grid grid-cols-1 gap-1 text-xs">
                  {[
                    { field: 'code', label: 'Code Groupe Part', icon: Boxes },
                    { field: 'libelle', label: 'Désignation / Libellé', icon: FolderTree },
                    { field: 'typesCount', label: 'Nombre de Types Parts (Niv 2)', icon: Tags },
                    { field: 'itemsCount', label: 'Nombre de Parts en Entrepôt', icon: Layers },
                  ].map(({ field, label, icon: ItemIcon }) => {
                    const isActive = sortField === field;
                    return (
                      <button
                        type="button"
                        key={field}
                        onClick={() => {
                          if (isActive) {
                            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortField(field);
                            setSortOrder('asc');
                          }
                        }}
                        className={`flex items-center justify-between px-3 py-2 rounded-lg font-medium transition cursor-pointer ${
                          isActive
                            ? 'bg-teal-50 text-teal-800 font-bold'
                            : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <ItemIcon className="w-3.5 h-3.5 text-slate-400" />
                          <span>{label}</span>
                        </div>
                        {isActive && (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-teal-700 bg-teal-100/80 px-2 py-0.5 rounded-full">
                            {sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                            {sortOrder === 'asc' ? 'Asc' : 'Desc'}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Unified Industrial Data Grid */}
      <GmaoIndustrialDataGrid
        title="Tableau Groupes de Parts d'Entrepôt (Niveau 1) • Structure Parente Indépendante"
        icon={<Boxes className="w-4 h-4 text-teal-600" />}
        excelMapping="code_groupe_part (A) | libelle (B) | default_policy_tags (C) | types_parts_niv2 (D) | parts_entrepot (E) | id_group (F)"
        bannerColor="teal"
        columns={groupColumns}
        data={displayedData}
        sortField={sortField}
        sortOrder={sortOrder}
        onSort={handleSort}
        renderSortIcon={renderSortIcon}
        startIndex={startIndex}
        showRowNumber={true}
        emptyIcon={<Boxes className="w-8 h-8 text-slate-300" />}
        emptyMessage="Aucun groupe de parts trouvé"
        pagination={{
          currentPage,
          setCurrentPage,
          pageSize,
          setPageSize,
          totalItems,
          pageSizeOptions: [20, 50, 100, 200, 0],
          color: 'teal',
          itemLabel: 'groupes de parts',
        }}
      />

      {/* Modal: Add / Edit Group */}
      {(showAddModal || editingGroup) && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700">
                  {editingGroup ? <Edit2 className="w-5 h-5" /> : <Boxes className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {editingGroup ? 'Modifier le Groupe de Parts' : 'Nouveau Groupe de Parts'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Niveau 1 de la hiérarchie Parts d'Entrepôt (Groupes ➔ Types ➔ Désignations)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAddModal(false);
                  setEditingGroup(null);
                  setFormError(null);
                }}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={editingGroup ? handleEditSubmit : handleAddSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1 block">
                    Code Groupe Part *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    placeholder="Ex: MEC-TRANS, FIX-ASSEM..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 uppercase focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1 block">
                    ID Système (Passport)
                  </label>
                  <input
                    type="text"
                    disabled={Boolean(editingGroup)}
                    value={form.id}
                    onChange={(e) => setForm({ ...form, id: e.target.value.toUpperCase() })}
                    placeholder="Auto-généré si vide"
                    className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-mono text-slate-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 mb-1 block">
                  Désignation / Libellé Complet *
                </label>
                <input
                  type="text"
                  required
                  value={form.libelle}
                  onChange={(e) => setForm({ ...form, libelle: e.target.value })}
                  placeholder="Ex: Organes Mécaniques & Transmission"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 mb-1 block">
                  Description & Périmètre Technique
                </label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Ex: Paliers, accouplements, arbres, poulies, pignons et organes de transmission..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 mb-1.5 block">
                  Politiques Matières par Défaut
                </label>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(POLICY_TAG_META) as MaterialPolicyTag[]).map((tag) => {
                    const meta = POLICY_TAG_META[tag];
                    const selected = (form.default_policy_tags || []).includes(tag);
                    return (
                      <button
                        type="button"
                        key={tag}
                        onClick={() => togglePolicyTag(tag)}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                          selected
                            ? `${meta.badgeClass} ring-2 ring-teal-500/20`
                            : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <Check className={`w-3.5 h-3.5 ${selected ? 'opacity-100' : 'opacity-0'}`} />
                        <span>{meta.shortLabel}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingGroup(null);
                    setFormError(null);
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition shadow-sm cursor-pointer"
                >
                  {editingGroup ? 'Enregistrer' : 'Créer le Groupe'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Delete / Deactivate Confirmation */}
      {deletingGroup && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            {(() => {
              const gId = String(deletingGroup.id || deletingGroup.id_group || deletingGroup.id_groupe || '');
              const stats = groupStats[gId] || { typesCount: 0, itemsCount: 0 };
              const hasLinks = stats.typesCount > 0 || stats.itemsCount > 0;
              return (
                <>
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        hasLinks
                          ? 'bg-amber-50 border border-amber-200 text-amber-600'
                          : 'bg-rose-50 border border-rose-200 text-rose-600'
                      }`}
                    >
                      {hasLinks ? <Archive className="w-5 h-5" /> : <Trash2 className="w-5 h-5" />}
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-900">
                        {hasLinks ? 'Désactiver ce Groupe de Parts ?' : 'Supprimer ce Groupe de Parts ?'}
                      </h3>
                      <p className="text-xs font-mono text-slate-500">
                        {deletingGroup.code} — {deletingGroup.libelle}
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    {hasLinks
                      ? `Ce groupe est rattaché à ${stats.typesCount} type(s) de parts et ${stats.itemsCount} part(s) en entrepôt. Pour préserver l'intégrité référentielle, il sera désactivé (archivé) au lieu d'être supprimé.`
                      : 'Aucun type ni part en entrepôt ne dépend de ce groupe. Il sera supprimé définitivement.'}
                  </p>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setDeletingGroup(null)}
                      className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onDeletePartGroup?.(gId);
                        setDeletingGroup(null);
                      }}
                      className={`px-4 py-2 rounded-xl text-white text-xs font-bold transition cursor-pointer ${
                        hasLinks ? 'bg-amber-600 hover:bg-amber-700' : 'bg-rose-600 hover:bg-rose-700'
                      }`}
                    >
                      {hasLinks ? 'Désactiver le Groupe' : 'Supprimer définitivement'}
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Formulas / Help Modal */}
      {showFormulasModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900">
                Architecture 3 Niveaux — Parts d'Entrepôt
              </h3>
              <button
                type="button"
                onClick={() => setShowFormulasModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
              <p>
                <b className="text-slate-900">Niveau 1 — Groupes Parts (cette page) :</b> Regroupe les grandes familles techniques de sous-ensembles et parts d'entrepôt (ex: Organes Mécaniques, Fixation, Hydraulique & Pneumatique).
              </p>
              <p>
                <b className="text-slate-900">Niveau 2 — Types Parts :</b> Chaque Type de Part (ex: TYPE-MEC, TYPE-HYD) est rattaché à un Groupe Part parent via <code className="font-mono bg-slate-100 px-1 rounded">id_group</code>.
              </p>
              <p>
                <b className="text-slate-900">Niveau 3 — Désignations Parts & Entrepôt :</b> Les désignations catalogue et les parts physiques en entrepôt héritent automatiquement du Groupe Part de leur Type.
              </p>
            </div>
          </div>
        </div>
      )}
    </AnimatedPage>
  );
}
