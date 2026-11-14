import {
  Boxes,
  Clock,
  Inbox,
  Layers,
  Package,
  Puzzle,
  RotateCcw,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Truck,
} from 'lucide-react';

export interface MovementFlowSelectorSectionProps {
  form: any;
  setForm: (val: any) => void;
  mouvementItems: any[];
  setMouvementItems: (items: any[]) => void;
  isSortieInterne: boolean;
  isEntreeInterne: boolean;
  isBonSortie: boolean;
  isEntreeExterne: boolean;
  isCommandeFlow: boolean;
  handleTypeChange: (newType: string) => void;
  activeExternalRepairs: any[];
  pendingOrders: any[];
  handleReceiveRepairReturn: (rep: any) => void;
  handleFulfillOrder: (ord: any) => void;
}

export function MovementFlowSelectorSection({
  form,
  setForm,
  mouvementItems,
  setMouvementItems,
  isSortieInterne,
  isEntreeInterne,
  isBonSortie,
  isEntreeExterne,
  isCommandeFlow,
  handleTypeChange,
  activeExternalRepairs,
  pendingOrders,
  handleReceiveRepairReturn,
  handleFulfillOrder,
}: MovementFlowSelectorSectionProps) {
  return (
    <div className="space-y-4">
      {/* 1. FLOW TYPE SELECTOR (5 Operational Flows categorized under 3 Philosophies) */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
          Type de Flux Industriel (5 Types)
        </label>

        <div className="grid grid-cols-2 gap-1.5">
          {/* 1. Sortie Interne */}
          <button
            type="button"
            onClick={() => handleTypeChange('Sortie Interne')}
            className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
              isSortieInterne
                ? 'bg-rose-50 border-rose-400 text-rose-950 font-bold ring-2 ring-rose-500/20 shadow-2xs'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold flex items-center gap-1.5">
                <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
                <span>Sortie Interne</span>
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-rose-200 text-rose-800 font-bold">
                INTERNE
              </span>
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Stock/Entrepôt → Machine/Zone</div>
          </button>

          {/* 2. Entrée Interne */}
          <button
            type="button"
            onClick={() => handleTypeChange('Entrée Interne')}
            className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
              isEntreeInterne
                ? 'bg-cyan-50 border-cyan-400 text-cyan-950 font-bold ring-2 ring-cyan-500/20 shadow-2xs'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-cyan-600" />
                <span>Entrée Interne</span>
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-200 text-cyan-800 font-bold">
                INTERNE
              </span>
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Machine/Atelier → Stock/Entrepôt</div>
          </button>

          {/* 3. Bon de Sortie (Réparation Externe) */}
          <button
            type="button"
            onClick={() => handleTypeChange('Bon de Sortie')}
            className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
              isBonSortie
                ? 'bg-purple-50 border-purple-400 text-purple-950 font-bold ring-2 ring-purple-500/20 shadow-2xs'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-purple-600" />
                <span>Bon de Sortie</span>
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-purple-200 text-purple-800 font-bold">
                EXTERNE
              </span>
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Entrepôt → Réparation Externe (Truck)
            </div>
          </button>

          {/* 4. Entrée Externe */}
          <button
            type="button"
            onClick={() => handleTypeChange('Entrée Externe')}
            className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
              isEntreeExterne
                ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-bold ring-2 ring-emerald-500/20 shadow-2xs'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold flex items-center gap-1.5">
                <Inbox className="w-3.5 h-3.5 text-emerald-600" />
                <span>Entrée Externe</span>
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-200 text-emerald-800 font-bold">
                EXTERNE
              </span>
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Fournisseur/Retour Réparation → Stock
            </div>
          </button>

          {/* 5. COMMANDE / Demandes d'Achat */}
          <button
            type="button"
            onClick={() => handleTypeChange('COMMANDE')}
            className={`p-2.5 rounded-xl border text-left transition cursor-pointer col-span-2 ${
              isCommandeFlow
                ? 'bg-amber-50 border-amber-400 text-amber-950 font-bold ring-2 ring-amber-500/20 shadow-2xs'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold flex items-center gap-1.5">
                <ShoppingCart className="w-3.5 h-3.5 text-amber-600" />
                <span>Demande d&apos;Achat & Approvisionnement (COMMANDE)</span>
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-200 text-amber-800 font-bold">
                ACHAT
              </span>
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Demande d&apos;achat de PDR, Composants ou Parties en attente
            </div>
          </button>
        </div>
      </div>

      {/* 2. DYNAMIC ITEM SOURCE SELECTOR FOR SORTIE INTERNE */}
      {isSortieInterne && (
        <div className="p-3 bg-slate-50/90 rounded-xl border border-slate-200 space-y-2">
          <label className="text-[10.5px] font-bold text-slate-700 uppercase tracking-wider block flex items-center gap-1.5">
            <Boxes className="w-3.5 h-3.5 text-slate-600" />
            <span>Source de l&apos;Article à Sortir :</span>
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => {
                setForm({ ...form, item_source: 'STOCK_PDR' });
                setMouvementItems(mouvementItems.map((i) => ({ ...i, source: 'STOCK_PDR' })));
              }}
              className={`py-2 px-2 rounded-xl text-xs font-bold transition border cursor-pointer flex items-center justify-center gap-1.5 ${
                form.item_source === 'STOCK_PDR'
                  ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-bold ring-2 ring-emerald-500/20 shadow-2xs'
                  : 'bg-white/90 text-slate-700 border-slate-200 hover:bg-emerald-50/40 hover:border-emerald-200 hover:text-emerald-900'
              }`}
            >
              <Package className={`w-3.5 h-3.5 ${form.item_source === 'STOCK_PDR' ? 'text-emerald-600' : 'text-emerald-600/80'}`} />
              <span>PDR (Stock)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setForm({ ...form, item_source: 'WAREHOUSE_PARTIE' });
                setMouvementItems(mouvementItems.map((i) => ({ ...i, source: 'WAREHOUSE_PARTIE' })));
              }}
              className={`py-2 px-2 rounded-xl text-xs font-bold transition border cursor-pointer flex items-center justify-center gap-1.5 ${
                form.item_source === 'WAREHOUSE_PARTIE'
                  ? 'bg-purple-50 border-purple-400 text-purple-950 font-bold ring-2 ring-purple-500/20 shadow-2xs'
                  : 'bg-white/90 text-slate-700 border-slate-200 hover:bg-purple-50/40 hover:border-purple-200 hover:text-purple-900'
              }`}
            >
              <Layers className={`w-3.5 h-3.5 ${form.item_source === 'WAREHOUSE_PARTIE' ? 'text-purple-600' : 'text-purple-600/80'}`} />
              <span>PARTIE (Entrepôt)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setForm({ ...form, item_source: 'WAREHOUSE_COMPOSANT' });
                setMouvementItems(mouvementItems.map((i) => ({ ...i, source: 'WAREHOUSE_COMPOSANT' })));
              }}
              className={`py-2 px-2 rounded-xl text-xs font-bold transition border cursor-pointer flex items-center justify-center gap-1.5 ${
                form.item_source === 'WAREHOUSE_COMPOSANT'
                  ? 'bg-indigo-50 border-indigo-400 text-indigo-950 font-bold ring-2 ring-indigo-500/20 shadow-2xs'
                  : 'bg-white/90 text-slate-700 border-slate-200 hover:bg-indigo-50/40 hover:border-indigo-200 hover:text-indigo-900'
              }`}
            >
              <Puzzle className={`w-3.5 h-3.5 ${form.item_source === 'WAREHOUSE_COMPOSANT' ? 'text-indigo-600' : 'text-indigo-600/80'}`} />
              <span>COMPOSANT</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. DYNAMIC DESTINATION SELECTOR FOR ENTRÉE INTERNE */}
      {isEntreeInterne && (
        <div className="p-3 bg-cyan-50/50 rounded-xl border border-cyan-200 space-y-2">
          <label className="text-[10.5px] font-bold text-cyan-950 uppercase tracking-wider block flex items-center gap-1.5">
            <RotateCcw className="w-3.5 h-3.5 text-cyan-700" />
            <span>Destination de l&apos;Entrée / Remise :</span>
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => {
                setForm({ ...form, destination_type: 'STOCK_PDR', item_source: 'STOCK_PDR' });
                setMouvementItems(mouvementItems.map((i) => ({ ...i, source: 'STOCK_PDR' })));
              }}
              className={`py-2 px-2 rounded-xl text-xs font-bold transition border cursor-pointer flex items-center justify-center gap-1.5 ${
                form.destination_type === 'STOCK_PDR'
                  ? 'bg-cyan-50 border-cyan-400 text-cyan-950 font-bold ring-2 ring-cyan-500/20 shadow-2xs'
                  : 'bg-white/90 text-slate-700 border-slate-200 hover:bg-cyan-50/40 hover:border-cyan-200 hover:text-cyan-900'
              }`}
            >
              <Package className={`w-3.5 h-3.5 ${form.destination_type === 'STOCK_PDR' ? 'text-cyan-600' : 'text-cyan-600/80'}`} />
              <span>Magasin PDR</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setForm({ ...form, destination_type: 'WAREHOUSE_PARTIE', item_source: 'WAREHOUSE_PARTIE' });
                setMouvementItems(mouvementItems.map((i) => ({ ...i, source: 'WAREHOUSE_PARTIE' })));
              }}
              className={`py-2 px-2 rounded-xl text-xs font-bold transition border cursor-pointer flex items-center justify-center gap-1.5 ${
                form.destination_type === 'WAREHOUSE_PARTIE'
                  ? 'bg-purple-50 border-purple-400 text-purple-950 font-bold ring-2 ring-purple-500/20 shadow-2xs'
                  : 'bg-white/90 text-slate-700 border-slate-200 hover:bg-purple-50/40 hover:border-purple-200 hover:text-purple-900'
              }`}
            >
              <Layers className={`w-3.5 h-3.5 ${form.destination_type === 'WAREHOUSE_PARTIE' ? 'text-purple-600' : 'text-purple-600/80'}`} />
              <span>Entrepôt: PARTIE</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setForm({ ...form, destination_type: 'WAREHOUSE_COMPOSANT', item_source: 'WAREHOUSE_COMPOSANT' });
                setMouvementItems(mouvementItems.map((i) => ({ ...i, source: 'WAREHOUSE_COMPOSANT' })));
              }}
              className={`py-2 px-2 rounded-xl text-xs font-bold transition border cursor-pointer flex items-center justify-center gap-1.5 ${
                form.destination_type === 'WAREHOUSE_COMPOSANT'
                  ? 'bg-indigo-50 border-indigo-400 text-indigo-950 font-bold ring-2 ring-indigo-500/20 shadow-2xs'
                  : 'bg-white/90 text-slate-700 border-slate-200 hover:bg-indigo-50/40 hover:border-indigo-200 hover:text-indigo-900'
              }`}
            >
              <Puzzle className={`w-3.5 h-3.5 ${form.destination_type === 'WAREHOUSE_COMPOSANT' ? 'text-indigo-600' : 'text-indigo-600/80'}`} />
              <span>Entrepôt: COMPOSANT</span>
            </button>
          </div>
        </div>
      )}

      {/* 4. DYNAMIC SOURCE SELECTOR FOR BON DE SORTIE */}
      {isBonSortie && (
        <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-200 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[10.5px] font-bold text-purple-950 uppercase tracking-wider block flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-purple-700" />
              <span>Source Matériel (Entrepôt Sortant) :</span>
            </label>
            <span className="text-[10px] text-purple-700 font-semibold italic">
              Priorité : PARTIE & COMPOSANT
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => {
                setForm({ ...form, item_source: 'WAREHOUSE_PARTIE' });
                setMouvementItems(mouvementItems.map((i) => ({ ...i, source: 'WAREHOUSE_PARTIE' })));
              }}
              className={`py-2 px-2 rounded-xl text-xs font-bold transition border cursor-pointer flex items-center justify-center gap-1.5 ${
                form.item_source === 'WAREHOUSE_PARTIE'
                  ? 'bg-purple-50 border-purple-400 text-purple-950 font-bold ring-2 ring-purple-500/20 shadow-2xs'
                  : 'bg-white/90 text-slate-700 border-slate-200 hover:bg-purple-50/40 hover:border-purple-200 hover:text-purple-900'
              }`}
            >
              <Layers className={`w-3.5 h-3.5 ${form.item_source === 'WAREHOUSE_PARTIE' ? 'text-purple-600' : 'text-purple-600/80'}`} />
              <span className="truncate">PARTIE (Organe)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setForm({ ...form, item_source: 'WAREHOUSE_COMPOSANT' });
                setMouvementItems(mouvementItems.map((i) => ({ ...i, source: 'WAREHOUSE_COMPOSANT' })));
              }}
              className={`py-2 px-2 rounded-xl text-xs font-bold transition border cursor-pointer flex items-center justify-center gap-1.5 ${
                form.item_source === 'WAREHOUSE_COMPOSANT'
                  ? 'bg-indigo-50 border-indigo-400 text-indigo-950 font-bold ring-2 ring-indigo-500/20 shadow-2xs'
                  : 'bg-white/90 text-slate-700 border-slate-200 hover:bg-indigo-50/40 hover:border-indigo-200 hover:text-indigo-900'
              }`}
            >
              <Puzzle className={`w-3.5 h-3.5 ${form.item_source === 'WAREHOUSE_COMPOSANT' ? 'text-indigo-600' : 'text-indigo-600/80'}`} />
              <span className="truncate">COMPOSANT (Moteur...)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setForm({ ...form, item_source: 'STOCK_PDR' });
                setMouvementItems(mouvementItems.map((i) => ({ ...i, source: 'STOCK_PDR' })));
              }}
              className={`py-2 px-2 rounded-xl text-xs font-bold transition border cursor-pointer flex items-center justify-center gap-1.5 ${
                form.item_source === 'STOCK_PDR'
                  ? 'bg-amber-50 border-amber-400 text-amber-950 font-bold ring-2 ring-amber-500/20 shadow-2xs'
                  : 'bg-white/90 text-slate-700 border-slate-200 hover:bg-amber-50/40 hover:border-amber-200 hover:text-amber-900'
              }`}
              title="Exception PDR de haute valeur (Carte électronique, automate)"
            >
              <Package className={`w-3.5 h-3.5 ${form.item_source === 'STOCK_PDR' ? 'text-amber-600' : 'text-amber-600/80'}`} />
              <span className="truncate">PDR (Exception)</span>
            </button>
          </div>
        </div>
      )}

      {/* 5. DYNAMIC TARGET SELECTOR FOR DEMANDE D'ACHAT (PDR, Components, Parts) */}
      {isCommandeFlow && (
        <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-200 space-y-2">
          <label className="text-[10.5px] font-bold text-amber-950 uppercase tracking-wider block flex items-center gap-1.5">
            <ShoppingCart className="w-3.5 h-3.5 text-amber-700" />
            <span>Catégorie de la Demande d&apos;Achat :</span>
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => {
                setForm({ ...form, item_source: 'STOCK_PDR' });
                setMouvementItems(mouvementItems.map((i) => ({ ...i, source: 'STOCK_PDR' })));
              }}
              className={`py-2 px-2 rounded-xl text-xs font-bold transition border cursor-pointer flex items-center justify-center gap-1.5 ${
                form.item_source === 'STOCK_PDR'
                  ? 'bg-amber-50 border-amber-400 text-amber-950 font-bold ring-2 ring-amber-500/20 shadow-2xs'
                  : 'bg-white/90 text-slate-700 border-slate-200 hover:bg-amber-50/40 hover:border-amber-200 hover:text-amber-900'
              }`}
            >
              <Package className={`w-3.5 h-3.5 ${form.item_source === 'STOCK_PDR' ? 'text-amber-600' : 'text-amber-600/80'}`} />
              <span>PDR (Stock)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setForm({ ...form, item_source: 'WAREHOUSE_PARTIE' });
                setMouvementItems(mouvementItems.map((i) => ({ ...i, source: 'WAREHOUSE_PARTIE' })));
              }}
              className={`py-2 px-2 rounded-xl text-xs font-bold transition border cursor-pointer flex items-center justify-center gap-1.5 ${
                form.item_source === 'WAREHOUSE_PARTIE'
                  ? 'bg-purple-50 border-purple-400 text-purple-950 font-bold ring-2 ring-purple-500/20 shadow-2xs'
                  : 'bg-white/90 text-slate-700 border-slate-200 hover:bg-purple-50/40 hover:border-purple-200 hover:text-purple-900'
              }`}
            >
              <Layers className={`w-3.5 h-3.5 ${form.item_source === 'WAREHOUSE_PARTIE' ? 'text-purple-600' : 'text-purple-600/80'}`} />
              <span>PARTIE (Entrepôt)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setForm({ ...form, item_source: 'WAREHOUSE_COMPOSANT' });
                setMouvementItems(mouvementItems.map((i) => ({ ...i, source: 'WAREHOUSE_COMPOSANT' })));
              }}
              className={`py-2 px-2 rounded-xl text-xs font-bold transition border cursor-pointer flex items-center justify-center gap-1.5 ${
                form.item_source === 'WAREHOUSE_COMPOSANT'
                  ? 'bg-indigo-50 border-indigo-400 text-indigo-950 font-bold ring-2 ring-indigo-500/20 shadow-2xs'
                  : 'bg-white/90 text-slate-700 border-slate-200 hover:bg-indigo-50/40 hover:border-indigo-200 hover:text-indigo-900'
              }`}
            >
              <Puzzle className={`w-3.5 h-3.5 ${form.item_source === 'WAREHOUSE_COMPOSANT' ? 'text-indigo-600' : 'text-indigo-600/80'}`} />
              <span>COMPOSANT</span>
            </button>
          </div>
        </div>
      )}

      {/* 6. DYNAMIC CATEGORY & RETURN TRACKER SELECTOR FOR ENTRÉE EXTERNE */}
      {isEntreeExterne && (
        <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-200 space-y-2.5">
          <label className="text-[10.5px] font-bold text-emerald-950 uppercase tracking-wider block flex items-center gap-1.5">
            <Inbox className="w-3.5 h-3.5 text-emerald-700" />
            <span>Catégorie de Réception / Destination :</span>
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => {
                setForm({ ...form, destination_type: 'STOCK_PDR', item_source: 'STOCK_PDR' });
                setMouvementItems(mouvementItems.map((i) => ({ ...i, source: 'STOCK_PDR' })));
              }}
              className={`py-2 px-2 rounded-xl text-xs font-bold transition border cursor-pointer flex items-center justify-center gap-1.5 ${
                form.destination_type === 'STOCK_PDR'
                  ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-bold ring-2 ring-emerald-500/20 shadow-2xs'
                  : 'bg-white/90 text-slate-700 border-slate-200 hover:bg-emerald-50/40 hover:border-emerald-200 hover:text-emerald-900'
              }`}
            >
              <Package className={`w-3.5 h-3.5 ${form.destination_type === 'STOCK_PDR' ? 'text-emerald-600' : 'text-emerald-600/80'}`} />
              <span>PDR (Stock)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setForm({ ...form, destination_type: 'WAREHOUSE_PARTIE', item_source: 'WAREHOUSE_PARTIE' });
                setMouvementItems(mouvementItems.map((i) => ({ ...i, source: 'WAREHOUSE_PARTIE' })));
              }}
              className={`py-2 px-2 rounded-xl text-xs font-bold transition border cursor-pointer flex items-center justify-center gap-1.5 ${
                form.destination_type === 'WAREHOUSE_PARTIE'
                  ? 'bg-purple-50 border-purple-400 text-purple-950 font-bold ring-2 ring-purple-500/20 shadow-2xs'
                  : 'bg-white/90 text-slate-700 border-slate-200 hover:bg-purple-50/40 hover:border-purple-200 hover:text-purple-900'
              }`}
            >
              <Layers className={`w-3.5 h-3.5 ${form.destination_type === 'WAREHOUSE_PARTIE' ? 'text-purple-600' : 'text-purple-600/80'}`} />
              <span>PARTIE (Entrepôt)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setForm({ ...form, destination_type: 'WAREHOUSE_COMPOSANT', item_source: 'WAREHOUSE_COMPOSANT' });
                setMouvementItems(mouvementItems.map((i) => ({ ...i, source: 'WAREHOUSE_COMPOSANT' })));
              }}
              className={`py-2 px-2 rounded-xl text-xs font-bold transition border cursor-pointer flex items-center justify-center gap-1.5 ${
                form.destination_type === 'WAREHOUSE_COMPOSANT'
                  ? 'bg-indigo-50 border-indigo-400 text-indigo-950 font-bold ring-2 ring-indigo-500/20 shadow-2xs'
                  : 'bg-white/90 text-slate-700 border-slate-200 hover:bg-indigo-50/40 hover:border-indigo-200 hover:text-indigo-900'
              }`}
            >
              <Puzzle className={`w-3.5 h-3.5 ${form.destination_type === 'WAREHOUSE_COMPOSANT' ? 'text-indigo-600' : 'text-indigo-600/80'}`} />
              <span>COMPOSANT</span>
            </button>
          </div>

          {/* Return Tracker Bar from Bon de Sortie (Repairs) and Demandes d'Achat (Orders) */}
          {(activeExternalRepairs.length > 0 || pendingOrders.length > 0) && (
            <div className="pt-2 border-t border-emerald-200/70 space-y-1.5">
              <div className="text-[10px] font-bold text-emerald-900 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <RotateCcw className="w-3 h-3 text-emerald-700" />
                  <span>Traçabilité des Retours & Commandes en Attente :</span>
                </span>
                <span className="font-mono text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                  {activeExternalRepairs.length + pendingOrders.length} en attente
                </span>
              </div>

              <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                {/* Active Repairs in Bon de Sortie */}
                {activeExternalRepairs.map((rep, idx) => (
                  <button
                    key={`track-rep-${rep.id ?? ''}-${rep.code_bon ?? ''}-${idx}`}
                    type="button"
                    onClick={() => handleReceiveRepairReturn(rep)}
                    className="px-2 py-1 rounded-lg bg-white hover:bg-purple-50 border border-purple-200 text-purple-950 text-[10.5px] font-semibold flex items-center gap-1 transition cursor-pointer shadow-2xs"
                    title="Réceptionner le retour de cet équipement réparé"
                  >
                    <Truck className="w-3 h-3 text-purple-600 shrink-0" />
                    <span className="font-mono font-bold text-[10px] text-purple-800">{rep.code_bon}</span>
                    <span className="truncate max-w-[100px]">{rep.ref}</span>
                    <span className="text-[9px] text-purple-500 font-mono">({rep.quantite} pcs)</span>
                  </button>
                ))}

                {/* Pending Orders from Demandes d'Achat */}
                {pendingOrders.map((ord, idx) => (
                  <button
                    key={`track-ord-${ord.id ?? ''}-${ord.code_bon ?? ''}-${idx}`}
                    type="button"
                    onClick={() => handleFulfillOrder(ord)}
                    className="px-2 py-1 rounded-lg bg-white hover:bg-amber-50 border border-amber-200 text-amber-950 text-[10.5px] font-semibold flex items-center gap-1 transition cursor-pointer shadow-2xs"
                    title="Réceptionner cette commande livrée par le fournisseur"
                  >
                    <ShoppingCart className="w-3 h-3 text-amber-600 shrink-0" />
                    <span className="font-mono font-bold text-[10px] text-amber-800">{ord.num_commande || ord.code_bon}</span>
                    <span className="truncate max-w-[100px]">{ord.ref}</span>
                    <span className="text-[9px] text-amber-500 font-mono">({ord.quantite} pcs)</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. DATE, HEURE & OT/CMD REFERENCE */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div>
          <label className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
            Date
          </label>
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            className="w-full h-8 px-2.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-800"
            required
          />
        </div>

        <div>
          <label className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider block mb-1 flex items-center justify-between">
            <span>Heure</span>
            <span className="text-[9.5px] text-indigo-600 font-mono font-medium flex items-center gap-0.5">
              <Clock className="w-2.5 h-2.5" /> Auto
            </span>
          </label>
          <input
            type="time"
            value={form.heure || ''}
            onChange={(e) => setForm({ ...form, heure: e.target.value })}
            className="w-full h-8 px-2.5 rounded-xl border border-slate-200 bg-white text-xs font-mono text-slate-800"
            required
          />
        </div>

        <div>
          <label className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
            N° OT / Commande / Réf
          </label>
          <input
            type="text"
            placeholder="Ex: OT-2026-042"
            value={form.num_commande}
            onChange={(e) => setForm({ ...form, num_commande: e.target.value })}
            className="w-full h-8 px-2.5 rounded-xl border border-slate-200 bg-white text-xs font-mono text-slate-800"
          />
        </div>
      </div>
    </div>
  );
}

export function findSupervisorForZoneHelper(zoneId: string, responsablesList: any[]) {
  if (!zoneId) return responsablesList[0] || null;

  const hasTpl = (s: any, tplId: string) => {
    if (
      Array.isArray(s.templates) &&
      s.templates.some((t: any) => (typeof t === 'string' ? t : t?.id) === tplId)
    ) {
      return true;
    }
    if (Array.isArray(s.template_ids) && s.template_ids.includes(tplId)) return true;
    if (typeof s.template_id === 'string' && s.template_id.includes(tplId)) return true;
    return false;
  };

  const zoneMatches = (s: any) =>
    (s.zones && (s.zones.includes(zoneId) || s.zones.includes('ALL'))) ||
    s.id_zone === zoneId ||
    s.id_zone === 'ALL' ||
    (typeof s.id_zone === 'string' &&
      s.id_zone
        .split(',')
        .map((x: string) => x.trim())
        .includes(zoneId));

  const rzn = responsablesList.find((s) => hasTpl(s, 'RZN') && zoneMatches(s));
  if (rzn) return rzn;

  const rmt = responsablesList.find((s) => hasTpl(s, 'RMT') && zoneMatches(s));
  if (rmt) return rmt;

  const directMatch = responsablesList.find((s) => zoneMatches(s));
  if (directMatch) return directMatch;

  return responsablesList[0] || null;
}

export function buildUnifiedMovementSearchCatalog(stockItems: any[], warehouseItems: any[]) {
  const catalog: any[] = [];

  stockItems.forEach((s) => {
    if (!s || s.is_active === false || s.actif === false || s.statut === 'ARCHIVE') return;
    catalog.push({
      id: `PDR-${s.id || s.ref}`,
      source: 'STOCK_PDR',
      ref: s.ref,
      code: s.ref,
      designation: s.designation,
      category: 'PDR Consommable',
      badge: 'Stock PDR',
      badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      stockActuel: s.stockActuel ?? s.stockInitial ?? 0,
      emplacement: s.emplacement || 'Magasin Central',
      type: s.id_type || 'PDR',
      unit: 'pcs',
      raw: s,
    });
  });

  warehouseItems.forEach((w) => {
    if (
      !w ||
      w.is_active === false ||
      w.actif === false ||
      w.statut === 'ARCHIVE' ||
      w.etat === 'ARCHIVE'
    ) {
      return;
    }
    const isPartie = w.category === 'PARTIE' || w.nature === 'PARTIE';
    const codeStr = w.id_warehouse_item || w.code || w.ref || `EXT-${w.id}`;
    catalog.push({
      id: `WH-${w.id || w.id_warehouse_item || w.code}`,
      source: isPartie ? 'WAREHOUSE_PARTIE' : 'WAREHOUSE_COMPOSANT',
      ref: codeStr,
      code: codeStr,
      designation: w.designation || w.nom || '',
      category: isPartie ? 'PARTIE (Machine Twin)' : 'COMPOSANT (Stock Twin)',
      badge: isPartie ? 'Entrepôt: PARTIE' : 'Entrepôt: COMPOSANT',
      badgeColor: isPartie
        ? 'bg-purple-50 text-purple-800 border-purple-200'
        : 'bg-blue-50 text-blue-800 border-blue-200',
      stockActuel: w.quantite ?? w.stockActuel ?? 1,
      emplacement: w.emplacement || w.rattachement_val || 'Entrepôt',
      type: isPartie ? w.id_family || 'Machine' : w.id_type || 'Composant',
      unit: w.unite || 'pcs',
      etat: w.etat || 'Fonctionnel',
      raw: w,
    });
  });

  return catalog;
}

export function filterMovementCatalogResults(
  unifiedSearchCatalog: any[],
  searchActiveTab: string,
  searchQuery: string
) {
  return unifiedSearchCatalog.filter((item) => {
    if (searchActiveTab !== 'ALL' && item.source !== searchActiveTab) {
      return false;
    }
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      String(item.ref || '').toLowerCase().includes(q) ||
      String(item.designation || '').toLowerCase().includes(q) ||
      String(item.category || '').toLowerCase().includes(q) ||
      String(item.emplacement || '').toLowerCase().includes(q) ||
      String(item.type || '').toLowerCase().includes(q)
    );
  });
}
