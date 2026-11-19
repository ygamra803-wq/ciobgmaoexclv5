import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileText, Plus, Printer, RotateCcw, Save, Trash2, X } from 'lucide-react';
import { useGmaoStore } from '../../../../store/useGmaoStore';
import type { ICorrectiveTechnicalReport } from '../../../../types/store';

export interface InterventionReportFields {
  date: string;
  code_machine: string;
  equipment_type: string;
  ref_bt: string;
  maintenance_type: string;
  downtime: string;
  defect_nature: string;
  executive_summary: string;
  rca_1_component: string;
  rca_1_observation: string;
  rca_1_impact: string;
  rca_2_component: string;
  rca_2_observation: string;
  rca_2_impact: string;
  root_cause_title: string;
  root_cause_detail: string;
  root_cause_effect: string;
  action_repair_1: string;
  action_repair_2: string;
  action_checks: string;
  action_preventive: string;
  reco_1: string;
  reco_2: string;
  tech_name: string;
  tech_visa: string;
  manager_name: string;
  manager_visa: string;
  doc_ref: string;
}

export interface ExtraRcaRow {
  id: string;
  component: string;
  observation: string;
  impact: string;
}

export interface InterventionReportDraft {
  fields: InterventionReportFields;
  extraRcaRows: ExtraRcaRow[];
  updatedAt: string;
}

export interface InterventionReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  intervention?: Record<string, any> | null;
  machine?: Record<string, any> | null;
  technicianName?: string;
  onSaveReport?: (
    btId: string | number,
    report: ICorrectiveTechnicalReport | null
  ) => { valid: boolean; reason?: string } | void;
  showToast?: (msg: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

const EMPTY_FIELDS: InterventionReportFields = {
  date: '',
  code_machine: '',
  equipment_type: '',
  ref_bt: '',
  maintenance_type: '',
  downtime: '',
  defect_nature: '',
  executive_summary: '',
  rca_1_component: '',
  rca_1_observation: '',
  rca_1_impact: '',
  rca_2_component: '',
  rca_2_observation: '',
  rca_2_impact: '',
  root_cause_title: 'Cause racine / Facteur déclencheur',
  root_cause_detail: '',
  root_cause_effect: '',
  action_repair_1: '',
  action_repair_2: '',
  action_checks: '',
  action_preventive: '',
  reco_1: '',
  reco_2: '',
  tech_name: '',
  tech_visa: '',
  manager_name: '',
  manager_visa: '',
  doc_ref: '',
};

const DRAFT_STORAGE_PREFIX = 'gmao_report_draft_';
const PRINTING_BODY_CLASS = 'gmao-printing-technical-report';

function sanitizeDraftId(raw: unknown): string {
  const str = String(raw ?? '').trim();
  if (!str) return 'local';
  const cleaned = str.replace(/[^a-zA-Z0-9_-]/g, '_');
  return cleaned || 'local';
}

export function getInterventionReportDraftKey(intervention?: Record<string, any> | null): string {
  const rawId = intervention?.num_bt || intervention?.id || 'local';
  return `${DRAFT_STORAGE_PREFIX}${sanitizeDraftId(rawId)}`;
}

function formatFrenchDate(raw: unknown): string {
  const str = String(raw ?? '').trim();
  if (!str) return '';
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(str);
  if (isoMatch) {
    return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  }
  return str;
}

/**
 * Pré-remplit uniquement les faits certains issus du BT / de l'équipement.
 * Ne génère jamais d'analyse, de cause racine ni de recommandations fictives.
 */
export function buildInitialReportFields(
  intervention?: Record<string, any> | null,
  machine?: Record<string, any> | null,
  technicianName?: string
): InterventionReportFields {
  if (!intervention) {
    return { ...EMPTY_FIELDS };
  }

  const rawDate =
    intervention.date_fin ||
    intervention.date_debut ||
    intervention.date_demande ||
    intervention.demande_date ||
    intervention.date ||
    '';

  const codeMachine = String(
    intervention.code_machine || machine?.code || machine?.id_machine_registered || ''
  ).trim();

  const equipmentType = String(
    machine?.designation || machine?.nom || intervention.designation || ''
  ).trim();

  const refBt = String(
    intervention.num_bt || (intervention.id != null ? String(intervention.id) : '')
  ).trim();

  const downtime = String(
    intervention.temps_arret ||
      intervention.temps_intervention_calc ||
      intervention.temps_intervention ||
      ''
  ).trim();

  const typePanne = String(intervention.type_panne || '').trim();
  const anomalie = String(intervention.anomalie || '').trim();
  const defectNature = [typePanne ? `Type ${typePanne}` : '', anomalie]
    .filter(Boolean)
    .join(' — ');

  const resolvedTech =
    technicianName && technicianName !== 'Non assigné'
      ? technicianName
      : String(intervention.intervenant || '').trim();

  const docRef = refBt ? `RT-${refBt}` : '';

  return {
    ...EMPTY_FIELDS,
    date: formatFrenchDate(rawDate),
    code_machine: codeMachine,
    equipment_type: equipmentType,
    ref_bt: refBt,
    maintenance_type: String(intervention.type_maintenance || 'Corrective').trim(),
    downtime,
    defect_nature: defectNature,
    tech_name: resolvedTech,
    doc_ref: docRef,
  };
}

interface AutoTextareaProps {
  field: keyof InterventionReportFields | string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  minRows?: number;
  className?: string;
}

function AutoResizeTextarea({
  field,
  value,
  onChange,
  placeholder,
  minRows = 2,
  className = '',
}: AutoTextareaProps) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <>
      <textarea
        ref={ref}
        rows={minRows}
        data-field={field}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`screen-only w-full resize-none overflow-hidden bg-transparent border border-transparent focus:border-blue-300 focus:bg-blue-50/60 rounded px-1 py-0.5 outline-none text-inherit font-inherit leading-relaxed placeholder:text-slate-400/80 placeholder:italic ${className}`}
      />
      <div className={`print-only whitespace-pre-wrap break-words ${className}`}>{value}</div>
    </>
  );
}

interface InlineDocInputProps {
  field: keyof InterventionReportFields | string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
}

function InlineDocInput({
  field,
  value,
  onChange,
  placeholder,
  className = '',
}: InlineDocInputProps) {
  return (
    <>
      <input
        type="text"
        data-field={field}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`screen-only w-full bg-transparent border border-transparent focus:border-blue-300 focus:bg-blue-50/60 rounded px-1 py-0.5 outline-none text-inherit font-inherit placeholder:text-slate-400/80 placeholder:italic ${className}`}
      />
      <span className={`print-only whitespace-pre-wrap break-words ${className}`}>{value}</span>
    </>
  );
}

export default function InterventionReportModal({
  isOpen,
  onClose,
  intervention = null,
  machine = null,
  technicianName,
  onSaveReport,
  showToast,
}: InterventionReportModalProps) {
  const draftKey = useMemo(() => getInterventionReportDraftKey(intervention), [intervention]);
  const btTargetId = intervention?.id ?? intervention?.num_bt ?? null;

  const [fields, setFields] = useState<InterventionReportFields>(() =>
    buildInitialReportFields(intervention, machine, technicianName)
  );
  const [extraRcaRows, setExtraRcaRows] = useState<ExtraRcaRow[]>([]);
  const [hasSavedDraft, setHasSavedDraft] = useState(false);
  const [persistedInSsot, setPersistedInSsot] = useState(false);
  const [savedTimestamp, setSavedTimestamp] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const baseFields = buildInitialReportFields(intervention, machine, technicianName);
    let nextFields = baseFields;
    let nextExtraRows: ExtraRcaRow[] = [];
    let foundDraft = false;
    let fromSsot = false;
    let draftTime: string | null = null;

    const hydrateFromReport = (parsed: Partial<InterventionReportDraft> | ICorrectiveTechnicalReport | null | undefined) => {
      if (!parsed || typeof parsed !== 'object') return false;
      let loaded = false;
      if (parsed.fields && typeof parsed.fields === 'object') {
        const merged = { ...baseFields };
        (Object.keys(EMPTY_FIELDS) as Array<keyof InterventionReportFields>).forEach((key) => {
          const draftVal = (parsed.fields as Record<string, unknown>)?.[key];
          if (typeof draftVal === 'string' && draftVal !== '') {
            merged[key] = draftVal;
          }
        });
        nextFields = merged;
        loaded = true;
      }
      if (Array.isArray(parsed.extraRcaRows)) {
        nextExtraRows = parsed.extraRcaRows
          .filter((r) => r && typeof r === 'object')
          .map((r, idx) => ({
            id: String(r.id || `rca-extra-${idx}`),
            component: String(r.component || ''),
            observation: String(r.observation || ''),
            impact: String(r.impact || ''),
          }));
      }
      if (typeof parsed.updatedAt === 'string') {
        draftTime = parsed.updatedAt;
      }
      return loaded;
    };

    // 1. Priority SSOT (Zustand / DataGateway / SQLite) when linked to a registered BT
    let ssotReport: ICorrectiveTechnicalReport | null = null;
    if (btTargetId !== null) {
      const targetUpper = String(btTargetId).trim().toUpperCase();
      const liveBt = (useGmaoStore.getState().correctiveInterventions || []).find(
        (i) =>
          String(i?.id ?? '').trim().toUpperCase() === targetUpper ||
          String(i?.num_bt ?? '').trim().toUpperCase() === targetUpper
      );
      ssotReport = (liveBt?.technical_report ?? intervention?.technical_report ?? null) as ICorrectiveTechnicalReport | null;
    }

    if (ssotReport && hydrateFromReport(ssotReport)) {
      foundDraft = true;
      fromSsot = true;
    } else {
      // 2. Fallback to legacy local draft (standalone mode or pre-migration local draft)
      try {
        const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(draftKey) : null;
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<InterventionReportDraft>;
          if (hydrateFromReport(parsed)) {
            foundDraft = true;
          }
        }
      } catch {
        // Ignore malformed localStorage draft and fall back cleanly to base fields.
      }
    }

    setFields(nextFields);
    setExtraRcaRows(nextExtraRows);
    setHasSavedDraft(foundDraft);
    setPersistedInSsot(fromSsot);
    setSavedTimestamp(draftTime);
  }, [isOpen, draftKey, btTargetId, intervention, machine, technicianName]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    const cleanupPrintClass = () => {
      document.body.classList.remove(PRINTING_BODY_CLASS);
    };
    window.addEventListener('afterprint', cleanupPrintClass);
    return () => {
      window.removeEventListener('afterprint', cleanupPrintClass);
      cleanupPrintClass();
    };
  }, []);

  if (!isOpen) return null;

  const updateField = (key: keyof InterventionReportFields, value: string) => {
    setFields((prev) => ({ ...prev, [key]: value }));
  };

  const handleAddRcaRow = () => {
    setExtraRcaRows((prev) => [
      ...prev,
      {
        id: `rca-${Date.now()}-${prev.length + 1}`,
        component: '',
        observation: '',
        impact: '',
      },
    ]);
  };

  const handleUpdateExtraRca = (
    id: string,
    col: 'component' | 'observation' | 'impact',
    value: string
  ) => {
    setExtraRcaRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [col]: value } : row))
    );
  };

  const handleRemoveExtraRca = (id: string) => {
    setExtraRcaRows((prev) => prev.filter((row) => row.id !== id));
  };

  const handleSaveDraft = () => {
    const nowIso = new Date().toISOString();
    const payload: InterventionReportDraft = {
      fields,
      extraRcaRows,
      updatedAt: nowIso,
    };

    const ssotPayload: ICorrectiveTechnicalReport = {
      fields: { ...fields },
      extraRcaRows: extraRcaRows.map((row) => ({ ...row })),
      updatedAt: nowIso,
    };

    let savedToSsot = false;
    if (btTargetId !== null) {
      const saveFn = onSaveReport ?? useGmaoStore.getState().handleSaveInterventionReport;
      if (typeof saveFn === 'function') {
        const res = saveFn(btTargetId, ssotPayload);
        if (res && typeof res === 'object' && 'valid' in res) {
          if (res.valid) {
            savedToSsot = true;
          } else if (res.reason && res.reason.toLowerCase().includes('lecture seule')) {
            showToast?.(res.reason, 'warning');
            return;
          }
        } else {
          savedToSsot = true;
        }
      }
    }

    // Mirror locally for offline resilience and standalone blank-mode drafts
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(draftKey, JSON.stringify(payload));
      }
      setHasSavedDraft(true);
      setPersistedInSsot(savedToSsot);
      setSavedTimestamp(nowIso);
      showToast?.('Brouillon du rapport technique enregistré.', 'success');
    } catch {
      if (savedToSsot) {
        setHasSavedDraft(true);
        setPersistedInSsot(true);
        setSavedTimestamp(nowIso);
        showToast?.('Brouillon du rapport technique enregistré.', 'success');
      } else {
        showToast?.("Impossible d'enregistrer le brouillon localement.", 'error');
      }
    }
  };

  const handleResetDraft = () => {
    if (btTargetId !== null) {
      const saveFn = onSaveReport ?? useGmaoStore.getState().handleSaveInterventionReport;
      if (typeof saveFn === 'function') {
        saveFn(btTargetId, null);
      }
    }
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(draftKey);
      }
    } catch {
      // Ignore storage deletion failure.
    }
    setFields(buildInitialReportFields(intervention, machine, technicianName));
    setExtraRcaRows([]);
    setHasSavedDraft(false);
    setPersistedInSsot(false);
    setSavedTimestamp(null);
    showToast?.('Brouillon réinitialisé depuis les données du bon.', 'info');
  };

  const handlePrint = () => {
    document.body.classList.add(PRINTING_BODY_CLASS);
    try {
      window.print();
    } finally {
      window.setTimeout(() => {
        document.body.classList.remove(PRINTING_BODY_CLASS);
      }, 300);
    }
  };

  const contextLabel = fields.ref_bt
    ? `BT ${fields.ref_bt}${fields.code_machine ? ` · ${fields.code_machine}` : ''}`
    : 'Modèle vierge (saisie manuelle)';

  const portalContent = (
    <div
      id="gmao-report-print-portal"
      role="dialog"
      aria-modal="true"
      aria-label="Rapport Technique d’Intervention et de Maintenance"
      className="fixed inset-0 z-50 flex flex-col bg-slate-900/65 backdrop-blur-xs"
      onClick={onClose}
    >
      <style>{`
        #gmao-report-print-portal .print-only {
          display: none;
        }
        #gmao-report-print-portal .rpt-sheet {
          width: 100%;
          max-width: 210mm;
          min-height: 297mm;
          margin: 0 auto;
          background: #ffffff;
          padding: 14mm 15mm;
          box-shadow: 0 12px 36px rgba(15, 23, 42, 0.22);
          font-family: "Segoe UI", Arial, sans-serif;
          color: #1f2937;
          font-size: 10.5pt;
          line-height: 1.45;
          box-sizing: border-box;
        }
        #gmao-report-print-portal .rpt-kicker {
          font-size: 8.5pt;
          font-weight: 700;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: #b45309;
          margin-bottom: 4px;
        }
        #gmao-report-print-portal .rpt-h1 {
          margin: 0 0 12px;
          font-size: 16pt;
          font-weight: 700;
          color: #0f172a;
          border-bottom: 2.5px solid #1d4ed8;
          padding-bottom: 7px;
        }
        #gmao-report-print-portal .rpt-h2 {
          margin: 14px 0 6px;
          font-size: 11pt;
          font-weight: 700;
          color: #1e3a5f;
          border-bottom: 1px solid #cbd5e1;
          padding-bottom: 3px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        #gmao-report-print-portal .rpt-h3 {
          margin: 9px 0 4px;
          font-size: 10pt;
          font-weight: 700;
          color: #1d4ed8;
        }
        #gmao-report-print-portal .rpt-table {
          width: 100%;
          border-collapse: collapse;
          margin: 6px 0;
        }
        #gmao-report-print-portal .rpt-table th,
        #gmao-report-print-portal .rpt-table td {
          border: 1px solid #cbd5e1;
          padding: 5px 8px;
          vertical-align: top;
          text-align: left;
        }
        #gmao-report-print-portal .rpt-meta td.lbl {
          width: 21%;
          background: #f1f5f9;
          font-weight: 700;
          color: #475569;
          font-size: 9pt;
        }
        #gmao-report-print-portal .rpt-meta td.val {
          width: 29%;
          color: #0f172a;
          font-weight: 600;
        }
        #gmao-report-print-portal .rpt-rca th {
          background: #1e3a5f;
          color: #ffffff;
          font-size: 9.2pt;
          font-weight: 700;
        }
        #gmao-report-print-portal .rpt-rca tr.root td {
          background: #fff7ed;
          font-weight: 700;
        }
        #gmao-report-print-portal .rpt-block {
          background: #f8fafc;
          border-left: 3px solid #1d4ed8;
          padding: 8px 10px;
          margin: 6px 0;
        }
        #gmao-report-print-portal .rpt-list {
          margin: 4px 0 8px 18px;
          padding: 0;
        }
        #gmao-report-print-portal .rpt-list li {
          margin-bottom: 4px;
        }
        #gmao-report-print-portal .rpt-sign {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
          margin-top: 12px;
        }
        #gmao-report-print-portal .rpt-sign-box {
          border: 1px solid #cbd5e1;
          padding: 8px 10px;
          min-height: 68px;
        }
        #gmao-report-print-portal .rpt-sign-title {
          font-size: 9pt;
          font-weight: 700;
          color: #475569;
          margin-bottom: 10px;
        }
        #gmao-report-print-portal .rpt-footer {
          margin-top: 14px;
          padding-top: 6px;
          border-top: 1px solid #e2e8f0;
          font-size: 8.5pt;
          color: #64748b;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }
        @media (max-width: 768px) {
          #gmao-report-print-portal .rpt-sheet {
            padding: 16px;
            min-height: auto;
          }
          #gmao-report-print-portal .rpt-sign {
            grid-template-columns: 1fr;
          }
        }
        @media print {
          @page {
            size: A4;
            margin: 12mm;
          }
          body.${PRINTING_BODY_CLASS} > *:not(#gmao-report-print-portal) {
            display: none !important;
          }
          body.${PRINTING_BODY_CLASS} #gmao-report-print-portal {
            position: static !important;
            inset: auto !important;
            background: #ffffff !important;
            padding: 0 !important;
            margin: 0 !important;
            display: block !important;
            overflow: visible !important;
            backdrop-filter: none !important;
          }
          body.${PRINTING_BODY_CLASS} #gmao-report-print-portal .no-print,
          body.${PRINTING_BODY_CLASS} #gmao-report-print-portal .screen-only {
            display: none !important;
          }
          body.${PRINTING_BODY_CLASS} #gmao-report-print-portal .print-only {
            display: block !important;
          }
          body.${PRINTING_BODY_CLASS} #gmao-report-print-portal span.print-only {
            display: inline !important;
          }
          body.${PRINTING_BODY_CLASS} #gmao-report-print-portal .rpt-scroll-area {
            overflow: visible !important;
            padding: 0 !important;
            background: #ffffff !important;
          }
          body.${PRINTING_BODY_CLASS} #gmao-report-print-portal .rpt-sheet {
            width: auto !important;
            max-width: none !important;
            min-height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
          }
          body.${PRINTING_BODY_CLASS} #gmao-report-print-portal .rpt-rca th {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          body.${PRINTING_BODY_CLASS} #gmao-report-print-portal .rpt-meta td.lbl,
          body.${PRINTING_BODY_CLASS} #gmao-report-print-portal .rpt-rca tr.root td,
          body.${PRINTING_BODY_CLASS} #gmao-report-print-portal .rpt-block {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>

      {/* Top Modal Action Bar (hidden during print) */}
      <div
        className="no-print bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 shadow-sm shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <FileText className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-black text-slate-900 tracking-tight truncate">
                Rapport Technique d’Intervention
              </h2>
              <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[11px] font-mono font-bold text-slate-700">
                {contextLabel}
              </span>
              {hasSavedDraft && (
                <span
                  data-testid="rca-persistence-badge"
                  className={`px-2 py-0.5 rounded-md border text-[11px] font-bold ${
                    persistedInSsot
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-amber-50 border-amber-200 text-amber-800'
                  }`}
                  title={
                    savedTimestamp
                      ? `Enregistré le ${new Date(savedTimestamp).toLocaleString('fr-FR')}`
                      : persistedInSsot
                      ? 'Synchronisé en base GMAO / SQLite'
                      : 'Brouillon local actif'
                  }
                >
                  {persistedInSsot ? 'Base GMAO (SQLite)' : 'Brouillon local'}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 truncate">
              Document A4 standardisé — Cliquez directement sur les zones du rapport pour rédiger
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {hasSavedDraft && (
            <button
              type="button"
              onClick={handleResetDraft}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              title="Effacer le brouillon et restaurer les données initiales"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Réinitialiser</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleSaveDraft}
            className="px-3.5 py-1.5 rounded-xl border border-blue-700 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
          >
            <Save className="w-3.5 h-3.5 text-white" />
            <span>Enregistrer brouillon</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="px-3.5 py-1.5 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
          >
            <Printer className="w-3.5 h-3.5 text-white" />
            <span>Imprimer</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            <span>Fermer</span>
          </button>
        </div>
      </div>

      {/* Scrollable Document Desk Surface */}
      <div
        className="rpt-scroll-area flex-1 overflow-y-auto bg-slate-200/90 p-3 sm:p-6 md:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rpt-sheet" id="report">
          <div className="rpt-kicker">
            Maintenance Industrielle &amp; Ingénierie — Rapport Standardisé
          </div>
          <h1 className="rpt-h1">Rapport Technique d’Intervention et de Maintenance</h1>

          <table className="rpt-table rpt-meta">
            <tbody>
              <tr>
                <td className="lbl">Date de l’intervention</td>
                <td className="val">
                  <InlineDocInput
                    field="date"
                    value={fields.date}
                    onChange={(v) => updateField('date', v)}
                    placeholder="JJ/MM/AAAA"
                  />
                </td>
                <td className="lbl">Code Machine</td>
                <td className="val">
                  <InlineDocInput
                    field="code_machine"
                    value={fields.code_machine}
                    onChange={(v) => updateField('code_machine', v)}
                    placeholder="Ex: MAC-001"
                  />
                </td>
              </tr>
              <tr>
                <td className="lbl">Type d’équipement</td>
                <td className="val">
                  <InlineDocInput
                    field="equipment_type"
                    value={fields.equipment_type}
                    onChange={(v) => updateField('equipment_type', v)}
                    placeholder="Désignation équipement"
                  />
                </td>
                <td className="lbl">Référence BT / DI</td>
                <td className="val">
                  <InlineDocInput
                    field="ref_bt"
                    value={fields.ref_bt}
                    onChange={(v) => updateField('ref_bt', v)}
                    placeholder="Ex: BT-2026-001"
                  />
                </td>
              </tr>
              <tr>
                <td className="lbl">Type de maintenance</td>
                <td className="val">
                  <InlineDocInput
                    field="maintenance_type"
                    value={fields.maintenance_type}
                    onChange={(v) => updateField('maintenance_type', v)}
                    placeholder="Corrective / Préventive"
                  />
                </td>
                <td className="lbl">Temps d’arrêt / Durée</td>
                <td className="val">
                  <InlineDocInput
                    field="downtime"
                    value={fields.downtime}
                    onChange={(v) => updateField('downtime', v)}
                    placeholder="Ex: 01h 30min"
                  />
                </td>
              </tr>
              <tr>
                <td className="lbl">Nature de la défaillance</td>
                <td className="val" colSpan={3}>
                  <InlineDocInput
                    field="defect_nature"
                    value={fields.defect_nature}
                    onChange={(v) => updateField('defect_nature', v)}
                    placeholder="Type de panne et symptôme principal constaté"
                  />
                </td>
              </tr>
            </tbody>
          </table>

          <h2 className="rpt-h2">1. Résumé exécutif (Executive Summary)</h2>
          <div className="rpt-block">
            <AutoResizeTextarea
              field="executive_summary"
              value={fields.executive_summary}
              onChange={(v) => updateField('executive_summary', v)}
              minRows={3}
              placeholder="Synthèse de l’incident, diagnostic global, résultat de la remise en service et impact sur la production..."
            />
          </div>

          <h2 className="rpt-h2">
            <span>2. Diagnostic et analyse des causes racines (Root Cause Analysis)</span>
            <button
              type="button"
              onClick={handleAddRcaRow}
              className="no-print inline-flex items-center gap-1 px-2 py-0.5 rounded border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-bold cursor-pointer"
              title="Ajouter une ligne de constat technique"
            >
              <Plus className="w-3 h-3" />
              <span>Ajouter une ligne</span>
            </button>
          </h2>
          <table className="rpt-table rpt-rca">
            <thead>
              <tr>
                <th style={{ width: '24%' }}>Composant / Sous-ensemble</th>
                <th style={{ width: '40%' }}>Constat Technique sur Site</th>
                <th style={{ width: '36%' }}>Impact Technique et Fonctionnel</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <AutoResizeTextarea
                    field="rca_1_component"
                    value={fields.rca_1_component}
                    onChange={(v) => updateField('rca_1_component', v)}
                    minRows={2}
                    placeholder="Organe / Sous-ensemble 1"
                  />
                </td>
                <td>
                  <AutoResizeTextarea
                    field="rca_1_observation"
                    value={fields.rca_1_observation}
                    onChange={(v) => updateField('rca_1_observation', v)}
                    minRows={2}
                    placeholder="Constat visuel ou mesure relevée..."
                  />
                </td>
                <td>
                  <AutoResizeTextarea
                    field="rca_1_impact"
                    value={fields.rca_1_impact}
                    onChange={(v) => updateField('rca_1_impact', v)}
                    minRows={2}
                    placeholder="Conséquence sur le fonctionnement..."
                  />
                </td>
              </tr>
              <tr>
                <td>
                  <AutoResizeTextarea
                    field="rca_2_component"
                    value={fields.rca_2_component}
                    onChange={(v) => updateField('rca_2_component', v)}
                    minRows={2}
                    placeholder="Organe / Sous-ensemble 2"
                  />
                </td>
                <td>
                  <AutoResizeTextarea
                    field="rca_2_observation"
                    value={fields.rca_2_observation}
                    onChange={(v) => updateField('rca_2_observation', v)}
                    minRows={2}
                    placeholder="Constat visuel ou mesure relevée..."
                  />
                </td>
                <td>
                  <AutoResizeTextarea
                    field="rca_2_impact"
                    value={fields.rca_2_impact}
                    onChange={(v) => updateField('rca_2_impact', v)}
                    minRows={2}
                    placeholder="Conséquence sur le fonctionnement..."
                  />
                </td>
              </tr>

              {extraRcaRows.map((row, idx) => (
                <tr key={row.id}>
                  <td>
                    <div className="flex items-start gap-1">
                      <div className="flex-1">
                        <AutoResizeTextarea
                          field={`rca_extra_${idx + 3}_component`}
                          value={row.component}
                          onChange={(v) => handleUpdateExtraRca(row.id, 'component', v)}
                          minRows={2}
                          placeholder={`Organe / Sous-ensemble ${idx + 3}`}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveExtraRca(row.id)}
                        className="no-print p-1 text-slate-400 hover:text-rose-600 cursor-pointer shrink-0"
                        title="Supprimer cette ligne"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                  <td>
                    <AutoResizeTextarea
                      field={`rca_extra_${idx + 3}_observation`}
                      value={row.observation}
                      onChange={(v) => handleUpdateExtraRca(row.id, 'observation', v)}
                      minRows={2}
                      placeholder="Constat technique..."
                    />
                  </td>
                  <td>
                    <AutoResizeTextarea
                      field={`rca_extra_${idx + 3}_impact`}
                      value={row.impact}
                      onChange={(v) => handleUpdateExtraRca(row.id, 'impact', v)}
                      minRows={2}
                      placeholder="Impact fonctionnel..."
                    />
                  </td>
                </tr>
              ))}

              <tr className="root">
                <td>
                  <AutoResizeTextarea
                    field="root_cause_title"
                    value={fields.root_cause_title}
                    onChange={(v) => updateField('root_cause_title', v)}
                    minRows={2}
                    placeholder="Cause racine / Facteur déclencheur"
                  />
                </td>
                <td>
                  <AutoResizeTextarea
                    field="root_cause_detail"
                    value={fields.root_cause_detail}
                    onChange={(v) => updateField('root_cause_detail', v)}
                    minRows={2}
                    placeholder="Cause profonde confirmée de la défaillance..."
                  />
                </td>
                <td>
                  <AutoResizeTextarea
                    field="root_cause_effect"
                    value={fields.root_cause_effect}
                    onChange={(v) => updateField('root_cause_effect', v)}
                    minRows={2}
                    placeholder="Effet direct sur la ligne / sécurité / qualité..."
                  />
                </td>
              </tr>
            </tbody>
          </table>

          <h2 className="rpt-h2">3. Actions correctives et préventives réalisées</h2>
          <h3 className="rpt-h3">A. Travaux de réparation et remplacement de pièces</h3>
          <ul className="rpt-list list-disc">
            <li>
              <AutoResizeTextarea
                field="action_repair_1"
                value={fields.action_repair_1}
                onChange={(v) => updateField('action_repair_1', v)}
                minRows={1}
                placeholder="Opération principale de réparation, démontage ou remontage..."
              />
            </li>
            <li>
              <AutoResizeTextarea
                field="action_repair_2"
                value={fields.action_repair_2}
                onChange={(v) => updateField('action_repair_2', v)}
                minRows={1}
                placeholder="Pièces remplacées (références, cotes, réglages effectués)..."
              />
            </li>
          </ul>

          <h3 className="rpt-h3">B. Contrôles, mesures et maintenance préventive</h3>
          <ul className="rpt-list list-disc">
            <li>
              <AutoResizeTextarea
                field="action_checks"
                value={fields.action_checks}
                onChange={(v) => updateField('action_checks', v)}
                minRows={1}
                placeholder="Contrôles dimensionnels, essais à vide / en charge, mesures (ampérage, température, vibration)..."
              />
            </li>
            <li>
              <AutoResizeTextarea
                field="action_preventive"
                value={fields.action_preventive}
                onChange={(v) => updateField('action_preventive', v)}
                minRows={1}
                placeholder="Nettoyage, graissage ou action préventive immédiate réalisée..."
              />
            </li>
          </ul>

          <h2 className="rpt-h2">4. Recommandations techniques (prévention de récurrence)</h2>
          <ol className="rpt-list list-decimal">
            <li>
              <AutoResizeTextarea
                field="reco_1"
                value={fields.reco_1}
                onChange={(v) => updateField('reco_1', v)}
                minRows={1}
                placeholder="Recommandation technique ou amélioration à court terme..."
              />
            </li>
            <li>
              <AutoResizeTextarea
                field="reco_2"
                value={fields.reco_2}
                onChange={(v) => updateField('reco_2', v)}
                minRows={1}
                placeholder="Action préventive périodique, seuil d'alerte ou stock critique PDR..."
              />
            </li>
          </ol>

          <h2 className="rpt-h2">5. Validation et approbation</h2>
          <div className="rpt-sign">
            <div className="rpt-sign-box">
              <div className="rpt-sign-title">Technicien intervenant</div>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="shrink-0">Nom :</span>
                <InlineDocInput
                  field="tech_name"
                  value={fields.tech_name}
                  onChange={(v) => updateField('tech_name', v)}
                  placeholder="Nom du technicien"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="shrink-0">Date / Visa :</span>
                <InlineDocInput
                  field="tech_visa"
                  value={fields.tech_visa}
                  onChange={(v) => updateField('tech_visa', v)}
                  placeholder="JJ/MM/AAAA — Signature"
                />
              </div>
            </div>

            <div className="rpt-sign-box">
              <div className="rpt-sign-title">Responsable ingénierie / maintenance</div>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="shrink-0">Nom :</span>
                <InlineDocInput
                  field="manager_name"
                  value={fields.manager_name}
                  onChange={(v) => updateField('manager_name', v)}
                  placeholder="Nom du responsable"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="shrink-0">Date / Visa :</span>
                <InlineDocInput
                  field="manager_visa"
                  value={fields.manager_visa}
                  onChange={(v) => updateField('manager_visa', v)}
                  placeholder="JJ/MM/AAAA — Visa"
                />
              </div>
            </div>
          </div>

          <div className="rpt-footer">
            <span>Modèle standard de rapport technique d’intervention</span>
            <span className="flex items-center gap-1.5 shrink-0">
              <span>Réf. interne :</span>
              <span className="inline-block min-w-[110px]">
                <InlineDocInput
                  field="doc_ref"
                  value={fields.doc_ref}
                  onChange={(v) => updateField('doc_ref', v)}
                  placeholder="RT-XXXX"
                />
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' && document.body
    ? createPortal(portalContent, document.body)
    : portalContent;
}
