import type { Dispatch, SetStateAction } from 'react';
import { Package, Plus, Trash2 } from 'lucide-react';
import type {
  LiveInterventionFormState,
  LivePieceUsedItem,
  LiveRankedStockItem,
} from '../hooks/useInterventionLiveController';

interface InterventionLivePdrStepProps {
  formState: LiveInterventionFormState;
  setFormState: Dispatch<SetStateAction<LiveInterventionFormState>>;
  pdrSearch: string;
  setPdrSearch: Dispatch<SetStateAction<string>>;
  showPdrList: boolean;
  setShowPdrList: Dispatch<SetStateAction<boolean>>;
  matchedStockItems: LiveRankedStockItem[];
  handleSelectPdr: (item: LiveRankedStockItem) => void;
  handleAddPieceToList: () => void;
  handleRemovePieceFromList: (refToRemove: string) => void;
}

export function InterventionLivePdrStep({
  formState,
  setFormState,
  pdrSearch,
  setPdrSearch,
  showPdrList,
  setShowPdrList,
  matchedStockItems,
  handleSelectPdr,
  handleAddPieceToList,
  handleRemovePieceFromList,
}: InterventionLivePdrStepProps) {
  return (
    <div className="p-4 rounded-2xl bg-cyan-50/50 border border-cyan-200/80 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-black uppercase tracking-wider text-cyan-950 flex items-center gap-1.5">
          <Package className="w-4 h-4 text-cyan-700" />
          Pièce de Rechange Utilisée (Col L) & Sortie Magasin
        </span>
        <span className="text-[10px] font-mono text-cyan-800 bg-cyan-100 px-2 py-0.5 rounded-full font-bold">
          Liaison Stock_Actuel
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Search PDR in Stock */}
        <div className="relative sm:col-span-2">
          <label className="block text-[10.5px] font-bold text-slate-600 uppercase mb-1">
            Rechercher Article PDR au Magasin
          </label>
          <input
            type="text"
            value={pdrSearch}
            onChange={(e) => {
              setPdrSearch(e.target.value);
              setShowPdrList(true);
            }}
            onFocus={() => setShowPdrList(true)}
            placeholder="Ex: ROULEMENT, COURROIE, CAPTEUR..."
            className="w-full py-2 px-3 text-xs font-medium rounded-xl border border-cyan-200 bg-white focus:border-cyan-400 focus:outline-hidden transition"
          />

          {showPdrList && matchedStockItems.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 z-40 bg-white rounded-2xl border border-cyan-200 shadow-xl max-h-48 overflow-y-auto p-2 space-y-1">
              {matchedStockItems.map((item) => {
                const itemRef = String(item.ref || item.code_article || '');
                const itemDesig = String(item.designation || item.nom || '');
                const dispo = Number(item.stockActuel ?? item.stock_actuel ?? item.quantite ?? 0);
                return (
                  <div
                    key={itemRef}
                    onClick={() => handleSelectPdr(item)}
                    className="p-2 text-xs rounded-lg hover:bg-cyan-50 text-slate-800 cursor-pointer font-medium transition flex items-center justify-between"
                  >
                    <div className="min-w-0 pr-2 flex items-center gap-1.5 flex-wrap">
                      {item.isBomRecommended && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-mono font-bold text-[10px] shrink-0">
                          ★ {item.bomSourceLabel || 'BOM'}
                        </span>
                      )}
                      <span className="font-mono font-bold text-cyan-900">{itemRef}</span>
                      <span className="text-slate-600 truncate">{itemDesig}</span>
                    </div>
                    <span
                      className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded border shrink-0 ${
                        dispo > 0
                          ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                          : 'text-rose-700 bg-rose-50 border-rose-200'
                      }`}
                    >
                      Dispo: {dispo}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Real-time Selected PDR Confirmation & Stock Badge */}
          {formState.pdr_ref && (
            <div className="mt-2 p-2.5 rounded-xl bg-cyan-50/70 border border-cyan-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-cyan-950 bg-white px-2 py-0.5 rounded border border-cyan-300">
                  {formState.pdr_ref}
                </span>
                <span className="font-semibold text-slate-800 truncate">
                  {formState.pdr_designation}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={`font-mono font-bold text-[11px] px-2 py-0.5 rounded border ${
                    Number(formState.pdr_quantite) > Number(formState.pdr_stock_actuel)
                      ? 'bg-amber-100 text-amber-900 border-amber-300'
                      : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                  }`}
                >
                  Stock: {formState.pdr_stock_actuel ?? 0}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setFormState((prev) => ({
                      ...prev,
                      pdr_ref: '',
                      pdr_designation: '',
                      pdr_stock_actuel: undefined,
                    }));
                    setPdrSearch('');
                  }}
                  className="text-[11px] text-slate-400 hover:text-rose-600 font-bold underline cursor-pointer"
                >
                  Effacer
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Quantité Sortie + Bouton Ajouter Multi-PDR */}
        <div>
          <label className="block text-[10.5px] font-bold text-slate-600 uppercase mb-1">
            Quantité Utilisée
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              value={formState.pdr_quantite}
              onChange={(e) => setFormState({ ...formState, pdr_quantite: Number(e.target.value) })}
              className="w-full py-2 px-3 text-xs font-mono font-bold rounded-xl border border-cyan-200 bg-white focus:border-cyan-400 focus:outline-hidden"
            />
            <button
              type="button"
              onClick={handleAddPieceToList}
              disabled={!formState.pdr_ref}
              title="Ajouter cette pièce à la liste multi-PDR du Bon de Travail"
              className="px-3 py-2 rounded-xl bg-cyan-700 hover:bg-cyan-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs transition cursor-pointer shrink-0 inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Ajouter</span>
            </button>
          </div>
        </div>
      </div>

      {/* Multi-PDR Consumed List (pieces_utilisees) */}
      {Array.isArray(formState.pieces_utilisees) && formState.pieces_utilisees.length > 0 && (
        <div className="p-3 rounded-xl bg-white/90 border border-cyan-200 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold text-cyan-950">
            <span>
              Pièces sélectionnées pour sortie magasin ({formState.pieces_utilisees.length}) :
            </span>
            <span className="font-mono text-cyan-700">
              Total Qte:{' '}
              {formState.pieces_utilisees.reduce(
                (s: number, p: LivePieceUsedItem) => s + Number(p.quantite || 0),
                0
              )}
            </span>
          </div>
          <div className="space-y-1.5">
            {formState.pieces_utilisees.map((piece: LivePieceUsedItem) => (
              <div
                key={piece.ref}
                className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-cyan-50/70 border border-cyan-200/80 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono font-bold text-cyan-950 bg-white px-2 py-0.5 rounded border border-cyan-300">
                    {piece.ref}
                  </span>
                  <span className="font-medium text-slate-700 truncate">{piece.designation}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono font-black text-cyan-900 bg-cyan-100 px-2 py-0.5 rounded">
                    × {piece.quantite} {String(piece.unite || piece.unit || 'Pièce')}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemovePieceFromList(piece.ref)}
                    className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer transition"
                    title="Retirer de la liste"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
        <div>
          <label className="block text-[10.5px] font-bold text-slate-600 uppercase mb-1">
            Marque de la Pièce (Col M)
          </label>
          <input
            type="text"
            value={formState.marque}
            onChange={(e) => setFormState({ ...formState, marque: e.target.value })}
            placeholder="Ex: SKF, Schneider, Festo, Omron..."
            className="w-full py-2 px-3 text-xs font-medium rounded-xl border border-cyan-200 bg-white focus:border-cyan-400 focus:outline-hidden"
          />
        </div>

        <div>
          <label className="block text-[10.5px] font-bold text-slate-600 uppercase mb-1">
            État Pièce (Col N)
          </label>
          <select
            value={formState.etat_piece}
            onChange={(e) => setFormState({ ...formState, etat_piece: e.target.value })}
            className="w-full py-2 px-3 text-xs font-medium rounded-xl border border-cyan-200 bg-white focus:border-cyan-400 focus:outline-hidden"
          >
            <option value="Neuve">Neuve (Neuf usine)</option>
            <option value="Occasion">Occasion (Reconditionnée)</option>
            <option value="Réparée">Réparée sur place</option>
          </select>
        </div>

        <div>
          <label className="block text-[10.5px] font-bold text-slate-600 uppercase mb-1">
            N° Bon Magasin (Optionnel · Terrain)
          </label>
          <input
            type="text"
            value={formState.num_bon_saisi_par_tech || ''}
            onChange={(e) => setFormState({ ...formState, num_bon_saisi_par_tech: e.target.value })}
            placeholder="Ex: BS-2026-0412 (pour contrôle)"
            className="w-full py-2 px-3 text-xs font-mono font-medium rounded-xl border border-cyan-200 bg-white focus:border-cyan-400 focus:outline-hidden"
          />
        </div>
      </div>
    </div>
  );
}
