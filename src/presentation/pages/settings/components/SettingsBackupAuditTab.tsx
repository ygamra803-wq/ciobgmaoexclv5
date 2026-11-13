import { useState, useMemo } from 'react';
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
  Lock,
  Filter,
} from 'lucide-react';
import TelemetryAuditPanel from '../../../components/settings/TelemetryAuditPanel';
import SyncButtons from '../../../components/common/SyncButtons';
import { confirmAction } from '../../../../utils/confirmAction';
import { performanceService } from '../../../../services/performanceService';
import { syncQueueService } from '../../../../services/syncQueueService';
import { useGmaoStore } from '../../../../store/useGmaoStore';
import { SettingsSectionCard, SETTINGS_BUTTON_STYLES } from './settingsUi';

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
  const storeAuditEvents = useGmaoStore((s) => s.auditEvents);
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>('ALL');

  const combinedAuditEvents = useMemo(() => {
    const fromStore = Array.isArray(storeAuditEvents) ? storeAuditEvents : [];
    const fromLegacy = Array.isArray(auditLogs)
      ? auditLogs
          .filter((l: any) => l && !fromStore.some((s) => s.id === l.id))
          .map((l: any, idx: number) => ({
            id: l.id || `LEG-${l.ts || l.timestamp || idx}-${idx}`,
            ts: l.ts || l.timestamp || new Date().toISOString(),
            actorId: l.actorId || l.userId || 'SYSTEM',
            actorName: l.actorName || l.userId || 'Système',
            actorRole: l.actorRole || 'ADMIN',
            actionType: l.actionType || l.action || 'MUTATION',
            entityType: l.entityType || l.entity || 'ENTITY',
            entityId: l.entityId || 'N/A',
            before: l.before ?? null,
            after: l.after ?? null,
            meta: l.meta || {},
          }))
      : [];
    const merged = [...fromStore, ...fromLegacy].sort(
      (a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()
    );
    if (entityTypeFilter === 'ALL') return merged;
    return merged.filter((ev) => String(ev.entityType).toUpperCase() === entityTypeFilter);
  }, [storeAuditEvents, auditLogs, entityTypeFilter]);

  const getSubTabClass = (isActive: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
      isActive
        ? 'bg-sky-50 text-slate-950 border border-slate-900 shadow-[1px_1px_0px_0px_rgba(15,23,42,0.85)]'
        : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-300'
    }`;

  return (
    <div className="space-y-6 max-w-full overflow-hidden">
      {/* Top Subtabs Switcher Card */}
      <SettingsSectionCard
        title="Traçabilité, Sécurité & Journal des Accès (Audit Logs)"
        description="Surveillance en temps réel des sessions de connexion, adresses IP des postes, points de restauration et intégrité relationnelle."
        icon={<Shield className="w-4 h-4" />}
      >
        <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-slate-100 rounded-xl border border-slate-300">
          <button
            onClick={() => setAuditSubTab('access')}
            className={getSubTabClass(auditSubTab === 'access')}
          >
            <Laptop className="w-3.5 h-3.5 text-sky-700" />
            <span>Connexions &amp; Postes ({accessLogs.length})</span>
          </button>
          <button
            onClick={() => setAuditSubTab('events')}
            className={getSubTabClass(auditSubTab === 'events')}
          >
            <Activity className="w-3.5 h-3.5 text-sky-700" />
            <span>Actions &amp; Données ({(storeAuditEvents?.length || 0) + (auditLogs?.length || 0)})</span>
          </button>
          <button
            onClick={() => setAuditSubTab('backups')}
            className={getSubTabClass(auditSubTab === 'backups')}
          >
            <Clock className="w-3.5 h-3.5 text-sky-700" />
            <span>Points de Restauration ({backupsList.length})</span>
          </button>
          <button
            onClick={() => {
              setAuditSubTab('integrity');
              runIntegrityCheck?.();
            }}
            className={getSubTabClass(auditSubTab === 'integrity')}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-sky-700" />
            <span>Intégrité des Données</span>
          </button>
          <button
            onClick={() => {
              setAuditSubTab('performance');
              refreshPerformanceMetrics?.();
            }}
            className={getSubTabClass(auditSubTab === 'performance')}
          >
            <Gauge className="w-3.5 h-3.5 text-sky-700" />
            <span>Performance &amp; Sync</span>
          </button>
          <button
            onClick={() => {
              setAuditSubTab('telemetry');
              refreshTelemetry?.();
            }}
            className={getSubTabClass(auditSubTab === 'telemetry')}
          >
            <Bug className="w-3.5 h-3.5 text-sky-700" />
            <span>Erreurs &amp; Analytics ({errorReports.length})</span>
          </button>
        </div>
      </SettingsSectionCard>

      {/* SUBTAB 1: ACCESS LOGS & SESSIONS */}
      {auditSubTab === 'access' && (
        <SettingsSectionCard
          title="Surveillance des Postes & Historique de Connexion"
          description="Enregistre l'adresse IP, le nom du poste/ordinateur, le navigateur, l'heure d'entrée et la durée d'utilisation."
          icon={<Globe className="w-4 h-4" />}
          headerRight={
            <div className="flex items-center gap-2">
              <button
                onClick={loadAccessLogs}
                className={SETTINGS_BUTTON_STYLES.secondary}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Actualiser</span>
              </button>
              <button
                onClick={async () => {
                  const ok = await confirmAction({
                    title: 'Vider le journal des connexions',
                    message:
                      "Êtes-vous sûr de vouloir effacer l'historique des sessions de connexion des postes ?",
                    confirmText: 'Vider le journal',
                    variant: 'danger',
                  });
                  if (ok) handleClearAccessLogs?.();
                }}
                className={SETTINGS_BUTTON_STYLES.dangerSoft}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Vider</span>
              </button>
            </div>
          }
          bodyClassName="p-0"
        >
          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase sticky top-0 z-10 text-[11px]">
                <tr>
                  <th className="px-3.5 py-2.5">Statut &amp; Session</th>
                  <th className="px-3.5 py-2.5">Utilisateur Connecté</th>
                  <th className="px-3.5 py-2.5">Poste / Ordinateur</th>
                  <th className="px-3.5 py-2.5">Adresse IP</th>
                  <th className="px-3.5 py-2.5">Système &amp; Navigateur</th>
                  <th className="px-3.5 py-2.5">Heure Connexion</th>
                  <th className="px-3.5 py-2.5">Heure Déconnexion</th>
                  <th className="px-3.5 py-2.5 text-right">Durée Session</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {accessLogs.map((log: any, idx: number) => (
                  <tr
                    key={`${log.id || log.loginTime || 'access'}-${idx}`}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="px-3.5 py-2.5 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          log.status === 'En cours'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            log.status === 'En cours' ? 'bg-emerald-500' : 'bg-slate-400'
                          }`}
                        />
                        {log.status}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 whitespace-nowrap">
                      <div className="font-bold text-slate-900">{log.userName}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{log.userRole}</div>
                    </td>
                    <td className="px-3.5 py-2.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-slate-800 font-bold font-mono">
                        <Laptop className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span>{log.stationName || 'Station-Client'}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">ID: {log.deviceId}</div>
                    </td>
                    <td className="px-3.5 py-2.5 whitespace-nowrap">
                      <span className="font-mono text-sky-800 bg-sky-50 border border-sky-300 px-2 py-0.5 rounded font-bold text-[11px]">
                        {log.ip}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 whitespace-nowrap">
                      <div className="text-slate-800 font-medium">{log.os}</div>
                      <div className="text-[10.5px] text-slate-500">
                        {log.browser} • {log.screenRes}
                      </div>
                    </td>
                    <td className="px-3.5 py-2.5 whitespace-nowrap font-mono text-[11px] text-slate-700">
                      <div className="flex items-center gap-1">
                        <LogIn className="w-3 h-3 text-emerald-600" />
                        <span>{new Date(log.loginTime).toLocaleString('fr-FR')}</span>
                      </div>
                    </td>
                    <td className="px-3.5 py-2.5 whitespace-nowrap font-mono text-[11px] text-slate-500">
                      {log.logoutTime ? (
                        <div className="flex items-center gap-1">
                          <LogOutIcon className="w-3 h-3 text-rose-500" />
                          <span>{new Date(log.logoutTime).toLocaleString('fr-FR')}</span>
                        </div>
                      ) : (
                        <span className="italic text-emerald-600 font-sans text-xs">
                          Session active...
                        </span>
                      )}
                    </td>
                    <td className="px-3.5 py-2.5 whitespace-nowrap text-right font-mono font-bold text-slate-800">
                      {log.durationMinutes ? `${log.durationMinutes} min` : '< 1 min'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SettingsSectionCard>
      )}

      {/* SUBTAB 2: APPEND-ONLY ENTERPRISE DATA & AUDIT EVENTS (AUDIT-LEDGER-P0) */}
      {auditSubTab === 'events' && (
        <SettingsSectionCard
          title="Journal d'Audit Append-Only (Opérations Critiques Avant / Après)"
          description="Registre immuable (STOCK_ITEM, MACHINE, REPLENISHMENT_ORDER, VALIDATIONS, FINANCIAL_BUDGET) — Lecture seule."
          icon={<Lock className="w-4 h-4" />}
          headerRight={
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  aria-label="Filtrer par type d'entité"
                  value={entityTypeFilter}
                  onChange={(e) => setEntityTypeFilter(e.target.value)}
                  className="text-xs font-bold text-slate-700 bg-transparent focus:outline-none cursor-pointer"
                >
                  <option value="ALL">Toutes les entités ({combinedAuditEvents.length})</option>
                  <option value="STOCK_ITEM">Articles Stock (STOCK_ITEM)</option>
                  <option value="MACHINE">Machines &amp; Archivage (MACHINE)</option>
                  <option value="REPLENISHMENT_ORDER">Commandes d&apos;Achat (REPLENISHMENT_ORDER)</option>
                  <option value="CORRECTIVE_BT">Validation BT Correctif (CORRECTIVE_BT)</option>
                  <option value="PREVENTIVE_EXECUTION">Validation Préventif (PREVENTIVE_EXECUTION)</option>
                  <option value="SORTIE_DEMAND">Demandes Sortie PDR (SORTIE_DEMAND)</option>
                  <option value="FINANCIAL_BUDGET">Budgets Financiers (FINANCIAL_BUDGET)</option>
                </select>
              </div>
              <button
                onClick={loadAuditLogs}
                className={SETTINGS_BUTTON_STYLES.secondary}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingAudit ? 'animate-spin' : ''}`} />
                <span>Actualiser</span>
              </button>
            </div>
          }
          bodyClassName="p-0"
        >
          <div className="max-h-[480px] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase sticky top-0 z-10 text-[11px]">
                <tr>
                  <th className="px-3.5 py-2.5">Horodatage</th>
                  <th className="px-3.5 py-2.5">Action</th>
                  <th className="px-3.5 py-2.5">Entité &amp; ID</th>
                  <th className="px-3.5 py-2.5">Acteur (Rôle)</th>
                  <th className="px-3.5 py-2.5">Avant ➔ Après</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {combinedAuditEvents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                      Aucun événement d&apos;audit enregistré pour ce filtre
                    </td>
                  </tr>
                ) : (
                  combinedAuditEvents.slice(0, 100).map((log: any, idx: number) => (
                    <tr
                      key={`${log.id || log.ts || 'audit'}-${idx}`}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="px-3.5 py-2.5 whitespace-nowrap font-mono text-[10px] text-slate-500">
                        {new Date(log.ts).toLocaleString('fr-FR')}
                      </td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-sky-50 text-sky-800 border border-sky-300 text-[10px] font-bold font-mono">
                          {log.actionType}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        <div className="font-bold text-slate-800">{log.entityType}</div>
                        <div className="font-mono text-[10px] text-slate-400">{log.entityId}</div>
                      </td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        <div className="font-bold text-slate-700">{log.actorName}</div>
                        <div className="font-mono text-[10px] text-slate-400">{log.actorRole}</div>
                      </td>
                      <td className="px-3.5 py-2.5 text-[11px] text-slate-600 max-w-md">
                        {log.meta?.summary ? (
                          <div className="font-medium text-slate-800 mb-0.5">{log.meta.summary}</div>
                        ) : null}
                        <div
                          className="font-mono text-[10px] text-slate-500 truncate"
                          title={`${JSON.stringify(log.before)} -> ${JSON.stringify(log.after)}`}
                        >
                          {log.before ? JSON.stringify(log.before) : '∅'} ➔{' '}
                          {log.after ? JSON.stringify(log.after) : '∅'}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </SettingsSectionCard>
      )}

      {/* SUBTAB 3: BACKUPS & RESTORE */}
      {auditSubTab === 'backups' && (
        <div className="space-y-4">
          <SyncButtons showToast={showToast} />

          <SettingsSectionCard
            title="Points de Restauration Locaux"
            description="Snapshots locaux complets permettant de restaurer l'état de l'usine ou d'exporter une archive JSON."
            icon={<Database className="w-4 h-4" />}
            headerRight={
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowBackupManagerModal(true)}
                  className={SETTINGS_BUTTON_STYLES.primary}
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>Gestionnaire Avancé de Sauvegardes</span>
                </button>
                <button
                  onClick={loadBackups}
                  className={SETTINGS_BUTTON_STYLES.secondary}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Actualiser</span>
                </button>
              </div>
            }
            bodyClassName="p-0"
          >
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px]">
                <tr>
                  <th className="px-3.5 py-2.5">Date &amp; Heure</th>
                  <th className="px-3.5 py-2.5">Utilisateur</th>
                  <th className="px-3.5 py-2.5 text-right">Actions</th>
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
                  backupsList.map((b: any, idx: number) => {
                    const backupId = typeof b === 'string' ? b : b?.id || `backup-${idx}`;
                    const rawTs = typeof b === 'object' ? b?.timestamp : null;
                    const displayDate = rawTs ? new Date(rawTs).toLocaleString('fr-FR') : backupId;
                    const displayUser =
                      typeof b === 'object' ? b?.userId || b?.reason || 'Système' : 'Système';
                    return (
                      <tr key={`${backupId}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-3.5 py-2.5 whitespace-nowrap font-mono text-[11px]">
                          {displayDate}
                        </td>
                        <td className="px-3.5 py-2.5 truncate max-w-[180px]">{displayUser}</td>
                        <td className="px-3.5 py-2.5 text-right flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleExportBackup(backupId)}
                            className="p-1.5 text-sky-700 hover:bg-sky-50 rounded-lg transition-colors cursor-pointer"
                            title="Exporter en JSON"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleRestoreBackup(backupId)}
                            className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                            title="Restaurer cette version"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </SettingsSectionCard>
        </div>
      )}

      {/* SUBTAB 4: DATA INTEGRITY & TWIN EXCEL FORMULAS */}
      {auditSubTab === 'integrity' && (
        <div className="space-y-4">
          <SettingsSectionCard
            title="Diagnostic d'Intégrité des Données & Formules Jumelles"
            description="Vérifie la concordance mathématique (Stock Actuel = Initial + Entrées - Sorties), l'absence de valeurs négatives et l'empreinte Checksum."
            icon={<ShieldCheck className="w-4 h-4" />}
            headerRight={
              <div className="flex items-center gap-2">
                <button
                  onClick={runIntegrityCheck}
                  disabled={checkingIntegrity}
                  className={SETTINGS_BUTTON_STYLES.primary}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${checkingIntegrity ? 'animate-spin' : ''}`} />
                  <span>{checkingIntegrity ? 'Vérification...' : "Lancer l'Audit"}</span>
                </button>
                <button
                  onClick={handleRepairData}
                  className={SETTINGS_BUTTON_STYLES.secondary}
                >
                  <Zap className="w-3.5 h-3.5 text-amber-600" />
                  <span>Réparer Auto</span>
                </button>
              </div>
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200">
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
              <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200">
                <div className="text-[11px] font-mono text-slate-500">Articles Contrôlés</div>
                <div className="text-base font-black text-slate-900 mt-1 font-mono">
                  {rawStock.length} articles
                </div>
              </div>
              <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200">
                <div className="text-[11px] font-mono text-slate-500">Mouvements Audités</div>
                <div className="text-base font-black text-slate-900 mt-1 font-mono">
                  {mouvements.length} lignes
                </div>
              </div>
              <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200">
                <div className="text-[11px] font-mono text-slate-500">Empreinte Checksum</div>
                <div
                  className="text-xs font-mono font-bold text-slate-700 mt-1 truncate"
                  title={currentChecksum}
                >
                  0x{currentChecksum || 'N/A'}
                </div>
              </div>
            </div>
          </SettingsSectionCard>

          {/* Bulk Orphan Cleanup Panel */}
          <SettingsSectionCard
            title="Gestion des Liaisons Orphelines (Intégrité Relationnelle)"
            description="Détection et nettoyage des tâches ou interventions pointant vers des machines supprimées ou archivées."
            icon={<ShieldAlert className="w-4 h-4" />}
            headerRight={
              <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200">
                {preventiveOrphans.length + correctiveOrphans.length + systemGeneralBomLeaks.length}{' '}
                Anomalie(s) relationnelle(s)
              </span>
            }
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Preventive Orphans */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">Tâches Préventives</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold border ${
                        preventiveOrphans.length > 0
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-200'
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
                    className={SETTINGS_BUTTON_STYLES.danger}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Purger Préventif</span>
                  </button>
                  <button
                    onClick={() => handleBulkRelink?.('preventive')}
                    disabled={preventiveOrphans.length === 0}
                    className={SETTINGS_BUTTON_STYLES.primary}
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
                      Interventions Correctives &amp; BTs
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold border ${
                        correctiveOrphans.length > 0
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-200'
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
                    className={SETTINGS_BUTTON_STYLES.danger}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Purger Correctif</span>
                  </button>
                  <button
                    onClick={() => handleBulkRelink?.('corrective')}
                    disabled={correctiveOrphans.length === 0}
                    className={SETTINGS_BUTTON_STYLES.primary}
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    <span>Relier en Masse</span>
                  </button>
                </div>
              </div>

              {/* Système Général BOM Immunity */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">
                      Immunité BOM · Système Général
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold border ${
                        systemGeneralBomLeaks.length > 0
                          ? 'bg-rose-50 text-rose-800 border-rose-200'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      }`}
                    >
                      {systemGeneralBomLeaks.length} fuite(s) BOM
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1">
                    Détecte si des organes BOM de production (machineElementsLedger) sont rattachés par erreur à un équipement Système Général.
                  </p>
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                  <button
                    onClick={handlePurgeSystemGeneralBomLeaks}
                    disabled={systemGeneralBomLeaks.length === 0}
                    className={SETTINGS_BUTTON_STYLES.danger}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Détacher Organes BOM</span>
                  </button>
                </div>
              </div>
            </div>
          </SettingsSectionCard>

          {/* Audit Results Table */}
          <SettingsSectionCard
            title={`Rapport d'Audit Détaillé (${integrityReport?.overall?.totalErrors || 0} Erreurs, ${
              integrityReport?.overall?.totalWarnings || 0
            } Avertissements)`}
            description="Détail des écarts mathématiques ou référentiels identifiés."
            icon={<CheckCircle2 className="w-4 h-4" />}
            headerRight={
              <span className="text-[10px] font-mono text-slate-400">
                Horodatage:{' '}
                {integrityReport?.timestamp
                  ? new Date(integrityReport.timestamp).toLocaleTimeString()
                  : 'En attente'}
              </span>
            }
            bodyClassName="p-0"
          >
            {!integrityReport ||
            (integrityReport.overall.totalErrors === 0 &&
              integrityReport.overall.totalWarnings === 0) ? (
              <div className="p-6 text-center text-xs text-slate-500 space-y-1">
                <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto" />
                <div className="font-bold text-slate-800 mt-1.5">Aucune anomalie détectée</div>
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
          </SettingsSectionCard>
        </div>
      )}

      {/* SUBTAB 5: PERFORMANCE MONITOR & OFFLINE SYNC QUEUE */}
      {auditSubTab === 'performance' && (
        <div className="space-y-4">
          <SettingsSectionCard
            title="Moniteur de Performance & File d'Attente Offline"
            description="Suivi des temps d'exécution, consommation mémoire JS Heap et état des opérations en attente de synchronisation."
            icon={<Gauge className="w-4 h-4" />}
            headerRight={
              <div className="flex items-center gap-2">
                <button
                  onClick={runPerformanceBenchmark}
                  className={SETTINGS_BUTTON_STYLES.primary}
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Tester le Recalcul</span>
                </button>
                <button
                  onClick={() => performanceService.exportReport()}
                  className={SETTINGS_BUTTON_STYLES.secondary}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Exporter CSV</span>
                </button>
              </div>
            }
          >
            <div className="space-y-4">
              <SyncButtons showToast={showToast} />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200">
                  <div className="text-[11px] font-mono text-slate-500">Consommation Mémoire Heap</div>
                  <div className="text-lg font-black text-slate-900 mt-1 font-mono">
                    {perfStats?.heapMB ? `${perfStats.heapMB.toFixed(1)} Mo` : 'Non disponible'}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">Estimée via performance.memory</div>
                </div>

                <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-300">
                  <div className="text-[11px] font-mono text-slate-500">Recalcul Twin (Moyenne)</div>
                  <div className="text-lg font-black text-sky-700 mt-1 font-mono">
                    {perfStats?.recalcStats?.avg ? `${perfStats.recalcStats.avg} ms` : 'À tester'}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    Min: {perfStats?.recalcStats?.min ?? 'N/A'}ms • Max: {perfStats?.recalcStats?.max ?? 'N/A'}ms
                  </div>
                </div>

                <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200">
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
            </div>
          </SettingsSectionCard>

          <SettingsSectionCard
            title="Gestionnaire de File d'Attente de Synchronisation"
            description="Le service SyncQueueService enregistre toute transaction d'écriture en mode hors-ligne dans IndexedDB avec priorité d'exécution et tentatives automatiques (jusqu'à 3 essais) dès que le réseau est réactivé."
            icon={<Wifi className="w-4 h-4" />}
            headerRight={
              <div className="flex items-center gap-2">
                <button
                  onClick={() => syncQueueService.processQueue()}
                  className={SETTINGS_BUTTON_STYLES.secondary}
                >
                  Rejouer la file
                </button>
                <button
                  onClick={async () => {
                    const ok = await confirmAction({
                      title: "Vider la file d'attente de synchronisation",
                      message:
                        'Êtes-vous sûr de vouloir supprimer les opérations hors-ligne en attente dans IndexedDB ?',
                      confirmText: 'Vider la file',
                      variant: 'danger',
                    });
                    if (ok) syncQueueService.clearQueue();
                  }}
                  className={SETTINGS_BUTTON_STYLES.dangerSoft}
                >
                  Vider la file
                </button>
              </div>
            }
          >
            <div className="text-xs text-slate-600 bg-slate-50 px-3.5 py-2.5 rounded-xl border border-slate-200/80">
              État actuel :{' '}
              <b className="font-mono text-slate-800">
                {syncQueueState?.pendingCount || 0} opération(s) en attente
              </b>{' '}
              •{' '}
              <b className="font-mono text-slate-800">
                {syncQueueState?.failedCount || 0} échec(s)
              </b>
            </div>
          </SettingsSectionCard>
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
