import { useState, useEffect } from 'react';
import { Package, CheckCircle2, X, MapPin, Boxes } from 'lucide-react';
import CustomSelect from '../../components/common/CustomSelect';

export default function EditArticleModal({
  isOpen,
  onClose,
  article,
  types = [],
  onUpdateArticle,
}) {
  const [form, setForm] = useState({
    ref: article?.ref || '',
    designation: article?.designation || '',
    id_type: article?.id_type || types[0]?.id_type || '',
    stockInitial: article?.stockInitial ?? 0,
    seuil: article?.seuil ?? 5,
    emplacement: article?.emplacement || 'R1-B01',
  });

  useEffect(() => {
    if (article) {
      setForm({
        ref: article.ref || '',
        designation: article.designation || '',
        id_type: article.id_type || types[0]?.id_type || '',
        stockInitial: article.stockInitial ?? 0,
        seuil: article.seuil ?? 5,
        emplacement: article.emplacement || 'R1-B01',
      });
    }
  }, [article, types]);

  if (!isOpen || !article) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.designation) return;

    const targetId = article.id || article.ref;
    onUpdateArticle(targetId, {
      ...article,
      id: targetId,
      designation: form.designation.trim(),
      id_type: form.id_type,
      stockInitial: Number(form.stockInitial) || 0,
      seuil: Number(form.seuil) || 0,
      emplacement: form.emplacement.trim() || 'ATELIER',
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-50 border border-cyan-200/80 flex items-center justify-center text-cyan-700 shadow-2xs font-bold">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">Modifier la Fiche Article (PDR)</h3>
              <p className="text-xs text-slate-500">Mise à jour des métadonnées, seuils et emplacement</p>
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

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                Référence (Ref B)
              </label>
              <input
                type="text"
                value={form.ref}
                disabled
                className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-100 font-mono font-bold text-slate-500 text-xs cursor-not-allowed"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                Désignation (C)
              </label>
              <input
                type="text"
                placeholder="Désignation de la pièce"
                value={form.designation}
                onChange={(e) => setForm({ ...form, designation: e.target.value })}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold focus:bg-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                <Boxes className="w-3 h-3 text-indigo-600" />
                <span>Type de Pièce (D)</span>
              </label>
              <CustomSelect
                value={form.id_type}
                onChange={(val) => setForm({ ...form, id_type: val })}
                options={types.map((t) => ({
                  value: t.id_type,
                  label: `${t.libelle} (${t.id_type})`,
                }))}
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-purple-600" />
                <span>Emplacement Magasin (K)</span>
              </label>
              <input
                type="text"
                placeholder="ex: R1-B04"
                value={form.emplacement}
                onChange={(e) => setForm({ ...form, emplacement: e.target.value })}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono font-bold focus:bg-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                Stock Initial (E)
              </label>
              <input
                type="number"
                min="0"
                value={form.stockInitial}
                onChange={(e) => setForm({ ...form, stockInitial: parseInt(e.target.value, 10) || 0 })}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono font-bold focus:bg-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                required
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                Seuil d'Alerte (I)
              </label>
              <input
                type="number"
                min="0"
                value={form.seuil}
                onChange={(e) => setForm({ ...form, seuil: parseInt(e.target.value, 10) || 0 })}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono font-bold focus:bg-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                required
              />
            </div>
          </div>

          {/* Current Live Calculations Info */}
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 flex items-center justify-between text-xs font-mono">
            <div>
              <span className="text-slate-400 text-[10px] block">ENTRÉES (F)</span>
              <span className="font-bold text-emerald-700">+{article.entrees || 0}</span>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] block">SORTIES (G)</span>
              <span className="font-bold text-rose-700">-{article.sorties || 0}</span>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] block">ACTUEL (H)</span>
              <span className="font-black text-slate-900 text-sm">{article.stockActuel || 0}</span>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] block">STATUT (J)</span>
              <span className="font-bold">{article.alerte || 'OK'}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition cursor-pointer text-xs"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white font-bold transition shadow-xs cursor-pointer text-xs flex items-center gap-1.5 active:scale-[0.98]"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Enregistrer les Modifications</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
