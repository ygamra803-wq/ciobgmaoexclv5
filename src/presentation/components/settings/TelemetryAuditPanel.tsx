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
import {
  SettingsSectionCard,
  SETTINGS_BUTTON_STYLES,
} from '../../pages/settings/components/settingsUi';

export default function TelemetryAuditPanel({
  errorReports = [],
  analyticsEvents = [],
  onSimulateError,
  onExportErrors,
  onClearErrors,
  onClearAnalytics,
  onRefresh,
}: any) {
  const [expandedErrorId, setExpandedErrorId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState('all');

  const filteredEvents =
    filterCategory === 'all'
      ? analyticsEvents
      : analyticsEvents.filter((e: any) => e.category === filterCategory);

  const categoryCounts = analyticsEvents.reduce(
    (acc: any, ev: any) => {
      acc[ev.category] = (acc[ev.category] || 0) + 1;
      return acc;
    },
    { navigation: 0, stock: 0, excel: 0, system: 0, auth: 0 }
  );

  return (
    <div className="space-y-6">
      {/* Header & KPI Summary Card */}
      <SettingsSectionCard
        title="Surveillance des Erreurs (Error Tracking) & Métriques d'Usage"
        description="Collecte locale 100% offline des exceptions d'exécution, traces de pile et télémétrie des actions métier."
        icon={<Bug className="w-4 h-4" />}
        headerRight={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onSimulateError}
              className={SETTINGS_BUTTON_STYLES.warning}
              title="Simuler une erreur d'exécution pour tester la capture"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Tester Détection</span>
            </button>
            <button
              type="button"
              onClick={onExportErrors}
              disabled={errorReports.length === 0}
              className={SETTINGS_BUTTON_STYLES.primary}
              title="Télécharger le rapport d'erreurs en JSON"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exporter JSON</span>
            </button>
            <button
              type="button"
              onClick={onRefresh}
              className={SETTINGS_BUTTON_STYLES.secondary}
              title="Rafraîchir les données"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
              <span>Erreurs Capturées</span>
              <Bug className="w-3.5 h-3.5 text-rose-500" />
            </div>
            <div className="text-xl font-black text-rose-600 mt-1 font-mono">
              {errorReports.length}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Buffer local (Max 50)</div>
          </div>

          <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
              <span>Navigation</span>
              <MousePointer className="w-3.5 h-3.5 text-indigo-500" />
            </div>
            <div className="text-xl font-black text-indigo-600 mt-1 font-mono">
              {categoryCounts.navigation}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Changements d&apos;onglets</div>
          </div>

          <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
              <span>Actions Stock</span>
              <Layers className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <div className="text-xl font-black text-emerald-600 mt-1 font-mono">
              {categoryCounts.stock}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Entrées &amp; Sorties PDR</div>
          </div>

          <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
              <span>Actions Excel</span>
              <FileSpreadsheet className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <div className="text-xl font-black text-amber-600 mt-1 font-mono">
              {categoryCounts.excel}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Export / Import / Save</div>
          </div>

          <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200">
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
      </SettingsSectionCard>

      {/* SECTION 1: Error Tracking Table */}
      <SettingsSectionCard
        title={`Journal des Erreurs Runtime (${errorReports.length})`}
        description="Traces d'exceptions capturées localement avec détails de la pile d'appels."
        icon={<Bug className="w-4 h-4" />}
        headerRight={
          errorReports.length > 0 ? (
            <button
              type="button"
              onClick={onClearErrors}
              className={SETTINGS_BUTTON_STYLES.dangerSoft}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Effacer les erreurs</span>
            </button>
          ) : undefined
        }
        bodyClassName="p-0"
      >
        {errorReports.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto mb-2">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-slate-800">Aucune erreur d&apos;exécution enregistrée</p>
            <p className="text-[11px] text-slate-400 mt-1">
              Toutes les opérations s&apos;exécutent de façon stable et conforme.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
            {errorReports.map((report: any) => {
              const isExpanded = expandedErrorId === report.id;
              return (
                <div key={report.id} className="p-3.5 hover:bg-slate-50/70 transition">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-rose-50 text-rose-800 border border-rose-200">
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
                      className="p-1.5 rounded-lg hover:bg-slate-200/60 text-slate-500 transition cursor-pointer shrink-0"
                      title={isExpanded ? 'Réduire' : 'Voir les détails de la pile'}
                    >
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="mt-3 p-3 bg-slate-50 text-slate-800 border border-slate-200 rounded-xl font-mono text-[10px] space-y-2 overflow-x-auto">
                      <div>
                        <span className="text-slate-500 font-bold">ID Rapport:</span> {report.id}
                      </div>
                      <div>
                        <span className="text-slate-500 font-bold">User Agent:</span> {report.userAgent}
                      </div>
                      {report.stack && (
                        <div>
                          <span className="text-slate-500 font-bold">Stack Trace:</span>
                          <pre className="mt-1 text-rose-800 bg-rose-50/50 p-2 rounded-lg border border-rose-200/60 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                            {report.stack}
                          </pre>
                        </div>
                      )}
                      {report.componentStack && (
                        <div>
                          <span className="text-slate-500 font-bold">Component Stack:</span>
                          <pre className="mt-1 text-amber-900 bg-amber-50/50 p-2 rounded-lg border border-amber-200/60 whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto">
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
      </SettingsSectionCard>

      {/* SECTION 2: Usage Analytics Events */}
      <SettingsSectionCard
        title={`Flux des Événements Analytics (${filteredEvents.length})`}
        description="Journal local des actions métier et transitions d'interface."
        icon={<BarChart3 className="w-4 h-4" />}
        headerRight={
          <div className="flex items-center gap-2">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="text-xs font-bold px-2.5 py-1.5 bg-white rounded-xl border border-slate-200 text-slate-700 cursor-pointer focus:outline-none focus:border-indigo-500"
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
                className={SETTINGS_BUTTON_STYLES.secondary}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Vider</span>
              </button>
            )}
          </div>
        }
        bodyClassName="p-0"
      >
        {filteredEvents.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs font-semibold">
            Aucun événement enregistré dans cette catégorie.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
            {filteredEvents.map((event: any) => (
              <div
                key={event.id}
                className="px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs hover:bg-slate-50/60 transition"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                      event.category === 'navigation'
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                        : event.category === 'stock'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : event.category === 'excel'
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
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
      </SettingsSectionCard>
    </div>
  );
}
