import React from 'react';
import {
  Boxes,
  Plus,
  Search,
  Tag,
  Trash2,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  ShoppingCart,
  Scale,
} from 'lucide-react';

export interface MovementFormSummary {
  type: string;
}

export interface MovementArticleLine {
  source?: string;
  ref: string;
  designation: string;
  quantite: number | string;
  unit?: string;
  emplacement?: string;
}

export interface MovementCatalogItem {
  ref: string;
  designation?: string;
  stockActuel?: number;
  emplacement?: string;
  raw?: {
    stockActuel?: number;
    stockInitial?: number;
    seuil?: number;
  };
}

export interface MovementArticlesSectionProps {
  form: MovementFormSummary;
  mouvementItems: MovementArticleLine[];
  unifiedSearchCatalog: MovementCatalogItem[];
  getExternalReservedQtyForRef: (rawRef: unknown) => number;
  handleAddItem: () => void;
  handleRemoveItem: (idx: number) => void;
  handleUpdateItem: (idx: number, field: keyof MovementArticleLine | string, value: string | number) => void;
  onOpenItemCatalog: (idx: number, source?: string) => void;
}

/**
 * Multi-article selector and Soft-Lock net balance preview (`netDispo = stockActuel - externalReserved`).
 * Prevents blind over-allocation against pending Maker-Checker claims without mutating `rawStock`.
 */
export const MovementArticlesSection: React.FC<MovementArticlesSectionProps> = ({
  form,
  mouvementItems,
  unifiedSearchCatalog,
  getExternalReservedQtyForRef,
  handleAddItem,
  handleRemoveItem,
  handleUpdateItem,
  onOpenItemCatalog,
}) => {
  const isSortie = form.type.includes('Sortie') || form.type === 'Bon de Sortie';
  const isEntree = form.type.includes('Entrée');
  const isCmd = form.type === 'COMMANDE';

  return (
    <div className="space-y-3">
      {/* 5. MULTI-ARTICLES SECTION - EXCEL LIGHT UI PDR */}
      <div className="space-y-3 pt-3 border-t border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
              <Boxes className="w-3.5 h-3.5" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                <span>Articles &amp; Pièces de Rechange (PDR)</span>
                <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                  {mouvementItems.length}/5
                </span>
              </label>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono font-bold bg-slate-50 text-slate-700 px-2 py-1 rounded-lg border border-slate-200">
              Total: {mouvementItems.reduce((sum, it) => sum + (parseFloat(String(it.quantite)) || 0), 0)}{' '}
              {mouvementItems[0]?.unit || 'pcs'}
            </span>
            <button
              type="button"
              onClick={handleAddItem}
              disabled={mouvementItems.length >= 5}
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer bg-emerald-50 hover:bg-emerald-100/80 px-2.5 py-1 rounded-lg border border-emerald-200 transition shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Ajouter une pièce</span>
            </button>
          </div>
        </div>

        <div className="space-y-2.5">
          {mouvementItems.map((item, idx) => {
            const match = unifiedSearchCatalog.find((c) => c.ref === item.ref);
            const stockDispo = match
              ? (match.stockActuel ?? match.raw?.stockActuel ?? match.raw?.stockInitial ?? 0)
              : 0;
            const externalReserved = getExternalReservedQtyForRef(item.ref);
            const netDispo = stockDispo - externalReserved;
            const seuilMin = match?.raw?.seuil ?? 5;
            const qteVal = parseFloat(String(item.quantite)) || 0;

            // Dynamic Math Formulas (Excel Twin Simulation with Soft-Lock Awareness)
            const nouveauSolde = isSortie
              ? netDispo - qteVal
              : isEntree || isCmd
                ? stockDispo + qteVal
                : stockDispo;

            const isDeficit = isSortie && (qteVal > stockDispo || qteVal > netDispo);
            const deficitAmount = isDeficit ? qteVal - Math.max(0, netDispo) : 0;
            const isSeuilAlert = isSortie && !isDeficit && nouveauSolde <= seuilMin && nouveauSolde >= 0;
            const isStockOk = isSortie && !isDeficit && nouveauSolde > seuilMin;
            const isZeroQte = qteVal <= 0;

            return (
              <div
                key={`item-line-${idx}`}
                className={`p-3 rounded-xl border bg-white transition shadow-2xs space-y-2.5 ${
                  isDeficit
                    ? 'border-rose-300 ring-1 ring-rose-200'
                    : isSeuilAlert
                      ? 'border-amber-300'
                      : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Top Bar: Ligne ID + Catalog Picker + Delete */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 font-mono text-[11px] font-bold text-slate-700">
                      Ligne {idx + 1}
                    </span>
                  </div>

                  {/* Search / Select in catalog button */}
                  <button
                    type="button"
                    onClick={() => onOpenItemCatalog(idx, item.source || 'ALL')}
                    className="flex-1 py-1.5 px-3 rounded-lg bg-slate-50/90 hover:bg-slate-100 border border-slate-200 hover:border-emerald-500 text-left font-mono text-slate-800 flex items-center justify-between transition cursor-pointer shadow-2xs group"
                    title="Cliquer pour rechercher ou changer la pièce"
                  >
                    <span className="truncate text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{item.ref || 'Sélectionner une pièce dans le catalogue...'}</span>
                    </span>
                    <span className="text-[11px] text-indigo-700 group-hover:text-indigo-800 font-sans font-bold flex items-center gap-1 shrink-0 ml-1.5 bg-white px-2 py-0.5 rounded border border-slate-200">
                      <Search className="w-3 h-3 text-indigo-600" />
                      <span>
                        {item.source === 'STOCK_PDR'
                          ? 'Catalogue PDR'
                          : item.source === 'WAREHOUSE_PARTIE'
                            ? 'Catalogue Parties'
                            : item.source === 'WAREHOUSE_COMPOSANT'
                              ? 'Catalogue Composants'
                              : 'Catalogue'}
                      </span>
                    </span>
                  </button>

                  {mouvementItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition cursor-pointer shrink-0"
                      title="Supprimer cette ligne"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Fields Row: Designation & Quantity */}
                <div className="grid grid-cols-12 gap-2.5 items-start">
                  <div className="col-span-7">
                    <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide block mb-1">
                      Désignation de la pièce
                    </label>
                    <input
                      type="text"
                      placeholder="Sélectionnez un article..."
                      value={item.designation}
                      readOnly
                      className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-medium text-slate-600 focus:outline-none cursor-not-allowed select-none"
                    />
                  </div>

                  <div className="col-span-5">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                        Quantité ({item.unit || 'pcs'})
                      </label>
                      {isSortie && stockDispo > 0 && (
                        <span className="text-[9.5px] text-slate-500 font-mono">
                          Dispo: <b className="text-slate-800">{stockDispo}</b>
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="0.1"
                        step="any"
                        value={item.quantite}
                        onChange={(e) => handleUpdateItem(idx, 'quantite', e.target.value)}
                        className={`w-full h-8 px-2.5 rounded-lg border font-mono font-bold text-xs text-right focus:outline-none ${
                          isDeficit
                            ? 'border-rose-400 bg-rose-50/50 text-rose-800'
                            : isZeroQte
                              ? 'border-amber-400 bg-amber-50/50 text-amber-900'
                              : 'border-slate-200 bg-white text-slate-900 focus:border-emerald-500'
                        }`}
                        required
                      />
                      <span className="text-xs text-slate-500 font-mono font-medium shrink-0 px-1.5 py-1 bg-slate-50 rounded border border-slate-200">
                        {item.unit || 'pcs'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick Adjust Buttons (+1, +5, Max, Reset) */}
                <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-slate-100 text-[10.5px]">
                  <div className="flex items-center gap-1">
                    <span className="text-slate-400 text-[10px] font-medium mr-0.5">Ajuster:</span>
                    <button
                      type="button"
                      onClick={() => handleUpdateItem(idx, 'quantite', Math.max(1, qteVal - 1))}
                      className="px-2 py-0.5 rounded-md bg-slate-50 hover:bg-slate-100 text-slate-700 font-mono font-bold border border-slate-200 cursor-pointer shadow-2xs"
                    >
                      -1
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateItem(idx, 'quantite', qteVal + 1)}
                      className="px-2 py-0.5 rounded-md bg-slate-50 hover:bg-slate-100 text-slate-700 font-mono font-bold border border-slate-200 cursor-pointer shadow-2xs"
                    >
                      +1
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateItem(idx, 'quantite', qteVal + 5)}
                      className="px-2 py-0.5 rounded-md bg-slate-50 hover:bg-slate-100 text-slate-700 font-mono font-bold border border-slate-200 cursor-pointer shadow-2xs"
                    >
                      +5
                    </button>
                    {isSortie && stockDispo > 0 && (
                      <button
                        type="button"
                        onClick={() => handleUpdateItem(idx, 'quantite', stockDispo)}
                        className="px-2 py-0.5 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-mono font-bold border border-emerald-200 cursor-pointer shadow-2xs"
                        title="Prendre tout le stock disponible"
                      >
                        Max ({stockDispo})
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleUpdateItem(idx, 'quantite', 1)}
                      className="px-2 py-0.5 rounded-md bg-slate-50 hover:bg-slate-100 text-slate-500 font-mono border border-slate-200 cursor-pointer shadow-2xs"
                      title="Réinitialiser à 1"
                    >
                      1
                    </button>
                  </div>

                  {match && (
                    <div className="text-[11px] text-slate-500 font-mono">
                      Emplacement :{' '}
                      <b className="text-slate-800 font-semibold bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                        {match.emplacement || '-'}
                      </b>
                    </div>
                  )}
                </div>

                {/* Real-time Excel Formula & Stock Simulation Bar */}
                {match && (
                  <div className="pt-1.5 border-t border-slate-100">
                    <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-lg bg-slate-50/80 border border-slate-200 text-xs">
                      {isSortie ? (
                        <div className="flex items-center gap-1.5 font-mono text-[11px] flex-wrap">
                          <span className="text-slate-500 text-[10px] uppercase font-sans font-bold">
                            Stock Actuel:
                          </span>
                          <span className="font-bold text-slate-800 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                            {stockDispo}
                          </span>
                          {externalReserved > 0 && (
                            <>
                              <span className="font-bold text-amber-600">−</span>
                              <span className="text-amber-700 text-[10px] uppercase font-sans font-bold">
                                Réservé:
                              </span>
                              <span
                                data-testid={`soft-lock-reserved-${item.ref}`}
                                className="font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200"
                              >
                                {externalReserved}
                              </span>
                            </>
                          )}
                          <span className="font-bold text-rose-600">−</span>
                          <span className="text-slate-500 text-[10px] uppercase font-sans font-bold">
                            Sortie:
                          </span>
                          <span className="font-bold text-rose-700 bg-white px-1.5 py-0.5 rounded border border-rose-200">
                            {qteVal}
                          </span>
                          <span className="font-bold text-slate-400">=</span>
                          <span className="text-slate-500 text-[10px] uppercase font-sans font-bold">
                            Solde Prévu:
                          </span>
                          <span
                            className={`font-bold px-2 py-0.5 rounded border ${
                              isDeficit
                                ? 'bg-rose-50 text-rose-800 border-rose-200'
                                : isSeuilAlert
                                  ? 'bg-amber-50 text-amber-900 border-amber-200'
                                  : 'bg-emerald-50 text-emerald-900 border-emerald-200'
                            }`}
                          >
                            {nouveauSolde} {item.unit || 'pcs'}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 font-mono text-[11px] flex-wrap">
                          <span className="text-slate-500 text-[10px] uppercase font-sans font-bold">
                            Stock Actuel:
                          </span>
                          <span className="font-bold text-slate-800 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                            {stockDispo}
                          </span>
                          <span className="font-bold text-emerald-600">+</span>
                          <span className="text-slate-500 text-[10px] uppercase font-sans font-bold">
                            Entrée:
                          </span>
                          <span className="font-bold text-emerald-700 bg-white px-1.5 py-0.5 rounded border border-emerald-200">
                            {qteVal}
                          </span>
                          <span className="font-bold text-slate-400">=</span>
                          <span className="text-slate-500 text-[10px] uppercase font-sans font-bold">
                            Nouveau Stock:
                          </span>
                          <span className="font-bold px-2 py-0.5 rounded border border-emerald-200 bg-emerald-50 text-emerald-900">
                            {nouveauSolde} {item.unit || 'pcs'}
                          </span>
                        </div>
                      )}

                      {/* Status Badge */}
                      <div>
                        {isDeficit && (
                          <span className="inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-200">
                            <AlertCircle className="w-3 h-3 shrink-0 text-rose-600" />
                            <span>
                              Déficit: -{deficitAmount} {item.unit || 'pcs'}
                            </span>
                          </span>
                        )}
                        {isSeuilAlert && (
                          <span className="inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-200">
                            <AlertTriangle className="w-3 h-3 shrink-0 text-amber-600" />
                            <span>Alerte Seuil (≤ {seuilMin})</span>
                          </span>
                        )}
                        {isStockOk && (
                          <span className="inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 shrink-0 text-emerald-600" />
                            <span>Stock Conforme</span>
                          </span>
                        )}
                        {isEntree && (
                          <span className="inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-900 border border-blue-200">
                            <TrendingUp className="w-3 h-3 shrink-0 text-blue-600" />
                            <span>Réappro (+{qteVal})</span>
                          </span>
                        )}
                        {isCmd && (
                          <span className="inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-200">
                            <ShoppingCart className="w-3 h-3 shrink-0 text-amber-600" />
                            <span>Commande ({qteVal} pcs)</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* GLOBAL MULTI-ITEMS SUMMARY & VERIFICATION - EXCEL LIGHT STYLE */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-emerald-600" />
              <span className="font-bold uppercase tracking-wider text-[11px] text-slate-800">
                Bilan &amp; Contrôle du Bon
              </span>
            </div>
            <div className="flex items-center gap-2 font-mono">
              <span className="text-[11px] text-slate-600">
                Lignes : <b className="text-slate-900">{mouvementItems.length}</b>
              </span>
              <span className="text-[11px] text-slate-300">•</span>
              <span className="text-[11px] text-slate-600">
                Quantité Totale :{' '}
                <b className="text-emerald-700 font-bold">
                  {mouvementItems.reduce((acc, i) => acc + (parseFloat(String(i.quantite)) || 0), 0)} pcs
                </b>
              </span>
            </div>
          </div>

          {/* Validation Status Indicator */}
          {(() => {
            const invalidQte = mouvementItems.some((i) => !i.quantite || parseFloat(String(i.quantite)) <= 0);
            const emptyRef = mouvementItems.some((i) => !i.ref || String(i.ref).trim() === '');
            const deficitItems = isSortie
              ? mouvementItems.filter((i) => {
                  const m = unifiedSearchCatalog.find((c) => c.ref === i.ref);
                  const st = m ? (m.stockActuel ?? m.raw?.stockActuel ?? m.raw?.stockInitial ?? 0) : 0;
                  const net = st - getExternalReservedQtyForRef(i.ref);
                  const qte = parseFloat(String(i.quantite)) || 0;
                  return qte > st || qte > net;
                })
              : [];

            if (emptyRef) {
              return (
                <div className="flex items-center gap-2 text-xs text-amber-900 bg-amber-50 p-2 rounded-lg border border-amber-200">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>Veuillez sélectionner une référence pour toutes les lignes d&apos;articles.</span>
                </div>
              );
            }

            if (invalidQte) {
              return (
                <div className="flex items-center gap-2 text-xs text-rose-900 bg-rose-50 p-2 rounded-lg border border-rose-200">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>Quantité invalide détectée : chaque article doit avoir une quantité supérieure à 0.</span>
                </div>
              );
            }

            if (deficitItems.length > 0) {
              return (
                <div className="flex items-center justify-between text-xs text-rose-900 bg-rose-50 p-2 rounded-lg border border-rose-200">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>
                      <b>{deficitItems.length} article(s) en déficit</b> par rapport au stock disponible net.
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-bold bg-rose-100 text-rose-800 px-2 py-0.5 rounded border border-rose-300">
                    Avertissement
                  </span>
                </div>
              );
            }

            return (
              <div className="flex items-center justify-between text-xs text-emerald-900 bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>Tous les articles sont conformes et prêts pour l&apos;enregistrement.</span>
                </div>
                <span className="text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded border border-emerald-300">
                  Prêt à Valider
                </span>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
};
