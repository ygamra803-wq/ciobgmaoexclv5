import { Calculator, Sliders, X } from 'lucide-react';
import type { BudgetPeriodMode, FiscalBudgetConfig } from '../../../../domain/finance/entities/FinancialBudget';

export interface FinanceFormulaItem {
  title: string;
  formula: string;
  description: string;
}

export interface FinanceBudgetEditModalProps {
  open: boolean;
  canManage: boolean;
  editBudgetDraft: FiscalBudgetConfig;
  setEditBudgetDraft: (next: FiscalBudgetConfig) => void;
  symbol: string;
  onClose: () => void;
  onSave: (updated: FiscalBudgetConfig) => void;
}

export function FinanceBudgetEditModal({
  open,
  canManage,
  editBudgetDraft,
  setEditBudgetDraft,
  symbol,
  onClose,
  onSave,
}: FinanceBudgetEditModalProps) {
  if (!open || !canManage) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 max-h-[90vh] flex flex-col">
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                Configurer les Plafonds &amp; le Suivi Budgétaire ({editBudgetDraft.fiscalYear})
              </h3>
              <p className="text-[11px] text-slate-500">
                Les allocations mensuelles (1/12) ou trimestrielles (1/4) sont calculées automatiquement à partir des plafonds annuels.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Mode de Pilotage Périodique (P2-1)
            </label>
            <select
              value={editBudgetDraft.periodMode || 'ANNUAL'}
              onChange={(e) =>
                setEditBudgetDraft({
                  ...editBudgetDraft,
                  periodMode: e.target.value as BudgetPeriodMode,
                })
              }
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-bold text-slate-900 focus:outline-hidden"
            >
              <option value="ANNUAL">Annuel (Synthèse Exercice)</option>
              <option value="MONTHLY">Mensuel (12 Mois — 1/12 du plafond)</option>
              <option value="QUARTERLY">Trimestriel (4 Trimestres T1–T4)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Seuil d&apos;Alerte Consommation Burn (%) (P2-2)
            </label>
            <input
              type="number"
              min="50"
              max="100"
              value={editBudgetDraft.burnWarningPercent ?? 90}
              onChange={(e) =>
                setEditBudgetDraft({
                  ...editBudgetDraft,
                  burnWarningPercent: Math.max(50, Math.min(100, Number(e.target.value) || 90)),
                })
              }
              className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-mono font-bold text-slate-900 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Budget Maintenance Préventive ({symbol})
            </label>
            <input
              type="number"
              min="0"
              value={editBudgetDraft.allocatedPreventive}
              onChange={(e) =>
                setEditBudgetDraft({
                  ...editBudgetDraft,
                  allocatedPreventive: Number(e.target.value) || 0,
                })
              }
              className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-mono font-bold text-slate-900 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Budget Correctif &amp; Pannes ({symbol})
            </label>
            <input
              type="number"
              min="0"
              value={editBudgetDraft.allocatedCorrective}
              onChange={(e) =>
                setEditBudgetDraft({
                  ...editBudgetDraft,
                  allocatedCorrective: Number(e.target.value) || 0,
                })
              }
              className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-mono font-bold text-slate-900 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Budget Sous-traitance &amp; Bobinage ({symbol})
            </label>
            <input
              type="number"
              min="0"
              value={editBudgetDraft.allocatedExternal}
              onChange={(e) =>
                setEditBudgetDraft({
                  ...editBudgetDraft,
                  allocatedExternal: Number(e.target.value) || 0,
                })
              }
              className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-mono font-bold text-slate-900 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Budget Achats &amp; Stock PDR ({symbol})
            </label>
            <input
              type="number"
              min="0"
              value={editBudgetDraft.allocatedSparesStock}
              onChange={(e) =>
                setEditBudgetDraft({
                  ...editBudgetDraft,
                  allocatedSparesStock: Number(e.target.value) || 0,
                })
              }
              className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-mono font-bold text-slate-900 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Taux Horaire Technicien ({symbol}/h)
            </label>
            <input
              type="number"
              min="0"
              value={editBudgetDraft.technicianHourlyRate}
              onChange={(e) =>
                setEditBudgetDraft({
                  ...editBudgetDraft,
                  technicianHourlyRate: Number(e.target.value) || 0,
                })
              }
              className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-mono font-bold text-slate-900 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Coût Horaire Arrêt Usine ({symbol}/h)
            </label>
            <input
              type="number"
              min="0"
              value={editBudgetDraft.productionDowntimeCostPerHour}
              onChange={(e) =>
                setEditBudgetDraft({
                  ...editBudgetDraft,
                  productionDowntimeCostPerHour: Number(e.target.value) || 0,
                })
              }
              className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-mono font-bold text-slate-900 focus:outline-hidden"
            />
          </div>
        </div>

        <div className="bg-slate-50 px-6 py-4 flex justify-end gap-2 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => {
              onSave({
                ...editBudgetDraft,
                updatedAt: new Date().toISOString(),
              });
              onClose();
            }}
            className="rounded-xl bg-emerald-700 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 transition cursor-pointer"
          >
            Enregistrer Allocations
          </button>
        </div>
      </div>
    </div>
  );
}

export interface FinanceFormulasModalProps {
  open: boolean;
  onClose: () => void;
  formulas: FinanceFormulaItem[];
}

export function FinanceFormulasModal({ open, onClose, formulas }: FinanceFormulasModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-5 space-y-4 animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 tracking-tight">
                Formules &amp; Règles — Pilotage Coûts &amp; Budgets
              </h3>
              <p className="text-xs text-slate-500">
                TCO, VNC, taux BER de vétusté, valorisation PMP et calcul de burn rate budgétaire
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2.5 max-h-[65vh] overflow-y-auto pr-1">
          {formulas.map((f) => (
            <div
              key={f.title}
              className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 space-y-1.5"
            >
              <div className="text-xs font-black text-slate-800">{f.title}</div>
              <div className="font-mono text-xs text-emerald-900 font-bold bg-white p-2 rounded-lg border border-emerald-100">
                {f.formula}
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
