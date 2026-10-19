import { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  BookOpen,
  AlertTriangle,
  Layers,
  Trash2,
  Edit2,
  ChevronDown,
  ChevronUp,
  Package,
  CheckCircle2,
  XCircle,
  AlertCircle,
  X,
} from 'lucide-react';
import Action3DButton from '../../../components/common/Action3DButton';

const ACTION_COLORS = {
  C: 'bg-blue-500/10 text-blue-800 border-blue-200/80',
  N: 'bg-emerald-500/10 text-emerald-800 border-emerald-200/80',
  G: 'bg-amber-500/10 text-amber-800 border-amber-200/80',
  V: 'bg-indigo-500/10 text-indigo-800 border-indigo-200/80',
  R: 'bg-purple-500/10 text-purple-800 border-purple-200/80',
  S: 'bg-rose-500/10 text-rose-800 border-rose-200/80',
  L: 'bg-cyan-500/10 text-cyan-800 border-cyan-200/80',
};

const CRITICITE_COLORS = {
  Critique: 'bg-rose-100 text-rose-800 border-rose-200',
  Haute: 'bg-amber-100 text-amber-800 border-amber-200',
  Moyenne: 'bg-blue-100 text-blue-800 border-blue-200',
  Basse: 'bg-slate-100 text-slate-700 border-slate-200',
};

export default function TabGuide({
  guides = [],
  actions = [],
  stockItems = [],
  warehouseItems = [],
  onAddGuide,
  onUpdateGuide,
  onDeleteGuide,
}) {
  const [search, setSearch] = useState('');
  const [selectedFamille, setSelectedFamille] = useState('ALL');
  const [expandedGuideId, setExpandedGuideId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGuide, setEditingGuide] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    composant_nom: '',
    code: '',
    ref: '',
    famille: 'Mécanique',
    criticite: 'Haute',
    actions_liees: ['C'],
    fiches_actions: {},
    pieces_rechange: [],
    consignes_securite: '',
  });

  // PDR Sub-form state inside Modal
  const [selectedPdrId, setSelectedPdrId] = useState('');
  const [customPdrRef, setCustomPdrRef] = useState('');
  const [customPdrDesignation, setCustomPdrDesignation] = useState('');

  const allInventory = useMemo(() => {
    const list = [];
    (stockItems || []).forEach((item) => {
      const ref = String(item.ref || item.reference || item.code || '').trim();
      if (ref) {
        list.push({
          id_article: `PDR-${ref}`,
          ref,
          reference: ref,
          designation: item.designation || 'Pièce PDR',
          stockActuel: Number(item.stockActuel ?? item.stock_actuel ?? 0),
          seuil: Number(item.seuil ?? 2),
          source: 'PDR Magasin',
        });
      }
    });
    (warehouseItems || []).forEach((item) => {
      const ref = String(item.ref || item.reference || item.id_warehouse_item || '').trim();
      if (ref) {
        list.push({
          id_article: `WH-${ref}`,
          ref,
          reference: ref,
          designation: item.designation || 'Composant Entrepôt',
          stockActuel: Number(item.stockActuel ?? item.stock_actuel ?? 0),
          seuil: Number(item.seuil ?? 2),
          source: 'Entrepôt',
        });
      }
    });
    return list;
  }, [stockItems, warehouseItems]);

  const getPdrStockStatus = (pdrRef, _pdrId) => {
    const cleanRef = (pdrRef || '').trim().toLowerCase();
    if (!cleanRef) return { available: 0, status: 'UNKNOWN', label: 'Réf non spécifiée' };

    const found = allInventory.find((item) => {
      const itemRef = String(item.ref || '').toLowerCase();
      const itemDesig = String(item.designation || '').toLowerCase();
      return itemRef === cleanRef || itemRef.includes(cleanRef) || cleanRef.includes(itemRef) || itemDesig.includes(cleanRef);
    });

    if (!found) {
      return { available: 0, status: 'NOT_FOUND', label: 'Non répertorié au stock' };
    }

    const qte = found.stockActuel;
    const min = found.seuil || 2;

    if (qte <= 0) return { available: 0, status: 'OUT', label: 'Rupture (0)' };
    if (qte <= min) return { available: qte, status: 'LOW', label: `Stock Bas (${qte})` };
    return { available: qte, status: 'OK', label: `Stock OK (${qte})` };
  };

  const familles = ['ALL', ...new Set(guides.map((g) => g.famille).filter(Boolean))];

  const filteredGuides = guides.filter((g) => {
    const q = search.toLowerCase();
    const matchSearch =
      g.composant_nom.toLowerCase().includes(q) ||
      g.code.toLowerCase().includes(q) ||
      g.ref.toLowerCase().includes(q) ||
      (g.actions_liees || []).some((a) => a.toLowerCase().includes(q)) ||
      (g.pieces_rechange || []).some((p) => (p.designation || p.reference || '').toLowerCase().includes(q));
    const matchFamille = selectedFamille === 'ALL' || g.famille === selectedFamille;
    return matchSearch && matchFamille;
  });

  const toggleExpand = (id) => {
    setExpandedGuideId(expandedGuideId === id ? null : id);
  };

  const handleOpenAdd = () => {
    setEditingGuide(null);
    setFormData({
      composant_nom: '',
      code: '',
      ref: 'Manuel-Constructeur',
      famille: 'Mécanique',
      criticite: 'Haute',
      actions_liees: ['C', 'G'],
      fiches_actions: {
        C: { titre: 'Contrôle visuel et jeu', description: 'Contrôler état, jeu et température.', duree: '10 min', outils: 'Thermomètre IR' },
        G: { titre: 'Graissage périodique', description: 'Injecter graisse préconisée.', duree: '10 min', outils: 'Pompe à graisse' },
      },
      pieces_rechange: [
        { id_article: 'PDR-GRS-01', designation: 'Graisse SKF LGMT3 (Cartouche 400g)', reference: 'SKF-LGMT3-400', quantite: 1, unite: 'Cartouche', prix_unitaire: 18.5 },
      ],
      consignes_securite: 'Cadenassage LOTO obligatoire avant intervention.',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (guide) => {
    setEditingGuide(guide);
    setFormData({
      composant_nom: guide.composant_nom || '',
      code: guide.code || '',
      ref: guide.ref || '',
      famille: guide.famille || 'Mécanique',
      criticite: guide.criticite || 'Haute',
      actions_liees: guide.actions_liees || ['C'],
      fiches_actions: guide.fiches_actions || {},
      pieces_rechange: Array.isArray(guide.pieces_rechange) ? guide.pieces_rechange : [],
      consignes_securite: guide.consignes_securite || '',
    });
    setIsModalOpen(true);
  };

  const toggleActionInForm = (actionCode) => {
    const current = formData.actions_liees || [];
    let updated;
    if (current.includes(actionCode)) {
      updated = current.filter((c) => c !== actionCode);
    } else {
      updated = [...current, actionCode];
    }
    const fiches = { ...formData.fiches_actions };
    if (!fiches[actionCode]) {
      const actObj = actions.find((a) => a.code === actionCode);
      fiches[actionCode] = {
        titre: actObj ? `${actObj.libelle} de ${formData.composant_nom || 'composant'}` : 'Intervention',
        description: actObj?.description || '',
        duree: actObj?.duree_standard || '10 min',
        outils: actObj?.outils || '',
      };
    }
    setFormData({ ...formData, actions_liees: updated, fiches_actions: fiches });
  };

  const handleAddPdrToForm = () => {
    if (selectedPdrId) {
      const found = allInventory.find(
        (i) => i.ref === selectedPdrId || i.reference === selectedPdrId || i.id_article === selectedPdrId
      );
      if (found) {
        const newPdr = {
          id_article: found.id_article || `PDR-${found.ref || 'STD'}`,
          designation: found.designation || 'Article Stock',
          reference: found.ref || found.reference || selectedPdrId,
          quantite: 1,
          unite: 'Pièce',
          prix_unitaire: Number(found.prix_unitaire || 0),
        };
        setFormData({
          ...formData,
          pieces_rechange: [...(formData.pieces_rechange || []), newPdr],
        });
        setSelectedPdrId('');
        return;
      }
    }

    if (customPdrDesignation || customPdrRef) {
      const pdrIndex = (formData.pieces_rechange || []).length + 1;
      const newPdr = {
        id_article: `PDR-CUSTOM-${pdrIndex}`,
        designation: customPdrDesignation || customPdrRef,
        reference: customPdrRef || customPdrDesignation,
        quantite: 1,
        unite: 'Pièce',
        prix_unitaire: 0,
      };
      setFormData({
        ...formData,
        pieces_rechange: [...(formData.pieces_rechange || []), newPdr],
      });
      setCustomPdrDesignation('');
      setCustomPdrRef('');
    }
  };

  const handleRemovePdrFromForm = (idx) => {
    const updated = (formData.pieces_rechange || []).filter((_, i) => i !== idx);
    setFormData({ ...formData, pieces_rechange: updated });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.composant_nom || (formData.actions_liees || []).length === 0) {
      alert('Veuillez renseigner le nom du composant et associer au moins une action.');
      return;
    }

    if (editingGuide) {
      onUpdateGuide(editingGuide.id, formData);
    } else {
      onAddGuide(formData);
    }
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-5">
      {/* 3D TACTILE SUB-BANNER HEADER */}
      <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200/90 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden group/guides">
        <div className="flex items-start sm:items-center gap-3.5 relative">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent border border-purple-200/90 shadow-[0_4px_12px_rgba(168,85,247,0.12)] flex items-center justify-center text-purple-700 shrink-0">
            <BookOpen className="w-6 h-6 text-purple-700" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="text-lg font-black text-slate-900 tracking-tight">
                Guide Composant-Action & Pièces de Rechange (PDR)
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-50 text-purple-800 border border-purple-200 shadow-2xs">
                RÉFÉRENTIEL TECHNIQUE
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
              Associez chaque organe (Roulement, Courroie, Glissière...) à ses actions préventives multiples (C+G, C+N...) et aux pièces de rechange nécessaires.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 self-end md:self-center">
          <Action3DButton
            variant="circle"
            color="purple"
            icon={Plus}
            showAddBadge={true}
            onClick={handleOpenAdd}
            title="Créer une Fiche Guide Composant-Action"
          />
        </div>
      </div>

      {/* SEARCH & FAMILLES FILTER BAR */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.08)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher par organe, référence, action ou PDR..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all font-medium"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-[10.5px] font-black text-slate-400 uppercase tracking-wider mr-1 shrink-0">
            Famille :
          </span>
          {familles.map((fam) => (
            <button
              key={fam}
              onClick={() => setSelectedFamille(fam)}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all shrink-0 cursor-pointer ${
                selectedFamille === fam
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {fam === 'ALL' ? 'Toutes les familles' : fam}
            </button>
          ))}
        </div>
      </div>

      {/* GUIDES LIST / CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredGuides.map((guide) => {
          const isExpanded = expandedGuideId === guide.id;
          const critColor = CRITICITE_COLORS[guide.criticite] || CRITICITE_COLORS.Moyenne;
          const pdrList = Array.isArray(guide.pieces_rechange) ? guide.pieces_rechange : [];

          return (
            <div
              key={guide.id}
              className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16)] hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between group"
            >
              <div>
                {/* Top Title Row */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 border border-purple-200/80 flex items-center justify-center font-bold shrink-0">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-black text-slate-900">
                          {guide.composant_nom}
                        </h4>
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md border ${critColor}`}>
                          {guide.criticite || 'Moyenne'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 font-mono">
                        {guide.ref} • <span className="text-slate-500 font-sans">{guide.famille}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(guide)}
                      className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-purple-600 rounded-lg transition-colors cursor-pointer"
                      title="Modifier la fiche guide"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`Supprimer la fiche guide pour ${guide.composant_nom} ?`)) {
                          onDeleteGuide(guide.id);
                        }
                      }}
                      className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                      title="Supprimer la fiche guide"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Actions liées Badges */}
                <div className="flex flex-wrap items-center gap-2 mb-3 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-[11px] font-bold text-slate-500 mr-1 flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-purple-600" />
                    <span>Actions :</span>
                  </span>
                  {(guide.actions_liees || []).map((actCode) => {
                    const actObj = actions.find((a) => a.code === actCode);
                    const pillStyle = ACTION_COLORS[actCode] || 'bg-slate-100 text-slate-700 border-slate-200';
                    return (
                      <span
                        key={actCode}
                        className={`px-2.5 py-0.5 text-xs font-bold rounded-lg border flex items-center gap-1.5 ${pillStyle}`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                        <span>{actCode} - {actObj?.libelle || actCode}</span>
                      </span>
                    );
                  })}
                </div>

                {/* PDR Consumables List */}
                {pdrList.length > 0 && (
                  <div className="mb-3 bg-indigo-50/40 border border-indigo-100 rounded-xl p-2.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10.5px] font-bold text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5 text-indigo-600" />
                        <span>PDR & Consommables Préconisés ({pdrList.length}) :</span>
                      </span>
                    </div>

                    <div className="space-y-1">
                      {pdrList.map((pdr, idx) => {
                        const stockInfo = getPdrStockStatus(pdr.reference, pdr.id_article);
                        const isOk = stockInfo.status === 'OK';
                        const isLow = stockInfo.status === 'LOW';
                        return (
                          <div
                            key={idx}
                            className="bg-white rounded-lg p-2 border border-indigo-100/60 flex items-center justify-between gap-2 text-xs"
                          >
                            <div className="min-w-0">
                              <span className="font-semibold text-slate-800 block truncate text-xs">
                                {pdr.designation}
                              </span>
                              <span className="text-[10px] font-mono text-slate-400">
                                Réf: {pdr.reference} • Qte: {pdr.quantite || 1} {pdr.unite || 'U'}
                              </span>
                            </div>

                            <span
                              className={`px-2 py-0.5 text-[10px] font-bold rounded-md border shrink-0 flex items-center gap-1 ${
                                isOk
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : isLow
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : 'bg-rose-50 text-rose-700 border-rose-200'
                              }`}
                            >
                              {isOk ? (
                                <CheckCircle2 className="w-3 h-3" />
                              ) : isLow ? (
                                <AlertCircle className="w-3 h-3" />
                              ) : (
                                <XCircle className="w-3 h-3" />
                              )}
                              <span>{stockInfo.label}</span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Consignes Sécurité */}
                {guide.consignes_securite && (
                  <div className="mb-3 text-xs bg-amber-50/70 border border-amber-200/70 text-amber-900 p-2.5 rounded-xl flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <span className="text-[11px] leading-relaxed">{guide.consignes_securite}</span>
                  </div>
                )}
              </div>

              {/* Expand Toggle */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => toggleExpand(guide.id)}
                  className="text-xs font-bold text-purple-700 hover:text-purple-900 flex items-center gap-1 cursor-pointer"
                >
                  <span>{isExpanded ? 'Masquer détails' : 'Afficher détails & fiches'}</span>
                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Expanded details */}
              {isExpanded && guide.fiches_actions && (
                <div className="mt-3 pt-3 border-t border-slate-100 space-y-2 text-xs">
                  {Object.entries(guide.fiches_actions).map(([actCode, fiche]) => (
                    <div key={actCode} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                      <div className="flex items-center justify-between font-bold text-slate-800">
                        <span>Action {actCode} - {fiche.titre || actCode}</span>
                        <span className="font-mono text-slate-500 text-[10px]">{fiche.duree || '10 min'}</span>
                      </div>
                      <p className="text-[11px] text-slate-600">{fiche.description}</p>
                      {fiche.outils && (
                        <p className="text-[10px] text-slate-400 font-mono">Outils : {fiche.outils}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* MODAL: CREER / MODIFIER FICHE GUIDE */}
      {/* ========================================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 space-y-5 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-200 flex items-center justify-center text-purple-700">
                  <BookOpen className="w-5 h-5 text-purple-700" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {editingGuide ? 'Modifier la Fiche Guide' : 'Nouvelle Fiche Guide Organe'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Configuration des actions requises et pièces associées
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

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Nom du Composant * :</label>
                  <input
                    type="text"
                    required
                    value={formData.composant_nom}
                    onChange={(e) => setFormData({ ...formData, composant_nom: e.target.value })}
                    placeholder="ex: Roulement conique, Courroie crantée"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500 font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Famille :</label>
                  <select
                    value={formData.famille}
                    onChange={(e) => setFormData({ ...formData, famille: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
                  >
                    <option value="Mécanique">Mécanique</option>
                    <option value="Hydraulique">Hydraulique</option>
                    <option value="Électrique">Électrique</option>
                    <option value="Pneumatique">Pneumatique</option>
                    <option value="Structure & Sécurité">Structure & Sécurité</option>
                  </select>
                </div>
              </div>

              {/* Actions liées Selector */}
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1.5">
                  Actions Préventives Autorisées (Sélection multiple) :
                </label>
                <div className="flex flex-wrap gap-2">
                  {actions.map((act) => {
                    const isSelected = (formData.actions_liees || []).includes(act.code);
                    return (
                      <button
                        type="button"
                        key={act.code}
                        onClick={() => toggleActionInForm(act.code)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {act.code} - {act.libelle}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* PDR Section inside Modal */}
              <div className="bg-indigo-50/50 border border-indigo-200/70 rounded-2xl p-3.5 space-y-2.5">
                <span className="font-bold text-indigo-950 block uppercase text-xs">
                  Pièces de rechange associées au composant :
                </span>

                {formData.pieces_rechange && formData.pieces_rechange.length > 0 && (
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {formData.pieces_rechange.map((pdr, idx) => (
                      <div key={idx} className="bg-white p-2 rounded-xl border border-indigo-100 flex items-center justify-between text-xs">
                        <span>{pdr.designation} (Réf: {pdr.reference}) • {pdr.quantite} {pdr.unite}</span>
                        <button
                          type="button"
                          onClick={() => handleRemovePdrFromForm(idx)}
                          className="text-rose-500 hover:text-rose-700 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-1 border-t border-indigo-100 text-xs">
                  <div className="sm:col-span-8">
                    <select
                      value={selectedPdrId}
                      onChange={(e) => setSelectedPdrId(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl font-medium text-slate-800"
                    >
                      <option value="">Sélectionner une pièce du catalogue stock (PDR / Entrepôt)...</option>
                      {allInventory.map((item, idx) => (
                        <option key={idx} value={item.ref}>
                          [{item.source}] {item.ref} - {item.designation} (Stock: {item.stockActuel})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-4">
                    <button
                      type="button"
                      onClick={handleAddPdrToForm}
                      disabled={!selectedPdrId}
                      className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl"
                    >
                      + Lier Pièce
                    </button>
                  </div>
                </div>
              </div>

              {/* Consignes Sécurité */}
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Consignes de Sécurité :</label>
                <input
                  type="text"
                  value={formData.consignes_securite}
                  onChange={(e) => setFormData({ ...formData, consignes_securite: e.target.value })}
                  placeholder="ex: Port d'EPI, Cadenassage LOTO obligatoire"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500"
                />
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
                  className="px-5 py-2 text-xs font-black bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-xs"
                >
                  {editingGuide ? 'Mettre à jour' : 'Enregistrer la Fiche'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
