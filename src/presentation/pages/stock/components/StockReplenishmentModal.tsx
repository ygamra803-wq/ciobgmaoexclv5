import { useState, useMemo, useEffect } from 'react';
import {
  X,
  ShoppingCart,
  CheckCircle2,
  AlertTriangle,
  Send,
  Truck,
  Plus,
  Check,
} from 'lucide-react';
import { useGmaoStore } from '../../../../store/useGmaoStore';
import { useAuth } from '../../../../context/AuthContext';
import { usePermission } from '../../../components/common/PermissionGate';
import { IReplenishmentOrder } from '../../../../types/replenishment';

interface StockReplenishmentModalProps {
  onClose: () => void;
  reorderAlerts: any;
  showToast?: (msg: string, type?: string) => void;
}

export default function StockReplenishmentModal({
  onClose,
  reorderAlerts,
  showToast,
}: StockReplenishmentModalProps) {
  const { user } = useAuth();
  const canManageReplenishment = usePermission('stock.edit');
  const replenishmentOrders: IReplenishmentOrder[] = useGmaoStore((s) => s.replenishmentOrders) || [];
  const handleCreateReplenishmentOrder = useGmaoStore((s) => s.handleCreateReplenishmentOrder);
  const handleUpdateReplenishmentOrderStatus = useGmaoStore((s) => s.handleUpdateReplenishmentOrderStatus);
  const handleReceiveReplenishmentOrder = useGmaoStore((s) => s.handleReceiveReplenishmentOrder);

  const [activeTab, setActiveTab] = useState<'BASKET' | 'ORDERS'>('BASKET');
  const [selectedFournisseur, setSelectedFournisseur] = useState('Fournisseur Industriel Principal');
  const [orderNotes, setOrderNotes] = useState('');

  // Basket quantities keyed by ref
  const [basketSelections, setBasketSelections] = useState<Record<string, { selected: boolean; qty: number }>>({});

  // Active Reception Modal state
  const [receptionOrder, setReceptionOrder] = useState<IReplenishmentOrder | null>(null);
  const [receptionItems, setReceptionItems] = useState<Record<string, number>>({});
  const [bonReceptionNum, setBonReceptionNum] = useState('');

  // Items eligible for reorder
  const alertItems = useMemo(() => {
    return reorderAlerts?.items || [];
  }, [reorderAlerts]);

  // Compute quantities already on active orders (BROUILLON, COMMANDE, RECEPTION_PARTIELLE) to prevent accidental double ordering
  const inTransitQtyByRef = useMemo(() => {
    const map: Record<string, number> = {};
    for (const order of replenishmentOrders) {
      if (
        order.statut === 'BROUILLON' ||
        order.statut === 'COMMANDE' ||
        order.statut === 'RECEPTION_PARTIELLE'
      ) {
        for (const it of order.items || []) {
          const refKey = String(it.ref || '').trim();
          const remaining = Math.max(0, Number(it.quantite_demandee || 0) - Number(it.quantite_recue || 0));
          if (refKey && remaining > 0) {
            map[refKey] = (map[refKey] || 0) + remaining;
          }
        }
      }
    }
    return map;
  }, [replenishmentOrders]);

  // Initialize basket state when alert items are loaded (using useEffect instead of useMemo to respect pure render rules)
  useEffect(() => {
    const init: Record<string, { selected: boolean; qty: number }> = {};
    for (const item of alertItems) {
      const stockActuel = Number(item.stockActuel ?? item.stock_actuel ?? 0);
      const seuil = Number(item.seuilMin ?? item.seuil ?? 0);
      const alreadyOnOrder = inTransitQtyByRef[item.ref] || 0;
      const suggestedQty = Math.max(1, Math.round(seuil * 2 - stockActuel - alreadyOnOrder));
      init[item.ref] = {
        selected: alreadyOnOrder === 0,
        qty: suggestedQty,
      };
    }
    setBasketSelections((prev) => ({ ...init, ...prev }));
  }, [alertItems, inTransitQtyByRef]);

  const handleToggleSelectAll = (select: boolean) => {
    const next: Record<string, { selected: boolean; qty: number }> = {};
    for (const item of alertItems) {
      const current = basketSelections[item.ref] || {
        selected: true,
        qty: Math.max(1, Math.round(Number(item.seuilMin || 5) * 2 - Number(item.stockActuel || 0))),
      };
      next[item.ref] = { ...current, selected: select };
    }
    setBasketSelections(next);
  };

  const selectedCount = useMemo(() => {
    return Object.values(basketSelections).filter((b) => b.selected && b.qty > 0).length;
  }, [basketSelections]);

  const estimatedOrderCost = useMemo(() => {
    let total = 0;
    for (const item of alertItems) {
      const basket = basketSelections[item.ref];
      if (basket?.selected && basket.qty > 0) {
        const price = Number(item.prixUnitaire ?? item.prix_unitaire ?? item.prix ?? 0);
        total += basket.qty * price;
      }
    }
    return total;
  }, [alertItems, basketSelections]);

  const handleGenerateOrder = async () => {
    if (!canManageReplenishment) {
      showToast?.('Accès refusé : Réservé au Responsable Magasin ou Administrateur.', 'error');
      return;
    }
    if (selectedCount === 0) {
      showToast?.('Veuillez sélectionner au moins un article à réapprovisionner.', 'error');
      return;
    }

    const itemsToOrder = alertItems
      .filter((item: any) => basketSelections[item.ref]?.selected && basketSelections[item.ref]?.qty > 0)
      .map((item: any) => {
        const qty = basketSelections[item.ref].qty;
        const price = Number(item.prixUnitaire ?? item.prix_unitaire ?? item.prix ?? 0);
        return {
          ref: item.ref,
          designation: item.designation || item.nom || item.ref,
          quantite_demandee: qty,
          quantite_recue: 0,
          prix_unitaire_estime: price,
          stock_actuel_moment: Number(item.stockActuel ?? 0),
          seuil_alerte: Number(item.seuilMin ?? 0),
          unite: item.unite || 'U',
        };
      });

    if (typeof handleCreateReplenishmentOrder === 'function') {
      await handleCreateReplenishmentOrder({
        fournisseur: selectedFournisseur.trim() || 'Fournisseur Général',
        cree_par: user?.name || user?.nom || 'Magasinier',
        items: itemsToOrder,
        montant_total_estime: estimatedOrderCost,
        notes: orderNotes.trim(),
      });

      showToast?.(`Bon de Commande créé avec succès (${itemsToOrder.length} articles).`, 'success');
      setActiveTab('ORDERS');
    }
  };

  const handleOpenReception = (order: IReplenishmentOrder) => {
    if (!canManageReplenishment) return;
    setReceptionOrder(order);
    const initItems: Record<string, number> = {};
    for (const it of order.items) {
      const remaining = Math.max(0, it.quantite_demandee - (it.quantite_recue || 0));
      initItems[it.ref] = remaining;
    }
    setReceptionItems(initItems);
    setBonReceptionNum(`BR-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${order.numero_commande.slice(-4)}`);
  };

  const handleConfirmReception = async () => {
    if (!canManageReplenishment || !receptionOrder) return;

    const payload = Object.entries(receptionItems).map(([ref, qty]) => ({
      ref,
      quantite_recue: Number(qty) || 0,
    }));

    if (typeof handleReceiveReplenishmentOrder === 'function') {
      await handleReceiveReplenishmentOrder(
        receptionOrder.id,
        payload,
        bonReceptionNum.trim(),
        user?.name || user?.nom || 'Magasinier'
      );
      showToast?.(`Réception validée et intégrée au stock avec succès (BR: ${bonReceptionNum}).`, 'success');
      setReceptionOrder(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[94vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-400/40 text-amber-300 flex items-center justify-center shrink-0">
              <ShoppingCart className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-800">
                  Approvisionnement PDR
                </span>
                <span className="font-mono text-base font-black text-white">
                  Centre de Réapprovisionnement & Commandes
                </span>
              </div>
              <p className="text-xs text-slate-300 truncate mt-0.5">
                Kits de réapprovisionnement automatique et intégration directe des réceptions en stock.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
            title="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-6 border-b border-slate-200 bg-white flex gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('BASKET')}
            className={`py-3.5 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'BASKET'
                ? 'border-amber-600 text-amber-800 bg-amber-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>Articles à Réapprovisionner ({alertItems.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ORDERS')}
            className={`py-3.5 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'ORDERS'
                ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Truck className="w-4 h-4 text-indigo-600" />
            <span>Bons de Commande & Réceptions ({replenishmentOrders.length})</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 text-slate-700 text-xs">
          
          {/* TAB 1: REORDER BASKET */}
          {activeTab === 'BASKET' && (
            <div className="space-y-5">
              {/* Top Control Bar */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleToggleSelectAll(true)}
                    className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold text-xs transition cursor-pointer"
                  >
                    Tout sélectionner
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleSelectAll(false)}
                    className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold text-xs transition cursor-pointer"
                  >
                    Tout désélectionner
                  </button>
                  <span className="text-slate-500 font-medium">
                    {selectedCount} sélectionné(s) sur {alertItems.length}
                  </span>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="flex flex-col sm:items-end">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Total Estimé</span>
                    <span className="font-mono text-base font-black text-amber-700">
                      {estimatedOrderCost.toLocaleString('fr-FR')} DH
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={selectedCount === 0}
                    onClick={handleGenerateOrder}
                    className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-white font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-sm shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Créer le Bon de Commande</span>
                  </button>
                </div>
              </div>

              {/* Fournisseur and Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white p-3.5 rounded-2xl border border-slate-200">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                    Fournisseur Ciblé
                  </label>
                  <input
                    type="text"
                    value={selectedFournisseur}
                    onChange={(e) => setSelectedFournisseur(e.target.value)}
                    placeholder="Ex: Fournisseur SKF, Rexroth, ou Magasin Central..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 text-xs focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                    Notes ou Références Internes (Optionnel)
                  </label>
                  <input
                    type="text"
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    placeholder="Ex: Réapprovisionnement urgent suite audit fin de mois..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 text-xs focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>
              </div>

              {/* Items Table */}
              {alertItems.length === 0 ? (
                <div className="p-10 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                  <p className="font-bold text-slate-700 text-sm">Tous les stocks sont au-dessus du seuil d'alerte !</p>
                  <p className="text-xs text-slate-400">Aucune rupture ou déficit détecté dans l'inventaire actuel.</p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs divide-y divide-slate-100">
                  <div className="p-3 bg-slate-50 font-bold text-slate-400 text-[10px] uppercase grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-1 text-center">Choix</div>
                    <div className="col-span-4">Article (Réf & Nom)</div>
                    <div className="col-span-2 text-center">Stock / Seuil</div>
                    <div className="col-span-2 text-center">Qté Suggérée</div>
                    <div className="col-span-3 text-right">Prix Est. / Total</div>
                  </div>

                  {alertItems.map((item: any) => {
                    const basket = basketSelections[item.ref] || { selected: false, qty: 1 };
                    const price = Number(item.prixUnitaire ?? item.prix_unitaire ?? item.prix ?? 0);
                    const lineTotal = basket.qty * price;
                    const stockActuel = Number(item.stockActuel ?? item.stock_actuel ?? 0);
                    const seuil = Number(item.seuilMin ?? item.seuil ?? 0);

                    return (
                      <div
                        key={item.ref}
                        className={`p-3 grid grid-cols-12 gap-2 items-center transition ${
                          basket.selected ? 'bg-amber-50/30 hover:bg-amber-50/60' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="col-span-1 text-center">
                          <input
                            type="checkbox"
                            checked={basket.selected}
                            onChange={(e) =>
                              setBasketSelections((prev) => ({
                                ...prev,
                                [item.ref]: {
                                  ...basket,
                                  selected: e.target.checked,
                                },
                              }))
                            }
                            className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                          />
                        </div>

                        <div className="col-span-4 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-slate-900 truncate">
                              {item.ref}
                            </span>
                            {(inTransitQtyByRef[item.ref] || 0) > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 font-mono font-bold text-[9.5px] shrink-0">
                                En cmd: +{inTransitQtyByRef[item.ref]}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-500 block truncate">
                            {item.designation || item.nom || 'Sans désignation'}
                          </span>
                        </div>

                        <div className="col-span-2 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10.5px] font-mono font-bold ${
                            stockActuel <= 0 ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {stockActuel} / {seuil} {item.unite || 'U'}
                          </span>
                        </div>

                        <div className="col-span-2 flex items-center justify-center">
                          <input
                            type="number"
                            min="1"
                            value={basket.qty}
                            onChange={(e) => {
                              const val = Math.max(1, parseInt(e.target.value) || 1);
                              setBasketSelections((prev) => ({
                                ...prev,
                                [item.ref]: {
                                  ...basket,
                                  qty: val,
                                },
                              }));
                            }}
                            className="w-20 px-2 py-1 bg-white border border-slate-300 rounded-lg text-center font-mono font-bold text-xs focus:ring-2 focus:ring-amber-500/20"
                          />
                        </div>

                        <div className="col-span-3 text-right">
                          <span className="font-mono font-bold text-slate-800 block">
                            {lineTotal.toLocaleString('fr-FR')} DH
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {price > 0 ? `${price} DH/u` : 'Prix n.d.'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ORDERS & GOODS RECEIPT */}
          {activeTab === 'ORDERS' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                  Historique des Bons de Commande ({replenishmentOrders.length})
                </span>
                <span className="text-xs text-slate-400">
                  Délai moyen de réapprovisionnement : Standard (J+3)
                </span>
              </div>

              {replenishmentOrders.length === 0 ? (
                <div className="p-10 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400">
                  Aucun bon de commande enregistré. Utilisez le panier pour générer une première commande.
                </div>
              ) : (
                <div className="space-y-3">
                  {replenishmentOrders.map((order) => {
                    const isDraft = order.statut === 'BROUILLON';
                    const isOrdered = order.statut === 'COMMANDE';
                    const isPartial = order.statut === 'RECEPTION_PARTIELLE';
                    const isCompleted = order.statut === 'RECU_CONFORME';
                    const isCancelled = order.statut === 'ANNULE';

                    return (
                      <div
                        key={order.id}
                        className="p-4 rounded-2xl border border-slate-200 bg-white shadow-2xs hover:border-slate-300 transition space-y-3"
                      >
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2.5">
                            <span className="font-mono font-bold text-sm text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-xl border border-indigo-200">
                              {order.numero_commande}
                            </span>
                            <span className="font-bold text-slate-800 text-xs">
                              {order.fournisseur}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                isCompleted
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : isPartial
                                  ? 'bg-blue-100 text-blue-800'
                                  : isOrdered
                                  ? 'bg-amber-100 text-amber-800'
                                  : isCancelled
                                  ? 'bg-slate-100 text-slate-600 line-through'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {order.statut}
                            </span>
                          </div>
                        </div>

                        {/* Order Metadata */}
                        <div className="flex items-center gap-4 text-[11px] text-slate-500 flex-wrap">
                          <span>Créé le : <span className="font-semibold text-slate-700">{order.date_creation}</span></span>
                          <span>Par : <span className="font-semibold text-slate-700">{order.cree_par}</span></span>
                          {order.date_commande && <span>Commandé le : <span className="font-semibold text-slate-700">{order.date_commande}</span></span>}
                          {order.date_reception && <span>Reçu le : <span className="font-semibold text-slate-700">{order.date_reception}</span></span>}
                          {order.numero_bon_reception && (
                            <span className="font-mono text-emerald-700 font-bold">BR : {order.numero_bon_reception}</span>
                          )}
                          <span className="font-mono font-bold text-slate-900 ml-auto">
                            Total : {order.montant_total_estime?.toLocaleString('fr-FR')} DH
                          </span>
                        </div>

                        {/* Items preview */}
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-1">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                            Articles inclus ({order.items.length})
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {order.items.map((it) => (
                              <div key={it.ref} className="text-[11px] flex items-center justify-between bg-white px-2 py-1 rounded-lg border border-slate-200/60">
                                <span className="font-mono font-bold text-slate-800">{it.ref}</span>
                                <span className="text-slate-500 truncate max-w-[150px]">{it.designation}</span>
                                <span className="font-mono font-bold text-amber-800">
                                  {it.quantite_recue || 0} / {it.quantite_demandee} {it.unite || 'U'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Order Actions */}
                        <div className="flex items-center gap-2 pt-1">
                          {isDraft && (
                            <button
                              type="button"
                              onClick={() => handleUpdateReplenishmentOrderStatus(order.id, 'COMMANDE')}
                              className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>Passer la Commande au Fournisseur</span>
                            </button>
                          )}

                          {(isOrdered || isPartial) && (
                            <button
                              type="button"
                              onClick={() => handleOpenReception(order)}
                              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                            >
                              <Truck className="w-3.5 h-3.5" />
                              <span>Réceptionner & Intégrer au Stock</span>
                            </button>
                          )}

                          {!isCompleted && !isCancelled && (
                            <button
                              type="button"
                              onClick={() => handleUpdateReplenishmentOrderStatus(order.id, 'ANNULE')}
                              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition cursor-pointer"
                            >
                              Annuler
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-400 font-mono">
            Module Réapprovisionnement & Commandes PDR • CIOB GMAO Nexus v5.0.2
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs transition cursor-pointer"
          >
            Fermer
          </button>
        </div>

      </div>

      {/* SUB-MODAL: RECEPTION & INTEGRATION AU STOCK */}
      {receptionOrder && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    Réceptionner Commande {receptionOrder.numero_commande}
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    Fournisseur : {receptionOrder.fournisseur}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReceptionOrder(null)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                N° Bon de Réception Magasin (BR)
              </label>
              <input
                type="text"
                value={bonReceptionNum}
                onChange={(e) => setBonReceptionNum(e.target.value)}
                placeholder="Ex: BR-20261107-001..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-800 text-xs focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">
                Quantités Réceptionnées à Intégrer au Stock
              </span>
              <div className="max-h-60 overflow-y-auto space-y-2 divide-y divide-slate-100 pr-1">
                {receptionOrder.items.map((it) => {
                  const already = it.quantite_recue || 0;
                  const remaining = Math.max(0, it.quantite_demandee - already);

                  return (
                    <div key={it.ref} className="pt-2 flex items-center justify-between gap-3 text-xs">
                      <div className="min-w-0">
                        <span className="font-mono font-bold text-slate-900 block truncate">{it.ref}</span>
                        <span className="text-[10.5px] text-slate-500 block truncate">{it.designation}</span>
                        <span className="text-[10px] text-slate-400">
                          Demandé: {it.quantite_demandee} | Déjà reçu: {already}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <input
                          type="number"
                          min="0"
                          max={remaining}
                          value={receptionItems[it.ref] ?? remaining}
                          onChange={(e) => {
                            const val = Math.max(0, parseInt(e.target.value) || 0);
                            setReceptionItems((prev) => ({
                              ...prev,
                              [it.ref]: val,
                            }));
                          }}
                          className="w-16 px-2 py-1 bg-white border border-slate-300 rounded-lg text-center font-mono font-bold text-xs"
                        />
                        <span className="text-slate-500 text-[11px]">{it.unite || 'U'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-800 flex items-start gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                La validation génèrera automatiquement une entrée en stock officielle sous le type{' '}
                <strong>Entrée (reapprovisionnement)</strong> et mettra à jour le stock actuel sans double saisie.
              </span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setReceptionOrder(null)}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmReception}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-sm"
              >
                <Check className="w-4 h-4" />
                <span>Valider l'Entrée en Stock</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
