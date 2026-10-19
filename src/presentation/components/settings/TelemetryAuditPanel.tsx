import { useState } from 'react';
import {
  Bug,
  BarChart3,
  Download,
  Trash2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Activity,
  Layers,
  FileSpreadsheet,
  MousePointer,
} from 'lucide-react';

export default function TelemetryAuditPanel({
  errorReports = [],
  analyticsEvents = [],
  onSimulateError,
  onExportErrors,
  onClearErrors,
  onClearAnalytics,
  onRefresh,
}) {
  const [expandedErrorId, setExpandedErrorId] = useState(null);
  const [filterCategory, setFilterCategory] = useState('all');

  const filteredEvents = filterCategory === 'all'
    ? analyticsEvents
    : analyticsEvents.filter((e) => e.category === filterCategory);

  const categoryCounts = analyticsEvents.reduce(
    (acc, ev) => {
      acc[ev.category] = (acc[ev.category] || 0) + 1;
      return acc;
    },
    { navigation: 0, stock: 0, excel: 0, system: 0, auth: 0 }
  );

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-50/80 via-white to-slate-50 p-4 rounded-2xl border border-indigo-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Bug className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-indigo-950">
              Surveillance des Erreurs (Error Tracking) & Métriques d'Usage
            </h4>
            <p className="text-xs text-indigo-900/70 mt-0.5">
              Collecte locale 100% offline des exceptions d'exécution, traces de pile et télémétrie des actions métier.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onSimulateError}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-xs transition cursor-pointer"
            title="Simuler une erreur d'exécution pour tester la capture"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Tester Détection</span>
          </button>
          <button
            type="button"
            onClick={onExportErrors}
            disabled={errorReports.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition cursor-pointer disabled:opacity-50"
            title="Télécharger le rapport d'erreurs en JSON"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exporter JSON</span>
          </button>
          <button
            type="button"
            onClick={onRefresh}
            className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition cursor-pointer"
            title="Rafraîchir les données"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
            <span>Erreurs Capturées</span>
            <Bug className="w-3.5 h-3.5 text-rose-500" />
          </div>
          <div className="text-xl font-black text-rose-600 mt-1 font-mono">
            {errorReports.length}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Buffer local (Max 50)</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
            <span>Navigation</span>
            <MousePointer className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div className="text-xl font-black text-blue-600 mt-1 font-mono">
            {categoryCounts.navigation}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Changements d'onglets</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
            <span>Actions Stock</span>
            <Layers className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="text-xl font-black text-emerald-600 mt-1 font-mono">
            {categoryCounts.stock}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Entrées & Sorties PDR</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
            <span>Actions Excel</span>
            <FileSpreadsheet className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="text-xl font-black text-amber-600 mt-1 font-mono">
            {categoryCounts.excel}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Export / Import / Save</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
            <span>Total Événements</span>
            <Activity className="w-3.5 h-3.5 text-indigo-500" />
          </div>
          <div className="text-xl font-black text-indigo-600 mt-1 font-mono">
            {analyticsEvents.length}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Session active</div>
        </div>
      </div>

      {/* SECTION 1: Error Tracking Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bug className="w-4 h-4 text-rose-600" />
            <span className="text-xs font-bold text-slate-900">
              Journal des Erreurs Runtime ({errorReports.length})
            </span>
          </div>
          {errorReports.length > 0 && (
            <button
              type="button"
              onClick={onClearErrors}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
              <span>Effacer les erreurs</span>
            </button>
          )}
        </div>

        {errorReports.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-2">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <p className="text-xs font-bold text-slate-800">Aucune erreur d'exécution enregistrée</p>
            <p className="text-[11px] text-slate-400 mt-1">
              Toutes les opérations s'exécutent de façon stable et conforme.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
            {errorReports.map((report) => {
              const isExpanded = expandedErrorId === report.id;
              return (
                <div key={report.id} className="p-3.5 hover:bg-slate-50/70 transition">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-rose-100 text-rose-800">
                          {report.name}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">
                          {new Date(report.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-slate-800 mt-1 break-words">
                        {report.message}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 truncate font-mono">
                        {report.url}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setExpandedErrorId(isExpanded ? null : report.id)}
                      className="p-1 rounded-lg hover:bg-slate-200/60 text-slate-500 transition cursor-pointer shrink-0"
                      title={isExpanded ? 'Réduire' : 'Voir les détails de la pile'}
                    >
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="mt-3 p-3 bg-slate-900 text-slate-100 rounded-xl font-mono text-[10px] space-y-2 overflow-x-auto">
                      <div>
                        <span className="text-slate-400">ID Rapport:</span> {report.id}
                      </div>
                      <div>
                        <span className="text-slate-400">User Agent:</span> {report.userAgent}
                      </div>
                      {report.stack && (
                        <div>
                          <span className="text-slate-400">Stack Trace:</span>
                          <pre className="mt-1 text-rose-300 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                            {report.stack}
                          </pre>
                        </div>
                      )}
                      {report.componentStack && (
                        <div>
                          <span className="text-slate-400">Component Stack:</span>
                          <pre className="mt-1 text-amber-200 whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto">
                            {report.componentStack}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 2: Usage Analytics Events */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-bold text-slate-900">
              Flux des Événements Analytics ({filteredEvents.length})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="text-[11px] font-bold px-2 py-1 bg-slate-100 rounded-lg border border-slate-200 text-slate-700 cursor-pointer"
            >
              <option value="all">Toutes Catégories</option>
              <option value="navigation">Navigation</option>
              <option value="stock">Stock</option>
              <option value="excel">Excel</option>
              <option value="system">Système</option>
              <option value="auth">Auth</option>
            </select>

            {analyticsEvents.length > 0 && (
              <button
                type="button"
                onClick={onClearAnalytics}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                <span>Vider</span>
              </button>
            )}
          </div>
        </div>

        {filteredEvents.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs font-semibold">
            Aucun événement enregistré dans cette catégorie.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
            {filteredEvents.map((event) => (
              <div key={event.id} className="p-3 flex items-center justify-between gap-3 text-xs hover:bg-slate-50/60 transition">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      event.category === 'navigation'
                        ? 'bg-blue-100 text-blue-800'
                        : event.category === 'stock'
                        ? 'bg-emerald-100 text-emerald-800'
                        : event.category === 'excel'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-indigo-100 text-indigo-800'
                    }`}
                  >
                    {event.category}
                  </span>
                  <span className="font-bold text-slate-800 font-mono text-[11px] truncate">
                    {event.name}
                  </span>
                  {event.properties && Object.keys(event.properties).length > 0 && (
                    <span className="text-[10px] text-slate-400 font-mono hidden md:inline truncate">
                      {JSON.stringify(event.properties)}
                    </span>
                  )}
                </div>
                <div className="text-[10px] font-mono text-slate-400 shrink-0">
                  {new Date(event.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
