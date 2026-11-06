import React from 'react';
import { Clock, AlertTriangle, XCircle, CheckCircle2, ShieldCheck, Edit3 } from 'lucide-react';

export type UnifiedValidationStatus =
  | 'NONE'
  | 'PENDING_VALIDATION'
  | 'NEEDS_CLARIFICATION'
  | 'REJECTED'
  | 'APPROVED';

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
  };
}

interface ValidationStatusBadgeProps {
  record: any;
  compact?: boolean;
  showNote?: boolean;
  showStockEffect?: boolean;
}

export const ValidationStatusBadge: React.FC<ValidationStatusBadgeProps> = ({
  record,
  compact = false,
  showNote = true,
  showStockEffect = false,
}) => {
  const meta = getValidationStatusMeta(record);

  if (meta.status === 'NONE') {
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
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border shadow-2xs ${meta.badgeClass}`}
        title={meta.validationNote ? `${meta.label} — Motif: ${meta.validationNote}` : meta.label}
      >
        {renderIcon()}
        <span>{compact ? meta.shortLabel : meta.label}</span>
      </span>

      {showStockEffect && (
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
