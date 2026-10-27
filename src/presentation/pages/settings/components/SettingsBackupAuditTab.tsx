import {
  Shield,
  Laptop,
  Activity,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Gauge,
  Bug,
  Globe,
  RefreshCw,
  Trash2,
  LogIn,
  LogOut as LogOutIcon,
  Database,
  Download,
  RotateCcw,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Link2,
  Wifi,
} from 'lucide-react';
import TelemetryAuditPanel from '../../../components/settings/TelemetryAuditPanel';
import SyncButtons from '../../../components/common/SyncButtons';
import { performanceService } from '../../../../services/performanceService';
import { syncQueueService } from '../../../../services/syncQueueService';

/**
 * Access Logs, Data Audits, Restore Points, Data Integrity, Orphan Cleanup & Telemetry Hub.
 */
export default function SettingsBackupAuditTab({
  auditSubTab,
  setAuditSubTab,
  accessLogs = [],
  auditLogs = [],
  backupsList = [],
  errorReports = [],
  analyticsEvents = [],
  loadAccessLogs,
  handleClearAccessLogs,
  loadAuditLogs,
  loadingAudit,
  loadBackups,
  setShowBackupManagerModal,
  handleExportBackup,
  handleRestoreBackup,
  runIntegrityCheck,
  checkingIntegrity,
  handleRepairData,
  integrityReport,
  rawStock = [],
  mouvements = [],
  currentChecksum,
  preventiveOrphans = [],
  correctiveOrphans = [],
  systemGeneralBomLeaks = [],
  handlePurgePreventiveOrphans,
  handlePurgeCorrectiveOrphans,
  handlePurgeSystemGeneralBomLeaks,
  handleBulkRelink,
  refreshPerformanceMetrics,
  runPerformanceBenchmark,
  perfStats = { heapMB: 0, recalcStats: null },
  syncQueueState = { isOnline: true, pendingCount: 0, failedCount: 0 },
  refreshTelemetry,
  handleSimulateError,
  handleExportErrorReports,
  handleClearErrorReports,
  handleClearAnalytics,
  showToast,
}: any) {
  return (
    <div className="space-y-6 max-w-full overflow-hidden">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Shield className="w-4 h-4 text-fuchsia-600 shrink-0" />
            <span>Traçabilité, Sécurité & Journal des Accès (Audit Logs)</span>
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Surveillance en temps réel des sessions de connexion, adresses IP des postes, durées d'activité et historique des modifications.
          </p>
        </div>

        {/* Subtabs Switcher */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200 shrink-0">
          <button
            onClick={() => setAuditSubTab('access')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              auditSubTab === 'access'
                ? 'bg-white text-fuchsia-700 shadow-xs border border-fuchsia-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Laptop className="w-3.5 h-3.5 text-fuchsia-600" />
            <span>Connexions & Postes ({accessLogs.length})</span>
          </button>
          <button
            onClick={() => setAuditSubTab('events')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              auditSubTab === 'events'
                ? 'bg-white text-fuchsia-700 shadow-xs border border-fuchsia-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-blue-600" />
            <span>Actions & Données ({auditLogs.length})</span>
          </button>
          <button
            onClick={() => setAuditSubTab('backups')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              auditSubTab === 'backups'
                ? 'bg-white text-fuchsia-700 shadow-xs border border-fuchsia-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-emerald-600" />
            <span>Points de Restauration ({backupsList.length})</span>
          </button>
          <button
            onClick={() => {
              setAuditSubTab('integrity');
              runIntegrityCheck?.();
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              auditSubTab === 'integrity'
                ? 'bg-white text-emerald-700 shadow-xs border border-emerald-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Intégrité des Données</span>
          </button>
          <button
            onClick={() => {
              setAuditSubTab('performance');
              refreshPerformanceMetrics?.();
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              auditSubTab === 'performance'
                ? 'bg-white text-amber-700 shadow-xs border border-amber-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Gauge className="w-3.5 h-3.5 text-amber-600" />
            <span>Performance & Sync</span>
          </button>
          <button
            onClick={() => {
              setAuditSubTab('telemetry');
              refreshTelemetry?.();
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              auditSubTab === 'telemetry'
                ? 'bg-white text-indigo-700 shadow-xs border border-indigo-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Bug className="w-3.5 h-3.5 text-indigo-600" />
            <span>Erreurs & Analytics ({errorReports.length})</span>
          </button>
        </div>
      </div>

      {/* SUBTAB 1: ACCESS LOGS & SESSIONS */}
      {auditSubTab === 'access' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-fuchsia-50/60 p-3.5 rounded-2xl border border-fuchsia-200/80">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-fuchsia-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Globe className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-fuchsia-950">
                  Surveillance des Postes & Historique de Connexion
                </h4>
                <p className="text-[11px] text-fuchsia-800/80">
                  Enregistre l'adresse IP, le nom du poste/ordinateur, le navigateur, l'heure d'entrée et la durée d'utilisation.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={loadAccessLogs}
                className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-fuchsia-800 text-xs font-bold rounded-xl border border-fuchsia-200 shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 text-fuchsia-600" />
                <span>Actualiser</span>
              </button>
              <button
                onClick={handleClearAccessLogs}
                className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl border border-rose-200 shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Vider</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100/90 border-b border-slate-200 text-slate-700 font-bold uppercase sticky top-0 z-10 text-[11px]">
                  <tr>
                    <th className="px-4 py-3">Statut & Session</th>
                    <th className="px-4 py-3">Utilisateur Connecté</th>
                    <th className="px-4 py-3">Poste / Ordinateur</th>
                    <th className="px-4 py-3">Adresse IP</th>
                    <th className="px-4 py-3">Système & Navigateur</th>
                    <th className="px-4 py-3">Heure Connexion</th>
                    <th className="px-4 py-3">Heure Déconnexion</th>
                    <th className="px-4 py-3 text-right">Durée Session</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {accessLogs.map((log: any) => (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            log.status === 'En cours'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              log.status === 'En cours' ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'
                            }`}
                          />
                          {log.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-bold text-slate-900">{log.userName}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{log.userRole}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-slate-800 font-bold font-mono">
                          <Laptop className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span>{log.stationName || 'Station-Client'}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">ID: {log.deviceId}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-mono text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded font-bold text-[11px]">
                          {log.ip}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-slate-800 font-medium">{log.os}</div>
                        <div className="text-[10.5px] text-slate-500">{log.browser} • {log.screenRes}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px] text-slate-700">
                        <div className="flex items-center gap-1">
                          <LogIn className="w-3 h-3 text-emerald-600" />
                          <span>{new Date(log.loginTime).toLocaleString('fr-FR')}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px] text-slate-500">
                        {log.logoutTime ? (
                          <div className="flex items-center gap-1">
                            <LogOutIcon className="w-3 h-3 text-rose-500" />
                            <span>{new Date(log.logoutTime).toLocaleString('fr-FR')}</span>
                          </div>
                        ) : (
                          <span className="italic text-emerald-600 font-sans text-xs">Session active...</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right font-mono font-bold text-slate-800">
                        {log.durationMinutes ? `${log.durationMinutes} min` : '< 1 min'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: DATA & AUDIT EVENTS */}
      {auditSubTab === 'events' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Journal des Modifications de Données
            </h4>
            <button
              onClick={loadAuditLogs}
              className="text-xs text-fuchsia-600 hover:text-fuchsia-700 flex items-center gap-1 font-bold cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingAudit ? 'animate-spin' : ''}`} /> Actualiser
            </button>
          </div>

          <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
            <div className="max-h-[450px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold uppercase sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-2">Horodatage</th>
                    <th className="px-4 py-2">Action</th>
                    <th className="px-4 py-2">Cible</th>
                    <th className="px-4 py-2">Acteur</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                        Aucun événement enregistré
                      </td>
                    </tr>
                  ) : (
                    [...auditLogs]
                      .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                      .slice(0, 100)
                      .map((log: any) => (
                        <tr key={log.id} className="hover:bg-white transition-colors">
                          <td className="px-4 py-2.5 whitespace-nowrap font-mono text-[10px] text-slate-500">
                            {new Date(log.timestamp).toLocaleString()}
                          </td>
                          <td className="px-4 py-2.5">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                log.action === 'CREATE'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : log.action === 'UPDATE'
                                    ? 'bg-blue-100 text-blue-700'
                                    : log.action === 'DELETE'
                                      ? 'bg-rose-100 text-rose-700'
                                      : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              {log.action}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 font-bold text-slate-700 truncate max-w-[100px]" title={log.entityId}>
                            {log.entity}{' '}
                            <span className="font-normal text-slate-400 font-mono text-[10px]">
                              ({log.entityId})
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-slate-600 truncate max-w-[80px]">
                            {log.userId}
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 3: BACKUPS & RESTORE */}
      {auditSubTab === 'backups' && (
        <div className="space-y-4">
          <SyncButtons showToast={showToast} />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Points de Restauration Locaux
            </h4>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowBackupManagerModal(true)}
                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition"
              >
                <Database className="w-3.5 h-3.5" />
                Gestionnaire Avancé de Sauvegardes
              </button>
              <button
                onClick={loadBackups}
                className="text-xs text-fuchsia-600 hover:text-fuchsia-700 flex items-center gap-1 font-bold cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Actualiser
              </button>
            </div>
          </div>

          <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold uppercase">
                <tr>
                  <th className="px-4 py-2">Date & Heure</th>
                  <th className="px-4 py-2">Utilisateur</th>
                  <th className="px-4 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {backupsList.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-slate-500">
                      Aucune sauvegarde disponible
                    </td>
                  </tr>
                ) : (
                  backupsList.map((b: any) => (
                    <tr key={b.id} className="hover:bg-white transition-colors">
                      <td className="px-4 py-2.5 whitespace-nowrap font-mono text-[11px]">
                        {new Date(b.timestamp).toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 truncate max-w-[100px]">{b.userId}</td>
                      <td className="px-4 py-2.5 text-right flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleExportBackup(b.id)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title="Exporter en JSON"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleRestoreBackup(b.id)}
                          className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                          title="Restaurer cette version"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 4: DATA INTEGRITY & TWIN EXCEL FORMULAS */}
      {auditSubTab === 'integrity' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-emerald-50/70 p-3.5 rounded-2xl border border-emerald-200/80">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-emerald-950">
                  Diagnostic d'Intégrité des Données & Formules Jumelles
                </h4>
                <p className="text-[11px] text-emerald-800/80">
                  Vérifie la concordance mathématique (Stock Actuel = Initial + Entrées - Sorties), l'absence de valeurs négatives et l'empreinte Checksum.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={runIntegrityCheck}
                disabled={checkingIntegrity}
                className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${checkingIntegrity ? 'animate-spin' : ''}`} />
                <span>{checkingIntegrity ? 'Vérification...' : "Lancer l'Audit"}</span>
              </button>
              <button
                onClick={handleRepairData}
                className="px-3 py-1.5 bg-white hover:bg-emerald-50 text-emerald-800 text-xs font-bold rounded-xl border border-emerald-300 shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 text-amber-600" />
                <span>Réparer Auto</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-[11px] font-mono text-slate-500">Statut Global</div>
              <div className="text-base font-black mt-1 flex items-center gap-1.5">
                {integrityReport?.overall?.valid ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span className="text-emerald-700">100% Conforme</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span className="text-amber-700">
                      {integrityReport?.overall?.totalErrors || 0} anomalie(s)
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-[11px] font-mono text-slate-500">Articles Contrôlés</div>
              <div className="text-base font-black text-slate-900 mt-1 font-mono">
                {rawStock.length} articles
              </div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-[11px] font-mono text-slate-500">Mouvements Audités</div>
              <div className="text-base font-black text-slate-900 mt-1 font-mono">
                {mouvements.length} lignes
              </div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-[11px] font-mono text-slate-500">Empreinte Checksum</div>
              <div
                className="text-xs font-mono font-bold text-slate-700 mt-1 truncate"
                title={currentChecksum}
              >
                0x{currentChecksum || 'N/A'}
              </div>
            </div>
          </div>

          {/* Bulk Orphan Cleanup Panel */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-600" />
                <div>
                  <h5 className="text-xs font-bold text-slate-900">
                    Gestion des Liaisons Orphelines (Intégrité Relationnelle)
                  </h5>
                  <p className="text-[11px] text-slate-500">
                    Détection et nettoyage des tâches ou interventions pointant vers des machines supprimées ou archivées.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200">
                  {preventiveOrphans.length + correctiveOrphans.length + systemGeneralBomLeaks.length} Anomalie(s) relationnelle(s)
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Preventive Orphans */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">Tâches Préventives</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                        preventiveOrphans.length > 0
                          ? 'bg-amber-100 text-amber-900'
                          : 'bg-emerald-100 text-emerald-900'
                      }`}
                    >
                      {preventiveOrphans.length} orpheline(s)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Liées à des machines inexistantes ou archivées.
                  </p>
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                  <button
                    onClick={handlePurgePreventiveOrphans}
                    disabled={preventiveOrphans.length === 0}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl transition flex items-center gap-1 cursor-pointer shadow-2xs"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Purger Préventif</span>
                  </button>
                  <button
                    onClick={() => handleBulkRelink?.('preventive')}
                    disabled={preventiveOrphans.length === 0}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl transition flex items-center gap-1 cursor-pointer shadow-2xs"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    <span>Relier en Masse</span>
                  </button>
                </div>
              </div>

              {/* Corrective Orphans */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">
                      Interventions Correctives & BTs
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                        correctiveOrphans.length > 0
                          ? 'bg-amber-100 text-amber-900'
                          : 'bg-emerald-100 text-emerald-900'
                      }`}
                    >
                      {correctiveOrphans.length} orpheline(s)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Demandes et ordres de travail sans machine active.
                  </p>
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                  <button
                    onClick={handlePurgeCorrectiveOrphans}
                    disabled={correctiveOrphans.length === 0}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl transition flex items-center gap-1 cursor-pointer shadow-2xs"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Purger Correctif</span>
                  </button>
                  <button
                    onClick={() => handleBulkRelink?.('corrective')}
                    disabled={correctiveOrphans.length === 0}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl transition flex items-center gap-1 cursor-pointer shadow-2xs"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    <span>Relier en Masse</span>
                  </button>
                </div>
              </div>

              {/* Système Général BOM Immunity */}
              <div className="p-4 rounded-xl bg-indigo-50/40 border border-indigo-200/80 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-950">
                      Immunité BOM · Système Général
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                        systemGeneralBomLeaks.length > 0
                          ? 'bg-rose-100 text-rose-900 animate-pulse'
                          : 'bg-emerald-100 text-emerald-900'
                      }`}
                    >
                      {systemGeneralBomLeaks.length} fuite(s) BOM
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1">
                    Détecte si des organes BOM de production (machineElementsLedger) sont rattachés par erreur à un équipement Système Général.
                  </p>
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-indigo-200/60">
                  <button
                    onClick={handlePurgeSystemGeneralBomLeaks}
                    disabled={systemGeneralBomLeaks.length === 0}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl transition flex items-center gap-1 cursor-pointer shadow-2xs"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Détacher Organes BOM</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Audit Results Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">
                Rapport d'Audit Détaillé ({integrityReport?.overall?.totalErrors || 0} Erreurs,{' '}
                {integrityReport?.overall?.totalWarnings || 0} Avertissements)
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                Horodatage:{' '}
                {integrityReport?.timestamp
                  ? new Date(integrityReport.timestamp).toLocaleTimeString()
                  : 'En attente'}
              </span>
            </div>

            {!integrityReport ||
            (integrityReport.overall.totalErrors === 0 &&
              integrityReport.overall.totalWarnings === 0) ? (
              <div className="p-6 text-center text-xs text-slate-500 space-y-1">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <div className="font-bold text-slate-800 mt-2">Aucune anomalie détectée</div>
                <div>
                  Toutes les formules Excel Twin et les cohérences relationnelles sont parfaitement alignées.
                </div>
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 text-xs">
                {integrityReport.stock?.errors?.map((err: any, i: number) => (
                  <div key={`se-${i}`} className="p-3 bg-rose-50/50 flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <span className="font-bold text-rose-900 font-mono">[{err.type}]</span>
                      <span className="ml-2 text-rose-800">{err.message}</span>
                    </div>
                  </div>
                ))}
                {integrityReport.stock?.warnings?.map((warn: any, i: number) => (
                  <div key={`sw-${i}`} className="p-3 bg-amber-50/40 flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <span className="font-bold text-amber-900 font-mono">[{warn.type}]</span>
                      <span className="ml-2 text-amber-800">{warn.message}</span>
                    </div>
                  </div>
                ))}
                {integrityReport.movements?.errors?.map((err: any, i: number) => (
                  <div key={`me-${i}`} className="p-3 bg-rose-50/50 flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <span className="font-bold text-rose-900 font-mono">[MVT_{err.type}]</span>
                      <span className="ml-2 text-rose-800">{err.message}</span>
                    </div>
                  </div>
                ))}
                {integrityReport.movements?.warnings?.map((warn: any, i: number) => (
                  <div key={`mw-${i}`} className="p-3 bg-amber-50/40 flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <span className="font-bold text-amber-900 font-mono">[MVT_{warn.type}]</span>
                      <span className="ml-2 text-amber-800">{warn.message}</span>
                    </div>
                  </div>
                ))}
                {integrityReport.referential?.errors?.map((err: any, i: number) => (
                  <div key={`re-${i}`} className="p-3 bg-rose-50/50 flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <span className="font-bold text-rose-900 font-mono">[REF_{err.type}]</span>
                      <span className="ml-2 text-rose-800">{err.message}</span>
                    </div>
                  </div>
                ))}
                {integrityReport.referential?.warnings?.map((warn: any, i: number) => (
                  <div key={`rw-${i}`} className="p-3 bg-amber-50/40 flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <span className="font-bold text-amber-900 font-mono">[REF_{warn.type}]</span>
                      <span className="ml-2 text-amber-800">{warn.message}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 5: PERFORMANCE MONITOR & OFFLINE SYNC QUEUE */}
      {auditSubTab === 'performance' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-amber-50/70 p-3.5 rounded-2xl border border-amber-200/80">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Gauge className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-amber-950">
                  Moniteur de Performance & File d'Attente Offline
                </h4>
                <p className="text-[11px] text-amber-800/80">
                  Suivi des temps d'exécution, consommation mémoire JS Heap et état des opérations en attente de synchronisation.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={runPerformanceBenchmark}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Tester le Recalcul</span>
              </button>
              <button
                onClick={() => performanceService.exportReport()}
                className="px-3 py-1.5 bg-white hover:bg-amber-50 text-amber-900 text-xs font-bold rounded-xl border border-amber-300 shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-amber-700" />
                <span>Exporter CSV</span>
              </button>
            </div>
          </div>

          <SyncButtons showToast={showToast} />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-[11px] font-mono text-slate-500">Consommation Mémoire Heap</div>
              <div className="text-lg font-black text-slate-900 mt-1 font-mono">
                {perfStats?.heapMB ? `${perfStats.heapMB.toFixed(1)} Mo` : 'Non disponible'}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">Estimée via performance.memory</div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-[11px] font-mono text-slate-500">Recalcul Twin (Moyenne)</div>
              <div className="text-lg font-black text-amber-600 mt-1 font-mono">
                {perfStats?.recalcStats?.avg ? `${perfStats.recalcStats.avg} ms` : 'À tester'}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                Min: {perfStats?.recalcStats?.min ?? 'N/A'}ms • Max: {perfStats?.recalcStats?.max ?? 'N/A'}ms
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-[11px] font-mono text-slate-500">File de Synchronisation</div>
              <div className="text-lg font-black mt-1 font-mono flex items-center gap-2">
                <span className={syncQueueState?.isOnline ? 'text-emerald-700' : 'text-amber-600'}>
                  {syncQueueState?.isOnline ? 'En ligne' : 'Hors-ligne'}
                </span>
                <span className="text-xs font-bold text-slate-400">
                  ({syncQueueState?.pendingCount || 0} en attente)
                </span>
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                {syncQueueState?.failedCount || 0} échec(s) • IndexedDB actif
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <Wifi className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-slate-800">
                  Gestionnaire de File d'Attente de Synchronisation
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => syncQueueService.processQueue()}
                  className="px-2.5 py-1 text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition cursor-pointer"
                >
                  Rejouer la file
                </button>
                <button
                  onClick={() => syncQueueService.clearQueue()}
                  className="px-2.5 py-1 text-[11px] bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg transition cursor-pointer"
                >
                  Vider la file
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Le service <strong>SyncQueueService</strong> enregistre toute transaction d'écriture en mode hors-ligne dans IndexedDB avec priorité d'exécution et tentatives automatiques (jusqu'à 3 essais) dès que le réseau ou le partage est réactivé.
            </p>
          </div>
        </div>
      )}

      {/* SUBTAB 6: ERROR TRACKING & USAGE ANALYTICS */}
      {auditSubTab === 'telemetry' && (
        <TelemetryAuditPanel
          errorReports={errorReports}
          analyticsEvents={analyticsEvents}
          onSimulateError={handleSimulateError}
          onExportErrors={handleExportErrorReports}
          onClearErrors={handleClearErrorReports}
          onClearAnalytics={handleClearAnalytics}
          onRefresh={refreshTelemetry}
        />
      )}
    </div>
  );
}
