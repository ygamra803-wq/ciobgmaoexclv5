import type { Dispatch, ReactNode, SetStateAction } from 'react';
import {
  Activity,
  AlertTriangle,
  Calculator,
  Check,
  FileSpreadsheet,
  Layers,
  Package,
  Plus,
  Puzzle,
  Search,
  ShieldCheck,
  Tag,
  TrendingUp,
  X,
} from 'lucide-react';
import type { ClaimReconciliationResult } from '../../../../core/security/validationReconciliation';

export interface SortieDemandItemSummary {
  ref: string;
  designation?: string;
  quantite: number;
  unit?: string;
  source?: string;
  emplacement?: string;
}

export interface SortieDemandRecord {
  id: string;
  code_bon_tech?: string;
  code_bon_magasin?: string;
  technicien?: string;
  date?: string;
  heure?: string;
  id_zone?: string;
  id_machine_registered?: string;
  num_commande?: string;
  action_id?: string;
  commentaire?: string;
  validation_status?: string;
  validation_note?: string;
  discrepancy_status?: string;
  items?: SortieDemandItemSummary[];
}

export interface UnifiedCatalogItem {
  id: string;
  source: string;
  ref: string;
  code: string;
  designation: string;
  category: string;
  badge: string;
  badgeColor: string;
  stockActuel: number;
  emplacement: string;
  type: string;
  unit: string;
  etat?: string;
}

export interface WarehousePreviewItem {
  category?: string;
  nature?: string;
}

export interface SortieSuccessAlertModalProps {
  open: boolean;
}

export function SortieSuccessAlertModal({ open }: SortieSuccessAlertModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in zoom-in duration-200">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-emerald-200 flex flex-col items-center text-center space-y-4">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
          <Check className="w-8 h-8" />
        </div>
        <div>
          <h3 className="font-bold text-slate-900 text-lg">Opération réussie !</h3>
          <p className="text-slate-500 text-sm mt-1">
            Le bon a été enregistré avec succès et le formulaire a été réinitialisé.
          </p>
        </div>
      </div>
    </div>
  );
}

export interface SortieValidationAlertModalProps {
  open: boolean;
  errors: string[];
  onClose: () => void;
}

export function SortieValidationAlertModal({
  open,
  errors,
  onClose,
}: SortieValidationAlertModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in zoom-in duration-200">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-rose-200 flex flex-col space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-lg">Formulaire incomplet</h3>
            <p className="text-slate-500 text-sm mt-1">
              Veuillez corriger les erreurs suivantes avant de valider :
            </p>
          </div>
        </div>
        <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 max-h-[40vh] overflow-y-auto">
          <ul className="space-y-1.5 text-sm text-rose-800 list-disc list-inside">
            {errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
        <button
          onClick={onClose}
          className="w-full h-10 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition-colors cursor-pointer"
        >
          Compris, je vais corriger
        </button>
      </div>
    </div>
  );
}

export interface SortieDemandReviewModalProps {
  reviewDemand: SortieDemandRecord | null;
  reconciliation: ClaimReconciliationResult | null;
  reviewCodeBonMagasin: string;
  setReviewCodeBonMagasin: (value: string) => void;
  reviewMergeMovementId: string;
  setReviewMergeMovementId: (value: string) => void;
  reviewDemandItems: SortieDemandItemSummary[];
  setReviewDemandItems: Dispatch<SetStateAction<SortieDemandItemSummary[]>>;
  reviewDemandNote: string;
  setReviewDemandNote: (value: string) => void;
  onClose: () => void;
  onDecision: (decision: 'APPROVED' | 'NEEDS_CLARIFICATION' | 'REJECTED') => void;
}

export function SortieDemandReviewModal({
  reviewDemand,
  reconciliation,
  reviewCodeBonMagasin,
  setReviewCodeBonMagasin,
  reviewMergeMovementId,
  setReviewMergeMovementId,
  reviewDemandItems,
  setReviewDemandItems,
  reviewDemandNote,
  setReviewDemandNote,
  onClose,
  onDecision,
}: SortieDemandReviewModalProps) {
  if (!reviewDemand) return null;

  return (
    <div
      data-testid="sortie-demand-review-modal"
      className="fixed inset-0 bg-slate-900/55 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in"
    >
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-gradient-to-r from-purple-50 to-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">
                Contrôle & Réconciliation Demande Sortie Terrain (V3+V4)
              </h3>
              <p className="text-[11px] text-slate-500 font-mono">
                Bon Tech: {reviewDemand.code_bon_tech} • Technicien: {reviewDemand.technicien} •{' '}
                {reviewDemand.date}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {reconciliation && reconciliation.alerts.length > 0 && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
              <div className="font-black text-amber-950 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Diagnostic de Réconciliation V4 (Bon & Stock)</span>
              </div>
              <div className="space-y-1.5">
                {reconciliation.alerts.map((al, i) => (
                  <div
                    key={i}
                    className={`p-2 rounded-lg border text-[11px] ${
                      String(al.severity || '').toUpperCase() === 'CRITICAL'
                        ? 'bg-rose-50 border-rose-200 text-rose-900'
                        : 'bg-white border-amber-200 text-amber-900'
                    }`}
                  >
                    <div className="font-bold">{al.title}</div>
                    <div className="text-[10.5px] opacity-90">{al.detail}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {reconciliation && reconciliation.candidateStoreMovements.length > 0 && (
            <div className="p-3.5 rounded-xl bg-indigo-50/80 border border-indigo-200 space-y-2">
              <label className="font-black text-indigo-950 block">
                Appairage / Fusion V4 avec un Bon Magasin existant (sans double déduction) :
              </label>
              <p className="text-[11px] text-indigo-800">
                Si le magasinier a déjà saisi cette sortie sous un autre numéro de bon (ex:{' '}
                <span className="font-mono font-bold">BS-109</span> au lieu de{' '}
                <span className="font-mono font-bold">{reviewDemand.code_bon_tech}</span>),
                sélectionnez-le pour fusionner les deux enregistrements sans re-déduire le stock :
              </p>
              <select
                value={reviewMergeMovementId}
                onChange={(e) => setReviewMergeMovementId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white border border-indigo-300 font-mono text-xs font-bold text-slate-900"
              >
                <option value="">
                  — Ne pas fusionner (Créer un nouveau mouvement et déduire le stock) —
                </option>
                {reconciliation.candidateStoreMovements.map((cand) => {
                  const candId = cand.movementId || cand.code_bon;
                  return (
                    <option key={candId} value={candId}>
                      Fusionner avec Bon Magasin {cand.code_bon} ({cand.ref} ×{cand.quantite} •{' '}
                      {cand.date} • {cand.technicien}) — Zéro double déduction
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                N° Bon Saisi par le Technicien (Terrain)
              </label>
              <input
                type="text"
                disabled
                value={reviewDemand.code_bon_tech || ''}
                className="w-full px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 font-mono text-xs text-slate-600"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                N° Bon Officiel Magasin (Registre)
              </label>
              <input
                type="text"
                value={reviewCodeBonMagasin}
                onChange={(e) => setReviewCodeBonMagasin(e.target.value)}
                placeholder="Ex: BS-109"
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 font-mono text-xs font-bold text-slate-900"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="font-bold text-slate-800">Articles & Quantités à valider :</div>
            {reviewDemandItems.map((it, idx) => (
              <div
                key={`${it.ref}-${idx}`}
                className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3"
              >
                <div>
                  <div className="font-mono font-bold text-slate-900">{it.ref}</div>
                  <div className="text-[11px] text-slate-600">{it.designation}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-500">Qté retenue :</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={it.quantite}
                    onChange={(e) => {
                      const val = Math.max(0, Number(e.target.value) || 0);
                      setReviewDemandItems((prev) =>
                        prev.map((row, rIdx) => (rIdx === idx ? { ...row, quantite: val } : row))
                      );
                    }}
                    className="w-20 px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 font-mono font-bold text-right"
                  />
                </div>
              </div>
            ))}
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Note de validation ou motif d&apos;écart (obligatoire si À clarifier / Rejeté)
            </label>
            <textarea
              rows={2}
              value={reviewDemandNote}
              onChange={(e) => setReviewDemandNote(e.target.value)}
              placeholder="Ex: Bon BS-104 fusionné avec BS-109 du carnet magasin, ou préciser pourquoi la quantité diffère..."
              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs"
            />
          </div>
        </div>

        <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onDecision('NEEDS_CLARIFICATION')}
              className="px-3 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 font-bold text-xs cursor-pointer transition"
            >
              À Clarifier (Écart Bon/Qté)
            </button>
            <button
              type="button"
              onClick={() => onDecision('REJECTED')}
              className="px-3 py-2 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-900 border border-rose-300 font-bold text-xs cursor-pointer transition"
            >
              Rejeter sans déduction
            </button>
          </div>

          <button
            type="button"
            onClick={() => onDecision('APPROVED')}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm cursor-pointer transition flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            <span>
              {reviewMergeMovementId
                ? 'Approuver & Fusionner (Sans Double Déduction)'
                : 'Approuver & Déduire du Stock'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

export interface UnifiedArticleSearchModalProps {
  open: boolean;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  searchActiveTab: string;
  stockCount: number;
  warehouseItems: WarehousePreviewItem[];
  filteredCatalogResults: UnifiedCatalogItem[];
  highlightMatch: (text: string, query: string) => ReactNode;
  onSelectCatalogItem: (item: UnifiedCatalogItem) => void;
  onClose: () => void;
  onOpenAddArticle?: (() => void) | null;
  onOpenAddMachine?: (() => void) | null;
}

export function UnifiedArticleSearchModal({
  open,
  searchQuery,
  setSearchQuery,
  searchActiveTab,
  stockCount,
  warehouseItems,
  filteredCatalogResults,
  highlightMatch,
  onSelectCatalogItem,
  onClose,
  onOpenAddArticle,
  onOpenAddMachine,
}: UnifiedArticleSearchModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700">
              <Search className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">Catalogue Unifié des Pièces & Équipements</h3>
              <p className="text-xs text-slate-500">
                Recherche instantanée dans le Stock PDR et le Registre de l&apos;Entrepôt
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 border-b border-slate-100 bg-slate-50/50 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Tapez un mot-clé (ex: 6204, Moteur, POMPE, Courroie, R1...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-900 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
              <span className="text-slate-400 font-bold text-[10.5px] uppercase shrink-0">
                Source Sélectionnée :
              </span>
              {searchActiveTab === 'STOCK_PDR' && (
                <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-lg font-bold inline-flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-emerald-700" />
                  Catalogue PDR ({stockCount})
                </span>
              )}
              {searchActiveTab === 'WAREHOUSE_PARTIE' && (
                <span className="bg-purple-100 text-purple-800 border border-purple-200 px-2.5 py-1 rounded-lg font-bold inline-flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-purple-700" />
                  Entrepôt: PARTIES ({warehouseItems.filter((w) => w.category === 'PARTIE' || w.nature === 'PARTIE').length})
                </span>
              )}
              {searchActiveTab === 'WAREHOUSE_COMPOSANT' && (
                <span className="bg-indigo-100 text-indigo-800 border border-indigo-200 px-2.5 py-1 rounded-lg font-bold inline-flex items-center gap-1.5">
                  <Puzzle className="w-3.5 h-3.5 text-indigo-700" />
                  Entrepôt: COMPOSANTS ({warehouseItems.filter((w) => w.category === 'COMPOSANT' || w.nature === 'COMPOSANT').length})
                </span>
              )}
            </div>
            {searchActiveTab === 'STOCK_PDR' && onOpenAddArticle && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAddArticle();
                }}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 font-bold transition cursor-pointer text-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Créer Nouvelle PDR</span>
              </button>
            )}
            {searchActiveTab === 'WAREHOUSE_PARTIE' && onOpenAddMachine && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAddMachine();
                }}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 font-bold transition cursor-pointer text-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Créer Nouvelle Machine</span>
              </button>
            )}
          </div>
        </div>

        <div className="p-4 flex-1 overflow-y-auto max-h-[50vh] space-y-2">
          {filteredCatalogResults.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Package className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <p className="text-xs">Aucun article trouvé pour &quot;{searchQuery}&quot;</p>
            </div>
          ) : (
            filteredCatalogResults.map((art, idx) => (
              <div
                key={`cat-item-${art.id ?? ''}-${art.ref ?? ''}-${idx}`}
                onClick={() => onSelectCatalogItem(art)}
                className="p-3 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30 transition cursor-pointer flex items-center justify-between gap-3 shadow-2xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs text-indigo-950">
                      {highlightMatch(art.ref, searchQuery)}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${art.badgeColor}`}>
                      {art.badge}
                    </span>
                    {art.stockActuel <= 0 && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 font-bold border border-rose-200">
                        Rupture
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-700 font-medium">
                    {highlightMatch(art.designation, searchQuery)}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Emplacement : <b className="font-mono text-slate-600">{art.emplacement}</b> • Type :{' '}
                    <b className="font-mono text-slate-600">{art.type}</b>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-[10px] text-slate-400">Disponible</div>
                  <div
                    className={`font-mono font-bold text-sm ${
                      art.stockActuel <= 0 ? 'text-rose-600' : 'text-emerald-700'
                    }`}
                  >
                    {art.stockActuel} {art.unit}
                  </div>
                  <button
                    type="button"
                    className="mt-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded cursor-pointer"
                  >
                    Sélectionner
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export interface MovementFormulasPreviewModalProps {
  open: boolean;
  onClose: () => void;
}

export function MovementFormulasPreviewModal({
  open,
  onClose,
}: MovementFormulasPreviewModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-5 space-y-4 animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 shrink-0">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>Formules Excel Miroir — Journal des Mouvements</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Feuille Mouvements
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Calculs de solde, numérotation séquentielle des bons et agrégations SUMIFS
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-blue-300 transition">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                <Tag className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span className="truncate">Séquence Code Bon (Col. B)</span>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-100/80 text-blue-800 border border-blue-200 shrink-0">
                Bon-xxx
              </span>
            </div>
            <div className="font-mono text-xs text-blue-800 font-bold bg-white p-2 rounded-lg border border-blue-100">
              =&quot;Bon-&quot; &amp; TEXT(COUNTIF(Mvt[Code],&quot;*&quot;)+1, &quot;003&quot;)
            </div>
            <p className="text-[10.5px] text-slate-500 leading-tight">
              Incrémentation automatique du numéro d&apos;ordre pour chaque bon de sortie, entrée ou réception.
            </p>
          </div>

          <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-emerald-300 transition">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="truncate">Impact Sur Solde (Stock)</span>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-100/80 text-emerald-800 border border-emerald-200 shrink-0">
                Apres = Avant ± Qte
              </span>
            </div>
            <div className="font-mono text-xs text-emerald-800 font-bold bg-white p-2 rounded-lg border border-emerald-100">
              =IF(Type=&quot;Entrée&quot;, Stock_Avant+Qté, Stock_Avant-Qté)
            </div>
            <p className="text-[10.5px] text-slate-500 leading-tight">
              Calcul du stock théorique après mouvement de manière synchrone avant enregistrement.
            </p>
          </div>

          <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-purple-300 transition">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                <FileSpreadsheet className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                <span className="truncate">Agrégation Totale SUMIFS</span>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-purple-100/80 text-purple-800 border border-purple-200 shrink-0">
                Stock_Actuel
              </span>
            </div>
            <div className="font-mono text-xs text-purple-800 font-bold bg-white p-2 rounded-lg border border-purple-100">
              =SUMIFS(Mvt[Qté], Mvt[Ref], [@Ref], Mvt[Type], &quot;Sortie&quot;)
            </div>
            <p className="text-[10.5px] text-slate-500 leading-tight">
              Formule miroir injectée dans le tableau général de stock pour cumuler les sorties et entrées.
            </p>
          </div>

          <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-amber-300 transition">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                <Activity className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span className="truncate">Typologie Interventions</span>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-100/80 text-amber-800 border border-amber-200 shrink-0">
                action_id
              </span>
            </div>
            <div className="font-mono text-xs text-amber-800 font-bold bg-white p-2 rounded-lg border border-amber-100">
              CORRECTIVE | PREVENTIVE | USAGE | REAPPRO
            </div>
            <p className="text-[10.5px] text-slate-500 leading-tight">
              Qualification du type de travail et pré-filtrage dynamique des machines et responsables.
            </p>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
          <span className="text-[11px] text-slate-400 font-medium">
            Conforme à 100% avec le fichier Excel modèle{' '}
            <span className="font-mono text-slate-600">GMAO_Light_Template_V2</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
