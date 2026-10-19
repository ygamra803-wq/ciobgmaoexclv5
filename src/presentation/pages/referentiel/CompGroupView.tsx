import { useState, useMemo, useEffect, useRef } from 'react';
import AnimatedPage from '../../components/common/AnimatedPage';
import Action3DButton from '../../components/common/Action3DButton';
import FormulasModalButton from '../../components/common/FormulasModalButton';
import GmaoIndustrialDataGrid from '../../components/common/GmaoIndustrialDataGrid';
import { useI18n } from '../../../i18n/I18nContext';
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
  Boxes,
  FolderTree,
  MoreVertical,
} from 'lucide-react';
import { SpokeIcon } from '../../components/common/icons/SpokeIcon';
import { CubeIcon } from '../../components/common/icons/CubeIcon';

export default function CompGroupView({
  compGroups = [],
  compFamilies = [],
  compTemplates = [],
  warehouseItems = [],
  onAddCompGroup,
  onUpdateCompGroup,
  onDeleteCompGroup,
  onNavigateToCompFamilies,
  onNavigateToCompTemplates,
}) {
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('code');
  const [sortOrder, setSortOrder] = useState('asc');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [deletingGroup, setDeletingGroup] = useState(null);
  const [showFormulasModal, setShowFormulasModal] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  const [form, setForm] = useState({
    id: '',
    code: '',
    libelle: '',
    description: '',
  });

  // Pagination & Action Popovers
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [activeActionMenuId, setActiveActionMenuId] = useState(null);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortMenuRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.action-menu-container')) {
        setActiveActionMenuId(null);
      }
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target)) {
        setShowSortMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleCopyId = (idVal) => {
    navigator.clipboard.writeText(idVal);
    setCopiedId(idVal);
    setTimeout(() => setCopiedId(null), 1800);
  };

  // Group calculations (sub-family count, sub-template count, sub-item count)
  const groupStats = useMemo(() => {
    const map = {};
    compGroups.forEach((g) => {
      const gId = g.id || g.id_groupe;
      const families = compFamilies.filter(
        (f) => f.id_groupe === gId || f.id_groupe === g.code
      );
      const famIds = families.map((f) => f.id_family);
      const templates = compTemplates.filter(
        (t) =>
          t.id_groupe === gId ||
          t.id_groupe === g.code ||
          famIds.includes(t.id_family)
      );
      const tplIds = templates.map((t) => t.id_templates);
      const items = warehouseItems.filter(
        (w) =>
          famIds.includes(w.id_family) ||
          tplIds.includes(w.id_templates) ||
          w.id_groupe === gId
      );
      map[gId] = {
        familiesCount: families.length,
        templatesCount: templates.length,
        itemsCount: items.length,
      };
    });
    return map;
  }, [compGroups, compFamilies, compTemplates, warehouseItems]);

  // Filtering
  const filtered = useMemo(() => {
    return compGroups.filter((g) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      const idStr = (g.id || g.id_groupe || '').toLowerCase();
      const codeStr = (g.code || '').toLowerCase();
      const libStr = (g.libelle || '').toLowerCase();
      const descStr = (g.description || '').toLowerCase();
      return (
        idStr.includes(q) ||
        codeStr.includes(q) ||
        libStr.includes(q) ||
        descStr.includes(q)
      );
    });
  }, [compGroups, search]);

  // Sorting
  const sortedData = useMemo(() => {
    const data = [...filtered];
    data.sort((a, b) => {
      let aVal = a[sortField] || '';
      let bVal = b[sortField] || '';

      if (sortField === 'familiesCount') {
        aVal = groupStats[a.id || a.id_groupe]?.familiesCount || 0;
        bVal = groupStats[b.id || b.id_groupe]?.familiesCount || 0;
      } else if (sortField === 'templatesCount') {
        aVal = groupStats[a.id || a.id_groupe]?.templatesCount || 0;
        bVal = groupStats[b.id || b.id_groupe]?.templatesCount || 0;
      }

      if (typeof aVal === 'string') {
        return sortOrder === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });
    return data;
  }, [filtered, sortField, sortOrder, groupStats]);

  const totalItems = sortedData.length;
  const effectivePageSize = pageSize === 0 ? totalItems : pageSize;
  const startIndex = (currentPage - 1) * effectivePageSize;
  const rawDisplayedData =
    pageSize === 0 ? sortedData : sortedData.slice(startIndex, startIndex + effectivePageSize);

  const displayedData = useMemo(() => {
    const minRows = 19;
    if (rawDisplayedData.length >= minRows) return rawDisplayedData;
    const padded = [...rawDisplayedData];
    for (let i = 0; i < minRows - rawDisplayedData.length; i++) {
      padded.push({ __isEmptyPlaceholder: true, id: `empty-${i}` });
    }
    return padded;
  }, [rawDisplayedData]);

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
      <ArrowUp className="w-3 h-3 text-indigo-700 shrink-0 font-bold" />
    ) : (
      <ArrowDown className="w-3 h-3 text-indigo-700 shrink-0 font-bold" />
    );
  };

  const handleAddSubmit = (e) => {
    e.preventDefault();
    if (!form.code || !form.libelle) return;
    const cleanCode = form.code.trim().toUpperCase().replace(/\s+/g, '_');
    const autoId =
      form.id.trim().toUpperCase() ||
      `GRP-${cleanCode}-${String(compGroups.length + 1).padStart(3, '0')}`;

    onAddCompGroup({
      id: autoId,
      id_groupe: autoId,
      code: cleanCode,
      libelle: form.libelle.trim(),
      description: form.description.trim(),
    });

    setForm({ id: '', code: '', libelle: '', description: '' });
    setShowAddModal(false);
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    if (!editingGroup || !form.code || !form.libelle) return;
    const cleanCode = form.code.trim().toUpperCase().replace(/\s+/g, '_');
    const targetId = editingGroup.id || editingGroup.id_groupe;

    onUpdateCompGroup(targetId, {
      ...editingGroup,
      id: targetId,
      id_groupe: targetId,
      code: cleanCode,
      libelle: form.libelle.trim(),
      description: form.description.trim(),
    });

    setEditingGroup(null);
    setForm({ id: '', code: '', libelle: '', description: '' });
  };

  const getSortFieldLabel = (field) => {
    switch (field) {
      case 'code':
        return t('components.group.col_code', 'Code Groupe');
      case 'libelle':
        return t('components.group.col_libelle', 'Libellé');
      case 'description':
        return t('components.group.col_description', 'Description');
      case 'familiesCount':
        return t('components.group.col_families', 'Familles');
      case 'templatesCount':
        return t('components.group.col_templates', 'Templates');
      case 'passport_id':
      case 'id':
        return t('components.group.col_id', 'ID Passport');
      default:
        return field?.toUpperCase() || '';
    }
  };

  const handleExportExcel = () => {
    const headers = [
      'ID Passport',
      'Code Groupe',
      'Libellé Groupe',
      'Description',
      'Nb Familles',
      'Nb Templates',
      'Nb Pièces Stock',
    ];
    const rows = filtered.map((g) => {
      const gId = g.id || g.id_groupe;
      const stats = groupStats[gId] || {};
      return [
        gId || '',
        g.code || '',
        g.libelle || '',
        g.description || '',
        stats.familiesCount || 0,
        stats.templatesCount || 0,
        stats.itemsCount || 0,
      ];
    });
    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `groupes_composants_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const groupColumns = useMemo(
    () => [
      {
        key: 'code',
        label: t('components.group.col_code', 'CODE GROUPE (MAISON)'),
        colLetter: 'A',
        icon: Boxes,
        sortable: true,
        render: (group) => {
          const gId = group.id || group.id_groupe;
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200/80 text-xs font-mono font-bold text-indigo-800 shadow-2xs">
              <Boxes className="w-3 h-3 text-indigo-600" />
              <span>{group.code || gId}</span>
            </span>
          );
        },
      },
      {
        key: 'libelle',
        label: t('components.group.col_libelle', 'DÉSIGNATION / LIBELLÉ'),
        colLetter: 'B',
        icon: FolderTree,
        sortable: true,
        render: (group) => (
          <span className="font-semibold text-slate-800 text-[13px]">{group.libelle}</span>
        ),
      },
      {
        key: 'description',
        label: t('components.group.col_description', 'DESCRIPTION & PÉRIMÈTRE'),
        colLetter: 'C',
        render: (group) => (
          <span className="max-w-xs text-slate-500 text-[11px] leading-relaxed line-clamp-2 block">
            {group.description || '—'}
          </span>
        ),
      },
      {
        key: 'familiesCount',
        label: t('components.group.col_families', 'FAMILLES (NIV 2)'),
        colLetter: 'D',
        icon: SpokeIcon,
        sortable: true,
        align: 'center',
        render: (group) => {
          const gId = group.id || group.id_groupe;
          const stats = groupStats[gId] || { familiesCount: 0 };
          return (
            <button
              onClick={() => onNavigateToCompFamilies?.(gId)}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 text-xs font-semibold transition group/btn shadow-2xs cursor-pointer"
              title={t('components.group.view_families', 'Voir les familles de ce groupe')}
            >
              <SpokeIcon className="w-3.5 h-3.5 text-amber-700" />
              <span>{stats.familiesCount} {t('components.group.family_unit', 'famille(s)')}</span>
              <ArrowRight className="w-3 h-3 text-amber-700 group-hover/btn:translate-x-0.5 transition-transform" />
            </button>
          );
        },
      },
      {
        key: 'templatesCount',
        label: t('components.group.col_templates', 'TEMPLATES (NIV 3)'),
        colLetter: 'E',
        icon: CubeIcon,
        sortable: true,
        align: 'center',
        render: (group) => {
          const gId = group.id || group.id_groupe;
          const stats = groupStats[gId] || { templatesCount: 0 };
          return (
            <button
              onClick={() => onNavigateToCompTemplates?.(gId)}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-purple-50 text-purple-800 hover:bg-purple-100 border border-purple-200 text-xs font-semibold transition group/btn shadow-2xs cursor-pointer"
              title={t('components.group.view_templates', 'Voir les templates de ce groupe')}
            >
              <CubeIcon className="w-3.5 h-3.5 text-purple-700" />
              <span>{stats.templatesCount} {t('components.group.template_unit', 'template(s)')}</span>
              <ArrowRight className="w-3 h-3 text-purple-700 group-hover/btn:translate-x-0.5 transition-transform" />
            </button>
          );
        },
      },
      {
        key: 'passport_id',
        label: t('components.group.col_id', 'ID PASSPORT'),
        colLetter: 'F',
        render: (group) => {
          const gId = group.id || group.id_groupe;
          const isCopied = copiedId === gId;
          return (
            <div className="flex items-center gap-1.5">
              <code className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[11px] text-slate-700 font-mono">
                {gId}
              </code>
              <button
                onClick={() => handleCopyId(gId)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded transition cursor-pointer"
                title={t('common.copy_id', 'Copier l\'ID Passport')}
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
        align: 'center',
        headerClassName: 'w-24 text-center font-bold text-slate-400 tracking-widest select-none',
        render: (group) => {
          const gId = group.id || group.id_groupe;
          const stats = groupStats[gId] || { familiesCount: 0, templatesCount: 0 };
          return (
            <div className="relative inline-flex items-center justify-center action-menu-container">
              <div className="inline-flex rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
                <button
                  type="button"
                  onClick={() => {
                    onNavigateToCompFamilies?.(gId);
                    setActiveActionMenuId(null);
                  }}
                  className="p-1.5 bg-white hover:bg-slate-100/80 text-slate-800 hover:text-black transition flex items-center justify-center cursor-pointer border-r border-slate-200"
                  title={t('components.group.view_families', 'Voir les familles de ce groupe')}
                >
                  <SpokeIcon className="w-3.5 h-3.5 text-indigo-700" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveActionMenuId(activeActionMenuId === gId ? null : gId);
                  }}
                  className={`p-1.5 hover:bg-slate-100 transition cursor-pointer ${
                    activeActionMenuId === gId
                      ? 'bg-slate-100 text-indigo-700 font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title={t('components.group.action_menu_title', 'Actions et options du groupe')}
                >
                  <MoreVertical className="w-3.5 h-3.5" />
                </button>
              </div>

              {activeActionMenuId === gId && (
                <div className="absolute right-0 top-full mt-1.5 w-60 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 p-1.5 text-left animate-in fade-in slide-in-from-top-2 duration-150 space-y-0.5">
                  <div className="px-3 py-2 border-b border-slate-100 mb-1 bg-slate-50/80 rounded-xl">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      {t('components.group.action_menu_header', 'Actions Groupe Composant')}
                    </span>
                    <span className="text-xs font-mono font-bold text-indigo-700 truncate block">
                      {group.code || gId} — {group.libelle}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveActionMenuId(null);
                      onNavigateToCompFamilies?.(gId);
                    }}
                    className="w-full px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-amber-50 hover:text-amber-800 rounded-xl transition flex items-center justify-between cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5">
                      <SpokeIcon className="w-3.5 h-3.5 text-amber-600 group-hover:scale-110 transition-transform" />
                      <span>{t('components.group.menu_view_families', 'Voir Familles (Niveau 2)')}</span>
                    </div>
                    <span className="text-[10px] font-mono text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded font-bold border border-amber-200/60">
                      {stats.familiesCount}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveActionMenuId(null);
                      onNavigateToCompTemplates?.(gId);
                    }}
                    className="w-full px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-purple-50 hover:text-purple-800 rounded-xl transition flex items-center justify-between cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5">
                      <CubeIcon className="w-3.5 h-3.5 text-purple-600 group-hover:scale-110 transition-transform" />
                      <span>{t('components.group.menu_view_templates', 'Voir Templates (Niveau 3)')}</span>
                    </div>
                    <span className="text-[10px] font-mono text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded font-bold border border-purple-200/60">
                      {stats.templatesCount}
                    </span>
                  </button>

                  <div className="border-t border-slate-100 my-1" />

                  <button
                    type="button"
                    onClick={() => {
                      setActiveActionMenuId(null);
                      setEditingGroup(group);
                      setForm({
                        id: gId,
                        code: group.code || '',
                        libelle: group.libelle || '',
                        description: group.description || '',
                      });
                    }}
                    className="w-full px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition flex items-center gap-2.5 cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                    <span>{t('components.group.menu_edit', 'Modifier ce groupe')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveActionMenuId(null);
                      setDeletingGroup(group);
                    }}
                    className="w-full px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition flex items-center gap-2.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                    <span>{t('components.group.menu_delete', 'Supprimer ce groupe')}</span>
                  </button>
                </div>
              )}
            </div>
          );
        },
      },
    ],
    [t, copiedId, groupStats, activeActionMenuId, onNavigateToCompFamilies, onNavigateToCompTemplates]
  );

  return (
    <AnimatedPage className="space-y-4">
      {/* Top Banner */}
      <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200/90 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden group/header">
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none group-hover/header:bg-indigo-500/10 transition-colors duration-500" />

        <div className="min-w-0 flex-1 flex items-start sm:items-center gap-3.5 relative">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500/10 via-indigo-500/5 to-transparent border border-indigo-200/90 shadow-[0_4px_12px_rgba(99,102,241,0.12)] flex items-center justify-center text-indigo-700 group-hover/header:scale-105 group-hover/header:border-indigo-400/80 transition-all duration-300 shrink-0">
            <Boxes className="w-6 h-6 text-indigo-700 transition-transform duration-300 group-hover/header:scale-110" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                {t('components.group.title', 'Groupes de Composants (Niveau 1)')}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200">
                {t('components.group.badge', 'Hiérarchie 3 Niveaux')}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
              {t('components.group.subtitle', "Structure de premier niveau (Moteurs, Réducteurs, Pompes, Variateurs...) qui regroupe les familles technologiques et évite l'encombrement dans les Templates.")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 relative">
          <FormulasModalButton
            onClick={() => setShowFormulasModal(true)}
            title={t('components.group.formulas_button', 'Aide & Architecture 4 Niveaux')}
          />

          <Action3DButton
            variant="circle"
            color="indigo"
            icon={Boxes}
            showAddBadge={true}
            onClick={() => {
              const nextIdx = compGroups.length + 1;
              setForm({
                id: `GRP-CMP-${String(nextIdx).padStart(3, '0')}`,
                code: '',
                libelle: '',
                description: '',
              });
              setShowAddModal(true);
            }}
            title={t('components.group.add_button', 'Nouveau Groupe')}
          />
        </div>
      </div>

      {/* Filter Bar */}
      <div className="relative z-30 bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out space-y-4">
        {/* Header Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-200/80 flex items-center justify-center text-indigo-700 shadow-2xs shrink-0">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                  {t('components.group.filter_title', 'Filtres & Recherche Avancée')}
                </span>
                <span className="bg-indigo-50 text-indigo-800 px-2.5 py-0.5 rounded-lg text-[11px] font-bold border border-indigo-200/70 shadow-2xs font-mono">
                  {filtered.length} / {compGroups.length}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                {t('components.group.filter_subtitle', 'Nomenclature Niveau 1 • Groupes Composants')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Export Excel Button */}
            <button
              onClick={handleExportExcel}
              className="h-8 px-3 rounded-xl border border-emerald-200/80 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
              title={t('common.export_excel_title', 'Exporter le tableau vers Excel / CSV')}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>{t('components.group.export_excel', 'Export Excel')}</span>
            </button>

            {/* Circular Reset Button */}
            {(search || sortField !== 'code' || sortOrder !== 'asc') && (
              <button
                onClick={() => {
                  setSearch('');
                  setSortField('code');
                  setSortOrder('asc');
                }}
                title={t('components.group.reset_filters', 'Réinitialiser tous les filtres actifs')}
                className="w-8 h-8 rounded-full border border-rose-200/80 bg-rose-50 hover:bg-rose-100 text-rose-700 transition flex items-center justify-center cursor-pointer shadow-2xs active:scale-95 animate-in fade-in shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
          {/* Search */}
          <div className="relative w-full">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-800">
                {t('components.group.search_label', 'RECHERCHE LIBRE')}
              </label>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs">
                {t('components.group.search_fields', 'Code + Libellé + ID')}
              </span>
            </div>
            <div className="relative flex items-center">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-md bg-indigo-100 border border-indigo-300/80 flex items-center justify-center text-indigo-700 shadow-2xs pointer-events-none z-10">
                <Search className="w-3 h-3" />
              </span>
              <input
                type="text"
                placeholder={t('components.group.search_placeholder', 'Filtrer par code, libellé, ID passport...')}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full h-10 pl-9 pr-8 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
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

          {/* Sort Dropdown */}
          <div className="w-full relative" ref={sortMenuRef}>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-800">
                {t('components.group.sort_label', 'TRI DES ENREGISTREMENTS')}
              </label>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs">
                {sortOrder === 'asc' ? t('common.filters.order_asc', 'Ordre A-Z') : t('common.filters.order_desc', 'Ordre Z-A')}
              </span>
            </div>
            <button
              onClick={() => setShowSortMenu(!showSortMenu)}
              className={`w-full h-10 px-3 rounded-xl border text-xs font-semibold transition flex items-center justify-between cursor-pointer ${
                showSortMenu || sortField !== 'code' || sortOrder !== 'asc'
                  ? 'bg-indigo-50 text-indigo-800 border-indigo-300 ring-1 ring-indigo-200 shadow-2xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-indigo-100 border border-indigo-300/80 flex items-center justify-center text-indigo-700 shadow-2xs shrink-0">
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
                    <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600" />
                    {t('common.sort_options', 'Trier par')}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-1 text-xs">
                  {[
                    { field: 'code', label: t('components.group.col_code', 'Code Groupe'), icon: Boxes },
                    { field: 'libelle', label: t('components.group.col_libelle', 'Désignation / Libellé'), icon: FolderTree },
                    { field: 'familiesCount', label: t('components.group.col_families', 'Nombre de Familles (Niv 2)'), icon: SpokeIcon },
                    { field: 'templatesCount', label: t('components.group.col_templates', 'Nombre de Templates (Niv 3)'), icon: CubeIcon },
                  ].map(({ field, label, icon: ItemIcon }) => {
                    const isActive = sortField === field;
                    return (
                      <button
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
                            ? 'bg-indigo-50 text-indigo-800 font-bold'
                            : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <ItemIcon className="w-3.5 h-3.5 text-slate-400" />
                          <span>{label}</span>
                        </div>
                        {isActive && (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-100/80 px-2 py-0.5 rounded-full">
                            {sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                            {sortOrder === 'asc' ? t('common.ascending', 'Ascendant') : t('common.descending', 'Descendant')}
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
        title={t('components.group.grid_title', 'Tableau Groupes de Composants (Niveau 1) • Structure Parent Hiérarchique')}
        icon={<Boxes className="w-4 h-4 text-indigo-600" />}
        excelMapping="code_groupe (A) | libelle (B) | description (C) | familles_niv2 (D) | templates_niv3 (E) | passport_id (F)"
        bannerColor="indigo"
        columns={groupColumns}
        data={displayedData}
        sortField={sortField}
        sortOrder={sortOrder}
        onSort={handleSort}
        renderSortIcon={renderSortIcon}
        startIndex={startIndex}
        showRowNumber={true}
        emptyIcon={<Boxes className="w-8 h-8 text-slate-300" />}
        emptyMessage={t('components.group.empty', 'Aucun groupe de composants trouvé')}
        pagination={{
          currentPage,
          setCurrentPage,
          pageSize,
          setPageSize,
          totalItems,
          pageSizeOptions: [20, 50, 100, 200, 0],
          color: 'indigo',
          itemLabel: t('components.group.item_label', 'groupes'),
        }}
      />

      {/* Modal: Add Group */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700">
                  <Boxes className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {t('components.group.add_title', 'Nouveau Groupe de Composants')}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {t('components.group.add_desc', 'Niveau 1 de la hiérarchie Composants')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 mb-1 block">
                  {t('components.group.code_label', 'Code Groupe (Maison court) *')}
                </label>
                <input
                  type="text"
                  required
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder={t('components.group.code_placeholder', 'Ex: MOTEUR, REDUCTEUR, POMPE...')}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  {t('components.group.code_helper', 'Code unique servant de préfixe et repère usine')}
                </span>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 mb-1 block">
                  {t('components.group.libelle_label', 'Désignation / Libellé Complet *')}
                </label>
                <input
                  type="text"
                  required
                  value={form.libelle}
                  onChange={(e) => setForm({ ...form, libelle: e.target.value })}
                  placeholder={t('components.group.libelle_placeholder', 'Ex: Moteurs & Actionneurs Électriques')}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 mb-1 block">
                  {t('components.group.description_label', 'Description / Périmètre technique')}
                </label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder={t('components.group.description_placeholder', "Ex: Tous types de moteurs d'entraînement : asynchrones, synchrones, servo, courant continu...")}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 mb-1 block">
                  {t('components.group.id_label', 'ID Passport (Système)')}
                </label>
                <input
                  type="text"
                  value={form.id}
                  onChange={(e) => setForm({ ...form, id: e.target.value.toUpperCase() })}
                  placeholder={t('components.group.id_placeholder', 'Laisser vide pour auto-génération')}
                  className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-mono text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                >
                  {t('common.cancel', 'Annuler')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-sm cursor-pointer"
                >
                  {t('components.group.create_submit', 'Créer le Groupe')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Group */}
      {editingGroup && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {t('components.group.edit_title', 'Modifier le Groupe de Composants')}
                  </h3>
                  <p className="text-xs font-mono text-indigo-600">
                    {editingGroup.id || editingGroup.id_groupe}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingGroup(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 mb-1 block">
                  {t('components.group.code_label', 'Code Groupe (Maison court) *')}
                </label>
                <input
                  type="text"
                  required
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 mb-1 block">
                  {t('components.group.libelle_label', 'Désignation / Libellé Complet *')}
                </label>
                <input
                  type="text"
                  required
                  value={form.libelle}
                  onChange={(e) => setForm({ ...form, libelle: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 mb-1 block">
                  {t('components.group.description_label', 'Description / Périmètre technique')}
                </label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingGroup(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                >
                  {t('common.cancel', 'Annuler')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-sm cursor-pointer"
                >
                  {t('components.group.save_submit', 'Enregistrer les modifications')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Delete Confirmation */}
      {deletingGroup && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-rose-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  {t('components.group.delete_title', 'Supprimer ce groupe de composants ?')}
                </h3>
                <p className="text-xs text-rose-600 font-bold">
                  {deletingGroup.libelle} ({deletingGroup.code})
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              {t('components.group.delete_confirm', 'Confirmez-vous la suppression du groupe {{name}} ?', { name: deletingGroup.code })}{' '}
              {t('components.group.delete_warning', 'Cette action est irréversible et peut affecter les familles et templates rattachés.')}
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeletingGroup(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
              >
                {t('common.cancel', 'Annuler')}
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteCompGroup(deletingGroup.id || deletingGroup.id_groupe);
                  setDeletingGroup(null);
                }}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-sm cursor-pointer"
              >
                {t('common.confirm', 'Confirmer la suppression')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Architecture & Formulas Info Modal */}
      {showFormulasModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700">
                  <FolderTree className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {t('components.group.formulas_title', 'Hiérarchie des Composants & Architecture 4 Niveaux')}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {t('components.group.formulas_subtitle', 'Miroir de la structure Machines & Relations Excel')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowFormulasModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
              <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-200/80 space-y-1.5">
                <div className="font-bold text-indigo-900 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-mono">1</span>
                  {t('components.group.level_1_title', 'Groupe Composants (Niveau 1)')}
                </div>
                <p className="text-[11px] text-indigo-800">
                  {t('components.group.level_1_desc', 'Ex: MOTEUR, REDUCTEUR, POMPE, VARIATEUR. Définit la grande catégorie technologique.')}
                </p>
              </div>

              <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/80 space-y-1.5">
                <div className="font-bold text-amber-900 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-amber-600 text-white flex items-center justify-center text-[10px] font-mono">2</span>
                  {t('components.group.level_2_title', 'Famille Composants (Niveau 2)')}
                </div>
                <p className="text-[11px] text-amber-800">
                  {t('components.group.level_2_desc', 'Ex: Dans le Groupe MOTEUR → Moteur Triphasé (3PH), Monophasé (1PH), Synchrone, Servo.')}
                </p>
              </div>

              <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-200/80 space-y-1.5">
                <div className="font-bold text-purple-900 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px] font-mono">3</span>
                  {t('components.group.level_3_title', 'Templates Composants (Niveau 3)')}
                </div>
                <p className="text-[11px] text-purple-800">
                  {t('components.group.level_3_desc', 'Ex: Fiche technique précise → Moteur 4KW 1430tr/min B3. Spécifie les caractéristiques sans être une pièce physique unique.')}
                </p>
              </div>

              <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200/80 space-y-1.5">
                <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-mono">4</span>
                  {t('components.group.level_4_title', 'Stock Entrepôt (Élément Réel - Niveau 4)')}
                </div>
                <p className="text-[11px] text-emerald-800">
                  {t('components.group.level_4_desc', 'Ex: La pièce réelle avec son numéro de série / barcode physique en rayon avec quantité, état et emplacement.')}
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowFormulasModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition cursor-pointer"
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
