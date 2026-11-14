import React from 'react';
import {
  Truck,
  Gauge,
  ShieldCheck,
  Inbox,
  RefreshCw,
  ClipboardList,
  ShoppingCart,
} from 'lucide-react';
import { CustomSelect } from './MovementSelect';

export interface ExternalMovementFormState {
  action_id?: string;
  prestataire_externe?: string;
  id_machine_registered?: string;
  id_zone?: string;
  date_retour_prevue?: string;
  technicien?: string;
  id_technician?: string;
  fournisseur?: string;
  emplacement_reception?: string;
  priorite?: string;
  commentaire?: string;
}

export interface ExternalMachineOption {
  id_machine_registered?: string;
  designation?: string;
  nom?: string;
  id_zone_default?: string;
}

export interface ExternalTechnicianOption {
  id_technician?: string;
  nom: string;
}

export interface ExternalRepairTicket {
  code_bon: string;
  ref: string;
}

export interface ExternalMovementContextSectionsProps {
  isBonSortie: boolean;
  isEntreeExterne: boolean;
  isCommandeFlow: boolean;
  form: ExternalMovementFormState;
  setForm: (updater: React.SetStateAction<ExternalMovementFormState>) => void;
  supplierOptions: string[];
  machines: ExternalMachineOption[];
  activeMachinesList: ExternalMachineOption[];
  technicians: ExternalTechnicianOption[];
  activeExternalRepairs: ExternalRepairTicket[];
  handleReceiveRepairReturn: (rep: ExternalRepairTicket) => void;
}

/**
 * Renders contextual sections for external movement flows:
 *  - Case C (`isBonSortie`): External repair/calibration/warranty dispatch with expected return date.
 *  - Case D (`isEntreeExterne`): Supplier receipt, repair return autofill, or stock regularization.
 *  - Case E (`isCommandeFlow`): Purchase requisition metadata & priority level.
 */
export const ExternalMovementContextSections: React.FC<ExternalMovementContextSectionsProps> = ({
  isBonSortie,
  isEntreeExterne,
  isCommandeFlow,
  form,
  setForm,
  supplierOptions,
  machines,
  activeMachinesList,
  technicians,
  activeExternalRepairs,
  handleReceiveRepairReturn,
}) => {
  return (
    <>
      {/* CASE C: BON DE SORTIE (RÉPARATION EXTERNE / ÉTALONNAGE / GARANTIE) */}
      {isBonSortie && (
        <div className="space-y-3 pt-2 border-t border-slate-100 bg-purple-50/40 p-3 rounded-xl border border-purple-200">
          {/* 3 Action Cards for Bon de Sortie */}
          <div>
            <label className="text-[10.5px] font-bold text-purple-950 uppercase tracking-wider block mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-purple-700" />
                <span>Motif &amp; Nature de la Sortie Externe (Action) :</span>
              </span>
              <span className="text-[10px] text-purple-700 font-semibold italic">
                3 Actions Disponibles
              </span>
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                {
                  id: 'REPARATION_EXTERNE',
                  label: 'Réparation Externe',
                  desc: 'Moteur, bobinage, usinage...',
                  icon: Truck,
                  color:
                    'bg-purple-50 border-purple-400 text-purple-950 ring-2 ring-purple-500/20 shadow-2xs font-bold',
                },
                {
                  id: 'ETALONNAGE_CONTROLE',
                  label: 'Étalonnage / Contrôle',
                  desc: 'Mesure, métrologie, capteurs...',
                  icon: Gauge,
                  color:
                    'bg-blue-50 border-blue-400 text-blue-950 ring-2 ring-blue-500/20 shadow-2xs font-bold',
                },
                {
                  id: 'GARANTIE_ECHANGE',
                  label: 'Garantie / Échange',
                  desc: 'Retour constructeur, garantie...',
                  icon: ShieldCheck,
                  color:
                    'bg-emerald-50 border-emerald-400 text-emerald-950 ring-2 ring-emerald-500/20 shadow-2xs font-bold',
                },
              ].map((act) => {
                const IconComp = act.icon;
                const isActive = form.action_id === act.id;
                return (
                  <button
                    key={act.id}
                    type="button"
                    onClick={() => setForm({ ...form, action_id: act.id })}
                    className={`p-2 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                      isActive
                        ? act.color
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <IconComp className="w-3.5 h-3.5 text-purple-700 shrink-0" />
                      <span className="text-xs font-bold truncate">{act.label}</span>
                    </div>
                    <div className="text-[9.5px] text-slate-500 leading-tight truncate">{act.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Prestataire Externe (Obligatoire) */}
          <div>
            <label className="text-[10.5px] font-bold text-purple-950 uppercase tracking-wider block mb-1">
              Atelier / Prestataire Extérieur (Bobineur / Usineur / Labo){' '}
              <span className="text-rose-600 font-bold">*</span>
            </label>
            <CustomSelect
              value={form.prestataire_externe}
              onChange={(val) => setForm({ ...form, prestataire_externe: val })}
              options={supplierOptions.map((s) => ({ value: s, label: s }))}
              placeholder="-- Sélectionner Prestataire Externe --"
              onAddNew={(val) => {
                if (val) {
                  setForm({ ...form, prestataire_externe: val });
                }
              }}
            />
          </div>

          {/* Machine d'Origine (Équipement Source) & Date de Retour Prévue */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-[10.5px] font-bold text-purple-950 uppercase tracking-wider block mb-1">
                Machine d&apos;Origine (Équipement Source)
              </label>
              <CustomSelect
                value={form.id_machine_registered}
                onChange={(val) => {
                  const m = machines.find((mach) => mach.id_machine_registered === val);
                  setForm({
                    ...form,
                    id_machine_registered: val,
                    id_zone: m?.id_zone_default || form.id_zone,
                  });
                }}
                options={[
                  { value: '', label: '-- Stock Équipement / Non affecté --' },
                  ...activeMachinesList.map((m) => ({
                    value: m.id_machine_registered,
                    label: `[${m.id_machine_registered}] ${m.designation}`,
                  })),
                ]}
                placeholder="-- Machine d'origine --"
              />
            </div>

            <div>
              <label className="text-[10.5px] font-bold text-purple-950 uppercase tracking-wider block mb-1">
                Date de Retour Estimée <span className="text-rose-600 font-bold">*</span>
              </label>
              <input
                type="date"
                value={form.date_retour_prevue}
                onChange={(e) => setForm({ ...form, date_retour_prevue: e.target.value })}
                className="w-full h-8 px-2.5 rounded-xl border border-purple-200 bg-white text-xs font-mono text-slate-800"
                required
              />
            </div>
          </div>

          {/* Technicien Émetteur (Responsable de la Sortie) */}
          <div>
            <label className="text-[10.5px] font-bold text-purple-950 uppercase tracking-wider block mb-1">
              Technicien Émetteur (Demandeur de l&apos;Envoi){' '}
              <span className="text-rose-600 font-bold">*</span>
            </label>
            <CustomSelect
              value={form.technicien}
              onChange={(val) => {
                const t = technicians.find((tech) => tech.nom === val);
                setForm({
                  ...form,
                  technicien: val,
                  id_technician: t?.id_technician || '',
                });
              }}
              options={technicians.map((t) => ({
                value: t.nom,
                label: t.nom,
                badge: t.id_technician,
              }))}
              placeholder="-- Technicien émetteur --"
            />
          </div>
        </div>
      )}

      {/* CASE D: ENTRÉE EXTERNE */}
      {isEntreeExterne && (
        <div className="space-y-3 pt-2 border-t border-slate-100 bg-emerald-50/40 p-3 rounded-xl border border-emerald-200">
          {/* 3 Action Cards for Entrée Externe */}
          <div>
            <label className="text-[10.5px] font-bold text-emerald-950 uppercase tracking-wider block mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Inbox className="w-3.5 h-3.5 text-emerald-700" />
                <span>Nature de la Réception Externe (Action) :</span>
              </span>
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                {
                  id: 'REAPPRO',
                  label: 'Réapprovisionnement',
                  desc: 'Commande fournisseur / stock',
                  icon: Truck,
                },
                {
                  id: 'RETOUR_REPARATION',
                  label: 'Retour Réparation',
                  desc: 'Retour bobinage / usinage',
                  icon: RefreshCw,
                },
                {
                  id: 'INVENTAIRE',
                  label: 'Régularisation +',
                  desc: 'Ajustement inventaire',
                  icon: ClipboardList,
                },
              ].map((act) => {
                const IconComp = act.icon;
                const isActive = form.action_id === act.id;
                return (
                  <button
                    key={act.id}
                    type="button"
                    onClick={() => setForm({ ...form, action_id: act.id })}
                    className={`p-2 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                      isActive
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-950 ring-2 ring-emerald-500/20 shadow-2xs font-bold'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <IconComp className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="text-xs font-bold truncate">{act.label}</span>
                    </div>
                    <div className="text-[9.5px] text-slate-500 leading-tight truncate">{act.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Smart One-Click Autofill for RETOUR_REPARATION if active external repairs exist */}
          {activeExternalRepairs.length > 0 && (
            <div className="p-2.5 bg-purple-50 rounded-xl border border-purple-200 text-xs">
              <div className="font-bold text-purple-950 flex items-center gap-1 mb-1.5">
                <Truck className="w-3.5 h-3.5 text-purple-600" />
                <span>
                  {activeExternalRepairs.length} Bon(s) de Sortie en Réparation Externe en attente :
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {activeExternalRepairs.slice(0, 3).map((rep, idx) => (
                  <button
                    key={`rep-btn-${idx}`}
                    type="button"
                    onClick={() => handleReceiveRepairReturn(rep)}
                    className="px-2 py-1 bg-white hover:bg-purple-100 border border-purple-300 text-purple-900 rounded-lg text-[10.5px] font-bold transition flex items-center gap-1 cursor-pointer shadow-2xs"
                  >
                    <span>{rep.code_bon}</span>
                    <span className="text-slate-500 font-normal">({rep.ref})</span>
                    <span className="text-emerald-600">↳ Réceptionner</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="text-[10.5px] font-bold text-emerald-950 uppercase tracking-wider block mb-1">
              Fournisseur / Prestataire Expéditeur
            </label>
            <CustomSelect
              value={form.fournisseur}
              onChange={(val) => setForm({ ...form, fournisseur: val })}
              options={supplierOptions.map((s) => ({ value: s, label: s }))}
              placeholder="-- Sélectionner Fournisseur --"
            />
          </div>

          <div>
            <label className="text-[10.5px] font-bold text-emerald-950 uppercase tracking-wider block mb-1">
              Emplacement de Réception Magasin
            </label>
            <input
              type="text"
              placeholder="Ex: Magasin Central - R1"
              value={form.emplacement_reception}
              onChange={(e) => setForm({ ...form, emplacement_reception: e.target.value })}
              className="w-full h-8 px-2.5 rounded-xl border border-emerald-200 bg-white text-xs font-mono text-slate-800"
            />
          </div>
        </div>
      )}

      {/* CASE E: COMMANDE (Demande d'Achat & Approvisionnement) */}
      {isCommandeFlow && (
        <div className="space-y-3 pt-2 border-t border-slate-100 bg-amber-50/40 p-3 rounded-xl border border-amber-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-950">
              <ShoppingCart className="w-4 h-4 text-amber-600" />
              <span>Informations de la Demande d&apos;Achat</span>
            </div>
            <span className="text-[10px] font-mono font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded border border-amber-300">
              APPROVISIONNEMENT
            </span>
          </div>

          {/* Priority Selector */}
          <div>
            <label className="text-[10.5px] font-bold text-amber-950 uppercase tracking-wider block mb-1">
              Niveau de Priorité :
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                {
                  id: 'NORMALE',
                  label: '🟢 Normale',
                  color: 'border-emerald-300 text-emerald-900 bg-emerald-50',
                },
                {
                  id: 'URGENTE',
                  label: '🟡 Urgente',
                  color: 'border-amber-300 text-amber-900 bg-amber-50',
                },
                {
                  id: 'CRITIQUE',
                  label: '🔴 Critique (Rupture)',
                  color: 'border-rose-300 text-rose-900 bg-rose-50',
                },
              ].map((p) => {
                const isSel = (form.priorite || 'NORMALE') === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setForm({ ...form, priorite: p.id })}
                    className={`py-1.5 px-2 rounded-xl border text-xs font-bold transition cursor-pointer text-center ${
                      isSel
                        ? `${p.color} ring-2 ring-amber-500/20 shadow-2xs`
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-[10.5px] font-bold text-amber-950 uppercase tracking-wider block mb-1">
                Demandeur / Responsable
              </label>
              <CustomSelect
                value={form.technicien}
                onChange={(val) => setForm({ ...form, technicien: val })}
                options={technicians.map((t) => ({ value: t.nom, label: t.nom }))}
                placeholder="-- Demandeur --"
              />
            </div>

            <div>
              <label className="text-[10.5px] font-bold text-amber-950 uppercase tracking-wider block mb-1">
                Fournisseur Suggéré
              </label>
              <input
                type="text"
                placeholder="Nom du fournisseur ou prestataire"
                value={form.fournisseur}
                onChange={(e) => setForm({ ...form, fournisseur: e.target.value })}
                className="w-full h-8 px-2.5 rounded-xl border border-amber-200 bg-white text-xs text-slate-800 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* Commentaire / Observation */}
      <div>
        <label className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
          Commentaire / Motif du Bon
        </label>
        <input
          type="text"
          placeholder="Observation, raison du mouvement..."
          value={form.commentaire}
          onChange={(e) => setForm({ ...form, commentaire: e.target.value })}
          className="w-full h-8 px-2.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-800"
        />
      </div>
    </>
  );
};
