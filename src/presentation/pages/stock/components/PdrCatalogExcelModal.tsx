import React, { useState, useRef } from 'react';
import {
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  X,
  ShieldAlert,
  Layers,
} from 'lucide-react';
import type { IStockItem, PdrGroup, StockType } from '../../../../types/domain';
import {
  downloadPdrCatalogWorkbook,
  parsePdrCatalogWorkbookBuffer,
  validateAndReconcilePdrCatalogImport,
  applyPdrCatalogImportToStore,
  type PdrCatalogImportMode,
  type PdrCatalogImportReport,
} from '../../../../services/pdrHierarchyExcelService';
import { useAuth } from '../../../../context/AuthContext';

interface PdrCatalogExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdrGroups: PdrGroup[];
  types: StockType[];
  rawStock: IStockItem[];
  mouvements: any[];
  canEditStock: boolean;
}

export default function PdrCatalogExcelModal({
  isOpen,
  onClose,
  pdrGroups = [],
  types = [],
  rawStock = [],
  mouvements = [],
  canEditStock,
}: PdrCatalogExcelModalProps) {
  const { user } = (useAuth() || {}) as any;
  const actorRole = String(user?.role || 'ADMIN').trim().toUpperCase();
  const isAdmin = actorRole === 'ADMIN';

  const [mode, setMode] = useState<PdrCatalogImportMode>('MERGE');
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [report, setReport] = useState<PdrCatalogImportReport | null>(null);
  const [applied, setApplied] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'warning' | 'error';
    text: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleExportLiveCatalog = () => {
    try {
      const fileName = downloadPdrCatalogWorkbook({
        pdrGroups,
        types,
        rawStock,
      });
      setStatusMessage({
        type: 'success',
        text: `Catalogue PDR exporté avec succès (${fileName}) : ${pdrGroups.length} groupe(s), ${types.length} type(s), ${rawStock.length} article(s).`,
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `Erreur lors de l'export Excel : ${err?.message || 'Erreur inconnue'}`,
      });
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (mode === 'REPLACE_CATALOG' && (!isAdmin || !confirmReplace)) {
      setStatusMessage({
        type: 'error',
        text: 'Pour le mode REPLACE_CATALOG (ADMIN uniquement), veuillez cocher la confirmation de sécurité avant de charger le fichier.',
      });
      return;
    }

    setSelectedFileName(file.name);
    setApplied(false);

    try {
      const buffer = await file.arrayBuffer();
      const rawSheets = parsePdrCatalogWorkbookBuffer(buffer);
      const validationReport = validateAndReconcilePdrCatalogImport(rawSheets, {
        mode,
        actorRole,
        hasStockEditPermission: canEditStock || isAdmin,
        existingGroups: pdrGroups,
        existingTypes: types,
        existingStock: rawStock,
        existingMouvements: mouvements,
      });

      setReport(validationReport);

      const totalMutated = validationReport.created.total + validationReport.updated.total;

      if (validationReport.errors.length > 0 && totalMutated === 0) {
        setStatusMessage({
          type: 'error',
          text: `Échec de l'import : ${validationReport.errors.length} erreur(s) bloquante(s). Aucune modification appliquée.`,
        });
        return;
      }

      if (validationReport.errors.length === 0 && totalMutated > 0) {
        applyPdrCatalogImportToStore(validationReport);
        setApplied(true);
        setStatusMessage({
          type: 'success',
          text: `Import ${mode} réussi : ${validationReport.created.total} créé(s), ${validationReport.updated.total} mis à jour (0 erreur).`,
        });
      } else if (validationReport.errors.length > 0 && totalMutated > 0) {
        setStatusMessage({
          type: 'warning',
          text: `Validation partielle : ${totalMutated} ligne(s) valide(s) et ${validationReport.errors.length} erreur(s) détectée(s). Vérifiez le rapport ci-dessous avant d'appliquer les lignes valides.`,
        });
      } else {
        setStatusMessage({
          type: 'warning',
          text: 'Aucune ligne valide à importer dans le classeur sélectionné.',
        });
      }
    } catch (err: any) {
      setReport(null);
      setStatusMessage({
        type: 'error',
        text: `Impossible de lire le fichier Excel (.xlsx) : ${err?.message || 'Format invalide'}`,
      });
    }
  };

  const handleApplyPartialReport = () => {
    if (!report) return;
    const totalMutated = report.created.total + report.updated.total;
    if (totalMutated === 0) return;

    const ok = applyPdrCatalogImportToStore(report);
    if (ok) {
      setApplied(true);
      setStatusMessage({
        type: 'success',
        text: `Lignes valides appliquées au catalogue PDR : ${report.created.total} créé(s), ${report.updated.total} mis à jour (${report.errors.length} ligne(s) en erreur ignorée(s)).`,
      });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
      data-testid="pdr-catalog-excel-modal"
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight">
                Import / Export Excel — Catalogue PDR Hiérarchique (3 Niveaux)
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                Feuilles normalisées : <span className="font-mono text-emerald-300">PDR_GROUPS</span> ➔{' '}
                <span className="font-mono text-amber-300">PDR_TYPES</span> ➔{' '}
                <span className="font-mono text-cyan-300">PDR_ITEMS</span> (Sans altérer les mouvements)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Status Banner */}
          {statusMessage && (
            <div
              className={`p-3.5 rounded-xl border text-xs font-bold flex items-start gap-2.5 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : statusMessage.type === 'warning'
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
              data-testid="pdr-excel-status-banner"
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : statusMessage.type === 'warning' ? (
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* Section 1: Export Live Catalog */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-600" />
                <span>1. Exporter le catalogue PDR actif (.xlsx)</span>
              </div>
              <p className="text-xs text-slate-600">
                Exporte l&apos;état réel du magasin ({pdrGroups.length} groupes, {types.length} types,{' '}
                {rawStock.length} articles) dans un classeur à 3 feuilles compatible Round-Trip.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportLiveCatalog}
              data-testid="btn-export-pdr-hierarchy-xlsx"
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-2 transition shadow-xs cursor-pointer shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>Exporter catalogue PDR (Groupes / Types / Articles)</span>
            </button>
          </div>

          {/* Section 2: Import Catalog */}
          {(canEditStock || isAdmin) && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Upload className="w-4 h-4 text-indigo-600" />
                  <span>2. Importer un classeur catalogue PDR (.xlsx)</span>
                </div>
                <span className="text-[11px] font-mono text-slate-500">
                  Ordre : 1) PDR_GROUPS ➔ 2) PDR_TYPES ➔ 3) PDR_ITEMS
                </span>
              </div>

              {/* Mode Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label
                  className={`p-3 rounded-xl border cursor-pointer transition flex items-start gap-2.5 ${
                    mode === 'MERGE'
                      ? 'bg-indigo-50/70 border-indigo-400 text-indigo-950'
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="pdrImportMode"
                    value="MERGE"
                    checked={mode === 'MERGE'}
                    onChange={() => {
                      setMode('MERGE');
                      setConfirmReplace(false);
                    }}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="text-xs font-bold">MERGE (Fusionner — Recommandé)</div>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Ajoute les nouveaux groupes/types/articles et met à jour ceux existants par{' '}
                      <code className="font-mono">code</code> / <code className="font-mono">ref</code> sans supprimer les absents.
                    </p>
                  </div>
                </label>

                <label
                  className={`p-3 rounded-xl border transition flex items-start gap-2.5 ${
                    !isAdmin
                      ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-70'
                      : mode === 'REPLACE_CATALOG'
                      ? 'bg-rose-50/70 border-rose-400 text-rose-950 cursor-pointer'
                      : 'bg-slate-50 border-slate-200 text-slate-700 cursor-pointer'
                  }`}
                >
                  <input
                    type="radio"
                    name="pdrImportMode"
                    value="REPLACE_CATALOG"
                    disabled={!isAdmin}
                    checked={mode === 'REPLACE_CATALOG'}
                    onChange={() => setMode('REPLACE_CATALOG')}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="text-xs font-bold flex items-center gap-1.5">
                      <span>REPLACE_CATALOG (Remplacement complet)</span>
                      <span className="px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 text-[10px] font-mono">
                        ADMIN
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Remplace le catalogue par le fichier. Protégé : refuse de supprimer un{' '}
                      <code className="font-mono">ref</code> lié à des mouvements historiques.
                    </p>
                  </div>
                </label>
              </div>

              {mode === 'REPLACE_CATALOG' && isAdmin && (
                <label className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmReplace}
                    onChange={(e) => setConfirmReplace(e.target.checked)}
                  />
                  <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>
                    Je confirme vouloir remplacer le catalogue PDR existant (les mouvements de stock ne seront pas effacés).
                  </span>
                </label>
              )}

              {/* Upload Trigger */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="text-[11px] text-slate-500">
                  Note : La colonne <code className="font-mono">stockActuel_info</code> est purement informative ; le solde réel reste calculé via <code className="font-mono">stockInitial + entrées - sorties</code>.
                </div>
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileChange}
                    className="hidden"
                    data-testid="input-import-pdr-hierarchy-xlsx"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold inline-flex items-center gap-2 transition cursor-pointer"
                  >
                    <Upload className="w-4 h-4 text-indigo-300" />
                    <span>Sélectionner et importer un fichier (.xlsx)</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Section 3: Import Report */}
          {report && (
            <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50/70" data-testid="pdr-excel-import-report">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  Rapport d&apos;importation ({selectedFileName || 'Classeur'}) — Mode {report.mode}
                </div>
                <div className="flex items-center gap-2 text-xs font-mono font-bold">
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Créés : {report.created.total} (G:{report.created.groups} / T:{report.created.types} / A:{report.created.items})
                  </span>
                  <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
                    Mis à jour : {report.updated.total} (G:{report.updated.groups} / T:{report.updated.types} / A:{report.updated.items})
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                    Ignorés : {report.skipped.total}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded border ${
                      report.errors.length > 0
                        ? 'bg-rose-100 text-rose-800 border-rose-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}
                  >
                    Erreurs : {report.errors.length}
                  </span>
                </div>
              </div>

              {report.errors.length > 0 && (
                <div className="max-h-48 overflow-y-auto border border-rose-200 rounded-lg bg-white divide-y divide-rose-100">
                  {report.errors.map((err, i) => (
                    <div key={i} className="px-3 py-2 text-xs text-rose-900 flex items-start gap-2">
                      <span className="font-mono font-bold px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 shrink-0">
                        {err.sheet} {err.row > 0 ? `#${err.row}` : ''}
                      </span>
                      <span>{err.message}</span>
                    </div>
                  ))}
                </div>
              )}

              {!applied && (report.created.total + report.updated.total > 0) && report.errors.length > 0 && (
                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={handleApplyPartialReport}
                    className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition cursor-pointer"
                  >
                    Appliquer uniquement les {report.created.total + report.updated.total} ligne(s) valide(s)
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Contrat <span className="font-mono font-bold text-slate-700">PDR-EXCEL-HIERARCHY-P0</span> • Groupes ➔ Types ➔ Articles (SKU)
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
