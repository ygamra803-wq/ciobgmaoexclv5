import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Database,
  HardDrive,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import {
  serverSyncService,
  type ServerDatabaseBackupResult,
  type ServerDatabaseInfo,
} from '../../../../services/serverSyncService';
import { SETTINGS_BUTTON_STYLES, SettingsSectionCard } from './settingsUi';

interface SqliteHostDatabaseCardProps {
  showToast?: (message: string, type?: string) => void;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 o';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`;
}

/**
 * Displays live Single-File SQLite Host database diagnostics (`ciob_gmao.db`)
 * and provides one-click online ACID hot backups (`VACUUM INTO`) for ADMIN / RESPONSABLE_MAINTENANCE.
 */
export default function SqliteHostDatabaseCard({ showToast }: SqliteHostDatabaseCardProps) {
  const [dbInfo, setDbInfo] = useState<ServerDatabaseInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastBackup, setLastBackup] = useState<ServerDatabaseBackupResult | null>(null);

  const loadDbInfo = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    const res = await serverSyncService.fetchDatabaseInfo();
    if (res.success && res.data) {
      setDbInfo(res.data);
    } else {
      setDbInfo(null);
      setErrorMessage(res.message || 'Diagnostic SQLite indisponible.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadDbInfo();
  }, [loadDbInfo]);

  const handleInstantBackup = async () => {
    setBackingUp(true);
    const res = await serverSyncService.triggerDatabaseBackup();
    setBackingUp(false);
    if (res.success && res.data) {
      setLastBackup(res.data);
      showToast?.(
        `Sauvegarde SQLite créée : ${res.data.fileName} (${formatBytes(res.data.sizeBytes)})`,
        'success'
      );
      void loadDbInfo();
    } else {
      showToast?.(res.message || 'Échec de la sauvegarde SQLite.', 'error');
    }
  };

  const handleCopyPath = async () => {
    if (!dbInfo?.dbFile) return;
    try {
      await navigator.clipboard.writeText(dbInfo.dbFile);
      showToast?.('Chemin du fichier SQLite copié.', 'info');
    } catch {
      showToast?.('Copie manuelle requise dans ce navigateur.', 'warning');
    }
  };

  return (
    <SettingsSectionCard
      title="Base de Données Locale SQLite (Fichier Unique ACID)"
      description="Stockage souverain sur le poste hôte Windows / LAN sans serveur cloud externe, avec snapshots cohérents à chaud (VACUUM INTO)."
      icon={<HardDrive className="w-4 h-4" />}
      headerRight={
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleInstantBackup}
            disabled={backingUp || !dbInfo || dbInfo.engine !== 'sqlite'}
            className={SETTINGS_BUTTON_STYLES.primary}
          >
            <Database className={`w-3.5 h-3.5 ${backingUp ? 'animate-pulse' : ''}`} />
            <span>{backingUp ? 'Sauvegarde en cours...' : 'Sauvegarde Instantanée (.db)'}</span>
          </button>
          <button
            type="button"
            onClick={loadDbInfo}
            disabled={loading}
            className={SETTINGS_BUTTON_STYLES.secondary}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Actualiser</span>
          </button>
        </div>
      }
    >
      {dbInfo ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200">
              <div className="text-[11px] font-mono text-slate-500">Moteur &amp; Journal</div>
              <div className="text-sm font-black text-emerald-700 mt-1 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>
                  {dbInfo.engine.toUpperCase()} · {dbInfo.journalMode}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                Schéma v{dbInfo.schemaVersion} · État v{dbInfo.version}
              </div>
            </div>

            <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200">
              <div className="text-[11px] font-mono text-slate-500">Taille Fichier (.db)</div>
              <div className="text-sm font-black text-slate-900 mt-1 font-mono">
                {formatBytes(dbInfo.sizeBytes)}
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                WAL actif : {formatBytes(dbInfo.walSizeBytes)}
              </div>
            </div>

            <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200">
              <div className="text-[11px] font-mono text-slate-500">Entités &amp; Audit SQL</div>
              <div className="text-sm font-black text-slate-900 mt-1 font-mono">
                {dbInfo.entityCount} tables · {dbInfo.auditCount} audits
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                MAJ : {dbInfo.updatedAt ? new Date(dbInfo.updatedAt).toLocaleString('fr-FR') : '—'}
              </div>
            </div>

            <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200">
              <div className="text-[11px] font-mono text-slate-500">Snapshots Conservés</div>
              <div className="text-sm font-black text-sky-800 mt-1 font-mono">
                {dbInfo.backupsCount} fichier(s) .db
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                Dossier local <span className="font-mono">backups/</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 text-xs">
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-bold uppercase text-slate-500 mr-2">
                Chemin actif :
              </span>
              <span className="font-mono text-slate-800 break-all" title={dbInfo.dbFile}>
                {dbInfo.dbFile}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopyPath}
              className="px-2 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 text-[11px] font-semibold inline-flex items-center gap-1 shrink-0 cursor-pointer"
              title="Copier le chemin"
            >
              <Copy className="w-3 h-3" />
              <span>Copier</span>
            </button>
          </div>

          {dbInfo.isNetworkPath && (
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                Chemin réseau UNC/SMB détecté : le mode <span className="font-mono font-bold">DELETE</span> est actif par sécurité. Pour 2 à 4 PC en Wi-Fi, hébergez <span className="font-mono">ciob_gmao.db</span> sur le disque local du PC Hôte et connectez les autres postes via HTTP LAN.
              </span>
            </div>
          )}

          {lastBackup && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-mono break-all">
                Dernier snapshot : {lastBackup.fileName} ({formatBytes(lastBackup.sizeBytes)} · v
                {lastBackup.version})
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between gap-3">
          <span>
            {loading
              ? 'Chargement du statut SQLite du poste hôte...'
              : errorMessage ||
                'Connectez-vous avec une session serveur Administrateur ou Responsable Maintenance pour consulter et sauvegarder ciob_gmao.db.'}
          </span>
        </div>
      )}
    </SettingsSectionCard>
  );
}
