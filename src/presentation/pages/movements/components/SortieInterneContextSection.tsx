import React from 'react';
import {
  Activity,
  Wrench,
  ShieldAlert,
  Sparkles,
  Users,
  ClipboardList,
  Crown,
  UserCheck,
  MapPin,
  ShieldCheck,
} from 'lucide-react';
import { CustomSelect } from './MovementSelect';

export interface SortieInterneContextSectionProps {
  form: any;
  setForm: React.Dispatch<React.SetStateAction<any>>;
  zones: any[];
  machines: any[];
  activeMachinesList: any[];
  availableMachines: any[];
  technicians: any[];
  availableTechs: any[];
  responsablesList: any[];
  operatorsList: any[];
  currentUsageResponsable: any;
  maintenanceZone: any;
  usageAllowedZones: any[];
  usageAvailableMachines: any[];
  operatorFilteredResponsables: any[];
  getResponsableAllowedZones: (resp: any) => any[];
  getResponsablesForZone: (zoneId: string) => any[];
  findSupervisorForZone: (zoneId: string) => any;
  onOpenAddZone?: () => void;
  onOpenAddMachine?: () => void;
  onOpenAddTech?: () => void;
  onOpenAddChef?: () => void;
  onOpenAddOperator?: () => void;
}

export const SortieInterneContextSection: React.FC<SortieInterneContextSectionProps> = ({
  form,
  setForm,
  zones,
  machines,
  activeMachinesList,
  availableMachines,
  technicians,
  availableTechs,
  responsablesList,
  operatorsList,
  currentUsageResponsable,
  maintenanceZone,
  usageAllowedZones,
  usageAvailableMachines,
  operatorFilteredResponsables,
  getResponsableAllowedZones,
  getResponsablesForZone,
  findSupervisorForZone,
  onOpenAddZone,
  onOpenAddMachine,
  onOpenAddTech,
  onOpenAddChef,
  onOpenAddOperator,
}) => {
  return (
    <div className="space-y-3 pt-2 border-t border-slate-100">
      {/* 5 Action Cards for Sortie Interne */}
      <div>
        <label className="text-[10.5px] font-bold text-slate-700 uppercase tracking-wider block mb-1.5 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-rose-600" />
            <span>Type d'Intervention / Motif de Sortie (Action) :</span>
          </span>
          <span className="text-[9.5px] font-mono text-slate-400 font-normal">5 modes d'intervention</span>
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5">
          {[
            {
              id: 'CORRECTIVE',
              label: 'Corrective',
              icon: Wrench,
              desc: 'Dépannage & Panne Machine',
              color: 'border-blue-400 bg-blue-50 text-blue-950',
              activeRing: 'ring-2 ring-blue-500/20 shadow-2xs',
            },
            {
              id: 'PREVENTIVE',
              label: 'Préventive',
              icon: ShieldAlert,
              desc: 'Entretien Planifié / Gamme',
              color: 'border-emerald-400 bg-emerald-50 text-emerald-950',
              activeRing: 'ring-2 ring-emerald-500/20 shadow-2xs',
            },
            {
              id: 'AMELIORATIVE',
              label: 'Amélioration',
              icon: Sparkles,
              desc: 'Projet & Travaux Neufs',
              color: 'border-purple-400 bg-purple-50 text-purple-950',
              activeRing: 'ring-2 ring-purple-500/20 shadow-2xs',
            },
            {
              id: 'USAGE',
              label: 'Usage Perso',
              icon: Users,
              desc: 'Dotation / Profil Utilisateur',
              color: 'border-amber-400 bg-amber-50 text-amber-950',
              activeRing: 'ring-2 ring-amber-500/20 shadow-2xs',
            },
            {
              id: 'INVENTAIRE',
              label: 'Inventaire',
              icon: ClipboardList,
              desc: 'Ajustement Écart / Rebut',
              color: 'border-rose-400 bg-rose-50 text-rose-950',
              activeRing: 'ring-2 ring-rose-500/20 shadow-2xs',
            },
          ].map((act) => {
            const IconComp = act.icon;
            const isActive = form.action_id === act.id;
            return (
              <button
                key={act.id}
                type="button"
                onClick={() => {
                  const updatedForm: any = { ...form, action_id: act.id };
                  if (act.id === 'USAGE') {
                    const uType = form.usage_type || 'responsable';
                    if (uType === 'technician') {
                      const tech = technicians.find((t) => t.nom === form.technicien) || technicians[0];
                      updatedForm.technicien = tech ? tech.nom : '';
                      updatedForm.id_technician = tech ? tech.id_technician : '';
                      updatedForm.demandeur = tech ? tech.nom : '';
                      updatedForm.operation = '';
                      updatedForm.id_operation = tech ? tech.id_technician : '';
                      updatedForm.id_zone = maintenanceZone.id_zone;
                      updatedForm.id_machine_registered = '';
                    } else if (uType === 'operation' || uType === 'operator') {
                      const op = operatorsList.find((o) => o.nom === form.operation) || operatorsList[0];
                      const opZone = op?.id_zone || zones[0]?.id_zone || '';
                      const respsForZone = getResponsablesForZone(opZone);
                      const bestResp = respsForZone[0] || null;
                      updatedForm.operation = op ? op.nom : '';
                      updatedForm.id_operation = op ? op.id_operation : '';
                      updatedForm.technicien = op ? op.nom : '';
                      updatedForm.id_technician = op ? op.id_operation : '';
                      updatedForm.demandeur = op ? op.nom : '';
                      updatedForm.id_zone = opZone;
                      updatedForm.responsable_validation = bestResp ? bestResp.nom : '';
                      updatedForm.id_responsable_validation = bestResp ? bestResp.id_operation : '';
                      updatedForm.id_machine_registered = '';
                    } else {
                      const defaultResp = currentUsageResponsable || responsablesList[0];
                      const allowed = getResponsableAllowedZones(defaultResp);
                      const targetZone = allowed.some((z) => z.id_zone === form.id_zone)
                        ? form.id_zone
                        : (allowed[0]?.id_zone || '');
                      const machs = activeMachinesList.filter((m) => m.id_zone_default === targetZone);
                      updatedForm.operation = defaultResp ? defaultResp.nom : '';
                      updatedForm.id_operation = defaultResp ? defaultResp.id_operation : '';
                      updatedForm.technicien = defaultResp ? defaultResp.nom : '';
                      updatedForm.id_technician = defaultResp ? defaultResp.id_operation : '';
                      updatedForm.demandeur = defaultResp ? defaultResp.nom : '';
                      updatedForm.id_zone = targetZone;
                      updatedForm.id_machine_registered = machs.some((m) => m.id_machine_registered === form.id_machine_registered)
                        ? form.id_machine_registered
                        : '';
                    }
                  } else if (act.id === 'CORRECTIVE' || act.id === 'PREVENTIVE' || act.id === 'AMELIORATIVE') {
                    const sup = findSupervisorForZone(form.id_zone);
                    if (sup) {
                      updatedForm.operation = sup.nom;
                      updatedForm.id_operation = sup.id_operation;
                    }
                  }
                  setForm(updatedForm);
                }}
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

      {/* Sub-fields for USAGE action */}
      {form.action_id === 'USAGE' && (
        <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200/90 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-[10.5px] font-bold text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
              <Crown className="w-3.5 h-3.5 text-amber-700" />
              <span>Type de Demandeur (Usage Personnel) :</span>
            </label>
            <span className="text-[9.5px] text-amber-800 font-semibold bg-amber-100/90 px-2 py-0.5 rounded border border-amber-300">
              {form.usage_type === 'technician'
                ? 'Technicien de Maintenance'
                : form.usage_type === 'operation' || form.usage_type === 'operator'
                  ? 'Opérateur de Production'
                  : 'Responsable (RESP)'}
            </span>
          </div>

          {/* 3-Button Profile Selector */}
          <div className="grid grid-cols-3 gap-2">
            {/* 1. Responsable (RESP) */}
            <button
              type="button"
              onClick={() => {
                const resp = currentUsageResponsable || responsablesList[0];
                const allowed = getResponsableAllowedZones(resp);
                const nextZone = allowed.some((z) => z.id_zone === form.id_zone)
                  ? form.id_zone
                  : (allowed[0]?.id_zone || '');
                const machs = activeMachinesList.filter((m) => m.id_zone_default === nextZone);
                setForm((prev: any) => ({
                  ...prev,
                  usage_type: 'responsable',
                  operation: resp ? resp.nom : '',
                  id_operation: resp ? resp.id_operation : '',
                  technicien: resp ? resp.nom : '',
                  id_technician: resp ? resp.id_operation : '',
                  demandeur: resp ? resp.nom : '',
                  id_zone: nextZone,
                  id_machine_registered: machs.some((m) => m.id_machine_registered === prev.id_machine_registered)
                    ? prev.id_machine_registered
                    : '',
                }));
              }}
              className={`p-2 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                form.usage_type === 'responsable' || form.usage_type === 'chef' || !form.usage_type
                  ? 'bg-amber-600 text-white border-amber-700 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out font-bold ring-2 ring-amber-300'
                  : 'bg-white border-amber-200/80 text-amber-950 hover:bg-amber-100/60'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <Crown className={`w-3.5 h-3.5 shrink-0 ${form.usage_type === 'responsable' || form.usage_type === 'chef' || !form.usage_type ? 'text-white' : 'text-amber-700'}`} />
                <span className="text-xs font-bold truncate">Responsable (RESP)</span>
              </div>
              <div className={`text-[9.5px] leading-tight truncate ${form.usage_type === 'responsable' || form.usage_type === 'chef' || !form.usage_type ? 'text-amber-100' : 'text-amber-800/80'}`}>
                Périmètre & Zones Responsable
              </div>
            </button>

            {/* 2. Technicien */}
            <button
              type="button"
              onClick={() => {
                const tech = technicians.find((t) => t.nom === form.technicien) || technicians[0];
                setForm((prev: any) => ({
                  ...prev,
                  usage_type: 'technician',
                  technicien: tech ? tech.nom : '',
                  id_technician: tech ? tech.id_technician : '',
                  demandeur: tech ? tech.nom : '',
                  operation: '',
                  id_operation: tech ? tech.id_technician : '',
                  id_zone: maintenanceZone.id_zone,
                  id_machine_registered: '',
                }));
              }}
              className={`p-2 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                form.usage_type === 'technician'
                  ? 'bg-blue-600 text-white border-blue-700 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out font-bold ring-2 ring-blue-300'
                  : 'bg-white border-blue-200/80 text-blue-950 hover:bg-blue-50'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <Wrench className={`w-3.5 h-3.5 shrink-0 ${form.usage_type === 'technician' ? 'text-white' : 'text-blue-700'}`} />
                <span className="text-xs font-bold truncate">Technicien</span>
              </div>
              <div className={`text-[9.5px] leading-tight truncate ${form.usage_type === 'technician' ? 'text-blue-100' : 'text-blue-700/80'}`}>
                Atelier Maintenance auto
              </div>
            </button>

            {/* 3. Opérateur */}
            <button
              type="button"
              onClick={() => {
                const op = operatorsList.find((o) => o.nom === form.operation) || operatorsList[0];
                const opZone = op?.id_zone || zones[0]?.id_zone || '';
                const respsForZone = getResponsablesForZone(opZone);
                const bestResp = respsForZone[0] || null;
                const machs = activeMachinesList.filter((m) => m.id_zone_default === opZone);
                setForm((prev: any) => ({
                  ...prev,
                  usage_type: 'operation',
                  operation: op ? op.nom : '',
                  id_operation: op ? op.id_operation : '',
                  demandeur: op ? op.nom : '',
                  technicien: op ? op.nom : '',
                  id_technician: op ? op.id_operation : '',
                  id_zone: opZone,
                  responsable_validation: bestResp ? bestResp.nom : '',
                  id_responsable_validation: bestResp ? bestResp.id_operation : '',
                  id_machine_registered: machs.some((m) => m.id_machine_registered === prev.id_machine_registered)
                    ? prev.id_machine_registered
                    : '',
                }));
              }}
              className={`p-2 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                form.usage_type === 'operation' || form.usage_type === 'operator'
                  ? 'bg-purple-600 text-white border-purple-700 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out font-bold ring-2 ring-purple-300'
                  : 'bg-white border-purple-200/80 text-purple-950 hover:bg-purple-50'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <UserCheck className={`w-3.5 h-3.5 shrink-0 ${form.usage_type === 'operation' || form.usage_type === 'operator' ? 'text-white' : 'text-purple-700'}`} />
                <span className="text-xs font-bold truncate">Opérateur</span>
              </div>
              <div className={`text-[9.5px] leading-tight truncate ${form.usage_type === 'operation' || form.usage_type === 'operator' ? 'text-purple-100' : 'text-purple-700/80'}`}>
                Zone liée & Responsable
              </div>
            </button>
          </div>

          {/* MODE 1: RESPONSABLE */}
          {(form.usage_type === 'responsable' || form.usage_type === 'chef' || !form.usage_type) && (
            <div className="space-y-2.5 pt-1">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10.5px] font-bold text-amber-950 uppercase tracking-wider block mb-1 flex items-center justify-between">
                    <span>Demandeur (Responsable)</span>
                    <span className="text-[9px] text-amber-800 font-bold">*Requis</span>
                  </label>
                  <CustomSelect
                    value={form.operation}
                    onChange={(val) => {
                      const resp = responsablesList.find((r) => r.nom === val);
                      const allowed = getResponsableAllowedZones(resp);
                      const isZoneValid = allowed.some((z) => z.id_zone === form.id_zone);
                      const nextZone = isZoneValid ? form.id_zone : (allowed[0]?.id_zone || '');
                      const machs = activeMachinesList.filter((m) => m.id_zone_default === nextZone);
                      setForm((prev: any) => ({
                        ...prev,
                        operation: val,
                        id_operation: resp?.id_operation || '',
                        technicien: val,
                        id_technician: resp?.id_operation || '',
                        demandeur: val,
                        id_zone: nextZone,
                        id_machine_registered: machs.some((m) => m.id_machine_registered === prev.id_machine_registered)
                          ? prev.id_machine_registered
                          : '',
                      }));
                    }}
                    options={responsablesList.map((r) => ({
                      value: r.nom,
                      label: r.nom,
                      badge: r.id_operation,
                      sublabel: r.template_label || r.template_id || r.type_profil || 'Responsable',
                    }))}
                    placeholder="-- Sélectionner le Responsable --"
                    onAddNew={onOpenAddChef}
                  />
                </div>

                <div>
                  <label className="text-[10.5px] font-bold text-amber-950 uppercase tracking-wider block mb-1 flex items-center justify-between">
                    <span>Zone Rattachée</span>
                    <span className="text-[9px] text-amber-800 font-bold">*Requis (Filtrée)</span>
                  </label>
                  <CustomSelect
                    value={form.id_zone}
                    onChange={(val) => {
                      const machs = activeMachinesList.filter((m) => m.id_zone_default === val);
                      setForm((prev: any) => ({
                        ...prev,
                        id_zone: val,
                        id_machine_registered: machs.some((m) => m.id_machine_registered === prev.id_machine_registered)
                          ? prev.id_machine_registered
                          : '',
                      }));
                    }}
                    options={usageAllowedZones.map((z) => ({
                      value: z.id_zone,
                      label: `${z.libelle} (${z.id_zone})`,
                    }))}
                    placeholder="-- Zone du Responsable --"
                    onAddNew={onOpenAddZone}
                  />
                </div>
              </div>

              <div>
                <label className="text-[10.5px] font-bold text-amber-950 uppercase tracking-wider block mb-1 flex items-center justify-between">
                  <span>Machine Concernée (Optionnel)</span>
                  <span className="text-[9.5px] text-amber-700 font-medium">
                    {form.id_zone
                      ? 'Machines de la Zone sélectionnée uniquement (ou sans machine)'
                      : 'Sélectionner d’abord la Zone'}
                  </span>
                </label>
                <CustomSelect
                  value={form.id_machine_registered}
                  onChange={(val) => setForm({ ...form, id_machine_registered: val })}
                  options={[
                    { value: '', label: '-- Aucune machine / Usage ou dotation Zone générale --' },
                    ...usageAvailableMachines.map((m) => ({
                      value: m.id_machine_registered,
                      label: `[${m.id_machine_registered}] ${m.designation}`,
                      sublabel: m.technician ? `Tech: ${m.technician}` : '',
                    })),
                  ]}
                  placeholder="-- Machine (Optionnel) --"
                  onAddNew={onOpenAddMachine}
                />
              </div>
            </div>
          )}

          {/* MODE 2: TECHNICIEN */}
          {form.usage_type === 'technician' && (
            <div className="space-y-2.5 pt-1">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10.5px] font-bold text-blue-950 uppercase tracking-wider block mb-1 flex items-center justify-between">
                    <span>Technicien Demandeur</span>
                    <span className="text-[9px] text-blue-700 font-bold">*Requis</span>
                  </label>
                  <CustomSelect
                    value={form.technicien}
                    onChange={(val) => {
                      const tech = technicians.find((t) => t.nom === val);
                      setForm((prev: any) => ({
                        ...prev,
                        technicien: val,
                        id_technician: tech?.id_technician || '',
                        demandeur: val,
                        operation: '',
                        id_operation: tech?.id_technician || '',
                        id_zone: maintenanceZone.id_zone,
                        id_machine_registered: '',
                      }));
                    }}
                    options={technicians.map((t) => ({
                      value: t.nom,
                      label: t.nom,
                      badge: t.id_technician,
                      sublabel: t.specialite || 'Maintenance',
                    }))}
                    placeholder="-- Sélectionner le Technicien --"
                    onAddNew={onOpenAddTech}
                  />
                </div>

                <div>
                  <label className="text-[10.5px] font-bold text-blue-950 uppercase tracking-wider block mb-1 flex items-center justify-between">
                    <span>Zone d'Affectation</span>
                    <span className="text-[9px] text-blue-700 font-bold font-mono">Automatique</span>
                  </label>
                  <div className="h-8 px-2.5 rounded-xl border border-blue-200 bg-blue-50/80 flex items-center justify-between text-xs font-semibold text-blue-900">
                    <div className="flex items-center gap-1.5 truncate">
                      <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span className="truncate">{maintenanceZone.libelle}</span>
                    </div>
                    <span className="text-[10px] font-mono bg-blue-200/80 text-blue-900 px-1.5 py-0.5 rounded font-bold shrink-0">
                      {maintenanceZone.id_zone}
                    </span>
                  </div>
                  <p className="text-[9.5px] text-blue-700/80 mt-1">
                    Attribution automatique à l'Atelier Central Maintenance pour l'usage personnel du technicien.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* MODE 3: OPÉRATEUR */}
          {(form.usage_type === 'operation' || form.usage_type === 'operator') && (
            <div className="space-y-2.5 pt-1">
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="text-[10.5px] font-bold text-purple-950 uppercase tracking-wider block mb-1 flex items-center justify-between">
                    <span>Opérateur Demandeur</span>
                    <span className="text-[9px] text-purple-800 font-bold">*Requis</span>
                  </label>
                  <CustomSelect
                    value={form.operation}
                    onChange={(val) => {
                      const op = operatorsList.find((o) => o.nom === val);
                      const opZone = op?.id_zone || zones[0]?.id_zone || '';
                      const respsForZone = getResponsablesForZone(opZone);
                      const bestResp = respsForZone[0] || null;
                      const machs = activeMachinesList.filter((m) => m.id_zone_default === opZone);
                      setForm((prev: any) => ({
                        ...prev,
                        operation: val,
                        id_operation: op?.id_operation || '',
                        technicien: val,
                        id_technician: op?.id_operation || '',
                        demandeur: val,
                        id_zone: opZone,
                        responsable_validation: bestResp ? bestResp.nom : '',
                        id_responsable_validation: bestResp ? bestResp.id_operation : '',
                        id_machine_registered: machs.some((m) => m.id_machine_registered === prev.id_machine_registered)
                          ? prev.id_machine_registered
                          : '',
                      }));
                    }}
                    options={operatorsList.map((op) => ({
                      value: op.nom,
                      label: op.nom,
                      badge: op.id_operation,
                      sublabel: op.id_zone ? `Zone: ${op.id_zone}` : 'Opérateur',
                    }))}
                    placeholder="-- Sélectionner l'Opérateur --"
                    onAddNew={onOpenAddOperator}
                  />
                </div>

                <div>
                  <label className="text-[10.5px] font-bold text-purple-950 uppercase tracking-wider block mb-1 flex items-center justify-between">
                    <span>Zone (Liée à l'Opérateur)</span>
                    <span className="text-[9px] text-purple-800 font-bold font-mono">Auto-Déduite</span>
                  </label>
                  <div className="h-8 px-2.5 rounded-xl border border-purple-200 bg-purple-50/80 flex items-center justify-between text-xs font-semibold text-purple-900">
                    <div className="flex items-center gap-1.5 truncate">
                      <MapPin className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                      <span className="truncate">
                        {zones.find((z) => z.id_zone === form.id_zone)?.libelle || form.id_zone || 'Zone Opérateur'}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono bg-purple-200/80 text-purple-900 px-1.5 py-0.5 rounded font-bold shrink-0">
                      {form.id_zone || 'ZONE'}
                    </span>
                  </div>
                  <p className="text-[9.5px] text-purple-700/80 mt-1">
                    Zone d'affectation rattachée à la fiche de l'opérateur.
                  </p>
                </div>

                <div>
                  <label className="text-[10.5px] font-bold text-purple-950 uppercase tracking-wider block mb-1 flex items-center justify-between">
                    <span>Responsable Référent</span>
                    <span className="text-[9px] text-purple-800 font-semibold font-mono">Filtré Zone</span>
                  </label>
                  <CustomSelect
                    value={form.responsable_validation || form.technicien}
                    onChange={(val) => {
                      const r = responsablesList.find((resp) => resp.nom === val);
                      setForm((prev: any) => ({
                        ...prev,
                        responsable_validation: val,
                        id_responsable_validation: r?.id_operation || '',
                      }));
                    }}
                    options={operatorFilteredResponsables.map((r) => ({
                      value: r.nom,
                      label: r.nom,
                      badge: r.id_operation,
                      sublabel: r.template_label || r.type_profil || 'Responsable Zone',
                    }))}
                    placeholder="-- Responsable de la Zone --"
                    onAddNew={onOpenAddChef}
                  />
                </div>
              </div>

              <div>
                <label className="text-[10.5px] font-bold text-purple-950 uppercase tracking-wider block mb-1 flex items-center justify-between">
                  <span>Machine Concernée (Optionnel)</span>
                  <span className="text-[9.5px] text-purple-700 font-medium">
                    {form.id_zone
                      ? `Machines de la Zone ${form.id_zone} (ou sans machine)`
                      : 'Sélectionner d’abord l’Opérateur'}
                  </span>
                </label>
                <CustomSelect
                  value={form.id_machine_registered}
                  onChange={(val) => setForm({ ...form, id_machine_registered: val })}
                  options={[
                    { value: '', label: '-- Aucune machine / Usage ou dotation Zone générale --' },
                    ...usageAvailableMachines.map((m) => ({
                      value: m.id_machine_registered,
                      label: `[${m.id_machine_registered}] ${m.designation}`,
                      sublabel: m.technician ? `Tech: ${m.technician}` : '',
                    })),
                  ]}
                  placeholder="-- Machine (Optionnel) --"
                  onAddNew={onOpenAddMachine}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sub-fields for CORRECTIVE action */}
      {form.action_id === 'CORRECTIVE' && (
        <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-200/90 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-[10.5px] font-bold text-blue-950 uppercase tracking-wider flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5 text-blue-700" />
              <span>Paramètres de l'Intervention Corrective (Dépannage Curatif) :</span>
            </label>
            <span className="text-[9.5px] text-blue-800 font-semibold bg-blue-100/90 px-2 py-0.5 rounded border border-blue-300 flex items-center gap-1">
              <Wrench className="w-2.5 h-2.5 text-blue-600" />
              Dépannage & Curatif
            </span>
          </div>

          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[10.5px] font-bold text-blue-950 uppercase tracking-wider block mb-1 flex items-center justify-between">
                  <span>Zone de l'Intervention</span>
                  <span className="text-[9px] text-blue-700 font-bold">*Requis</span>
                </label>
                <CustomSelect
                  value={form.id_zone}
                  onChange={(val) => {
                    const machs = activeMachinesList.filter((m) => m.id_zone_default === val);
                    const sup = findSupervisorForZone(val);
                    setForm((prev: any) => ({
                      ...prev,
                      id_zone: val,
                      id_machine_registered: machs.some((m) => m.id_machine_registered === prev.id_machine_registered)
                        ? prev.id_machine_registered
                        : (machs[0]?.id_machine_registered || ''),
                      operation: sup ? sup.nom : prev.operation,
                      id_operation: sup ? sup.id_operation : prev.id_operation,
                    }));
                  }}
                  options={zones.map((z) => ({
                    value: z.id_zone,
                    label: `${z.libelle} (${z.id_zone})`,
                  }))}
                  placeholder="-- Zone --"
                  onAddNew={onOpenAddZone}
                />
              </div>

              <div>
                <label className="text-[10.5px] font-bold text-blue-950 uppercase tracking-wider block mb-1 flex items-center justify-between">
                  <span>Machine Concernée</span>
                  <span className="text-[9px] text-blue-700 font-mono">Filtrée par Zone</span>
                </label>
                <CustomSelect
                  value={form.id_machine_registered}
                  onChange={(val) => {
                    const m = machines.find((mach) => mach.id_machine_registered === val);
                    const targetZone = m?.id_zone_default || form.id_zone;
                    const sup = findSupervisorForZone(targetZone);
                    setForm((prev: any) => ({
                      ...prev,
                      id_machine_registered: val,
                      id_zone: targetZone,
                      technicien: m?.technician || prev.technicien,
                      operation: sup ? sup.nom : prev.operation,
                      id_operation: sup ? sup.id_operation : prev.id_operation,
                    }));
                  }}
                  options={[
                    { value: '', label: '-- Atelier / Sans Machine Spécifique --' },
                    ...availableMachines.map((m) => ({
                      value: m.id_machine_registered,
                      label: `[${m.id_machine_registered}] ${m.designation}`,
                      sublabel: m.technician ? `Tech assigné: ${m.technician}` : '',
                    })),
                  ]}
                  placeholder="-- Machine --"
                  onAddNew={onOpenAddMachine}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[10.5px] font-bold text-blue-950 uppercase tracking-wider block mb-1 flex items-center justify-between">
                  <span>Technicien Intervenant</span>
                  <span className="text-[9px] font-semibold text-blue-800 bg-blue-100 px-1.5 py-0.5 rounded border border-blue-200">
                    Tous techniciens (Usine)
                  </span>
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
                <label className="text-[10.5px] font-bold text-blue-950 uppercase tracking-wider block mb-1 flex items-center justify-between">
                  <span>Responsable (RESP)</span>
                  <span className="text-[9px] font-bold text-blue-800 bg-blue-100 px-1.5 py-0.5 rounded border border-blue-200 flex items-center gap-1">
                    <Crown className="w-2.5 h-2.5 text-blue-600" />
                    Auto-déduit (Zone)
                  </span>
                </label>
                <CustomSelect
                  value={form.operation}
                  onChange={(val) => {
                    const s = responsablesList.find((sup) => sup.nom === val);
                    setForm({
                      ...form,
                      operation: val,
                      id_operation: s?.id_operation || '',
                    });
                  }}
                  options={[
                    { value: '', label: '-- Aucun Responsable --' },
                    ...responsablesList.map((s) => ({
                      value: s.nom,
                      label: s.nom,
                      badge: s.id_operation,
                      sublabel: s.template_label || s.template_id || s.type_profil,
                    })),
                  ]}
                  placeholder="-- Responsable (RESP) --"
                  onAddNew={onOpenAddChef}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub-fields for PREVENTIVE action */}
      {form.action_id === 'PREVENTIVE' && (
        <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200/90 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-[10.5px] font-bold text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-emerald-700" />
              <span>Paramètres de la Maintenance Préventive (Planifiée) :</span>
            </label>
            <span className="text-[9.5px] text-emerald-800 font-semibold bg-emerald-100/90 px-2 py-0.5 rounded border border-emerald-300 flex items-center gap-1">
              <ShieldCheck className="w-2.5 h-2.5 text-emerald-600" />
              Gamme & Entretien Planifié
            </span>
          </div>

          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[10.5px] font-bold text-emerald-950 uppercase tracking-wider block mb-1 flex items-center justify-between">
                  <span>Zone de l'Intervention</span>
                  <span className="text-[9px] text-emerald-700 font-bold">*Requis</span>
                </label>
                <CustomSelect
                  value={form.id_zone}
                  onChange={(val) => {
                    const machs = activeMachinesList.filter((m) => m.id_zone_default === val);
                    const sup = findSupervisorForZone(val);
                    setForm((prev: any) => ({
                      ...prev,
                      id_zone: val,
                      id_machine_registered: machs.some((m) => m.id_machine_registered === prev.id_machine_registered)
                        ? prev.id_machine_registered
                        : (machs[0]?.id_machine_registered || ''),
                      operation: sup ? sup.nom : prev.operation,
                      id_operation: sup ? sup.id_operation : prev.id_operation,
                    }));
                  }}
                  options={zones.map((z) => ({
                    value: z.id_zone,
                    label: `${z.libelle} (${z.id_zone})`,
                  }))}
                  placeholder="-- Zone --"
                  onAddNew={onOpenAddZone}
                />
              </div>

              <div>
                <label className="text-[10.5px] font-bold text-emerald-950 uppercase tracking-wider block mb-1 flex items-center justify-between">
                  <span>Machine Concernée</span>
                  <span className="text-[9px] text-emerald-700 font-mono">Filtrée par Zone</span>
                </label>
                <CustomSelect
                  value={form.id_machine_registered}
                  onChange={(val) => {
                    const m = machines.find((mach) => mach.id_machine_registered === val);
                    const targetZone = m?.id_zone_default || form.id_zone;
                    const sup = findSupervisorForZone(targetZone);
                    setForm((prev: any) => ({
                      ...prev,
                      id_machine_registered: val,
                      id_zone: targetZone,
                      technicien: m?.technician || prev.technicien,
                      operation: sup ? sup.nom : prev.operation,
                      id_operation: sup ? sup.id_operation : prev.id_operation,
                    }));
                  }}
                  options={[
                    { value: '', label: '-- Atelier / Sans Machine Spécifique --' },
                    ...availableMachines.map((m) => ({
                      value: m.id_machine_registered,
                      label: `[${m.id_machine_registered}] ${m.designation}`,
                      sublabel: m.technician ? `Tech assigné: ${m.technician}` : '',
                    })),
                  ]}
                  placeholder="-- Machine --"
                  onAddNew={onOpenAddMachine}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[10.5px] font-bold text-emerald-950 uppercase tracking-wider block mb-1 flex items-center justify-between">
                  <span>Technicien Intervenant</span>
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
                  placeholder="-- Technicien --"
                  onAddNew={onOpenAddTech}
                />
              </div>

              <div>
                <label className="text-[10.5px] font-bold text-emerald-950 uppercase tracking-wider block mb-1 flex items-center justify-between">
                  <span>Responsable (RESP)</span>
                  <span className="text-[9px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                    <Crown className="w-2.5 h-2.5 text-emerald-600" />
                    Auto-déduit (Zone)
                  </span>
                </label>
                <CustomSelect
                  value={form.operation}
                  onChange={(val) => {
                    const s = responsablesList.find((sup) => sup.nom === val);
                    setForm({
                      ...form,
                      operation: val,
                      id_operation: s?.id_operation || '',
                    });
                  }}
                  options={[
                    { value: '', label: '-- Aucun Responsable --' },
                    ...responsablesList.map((s) => ({
                      value: s.nom,
                      label: s.nom,
                      badge: s.id_operation,
                      sublabel: s.template_label || s.template_id || s.type_profil,
                    })),
                  ]}
                  placeholder="-- Responsable (RESP) --"
                  onAddNew={onOpenAddChef}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub-fields for AMELIORATIVE action */}
      {form.action_id === 'AMELIORATIVE' && (
        <div className="p-3 bg-purple-50/70 rounded-xl border border-purple-200/90 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-[10.5px] font-bold text-purple-950 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-700" />
              <span>Paramètres d'Amélioration & Travaux Neufs :</span>
            </label>
            <span className="text-[9.5px] text-purple-800 font-semibold bg-purple-100/90 px-2 py-0.5 rounded border border-purple-300 flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5 text-purple-600" />
              Projet & Travaux Neufs
            </span>
          </div>

          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[10.5px] font-bold text-purple-950 uppercase tracking-wider block mb-1 flex items-center justify-between">
                  <span>Zone d'Implantation</span>
                  <span className="text-[9px] text-purple-700 font-bold">*Requis</span>
                </label>
                <CustomSelect
                  value={form.id_zone}
                  onChange={(val) => {
                    const machs = activeMachinesList.filter((m) => m.id_zone_default === val);
                    const sup = findSupervisorForZone(val);
                    setForm((prev: any) => ({
                      ...prev,
                      id_zone: val,
                      id_machine_registered: machs.some((m) => m.id_machine_registered === prev.id_machine_registered)
                        ? prev.id_machine_registered
                        : (machs[0]?.id_machine_registered || ''),
                      operation: sup ? sup.nom : prev.operation,
                      id_operation: sup ? sup.id_operation : prev.id_operation,
                    }));
                  }}
                  options={zones.map((z) => ({
                    value: z.id_zone,
                    label: `${z.libelle} (${z.id_zone})`,
                  }))}
                  placeholder="-- Zone --"
                  onAddNew={onOpenAddZone}
                />
              </div>

              <div>
                <label className="text-[10.5px] font-bold text-purple-950 uppercase tracking-wider block mb-1 flex items-center justify-between">
                  <span>Machine ou Installation</span>
                  <span className="text-[9px] text-purple-700 font-mono">Filtrée par Zone</span>
                </label>
                <CustomSelect
                  value={form.id_machine_registered}
                  onChange={(val) => {
                    const m = machines.find((mach) => mach.id_machine_registered === val);
                    const targetZone = m?.id_zone_default || form.id_zone;
                    const sup = findSupervisorForZone(targetZone);
                    setForm((prev: any) => ({
                      ...prev,
                      id_machine_registered: val,
                      id_zone: targetZone,
                      technicien: m?.technician || prev.technicien,
                      operation: sup ? sup.nom : prev.operation,
                      id_operation: sup ? sup.id_operation : prev.id_operation,
                    }));
                  }}
                  options={[
                    { value: '', label: '-- Installation Générale / Sans Machine --' },
                    ...availableMachines.map((m) => ({
                      value: m.id_machine_registered,
                      label: `[${m.id_machine_registered}] ${m.designation}`,
                      sublabel: m.technician ? `Tech assigné: ${m.technician}` : '',
                    })),
                  ]}
                  placeholder="-- Machine --"
                  onAddNew={onOpenAddMachine}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[10.5px] font-bold text-purple-950 uppercase tracking-wider block mb-1 flex items-center justify-between">
                  <span>Technicien / Chargé de Travaux</span>
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

              <div>
                <label className="text-[10.5px] font-bold text-purple-950 uppercase tracking-wider block mb-1 flex items-center justify-between">
                  <span>Responsable (RESP)</span>
                  <span className="text-[9px] font-bold text-purple-800 bg-purple-100 px-1.5 py-0.5 rounded border border-purple-200 flex items-center gap-1">
                    <Crown className="w-2.5 h-2.5 text-purple-600" />
                    Auto-déduit (Zone)
                  </span>
                </label>
                <CustomSelect
                  value={form.operation}
                  onChange={(val) => {
                    const s = responsablesList.find((sup) => sup.nom === val);
                    setForm({
                      ...form,
                      operation: val,
                      id_operation: s?.id_operation || '',
                    });
                  }}
                  options={[
                    { value: '', label: '-- Aucun Responsable --' },
                    ...responsablesList.map((s) => ({
                      value: s.nom,
                      label: s.nom,
                      badge: s.id_operation,
                      sublabel: s.template_label || s.template_id || s.type_profil,
                    })),
                  ]}
                  placeholder="-- Responsable (RESP) --"
                  onAddNew={onOpenAddChef}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub-fields for INVENTAIRE action */}
      {form.action_id === 'INVENTAIRE' && (
        <div className="p-3 bg-rose-50/70 rounded-xl border border-rose-200/90 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-[10.5px] font-bold text-rose-950 uppercase tracking-wider flex items-center gap-1.5">
              <ClipboardList className="w-3.5 h-3.5 text-rose-700" />
              <span>Régularisation & Déstockage pour Écart d'Inventaire :</span>
            </label>
            <span className="text-[9.5px] text-rose-800 font-semibold bg-rose-100/90 px-2 py-0.5 rounded border border-rose-300 flex items-center gap-1">
              <ClipboardList className="w-2.5 h-2.5 text-rose-600" />
              Ajustement Écart & Rebut
            </span>
          </div>

          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[10.5px] font-bold text-rose-950 uppercase tracking-wider block mb-1 flex items-center justify-between">
                  <span>Zone / Magasin</span>
                  <span className="text-[9px] text-rose-700 font-bold">*Requis</span>
                </label>
                <CustomSelect
                  value={form.id_zone}
                  onChange={(val) => {
                    const sup = findSupervisorForZone(val);
                    setForm((prev: any) => ({
                      ...prev,
                      id_zone: val,
                      operation: sup ? sup.nom : prev.operation,
                      id_operation: sup ? sup.id_operation : prev.id_operation,
                    }));
                  }}
                  options={zones.map((z) => ({
                    value: z.id_zone,
                    label: `${z.libelle} (${z.id_zone})`,
                  }))}
                  placeholder="-- Zone --"
                  onAddNew={onOpenAddZone}
                />
              </div>

              <div>
                <label className="text-[10.5px] font-bold text-rose-950 uppercase tracking-wider block mb-1 flex items-center justify-between">
                  <span>Motif de l'Écart / Rebut</span>
                  <span className="text-[9px] text-rose-700 font-bold">*Requis</span>
                </label>
                <select
                  value={form.commentaire || 'Écart d’inventaire physique'}
                  onChange={(e) => setForm({ ...form, commentaire: e.target.value })}
                  className="w-full h-8 px-2.5 rounded-xl border border-rose-200 bg-white text-xs font-semibold text-slate-800"
                >
                  <option value="Écart d’inventaire physique">Écart d’inventaire physique</option>
                  <option value="Casse / Détérioration en atelier">Casse / Détérioration en atelier</option>
                  <option value="Rebut & Obsolescence">Rebut & Obsolescence</option>
                  <option value="Péremption ou Déclassement">Péremption ou Déclassement</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[10.5px] font-bold text-rose-950 uppercase tracking-wider block mb-1 flex items-center justify-between">
                  <span>Contrôleur / Technicien</span>
                  <span className="text-[9px] text-rose-700 font-bold">*Requis</span>
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

              <div className="flex items-center text-[10.5px] text-rose-800 font-medium bg-rose-100/70 px-3 py-1.5 rounded-xl border border-rose-200/80">
                ℹ️ Mode Inventaire : La sortie sera comptabilisée comme régularisation immédiate du stock physique.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
