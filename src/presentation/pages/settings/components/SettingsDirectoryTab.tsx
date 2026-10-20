import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FolderOpen,
  Wifi,
  Server,
  Smartphone,
  Laptop,
  QrCode,
  Copy,
  Check,
  RefreshCw,
  Radio,
} from 'lucide-react';
import SyncButtons from '../../../components/common/SyncButtons';
import {
  networkConfigService,
  type NetworkHostInfo,
  type NetworkNodeMode,
} from '../../../../services/networkConfigService';

/**
 * Shared Folder, Local Network Broadcast (Host vs LAN Client), QR Code Panel, and Polling Synchronization Settings.
 */
export default function SettingsDirectoryTab({
  sharedFolderPath,
  setSharedFolderPath,
  onDirectLink,
  autoWriteExcel,
  setAutoWriteExcel,
  pollingInterval,
  setPollingInterval,
  linkedFileHandle,
  linkedFileName,
  handleSaveSettings,
  showToast,
}: any) {
  const [nodeMode, setNodeMode] = useState<NetworkNodeMode>(() => networkConfigService.getNodeMode());
  const [hostInfo, setHostInfo] = useState<NetworkHostInfo | null>(null);
  const [loadingHostInfo, setLoadingHostInfo] = useState(false);
  const [customIpInput, setCustomIpInput] = useState(() => networkConfigService.getCustomHostIp());
  const [qrTarget, setQrTarget] = useState<'mobile' | 'desktop'>('mobile');
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const loadNetworkInfo = useCallback(async () => {
    setLoadingHostInfo(true);
    try {
      const info = await networkConfigService.fetchNetworkHostInfo();
      setHostInfo(info);
    } finally {
      setLoadingHostInfo(false);
    }
  }, []);

  useEffect(() => {
    loadNetworkInfo();
    const unsubscribe = networkConfigService.subscribeToRevisionStream((evt) => {
      setHostInfo((prev) =>
        prev
          ? {
              ...prev,
              online: true,
              version: evt.version,
              updatedAt: evt.updatedAt,
            }
          : prev
      );
    });
    return () => unsubscribe();
  }, [loadNetworkInfo]);

  const handleModeSwitch = (nextMode: NetworkNodeMode) => {
    setNodeMode(nextMode);
    networkConfigService.setNodeMode(nextMode);
    showToast?.(
      nextMode === 'HOST'
        ? 'Poste configuré en Mode Serveur Hôte Principal (Host Node).'
        : 'Poste configuré en Mode Terminal Client Atelier (LAN Client).',
      'info'
    );
  };

  const handleApplyCustomIp = () => {
    networkConfigService.setCustomHostIp(customIpInput);
    loadNetworkInfo();
    showToast?.(
      customIpInput.trim()
        ? `Adresse IP Hôte personnalisée appliquée : ${customIpInput.trim()}`
        : 'Détection automatique IPv4 LAN réactivée.',
      'success'
    );
  };

  const activeQrUrl = useMemo(() => {
    if (!hostInfo) return 'http://127.0.0.1:3000/#mobile';
    return qrTarget === 'mobile' ? hostInfo.urls.mobile : hostInfo.urls.desktop;
  }, [hostInfo, qrTarget]);

  const qrMatrix = useMemo(() => {
    return networkConfigService.generateQrMatrix(activeQrUrl);
  }, [activeQrUrl]);

  const handleCopyUrl = (url: string, label: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).catch(() => {});
    }
    setCopiedUrl(url);
    showToast?.(`Lien ${label} copié : ${url}`, 'success');
    setTimeout(() => {
      setCopiedUrl((prev) => (prev === url ? null : prev));
    }, 2500);
  };

  return (
    <div className="space-y-6">
      {/* 1. Explicit Server Synchronization Card */}
      <SyncButtons showToast={showToast} />

      {/* 2. LAN Broadcast, Node Mode (Host vs Client) & QR Code Panel (P3.1 & P3.2) */}
      <div className="rounded-2xl border border-indigo-200/90 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-5 sm:p-6 shadow-md space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-indigo-500/20 pb-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shrink-0">
              <Wifi className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-bold text-white">
                  Architecture Réseau Octopus LAN — Hôte & Terminaux Mobiles
                </h3>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                    hostInfo?.online
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30'
                      : 'bg-amber-500/20 text-amber-300 border-amber-400/30'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      hostInfo?.online ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'
                    }`}
                  />
                  {hostInfo?.online
                    ? `Connecté au Moteur Hôte (v${hostInfo.version})`
                    : 'Mode Autonome Local'}
                </span>
              </div>
              <p className="text-xs text-indigo-200/80 mt-1 max-w-2xl leading-relaxed">
                Un seul cerveau central sur le réseau Wi-Fi / LAN de l'usine : le poste Hôte héberge{' '}
                <code className="font-mono text-indigo-200">gmao_state.json</code> et diffuse l'accès
                instantané aux smartphones des techniciens et aux PC d'atelier.
              </p>
            </div>
          </div>

          {/* Explicit Operating Mode Switcher (P3.1: Host Node vs LAN Client) */}
          <div className="flex items-center gap-1.5 bg-slate-950/70 p-1.5 rounded-xl border border-indigo-500/30 shrink-0">
            <button
              type="button"
              onClick={() => handleModeSwitch('HOST')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                nodeMode === 'HOST'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Server className="w-3.5 h-3.5" />
              <span>Poste Hôte (Host)</span>
            </button>
            <button
              type="button"
              onClick={() => handleModeSwitch('LAN_CLIENT')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                nodeMode === 'LAN_CLIENT'
                  ? 'bg-cyan-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Client LAN / Mobile</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
          {/* Left 2 Columns: LAN IP Details + Direct Share Links */}
          <div className="lg:col-span-2 space-y-4 flex flex-col justify-between">
            {/* Network Telemetry Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                <div className="text-[10px] uppercase tracking-wider text-indigo-300 font-bold">
                  IP LAN Hôte (IPv4)
                </div>
                <div className="text-sm font-black font-mono text-emerald-300 mt-0.5 truncate">
                  {hostInfo?.primaryIp || '127.0.0.1'}
                </div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                <div className="text-[10px] uppercase tracking-wider text-indigo-300 font-bold">
                  Nom du Serveur
                </div>
                <div className="text-xs font-bold font-mono text-white mt-1 truncate">
                  {hostInfo?.hostname || 'CIOB-HOST'}
                </div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                <div className="text-[10px] uppercase tracking-wider text-indigo-300 font-bold">
                  Port & Flux SSE
                </div>
                <div className="text-xs font-bold font-mono text-cyan-300 mt-1 flex items-center gap-1">
                  <Radio className="w-3.5 h-3.5 text-cyan-400" />
                  <span>
                    :{hostInfo?.port || 3000} ({hostInfo?.connectedClients || 0} actifs)
                  </span>
                </div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                <div className="text-[10px] uppercase tracking-wider text-indigo-300 font-bold">
                  Révision État
                </div>
                <div className="text-xs font-bold font-mono text-amber-300 mt-1">
                  v{hostInfo?.version || 1}
                </div>
              </div>
            </div>

            {/* Direct URL Cards */}
            <div className="space-y-2.5">
              {/* Mobile Field URL */}
              <div className="bg-white/10 border border-white/15 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-cyan-300 flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 shrink-0" />
                    <span>Lien Direct Téléphone & Tablette (Mode Terrain 3 Actions)</span>
                  </div>
                  <div className="text-xs font-mono font-bold text-white truncate mt-0.5 select-all">
                    {hostInfo?.urls?.mobile || 'http://192.168.1.100:3000/#mobile'}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setQrTarget('mobile')}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                      qrTarget === 'mobile'
                        ? 'bg-cyan-500 text-slate-950'
                        : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>QR Mobile</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopyUrl(
                        hostInfo?.urls?.mobile || 'http://192.168.1.100:3000/#mobile',
                        'Mobile'
                      )
                    }
                    className="px-2.5 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-[11px] font-bold transition cursor-pointer flex items-center gap-1"
                  >
                    {copiedUrl === hostInfo?.urls?.mobile ? (
                      <Check className="w-3.5 h-3.5 text-emerald-300" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>Copier</span>
                  </button>
                </div>
              </div>

              {/* Desktop Full App URL */}
              <div className="bg-white/10 border border-white/15 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-indigo-300 flex items-center gap-1.5">
                    <Laptop className="w-3.5 h-3.5 shrink-0" />
                    <span>Lien Direct PC Atelier & Magasin (Interface Complète)</span>
                  </div>
                  <div className="text-xs font-mono font-bold text-white truncate mt-0.5 select-all">
                    {hostInfo?.urls?.desktop || 'http://192.168.1.100:3000'}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setQrTarget('desktop')}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                      qrTarget === 'desktop'
                        ? 'bg-indigo-500 text-white'
                        : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>QR PC</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopyUrl(hostInfo?.urls?.desktop || 'http://192.168.1.100:3000', 'PC')
                    }
                    className="px-2.5 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-[11px] font-bold transition cursor-pointer flex items-center gap-1"
                  >
                    {copiedUrl === hostInfo?.urls?.desktop ? (
                      <Check className="w-3.5 h-3.5 text-emerald-300" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>Copier</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Custom IP Override & Refresh */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
              <input
                type="text"
                value={customIpInput}
                onChange={(e) => setCustomIpInput(e.target.value)}
                placeholder="Forcer IP Wi-Fi (ex: 192.168.1.50) ou laisser vide (Auto)"
                className="flex-1 h-9 px-3 rounded-xl bg-slate-950/70 border border-white/15 text-xs font-mono text-white placeholder:text-slate-400 focus:outline-none focus:border-cyan-400"
              />
              <button
                type="button"
                onClick={handleApplyCustomIp}
                className="h-9 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition cursor-pointer shrink-0"
              >
                Appliquer IP
              </button>
              <button
                type="button"
                onClick={loadNetworkInfo}
                disabled={loadingHostInfo}
                className="h-9 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingHostInfo ? 'animate-spin' : ''}`} />
                <span>Actualiser LAN</span>
              </button>
            </div>
          </div>

          {/* Right Column: Interactive QR Code Card */}
          <div className="bg-white text-slate-900 rounded-2xl p-4 flex flex-col items-center justify-between border border-indigo-100 shadow-lg">
            <div className="text-center space-y-0.5">
              <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                <QrCode className="w-3 h-3" />
                {qrTarget === 'mobile' ? 'Accès Mobile Terrain' : 'Accès PC Complet'}
              </span>
              <div className="text-xs font-bold text-slate-800 pt-1">
                Scanner sur le Wi-Fi Usine
              </div>
            </div>

            <div
              className="my-3 p-3 bg-white rounded-xl border-2 border-slate-900 shadow-xs"
              title={activeQrUrl}
            >
              <svg
                viewBox={`0 0 ${qrMatrix.length} ${qrMatrix.length}`}
                className="w-36 h-36 sm:w-40 sm:h-40 block"
                shapeRendering="crispEdges"
                role="img"
                aria-label={`QR Code ${activeQrUrl}`}
              >
                <rect width={qrMatrix.length} height={qrMatrix.length} fill="#ffffff" />
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

            <div className="w-full text-center space-y-1">
              <div className="text-[11px] font-mono font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200 truncate">
                {activeQrUrl}
              </div>
              <p className="text-[10px] text-slate-500 leading-tight">
                {nodeMode === 'HOST'
                  ? 'Ce poste agit comme Serveur Hôte Principal.'
                  : 'Ce terminal est synchronisé avec le Serveur Hôte.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Shared Folder & Excel Twin Link Configuration */}
      <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
        <FolderOpen className="w-4 h-4 text-indigo-600" />
        Source des données et dossier réseau partagé
      </h3>

      <p className="text-xs text-slate-500 leading-relaxed max-w-3xl">
        Pour déployer le système sur plusieurs machines d'ateliers et partager la même source en
        temps réel, vous pouvez coupler l'application à un répertoire de stockage partagé sur votre
        serveur local d'usine.
      </p>

      <div className="space-y-4 w-full bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200">
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-700">
            Dossier réseau cible ou lecteur mappé partagé :
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={sharedFolderPath}
              onChange={(e) => setSharedFolderPath(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-200 font-mono text-slate-800"
              placeholder="ex: Z:\Partage\CIOB_GMAO"
            />
            <button
              onClick={onDirectLink}
              className="h-10 px-4 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 shrink-0 cursor-pointer w-full sm:w-auto"
            >
              <FolderOpen className="w-4 h-4 text-indigo-600" />
              Changer de dossier
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              Écriture Excel automatique :
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-600">
              <input
                type="checkbox"
                checked={autoWriteExcel}
                onChange={(e) => setAutoWriteExcel(e.target.checked)}
                className="rounded text-indigo-600 border-slate-300 focus:ring-indigo-500"
              />
              <span>Mise à jour auto d'Excel à chaque mouvement</span>
            </label>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              Fréquence de scrutation réseau (Auto-Reload) :
            </label>
            <select
              value={pollingInterval}
              onChange={(e) => setPollingInterval(e.target.value)}
              className="h-9 px-3 rounded-lg border border-slate-300 text-xs font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 text-slate-800 w-full"
            >
              <option value="off">Rafraîchissement manuel uniquement</option>
              <option value="5s">Toutes les 5 secondes (Recommandé)</option>
              <option value="10s">Toutes les 10 secondes</option>
              <option value="30s">Toutes les 30 secondes</option>
            </select>
          </div>
        </div>

        <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-200">
          <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
            Statut de couplage :
            {linkedFileHandle ? (
              <span className="text-emerald-700 font-bold flex items-center gap-1.5 inline-flex">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                Connecté ({linkedFileName || 'Fichier réseau partagé'})
              </span>
            ) : (
              <span className="text-rose-700 font-bold flex items-center gap-1.5 inline-flex">
                <span className="w-1.5 h-1.5 bg-rose-500 rounded-full" />
                Déconnecté (Aucun fichier réseau lié)
              </span>
            )}
          </div>
          <button
            onClick={handleSaveSettings}
            className="w-full sm:w-auto px-4 h-9 bg-slate-900 hover:bg-black text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
          >
            Enregistrer les paramètres
          </button>
        </div>
      </div>

      <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-600 leading-relaxed max-w-full">
        <div className="font-bold text-slate-900 mb-1">Architecture réseau multi-postes :</div>
        En spécifiant le même chemin réseau partagé d'ateliers pour chaque poste d'usine,
        l'application synchronisera ses écrans automatiquement, garantissant aux opérateurs,
        techniciens et coordinateurs un état des stocks et un carnet de mouvements unifiés.
      </div>
    </div>
  );
}
