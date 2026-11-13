import React from 'react';
import {
  RotateCcw,
  Hammer,
  Wrench,
  RefreshCw,
  ClipboardList,
  CornerDownRight,
} from 'lucide-react';
import { CustomSelect } from './MovementSelect';

export interface EntreeInterneContextSectionProps {
  form: any;
  setForm: React.Dispatch<React.SetStateAction<any>>;
  zones: any[];
  machines: any[];
  activeMachinesList: any[];
  technicians: any[];
  availableTechs: any[];
  onOpenAddTech?: () => void;
}

export const EntreeInterneContextSection: React.FC<EntreeInterneContextSectionProps> = ({
  form,
  setForm,
  zones,
  machines,
  activeMachinesList,
  technicians,
  availableTechs,
  onOpenAddTech,
}) => {
  return (
    <div className="space-y-3 pt-2 border-t border-slate-100">
      {/* 6 Action Cards for Entrée Interne */}
      <div>
        <label className="text-[10.5px] font-bold text-cyan-950 uppercase tracking-wider block mb-1.5 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <RotateCcw className="w-3.5 h-3.5 text-cyan-700" />
            <span>Motif de l'Entrée Interne (Action) :</span>
          </span>
          <span className="text-[9.5px] font-mono text-cyan-600 font-normal">6 modes de réintégration</span>
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5">
          {[
            {
              id: 'RETOUR',
              label: 'Retour Atelier',
              icon: RotateCcw,
              desc: 'Non utilisé / Restant intervention',
              color: 'border-cyan-400 bg-cyan-50 text-cyan-950',
              activeRing: 'ring-2 ring-cyan-500/20 shadow-2xs',
            },
            {
              id: 'FABRICATION_INTERNE',
              label: 'Fabrication / Tournage',
              icon: Hammer,
              desc: 'Usinage & confection interne',
              color: 'border-indigo-400 bg-indigo-50 text-indigo-950',
              activeRing: 'ring-2 ring-indigo-500/20 shadow-2xs',
            },
            {
              id: 'DEMONTAGE',
              label: 'Démontage Machine',
              icon: Wrench,
              desc: 'Pièce déposée / récupérée',
              color: 'border-purple-400 bg-purple-50 text-purple-950',
              activeRing: 'ring-2 ring-purple-500/20 shadow-2xs',
            },
            {
              id: 'REPARATION_INTERNE',
              label: 'Réparation Interne',
              icon: RefreshCw,
              desc: 'Rénovation atelier terminée',
              color: 'border-blue-400 bg-blue-50 text-blue-950',
              activeRing: 'ring-2 ring-blue-500/20 shadow-2xs',
            },
            {
              id: 'INVENTAIRE',
              label: 'Ajustement +',
              icon: ClipboardList,
              desc: 'Surplus constaté en inventaire',
              color: 'border-emerald-400 bg-emerald-50 text-emerald-950',
              activeRing: 'ring-2 ring-emerald-500/20 shadow-2xs',
            },
            {
              id: 'TRANSFERT',
              label: 'Transfert Interne',
              icon: CornerDownRight,
              desc: 'Transfert inter-ateliers / magasin',
              color: 'border-amber-400 bg-amber-50 text-amber-950',
              activeRing: 'ring-2 ring-amber-500/20 shadow-2xs',
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
                    ? `${act.color} ${act.activeRing} font-bold`
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <IconComp className="w-3.5 h-3.5 shrink-0" />
                  <span className="text-xs font-bold truncate">{act.label}</span>
                </div>
                <div className="text-[9.5px] text-slate-500 leading-tight truncate">{act.desc}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 1. RETOUR ATELIER CARD */}
      {form.action_id === 'RETOUR' && (
        <div className="p-3 bg-cyan-50/70 rounded-xl border border-cyan-200/90 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-[10.5px] font-bold text-cyan-950 uppercase tracking-wider flex items-center gap-1.5">
              <RotateCcw className="w-3.5 h-3.5 text-cyan-700" />
              <span>Paramètres de Retour Atelier (Pièce Non Utilisée / Surplus Chantier) :</span>
            </label>
            <span className="text-[9.5px] text-cyan-800 font-semibold bg-cyan-100/90 px-2 py-0.5 rounded border border-cyan-300 flex items-center gap-1">
              <RotateCcw className="w-2.5 h-2.5 text-cyan-600" />
              Restant Intervention & Réintégration
            </span>
          </div>

          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[10.5px] font-bold text-cyan-950 uppercase tracking-wider block mb-1 flex items-center justify-between">
                  <span>Machine Concernée (Origine)</span>
                  <span className="text-[9px] text-cyan-700 font-mono">Optionnel</span>
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
                    { value: '', label: '-- Non Spécifiée / Chantier Général --' },
                    ...activeMachinesList.map((m) => ({
                      value: m.id_machine_registered,
                      label: `[${m.id_machine_registered}] ${m.designation}`,
                    })),
                  ]}
                  placeholder="-- Machine --"
                />
              </div>

              <div>
                <label className="text-[10.5px] font-bold text-cyan-950 uppercase tracking-wider block mb-1 flex items-center justify-between">
                  <span>Technicien Rapporteur</span>
                  <span className="text-[9px] text-cyan-700 font-bold">*Requis</span>
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
                  options={availableTechs.map((t) => ({
                    value: t.nom,
                    label: t.nom,
                    badge: t.id_technician,
                    sublabel: t.specialite ? `${t.id_zone || 'Usine'} • ${t.specialite}` : t.id_zone,
                  }))}
                  placeholder="-- Technicien --"
                  onAddNew={onOpenAddTech}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[10.5px] font-bold text-cyan-950 uppercase tracking-wider block mb-1">
                  Emplacement de Rangement / Casier
                </label>
                <input
                  type="text"
                  placeholder="Ex: R1-B04 ou Magasin Central"
                  value={form.emplacement_reception}
                  onChange={(e) => setForm({ ...form, emplacement_reception: e.target.value })}
                  className="w-full h-8 px-2.5 rounded-xl border border-cyan-200 bg-white text-xs font-mono text-slate-800"
                />
              </div>

              <div>
                <label className="text-[10.5px] font-bold text-cyan-950 uppercase tracking-wider block mb-1">
                  État du Matériel Rapatrié
                </label>
                <select
                  value={form.entrepot_etat || 'Fonctionnel'}
                  onChange={(e) => setForm({ ...form, entrepot_etat: e.target.value })}
                  className="w-full h-8 px-2.5 rounded-xl border border-cyan-200 bg-white text-xs font-semibold text-slate-800"
                >
                  <option value="Fonctionnel">Fonctionnel (Prêt à l'emploi)</option>
                  <option value="Neuf">Neuf (Emballage intact)</option>
                  <option value="En révision">En révision / Contrôle</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. FABRICATION INTERNE CARD */}
      {form.action_id === 'FABRICATION_INTERNE' && (
        <div className="p-3 bg-indigo-50/70 rounded-xl border border-indigo-200/90 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-[10.5px] font-bold text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
              <Hammer className="w-3.5 h-3.5 text-indigo-700" />
              <span>Paramètres de Fabrication & Tournage / Usinage Interne :</span>
            </label>
            <span className="text-[9.5px] text-indigo-800 font-semibold bg-indigo-100/90 px-2 py-0.5 rounded border border-indigo-300 flex items-center gap-1">
              <Hammer className="w-2.5 h-2.5 text-indigo-600" />
              Usinage & Confection Atelier
            </span>
          </div>

          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[10.5px] font-bold text-indigo-950 uppercase tracking-wider block mb-1">
                  Temps de Main d'Œuvre / Usinage (Heures)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  placeholder="Ex: 2.5 h"
                  value={form.temps_fabrication || ''}
                  onChange={(e) => setForm({ ...form, temps_fabrication: e.target.value })}
                  className="w-full h-8 px-2.5 rounded-xl border border-indigo-200 bg-white text-xs font-mono text-slate-800"
                />
              </div>

              <div>
                <label className="text-[10.5px] font-bold text-indigo-950 uppercase tracking-wider block mb-1">
                  Matière Première ou Ébauche Utilisée
                </label>
                <input
                  type="text"
                  placeholder="Ex: Barre Acier 40mm, Tôle Inox 3mm..."
                  value={form.matiere_premiere || ''}
                  onChange={(e) => setForm({ ...form, matiere_premiere: e.target.value })}
                  className="w-full h-8 px-2.5 rounded-xl border border-indigo-200 bg-white text-xs text-slate-800"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[10.5px] font-bold text-indigo-950 uppercase tracking-wider block mb-1 flex items-center justify-between">
                  <span>Technicien / Usineur</span>
                  <span className="text-[9px] text-indigo-700 font-bold">*Requis</span>
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
                  options={availableTechs.map((t) => ({
                    value: t.nom,
                    label: t.nom,
                    badge: t.id_technician,
                    sublabel: t.specialite ? `${t.id_zone || 'Usine'} • ${t.specialite}` : t.id_zone,
                  }))}
                  placeholder="-- Technicien --"
                  onAddNew={onOpenAddTech}
                />
              </div>

              <div>
                <label className="text-[10.5px] font-bold text-indigo-950 uppercase tracking-wider block mb-1">
                  Emplacement de Stockage
                </label>
                <input
                  type="text"
                  placeholder="Ex: R2-A01 ou Rayonnage PDR"
                  value={form.emplacement_reception}
                  onChange={(e) => setForm({ ...form, emplacement_reception: e.target.value })}
                  className="w-full h-8 px-2.5 rounded-xl border border-indigo-200 bg-white text-xs font-mono text-slate-800"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. DÉMONTAGE MACHINE CARD */}
      {form.action_id === 'DEMONTAGE' && (
        <div className="p-3 bg-purple-50/70 rounded-xl border border-purple-200/90 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-[10.5px] font-bold text-purple-950 uppercase tracking-wider flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5 text-purple-700" />
              <span>Paramètres de Démontage & Récupération sur Machine :</span>
            </label>
            <span className="text-[9.5px] text-purple-800 font-semibold bg-purple-100/90 px-2 py-0.5 rounded border border-purple-300 flex items-center gap-1">
              <Wrench className="w-2.5 h-2.5 text-purple-600" />
              Organe Déposé & Revalorisé
            </span>
          </div>

          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[10.5px] font-bold text-purple-950 uppercase tracking-wider block mb-1 flex items-center justify-between">
                  <span>Machine d'Origine (Démontage)</span>
                  <span className="text-[9px] text-purple-700 font-bold">*Requis</span>
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
                    { value: '', label: '-- Sélectionner la Machine Déposée --' },
                    ...activeMachinesList.map((m) => ({
                      value: m.id_machine_registered,
                      label: `[${m.id_machine_registered}] ${m.designation}`,
                    })),
                  ]}
                  placeholder="-- Machine --"
                />
              </div>

              <div>
                <label className="text-[10.5px] font-bold text-purple-950 uppercase tracking-wider block mb-1 flex items-center justify-between">
                  <span>Technicien Démonteur</span>
                  <span className="text-[9px] text-purple-700 font-bold">*Requis</span>
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
                  options={availableTechs.map((t) => ({
                    value: t.nom,
                    label: t.nom,
                    badge: t.id_technician,
                    sublabel: t.specialite ? `${t.id_zone || 'Usine'} • ${t.specialite}` : t.id_zone,
                  }))}
                  placeholder="-- Technicien --"
                  onAddNew={onOpenAddTech}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[10.5px] font-bold text-purple-950 uppercase tracking-wider block mb-1">
                  État de la Pièce Déposée
                </label>
                <select
                  value={form.entrepot_etat || 'En révision'}
                  onChange={(e) => setForm({ ...form, entrepot_etat: e.target.value })}
                  className="w-full h-8 px-2.5 rounded-xl border border-purple-200 bg-white text-xs font-semibold text-slate-800"
                >
                  <option value="En révision">En révision / À réviser</option>
                  <option value="Fonctionnel">Fonctionnel (Bon état)</option>
                  <option value="En attente">En attente contrôle / Test</option>
                </select>
              </div>

              <div>
                <label className="text-[10.5px] font-bold text-purple-950 uppercase tracking-wider block mb-1">
                  Emplacement de Stockage / Dépôt
                </label>
                <input
                  type="text"
                  placeholder="Ex: Zone Dépôt ou R3-C02"
                  value={form.emplacement_reception}
                  onChange={(e) => setForm({ ...form, emplacement_reception: e.target.value })}
                  className="w-full h-8 px-2.5 rounded-xl border border-purple-200 bg-white text-xs font-mono text-slate-800"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. RÉPARATION INTERNE CARD */}
      {form.action_id === 'REPARATION_INTERNE' && (
        <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-200/90 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-[10.5px] font-bold text-blue-950 uppercase tracking-wider flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 text-blue-700" />
              <span>Paramètres de Réparation & Reconditionnement en Atelier :</span>
            </label>
            <span className="text-[9.5px] text-blue-800 font-semibold bg-blue-100/90 px-2 py-0.5 rounded border border-blue-300 flex items-center gap-1">
              <RefreshCw className="w-2.5 h-2.5 text-blue-600" />
              Rénovation & Remise en État
            </span>
          </div>

          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[10.5px] font-bold text-blue-950 uppercase tracking-wider block mb-1 flex items-center justify-between">
                  <span>Technicien Rénovateur</span>
                  <span className="text-[9px] text-blue-700 font-bold">*Requis</span>
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
                  options={availableTechs.map((t) => ({
                    value: t.nom,
                    label: t.nom,
                    badge: t.id_technician,
                    sublabel: t.specialite ? `${t.id_zone || 'Usine'} • ${t.specialite}` : t.id_zone,
                  }))}
                  placeholder="-- Technicien --"
                  onAddNew={onOpenAddTech}
                />
              </div>

              <div>
                <label className="text-[10.5px] font-bold text-blue-950 uppercase tracking-wider block mb-1">
                  Organe ou Sous-Ensemble Rénové
                </label>
                <input
                  type="text"
                  placeholder="Ex: Réducteur, Pompe hydraulique, Vérin..."
                  value={form.commentaire || ''}
                  onChange={(e) => setForm({ ...form, commentaire: e.target.value })}
                  className="w-full h-8 px-2.5 rounded-xl border border-blue-200 bg-white text-xs text-slate-800"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[10.5px] font-bold text-blue-950 uppercase tracking-wider block mb-1">
                  État Après Réparation
                </label>
                <select
                  value={form.entrepot_etat || 'Fonctionnel'}
                  onChange={(e) => setForm({ ...form, entrepot_etat: e.target.value })}
                  className="w-full h-8 px-2.5 rounded-xl border border-blue-200 bg-white text-xs font-semibold text-slate-800"
                >
                  <option value="Fonctionnel">Reconditionné (Fonctionnel / Testé OK)</option>
                  <option value="En attente">En attente banc de test</option>
                </select>
              </div>

              <div>
                <label className="text-[10.5px] font-bold text-blue-950 uppercase tracking-wider block mb-1">
                  Emplacement de Réintégration
                </label>
                <input
                  type="text"
                  placeholder="Ex: R1-A05 ou Stock Pièces Rénovées"
                  value={form.emplacement_reception}
                  onChange={(e) => setForm({ ...form, emplacement_reception: e.target.value })}
                  className="w-full h-8 px-2.5 rounded-xl border border-blue-200 bg-white text-xs font-mono text-slate-800"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. AJUSTEMENT + (INVENTAIRE) CARD */}
      {form.action_id === 'INVENTAIRE' && (
        <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200/90 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-[10.5px] font-bold text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
              <ClipboardList className="w-3.5 h-3.5 text-emerald-700" />
              <span>Régularisation & Ajustement Positif de Stock (Surplus d'Inventaire) :</span>
            </label>
            <span className="text-[9.5px] text-emerald-800 font-semibold bg-emerald-100/90 px-2 py-0.5 rounded border border-emerald-300 flex items-center gap-1">
              <ClipboardList className="w-2.5 h-2.5 text-emerald-600" />
              Surplus & Réajustement +
            </span>
          </div>

          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[10.5px] font-bold text-emerald-950 uppercase tracking-wider block mb-1 flex items-center justify-between">
                  <span>Motif du Surplus / Constat</span>
                  <span className="text-[9px] text-emerald-700 font-bold">*Requis</span>
                </label>
                <select
                  value={form.commentaire || 'Surplus constaté en inventaire physique'}
                  onChange={(e) => setForm({ ...form, commentaire: e.target.value })}
                  className="w-full h-8 px-2.5 rounded-xl border border-emerald-200 bg-white text-xs font-semibold text-slate-800"
                >
                  <option value="Surplus constaté en inventaire physique">Surplus constaté en inventaire physique</option>
                  <option value="Annulation sortie non consommée">Annulation sortie non consommée</option>
                  <option value="Correction écart de saisie antérieure">Correction écart de saisie antérieure</option>
                  <option value="Réintégration lot retrouvé">Réintégration lot retrouvé</option>
                </select>
              </div>

              <div>
                <label className="text-[10.5px] font-bold text-emerald-950 uppercase tracking-wider block mb-1 flex items-center justify-between">
                  <span>Contrôleur / Agent d'Inventaire</span>
                  <span className="text-[9px] text-emerald-700 font-bold">*Requis</span>
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
                  options={availableTechs.map((t) => ({
                    value: t.nom,
                    label: t.nom,
                    badge: t.id_technician,
                    sublabel: t.specialite ? `${t.id_zone || 'Usine'} • ${t.specialite}` : t.id_zone,
                  }))}
                  placeholder="-- Contrôleur --"
                  onAddNew={onOpenAddTech}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[10.5px] font-bold text-emerald-950 uppercase tracking-wider block mb-1">
                  Emplacement Confirmé sur Rayon
                </label>
                <input
                  type="text"
                  placeholder="Ex: R1-B04"
                  value={form.emplacement_reception}
                  onChange={(e) => setForm({ ...form, emplacement_reception: e.target.value })}
                  className="w-full h-8 px-2.5 rounded-xl border border-emerald-200 bg-white text-xs font-mono text-slate-800"
                />
              </div>

              <div className="flex items-center text-[10.5px] text-emerald-800 font-medium bg-emerald-100/70 px-3 py-1.5 rounded-xl border border-emerald-200/80">
                ℹ️ Mode Ajustement (+) : La quantité sera immédiatement créditée au stock physique sans fournisseur externe.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. TRANSFERT INTERNE CARD */}
      {form.action_id === 'TRANSFERT' && (
        <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200/90 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-[10.5px] font-bold text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
              <CornerDownRight className="w-3.5 h-3.5 text-amber-700" />
              <span>Paramètres de Transfert Inter-Magasins ou Ateliers :</span>
            </label>
            <span className="text-[9.5px] text-amber-800 font-semibold bg-amber-100/90 px-2 py-0.5 rounded border border-amber-300 flex items-center gap-1">
              <CornerDownRight className="w-2.5 h-2.5 text-amber-600" />
              Mouvement Interne & Réaffectation
            </span>
          </div>

          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[10.5px] font-bold text-amber-950 uppercase tracking-wider block mb-1 flex items-center justify-between">
                  <span>Zone ou Magasin de Provenance</span>
                  <span className="text-[9px] text-amber-700 font-bold">*Requis</span>
                </label>
                <CustomSelect
                  value={form.id_zone}
                  onChange={(val) => setForm({ ...form, id_zone: val })}
                  options={zones.map((z) => ({
                    value: z.id_zone,
                    label: `${z.libelle} (${z.id_zone})`,
                  }))}
                  placeholder="-- Zone Source --"
                />
              </div>

              <div>
                <label className="text-[10.5px] font-bold text-amber-950 uppercase tracking-wider block mb-1 flex items-center justify-between">
                  <span>Agent Responsable du Transfert</span>
                  <span className="text-[9px] text-amber-700 font-bold">*Requis</span>
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
                  options={availableTechs.map((t) => ({
                    value: t.nom,
                    label: t.nom,
                    badge: t.id_technician,
                    sublabel: t.specialite ? `${t.id_zone || 'Usine'} • ${t.specialite}` : t.id_zone,
                  }))}
                  placeholder="-- Agent Transfert --"
                  onAddNew={onOpenAddTech}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[10.5px] font-bold text-amber-950 uppercase tracking-wider block mb-1">
                  Emplacement de Destination / Arrivée
                </label>
                <input
                  type="text"
                  placeholder="Ex: R4-B02 ou Magasin B"
                  value={form.emplacement_reception}
                  onChange={(e) => setForm({ ...form, emplacement_reception: e.target.value })}
                  className="w-full h-8 px-2.5 rounded-xl border border-amber-200 bg-white text-xs font-mono text-slate-800"
                />
              </div>

              <div>
                <label className="text-[10.5px] font-bold text-amber-950 uppercase tracking-wider block mb-1">
                  État à Réception
                </label>
                <select
                  value={form.entrepot_etat || 'Fonctionnel'}
                  onChange={(e) => setForm({ ...form, entrepot_etat: e.target.value })}
                  className="w-full h-8 px-2.5 rounded-xl border border-amber-200 bg-white text-xs font-semibold text-slate-800"
                >
                  <option value="Fonctionnel">Fonctionnel</option>
                  <option value="En attente">En attente pointage</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
