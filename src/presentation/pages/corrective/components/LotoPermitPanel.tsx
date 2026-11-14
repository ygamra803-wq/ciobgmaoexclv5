import { useState, useEffect } from 'react';
import {
  Lock,
  Unlock,
  ShieldAlert,
  ShieldCheck,
  Zap,
  Play,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import {
  VALID_LOTO_ENERGY_TYPES,
  isLotoRequired,
  resolveEffectiveLotoStatus,
  type ILotoPermit,
  type LotoEnergyType,
  type LotoInterventionLike,
  type LotoStatus,
} from '../../../../domain/corrective/lotoService';
import { useGmaoStore } from '../../../../store/useGmaoStore';

const ENERGY_LABELS: Record<LotoEnergyType, string> = {
  ELECTRIQUE: 'Électrique',
  HYDRAULIQUE: 'Hydraulique',
  PNEUMATIQUE: 'Pneumatique',
  MECANIQUE: 'Mécanique',
  THERMIQUE: 'Thermique',
};

export interface LotoInterventionRecord extends LotoInterventionLike {
  id?: string;
  num_bt?: string;
  code_machine?: string;
  statut?: string;
}

export interface LotoEnablePatch {
  requires_loto: boolean;
  loto_status: LotoStatus;
  loto: ILotoPermit;
  [key: string]: unknown;
}

export interface LotoPermitPanelProps {
  intervention?: LotoInterventionRecord | null;
  onUpdateIntervention?: (id: string, patch: LotoEnablePatch) => void;
  onStartWork?: (id: string) => void;
  showToast?: (message: string, type?: 'success' | 'warning' | 'error' | 'info') => void;
  isReadOnly?: boolean;
  actorId?: string;
  actorName?: string;
  actorRole?: string;
}

/**
 * Interactive LOTO Energy Isolation Permit panel (`ATTENTE_CONSIGNATION` -> `CONSIGNE` -> `DECONSIGNE`).
 * Enforces mandatory zero-energy test (`VAT`) on padlock lock and explicit zone clearance on unlock.
 */
export default function LotoPermitPanel({
  intervention,
  onUpdateIntervention,
  onStartWork,
  showToast,
  isReadOnly = false,
  actorId,
  actorName,
  actorRole,
}: LotoPermitPanelProps) {
  const handleConsignInterventionLoto = useGmaoStore((s) => s.handleConsignInterventionLoto);
  const handleDeconsignInterventionLoto = useGmaoStore((s) => s.handleDeconsignInterventionLoto);

  const required = isLotoRequired(intervention);
  const status = resolveEffectiveLotoStatus(intervention);
  const permit = intervention?.loto || {};
  const isClosed = intervention?.statut === 'CLOTURE' || intervention?.statut === 'ANNULE';

  const [numCadenas, setNumCadenas] = useState<string>(permit.num_cadenas || '');
  const [energyTypes, setEnergyTypes] = useState<LotoEnergyType[]>(
    Array.isArray(permit.energy_types) ? permit.energy_types : []
  );
  const [vatVerified, setVatVerified] = useState<boolean>(Boolean(permit.vat_verified));
  const [zoneCleared, setZoneCleared] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>(permit.notes || '');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showReconsignForm, setShowReconsignForm] = useState<boolean>(false);

  useEffect(() => {
    const p = intervention?.loto || {};
    setNumCadenas(p.num_cadenas || '');
    setEnergyTypes(Array.isArray(p.energy_types) ? p.energy_types : []);
    setVatVerified(Boolean(p.vat_verified));
    setZoneCleared(false);
    setNotes(p.notes || '');
    setErrorMsg(null);
    setShowReconsignForm(false);
  }, [intervention?.id, intervention?.loto_status]);

  if (!intervention) return null;

  const interventionId = String(intervention.id ?? intervention.num_bt ?? '');

  const toggleEnergy = (energy: LotoEnergyType) => {
    setEnergyTypes((prev) =>
      prev.includes(energy) ? prev.filter((item) => item !== energy) : [...prev, energy]
    );
  };

  const handleEnableLoto = () => {
    if (isReadOnly || isClosed || typeof onUpdateIntervention !== 'function' || !interventionId) return;
    setErrorMsg(null);
    onUpdateIntervention(interventionId, {
      requires_loto: true,
      loto_status: 'ATTENTE_CONSIGNATION',
      loto: {
        required: true,
        status: 'ATTENTE_CONSIGNATION',
        energy_types: energyTypes,
      },
    });
    showToast?.(
      `Permis LOTO activé sur ${intervention.num_bt || intervention.code_machine}. Procédez à la consignation.`,
      'info'
    );
  };

  const handleConsignSubmit = () => {
    if (!interventionId) return;
    setErrorMsg(null);
    const res = handleConsignInterventionLoto(interventionId, {
      num_cadenas: numCadenas,
      energy_types: energyTypes,
      vat_verified: vatVerified,
      notes,
      consignateur_id: actorId,
      consignateur_name: actorName,
      actorRole,
    });
    if (!res.valid) {
      const msg = res.reason || 'Consignation LOTO refusée.';
      setErrorMsg(msg);
      showToast?.(msg, 'warning');
      return;
    }
    setShowReconsignForm(false);
    showToast?.(
      `Équipement consigné (Cadenas ${numCadenas.trim()}) : intervention autorisée.`,
      'success'
    );
  };

  const handleDeconsignSubmit = () => {
    if (!interventionId) return;
    setErrorMsg(null);
    const res = handleDeconsignInterventionLoto(interventionId, {
      zone_cleared: zoneCleared,
      deconsignateur_id: actorId,
      deconsignateur_name: actorName,
      actorRole,
      notes,
    });
    if (!res.valid) {
      const msg = res.reason || 'Déconsignation LOTO refusée.';
      setErrorMsg(msg);
      showToast?.(msg, 'warning');
      return;
    }
    showToast?.(
      `Équipement déconsigné (DECONSIGNE) : remise en énergie sûre et clôture BT débloquée.`,
      'success'
    );
  };

  if (!required && status === 'NON_REQUIS') {
    return (
      <div
        data-testid="loto-permit-panel"
        className="bg-slate-50/90 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-500 shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                Permis de Consignation Énergétique (LOTO)
              </span>
              <span
                data-testid="loto-status-badge"
                className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-200/80 text-slate-700"
              >
                NON_REQUIS
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Aucune isolation énergétique requise par défaut pour ce Bon de Travail.
            </p>
          </div>
        </div>

        {!isReadOnly && !isClosed && typeof onUpdateIntervention === 'function' && (
          <button
            type="button"
            data-testid="loto-enable-btn"
            onClick={handleEnableLoto}
            className="px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs transition cursor-pointer inline-flex items-center gap-1.5 shrink-0"
          >
            <Lock className="w-3.5 h-3.5 text-amber-700" />
            <span>Exiger un Permis LOTO</span>
          </button>
        )}
      </div>
    );
  }

  const showConsignForm = status === 'ATTENTE_CONSIGNATION' || (status === 'DECONSIGNE' && showReconsignForm);

  return (
    <div
      data-testid="loto-permit-panel"
      className={`rounded-2xl border p-5 space-y-4 shadow-xs ${
        status === 'ATTENTE_CONSIGNATION'
          ? 'bg-rose-50/70 border-rose-300'
          : status === 'CONSIGNE'
          ? 'bg-amber-50/70 border-amber-300'
          : 'bg-emerald-50/70 border-emerald-300'
      }`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-black/10">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 ${
              status === 'ATTENTE_CONSIGNATION'
                ? 'bg-rose-100 border-rose-300 text-rose-700'
                : status === 'CONSIGNE'
                ? 'bg-amber-100 border-amber-300 text-amber-800'
                : 'bg-emerald-100 border-emerald-300 text-emerald-700'
            }`}
          >
            {status === 'DECONSIGNE' ? (
              <Unlock className="w-5 h-5" />
            ) : status === 'CONSIGNE' ? (
              <Lock className="w-5 h-5" />
            ) : (
              <ShieldAlert className="w-5 h-5" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                Permis de Consignation Énergétique (LOTO)
              </h4>
              <span
                data-testid="loto-status-badge"
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                  status === 'ATTENTE_CONSIGNATION'
                    ? 'bg-rose-600 text-white border-rose-700'
                    : status === 'CONSIGNE'
                    ? 'bg-amber-500 text-slate-950 border-amber-600'
                    : 'bg-emerald-600 text-white border-emerald-700'
                }`}
              >
                {status}
              </span>
            </div>
            <p className="text-[11px] text-slate-700 mt-0.5 font-medium">
              {status === 'ATTENTE_CONSIGNATION' &&
                'Démarrage des travaux bloqué : posez le cadenas, sélectionnez les énergies isolées et validez le test VAT.'}
              {status === 'CONSIGNE' &&
                'Équipement verrouillé et sécurisé. Effectuez la déconsignation avant toute clôture du Bon de Travail.'}
              {status === 'DECONSIGNE' &&
                'Cadenas retiré et zone dégagée : remise en énergie sûre et clôture du BT autorisée.'}
            </p>
          </div>
        </div>

        {status === 'CONSIGNE' &&
          intervention.statut !== 'EN_COURS' &&
          !isClosed &&
          !isReadOnly &&
          typeof onStartWork === 'function' && (
            <button
              type="button"
              data-testid="loto-start-work-btn"
              onClick={() => interventionId && onStartWork(interventionId)}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition cursor-pointer inline-flex items-center gap-1.5 shadow-sm shrink-0"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Démarrer l&apos;Intervention (EN_COURS)</span>
            </button>
          )}
      </div>

      {errorMsg && (
        <div
          data-testid="loto-error-banner"
          className="p-3 rounded-xl bg-rose-100 border border-rose-300 text-rose-950 text-xs font-bold flex items-center gap-2"
        >
          <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Consignation Form */}
      {showConsignForm && !isReadOnly && !isClosed && (
        <div data-testid="loto-consign-form" className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10.5px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                N° Cadenas LOTO *
              </label>
              <input
                type="text"
                data-testid="loto-padlock-input"
                value={numCadenas}
                onChange={(e) => setNumCadenas(e.target.value)}
                placeholder="Ex: CAD-2026-014"
                className="w-full h-9 px-3 rounded-xl border border-slate-300 bg-white text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-[10.5px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Notes de Consignation (Optionnel)
              </label>
              <input
                type="text"
                data-testid="loto-notes-input"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Sectionneur général Q1 + vanne V2"
                className="w-full h-9 px-3 rounded-xl border border-slate-300 bg-white text-xs text-slate-800 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10.5px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Énergies Isolées *
            </label>
            <div className="flex flex-wrap gap-2">
              {VALID_LOTO_ENERGY_TYPES.map((energy) => {
                const selected = energyTypes.includes(energy);
                return (
                  <button
                    key={energy}
                    type="button"
                    data-testid={`loto-energy-${energy}`}
                    onClick={() => toggleEnergy(energy)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer inline-flex items-center gap-1.5 ${
                      selected
                        ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    <Zap className={`w-3.5 h-3.5 ${selected ? 'text-amber-400' : 'text-slate-400'}`} />
                    <span>{ENERGY_LABELS[energy]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <label className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50/80 border border-amber-200 cursor-pointer">
            <input
              type="checkbox"
              data-testid="loto-vat-checkbox"
              checked={vatVerified}
              onChange={(e) => setVatVerified(e.target.checked)}
              className="mt-0.5 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
            />
            <span className="text-xs font-bold text-amber-950">
              Vérification d&apos;Absence de Tension / Énergie Zéro (VAT) effectuée et conforme *
            </span>
          </label>

          <div className="flex items-center justify-end gap-2">
            {showReconsignForm && (
              <button
                type="button"
                onClick={() => setShowReconsignForm(false)}
                className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Annuler
              </button>
            )}
            <button
              type="button"
              data-testid="loto-consign-submit-btn"
              onClick={handleConsignSubmit}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition cursor-pointer inline-flex items-center gap-2 shadow-sm"
            >
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>Consigner l&apos;Équipement (Verrouiller)</span>
            </button>
          </div>
        </div>
      )}

      {/* Active Padlock Summary & Deconsignation */}
      {status === 'CONSIGNE' && (
        <div data-testid="loto-deconsign-section" className="bg-white rounded-xl border border-amber-200 p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-[10px] font-bold uppercase text-slate-500 block">Cadenas Actif</span>
              <span className="font-mono font-black text-slate-900">{permit.num_cadenas || '—'}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-[10px] font-bold uppercase text-slate-500 block">Énergies Isolées</span>
              <span className="font-mono font-bold text-slate-900">
                {Array.isArray(permit.energy_types) && permit.energy_types.length > 0
                  ? permit.energy_types.join(', ')
                  : '—'}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-[10px] font-bold uppercase text-slate-500 block">Consigné par (VAT OK)</span>
              <span className="font-bold text-slate-900">{permit.consignateur_name || 'Intervenant'}</span>
            </div>
          </div>

          {!isReadOnly && !isClosed && (
            <>
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 cursor-pointer">
                <input
                  type="checkbox"
                  data-testid="loto-zone-cleared-checkbox"
                  checked={zoneCleared}
                  onChange={(e) => setZoneCleared(e.target.checked)}
                  className="mt-0.5 rounded border-emerald-400 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-xs font-bold text-emerald-950">
                  Zone d&apos;intervention dégagée, protecteurs remontés et remise en énergie sécurisée *
                </span>
              </label>

              <div className="flex items-center justify-end">
                <button
                  type="button"
                  data-testid="loto-deconsign-submit-btn"
                  onClick={handleDeconsignSubmit}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition cursor-pointer inline-flex items-center gap-2 shadow-sm"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  <span>Déconsigner &amp; Retirer le Cadenas</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Deconsigned Traceability Summary */}
      {status === 'DECONSIGNE' && !showReconsignForm && (
        <div className="bg-white rounded-xl border border-emerald-200 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-emerald-950">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Cadenas <b className="font-mono">{permit.num_cadenas || '—'}</b> déconsigné par{' '}
              <b>{permit.deconsignateur_name || 'Responsable'}</b>
              {permit.deconsigned_at ? ` (${String(permit.deconsigned_at).slice(0, 16).replace('T', ' ')})` : ''}.
            </span>
          </div>

          {!isReadOnly && !isClosed && (
            <button
              type="button"
              data-testid="loto-reconsign-btn"
              onClick={() => {
                setVatVerified(false);
                setShowReconsignForm(true);
              }}
              className="px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-[11px] cursor-pointer shrink-0"
            >
              Reconsigner (Nouveau Verrouillage)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
