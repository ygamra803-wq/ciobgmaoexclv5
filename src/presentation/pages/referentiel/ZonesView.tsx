import {  useState, useRef, useMemo, useEffect  } from 'react';
import AnimatedPage from '../../components/common/AnimatedPage';
import SequentialCodePicker from '../../components/common/SequentialCodePicker';
import FormulasModalButton from '../../components/common/FormulasModalButton';
import Action3DButton from '../../components/common/Action3DButton';
import GmaoIndustrialDataGrid from '../../components/common/GmaoIndustrialDataGrid';
import { MapPin, Search, ArrowRight, Users, Wrench, Trash2, Edit2, AlertTriangle, SlidersHorizontal, ArrowUpDown, ChevronDown, ArrowDown, ArrowUp, AlignLeft, Tag, Hash, Key, Shield, User, Calculator, RotateCcw, X } from 'lucide-react';
import { useTranslation } from '../../../i18n/I18nContext';

export default function ZonesView({
  zones = [],
  technicians = [],
  operations = [],
  machines = [],
  onAddZone,
  onUpdateZone,
  onDeleteZone,
  onNavigateToTechs,
  onNavigateToMachines,
}) {
  const { t } = useTranslation();
  const [localSearch, setLocalSearch] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const handler = setTimeout(() => {
      setSearch(localSearch);
    }, 200);
    return () => clearTimeout(handler);
  }, [localSearch]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showFormulasModal, setShowFormulasModal] = useState(false);
  const [form, setForm] = useState({ code_zone: '', id_zone: '', libelle: '', type: 'FINITION', description: '' });
  const [toEdit, setToEdit] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  const safeZones = Array.isArray(zones) ? zones : [];
  const safeTechs = Array.isArray(technicians) ? technicians : [];
  const safeOps = Array.isArray(operations) ? operations : [];
  const safeMachines = Array.isArray(machines) ? machines : [];

  // Auto-calculation of next Code Zone (e.g. ZONE-01)
  const autoCodeZone = useMemo(() => {
    const nums = safeZones
      .map((z) => {
        const val = z.code_zone || z.code || z.id_zone || '';
        const m = String(val).match(/ZONE-(\d+)/i);
        return m ? parseInt(m[1], 10) : 0;
      })
      .filter((n) => !isNaN(n));
    const max = nums.length > 0 ? Math.max(...nums) : 0;
    return `ZONE-${String(max + 1).padStart(2, '0')}`;
  }, [safeZones]);

  const takenZoneNumbers = useMemo(() => {
    const set = new Set();
    safeZones.forEach((z) => {
      const val = z.code_zone || z.code || z.id_zone || '';
      const m = String(val).match(/(\d+)$/);
      if (m) set.add(parseInt(m[1], 10));
    });
    return set;
  }, [safeZones]);

  useEffect(() => {
    if (showAddModal) {
      setForm((prev) => ({
        ...prev,
        code_zone: prev.code_zone || autoCodeZone,
        id_zone: prev.id_zone || '',
      }));
    }
  }, [showAddModal, autoCodeZone]);

  const filtered = safeZones.filter((z) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      String(z?.code_zone || z?.code || '').toLowerCase().includes(q) ||
      String(z?.id_zone || '').toLowerCase().includes(q) ||
      String(z?.libelle || '').toLowerCase().includes(q) ||
      String(z?.type || '').toLowerCase().includes(q) ||
      String(z?.description || '').toLowerCase().includes(q)
    );
  });

  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState('id_zone');
  const [sortOrder, setSortOrder] = useState('asc');
  const [showSortMenu, setShowSortMenu] = useState(false);

  const sortMenuRef = useRef(null);

  const [prevFilters, setPrevFilters] = useState({ search, sortField, sortOrder });
  if (
    prevFilters.search !== search ||
    prevFilters.sortField !== sortField ||
    prevFilters.sortOrder !== sortOrder
  ) {
    setPrevFilters({ search, sortField, sortOrder });
    setCurrentPage(1);
  }

  useEffect(() => {
    function handleClickOutside(event) {
      if (sortMenuRef.current && !sortMenuRef.current.contains(event.target)) {
        setShowSortMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const sortedData = useMemo(() => {
    if (!sortField) return filtered;
    return [...filtered].sort((a, b) => {
      let valA = a[sortField] || '';
      let valB = b[sortField] || '';
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
  const displayedData = useMemo(() => {
    const minRows = 19;
    if (rawDisplayedData.length >= minRows) return rawDisplayedData;
    const padded = [...rawDisplayedData];
    for (let i = 0; i < minRows - rawDisplayedData.length; i++) {
      padded.push({ __isEmptyPlaceholder: true, id_zone: `empty-${i}` });
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
      return (
        <ArrowUpDown className="w-3 h-3 text-slate-300 group-hover:text-slate-500 transition shrink-0" />
      );
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-cyan-700 shrink-0 font-bold" />
    ) : (
      <ArrowDown className="w-3 h-3 text-cyan-700 shrink-0 font-bold" />
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.code_zone || !form.id_zone || !form.libelle) return;
    onAddZone({
      code_zone: form.code_zone.trim().toUpperCase(),
      id_zone: form.id_zone.trim().toUpperCase(),
      libelle: form.libelle.trim(),
      type: form.type,
      description: form.description || '',
    });
    setForm({ code_zone: '', id_zone: '', libelle: '', type: 'FINITION', description: '' });
    setShowAddModal(false);
  };

  const zoneColumns = useMemo(
    () => [
      {
        key: 'code_zone',
        label: t('zones.columns.identifiers'),
        colLetter: 'b.1/b.2',
        icon: Hash,
        sortable: true,
        render: (z, idx, rowNum) => {
          const codeVal = z.code_zone || z.code || z.id_zone || `ZONE-${String(rowNum).padStart(2, '0')}`;
          const idVal = z.id_zone || z.code_zone || z.code;
          return (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                <span className="font-mono text-[11px] font-bold text-cyan-800 bg-cyan-50 border border-cyan-200 px-1.5 py-0.5 rounded shadow-2xs leading-none">
                  {codeVal}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                <span className="font-mono text-[11px] font-bold text-purple-800 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded shadow-2xs leading-none">
                  {idVal}
                </span>
              </div>
            </div>
          );
        },
      },
      {
        key: 'libelle',
        label: t('zones.columns.label'),
        colLetter: 'C',
        icon: MapPin,
        sortable: true,
        render: (z) => (
          <div className="flex flex-col gap-0.5">
            <div className="flex items-start gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
              <span className="text-[12px] font-bold text-slate-900 leading-snug break-words">
                {z.libelle}
              </span>
            </div>
            {z.description && (
              <div className="flex items-start gap-1.5">
                <AlignLeft className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <span className="text-[11px] text-slate-500 font-medium leading-snug line-clamp-2" title={z.description}>
                  {z.description}
                </span>
              </div>
            )}
            {z.type && (
              <div className="flex items-center gap-1.5 mt-0.5 text-[10px] font-semibold tracking-wide uppercase text-indigo-600">
                <Tag className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span className="truncate max-w-[180px]" title={z.type}>{z.type}</span>
              </div>
            )}
          </div>
        ),
      },
      {
        key: 'utilisateurs',
        label: t('zones.columns.team'),
        colLetter: 'D/E',
        icon: Users,
        render: (z) => {
          const zoneOps = safeOps.filter((op) => op.id_zone === z.id_zone || op.id_zone === z.code_zone);
          const zoneTechs = safeTechs.filter((t) => t.id_zone === z.id_zone || t.id_zone === z.code_zone);
          const responsables = zoneOps.filter(op => op.type_profil === 'CHEF' || op.type_profil === 'SUPERVISEUR' || op.type_profil === 'RESPONSABLE');
          return (
            <div className="flex flex-col gap-2">
              {responsables.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  {responsables.map((resp, i) => (
                    <div key={i} className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wide uppercase text-slate-400">
                        <Shield className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate" title={resp.type_profil || 'RESPONSABLE'}>{resp.type_profil || 'RESPONSABLE'}</span>
                      </div>
                      <div className="flex items-start gap-1.5 pl-[1.125rem]">
                        <User className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                        <span className="text-[11.5px] font-bold text-slate-900 leading-snug break-words">
                          {resp.nom}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {zoneTechs.length > 0 && (
                <div className="flex flex-col gap-0.5 mt-0.5">
                  <button
                    type="button"
                    onClick={() => onNavigateToTechs && onNavigateToTechs(z.code_zone || z.id_zone)}
                    className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wide uppercase text-slate-400 hover:text-blue-600 transition text-left cursor-pointer"
                  >
                    <Wrench className="w-3 h-3 text-slate-400 shrink-0" />
                    <span>{t('zones.columns.technicians')} ({zoneTechs.length})</span>
                  </button>
                  <div className="flex flex-wrap items-center gap-1.5 pl-[1.125rem] mt-0.5">
                    {zoneTechs.map((tech, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => onNavigateToTechs && onNavigateToTechs(z.code_zone || z.id_zone)}
                        className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-50 hover:bg-blue-100 border border-blue-200 text-[10px] font-bold text-blue-700 shadow-2xs cursor-pointer transition"
                      >
                        {tech.id_technician || tech.code || 'TECH'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        },
      },
      {
        key: 'machines',
        label: t('zones.columns.machines'),
        colLetter: 'F',
        icon: Wrench,
        render: (z) => {
          const mCount = safeMachines.filter((m) => {
            const mZ = String(m.id_zone_default || '').trim().toLowerCase();
            const idZ = String(z.id_zone || '').trim().toLowerCase();
            const codeZ = String(z.code_zone || z.code || '').trim().toLowerCase();
            const libZ = String(z.libelle || '').trim().toLowerCase();
            return mZ && (mZ === idZ || mZ === codeZ || mZ === libZ);
          }).length;
          return (
            <button
              type="button"
              onClick={() => onNavigateToMachines && onNavigateToMachines(z.code_zone || z.id_zone)}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold transition group cursor-pointer shadow-2xs"
              title={t('zones.columns.machines')}
            >
              <Wrench className="w-3.5 h-3.5 text-emerald-600" />
              <span>{mCount} {mCount > 1 ? t('zones.columns.machines_plural') : t('zones.columns.machine')}</span>
              <ArrowRight className="w-3 h-3 text-emerald-600 group-hover:translate-x-0.5 transition-transform" />
            </button>
          );
        },
      },
      {
        key: 'actions',
        label: t('zones.columns.actions'),
        align: 'center',
        headerClassName: 'w-24 text-center font-bold text-slate-400 tracking-widest select-none',
        render: (z) => (
          <div className="flex items-center justify-center gap-1.5">
            <button
              type="button"
              onClick={() => setToEdit(z)}
              className="p-1.5 bg-white hover:bg-purple-50 text-slate-600 hover:text-purple-700 rounded-lg border border-slate-200 transition cursor-pointer shadow-2xs"
              title={t('zones.buttons.edit')}
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setToDelete(z)}
              className="p-1.5 bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-700 rounded-lg border border-slate-200 transition cursor-pointer shadow-2xs"
              title={t('zones.buttons.delete')}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ),
      },
    ],
    [safeOps, safeTechs, safeMachines, onNavigateToTechs, onNavigateToMachines, t]
  );

  return (
    <AnimatedPage className="space-y-4">
      {/* Top Banner */}
      <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200/90 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out flex items-center justify-between gap-3 sm:gap-4 w-full relative overflow-hidden group/header">
        {/* Subtle Ambient Gradient Background Highlight */}
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-purple-500/5 rounded-full blur-2xl pointer-events-none group-hover/header:bg-purple-500/10 transition-colors duration-500" />

        <div className="flex items-center gap-3 min-w-0 relative">
          {/* 3D Elevated Page Badge Icon */}
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent border border-purple-200/90 shadow-[0_4px_12px_rgba(147,51,234,0.12)] flex items-center justify-center text-purple-700 group-hover/header:scale-105 group-hover/header:border-purple-400/80 transition-all duration-300 shrink-0">
            <MapPin className="w-6 h-6 text-purple-700 transition-transform duration-300 group-hover/header:scale-110" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              {t('zones.title')}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {t('zones.subtitle')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <FormulasModalButton
            onClick={() => setShowFormulasModal(true)}
            title={t('zones.buttons.view_formulas')}
          />

          <Action3DButton
            variant="circle"
            color="purple"
            icon={MapPin}
            showAddBadge={true}
            onClick={() => setShowAddModal(true)}
            title={t('zones.buttons.add_zone')}
          />
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-200/80 flex items-center justify-center text-purple-700 shadow-2xs shrink-0">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                  {t('zones.filters.title')}
                </span>
                <span className="bg-purple-50 text-purple-800 px-2.5 py-0.5 rounded-lg text-[11px] font-bold border border-purple-200/70 shadow-2xs font-mono">
                  {filtered.length} / {safeZones.length}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                {t('zones.filters.subtitle')}
              </p>
            </div>
          </div>

          {localSearch && (
            <button
              onClick={() => setLocalSearch('')}
              title={t('zones.filters.reset_tooltip')}
              className="w-8 h-8 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 hover:text-purple-700 hover:bg-purple-50 hover:border-purple-200 flex items-center justify-center transition shadow-2xs cursor-pointer shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
          {/* Search */}
          <div className="relative w-full">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                {t('zones.filters.search_label')}
              </label>
              <span className="text-[10px] font-bold text-slate-400 font-mono">[Col. A + B + C]</span>
            </div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={t('zones.filters.search_placeholder')}
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                className="w-full h-10 pl-9 pr-8 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition"
              />
              {localSearch && (
                <button
                  onClick={() => setLocalSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Sort Dropdown */}
          <div className="w-full relative" ref={sortMenuRef}>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                {t('zones.filters.sort_label')}
              </label>
              <span className="text-[10px] font-bold text-slate-400 font-mono">[{t('zones.filters.order_asc')}]</span>
            </div>
            <button
              onClick={() => setShowSortMenu(!showSortMenu)}
              className={`w-full h-10 px-3 rounded-xl border text-xs font-semibold transition flex items-center justify-between cursor-pointer ${
                showSortMenu || sortField !== 'id_zone' || sortOrder !== 'asc'
                  ? 'bg-purple-50 text-purple-900 border-purple-300 ring-1 ring-purple-200 shadow-2xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <ArrowUpDown className="w-3.5 h-3.5 text-purple-600" />
                <span>
                  {t('zones.filters.sort_label')} : <b className="font-mono text-slate-900">{sortField.toUpperCase()}</b> (
                  {sortOrder === 'asc' ? t('zones.filters.order_asc') : t('zones.filters.order_desc')})
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
                    <SlidersHorizontal className="w-3.5 h-3.5 text-purple-600" />
                    {t('zones.filters.sort_by')}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-1 text-xs">
                  <button
                    onClick={() => {
                      if (sortField === 'id_zone') {
                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortField('id_zone');
                        setSortOrder('asc');
                      }
                    }}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg font-medium transition cursor-pointer ${
                      sortField === 'id_zone'
                        ? 'bg-purple-50 text-purple-800'
                        : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>{t('zones.filters.code_col')}</span>
                    {sortField === 'id_zone' &&
                      (sortOrder === 'asc' ? (
                        <ArrowUp className="w-3 h-3 text-purple-600 shrink-0" />
                      ) : (
                        <ArrowDown className="w-3 h-3 text-purple-600 shrink-0" />
                      ))}
                  </button>

                  <button
                    onClick={() => {
                      if (sortField === 'libelle') {
                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortField('libelle');
                        setSortOrder('asc');
                      }
                    }}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg font-medium transition cursor-pointer ${
                      sortField === 'libelle'
                        ? 'bg-purple-50 text-purple-800'
                        : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>{t('zones.filters.label_col')}</span>
                    {sortField === 'libelle' &&
                      (sortOrder === 'asc' ? (
                        <ArrowUp className="w-3 h-3 text-purple-600 shrink-0" />
                      ) : (
                        <ArrowDown className="w-3 h-3 text-purple-600 shrink-0" />
                      ))}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Active Filter Chips */}
        {localSearch && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('zones.filters.active_filter')}</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-50 border border-purple-200 text-purple-800 text-xs font-semibold">
              <Search className="w-3 h-3 text-purple-600" />
              {t('zones.filters.filter_search')}: &quot;{localSearch}&quot;
              <button
                onClick={() => setLocalSearch('')}
                className="hover:bg-purple-200/60 p-0.5 rounded-full transition cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          </div>
        )}
      </div>

      {/* Unified Industrial Data Grid */}
      <GmaoIndustrialDataGrid
        title={t('zones.table.title')}
        icon={<MapPin className="w-4 h-4 text-purple-600" />}
        excelMapping="code_zone (B.1) | id_zone (B.2) | libelle (C) | nb_techniciens (D) | nb_operations (E) | nb_machines (F)"
        bannerColor="purple"
        columns={zoneColumns}
        data={displayedData}
        sortField={sortField}
        sortOrder={sortOrder}
        onSort={handleSort}
        renderSortIcon={renderSortIcon}
        startIndex={startIndex}
        showRowNumber={true}
        emptyIcon={<MapPin className="w-8 h-8 text-slate-300" />}
        emptyMessage={t('zones.table.empty_msg')}
        renderRow={(z, idx, rowNum) => {
          if (z.__isEmptyPlaceholder) {
            return (
              <tr key={`empty-${idx}`} className="border-b border-slate-100 bg-white/40 select-none">
                <td className="py-3 px-3 text-center text-slate-400 font-mono text-[10px] bg-slate-50/40 border-r border-slate-100 shrink-0 select-none">
                  {rowNum}
                </td>
                <td colSpan={zoneColumns.length} className="py-3 px-4 text-center text-slate-300 font-mono text-[11px] h-12">
                  —
                </td>
              </tr>
            );
          }

          return (
            <tr
              key={z.code_zone || z.id_zone || idx}
              className="even:bg-slate-50/80 odd:bg-white hover:bg-slate-100/70 border-b border-slate-200/70 transition-colors"
            >
              {/* Row N° Column */}
              <td className="py-3 px-3 text-center font-mono text-[11px] font-bold text-slate-400 bg-slate-100/40 border-r border-slate-200/80 shrink-0 select-none">
                {rowNum}
              </td>
              
              {/* Cells */}
              {zoneColumns.map((col) => (
                <td
                  key={col.key}
                  className={`py-3 px-3.5 ${
                    col.align === 'center'
                      ? 'text-center'
                      : col.align === 'right'
                      ? 'text-right'
                      : 'text-left'
                  } ${col.cellClassName || ''}`}
                >
                  {typeof col.render === 'function'
                    ? col.render(z, idx, rowNum)
                    : z[col.key]}
                </td>
              ))}
            </tr>
          );
        }}
        pagination={{
          currentPage,
          setCurrentPage,
          pageSize,
          setPageSize,
          totalItems,
          pageSizeOptions: [25, 50, 100, 200, 0],
          color: 'purple',
          itemLabel: t('zones.table.item_label'),
        }}
      />

      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 border border-slate-200 flex flex-col max-h-screen">
            <h3 className="font-bold text-base text-slate-900 mb-1">{t('zones.modal.add_title')}</h3>
            <p className="text-xs text-slate-500 mb-4">
              {t('zones.modal.add_subtitle')}
            </p>
            <div className="overflow-y-auto pr-1">
              <form onSubmit={handleSubmit} className="space-y-3">
                {/* Code Zone (Automatic Picker) */}
                <div>
                  <SequentialCodePicker
                    prefix="ZONE-"
                    currentCode={form.code_zone}
                    onChangeCode={(newCode) => setForm((prev) => ({ ...prev, code_zone: newCode }))}
                    autoGeneratedCode={autoCodeZone}
                    takenNumbers={takenZoneNumbers}
                    label={t('zones.modal.code_label')}
                    helperText={t('zones.modal.code_helper')}
                  />
                </div>

                {/* ID Zone (Manual Input) */}
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    {t('zones.modal.id_label')}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ex: POL, DET, AMBO..."
                    value={form.id_zone}
                    onChange={(e) => setForm({ ...form, id_zone: e.target.value.toUpperCase() })}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono font-bold focus:outline-none focus:border-purple-500 focus:bg-white"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">{t('zones.modal.id_helper')}</p>
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    {t('zones.modal.libelle_label')}
                  </label>
                  <input
                    type="text"
                    placeholder={t('zones.modal.libelle_placeholder')}
                    value={form.libelle}
                    onChange={(e) => setForm({ ...form, libelle: e.target.value })}
                    className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs focus:outline-none"
                    required
                  />
                </div>
                
                <div>
                  <label className="text-[11px] font-bold text-slate-500 block mb-1">{t('zones.modal.type_label')}</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs focus:outline-none"
                  >
                    <option value="FINITION">FINITION</option>
                    <option value="DECOUPE">DECOUPE</option>
                    <option value="SUPPORT">SUPPORT</option>
                    <option value="FORMAGE">FORMAGE</option>
                    <option value="ASSEMBLAGE_FINAL">ASSEMBLAGE FINAL</option>
                    <option value="STOCK">STOCK</option>
                    <option value="AUTRE">AUTRE</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-500 block mb-1">{t('zones.modal.desc_label')}</label>
                  <textarea
                    rows={3}
                    placeholder={t('zones.modal.desc_placeholder')}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs focus:outline-none resize-none"
                  />
                </div>

                <div className="flex gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-medium"
                  >
                    {t('zones.buttons.cancel')}
                  </button>
                  <button
                    type="submit"
                    className="flex-1 h-10 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold transition shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out cursor-pointer"
                  >
                    {t('zones.buttons.save')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {toEdit && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 border border-slate-200 flex flex-col max-h-screen">
            <h3 className="font-bold text-base text-slate-900 mb-1">{t('zones.modal.edit_title')}</h3>
            <div className="overflow-y-auto pr-1">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  onUpdateZone(toEdit.id_zone, toEdit);
                  setToEdit(null);
                }}
                className="space-y-3"
              >
                <div>
                  <SequentialCodePicker
                    prefix="ZONE-"
                    currentCode={toEdit.code_zone || toEdit.code || toEdit.id_zone}
                    onChangeCode={(newCode) => setToEdit((prev) => ({ ...prev, code_zone: newCode }))}
                    autoGeneratedCode={toEdit.code_zone || toEdit.code || toEdit.id_zone}
                    takenNumbers={takenZoneNumbers}
                    label={t('zones.modal.code_b1')}
                    disabled={true}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500 block mb-1">{t('zones.modal.id_b2')}</label>
                  <input
                    type="text"
                    value={toEdit.id_zone || ''}
                    onChange={(e) => setToEdit({ ...toEdit, id_zone: e.target.value.toUpperCase() })}
                    required
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500">{t('zones.modal.libelle_label')}</label>
                  <input
                    type="text"
                    value={toEdit.libelle}
                    onChange={(e) => setToEdit({ ...toEdit, libelle: e.target.value })}
                    required
                    className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs"
                  />
                </div>
                
                <div>
                  <label className="text-[11px] font-bold text-slate-500 block mb-1">{t('zones.modal.type_label')}</label>
                  <select
                    value={toEdit.type || 'FINITION'}
                    onChange={(e) => setToEdit({ ...toEdit, type: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs focus:outline-none"
                  >
                    <option value="FINITION">FINITION</option>
                    <option value="DECOUPE">DECOUPE</option>
                    <option value="SUPPORT">SUPPORT</option>
                    <option value="FORMAGE">FORMAGE</option>
                    <option value="ASSEMBLAGE_FINAL">ASSEMBLAGE FINAL</option>
                    <option value="STOCK">STOCK</option>
                    <option value="AUTRE">AUTRE</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-500 block mb-1">{t('zones.modal.desc_label')}</label>
                  <textarea
                    rows={3}
                    value={toEdit.description || ''}
                    onChange={(e) => setToEdit({ ...toEdit, description: e.target.value })}
                    className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs focus:outline-none resize-none"
                  />
                </div>

                <div className="flex gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setToEdit(null)}
                    className="flex-1 h-10 rounded-xl bg-slate-100 text-xs font-medium"
                  >
                    {t('zones.buttons.cancel')}
                  </button>
                  <button
                    type="submit"
                    className="flex-1 h-10 rounded-xl bg-blue-600 text-white text-xs font-semibold"
                  >
                    {t('zones.buttons.save')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {toDelete && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden p-5 space-y-4">
            <div className="flex flex-col items-center text-center">
              <AlertTriangle className="w-8 h-8 text-rose-600 mb-2" />
              <h3 className="font-bold text-lg text-slate-900">{t('zones.modal.delete_title')}</h3>
            </div>
            <p className="text-sm text-center text-slate-600">
              {t('zones.modal.delete_confirm')}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setToDelete(null)}
                className="flex-1 h-10 rounded-xl bg-slate-100 text-slate-700 text-xs font-medium"
              >
                {t('zones.buttons.cancel')}
              </button>
              <button
                onClick={() => {
                  onDeleteZone(toDelete.id_zone);
                  setToDelete(null);
                }}
                className="flex-1 h-10 rounded-xl bg-rose-600 text-white text-xs font-semibold"
              >
                {t('zones.buttons.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Excel Formulas Preview Modal */}
      {showFormulasModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-5 space-y-4 animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-700 shrink-0">
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <span>{t('zones.formulas.title')}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                      {t('zones.formulas.sheet')}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    {t('zones.formulas.subtitle')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowFormulasModal(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer shrink-0"
                title={t('zones.buttons.close')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content: 3 Formula Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              {/* Formule D: Techniciens */}
              <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-blue-300 transition">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                    <Users className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="truncate">{t('zones.formulas.f_d_title')}</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-100/80 text-blue-800 border border-blue-200 shrink-0">
                    Col. D
                  </span>
                </div>
                <div className="font-mono text-xs text-blue-800 font-bold bg-white p-2 rounded-lg border border-blue-100">
                  =COUNTIF(Tech!D:D, [@id_zone])
                </div>
                <p className="text-[10.5px] text-slate-500 leading-tight">
                  {t('zones.formulas.f_d_desc')}
                </p>
              </div>

              {/* Formule E: Opérations */}
              <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-indigo-300 transition">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                    <User className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span className="truncate">{t('zones.formulas.f_e_title')}</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-100/80 text-indigo-800 border border-indigo-200 shrink-0">
                    Col. E
                  </span>
                </div>
                <div className="font-mono text-xs text-indigo-800 font-bold bg-white p-2 rounded-lg border border-indigo-100">
                  =COUNTIF(Op!D:D, [@id_zone])
                </div>
                <p className="text-[10.5px] text-slate-500 leading-tight">
                  {t('zones.formulas.f_e_desc')}
                </p>
              </div>

              {/* Formule F: Machines */}
              <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-emerald-300 transition">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                    <Wrench className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="truncate">{t('zones.formulas.f_f_title')}</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-100/80 text-emerald-800 border border-emerald-200 shrink-0">
                    Col. F
                  </span>
                </div>
                <div className="font-mono text-xs text-emerald-800 font-bold bg-white p-2 rounded-lg border border-emerald-100">
                  =COUNTIF(Mch!F:F, [@id_zone])
                </div>
                <p className="text-[10.5px] text-slate-500 leading-tight">
                  {t('zones.formulas.f_f_desc')}
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-400 font-medium">
                {t('zones.formulas.footer_note')}
              </span>
              <button
                onClick={() => setShowFormulasModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out cursor-pointer"
              >
                {t('zones.buttons.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </AnimatedPage>
  );
}
