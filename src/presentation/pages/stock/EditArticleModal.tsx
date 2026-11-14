import { useState, useEffect } from 'react';
import { Package, CheckCircle2, X, MapPin, Boxes } from 'lucide-react';
import CustomSelect from '../../components/common/CustomSelect';
import { getGroupId } from '../../../domain/stock/pdrHierarchyService';

export default function EditArticleModal({
  isOpen,
  onClose,
  article,
  types = [],
  pdrGroups = [],
  onUpdateArticle,
}: any) {
  const [form, setForm] = useState({
    ref: article?.ref || '',
    designation: article?.designation || '',
    id_group: getGroupId(article),
    id_type: article?.id_type || types[0]?.id_type || '',
    unite_mesure: article?.unite_mesure || article?.unite || 'PCS',
    criticite: article?.criticite || 'B',
    ref_constructeur: article?.ref_constructeur || '',
    delai_appro_jours: article?.delai_appro_jours ?? 0,
    domaine_technique: article?.domaine_technique || '',
    code_equivalents: article?.code_equivalents || '',
    stockInitial: article?.stockInitial ?? 0,
    seuil: article?.seuil ?? 5,
    prix_unitaire: article?.prix_unitaire ?? article?.prixUnitaire ?? article?.prix ?? 0,
    emplacement: article?.emplacement || 'R1-B01',
  });

  useEffect(() => {
    if (article) {
      setForm({
        ref: article.ref || '',
        designation: article.designation || '',
        id_group: getGroupId(article),
        id_type: article.id_type || types[0]?.id_type || '',
        unite_mesure: article.unite_mesure || article.unite || 'PCS',
        criticite: article.criticite || 'B',
        ref_constructeur: article.ref_constructeur || '',
        delai_appro_jours: article.delai_appro_jours ?? 0,
        domaine_technique: article.domaine_technique || '',
        code_equivalents: article.code_equivalents || '',
        stockInitial: article.stockInitial ?? 0,
        seuil: article.seuil ?? 5,
        prix_unitaire: article.prix_unitaire ?? article.prixUnitaire ?? article.prix ?? 0,
        emplacement: article.emplacement || 'R1-B01',
      });
    }
  }, [article, types]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !article) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.designation) return;

    const targetId = article.id || article.ref;
    const cleanPrice = Math.max(0, Number(form.prix_unitaire) || 0);
    const canonicalGroupId = form.id_group ? String(form.id_group).trim() : null;
    const cleanLeadTime = Math.max(0, Number(form.delai_appro_jours) || 0);
    onUpdateArticle(targetId, {
      ...article,
      id: targetId,
      designation: form.designation.trim(),
      id_group: canonicalGroupId,
      id_type: form.id_type,
      type: form.id_type,
      unite: form.unite_mesure || 'PCS',
      unite_mesure: form.unite_mesure || 'PCS',
      criticite: form.criticite || 'B',
      ref_constructeur: form.ref_constructeur.trim(),
      delai_appro_jours: cleanLeadTime > 0 ? cleanLeadTime : undefined,
      domaine_technique: form.domaine_technique.trim().toUpperCase() || undefined,
      code_equivalents: form.code_equivalents.trim() || undefined,
      stockInitial: Number(form.stockInitial) || 0,
      seuil: Number(form.seuil) || 0,
      prix_unitaire: cleanPrice,
      prixUnitaire: cleanPrice,
      emplacement: form.emplacement.trim() || 'ATELIER',
    });

    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                <Package className="w-3 h-3 text-indigo-600" />
                <span>Groupe PDR (Niveau 1)</span>
              </label>
              <CustomSelect
                value={form.id_group || 'NONE'}
                onChange={(val) => setForm({ ...form, id_group: val === 'NONE' ? '' : val })}
                options={[
                  { value: 'NONE', label: 'Non classé / Sans groupe' },
                  ...pdrGroups.map((g: any) => ({
                    value: g.id,
                    label: `${g.code} — ${g.libelle}`,
                  })),
                ]}
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                <Boxes className="w-3 h-3 text-amber-600" />
                <span>Type de Pièce (Niveau 2)</span>
              </label>
              <CustomSelect
                value={form.id_type}
                onChange={(val) => setForm({ ...form, id_type: val })}
                options={types.map((t: any) => ({
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

          {/* High-Priority Shopfloor Fields (P2): Unité de Mesure, Criticité A/B/C, Réf Constructeur */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50/80 p-3 rounded-2xl border border-slate-200/80">
            <div>
              <label className="text-[10.5px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                Unité de Mesure *
              </label>
              <select
                value={form.unite_mesure}
                onChange={(e) => setForm({ ...form, unite_mesure: e.target.value })}
                className="w-full h-9 px-2.5 rounded-xl border border-slate-200 bg-white text-xs font-mono font-bold text-slate-900 focus:border-cyan-500 outline-none cursor-pointer"
              >
                <option value="PCS">PCS (Pièce)</option>
                <option value="L">L (Litre - Huile/Fluide)</option>
                <option value="M">M (Mètre - Câble/Tube)</option>
                <option value="KG">KG (Kilogramme - Graisse)</option>
                <option value="KIT">KIT (Pochette/Kit)</option>
                <option value="JEU">JEU (Jeu complet)</option>
                <option value="ROUL">ROUL (Rouleau)</option>
              </select>
            </div>

            <div>
              <label className="text-[10.5px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                Criticité (ABC) *
              </label>
              <select
                value={form.criticite}
                onChange={(e) => setForm({ ...form, criticite: e.target.value })}
                className="w-full h-9 px-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-900 focus:border-cyan-500 outline-none cursor-pointer"
              >
                <option value="A">Classe A — Vital / Critique</option>
                <option value="B">Classe B — Important</option>
                <option value="C">Classe C — Standard / Courant</option>
              </select>
            </div>

            <div>
              <label className="text-[10.5px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                Réf. Constructeur / OEM
              </label>
              <input
                type="text"
                placeholder="ex: SKF 6205-2RS"
                value={form.ref_constructeur}
                onChange={(e) => setForm({ ...form, ref_constructeur: e.target.value })}
                className="w-full h-9 px-2.5 rounded-xl border border-slate-200 bg-white text-xs font-mono text-slate-800 focus:border-cyan-500 outline-none"
              />
            </div>
          </div>

          {/* Medium-Priority Shopfloor Fields (P3): Domaine Technique, Délai Appro, Codes Équivalents */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-cyan-50/40 p-3 rounded-2xl border border-cyan-100">
            <div>
              <label className="text-[10.5px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                Domaine Technique
              </label>
              <select
                value={form.domaine_technique}
                onChange={(e) => setForm({ ...form, domaine_technique: e.target.value })}
                className="w-full h-9 px-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-900 focus:border-cyan-500 outline-none cursor-pointer"
              >
                <option value="">— Hérité du Groupe/Type —</option>
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
              <label className="text-[10.5px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                Délai Appro. (Jours)
              </label>
              <input
                type="number"
                min="0"
                placeholder="ex: 7"
                value={form.delai_appro_jours}
                onChange={(e) =>
                  setForm({
                    ...form,
                    delai_appro_jours: Math.max(0, parseInt(e.target.value, 10) || 0),
                  })
                }
                className="w-full h-9 px-2.5 rounded-xl border border-slate-200 bg-white text-xs font-mono font-bold text-slate-800 focus:border-cyan-500 outline-none"
              />
            </div>

            <div>
              <label className="text-[10.5px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                Codes Équivalents (;)
              </label>
              <input
                type="text"
                placeholder="ex: FAG 6205-2RSR; NSK 6205DDU"
                value={form.code_equivalents}
                onChange={(e) => setForm({ ...form, code_equivalents: e.target.value })}
                className="w-full h-9 px-2.5 rounded-xl border border-slate-200 bg-white text-xs font-mono text-slate-800 focus:border-cyan-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3.5">
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

            <div>
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                Prix Unitaire (MAD)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.prix_unitaire}
                onChange={(e) => setForm({ ...form, prix_unitaire: parseFloat(e.target.value) || 0 })}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono font-bold text-emerald-700 focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Policy Tag Display (PDR Catalog: strictly REPLACING standard) */}
          <div className="bg-sky-50/70 p-3 rounded-2xl border border-sky-200/80 flex items-center justify-between text-xs">
            <div>
              <span className="text-sky-900 font-bold block text-[11px] uppercase tracking-wider">
                Politique Pièce Catalogue (POLICY-TAGS)
              </span>
              <span className="text-[10.5px] text-sky-700">
                PDR Standard Catalogue : Remplacement neuf nominal (STOCK / ACHAT)
              </span>
            </div>
            <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-sky-200 text-sky-900 border border-sky-300">
              REPLACING
            </span>
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
