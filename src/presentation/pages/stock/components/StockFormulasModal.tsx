import React from 'react';
import { Calculator, X, TrendingUp, TrendingDown, Package, AlertTriangle } from 'lucide-react';

export interface StockFormulasModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function StockFormulasModal({ isOpen, onClose }: StockFormulasModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-5 space-y-4 animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-700 shrink-0">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>Formules Excel Miroir — Stock_Actuel</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Colonnes B → K
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Règles de calcul et formules automatiques synchronisées avec le modèle GMAO_Light_Template_V2
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer shrink-0"
            title="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content: 4 Formula Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {/* Formule F */}
          <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-blue-300 transition">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                <TrendingUp className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span className="truncate">Formule F : Entrées</span>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-100/80 text-blue-800 border border-blue-200 shrink-0">
                Col. [F] (+)
              </span>
            </div>
            <div className="font-mono text-xs text-blue-800 font-bold bg-white p-2 rounded-lg border border-blue-100">
              =SUMIFS(Mvt[Qté], Mvt[Type], &quot;Entrée&quot;)
            </div>
            <p className="text-[10.5px] text-slate-500 leading-tight">
              Calcule la somme automatique de toutes les entrées et réapprovisionnements validés.
            </p>
          </div>

          {/* Formule G */}
          <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-rose-300 transition">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                <TrendingDown className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span className="truncate">Formule G : Sorties</span>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-rose-100/80 text-rose-800 border border-rose-200 shrink-0">
                Col. [G] (−)
              </span>
            </div>
            <div className="font-mono text-xs text-rose-800 font-bold bg-white p-2 rounded-lg border border-rose-100">
              =SUMIFS(Mvt[Qté], Mvt[Type], &quot;Sortie&quot;)
            </div>
            <p className="text-[10.5px] text-slate-500 leading-tight">
              Calcule le cumul des pièces consommées sur les bons de travail et interventions.
            </p>
          </div>

          {/* Formule H */}
          <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-emerald-300 transition">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                <Package className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="truncate">Formule H : Stock Actuel</span>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-100/80 text-emerald-800 border border-emerald-200 shrink-0">
                Col. [H] = E+F−G
              </span>
            </div>
            <div className="font-mono text-xs text-emerald-800 font-bold bg-white p-2 rounded-lg border border-emerald-100">
              = Initial (E) + Entrées (F) - Sorties (G)
            </div>
            <p className="text-[10.5px] text-slate-500 leading-tight">
              Détermine le solde physique disponible à l’instant T dans le magasin.
            </p>
          </div>

          {/* Formule J */}
          <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-amber-300 transition">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span className="truncate">Formule J : Statut Alerte</span>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-100/80 text-amber-800 border border-amber-200 shrink-0">
                Col. [J] Statut
              </span>
            </div>
            <div className="font-mono text-xs text-amber-800 font-bold bg-white p-2 rounded-lg border border-amber-100">
              =IF(H&lt;=0, &quot;RUPTURE&quot;, IF(H&lt;=I, &quot;ALERTE&quot;, &quot;OK&quot;))
            </div>
            <p className="text-[10.5px] text-slate-500 leading-tight">
              Évalue si le stock atteint la rupture (≤ 0) ou passe en dessous du seuil d’alerte (≤ Seuil I).
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
          <span className="text-[11px] text-slate-400 font-medium">
            Conforme à 100% avec le fichier Excel modèle <span className="font-mono text-slate-600">GMAO_Light_Template_V2</span>
          </span>
          <button
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
