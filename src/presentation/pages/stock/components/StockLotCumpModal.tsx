import React, { useState, useMemo } from 'react';
import {
  Boxes,
  Calculator,
  Calendar,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Plus,
  ArrowRight,
  X,
  TrendingUp,
  Layers,
} from 'lucide-react';
import type { IMouvement, IStockItem } from '../../../../types/domain';
import {
  computeDynamicCump,
  buildItemLotsAndBins,
  allocateStockSortieFifoFefo,
} from '../../../../domain/stock/stockLotValuationService';

interface StockLotCumpModalProps {
  stockItems: IStockItem[];
  mouvements: IMouvement[];
  initialRef?: string;
  onAddMouvement?: (mvt: Partial<IMouvement>) => void;
  onClose: () => void;
}

export default function StockLotCumpModal({
  stockItems = [],
  mouvements = [],
  initialRef,
  onAddMouvement,
  onClose,
}: StockLotCumpModalProps) {
  const [selectedRef, setSelectedRef] = useState<string>(
    initialRef || String(stockItems[0]?.ref || '')
  );
  const [pickQty, setPickQty] = useState<number>(1);
  const [pickStrategy, setPickStrategy] = useState<'FEFO' | 'FIFO'>('FEFO');

  // New Lot Reception Form
  const [newLotNumber, setNewLotNumber] = useState<string>(
    `LOT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-01`
  );
  const [newBinCode, setNewBinCode] = useState<string>('MAG-A1-R2');
  const [newExpiryDate, setNewExpiryDate] = useState<string>('');
  const [newLotQty, setNewLotQty] = useState<number>(5);
  const [newLotPrice, setNewLotPrice] = useState<number>(45);
  const [feedbackMsg, setFeedbackMsg] = useState<string>('');

  const selectedItem = useMemo(
    () =>
      stockItems.find(
        (s) => String(s.ref || '').trim().toUpperCase() === selectedRef.trim().toUpperCase()
      ) || stockItems[0] || null,
    [stockItems, selectedRef]
  );

  // Global CUMP & Expiry Summary across all stock items
  const globalValuation = useMemo(() => {
    let totalValueCump = 0;
    let totalExpiredUnits = 0;
    let totalExpiringSoonUnits = 0;
    let multiBinSkuCount = 0;

    for (const item of stockItems) {
      const cumpRes = computeDynamicCump(item, mouvements);
      totalValueCump += cumpRes.totalValuationValue;
      const lotInfo = buildItemLotsAndBins(item, mouvements);
      totalExpiredUnits += lotInfo.expiredQty;
      totalExpiringSoonUnits += lotInfo.expiringSoonQty;
      if (lotInfo.bins.length > 1) {
        multiBinSkuCount += 1;
      }
    }

    return {
      totalValueCump: Number(totalValueCump.toFixed(2)),
      totalExpiredUnits,
      totalExpiringSoonUnits,
      multiBinSkuCount,
    };
  }, [stockItems, mouvements]);

  const itemCump = useMemo(
    () => (selectedItem ? computeDynamicCump(selectedItem, mouvements) : null),
    [selectedItem, mouvements]
  );

  const itemLotsAndBins = useMemo(
    () =>
      selectedItem
        ? buildItemLotsAndBins(selectedItem, mouvements)
        : { lots: [], bins: [], expiredQty: 0, expiringSoonQty: 0 },
    [selectedItem, mouvements]
  );

  const pickingPlan = useMemo(
    () =>
      allocateStockSortieFifoFefo(
        itemLotsAndBins.lots,
        Math.max(1, Number(pickQty) || 1),
        pickStrategy
      ),
    [itemLotsAndBins.lots, pickQty, pickStrategy]
  );

  const handleReceiveNewLot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !onAddMouvement) return;
    const qty = Math.max(1, Number(newLotQty) || 1);
    const price = Math.max(0, Number(newLotPrice) || 0);
    const today = new Date().toISOString().slice(0, 10);

    onAddMouvement({
      code_bon: `BR-LOT-${Date.now().toString().slice(-5)}`,
      date: today,
      type: 'Entrée',
      action_id: 'REAPPRO',
      ref: selectedItem.ref,
      designation: selectedItem.designation,
      quantite: qty,
      prix_unitaire: price,
      lot_number: newLotNumber.trim() || `LOT-${today}`,
      emplacement_reception: newBinCode.trim() || selectedItem.emplacement || 'MAG-A1',
      ...(newExpiryDate.trim() ? { date_peremption: newExpiryDate.trim() } : {}),
      commentaire: `Réception Lot ${newLotNumber.trim()} (${newBinCode.trim()}) @ ${price.toFixed(2)}`,
    });

    setFeedbackMsg(
      `Lot ${newLotNumber} réceptionné (+${qty} u. dans ${newBinCode}) — CUMP recalculé automatiquement.`
    );
    setTimeout(() => setFeedbackMsg(''), 4000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-xs animate-in fade-in duration-150"
      data-testid="stock-lot-cump-modal"
    >
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/40 text-indigo-300 flex items-center justify-center">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight">
                Multi-Emplacements (Multi-Bin), Lots & Péremption (FEFO/FIFO) & Valorisation CUMP
              </h3>
              <p className="text-xs text-slate-300">
                Traçabilité des lots, quarantaine automatique des lots périmés et Coût Unitaire Moyen Pondéré (CUMP)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          {/* Global KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200">
              <span className="text-[10px] font-bold uppercase text-indigo-700 block">
                Valorisation Totale (CUMP)
              </span>
              <span className="text-lg font-black font-mono text-indigo-950">
                {globalValuation.totalValueCump.toLocaleString('fr-FR', {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
            <div className="p-3.5 rounded-2xl bg-cyan-50 border border-cyan-200">
              <span className="text-[10px] font-bold uppercase text-cyan-700 block">
                Articles Multi-Emplacements
              </span>
              <span className="text-lg font-black font-mono text-cyan-950">
                {globalValuation.multiBinSkuCount} réf(s)
              </span>
            </div>
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200">
              <span className="text-[10px] font-bold uppercase text-amber-800 block">
                Lots Proches Péremption (≤30j)
              </span>
              <span className="text-lg font-black font-mono text-amber-950">
                {globalValuation.totalExpiringSoonUnits} u.
              </span>
            </div>
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200">
              <span className="text-[10px] font-bold uppercase text-rose-800 block">
                Lots Périmés (Quarantaine FEFO)
              </span>
              <span className="text-lg font-black font-mono text-rose-950">
                {globalValuation.totalExpiredUnits} u.
              </span>
            </div>
          </div>

          {/* SKU Selector & CUMP Card */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <label className="block text-[11px] font-black uppercase text-slate-700">
                Article PDR analysé
              </label>
              <select
                value={selectedItem?.ref || ''}
                onChange={(e) => setSelectedRef(e.target.value)}
                className="w-full py-2 px-3 rounded-xl border border-slate-300 bg-white font-bold text-slate-900 text-xs"
              >
                {stockItems.map((it) => (
                  <option key={it.ref} value={it.ref}>
                    {it.ref} — {it.designation} (Stock: {it.stockActuel ?? it.stockInitial ?? 0})
                  </option>
                ))}
              </select>

              {itemCump && (
                <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-semibold">Prix Initial :</span>
                    <span className="font-mono font-bold text-slate-800">
                      {itemCump.initialPrice.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-semibold">Dernier Prix Achat :</span>
                    <span className="font-mono font-bold text-slate-800">
                      {itemCump.lastPurchasePrice.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1.5 border-t border-slate-100">
                    <span className="text-indigo-900 font-black flex items-center gap-1">
                      <Calculator className="w-3.5 h-3.5 text-indigo-600" />
                      CUMP Actuel :
                    </span>
                    <span className="font-mono font-black text-sm text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                      {itemCump.cump.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-semibold">Valeur Stock ({itemCump.stockActuel} u.) :</span>
                    <span className="font-mono font-black text-emerald-700">
                      {itemCump.totalValuationValue.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              {/* Multi-Bin Distribution */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-cyan-600" />
                  Répartition Multi-Emplacements (Bins)
                </span>
                <div className="space-y-1">
                  {itemLotsAndBins.bins.map((b) => (
                    <div
                      key={b.binCode}
                      className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between"
                    >
                      <span className="font-mono font-bold text-slate-800">
                        {b.binCode}{' '}
                        {b.isPrimary && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-50 text-cyan-800 border border-cyan-200 ml-1">
                            Principal
                          </span>
                        )}
                      </span>
                      <span className="font-mono font-black text-slate-900">{b.quantite} u.</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Lots Table & Reception Form */}
            <div className="lg:col-span-2 space-y-4">
              <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-slate-900 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    <span>Lots Actifs & Dates de Péremption ({itemLotsAndBins.lots.length})</span>
                  </h4>
                  <span className="text-[10px] font-mono text-slate-500">
                    Formule CUMP = (Stock_avant × CUMP_avant + Qté_in × Prix_in) / Nouveau_Stock
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-[10px] uppercase text-slate-500">
                        <th className="py-2 px-2">N° Lot</th>
                        <th className="py-2 px-2">Bin / Emplacement</th>
                        <th className="py-2 px-2">Réception</th>
                        <th className="py-2 px-2">Péremption</th>
                        <th className="py-2 px-2 text-right">Qté Restante</th>
                        <th className="py-2 px-2 text-right">Prix Unitaire</th>
                        <th className="py-2 px-2 text-center">Statut Lot</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {itemLotsAndBins.lots.map((lot) => (
                        <tr key={lot.lotNumber} className="hover:bg-slate-50">
                          <td className="py-2 px-2 font-mono font-bold text-slate-900">
                            {lot.lotNumber}
                          </td>
                          <td className="py-2 px-2 font-mono text-slate-700">{lot.binCode}</td>
                          <td className="py-2 px-2 font-mono text-slate-600">{lot.receptionDate}</td>
                          <td className="py-2 px-2 font-mono text-slate-600">
                            {lot.expiryDate || 'Sans péremption'}
                          </td>
                          <td className="py-2 px-2 text-right font-mono font-black text-slate-900">
                            {lot.remainingQty} / {lot.initialQty}
                          </td>
                          <td className="py-2 px-2 text-right font-mono text-slate-700">
                            {lot.unitPrice.toFixed(2)}
                          </td>
                          <td className="py-2 px-2 text-center">
                            {lot.expiryStatus === 'EXPIRED' ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                Périmé (Quarantaine)
                              </span>
                            ) : lot.expiryStatus === 'EXPIRING_SOON' ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                                Expire sous {lot.daysUntilExpiry}j
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                Conforme
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Simulator: Picking FIFO / FEFO */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-black text-slate-900 flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                    <span>Plan de Prélèvement Automatique (Picking {pickStrategy})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPickStrategy('FEFO')}
                      className={`px-2.5 py-1 rounded-lg font-bold text-[11px] cursor-pointer ${
                        pickStrategy === 'FEFO'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-white text-slate-700 border border-slate-300'
                      }`}
                    >
                      FEFO (Péremption d&apos;abord)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPickStrategy('FIFO')}
                      className={`px-2.5 py-1 rounded-lg font-bold text-[11px] cursor-pointer ${
                        pickStrategy === 'FIFO'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white text-slate-700 border border-slate-300'
                      }`}
                    >
                      FIFO (Ancienneté d&apos;abord)
                    </button>
                    <input
                      type="number"
                      min={1}
                      value={pickQty}
                      onChange={(e) => setPickQty(Math.max(1, Number(e.target.value) || 1))}
                      className="w-20 py-1 px-2 rounded-lg border border-slate-300 bg-white font-mono font-bold text-center"
                    />
                  </div>
                </div>

                {pickingPlan.excludedExpiredQty > 0 && (
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 flex items-center gap-2 text-[11px] font-semibold">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>
                      {pickingPlan.excludedExpiredQty} unité(s) périmée(s) ont été automatiquement écartées du prélèvement {pickStrategy}.
                    </span>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  {pickingPlan.picks.map((p, idx) => (
                    <div
                      key={`${p.lotNumber}-${idx}`}
                      className="px-3 py-2 rounded-xl bg-white border border-emerald-300 shadow-2xs flex items-center gap-2"
                    >
                      <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-black text-[10px] flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="font-mono font-bold text-slate-900">
                          {p.lotNumber} • Bin <span className="text-indigo-700">{p.binCode}</span>
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Prélever <b>{p.pickedQty} u.</b> @ {p.unitPrice.toFixed(2)} (Exp: {p.expiryDate || 'N/A'})
                        </div>
                      </div>
                      {idx < pickingPlan.picks.length - 1 && (
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                      )}
                    </div>
                  ))}
                  {!pickingPlan.isFullySatisfied && (
                    <span className="px-3 py-1.5 rounded-xl bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[11px]">
                      Manquant hors périmés : {pickingPlan.shortageQty} u.
                    </span>
                  )}
                </div>
              </div>

              {/* Add Reception with Lot, Bin & Expiry */}
              {onAddMouvement && (
                <form
                  onSubmit={handleReceiveNewLot}
                  className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-200 space-y-3"
                >
                  <div className="font-black text-indigo-950 flex items-center gap-1.5">
                    <Plus className="w-4 h-4 text-indigo-600" />
                    <span>Réceptionner un Nouveau Lot Multi-Bin (Entrée + Mise à jour CUMP)</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                        N° Lot
                      </label>
                      <input
                        type="text"
                        required
                        value={newLotNumber}
                        onChange={(e) => setNewLotNumber(e.target.value)}
                        className="w-full py-1.5 px-2 rounded-lg border border-slate-300 bg-white font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                        Emplacement (Bin)
                      </label>
                      <input
                        type="text"
                        required
                        value={newBinCode}
                        onChange={(e) => setNewBinCode(e.target.value)}
                        className="w-full py-1.5 px-2 rounded-lg border border-slate-300 bg-white font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                        Date Péremption
                      </label>
                      <input
                        type="date"
                        value={newExpiryDate}
                        onChange={(e) => setNewExpiryDate(e.target.value)}
                        className="w-full py-1.5 px-2 rounded-lg border border-slate-300 bg-white font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                        Quantité Entrée
                      </label>
                      <input
                        type="number"
                        min={1}
                        required
                        value={newLotQty}
                        onChange={(e) => setNewLotQty(Math.max(1, Number(e.target.value) || 1))}
                        className="w-full py-1.5 px-2 rounded-lg border border-slate-300 bg-white font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                        Prix Achat Unitaire
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        required
                        value={newLotPrice}
                        onChange={(e) => setNewLotPrice(Math.max(0, Number(e.target.value) || 0))}
                        className="w-full py-1.5 px-2 rounded-lg border border-slate-300 bg-white font-mono text-xs"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    {feedbackMsg ? (
                      <span className="text-emerald-700 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {feedbackMsg}
                      </span>
                    ) : (
                      <span className="text-[10.5px] text-slate-500">
                        Ajoute un mouvement d&apos;Entrée officiel et recalcule le CUMP sans altérer l&apos;invariant Stock.
                      </span>
                    )}
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs cursor-pointer"
                    >
                      Enregistrer Réception Lot
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
