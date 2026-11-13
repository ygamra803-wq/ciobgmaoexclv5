import type { Dispatch, FormEvent, SetStateAction } from 'react';
import {
  Activity,
  AlertTriangle,
  Calculator,
  Factory,
  Layers,
  Package,
  ShieldCheck,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  UserCheck,
  X,
  XCircle,
  Zap,
  Check,
} from 'lucide-react';

export interface DashboardOrderFormState {
  ref: string;
  designation: string;
  quantite: number;
  order_nature: 'STOCK_PERMANENT' | 'ACHAT_UNIQUE' | string;
  fournisseur: string;
  technicien: string;
  id_zone: string;
  id_machine_registered: string;
  commentaire: string;
  code_bon: string;
}

export interface OrderStockArticleOption {
  ref: string;
  designation?: string;
}

export interface OrderActorOption {
  id_technician?: string;
  id_operation?: string;
  nom: string;
  specialite?: string;
}

export interface DashboardPurchaseOrderModalProps {
  open: boolean;
  selectedArticleForOrder: OrderStockArticleOption | null;
  orderForm: DashboardOrderFormState;
  setOrderForm: Dispatch<SetStateAction<DashboardOrderFormState>>;
  stockItems: OrderStockArticleOption[];
  activeTechnicians: OrderActorOption[];
  activeOperationsChefs: OrderActorOption[];
  onClose: () => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}

export function DashboardPurchaseOrderModal({
  open,
  selectedArticleForOrder,
  orderForm,
  setOrderForm,
  stockItems,
  activeTechnicians,
  activeOperationsChefs,
  onClose,
  onSubmit,
}: DashboardPurchaseOrderModalProps) {
  if (!open) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
      >
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900">
                {selectedArticleForOrder
                  ? `Commander Réappro : ${selectedArticleForOrder.ref}`
                  : "Créer une Commande d'Achat"}
              </h3>
              <p className="text-xs text-slate-500">
                Enregistre une commande en attente dans le flux de traçabilité
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-6 space-y-4 text-xs">
          <div className="space-y-1.5 p-3 rounded-2xl bg-slate-50 border border-slate-200">
            <label className="font-bold text-slate-800 block text-xs">
              Type & Nature de la Commande *
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  setOrderForm((prev) => ({ ...prev, order_nature: 'STOCK_PERMANENT' }))
                }
                className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                  orderForm.order_nature === 'STOCK_PERMANENT'
                    ? 'bg-blue-50/90 border-blue-400 text-blue-900 ring-2 ring-blue-500/20'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs">📦 Pièce Stock Permanente</span>
                  {orderForm.order_nature === 'STOCK_PERMANENT' && (
                    <Check className="w-3.5 h-3.5 text-blue-600" />
                  )}
                </div>
                <span className="text-[10px] text-slate-500 mt-1">
                  Consommable suivi avec seuils et alertes RUPTURE
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setOrderForm((prev) => ({ ...prev, order_nature: 'ACHAT_UNIQUE' }))
                }
                className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                  orderForm.order_nature === 'ACHAT_UNIQUE'
                    ? 'bg-purple-50/90 border-purple-400 text-purple-900 ring-2 ring-purple-500/20'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs">⚡ Achat Unique / Spécifique</span>
                  {orderForm.order_nature === 'ACHAT_UNIQUE' && (
                    <Check className="w-3.5 h-3.5 text-purple-600" />
                  )}
                </div>
                <span className="text-[10px] text-slate-500 mt-1">
                  Non-stockable récurrent (#Achat_Unique, sans fausses alertes)
                </span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-slate-700">Code / N° de Commande *</label>
              <input
                type="text"
                required
                value={orderForm.code_bon}
                onChange={(e) =>
                  setOrderForm((prev) => ({ ...prev, code_bon: e.target.value }))
                }
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs focus:bg-white focus:border-amber-500 outline-none"
                placeholder="CMD-2026-001"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">Quantité Demandée *</label>
              <input
                type="number"
                min="1"
                required
                value={orderForm.quantite}
                onChange={(e) =>
                  setOrderForm((prev) => ({
                    ...prev,
                    quantite: Number(e.target.value) || 0,
                  }))
                }
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs font-bold text-slate-900 focus:bg-white focus:border-amber-500 outline-none"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-bold text-slate-700">Référence de l&apos;Article *</label>
            <input
              type="text"
              required
              value={orderForm.ref}
              onChange={(e) => {
                const r = e.target.value;
                const matched = stockItems.find(
                  (s) => String(s.ref).toLowerCase() === r.toLowerCase()
                );
                setOrderForm((prev) => ({
                  ...prev,
                  ref: r,
                  designation: matched?.designation ? matched.designation : prev.designation,
                }));
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs focus:bg-white focus:border-amber-500 outline-none"
              placeholder="Ex: ROUL-6204-2RS"
            />
          </div>

          <div className="space-y-1">
            <label className="font-bold text-slate-700">Désignation / Spécifications</label>
            <input
              type="text"
              value={orderForm.designation}
              onChange={(e) =>
                setOrderForm((prev) => ({ ...prev, designation: e.target.value }))
              }
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-amber-500 outline-none"
              placeholder="Description détaillée de la pièce"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-slate-700">Fournisseur Prévu</label>
              <input
                type="text"
                value={orderForm.fournisseur}
                onChange={(e) =>
                  setOrderForm((prev) => ({ ...prev, fournisseur: e.target.value }))
                }
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-amber-500 outline-none"
                placeholder="Ex: SKF Maroc, Distributeur"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">Demandeur / Responsable</label>
              <select
                value={orderForm.technicien}
                onChange={(e) =>
                  setOrderForm((prev) => ({ ...prev, technicien: e.target.value }))
                }
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-amber-500 outline-none"
              >
                <option value="">Sélectionner un responsable...</option>
                {activeTechnicians.map((t) => (
                  <option key={t.id_technician || t.nom} value={t.nom}>
                    {t.nom} ({t.specialite || 'Tech'})
                  </option>
                ))}
                {activeOperationsChefs.map((c) => (
                  <option key={c.id_operation || c.nom} value={c.nom}>
                    {c.nom} (Chef)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-bold text-slate-700">Notes & Justification</label>
            <textarea
              rows={2}
              value={orderForm.commentaire}
              onChange={(e) =>
                setOrderForm((prev) => ({ ...prev, commentaire: e.target.value }))
              }
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-amber-500 outline-none"
              placeholder="Justification de la commande..."
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer active:scale-98"
            >
              <Check className="w-4 h-4" />
              <span>Confirmer la Commande</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export interface DashboardFormulasModalProps {
  open: boolean;
  formulaTab: 'stock' | 'kpis' | 'autoid';
  setFormulaTab: Dispatch<SetStateAction<'stock' | 'kpis' | 'autoid'>>;
  onClose: () => void;
}

export function DashboardFormulasModal({
  open,
  formulaTab,
  setFormulaTab,
  onClose,
}: DashboardFormulasModalProps) {
  if (!open) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full p-5 space-y-4 animate-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col"
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 shrink-0 shadow-2xs">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>Formules Excel Miroir — CIOB GMAO Twin</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                  Excel Twin
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Modèle mathématique et formules réelles de calcul issues de{' '}
                <code className="font-mono text-slate-700 font-bold">
                  GMAO_Light_Template_V2_Formules.xlsx
                </code>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer shrink-0"
            title="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-xl shrink-0 border border-slate-200/70">
          <button
            type="button"
            onClick={() => setFormulaTab('stock')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              formulaTab === 'stock'
                ? 'bg-white text-blue-700 shadow-xs border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>1. Stock & Flux (Mouvements)</span>
          </button>

          <button
            type="button"
            onClick={() => setFormulaTab('kpis')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              formulaTab === 'kpis'
                ? 'bg-white text-emerald-700 shadow-xs border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>2. Indicateurs & KPIs (Pilotage)</span>
          </button>

          <button
            type="button"
            onClick={() => setFormulaTab('autoid')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              formulaTab === 'autoid'
                ? 'bg-white text-purple-700 shadow-xs border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>3. Auto-ID & Séquences</span>
          </button>
        </div>

        <div className="overflow-y-auto space-y-3 pr-1 flex-1">
          {formulaTab === 'stock' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-blue-300 transition">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                    <TrendingUp className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="truncate">Total Entrées (Col. F)</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-100/80 text-blue-800 border border-blue-200 shrink-0">
                    Feuille Stock_Actuel!F
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="font-mono text-xs text-blue-800 font-bold bg-white p-2 rounded-lg border border-blue-100 break-all select-all">
                    =SUMIFS(Mouvements!D:D, Mouvements!C:C, [@Ref], Mouvements!E:E, &quot;Entrée&quot;)
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 italic pl-1">
                    FR: =SOMME.SI.ENS(Mouvements!D:D; Mouvements!C:C; [@Ref]; Mouvements!E:E; &quot;Entrée&quot;)
                  </div>
                </div>
                <p className="text-[10.5px] text-slate-500 leading-tight">
                  Agrégation conditionnelle multi-critères des réceptions fournisseurs et retours d&apos;atelier pour la référence active.
                </p>
              </div>

              <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-rose-300 transition">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                    <TrendingDown className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <span className="truncate">Total Sorties (Col. G)</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-rose-100/80 text-rose-800 border border-rose-200 shrink-0">
                    Feuille Stock_Actuel!G
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="font-mono text-xs text-rose-800 font-bold bg-white p-2 rounded-lg border border-rose-100 break-all select-all">
                    =SUMIFS(Mouvements!D:D, Mouvements!C:C, [@Ref], Mouvements!E:E, &quot;Sortie&quot;)
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 italic pl-1">
                    FR: =SOMME.SI.ENS(Mouvements!D:D; Mouvements!C:C; [@Ref]; Mouvements!E:E; &quot;Sortie&quot;)
                  </div>
                </div>
                <p className="text-[10.5px] text-slate-500 leading-tight">
                  Somme automatique de toutes les sorties (interventions curatives, préventives et consommations d&apos;atelier).
                </p>
              </div>

              <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-emerald-300 transition">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                    <Package className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="truncate">Stock Actuel (Col. H)</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-100/80 text-emerald-800 border border-emerald-200 shrink-0">
                    Feuille Stock_Actuel!H
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="font-mono text-xs text-emerald-800 font-bold bg-white p-2 rounded-lg border border-emerald-100 break-all select-all">
                    =[@[Stock Initial]] + [@[Entrées]] - [@[Sorties]]
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 italic pl-1">
                    Cellules: =E2 + F2 - G2
                  </div>
                </div>
                <p className="text-[10.5px] text-slate-500 leading-tight">
                  Balance en temps réel calculée pour chaque article avec propagation instantanée des flux d&apos;entrées et sorties.
                </p>
              </div>

              <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-amber-300 transition">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span className="truncate">Statut d&apos;Alerte (Col. J)</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-100/80 text-amber-800 border border-amber-200 shrink-0">
                    Feuille Stock_Actuel!J
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="font-mono text-xs text-amber-800 font-bold bg-white p-2 rounded-lg border border-amber-100 break-all select-all">
                    =IF([@[Stock Actuel]]&lt;=0, &quot;RUPTURE&quot;, IF([@[Stock Actuel]]&lt;=[@[Seuil]], &quot;ALERTE&quot;, &quot;OK&quot;))
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 italic pl-1">
                    FR: =SI([@[Stock Actuel]]&lt;=0; &quot;RUPTURE&quot;; SI([@[Stock Actuel]]&lt;=[@[Seuil]]; &quot;ALERTE&quot;; &quot;OK&quot;))
                  </div>
                </div>
                <p className="text-[10.5px] text-slate-500 leading-tight">
                  Déclenchement automatique des seuils critiques et alimentation dynamique de la liste de réapprovisionnement.
                </p>
              </div>
            </div>
          )}

          {formulaTab === 'kpis' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-blue-300 transition">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                    <Package className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="truncate">Total Articles au Catalogue</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-100/80 text-blue-800 border border-blue-200 shrink-0">
                    COUNTA
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="font-mono text-xs text-blue-800 font-bold bg-white p-2 rounded-lg border border-blue-100 break-all select-all">
                    =COUNTA(Stock_Actuel!A2:A1000)
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 italic pl-1">
                    FR: =NBVAL(Stock_Actuel!A2:A1000)
                  </div>
                </div>
                <p className="text-[10.5px] text-slate-500 leading-tight">
                  Nombre total de références de pièces de rechange enregistrées dans la nomenclature.
                </p>
              </div>

              <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-emerald-300 transition">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                    <Layers className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="truncate">Stock Physique Global (Unités)</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-100/80 text-emerald-800 border border-emerald-200 shrink-0">
                    SUM
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="font-mono text-xs text-emerald-800 font-bold bg-white p-2 rounded-lg border border-emerald-100 break-all select-all">
                    =SUM(Stock_Actuel!H2:H1000)
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 italic pl-1">
                    FR: =SOMME(Stock_Actuel!H2:H1000)
                  </div>
                </div>
                <p className="text-[10.5px] text-slate-500 leading-tight">
                  Somme cumulative de toutes les unités d&apos;articles présentes physiquement dans le magasin.
                </p>
              </div>

              <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-rose-300 transition">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                    <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <span className="truncate">Articles en Rupture Critique</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-rose-100/80 text-rose-800 border border-rose-200 shrink-0">
                    COUNTIF
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="font-mono text-xs text-rose-800 font-bold bg-white p-2 rounded-lg border border-rose-100 break-all select-all">
                    =COUNTIF(Stock_Actuel!J2:J1000, &quot;RUPTURE&quot;)
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 italic pl-1">
                    FR: =NB.SI(Stock_Actuel!J2:J1000; &quot;RUPTURE&quot;)
                  </div>
                </div>
                <p className="text-[10.5px] text-slate-500 leading-tight">
                  Nombre d&apos;articles dont le stock actuel est nul ou inférieur à 0 (rupture immédiate).
                </p>
              </div>

              <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-amber-300 transition">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span className="truncate">Articles Sous Seuil d&apos;Alerte</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-100/80 text-amber-800 border border-amber-200 shrink-0">
                    COUNTIF
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="font-mono text-xs text-amber-800 font-bold bg-white p-2 rounded-lg border border-amber-100 break-all select-all">
                    =COUNTIF(Stock_Actuel!J2:J1000, &quot;ALERTE&quot;)
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 italic pl-1">
                    FR: =NB.SI(Stock_Actuel!J2:J1000; &quot;ALERTE&quot;)
                  </div>
                </div>
                <p className="text-[10.5px] text-slate-500 leading-tight">
                  Nombre d&apos;articles dont le stock disponible est inférieur ou égal au seuil de sécurité.
                </p>
              </div>

              <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-indigo-300 transition">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                    <Activity className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span className="truncate">Volume Total des Mouvements</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-100/80 text-indigo-800 border border-indigo-200 shrink-0">
                    COUNTA
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="font-mono text-xs text-indigo-800 font-bold bg-white p-2 rounded-lg border border-indigo-100 break-all select-all">
                    =COUNTA(Mouvements!A2:A5000)
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 italic pl-1">
                    FR: =NBVAL(Mouvements!A2:A5000)
                  </div>
                </div>
                <p className="text-[10.5px] text-slate-500 leading-tight">
                  Nombre total d&apos;opérations d&apos;entrées et de sorties tracées dans le registre historique.
                </p>
              </div>

              <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-teal-300 transition">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                    <Factory className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                    <span className="truncate">Parc Machines Opérationnel</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-teal-100/80 text-teal-800 border border-teal-200 shrink-0">
                    COUNTIF
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="font-mono text-xs text-teal-800 font-bold bg-white p-2 rounded-lg border border-teal-100 break-all select-all">
                    =COUNTIF(Machines_Registered!G:G, &quot;En service&quot;)
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 italic pl-1">
                    FR: =NB.SI(Machines_Registered!G:G; &quot;En service&quot;)
                  </div>
                </div>
                <p className="text-[10.5px] text-slate-500 leading-tight">
                  Nombre d&apos;équipements industriels en état de fonctionnement continu.
                </p>
              </div>
            </div>
          )}

          {formulaTab === 'autoid' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-purple-300 transition">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                    <Zap className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                    <span className="truncate">Code Bon de Commande / Sortie</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-purple-100/80 text-purple-800 border border-purple-200 shrink-0">
                    Bon-001...
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="font-mono text-xs text-purple-800 font-bold bg-white p-2 rounded-lg border border-purple-100 break-all select-all">
                    =&quot;Bon-&quot; &amp; TEXT(COUNTA(Mouvements!B:B)+1, &quot;000&quot;)
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 italic pl-1">
                    FR: =&quot;Bon-&quot; &amp; TEXTE(NBVAL(Mouvements!B:B)+1; &quot;000&quot;)
                  </div>
                </div>
                <p className="text-[10.5px] text-slate-500 leading-tight">
                  Incrémentation automatique du numéro de bon de mouvement avec formatage sur 3 chiffres.
                </p>
              </div>

              <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-cyan-300 transition">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                    <UserCheck className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                    <span className="truncate">Code Technicien (TECH)</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-100/80 text-cyan-800 border border-cyan-200 shrink-0">
                    TECH-01...
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="font-mono text-xs text-cyan-800 font-bold bg-white p-2 rounded-lg border border-cyan-100 break-all select-all">
                    =&quot;TECH-&quot; &amp; TEXT(COUNTA(Technicians!A:A)+1, &quot;00&quot;)
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 italic pl-1">
                    FR: =&quot;TECH-&quot; &amp; TEXTE(NBVAL(Technicians!A:A)+1; &quot;00&quot;)
                  </div>
                </div>
                <p className="text-[10.5px] text-slate-500 leading-tight">
                  Attribution séquentielle des identifiants des techniciens et agents de maintenance.
                </p>
              </div>

              <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-blue-300 transition">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                    <Zap className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="truncate">Code Opérateur (OP)</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-100/80 text-blue-800 border border-blue-200 shrink-0">
                    OP-01...
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="font-mono text-xs text-blue-800 font-bold bg-white p-2 rounded-lg border border-blue-100 break-all select-all">
                    =&quot;OP-&quot; &amp; TEXT(COUNTIF(Operations!D:D, &quot;OPERATEUR&quot;)+1, &quot;00&quot;)
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 italic pl-1">
                    FR: =&quot;OP-&quot; &amp; TEXTE(NB.SI(Operations!D:D; &quot;OPERATEUR&quot;)+1; &quot;00&quot;)
                  </div>
                </div>
                <p className="text-[10.5px] text-slate-500 leading-tight">
                  Génération automatique des codes d&apos;opérateurs de production sur 2 chiffres.
                </p>
              </div>

              <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-amber-300 transition">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                    <Zap className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span className="truncate">Code Chef d&apos;Équipe (CHEF)</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-100/80 text-amber-800 border border-amber-200 shrink-0">
                    CHEF-01...
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="font-mono text-xs text-amber-800 font-bold bg-white p-2 rounded-lg border border-amber-100 break-all select-all">
                    =&quot;CHEF-&quot; &amp; TEXT(COUNTIF(Operations!D:D, &quot;CHEF&quot;)+1, &quot;00&quot;)
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 italic pl-1">
                    FR: =&quot;CHEF-&quot; &amp; TEXTE(NB.SI(Operations!D:D; &quot;CHEF&quot;)+1; &quot;00&quot;)
                  </div>
                </div>
                <p className="text-[10.5px] text-slate-500 leading-tight">
                  Génération automatique des codes de responsables et chefs de postes.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span className="flex items-center gap-1.5 font-mono text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>100% Conforme aux spécifications Excel GMAO Template V2</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition cursor-pointer shadow-xs"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
