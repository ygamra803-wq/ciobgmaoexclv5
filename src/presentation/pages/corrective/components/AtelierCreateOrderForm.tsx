import React from 'react';
import { Hammer, X } from 'lucide-react';
import type { IMachine } from '../../../../types/domain';
import type { CorrectiveInterventionItem } from '../../../../types/store';
import type { WorkshopOrderType } from '../../../../domain/corrective/workshopOrderService';

export interface AtelierCreateOrderFormProps {
  formType: WorkshopOrderType;
  setFormType: (val: WorkshopOrderType) => void;
  formMachine: string;
  setFormMachine: (val: string) => void;
  formBtId: string;
  onSelectBtInForm: (val: string) => void;
  formQuantite: number;
  setFormQuantite: (val: number) => void;
  formDescription: string;
  setFormDescription: (val: string) => void;
  formObservation: string;
  setFormObservation: (val: string) => void;
  formSection: string;
  formDestinataire: string;
  currentUserName?: string;
  activeMachines: IMachine[];
  openBts: CorrectiveInterventionItem[];
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const AtelierCreateOrderForm: React.FC<AtelierCreateOrderFormProps> = ({
  formType,
  setFormType,
  formMachine,
  setFormMachine,
  formBtId,
  onSelectBtInForm,
  formQuantite,
  setFormQuantite,
  formDescription,
  setFormDescription,
  formObservation,
  setFormObservation,
  formSection,
  formDestinataire,
  currentUserName,
  activeMachines,
  openBts,
  onClose,
  onSubmit,
}) => {
  return (
    <form
      onSubmit={onSubmit}
      className="bg-white border-2 border-amber-300 rounded-2xl p-5 space-y-4 shadow-[0_12px_32px_-6px_rgba(245,158,11,0.14),0_4px_12px_-2px_rgba(0,0,0,0.06)] animate-in fade-in slide-in-from-top-2 duration-200"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-200 flex items-center justify-center text-amber-700 shadow-2xs">
            <Hammer className="w-4 h-4 text-amber-700" />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
              Émission d&apos;un Bon de Réalisation / Rectification (Atelier Mécanique)
            </h3>
            <p className="text-[11px] text-slate-500">
              Section Maintenance (SM) ➔ Atelier Fabrication Mécanique • Hors stockActuel PDR • Ne clôture pas le BT automatiquement
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer self-end sm:self-auto"
          title="Fermer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5">
        <div>
          <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Nature de la demande *
          </label>
          <select
            value={formType}
            onChange={(e) => setFormType(e.target.value as WorkshopOrderType)}
            className="w-full h-9 px-3 text-xs font-bold bg-slate-50/70 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
          >
            <option value="REALISATION">
              REALISATION — Confection / Usinage pièce neuve (BR)
            </option>
            <option value="RECTIFICATION">
              RECTIFICATION — Réparation / Tournage / Ajustage (RECT)
            </option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Machine concernée (Active) *
          </label>
          <select
            value={formMachine}
            onChange={(e) => setFormMachine(e.target.value)}
            required
            className="w-full h-9 px-3 text-xs font-bold bg-slate-50/70 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
          >
            <option value="">-- Sélectionner une machine --</option>
            {activeMachines.map((m) => {
              const code = String(m.id_machine_registered || m.id_machine || m.code || m.id || '');
              const nom = String(m.nom || m.designation || '');
              return (
                <option key={code} value={code}>
                  {code} {nom ? `— ${nom}` : ''}
                </option>
              );
            })}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Lier à un BT ouvert (Optionnel)
          </label>
          <select
            value={formBtId}
            onChange={(e) => onSelectBtInForm(e.target.value)}
            className="w-full h-9 px-3 text-xs font-semibold bg-slate-50/70 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
          >
            <option value="">Bon autonome (Sans BT)</option>
            {openBts.map((bt) => {
              const key = String(bt.num_bt || bt.id || '');
              const mCode = String(bt.code_machine || bt.machine || '');
              return (
                <option key={String(bt.id)} value={key}>
                  {key} — {mCode} ({bt.anomalie || bt.panne || 'Correctif'})
                </option>
              );
            })}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Quantité à usiner / rectifier *
          </label>
          <input
            type="number"
            min={1}
            value={formQuantite}
            onChange={(e) => setFormQuantite(Math.max(1, Number(e.target.value) || 1))}
            className="w-full h-9 px-3 text-xs font-bold font-mono bg-slate-50/70 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        <div className="md:col-span-2">
          <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Description technique des travaux (Cotes, matière, usinage demandé) *
          </label>
          <input
            type="text"
            required
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
            placeholder="Ex: Rectification portée d'arbre Ø45mm + confection bague bronze..."
            className="w-full h-9 px-3 text-xs font-semibold bg-slate-50/70 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Observation / Croquis / Tolérance
          </label>
          <input
            type="text"
            value={formObservation}
            onChange={(e) => setFormObservation(e.target.value)}
            placeholder="Ex: Urgence arrêt ligne, tolérance H7/g6..."
            className="w-full h-9 px-3 text-xs font-semibold bg-slate-50/70 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
        <div className="flex items-center gap-3 text-[11px] text-slate-600 flex-wrap">
          <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 font-semibold">
            <strong>Émetteur:</strong> {formSection} ({currentUserName || 'Section Maintenance'})
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 font-semibold">
            <strong>Destinataire:</strong> {formDestinataire}
          </span>
        </div>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-3.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer"
          >
            Annuler
          </button>
          <button
            type="submit"
            className="h-9 px-4 text-xs font-black uppercase text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-sm shadow-amber-600/20 cursor-pointer active:scale-95 transition"
          >
            Émettre le Bon Atelier
          </button>
        </div>
      </div>
    </form>
  );
};
