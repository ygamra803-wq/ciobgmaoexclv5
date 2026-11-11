import { useState } from 'react';
import { Package, X, Check, Edit2, Power, Plus, ShieldCheck, AlertCircle } from 'lucide-react';
import { PdrGroup, MaterialPolicyTag } from '../../../../types/domain';

interface PdrGroupsModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdrGroups: PdrGroup[];
  onSaveGroups: (groups: PdrGroup[]) => void;
  types?: any[];
  stockItems?: any[];
}

export default function PdrGroupsModal({
  isOpen,
  onClose,
  pdrGroups = [],
  onSaveGroups,
  types = [],
  stockItems = [],
}: PdrGroupsModalProps) {
  const [editingGroup, setEditingGroup] = useState<PdrGroup | null>(null);
  const [form, setForm] = useState<{
    code: string;
    libelle: string;
    description: string;
    default_policy_tags: MaterialPolicyTag[];
    is_active: boolean;
  }>({
    code: '',
    libelle: '',
    description: '',
    default_policy_tags: ['REPLACING'],
    is_active: true,
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleStartCreate = () => {
    setEditingGroup(null);
    setForm({
      code: '',
      libelle: '',
      description: '',
      default_policy_tags: ['REPLACING'],
      is_active: true,
    });
    setErrorMsg(null);
  };

  const handleStartEdit = (g: PdrGroup) => {
    setEditingGroup(g);
    setForm({
      code: g.code || '',
      libelle: g.libelle || '',
      description: g.description || '',
      default_policy_tags: g.default_policy_tags || ['REPLACING'],
      is_active: g.is_active !== false,
    });
    setErrorMsg(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = form.code.trim().toUpperCase();
    const cleanLibelle = form.libelle.trim();

    if (!cleanCode || !cleanLibelle) {
      setErrorMsg('Le code et le libellé sont obligatoires.');
      return;
    }

    // Check code uniqueness
    const exists = pdrGroups.some(
      (g) => g.code.toUpperCase() === cleanCode && (!editingGroup || g.id !== editingGroup.id)
    );
    if (exists) {
      setErrorMsg(`Un groupe avec le code "${cleanCode}" existe déjà.`);
      return;
    }

    if (editingGroup) {
      const updated = pdrGroups.map((g) =>
        g.id === editingGroup.id
          ? {
              ...g,
              code: cleanCode,
              libelle: cleanLibelle,
              description: form.description.trim(),
              default_policy_tags: form.default_policy_tags,
              is_active: form.is_active,
            }
          : g
      );
      onSaveGroups(updated);
    } else {
      const newGroup: PdrGroup = {
        id: `GRP-${cleanCode}`,
        code: cleanCode,
        libelle: cleanLibelle,
        description: form.description.trim(),
        default_policy_tags: form.default_policy_tags,
        sort_order: pdrGroups.length + 1,
        is_active: form.is_active,
      };
      onSaveGroups([...pdrGroups, newGroup]);
    }

    handleStartCreate();
  };

  const handleToggleActive = (g: PdrGroup) => {
    const updated = pdrGroups.map((item) =>
      item.id === g.id ? { ...item, is_active: item.is_active === false ? true : false } : item
    );
    onSaveGroups(updated);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-3xl w-full p-6 animate-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200/80 flex items-center justify-center text-indigo-700 shadow-2xs">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-slate-900">
                  Structure Hiérarchique PDR : Groupes (Niveau 1)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-100 text-indigo-800">
                  {pdrGroups.length} Groupes
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Classification organisationnelle (Groupe ➔ Type ➔ SKU / Ref). Aucune mutation de stock direct.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-5 overflow-y-auto py-4 flex-1 pr-1">
          {/* Add / Edit Form */}
          <form
            onSubmit={handleSubmit}
            className="bg-slate-50/90 rounded-2xl border border-slate-200/90 p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                {editingGroup ? (
                  <>
                    <Edit2 className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Modifier Groupe : {editingGroup.code}</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Créer Nouveau Groupe PDR</span>
                  </>
                )}
              </span>
              {editingGroup && (
                <button
                  type="button"
                  onClick={handleStartCreate}
                  className="text-[11px] font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  Annuler l'édition
                </button>
              )}
            </div>

            {errorMsg && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  Code Groupe *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ex: ROUL"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-mono font-bold focus:border-indigo-500 outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  Libellé Fonctionnel *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ex: Roulements & Paliers industriels"
                  value={form.libelle}
                  onChange={(e) => setForm({ ...form, libelle: e.target.value })}
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:border-indigo-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                Description / Périmètre
              </label>
              <input
                type="text"
                placeholder="ex: Roulements à billes, rouleaux, rotules et paliers applique"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs focus:border-indigo-500 outline-none"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span>Groupe Actif (disponible dans les filtres)</span>
              </label>

              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{editingGroup ? 'Mettre à jour' : 'Enregistrer le Groupe'}</span>
              </button>
            </div>
          </form>

          {/* Existing Groups Table */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/80 border-b border-slate-200 text-slate-600 uppercase font-bold text-[10px] tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Code</th>
                  <th className="py-2.5 px-3">Libellé</th>
                  <th className="py-2.5 px-3">Types Liés</th>
                  <th className="py-2.5 px-3">Articles</th>
                  <th className="py-2.5 px-3">Statut</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pdrGroups.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-400 italic">
                      Aucun groupe configuré. Utilisez le formulaire ci-dessus pour initialiser la hiérarchie.
                    </td>
                  </tr>
                ) : (
                  pdrGroups.map((g) => {
                    const linkedTypesCount = types.filter(
                      (t) =>
                        String(t.id_group || '').trim().toUpperCase() === String(g.id).trim().toUpperCase()
                    ).length;
                    const linkedItemsCount = stockItems.filter(
                      (item) =>
                        String(item.id_group || '').trim().toUpperCase() ===
                        String(g.id).trim().toUpperCase()
                    ).length;

                    return (
                      <tr key={g.id} className="hover:bg-slate-50 transition">
                        <td className="py-2.5 px-3 font-mono font-bold text-indigo-700">
                          <span className="px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-200">
                            {g.code}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-900">{g.libelle}</div>
                          {g.description && (
                            <div className="text-[10px] text-slate-500">{g.description}</div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">
                          {linkedTypesCount > 0 ? (
                            <span className="font-bold text-amber-700">{linkedTypesCount} types</span>
                          ) : (
                            <span className="text-slate-400">0</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">
                          {linkedItemsCount > 0 ? (
                            <span className="font-bold text-slate-900">{linkedItemsCount} SKU</span>
                          ) : (
                            <span className="text-slate-400">0</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          {g.is_active !== false ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <ShieldCheck className="w-3 h-3 text-emerald-600" />
                              <span>Actif</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                              <span>Désactivé</span>
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleStartEdit(g)}
                              className="p-1 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition cursor-pointer"
                              title="Modifier ce groupe"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleActive(g)}
                              className={`p-1 rounded-lg transition cursor-pointer ${
                                g.is_active !== false
                                  ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                                  : 'text-emerald-600 hover:bg-emerald-50'
                              }`}
                              title={g.is_active !== false ? 'Désactiver le groupe' : 'Réactiver le groupe'}
                            >
                              <Power className="w-3.5 h-3.5" />
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

        {/* Footer */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
          <span>Safe-Archive: Les groupes associés à des types/articles sont désactivés plutôt que supprimés.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
