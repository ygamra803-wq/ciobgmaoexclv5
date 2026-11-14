import { useState, useEffect } from 'react';
import {
  HardDrive,
  Database,
  CheckCircle2,
  ShieldAlert,
  Lock,
  Sparkles,
  Layers,
  Wrench,
  MapPin,
  Users,
  Calendar,
  FileSpreadsheet,
  Download,
} from 'lucide-react';
import { indexedDBService } from '../../../../utils/indexedDBService';
import { AutoBackupService } from '../../../../core/backup/AutoBackupService';
import { SettingsSectionCard, SETTINGS_BUTTON_STYLES } from './settingsUi';

const STORAGE_CEILING_KEY = 'gmao_storage_ceiling_mb';

/**
 * Overview Tab — Storage Quota (L1 localStorage & L2 IndexedDB), Data Volume Counters, and Excel Twin Export.
 */
export default function SettingsOverviewTab({
  storageUsage,
  localStorageSizeKB,
  rawStockCount,
  rawStock,
  mouvementsCount,
  mouvements,
  machinesCount,
  machines,
  zonesCount,
  zones,
  techniciansCount,
  technicians,
  preventiveCount,
  preventiveTasks,
  onDownloadBlankTemplate,
  onExportExcel,
  onOpenBackupManager,
  showToast,
}: any) {
  const effectiveStorageKb = Number(storageUsage?.kb ?? localStorageSizeKB ?? 0);
  const effectiveRawStockCount = rawStockCount ?? (Array.isArray(rawStock) ? rawStock.length : 0);
  const effectiveMouvementsCount =
    mouvementsCount ?? (Array.isArray(mouvements) ? mouvements.length : 0);
  const effectiveMachinesCount = machinesCount ?? (Array.isArray(machines) ? machines.length : 0);
  const effectiveZonesCount = zonesCount ?? (Array.isArray(zones) ? zones.length : 0);
  const effectiveTechniciansCount =
    techniciansCount ?? (Array.isArray(technicians) ? technicians.length : 0);
  const effectivePreventiveCount =
    preventiveCount ?? (Array.isArray(preventiveTasks) ? preventiveTasks.length : 0);

  const [ceilingMB, setCeilingMB] = useState(() => {
    const saved = localStorage.getItem(STORAGE_CEILING_KEY);
    return saved ? Number(saved) : 1024;
  });

  const [idbInfo, setIdbInfo] = useState({
    activeTier: 'IndexedDB',
    usageMB: 0,
    quotaMB: 2048,
    usagePercent: 0,
    isPersisted: false,
  });

  const [requestingPersist, setRequestingPersist] = useState(false);

  useEffect(() => {
    let mounted = true;
    const loadIdbStats = async () => {
      try {
        const info = await indexedDBService.getStorageInfo();
        let persisted = false;
        if (navigator.storage && navigator.storage.persisted) {
          persisted = await navigator.storage.persisted();
        }
        if (mounted) {
          setIdbInfo({ ...info, isPersisted: persisted });
        }
      } catch {
        // Ignore fallback
      }
    };
    loadIdbStats();
    return () => {
      mounted = false;
    };
  }, [effectiveRawStockCount, effectiveMouvementsCount]);

  const handleCeilingChange = async (newCeiling: number) => {
    setCeilingMB(newCeiling);
    localStorage.setItem(STORAGE_CEILING_KEY, String(newCeiling));
    setRequestingPersist(true);
    try {
      const granted = await indexedDBService.requestPersistentStorage();
      setIdbInfo((prev) => ({ ...prev, isPersisted: granted }));
      if (showToast) {
        showToast(
          `Capacité cible configurée à ${newCeiling >= 1024 ? `${newCeiling / 1024} Go` : `${newCeiling} Mo`} (IndexedDB L2 Actif)`,
          'success'
        );
      }
    } finally {
      setRequestingPersist(false);
    }
  };

  const l1MB = Number((effectiveStorageKb / 1024).toFixed(2));
  const totalUsedMB = Number(Math.max(l1MB, idbInfo.usageMB || l1MB).toFixed(2));
  const effectiveQuotaMB = ceilingMB;
  const effectivePercent = Math.min(100, Number(((totalUsedMB / effectiveQuotaMB) * 100).toFixed(2)));

  const metricTiles = [
    { label: 'Articles PDR', count: effectiveRawStockCount, icon: Database },
    { label: 'Mouvements', count: effectiveMouvementsCount, icon: Layers },
    { label: 'Machines', count: effectiveMachinesCount, icon: Wrench },
    { label: 'Zones', count: effectiveZonesCount, icon: MapPin },
    { label: 'Intervenants', count: effectiveTechniciansCount, icon: Users },
    { label: 'Tâches Prév.', count: effectivePreventiveCount, icon: Calendar },
  ];

  return (
    <div className="space-y-6">
      {/* 1. Storage Engine & Volume Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SettingsSectionCard
          title="Moteur de Stockage Hybride (L1 + L2 IndexedDB)"
          description="Allocation dynamique de la mémoire locale et protection contre l'éviction navigateur."
          icon={<HardDrive />}
          headerRight={
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80">
              <Sparkles className="w-3 h-3" />
              Capacité Étendue ({ceilingMB >= 1024 ? `${ceilingMB / 1024} Go` : `${ceilingMB} Mo`})
            </span>
          }
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-600">
                  Volume Utilisé :{' '}
                  <b className="font-mono text-slate-900">{effectiveStorageKb} KB</b> ({totalUsedMB}{' '}
                  MB)
                </span>
                <span
                  className={`font-mono ${
                    effectivePercent > 80 ? 'text-rose-600' : 'text-sky-800'
                  }`}
                >
                  {effectivePercent}% sur{' '}
                  {ceilingMB >= 1024 ? `${ceilingMB / 1024} Go` : `${ceilingMB} Mo`}
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200/80">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    effectivePercent > 80
                      ? 'bg-rose-500'
                      : effectivePercent > 50
                        ? 'bg-amber-500'
                        : 'bg-sky-700'
                  }`}
                  style={{ width: `${Math.max(2, Math.min(100, effectivePercent))}%` }}
                />
              </div>
            </div>

            {/* Tier Selector */}
            <div className="bg-slate-50/70 rounded-2xl p-3.5 border border-slate-200/80 space-y-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Plafond d&apos;Allocation Stockage (IndexedDB L2)
                </span>
                {idbInfo.isPersisted ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    <Lock className="w-2.5 h-2.5" /> Stockage Persistant Verrouillé
                  </span>
                ) : (
                  <span className="text-[10px] font-mono text-slate-500">
                    Quota Navigateur :{' '}
                    {idbInfo.quotaMB > 0 ? `${Math.round(idbInfo.quotaMB)} Mo dispo` : 'Auto'}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: '50 Mo', val: 50 },
                  { label: '250 Mo', val: 250 },
                  { label: '1 Go', val: 1024 },
                  { label: '2 Go (Max)', val: 2048 },
                ].map((tier) => (
                  <button
                    key={tier.val}
                    type="button"
                    disabled={requestingPersist}
                    onClick={() => handleCeilingChange(tier.val)}
                    className={`py-2 px-2.5 rounded-xl text-xs font-semibold transition-all duration-150 border cursor-pointer ${
                      ceilingMB === tier.val
                        ? 'bg-white text-slate-950 border-sky-700/75 ring-1 ring-sky-700/15 shadow-[0_1px_3px_rgba(15,23,42,0.08)]'
                        : 'bg-white/70 text-slate-600 border-slate-200/90 hover:bg-white hover:border-slate-300 hover:text-slate-900'
                    }`}
                  >
                    {tier.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80">
                <div className="text-[11px] text-slate-500 font-medium">L1 Cache Rapide</div>
                <div className="text-sm font-bold text-slate-800 mt-1 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>localStorage ({effectiveStorageKb} KB)</span>
                </div>
              </div>
              <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80">
                <div className="text-[11px] text-slate-500 font-medium">L2 Base Massive</div>
                <div className="text-sm font-bold text-slate-800 mt-1 flex items-center gap-2">
                  <Database className="w-4 h-4 text-sky-700 shrink-0" />
                  <span>IndexedDB ({idbInfo.activeTier})</span>
                </div>
              </div>
            </div>
          </div>
        </SettingsSectionCard>

        <SettingsSectionCard
          title="Volumétrie des Référentiels & Données (SSOT)"
          description="Décompte en temps réel des enregistrements actifs stockés dans la base locale."
          icon={<Layers />}
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {metricTiles.map((tile) => {
              const TileIcon = tile.icon;
              return (
                <div
                  key={tile.label}
                  className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/80 hover:border-slate-300 hover:bg-white transition-all duration-150 flex items-center gap-3.5"
                >
                  <TileIcon className="w-5 h-5 text-sky-700 shrink-0" />
                  <div>
                    <div className="text-lg font-black text-slate-900 font-mono leading-none">
                      {tile.count}
                    </div>
                    <div className="text-[11px] text-slate-500 font-semibold mt-1">{tile.label}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </SettingsSectionCard>
      </div>

      {/* 2. A3 Operational Snapshot Banner (Quick JSON Backup & Restore) */}
      <SettingsSectionCard
        testId="a3-operational-snapshot-card"
        title="Sauvegarde Opérationnelle Instantanée (Snapshot JSON Complet)"
        description="Téléchargez une copie complète de toutes les tables de l'usine (Machines, Stock PDR, Mouvements, Bons de Travail, Préventif, Entrepôt) en un clic avant toute opération majeure."
        icon={<ShieldAlert />}
        headerRight={
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                const ok = AutoBackupService.exportFullBackupJSON();
                if (showToast) {
                  showToast(
                    ok
                      ? 'Snapshot JSON opérationnel téléchargé avec succès.'
                      : "Erreur lors de l'export du Snapshot JSON.",
                    ok ? 'success' : 'error'
                  );
                }
              }}
              className={SETTINGS_BUTTON_STYLES.primary}
            >
              <Download className="w-4 h-4" />
              <span>Exporter Snapshot JSON</span>
            </button>
            {onOpenBackupManager && (
              <button
                type="button"
                onClick={onOpenBackupManager}
                className={SETTINGS_BUTTON_STYLES.secondary}
              >
                <Database className="w-4 h-4 text-sky-700" />
                <span>Restaurer / Gérer Snapshots</span>
              </button>
            )}
          </div>
        }
      >
        <div className="text-xs text-slate-600 flex flex-wrap items-center justify-between gap-2 bg-slate-50/70 px-4 py-3 rounded-xl border border-slate-200/80">
          <span>
            Format d&apos;archive standardisé compatible avec la restauration locale et le serveur LAN.
          </span>
          <span className="font-mono text-[11px] text-slate-500">
            Inclut : Stock PDR • Entrepôt • Parc Machines • BT • Préventif
          </span>
        </div>
      </SettingsSectionCard>

      {/* 3. Twin Excel Workbook Exporter */}
      <SettingsSectionCard
        title="Générateur de Classeur Miroir Excel (.xlsx)"
        description="Exportez un classeur Excel structuré (15 feuilles reliées par formules natives) pour l'archivage externe ou l'audit comptable."
        icon={<FileSpreadsheet />}
        headerRight={
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={onDownloadBlankTemplate}
              className={SETTINGS_BUTTON_STYLES.secondary}
            >
              <FileSpreadsheet className="w-4 h-4 text-slate-500" />
              <span>Télécharger Modèle Vide</span>
            </button>

            <button
              type="button"
              onClick={onExportExcel}
              className={SETTINGS_BUTTON_STYLES.primary}
            >
              <Download className="w-4 h-4" />
              <span>Exporter Classeur Actuel (.xlsx)</span>
            </button>
          </div>
        }
      >
        <div className="text-xs text-slate-600 bg-slate-50/70 px-4 py-3 rounded-xl border border-slate-200/80">
          Note d&apos;architecture : Le fichier Excel est un miroir d&apos;import/export et de sauvegarde ; la source de vérité (SSOT) demeure la base transactionnelle de l&apos;application.
        </div>
      </SettingsSectionCard>
    </div>
  );
}
