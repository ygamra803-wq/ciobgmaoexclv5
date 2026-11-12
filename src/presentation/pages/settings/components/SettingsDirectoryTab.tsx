import { useState, useEffect, useMemo } from 'react';
import {
  FolderSync,
  CheckCircle2,
  Zap,
  Save,
  Wifi,
  Server,
  Smartphone,
  QrCode,
  Copy,
  RefreshCw,
  Radio,
  Globe,
  Link2,
} from 'lucide-react';
import SyncButtons from '../../../components/common/SyncButtons';
import {
  networkConfigService,
  type HostNetworkInfo,
  type LanNodeMode,
} from '../../../../services/networkConfigService';
import { SettingsSectionCard, SETTINGS_BUTTON_STYLES } from './settingsUi';

/**
 * Shared Network Folder, Auto-Write Mirroring, LAN Host / Client Mode & Polling Interval Configuration.
 */
export default function SettingsDirectoryTab({
  linkedFileName,
  sharedFolderPath,
  setSharedFolderPath,
  autoWriteExcel,
  setAutoWriteExcel,
  pollingInterval,
  setPollingInterval,
  onDirectLink,
  handleSaveSettings,
  showToast,
}: any) {
  const [nodeMode, setNodeModeState] = useState<LanNodeMode>(() =>
    networkConfigService.getNodeMode()
  );
  const [remoteHostInput, setRemoteHostInput] = useState<string>(() =>
    networkConfigService.getRemoteHostUrl()
  );
  const [customIpInput, setCustomIpInput] = useState<string>(() =>
    networkConfigService.getCustomHostIp()
  );
  const [hostInfo, setHostInfo] = useState<HostNetworkInfo | null>(null);
  const [loadingNetInfo, setLoadingNetInfo] = useState(false);
  const [sseConnected, setSseConnected] = useState(false);
  const [qrTargetMode, setQrTargetMode] = useState<'mobile' | 'desktop'>('mobile');

  const refreshHostInfo = async () => {
    setLoadingNetInfo(true);
    try {
      const info = await networkConfigService.fetchHostNetworkInfo();
      if (info) {
        setHostInfo(info);
      }
    } finally {
      setLoadingNetInfo(false);
    }
  };

  useEffect(() => {
    refreshHostInfo();
    const unsub = networkConfigService.subscribeToServerEvents({
      onConnected: () => setSseConnected(true),
      onStateUpdated: (payload) => {
        setSseConnected(true);
        setHostInfo((prev) =>
          prev
            ? {
                ...prev,
                version: payload.version,
                updatedAt: payload.updatedAt,
              }
            : prev
        );
      },
      onError: () => setSseConnected(false),
    });
    return () => unsub();
  }, []);

  const effectiveLanIp = useMemo(() => {
    if (customIpInput.trim()) return customIpInput.trim();
    if (hostInfo?.primaryIp && hostInfo.primaryIp !== '127.0.0.1') return hostInfo.primaryIp;
    if (typeof window !== 'undefined' && window.location?.hostname) {
      return window.location.hostname;
    }
    return '192.168.1.100';
  }, [customIpInput, hostInfo]);

  const effectivePort = useMemo(() => {
    if (hostInfo?.port) return hostInfo.port;
    if (typeof window !== 'undefined' && window.location?.port) {
      return Number(window.location.port) || 3000;
    }
    return 3000;
  }, [hostInfo]);

  const desktopLanUrl = `http://${effectiveLanIp}:${effectivePort}`;
  const mobileLanUrl = `http://${effectiveLanIp}:${effectivePort}/#mobile`;
  const activeQrUrl = qrTargetMode === 'mobile' ? mobileLanUrl : desktopLanUrl;

  const qrMatrix = useMemo(
    () => networkConfigService.generateDeterministicQrMatrix(activeQrUrl),
    [activeQrUrl]
  );

  const handleSwitchNodeMode = (mode: LanNodeMode) => {
    networkConfigService.setNodeMode(mode);
    setNodeModeState(mode);
    showToast?.(
      mode === 'HOST'
        ? 'Mode Poste Hôte Principal (Serveur Usine) activé'
        : 'Mode Poste Client LAN (Connexion à un hôte distant) activé',
      'info'
    );
  };

  const handleSaveLanClientUrl = () => {
    const normalized = networkConfigService.setRemoteHostUrl(remoteHostInput);
    setRemoteHostInput(normalized);
    refreshHostInfo();
    showToast?.(
      normalized
        ? `Serveur Hôte LAN configuré sur : ${normalized}`
        : 'URL Hôte LAN réinitialisée (Serveur local utilisé)',
      'success'
    );
  };

  const handleSaveCustomIp = (val: string) => {
    setCustomIpInput(val);
    networkConfigService.setCustomHostIp(val);
  };

  const handleCopyUrl = async (url: string, label: string) => {
    try {
      await navigator.clipboard.writeText(url);
      showToast?.(`Lien ${label} copié : ${url}`, 'success');
    } catch {
      showToast?.(`Lien ${label} : ${url}`, 'info');
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Explicit Server Sync Card (gmao_state.json) */}
      <SyncButtons showToast={showToast} />

      {/* 2. Multi-Station LAN & Mobile Field Architecture (Light Industrial Card) */}
      <SettingsSectionCard
        title="Architecture Multi-Postes LAN & Terminaux Mobiles (Wi-Fi Usine)"
        description="Connectez les tablettes/smartphones des techniciens et les PC secondaires au serveur hôte de l'usine sur le réseau local, sans cloud externe."
        icon={<Server className="w-4 h-4" />}
        headerRight={
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                sseConnected
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              <Radio className={`w-3.5 h-3.5 ${sseConnected ? 'text-emerald-600' : 'text-amber-600'}`} />
              {sseConnected ? 'Flux Temps Réel SSE Actif' : 'Mode Polling Standard'}
            </span>
            <button
              type="button"
              onClick={refreshHostInfo}
              disabled={loadingNetInfo}
              className={SETTINGS_BUTTON_STYLES.secondary}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingNetInfo ? 'animate-spin' : ''}`} />
              <span>Actualiser Réseau</span>
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Node Role Switcher & IP Configuration */}
          <div className="lg:col-span-7 space-y-4">
            {/* Role Selector: HOST vs LAN_CLIENT */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleSwitchNodeMode('HOST')}
                className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex items-start gap-3 ${
                  nodeMode === 'HOST'
                    ? 'bg-indigo-50/90 border-indigo-600 text-slate-900 ring-1 ring-indigo-600/15'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div
                  className={`p-2 rounded-lg shrink-0 ${
                    nodeMode === 'HOST'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <Server className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    <span>Poste Hôte Principal (Serveur)</span>
                    {nodeMode === 'HOST' && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                    Ce PC héberge la base <code className="font-mono">gmao_state.json</code> et le miroir Excel pour l&apos;usine.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleSwitchNodeMode('LAN_CLIENT')}
                className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex items-start gap-3 ${
                  nodeMode === 'LAN_CLIENT'
                    ? 'bg-indigo-50/90 border-indigo-600 text-slate-900 ring-1 ring-indigo-600/15'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div
                  className={`p-2 rounded-lg shrink-0 ${
                    nodeMode === 'LAN_CLIENT'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    <span>Poste Client / Terminal LAN</span>
                    {nodeMode === 'LAN_CLIENT' && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                    Se connecte à l&apos;adresse IP d&apos;un Poste Hôte distant sur le réseau Wi-Fi/Ethernet.
                  </p>
                </div>
              </button>
            </div>

            {/* Detected Network Interfaces & URLs */}
            {nodeMode === 'HOST' ? (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Wifi className="w-4 h-4 text-emerald-600" />
                    <span>Interfaces Réseau IPv4 Détectées sur l&apos;Hôte</span>
                  </div>
                  {hostInfo?.hostname && (
                    <span className="text-[11px] font-mono text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                      Machine : {hostInfo.hostname} (v{hostInfo.version || 1})
                    </span>
                  )}
                </div>

                {hostInfo?.interfaces && hostInfo.interfaces.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {hostInfo.interfaces.map((iface) => (
                      <button
                        key={`${iface.name}-${iface.address}`}
                        type="button"
                        onClick={() => handleSaveCustomIp(iface.address)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-mono border transition cursor-pointer flex items-center gap-1.5 ${
                          effectiveLanIp === iface.address
                            ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-bold'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span>{iface.name}:</span>
                        <b>{iface.address}</b>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-600">
                    Saisissez ci-dessous l&apos;adresse IPv4 locale du PC Hôte (ex:{' '}
                    <code className="font-mono text-indigo-700 font-semibold">192.168.1.50</code> via{' '}
                    <code className="font-mono">ipconfig</code>) pour générer les liens et le QR Code des techniciens.
                  </p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      IP LAN Hôte (Auto ou Manuelle)
                    </label>
                    <input
                      type="text"
                      value={customIpInput}
                      onChange={(e) => handleSaveCustomIp(e.target.value)}
                      placeholder={hostInfo?.primaryIp || 'Ex: 192.168.1.50'}
                      className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-xs font-mono text-slate-900 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Lien Direct Mobile Terrain (QR)
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        readOnly
                        value={mobileLanUrl}
                        className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs font-mono text-indigo-700 font-semibold select-all"
                      />
                      <button
                        type="button"
                        onClick={() => handleCopyUrl(mobileLanUrl, 'Mobile Terrain')}
                        className="p-2 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition cursor-pointer shrink-0"
                        title="Copier le lien Mobile"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-indigo-600" />
                  <span>Connexion au Serveur Hôte Distant (LAN)</span>
                </div>
                <p className="text-[11px] text-slate-600">
                  Indiquez l&apos;adresse IP et le port du PC Principal de l&apos;usine (ex:{' '}
                  <code className="font-mono text-indigo-700 font-semibold">
                    http://192.168.1.50:3000
                  </code>
                  ). Toutes les synchronisations pointeront vers cet hôte.
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={remoteHostInput}
                    onChange={(e) => setRemoteHostInput(e.target.value)}
                    placeholder="http://192.168.1.50:3000"
                    className="flex-1 px-3.5 py-2 rounded-lg bg-white border border-slate-300 text-xs font-mono text-slate-900 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                  />
                  <button
                    type="button"
                    onClick={handleSaveLanClientUrl}
                    className={SETTINGS_BUTTON_STYLES.primary}
                  >
                    Connecter à l&apos;Hôte
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Offline SVG QR Code Generator for Field Technicians */}
          <div className="lg:col-span-5 bg-slate-50 rounded-xl p-4 border border-slate-200 flex flex-col sm:flex-row items-center gap-4">
            <div className="bg-white p-3 rounded-xl shadow-2xs border border-slate-200 shrink-0">
              <svg
                viewBox={`0 0 ${qrMatrix.length} ${qrMatrix.length}`}
                className="w-28 h-28"
                shapeRendering="crispEdges"
                role="img"
                aria-label={`QR Code LAN ${activeQrUrl}`}
              >
                {qrMatrix.map((row, rIdx) =>
                  row.map((cell, cIdx) =>
                    cell ? (
                      <rect
                        key={`${rIdx}-${cIdx}`}
                        x={cIdx}
                        y={rIdx}
                        width={1}
                        height={1}
                        fill="#0f172a"
                      />
                    ) : null
                  )
                )}
              </svg>
            </div>

            <div className="space-y-2.5 text-center sm:text-left min-w-0 flex-1">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700">
                <QrCode className="w-4 h-4" />
                <span>Accès Rapide Techniciens (Wi-Fi Local)</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Connectez le smartphone ou la tablette au Wi-Fi de l&apos;usine pour ouvrir directement l&apos;interface terrain <b className="text-slate-900">Mobile GMAO</b>.
              </p>

              <div className="flex items-center justify-center sm:justify-start gap-1.5">
                <button
                  type="button"
                  onClick={() => setQrTargetMode('mobile')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1 border ${
                    qrTargetMode === 'mobile'
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Smartphone className="w-3 h-3" />
                  <span>Vue Mobile (#mobile)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setQrTargetMode('desktop')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1 border ${
                    qrTargetMode === 'desktop'
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Server className="w-3 h-3" />
                  <span>Vue PC Complète</span>
                </button>
              </div>

              <div className="text-[11px] font-mono text-indigo-700 font-semibold truncate bg-white px-2.5 py-1.5 rounded-lg border border-slate-200">
                {activeQrUrl}
              </div>
            </div>
          </div>
        </div>
      </SettingsSectionCard>

      {/* 3. Shared Folder & Excel Mirror File Binding */}
      <SettingsSectionCard
        title="Liaison du Fichier Miroir Excel (.xlsx) & Synchronisation"
        description="Associez un fichier Excel local via l'API File System du navigateur ou définissez la cadence de rafraîchissement multi-postes."
        icon={<FolderSync className="w-4 h-4" />}
        headerRight={
          linkedFileName ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Fichier lié : <span className="font-mono">{linkedFileName}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
              Aucun fichier local lié en direct
            </span>
          )
        }
        footer={
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="text-[11px] text-slate-500">
              Note : Pour des raisons de sécurité navigateur (Sandbox), l&apos;écriture directe sur disque utilise le bouton <b>Lier Fichier Local (.xlsx)</b> ou le serveur LAN Hôte.
            </span>
            <button
              type="button"
              onClick={handleSaveSettings}
              className={SETTINGS_BUTTON_STYLES.primary}
            >
              <Save className="w-4 h-4" />
              <span>Enregistrer la Configuration</span>
            </button>
          </div>
        }
      >
        <div className="max-w-3xl space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Référence du Dossier Partagé Usine (Indicatif / Documentation Équipe)
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="Ex: \\SERVEUR-USINE\GMAO_Partage\ ou Z:\Maintenance_2026\"
                value={sharedFolderPath}
                onChange={(e) => setSharedFolderPath(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-indigo-600 focus:bg-white transition"
              />
              {onDirectLink && (
                <button
                  type="button"
                  onClick={onDirectLink}
                  className={SETTINGS_BUTTON_STYLES.secondary}
                >
                  <Link2 className="w-4 h-4 text-indigo-600" />
                  <span>
                    {linkedFileName
                      ? `Changer (${linkedFileName})`
                      : 'Lier Fichier Local (.xlsx)'}
                  </span>
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">
              Cliquez sur <b>Lier Fichier Local (.xlsx)</b> pour accorder au navigateur l&apos;accès direct en lecture/écriture au classeur Excel sur ce poste.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-xs font-bold text-slate-800">
                  Écriture Miroir Excel Automatique
                </span>
                <input
                  type="checkbox"
                  checked={autoWriteExcel}
                  onChange={(e) => setAutoWriteExcel(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                />
              </label>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Met à jour automatiquement le fichier Excel lié (<code className="font-mono">.xlsx</code>) et le miroir serveur après chaque mouvement ou intervention.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  Fréquence de Synchronisation LAN
                </span>
                <select
                  value={pollingInterval}
                  onChange={(e) => setPollingInterval(e.target.value)}
                  className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-600"
                >
                  <option value="5s">Temps Réel (5 sec)</option>
                  <option value="10s">Rapide (10 sec)</option>
                  <option value="30s">Standard (30 sec)</option>
                  <option value="off">Manuel uniquement</option>
                </select>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Vérifie périodiquement si un autre poste a mis à jour l&apos;état partagé sur le serveur LAN.
              </p>
            </div>
          </div>
        </div>
      </SettingsSectionCard>
    </div>
  );
}
