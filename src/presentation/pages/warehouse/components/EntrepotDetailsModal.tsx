import { AlertTriangle, Calendar, Copy, ExternalLink, Layers, Warehouse, Wrench, X } from 'lucide-react';
import { CubeIcon } from '../../../components/common/icons/CubeIcon';
import { isWarehouseComponent } from '../../../../core/domain/EntrepotItem';
import { useGmaoStore } from '../../../../store/useGmaoStore';
import { evaluateComponentWearAndLifecycle } from '../../../../utils/componentHealthScore';

export interface EntrepotDetailsItem {
  id?: string;
  id_warehouse_item?: string;
  code?: string;
  ref?: string;
  designation?: string;
  designation_part?: string;
  nom?: string;
  status?: string;
  id_family?: string;
  id_templates?: string;
  mode_reparation_defaut?: string;
  tension_nominale?: string;
  courant_nominal_a?: string | number;
  indice_protection?: string;
  type_fixation?: string;
  id_type?: string;
  id_diag?: string;
  matiere_nuance?: string;
  ref_plan?: string;
  dimensions_brut?: string;
  traitement_thermique?: string;
  rattachement_type?: string;
  id_machine_registered?: string;
  id_machine?: string;
  id_zone?: string;
  emplacement?: string;
  remarques?: string;
  nature?: string;
  type_entrepot?: string;
  category?: string;
  [key: string]: unknown;
}

interface CorrectiveEventRecord {
  id?: string;
  id_composant?: string;
  id_part?: string;
  nom_composant?: string;
  nom_part?: string;
  code_machine?: string;
  num_bt?: string;
  anomalie?: string;
  action_realisee?: string;
  date_fin?: string;
  demande_date?: string;
}

interface SpareUsageRecord {
  ref?: string;
  reference?: string;
  designation?: string;
}

interface PreventiveExecutionRecord {
  id?: string;
  id_execution?: string;
  id_composant?: string;
  id_part?: string;
  nom_composant?: string;
  nom_part?: string;
  organe?: string;
  composant?: string;
  machineCode?: string;
  id_machine?: string;
  actionCode?: string;
  action_code?: string;
  taskDescription?: string;
  notes?: string;
  type_intervention?: string;
  observations?: string;
  sparesUsed?: SpareUsageRecord[];
  usedPDR?: SpareUsageRecord[];
  executedAt?: string;
  periodMonth?: string;
}

interface SortieExterneRecord {
  id?: string;
  id_composant?: string;
  code_composant?: string;
  id_warehouse_item?: string;
  code_moteur?: string;
  designation?: string;
  nom_composant?: string;
  prestataire?: string;
  nature_travaux?: string;
  motif?: string;
  date_sortie?: string;
}

export interface EntrepotDetailsModalProps {
  selectedDetails: EntrepotDetailsItem | null;
  onClose: () => void;
  t: (key: string) => string;
}

export function EntrepotDetailsModal({ selectedDetails, onClose, t }: EntrepotDetailsModalProps) {
  if (!selectedDetails) return null;

  const storeState = useGmaoStore.getState();
  const allCorrective = (storeState.correctiveInterventions || []) as CorrectiveEventRecord[];
  const allPreventiveExecs = (storeState.preventiveExecutions || []) as PreventiveExecutionRecord[];
  const allSortiesExterne = (storeState.sortiesExterne || []) as SortieExterneRecord[];

  const itemId = String(
    selectedDetails.id_warehouse_item || selectedDetails.id || selectedDetails.code || ''
  )
    .trim()
    .toUpperCase();
  const itemCode = String(selectedDetails.code || selectedDetails.ref || '').trim().toUpperCase();
  const itemDesig = String(
    selectedDetails.designation || selectedDetails.designation_part || selectedDetails.nom || ''
  )
    .trim()
    .toUpperCase();
  const itemMach = String(selectedDetails.id_machine_registered || selectedDetails.id_machine || '')
    .trim()
    .toUpperCase();

  const linkedCorrective = allCorrective.filter((ci) => {
    const cId = String(ci.id_composant || '').trim().toUpperCase();
    const pId = String(ci.id_part || '').trim().toUpperCase();
    if (itemId && (cId === itemId || pId === itemId)) return true;
    if (itemCode && (cId === itemCode || pId === itemCode)) return true;
    const cName = String(ci.nom_composant || ci.nom_part || '').trim().toUpperCase();
    const ciMach = String(ci.code_machine || '').trim().toUpperCase();
    return Boolean(itemDesig && cName === itemDesig && (!itemMach || ciMach === itemMach));
  });

  const linkedPreventive = allPreventiveExecs.filter((pe) => {
    const cId = String(pe.id_composant || '').trim().toUpperCase();
    const pId = String(pe.id_part || '').trim().toUpperCase();
    if (itemId && (cId === itemId || pId === itemId)) return true;
    if (itemCode && (cId === itemCode || pId === itemCode)) return true;
    const peComp = String(pe.nom_composant || pe.nom_part || pe.organe || pe.composant || '')
      .trim()
      .toUpperCase();
    const peMach = String(pe.machineCode || pe.id_machine || '').trim().toUpperCase();
    return Boolean(itemDesig && peComp === itemDesig && (!itemMach || peMach === itemMach));
  });

  const linkedExterne = allSortiesExterne.filter((se) => {
    const sCompId = String(
      se.id_composant || se.code_composant || se.id_warehouse_item || se.code_moteur || ''
    )
      .trim()
      .toUpperCase();
    if (itemId && sCompId === itemId) return true;
    if (itemCode && sCompId === itemCode) return true;
    const sDesig = String(se.designation || se.nom_composant || '').trim().toUpperCase();
    return Boolean(itemDesig && sDesig === itemDesig);
  });

  const totalEvents = linkedCorrective.length + linkedPreventive.length + linkedExterne.length;

  const wearAnalysis = evaluateComponentWearAndLifecycle(selectedDetails, {
    correctiveInterventions: allCorrective,
    preventiveExecutions: allPreventiveExecs,
    sortiesExterne: allSortiesExterne,
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center font-bold">
              <Warehouse className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                <span>{selectedDetails.code || selectedDetails.id_warehouse_item}</span>
                {selectedDetails.ref && (
                  <span className="text-xs font-mono font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    Réf: {selectedDetails.ref}
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-500">{t('entrepot.subtitle')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          {/* Identifiers Card (Map Philosophy) */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {t('entrepot.modal.code_element')}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-white p-2 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-400 block font-semibold">{t('entrepot.modal.code_element')}</span>
                <span className="font-mono font-bold text-teal-800 text-sm">
                  {selectedDetails.code || selectedDetails.id_warehouse_item}
                </span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-400 block font-semibold">{t('entrepot.columns.code_ref')}</span>
                <span className="font-mono font-bold text-slate-800 text-sm">{selectedDetails.ref || 'N/A'}</span>
              </div>
            </div>
            {selectedDetails.id && (
              <div className="bg-white p-2 rounded-lg border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold">ID</span>
                  <span className="font-mono text-[11px] font-bold text-slate-700 select-all">{selectedDetails.id}</span>
                </div>
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(selectedDetails.id || '')}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold cursor-pointer border border-slate-300"
                >
                  <Copy className="w-3 h-3" />
                  <span>Copier</span>
                </button>
              </div>
            )}
          </div>

          {/* Designation */}
          <div className="p-3 bg-slate-50 rounded-xl space-y-1">
            <div className="text-[10px] font-bold text-slate-400 uppercase">{t('entrepot.modal.designation')}</div>
            <div className="font-semibold text-slate-900">{selectedDetails.designation}</div>
          </div>

          {/* Nature and Status */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 bg-slate-50 rounded-xl">
              <div className="text-[10px] font-bold text-slate-400 uppercase">{t('entrepot.modal.nature')}</div>
              <div className="font-bold text-slate-800 flex items-center gap-1.5 mt-0.5">
                {isWarehouseComponent(selectedDetails) ? (
                  <span className="inline-flex items-center gap-1 text-blue-700">
                    <Layers className="w-3.5 h-3.5 text-blue-600" />
                    {t('entrepot.modal.nature_component')}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-indigo-700">
                    <CubeIcon className="w-3.5 h-3.5 text-indigo-600" />
                    {t('entrepot.modal.nature_part')}
                  </span>
                )}
              </div>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-xl">
              <div className="text-[10px] font-bold text-slate-400 uppercase">{t('entrepot.modal.status')}</div>
              <div className="font-bold text-slate-800">{selectedDetails.status}</div>
            </div>
          </div>

          {isWarehouseComponent(selectedDetails) ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 bg-blue-50/50 rounded-xl border border-blue-100">
                  <div className="text-[10px] font-bold text-blue-700 uppercase">{t('entrepot.modal.family')}</div>
                  <div className="font-bold text-slate-800">{selectedDetails.id_family || '--'}</div>
                </div>
                <div className="p-2.5 bg-blue-50/50 rounded-xl border border-blue-100">
                  <div className="text-[10px] font-bold text-blue-700 uppercase">{t('entrepot.modal.template')}</div>
                  <div className="font-bold text-slate-800">{selectedDetails.id_templates || '--'}</div>
                </div>
              </div>
              {(selectedDetails.mode_reparation_defaut ||
                selectedDetails.tension_nominale ||
                selectedDetails.courant_nominal_a ||
                selectedDetails.indice_protection ||
                selectedDetails.type_fixation) && (
                <div className="p-2.5 bg-blue-50/30 rounded-xl border border-blue-100 grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {selectedDetails.mode_reparation_defaut && selectedDetails.mode_reparation_defaut !== 'NON_DEFINI' && (
                    <div>
                      <span className="text-[9.5px] font-bold text-blue-700 uppercase block">Mode Répar.</span>
                      <span className="font-mono font-bold text-slate-800">{selectedDetails.mode_reparation_defaut}</span>
                    </div>
                  )}
                  {selectedDetails.tension_nominale && (
                    <div>
                      <span className="text-[9.5px] font-bold text-blue-700 uppercase block">Tension (U)</span>
                      <span className="font-mono font-bold text-slate-800">{selectedDetails.tension_nominale}</span>
                    </div>
                  )}
                  {selectedDetails.courant_nominal_a && (
                    <div>
                      <span className="text-[9.5px] font-bold text-blue-700 uppercase block">Courant (A)</span>
                      <span className="font-mono font-bold text-slate-800">{selectedDetails.courant_nominal_a}</span>
                    </div>
                  )}
                  {selectedDetails.indice_protection && (
                    <div>
                      <span className="text-[9.5px] font-bold text-blue-700 uppercase block">Protection</span>
                      <span className="font-mono font-bold text-slate-800">{selectedDetails.indice_protection}</span>
                    </div>
                  )}
                  {selectedDetails.type_fixation && (
                    <div>
                      <span className="text-[9.5px] font-bold text-blue-700 uppercase block">Fixation</span>
                      <span className="font-mono font-bold text-slate-800">{selectedDetails.type_fixation}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 bg-indigo-50/50 rounded-xl border border-indigo-100">
                  <div className="text-[10px] font-bold text-indigo-700 uppercase">{t('entrepot.modal.type')}</div>
                  <div className="font-bold text-slate-800">{selectedDetails.id_type || '--'}</div>
                </div>
                <div className="p-2.5 bg-indigo-50/50 rounded-xl border border-indigo-100">
                  <div className="text-[10px] font-bold text-indigo-700 uppercase">{t('entrepot.modal.diag')}</div>
                  <div className="font-bold text-slate-800">{selectedDetails.id_diag || '--'}</div>
                </div>
              </div>
              {(selectedDetails.matiere_nuance ||
                selectedDetails.ref_plan ||
                selectedDetails.dimensions_brut ||
                selectedDetails.traitement_thermique) && (
                <div className="p-2.5 bg-indigo-50/30 rounded-xl border border-indigo-100 grid grid-cols-2 gap-2">
                  {selectedDetails.matiere_nuance && (
                    <div>
                      <span className="text-[9.5px] font-bold text-indigo-700 uppercase block">Matière / Nuance</span>
                      <span className="font-mono font-bold text-slate-800">{selectedDetails.matiere_nuance}</span>
                    </div>
                  )}
                  {selectedDetails.ref_plan && (
                    <div>
                      <span className="text-[9.5px] font-bold text-indigo-700 uppercase block">Réf. Plan</span>
                      <span className="font-mono font-bold text-slate-800">{selectedDetails.ref_plan}</span>
                    </div>
                  )}
                  {selectedDetails.dimensions_brut && (
                    <div>
                      <span className="text-[9.5px] font-bold text-indigo-700 uppercase block">Dimensions Brut</span>
                      <span className="font-mono font-bold text-slate-800">{selectedDetails.dimensions_brut}</span>
                    </div>
                  )}
                  {selectedDetails.traitement_thermique && (
                    <div>
                      <span className="text-[9.5px] font-bold text-indigo-700 uppercase block">Traitement Thermique</span>
                      <span className="font-mono font-bold text-slate-800">{selectedDetails.traitement_thermique}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Machine Rattachement */}
          <div className="p-3 bg-slate-50 rounded-xl space-y-2">
            <div className="text-[10px] font-bold text-slate-400 uppercase">{t('entrepot.modal.rattachement')}</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] text-slate-400 block font-medium">{t('entrepot.modal.rattachement')}</span>
                <span className="font-bold text-slate-800">
                  {selectedDetails.rattachement_type === 'MACHINE'
                    ? `${t('entrepot.modal.machine')} : ${selectedDetails.id_machine_registered || selectedDetails.id_machine || '--'}`
                    : selectedDetails.rattachement_type === 'ZONE'
                      ? `${t('entrepot.modal.zone')} : ${selectedDetails.id_zone || '--'}`
                      : t('entrepot.modal.location')}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-medium">{t('entrepot.modal.location')}</span>
                <span className="font-mono font-bold text-slate-800">{selectedDetails.emplacement || '--'}</span>
              </div>
            </div>
          </div>

          {selectedDetails.remarques && (
            <div className="p-3 bg-slate-50 rounded-xl space-y-1">
              <div className="text-[10px] font-bold text-slate-400 uppercase">{t('entrepot.modal.notes')}</div>
              <div className="text-slate-700">{selectedDetails.remarques}</div>
            </div>
          )}

          {/* P1: Carnet de Vie & Historique d'Interventions (Correctif + Préventif + Externe) */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] font-extrabold text-slate-800 uppercase tracking-wider">
                Carnet de Vie &amp; Historique ({totalEvents})
              </span>
              <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold">
                <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200">
                  BT: {linkedCorrective.length}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                  PM: {linkedPreventive.length}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                  Ext: {linkedExterne.length}
                </span>
              </div>
            </div>

            {/* Score d'Usure & Analyse Technico-Économique (BER) */}
            {isWarehouseComponent(selectedDetails) && (
              <div
                className={`p-3 rounded-xl border space-y-2 ${
                  wearAnalysis.shouldReform
                    ? 'bg-rose-50/90 border-rose-300'
                    : wearAnalysis.statusLevel === 'WATCH'
                      ? 'bg-amber-50/80 border-amber-300'
                      : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-700">
                    Score d&apos;Usure &amp; Coût Cumulé (Seuil BER 70%)
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-black border ${
                      wearAnalysis.shouldReform
                        ? 'bg-rose-600 text-white border-rose-700'
                        : wearAnalysis.statusLevel === 'WATCH'
                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    }`}
                  >
                    Santé : {wearAnalysis.wearScore}/100
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-[11px]">
                  <div className="p-2 rounded-lg bg-white/90 border border-slate-200/80">
                    <span className="text-[9.5px] text-slate-400 block font-bold uppercase">Coût Cumulé Répar.</span>
                    <span className="font-mono font-black text-slate-900">
                      {wearAnalysis.cumulativeRepairCost.toFixed(0)} DH
                    </span>
                    <span className="text-[9.5px] text-slate-500 block font-mono">
                      ({wearAnalysis.costRatioPercent}% de {wearAnalysis.replacementValue.toFixed(0)} DH)
                    </span>
                  </div>

                  <div className="p-2 rounded-lg bg-white/90 border border-slate-200/80">
                    <span className="text-[9.5px] text-slate-400 block font-bold uppercase">Pannes (6 mois)</span>
                    <span
                      className={`font-mono font-black ${
                        wearAnalysis.recentBreakdowns6Months >= 3 ? 'text-rose-700' : 'text-slate-900'
                      }`}
                    >
                      {wearAnalysis.recentBreakdowns6Months} panne(s)
                    </span>
                    <span className="text-[9.5px] text-slate-500 block">Seuil alerte: ≥ 3</span>
                  </div>

                  <div className="p-2 rounded-lg bg-white/90 border border-slate-200/80">
                    <span className="text-[9.5px] text-slate-400 block font-bold uppercase">Rebobinages / Ext.</span>
                    <span
                      className={`font-mono font-black ${
                        wearAnalysis.bobinageCount >= 3 ? 'text-rose-700' : 'text-slate-900'
                      }`}
                    >
                      {wearAnalysis.bobinageCount} cycle(s)
                    </span>
                    <span className="text-[9.5px] text-slate-500 block">
                      Coût Ext: {wearAnalysis.externalCost.toFixed(0)} DH
                    </span>
                  </div>
                </div>

                {/* Cost Ratio Progress Bar */}
                <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      wearAnalysis.costRatioPercent >= 70
                        ? 'bg-rose-600'
                        : wearAnalysis.costRatioPercent >= 45
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, wearAnalysis.costRatioPercent)}%` }}
                  />
                </div>

                {/* Recommendation Banner */}
                <div
                  className={`p-2 rounded-lg text-[11px] font-bold flex items-start gap-2 ${
                    wearAnalysis.shouldReform
                      ? 'bg-rose-600 text-white'
                      : wearAnalysis.statusLevel === 'WATCH'
                        ? 'bg-amber-100 text-amber-950'
                        : 'bg-emerald-50 text-emerald-900'
                  }`}
                >
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <div>{wearAnalysis.recommendation}</div>
                    {wearAnalysis.reformReasons.length > 0 && (
                      <div className="text-[10px] font-normal opacity-90">
                        {wearAnalysis.reformReasons.join(' • ')}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {totalEvents === 0 ? (
              <div className="text-[11px] text-slate-400 italic py-2 text-center bg-white rounded-lg border border-dashed border-slate-200">
                Aucune intervention (Corrective, Préventive ou Externe) rattachée à cet identifiant ({itemId}).
              </div>
            ) : (
              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                {linkedCorrective.slice(0, 6).map((ci, idx) => (
                  <div
                    key={`cv-ci-${ci.id || idx}`}
                    className="p-2 rounded-lg bg-white border border-rose-200/80 flex items-center justify-between gap-2 text-[11px]"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Wrench className="w-3 h-3 text-rose-600 shrink-0" />
                        <span className="font-mono font-bold text-rose-900">{ci.num_bt || ci.id}</span>
                        <span className="font-semibold text-slate-800 truncate">
                          {ci.anomalie || 'Intervention corrective'}
                        </span>
                      </div>
                      {ci.action_realisee && (
                        <div className="text-[10px] text-slate-500 truncate mt-0.5">{ci.action_realisee}</div>
                      )}
                    </div>
                    <span className="font-mono text-[10px] text-slate-500 shrink-0">
                      {ci.date_fin || ci.demande_date || '--'}
                    </span>
                  </div>
                ))}

                {linkedPreventive.slice(0, 6).map((pe, idx) => {
                  const spares = Array.isArray(pe.sparesUsed)
                    ? pe.sparesUsed
                    : Array.isArray(pe.usedPDR)
                      ? pe.usedPDR
                      : [];
                  return (
                    <div
                      key={`cv-pe-${pe.id || pe.id_execution || idx}`}
                      className="p-2 rounded-lg bg-white border border-emerald-200/80 flex items-center justify-between gap-2 text-[11px]"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span className="font-mono font-bold text-emerald-900">
                            PM ({pe.actionCode || pe.action_code || 'C'})
                          </span>
                          <span className="font-semibold text-slate-800 truncate">
                            {pe.taskDescription ||
                              pe.notes ||
                              pe.type_intervention ||
                              pe.observations ||
                              'Exécution préventive'}
                          </span>
                        </div>
                        {spares.length > 0 && (
                          <div className="text-[10px] text-indigo-700 font-mono truncate mt-0.5">
                            PDR: {spares.map((p) => p.ref || p.reference || p.designation).join(', ')}
                          </div>
                        )}
                      </div>
                      <span className="font-mono text-[10px] text-slate-500 shrink-0">
                        {pe.executedAt || pe.periodMonth || '--'}
                      </span>
                    </div>
                  );
                })}

                {linkedExterne.slice(0, 4).map((se, idx) => (
                  <div
                    key={`cv-se-${se.id || idx}`}
                    className="p-2 rounded-lg bg-white border border-amber-200/80 flex items-center justify-between gap-2 text-[11px]"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <ExternalLink className="w-3 h-3 text-amber-600 shrink-0" />
                        <span className="font-mono font-bold text-amber-900">
                          Externe ({se.prestataire || 'Atelier'})
                        </span>
                        <span className="font-semibold text-slate-800 truncate">
                          {se.nature_travaux || se.motif || 'Révision externe'}
                        </span>
                      </div>
                    </div>
                    <span className="font-mono text-[10px] text-slate-500 shrink-0">{se.date_sortie || '--'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
          >
            {t('entrepot.buttons.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
