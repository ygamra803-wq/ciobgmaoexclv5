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
  parsePdrCatalogWorkbookBuffer,
  type PdrCatalogImportMode,
  type PdrCatalogImportReport,
} from '../../../../services/pdrHierarchyExcelService';
import {
  exportRefPdrBundle,
  validateAndCommitRefPdrBundle,
} from '../../../../services/import/unifiedImportPipeline';
import {
  downloadTypeAExcelWorkbook,
  parseTypeAExcelWorkbook,
} from '../../../../services/import/typeAExcelBridge';
import type { RefPdrBundleInput } from '../../../../services/import/types/unifiedImportTypes';
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
  mouvements: _mouvements = [],
  canEditStock,
}: PdrCatalogExcelModalProps) {
  const { user } = (useAuth() || {}) as any;
  const actorRole = String(user?.role || 'ADMIN').trim().toUpperCase();
  const actorId = String(user?.id || user?.username || 'ADMIN');
  const actorName = String(user?.name || user?.username || 'Stock Modal Pipeline');
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
      const bundle = exportRefPdrBundle();
      const fileName = `CIOB_REF_PDR_${new Date().toISOString().slice(0, 10)}_TypeA.xlsx`;
      downloadTypeAExcelWorkbook(fileName, 'REF_PDR', bundle);
      setStatusMessage({
        type: 'success',
        text: `Catalogue PDR Type A exporté avec succès (${fileName}) : ${pdrGroups.length} groupe(s), ${types.length} type(s), ${rawStock.length} article(s).`,
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `Erreur lors de l'export Type A (.xlsx) : ${err?.message || 'Erreur inconnue'}`,
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
      const parsedTypeA = parseTypeAExcelWorkbook(buffer);
      let refPdrPayload: RefPdrBundleInput;

      if (parsedTypeA.ok) {
        if (parsedTypeA.bundleType !== 'REF_PDR') {
          setReport(null);
          setStatusMessage({
            type: 'error',
            text: `Classeur refusé : ce fichier Type A correspond à '${parsedTypeA.bundleType}' et non à 'REF_PDR'.`,
          });
          return;
        }
        refPdrPayload = parsedTypeA.payload as RefPdrBundleInput;
      } else {
        const rawSheets = parsePdrCatalogWorkbookBuffer(buffer);
        refPdrPayload = {
          bundleType: 'REF_PDR',
          groups: (rawSheets.groups || []).map((g: any) => ({
            code_group: String(g.code || '').trim(),
            libelle: String(g.libelle || ''),
            description: g.description != null ? String(g.description) : undefined,
            domaine_technique: g.domaine_technique != null ? String(g.domaine_technique) : undefined,
            default_policy_tags: g.default_policy_tags,
            sort_order: typeof g.sort_order === 'number' ? g.sort_order : undefined,
            is_active: typeof g.is_active === 'boolean' ? g.is_active : undefined,
          })),
          types: (rawSheets.types || []).map((t: any) => ({
            code_type: String(t.code_type || '').trim(),
            code_group: String(t.group_code || '').trim(),
            libelle: String(t.libelle || ''),
            domaine_technique: t.domaine_technique != null ? String(t.domaine_technique) : undefined,
            is_active: typeof t.is_active === 'boolean' ? t.is_active : undefined,
          })),
          items: (rawSheets.items || []).map((it: any) => ({
            ref: String(it.ref || '').trim(),
            designation: String(it.designation || ''),
            code_type: String(it.type_code_or_id || '').trim(),
            code_group: String(it.group_code || '').trim(),
            unite_mesure: it.unite_mesure != null ? String(it.unite_mesure) : undefined,
            criticite: it.criticite != null ? String(it.criticite) : undefined,
            ref_constructeur: it.ref_constructeur != null ? String(it.ref_constructeur) : undefined,
            code_equivalents: it.code_equivalents != null ? String(it.code_equivalents) : undefined,
            delai_appro_jours: typeof it.delai_appro_jours === 'number' ? it.delai_appro_jours : undefined,
            domaine_technique: it.domaine_technique != null ? String(it.domaine_technique) : undefined,
            seuil: typeof it.seuil === 'number' ? it.seuil : undefined,
            emplacement: it.emplacement != null ? String(it.emplacement) : undefined,
            stockInitial: typeof it.stockInitial === 'number' ? it.stockInitial : null,
            prix_unitaire: typeof it.prix_unitaire === 'number' ? it.prix_unitaire : undefined,
            policy_tags: it.policy_tags,
          })),
        };
      }

      const pipelineReport = validateAndCommitRefPdrBundle(refPdrPayload, {
        mode,
        origin: 'EXCEL',
        dryRun: false,
        actorRole,
        actorId,
        actorName,
      });

      const stageGroups = pipelineReport.accepted.find((a) => a.stage === '04_PDR_GROUPS');
      const stageTypes = pipelineReport.accepted.find((a) => a.stage === '04_PDR_TYPES');
      const stageItems = pipelineReport.accepted.find((a) => a.stage === '04_PDR_ITEMS');

      const createdTotal =
        (stageGroups?.created || 0) + (stageTypes?.created || 0) + (stageItems?.created || 0);
      const updatedTotal =
        (stageGroups?.updated || 0) + (stageTypes?.updated || 0) + (stageItems?.updated || 0);
      const skippedTotal =
        (stageGroups?.unchanged || 0) +
        (stageTypes?.unchanged || 0) +
        (stageItems?.unchanged || 0);

      const modalReport: PdrCatalogImportReport = {
        success: pipelineReport.success && pipelineReport.committed,
        mode,
        created: {
          groups: stageGroups?.created || 0,
          types: stageTypes?.created || 0,
          items: stageItems?.created || 0,
          total: createdTotal,
        },
        updated: {
          groups: stageGroups?.updated || 0,
          types: stageTypes?.updated || 0,
          items: stageItems?.updated || 0,
          total: updatedTotal,
        },
        skipped: {
          groups: stageGroups?.unchanged || 0,
          types: stageTypes?.unchanged || 0,
          items: stageItems?.unchanged || 0,
          total: skippedTotal,
        },
        errors: pipelineReport.rejected.map((r) => ({
          sheet: (r.stage === '04_PDR_GROUPS'
            ? 'PDR_GROUPS'
            : r.stage === '04_PDR_TYPES'
            ? 'PDR_TYPES'
            : 'PDR_ITEMS') as any,
          row: r.row,
          field: r.identifier,
          message: `[${r.code}] ${r.message}`,
        })),
        nextGroups: pipelineReport.staging?.nextGroups ?? pdrGroups,
        nextTypes: pipelineReport.staging?.nextTypes ?? types,
        nextStock: pipelineReport.staging?.nextStock ?? rawStock,
        nextDesignations: pipelineReport.staging?.nextDesignations ?? [],
      };
      setReport(modalReport);

      if (!pipelineReport.success || !pipelineReport.committed) {
        setStatusMessage({
          type: 'error',
          text: `Import atomique rejeté via UnifiedImportPipeline : ${pipelineReport.rejected.length} erreur(s) bloquante(s). Aucune modification appliquée.`,
        });
        return;
      }

      setApplied(true);
      setStatusMessage({
        type: 'success',
        text: `Import Type A (${mode}) validé et engagé via UnifiedImportPipeline : ${createdTotal} créé(s), ${updatedTotal} mis à jour (0 erreur).`,
      });
    } catch (err: any) {
      setReport(null);
      setStatusMessage({
        type: 'error',
        text: `Impossible de lire le fichier Excel (.xlsx) : ${err?.message || 'Format invalide'}`,
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
                <span>1. Exporter le catalogue PDR actif (.xlsx — Type A Round-Trip)</span>
              </div>
              <p className="text-xs text-slate-600">
                Exporte l&apos;état réel du magasin ({pdrGroups.length} groupes, {types.length} types,{' '}
                {rawStock.length} articles) dans un classeur officiel Type A (<code className="font-mono">README_TYPE_A</code> + 3 feuilles).
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportLiveCatalog}
              data-testid="btn-export-pdr-hierarchy-xlsx"
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-2 transition shadow-xs cursor-pointer shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>Exporter catalogue PDR (.XLSX Type A)</span>
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

            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Contrat <span className="font-mono font-bold text-slate-700">UnifiedImportPipeline (REF_PDR)</span> • Validation atomique tout-ou-rien
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
