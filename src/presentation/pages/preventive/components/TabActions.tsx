import { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  Wrench,
  Clock,
  Sparkles,
  Eye,
  Droplet,
  CheckCircle,
  ShieldAlert,
  Zap,
  Trash2,
  Edit2,
  Settings2,
  X,
  Grid,
  Table,
} from 'lucide-react';
import Action3DButton from '../../../components/common/Action3DButton';
import TablePaginationCard from '../../../components/common/TablePaginationCard';

const ICON_MAP = {
  Eye: Eye,
  Sparkles: Sparkles,
  Droplet: Droplet,
  CheckCircle: CheckCircle,
  Wrench: Wrench,
  ShieldAlert: ShieldAlert,
  Zap: Zap,
};

// Generates cohesive, professional Light UI styles based on the action code prefix
const getLightUIStyle = (code) => {
  const norm = String(code || '').toUpperCase().trim();
  if (norm.startsWith('G')) {
    return {
      bg: 'bg-amber-50/50 hover:bg-amber-50/80',
      text: 'text-amber-700',
      border: 'border-amber-200/70',
      badge: 'bg-amber-100/90 text-amber-800'
    };
  }
  if (norm.startsWith('N')) {
    return {
      bg: 'bg-emerald-50/50 hover:bg-emerald-50/80',
      text: 'text-emerald-700',
      border: 'border-emerald-200/70',
      badge: 'bg-emerald-100/90 text-emerald-800'
    };
  }
  if (norm.startsWith('C')) {
    return {
      bg: 'bg-blue-50/50 hover:bg-blue-50/80',
      text: 'text-blue-700',
      border: 'border-blue-200/70',
      badge: 'bg-blue-100/90 text-blue-800'
    };
  }
  if (norm.startsWith('V')) {
    return {
      bg: 'bg-cyan-50/50 hover:bg-cyan-50/80',
      text: 'text-cyan-700',
      border: 'border-cyan-200/70',
      badge: 'bg-cyan-100/90 text-cyan-800'
    };
  }
  if (norm.startsWith('R')) {
    return {
      bg: 'bg-rose-50/50 hover:bg-rose-50/80',
      text: 'text-rose-700',
      border: 'border-rose-200/70',
      badge: 'bg-rose-100/90 text-rose-800'
    };
  }
  if (norm.startsWith('S')) {
    return {
      bg: 'bg-indigo-50/50 hover:bg-indigo-50/80',
      text: 'text-indigo-700',
      border: 'border-indigo-200/70',
      badge: 'bg-indigo-100/90 text-indigo-800'
    };
  }
  return {
    bg: 'bg-slate-50/60 hover:bg-slate-50/90',
    text: 'text-slate-700',
    border: 'border-slate-200/70',
    badge: 'bg-slate-100 text-slate-800'
  };
};

export default function TabActions({
  actions = [],
  onAddAction,
  onUpdateAction,
  onDeleteAction,
}) {
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAction, setEditingAction] = useState(null);
  const [displayMode, setDisplayMode] = useState('grid'); // 'grid' | 'excel'

  // Pagination states
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

  const [formData, setFormData] = useState({
    code: '',
    ref: '',
    libelle: '',
    description: '',
    icone: 'Eye',
    duree_standard: '15 min',
    outils: '',
  });

  const filteredActions = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return actions;
    return actions.filter((act) => {
      return (
        act.code.toLowerCase().includes(q) ||
        act.libelle.toLowerCase().includes(q) ||
        (act.ref && act.ref.toLowerCase().includes(q)) ||
        (act.description && act.description.toLowerCase().includes(q))
      );
    });
  }, [actions, search]);

  const totalItems = filteredActions.length;
  const effectivePageSize = pageSize === 0 ? totalItems : pageSize;
  const startIndex = (currentPage - 1) * effectivePageSize;

  const paginatedActions = useMemo(() => {
    if (pageSize === 0) return filteredActions;
    return filteredActions.slice(startIndex, startIndex + effectivePageSize);
  }, [filteredActions, pageSize, startIndex, effectivePageSize]);

  const handleOpenAdd = () => {
    setEditingAction(null);
    setFormData({
      code: '',
      ref: 'ISO-17359',
      libelle: '',
      description: '',
      icone: 'Eye',
      duree_standard: '15 min',
      outils: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (act) => {
    setEditingAction(act);
    setFormData({
      code: act.code || '',
      ref: act.ref || '',
      libelle: act.libelle || '',
      description: act.description || '',
      icone: act.icone || 'Eye',
      duree_standard: act.duree_standard || '15 min',
      outils: act.outils || '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.code || !formData.libelle) return;

    if (editingAction) {
      onUpdateAction(editingAction.id, { ...formData, couleur: formData.code[0]?.toLowerCase() || 'blue' });
    } else {
      onAddAction({ ...formData, couleur: formData.code[0]?.toLowerCase() || 'blue' });
    }
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-5">
      {/* 3D TACTILE SUB-BANNER HEADER */}
      <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200/90 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden group/actions">
        <div className="flex items-start sm:items-center gap-3.5 relative">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500/10 via-indigo-500/5 to-transparent border border-indigo-200/90 shadow-[0_4px_12px_rgba(99,102,241,0.12)] flex items-center justify-center text-indigo-700 shrink-0">
            <Settings2 className="w-6 h-6 text-indigo-700" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="text-lg font-black text-slate-900 tracking-tight">
                Catalogue des Actions d'Intervention Préventive
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-50 text-indigo-800 border border-indigo-200 shadow-2xs">
                STANDARDISATION AFNOR/ISO
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
              Définissez les codes normalisés (C, N, G, V, R, S, L...), leurs durées standards, outils requis et références ISO/Constructeur.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 self-end md:self-center">
          <Action3DButton
            variant="circle"
            color="indigo"
            icon={Plus}
            showAddBadge={true}
            onClick={handleOpenAdd}
            title="Créer une Action Normalisée (AFNOR / ISO)"
          />
        </div>
      </div>

      {/* SEARCH BAR & QUICK STATS & VIEW TOGGLER */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.08)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher une action (Code, Libellé, Réf...)"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
          />
        </div>

        <div className="flex items-center gap-3">
          {/* View Toggler (Grid vs Excel Spreadsheet) */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold gap-1">
            <button
              onClick={() => setDisplayMode('grid')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${displayMode === 'grid' ? 'bg-white shadow-xs text-indigo-600 font-black' : 'text-slate-500 hover:text-slate-800'}`}
              title="Affichage en Grille"
            >
              <Grid className="w-3.5 h-3.5" />
              <span>Grille</span>
            </button>
            <button
              onClick={() => setDisplayMode('excel')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${displayMode === 'excel' ? 'bg-white shadow-xs text-indigo-600 font-black' : 'text-slate-500 hover:text-slate-800'}`}
              title="Mode Tableur Excel"
            >
              <Table className="w-3.5 h-3.5" />
              <span>Excel</span>
            </button>
          </div>

          <span className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 font-mono text-xs font-bold text-slate-600 hidden sm:inline-block">
            {filteredActions.length} Actions
          </span>
        </div>
      </div>

      {/* RENDER GRID MODE */}
      {displayMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedActions.map((act) => {
            const lightStyle = getLightUIStyle(act.code);
            const IconComponent = ICON_MAP[act.icone] || CheckCircle;

            return (
              <div
                key={act.id}
                className={`bg-white rounded-2xl p-5 border ${lightStyle.border} ${lightStyle.bg} shadow-[0_4px_12px_rgba(0,0,0,0.03),0_1px_2px_rgba(0,0,0,0.02)] hover:shadow-[0_12px_24px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between relative group`}
              >
                <div>
                  {/* Top bar action card */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-black text-lg ${lightStyle.badge} shadow-2xs`}>
                        {act.code}
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                          <span>{act.libelle}</span>
                          <IconComponent className={`w-3.5 h-3.5 ${lightStyle.text}`} />
                        </h4>
                        <p className="text-[11px] font-mono text-slate-400">
                          {act.ref || 'Sans référence'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleOpenEdit(act)}
                        className="p-1.5 hover:bg-white/90 text-slate-500 hover:text-indigo-600 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-slate-200"
                        title="Modifier l'action"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(`Supprimer l'action ${act.code} (${act.libelle}) ?`)) {
                            onDeleteAction(act.id);
                          }
                        }}
                        className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-rose-100"
                        title="Supprimer l'action"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-slate-600 line-clamp-2 mb-3 bg-white/65 p-2.5 rounded-xl border border-slate-100 leading-relaxed">
                    {act.description || 'Aucune consigne rédigée.'}
                  </p>

                  {/* Métier Details */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-mono text-[11px]">{act.duree_standard || '15 min'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-600 truncate">
                      <Wrench className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate text-[11px]">{act.outils || 'Outillage std'}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[10.5px] text-slate-400 font-mono">
                  <span>Code ISO: {act.code}</span>
                  <span className="text-[10px] font-sans font-bold text-slate-400">Light UI Autotheme</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* RENDER EXCEL SPREADSHEET MODE */}
      {displayMode === 'excel' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out animate-fade-in">
          {/* Top Info Header Bar inside Card */}
          <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-500 bg-slate-50/50 gap-2">
            <div className="font-bold text-slate-800 text-[13px] flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-indigo-600" />
              <span>Tableau des Actions d'Intervention • Mode Tableur Excel (Row 3 : B → G)</span>
            </div>
            <div className="font-mono text-[11px] text-slate-400 hidden lg:block">
              N° | CODE (1) | LIBELLÉ DE L'ACTION | RÉFÉRENCE ISO | DESCRIPTION CONSIGNE | TEMPS STD | OUTILLAGE
            </div>
          </div>

          <div className="max-h-[62vh] overflow-y-auto overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse min-w-[1020px]">
              <thead className="sticky top-0 bg-slate-100 text-[11px] font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200 z-10 shadow-2xs select-none">
                <tr>
                  <th className="py-3 px-3 text-center w-12 text-slate-500 font-mono text-[10px] bg-slate-200/60 border-r border-slate-200 shrink-0">
                    N°
                  </th>
                  <th className="py-3 px-3.5 text-center w-24 border-r border-slate-200">
                    CODE
                  </th>
                  <th className="py-3 px-3.5">
                    LIBELLÉ DE L'ACTION
                  </th>
                  <th className="py-3 px-3.5 font-mono">
                    RÉFÉRENCE ISO
                  </th>
                  <th className="py-3 px-3.5">
                    CONSIGNE & DESCRIPTION STANDARD
                  </th>
                  <th className="py-3 px-3.5">
                    DURÉE EST.
                  </th>
                  <th className="py-3 px-3.5">
                    OUTILLAGE REQUIS
                  </th>
                  <th className="py-3 px-3.5 text-center w-28">
                    ACTIONS
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80">
                {paginatedActions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400 font-medium">
                      Aucune action ne correspond à vos filtres de recherche.
                    </td>
                  </tr>
                ) : (
                  paginatedActions.map((act, idx) => {
                    const rowNum = startIndex + idx + 1;
                    const lightStyle = getLightUIStyle(act.code);
                    const IconComponent = ICON_MAP[act.icone] || CheckCircle;
                    return (
                      <tr
                        key={act.id}
                        className="even:bg-slate-50/70 odd:bg-white hover:bg-indigo-50/40 border-b border-slate-200/70 transition-colors"
                      >
                        {/* Row N° Column */}
                        <td className="py-3 px-3 text-center font-mono text-[11px] font-bold text-slate-400 bg-slate-100/40 border-r border-slate-200/80 shrink-0">
                          {rowNum}
                        </td>

                        {/* CODE Column */}
                        <td className="py-3 px-3 text-center border-r border-slate-200/80 font-black font-mono">
                          <span className={`inline-block px-2.5 py-1 rounded-lg ${lightStyle.badge} text-[11px] shadow-3xs`}>
                            {act.code}
                          </span>
                        </td>

                        {/* LIBELLÉ Column */}
                        <td className="py-3 px-3.5 font-bold text-slate-900">
                          <div className="flex items-center gap-1.5">
                            <span>{act.libelle}</span>
                            <IconComponent className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          </div>
                        </td>

                        {/* RÉFÉRENCE Column */}
                        <td className="py-3 px-3.5 font-mono text-slate-500 font-medium">
                          <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                            {act.ref || 'Sans référence'}
                          </span>
                        </td>

                        {/* DESCRIPTION Column */}
                        <td className="py-3 px-3.5 text-slate-600 font-medium leading-relaxed max-w-sm truncate" title={act.description}>
                          {act.description || '—'}
                        </td>

                        {/* DURÉE Column */}
                        <td className="py-3 px-3.5 font-mono text-slate-500 font-medium">
                          {act.duree_standard || '15 min'}
                        </td>

                        {/* OUTILLAGE Column */}
                        <td className="py-3 px-3.5 text-slate-600 font-medium">
                          {act.outils || 'Outillage std'}
                        </td>

                        {/* ACTIONS Column */}
                        <td className="py-3 px-3.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleOpenEdit(act)}
                              className="p-1.5 hover:bg-white text-slate-500 hover:text-indigo-600 rounded-lg border border-transparent hover:border-slate-200 transition"
                              title="Modifier la ligne"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                if (window.confirm(`Supprimer l'action ${act.code} ?`)) {
                                  onDeleteAction(act.id);
                                }
                              }}
                              className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg border border-transparent hover:border-rose-100 transition"
                              title="Supprimer la ligne"
                              disabled={['C', 'N', 'G', 'V'].includes(act.code)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Standardized Table Pagination Footer */}
      <TablePaginationCard
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        pageSize={pageSize}
        setPageSize={setPageSize}
        totalItems={totalItems}
        pageSizeOptions={[25, 50, 100, 200, 0]}
        color="indigo"
        itemLabel="actions"
      />

      {/* ========================================================================= */}
      {/* MODAL: AJOUTER / MODIFIER ACTION */}
      {/* ========================================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-200 flex items-center justify-center text-indigo-700 font-black">
                  {formData.code || 'A'}
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {editingAction ? 'Modifier l\'Action Métier' : 'Nouvelle Action Normalisée'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Standardisation d'une tâche de maintenance préventive
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Code (1 lettre) * :</label>
                  <input
                    type="text"
                    required
                    maxLength={3}
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="ex: G"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-black text-center text-sm uppercase"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block font-bold text-slate-700 uppercase mb-1">Libellé de l'Action * :</label>
                  <input
                    type="text"
                    required
                    value={formData.libelle}
                    onChange={(e) => setFormData({ ...formData, libelle: e.target.value })}
                    placeholder="ex: Graissage / Lubrification"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Référence ISO / Norme :</label>
                <input
                  type="text"
                  value={formData.ref}
                  onChange={(e) => setFormData({ ...formData, ref: e.target.value })}
                  placeholder="ex: ISO-17359"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Consigne & Description :</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Détaillez la procédure standard attendue..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Durée Standard :</label>
                  <input
                    type="text"
                    value={formData.duree_standard}
                    onChange={(e) => setFormData({ ...formData, duree_standard: e.target.value })}
                    placeholder="ex: 15 min"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Outils requis :</label>
                  <input
                    type="text"
                    value={formData.outils}
                    onChange={(e) => setFormData({ ...formData, outils: e.target.value })}
                    placeholder="ex: Pompe à graisse, Clé 13"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Icône d'illustration :</label>
                <select
                  value={formData.icone}
                  onChange={(e) => setFormData({ ...formData, icone: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                >
                  <option value="Eye">👁️ Eye (Contrôle / Inspection)</option>
                  <option value="Sparkles">✨ Sparkles (Nettoyage / Propreté)</option>
                  <option value="Droplet">💧 Droplet (Graissage / Lubrification)</option>
                  <option value="CheckCircle">✅ CheckCircle (Vérification de bon fonctionnement)</option>
                  <option value="Wrench">🔧 Wrench (Révision / Ajustement)</option>
                  <option value="ShieldAlert">⚠️ ShieldAlert (Sécurité / Organes critiques)</option>
                  <option value="Zap">⚡ Zap (Composant Électrique)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs"
                >
                  {editingAction ? 'Mettre à jour' : 'Créer l\'Action'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
