import React from 'react';
import {
  FileText,
  AlertTriangle,
  ArrowRight,
  XCircle,
  CheckCircle2,
} from 'lucide-react';
import {
  getAllowedNextWorkshopStatuses,
  isWorkshopOrderActive,
  WORKSHOP_STATUS_LABELS,
  WORKSHOP_TYPE_LABELS,
  type IWorkshopOrder,
  type WorkshopOrderStatus,
} from '../../../../domain/corrective/workshopOrderService';

export const STATUS_BADGE_STYLES: Record<WorkshopOrderStatus, string> = {
  EMIS: 'bg-amber-100 text-amber-900 border-amber-300',
  EN_COURS_FABRICATION: 'bg-blue-100 text-blue-900 border-blue-300',
  PRET_LIVRAISON: 'bg-indigo-100 text-indigo-900 border-indigo-300',
  RECEPTIONNE_MONTAGE: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  ANNULE: 'bg-slate-100 text-slate-600 border-slate-300 line-through',
};

export const ACTION_BUTTON_LABELS: Record<WorkshopOrderStatus, { label: string; style: string }> = {
  EMIS: {
    label: 'Émettre',
    style: 'bg-amber-600 hover:bg-amber-700 text-white shadow-2xs',
  },
  EN_COURS_FABRICATION: {
    label: 'Lancer Fabrication',
    style: 'bg-blue-600 hover:bg-blue-700 text-white shadow-2xs',
  },
  PRET_LIVRAISON: {
    label: 'Prêt Livraison',
    style: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs',
  },
  RECEPTIONNE_MONTAGE: {
    label: 'Réceptionner & Monter',
    style: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs',
  },
  ANNULE: {
    label: 'Annuler',
    style: 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200',
  },
};

export interface AtelierOrderCardProps {
  order: IWorkshopOrder;
  rowNumber: number;
  machineName?: string;
  canManage: boolean;
  onNavigateToBt?: (btKey: string) => void;
  onTransition: (order: IWorkshopOrder, targetStatus: WorkshopOrderStatus) => void;
}

export const AtelierOrderCard: React.FC<AtelierOrderCardProps> = ({
  order: ord,
  rowNumber,
  machineName,
  canManage,
  onNavigateToBt,
  onTransition,
}) => {
  const isRect = ord.type_demande === 'RECTIFICATION';
  const nextStatuses = getAllowedNextWorkshopStatuses(ord.statut);
  const dateEmissionShort = ord.date_emission ? ord.date_emission.slice(0, 10) : '—';

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between group">
      <div className="space-y-3">
        {/* Card Header: Code Bon + Type Badge + Machine */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-[10px] border shadow-2xs font-mono shrink-0 ${
                isRect
                  ? 'bg-purple-500/10 text-purple-700 border-purple-200/70'
                  : 'bg-amber-500/10 text-amber-700 border-amber-200/70'
              }`}
            >
              {isRect ? 'RECT' : 'BR'}
            </span>
            <div className="min-w-0">
              <div className="font-black text-slate-900 font-mono text-xs truncate">
                {ord.code_bon}
              </div>
              <div className="text-[10px] font-mono text-slate-400">
                N° {rowNumber} • Émis le {dateEmissionShort}
              </div>
            </div>
          </div>

          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border shadow-2xs shrink-0 ${
              STATUS_BADGE_STYLES[ord.statut] || 'bg-slate-100 text-slate-700 border-slate-300'
            }`}
          >
            {WORKSHOP_STATUS_LABELS[ord.statut] || ord.statut}
          </span>
        </div>

        {/* Machine & Linked BT Row */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200 text-xs font-mono font-bold">
              {ord.id_machine}
            </span>
            {machineName && (
              <span className="text-[10.5px] text-slate-500 truncate max-w-[140px]">
                {machineName}
              </span>
            )}
          </div>

          {ord.id_bt ? (
            <button
              type="button"
              onClick={() => onNavigateToBt && onNavigateToBt(String(ord.id_bt))}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 font-mono text-[11px] font-bold transition cursor-pointer"
            >
              <FileText className="w-3 h-3 text-blue-600 shrink-0" />
              <span>{ord.id_bt}</span>
            </button>
          ) : (
            <span className="px-2 py-0.5 rounded bg-slate-50 text-slate-400 border border-slate-200/70 font-mono text-[10px]">
              Autonome
            </span>
          )}
        </div>

        {/* Work Description & Qty */}
        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center px-1.5 py-0.5 bg-amber-50 text-amber-900 border border-amber-200 rounded font-mono text-[10px] font-black">
              Qté: {ord.quantite}
            </span>
            <span className="text-[10px] font-semibold text-slate-500 truncate">
              {ord.emetteur_section || 'SM'}
              {ord.emetteur_name ? ` · ${ord.emetteur_name}` : ''}
            </span>
          </div>
          <div
            className="font-bold text-slate-900 text-xs leading-snug line-clamp-2"
            title={ord.description_travaux}
          >
            {ord.description_travaux}
          </div>
          {ord.observation && (
            <div className="text-[10.5px] text-slate-500 line-clamp-1">Obs: {ord.observation}</div>
          )}
        </div>
      </div>

      {/* Card Footer: Cycle Progression Actions */}
      <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
        {ord.id_bt && isWorkshopOrderActive(ord.statut) ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/80">
            <AlertTriangle className="w-2.5 h-2.5 text-amber-600 shrink-0" />
            Bloque clôture BT
          </span>
        ) : (
          <span className="text-[10px] font-mono text-slate-400">
            {WORKSHOP_TYPE_LABELS[ord.type_demande] || ord.type_demande}
          </span>
        )}

        <div className="flex items-center gap-1.5 ml-auto">
          {canManage && nextStatuses.length > 0 ? (
            nextStatuses.map((targetSt) => {
              const btnCfg = ACTION_BUTTON_LABELS[targetSt];
              return (
                <button
                  key={targetSt}
                  type="button"
                  onClick={() => onTransition(ord, targetSt)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10.5px] font-bold transition cursor-pointer active:scale-95 ${btnCfg.style}`}
                >
                  {targetSt !== 'ANNULE' ? (
                    <ArrowRight className="w-3 h-3 shrink-0" />
                  ) : (
                    <XCircle className="w-3 h-3 shrink-0" />
                  )}
                  <span>{btnCfg.label}</span>
                </button>
              );
            })
          ) : ord.statut === 'RECEPTIONNE_MONTAGE' ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 font-mono font-bold text-[11px]">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Monté & Clôturé
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
};
