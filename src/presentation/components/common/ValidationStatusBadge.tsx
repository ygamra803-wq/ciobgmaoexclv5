import React from 'react';
import { Clock, AlertTriangle, XCircle, CheckCircle2, ShieldCheck, Edit3, Wrench } from 'lucide-react';
import type { CorrectiveInterventionNature } from '../../../domain/corrective/entities/CorrectiveIntervention';

export type UnifiedValidationStatus =
  | 'NONE'
  | 'PENDING_VALIDATION'
  | 'NEEDS_CLARIFICATION'
  | 'REJECTED'
  | 'APPROVED';

export interface InterventionNatureMeta {
  code: CorrectiveInterventionNature;
  value: CorrectiveInterventionNature;
  nature: CorrectiveInterventionNature;
  label: string;
  shortLabel: string;
  requiresParts: boolean;
  requiresPartsWarning: boolean;
  badgeClass: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
}

export const INTERVENTION_NATURE_OPTIONS: InterventionNatureMeta[] = [
  {
    code: 'REPLACE',
    value: 'REPLACE',
    nature: 'REPLACE',
    label: 'Remplacement PDR (Avec pièce)',
    shortLabel: 'Remplacement PDR',
    requiresParts: true,
    requiresPartsWarning: true,
    badgeClass: 'bg-cyan-50 text-cyan-900 border-cyan-200',
    bgClass: 'bg-cyan-50',
    textClass: 'text-cyan-900',
    borderClass: 'border-cyan-200',
  },
  {
    code: 'REPAIR',
    value: 'REPAIR',
    nature: 'REPAIR',
    label: 'Réparation sur place (Sans remplacement)',
    shortLabel: 'Réparation',
    requiresParts: false,
    requiresPartsWarning: false,
    badgeClass: 'bg-indigo-50 text-indigo-900 border-indigo-200',
    bgClass: 'bg-indigo-50',
    textClass: 'text-indigo-900',
    borderClass: 'border-indigo-200',
  },
  {
    code: 'CLEAN',
    value: 'CLEAN',
    nature: 'CLEAN',
    label: 'Nettoyage / Soufflage / Dégraissage',
    shortLabel: 'Nettoyage',
    requiresParts: false,
    requiresPartsWarning: false,
    badgeClass: 'bg-teal-50 text-teal-900 border-teal-200',
    bgClass: 'bg-teal-50',
    textClass: 'text-teal-900',
    borderClass: 'border-teal-200',
  },
  {
    code: 'ADJUST',
    value: 'ADJUST',
    nature: 'ADJUST',
    label: 'Réglage / Calibrage / Serrage',
    shortLabel: 'Réglage',
    requiresParts: false,
    requiresPartsWarning: false,
    badgeClass: 'bg-amber-50 text-amber-900 border-amber-200',
    bgClass: 'bg-amber-50',
    textClass: 'text-amber-900',
    borderClass: 'border-amber-200',
  },
  {
    code: 'INSPECT',
    value: 'INSPECT',
    nature: 'INSPECT',
    label: 'Inspection / Diagnostic / Essai',
    shortLabel: 'Diagnostic',
    requiresParts: false,
    requiresPartsWarning: false,
    badgeClass: 'bg-slate-100 text-slate-800 border-slate-300',
    bgClass: 'bg-slate-100',
    textClass: 'text-slate-800',
    borderClass: 'border-slate-300',
  },
  {
    code: 'OTHER',
    value: 'OTHER',
    nature: 'OTHER',
    label: 'Autre intervention',
    shortLabel: 'Autre',
    requiresParts: false,
    requiresPartsWarning: false,
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
    bgClass: 'bg-slate-100',
    textClass: 'text-slate-700',
    borderClass: 'border-slate-200',
  },
];

export function getInterventionNatureMeta(rawNature: unknown): InterventionNatureMeta | null {
  const clean = String(rawNature || '').trim().toUpperCase();
  if (!clean) return null;
  return (
    INTERVENTION_NATURE_OPTIONS.find((opt) => opt.code === clean) ||
    INTERVENTION_NATURE_OPTIONS[INTERVENTION_NATURE_OPTIONS.length - 1]
  );
}

export interface ValidationStatusMeta {
  status: UnifiedValidationStatus;
  label: string;
  shortLabel: string;
  subtext: string;
  stockEffectLabel: string;
  badgeClass: string;
  dotClass: string;
  validatedWithEdits: boolean;
  validationNote: string;
  validatedByName: string;
  natureMeta: InterventionNatureMeta | null;
}

export function getValidationStatusMeta(record: any): ValidationStatusMeta {
  const rawStatus = String(record?.validation_status || '').trim().toUpperCase();
  const isClosed =
    String(record?.action_fermee || '').trim().toUpperCase() === 'OUI' ||
    String(record?.statut || '').trim().toUpperCase() === 'CLOTURE' ||
    String(record?.status || '').trim().toUpperCase() === 'DONE';

  const status: UnifiedValidationStatus =
    rawStatus === 'PENDING_VALIDATION' ||
    rawStatus === 'NEEDS_CLARIFICATION' ||
    rawStatus === 'REJECTED' ||
    rawStatus === 'APPROVED'
      ? (rawStatus as UnifiedValidationStatus)
      : isClosed
      ? 'APPROVED'
      : 'NONE';

  const validatedWithEdits = Boolean(record?.validated_with_edits);
  const validationNote = String(record?.validation_note || '').trim();
  const validatedByName = String(record?.validated_by_name || '').trim();
  const stockDeducted = Boolean(record?.stock_deducted);
  const natureMeta = getInterventionNatureMeta(record?.intervention_nature);

  if (status === 'PENDING_VALIDATION') {
    return {
      status,
      label: 'À VALIDER (CENTRE)',
      shortLabel: 'À VALIDER',
      subtext: 'En attente de revue Admin',
      stockEffectLabel: 'Stock réservé · Non déduit',
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
      dotClass: 'bg-amber-500 animate-pulse',
      validatedWithEdits: false,
      validationNote,
      validatedByName,
      natureMeta,
    };
  }

  if (status === 'NEEDS_CLARIFICATION') {
    return {
      status,
      label: 'À CLARIFIER · CORRIGER',
      shortLabel: 'À CLARIFIER',
      subtext: validationNote || 'Clarification requise par le responsable',
      stockEffectLabel: 'Aucun effet stock',
      badgeClass: 'bg-orange-100 text-orange-800 border-orange-300',
      dotClass: 'bg-orange-500 animate-bounce',
      validatedWithEdits: false,
      validationNote,
      validatedByName,
      natureMeta,
    };
  }

  if (status === 'REJECTED') {
    return {
      status,
      label: 'REJETÉ (SANS EFFET STOCK)',
      shortLabel: 'REJETÉ',
      subtext: validationNote || 'Déclaration rejetée par le responsable',
      stockEffectLabel: 'Aucun déstockage officiel',
      badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
      dotClass: 'bg-rose-600',
      validatedWithEdits: false,
      validationNote,
      validatedByName,
      natureMeta,
    };
  }

  if (status === 'APPROVED') {
    if (validatedWithEdits) {
      return {
        status,
        label: 'VALIDÉ (AJUSTÉ PAR ADMIN)',
        shortLabel: 'VALIDÉ · AJUSTÉ',
        subtext: validatedByName ? `Ajusté & validé par ${validatedByName}` : 'Ajusté avant validation',
        stockEffectLabel: stockDeducted ? 'Stock déduit (ajusté)' : 'Sans déstockage PDR',
        badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
        dotClass: 'bg-blue-600',
        validatedWithEdits: true,
        validationNote,
        validatedByName,
        natureMeta,
      };
    }

    return {
      status,
      label: 'VALIDÉ & CLÔTURÉ',
      shortLabel: 'VALIDÉ',
      subtext: validatedByName ? `Validé par ${validatedByName}` : 'Clôture officielle validée',
      stockEffectLabel: stockDeducted ? 'Stock déduit officiellement' : 'Intervention sans PDR',
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      dotClass: 'bg-emerald-600',
      validatedWithEdits: false,
      validationNote,
      validatedByName,
      natureMeta,
    };
  }

  return {
    status: 'NONE',
    label: 'EN COURS TERRAIN',
    shortLabel: 'TERRAIN',
    subtext: 'Non soumis à validation',
    stockEffectLabel: 'Aucun effet stock',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
    dotClass: 'bg-slate-400',
    validatedWithEdits: false,
    validationNote,
    validatedByName,
    natureMeta,
  };
}

interface ValidationStatusBadgeProps {
  record: any;
  compact?: boolean;
  showNote?: boolean;
  showStockEffect?: boolean;
  showNature?: boolean;
}

export const ValidationStatusBadge: React.FC<ValidationStatusBadgeProps> = ({
  record,
  compact = false,
  showNote = true,
  showStockEffect = false,
  showNature = true,
}) => {
  const meta = getValidationStatusMeta(record);

  if (meta.status === 'NONE' && !meta.natureMeta) {
    return null;
  }

  const renderIcon = () => {
    switch (meta.status) {
      case 'PENDING_VALIDATION':
        return <Clock className="w-3 h-3 shrink-0" />;
      case 'NEEDS_CLARIFICATION':
        return <AlertTriangle className="w-3 h-3 shrink-0" />;
      case 'REJECTED':
        return <XCircle className="w-3 h-3 shrink-0" />;
      case 'APPROVED':
        return meta.validatedWithEdits ? (
          <Edit3 className="w-3 h-3 shrink-0" />
        ) : (
          <CheckCircle2 className="w-3 h-3 shrink-0" />
        );
      default:
        return <ShieldCheck className="w-3 h-3 shrink-0" />;
    }
  };

  return (
    <div className="inline-flex flex-col items-center gap-0.5 max-w-[230px]">
      {meta.status !== 'NONE' && (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border shadow-2xs ${meta.badgeClass}`}
          title={meta.validationNote ? `${meta.label} — Motif: ${meta.validationNote}` : meta.label}
        >
          {renderIcon()}
          <span>{compact ? meta.shortLabel : meta.label}</span>
        </span>
      )}

      {showNature && meta.natureMeta && meta.natureMeta.code !== 'OTHER' && (
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.2 rounded text-[9px] font-mono font-bold border ${meta.natureMeta.badgeClass}`}
          title={`Nature d'intervention : ${meta.natureMeta.label}`}
        >
          <Wrench className="w-2.5 h-2.5 shrink-0" />
          <span>{meta.natureMeta.shortLabel}</span>
        </span>
      )}

      {showStockEffect && meta.status !== 'NONE' && (
        <span className="text-[9px] font-bold text-slate-500 leading-tight">
          {meta.stockEffectLabel}
        </span>
      )}

      {showNote && meta.validationNote && (
        <span
          className={`text-[9px] font-bold truncate max-w-[210px] px-1.5 py-0.5 rounded border ${
            meta.status === 'REJECTED'
              ? 'text-rose-700 bg-rose-50/90 border-rose-200'
              : meta.status === 'NEEDS_CLARIFICATION'
              ? 'text-orange-800 bg-orange-50/90 border-orange-200'
              : 'text-slate-600 bg-slate-50 border-slate-200'
          }`}
          title={meta.validationNote}
        >
          Note: {meta.validationNote}
        </span>
      )}
    </div>
  );
};

export default ValidationStatusBadge;
