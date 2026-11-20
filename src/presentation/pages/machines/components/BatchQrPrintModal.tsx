import { useEffect, useMemo, useState } from 'react';
import { Printer, QrCode, X, MapPin, ShieldAlert } from 'lucide-react';
import { networkConfigService } from '../../../../services/networkConfigService';
import { getMachineAssetClass, isArchivedMachine } from '../../../../utils/activeMachines';
import type { IMachine, IZone } from '../../../../types/domain';

interface BatchQrPrintModalProps {
  machines: IMachine[];
  zones?: IZone[];
  onClose: () => void;
}

export default function BatchQrPrintModal({
  machines = [],
  zones = [],
  onClose,
}: BatchQrPrintModalProps) {
  const [hostBaseUrl, setHostBaseUrl] = useState<string>(() => {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return window.location.origin;
    }
    return 'http://192.168.1.100:3000';
  });

  useEffect(() => {
    let mounted = true;
    networkConfigService
      .fetchNetworkHostInfo()
      .then((info) => {
        if (mounted && info?.urls?.desktop) {
          setHostBaseUrl(info.urls.desktop);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const activePrintableMachines = useMemo(() => {
    return (machines || []).filter((m) => !isArchivedMachine(m));
  }, [machines]);

  const stickerCards = useMemo(() => {
    const cleanHost = hostBaseUrl.replace(/\/+$/, '');
    return activePrintableMachines.map((m) => {
      const code = String(m.id_machine_registered || m.id || m.code || '').trim();
      const url = `${cleanHost}/?machine_qr=${encodeURIComponent(code)}`;
      const matrix = networkConfigService.generateQrMatrix(url);
      const zoneObj = (zones || []).find(
        (z) =>
          String(z.id_zone || '').toUpperCase() === String(m.id_zone_default || '').toUpperCase() ||
          String(z.code_zone || '').toUpperCase() === String(m.id_zone_default || '').toUpperCase()
      );
      return {
        machine: m,
        code,
        url,
        matrix,
        zoneLabel: zoneObj?.libelle || m.id_zone_default || 'Atelier',
        isSysGeneral: getMachineAssetClass(m) === 'SYSTEM_GENERAL',
      };
    });
  }, [activePrintableMachines, hostBaseUrl, zones]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/65 backdrop-blur-xs animate-in fade-in duration-150 print:static print:bg-white print:p-0">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden print:max-w-none print:max-h-none print:border-0 print:shadow-none print:rounded-none">
        {/* Modal Header (Hidden on Print) */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white shrink-0 print:hidden">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 flex items-center justify-center shrink-0">
              <QrCode className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-black tracking-tight truncate">
                Planche d&apos;Impression QR Collectif ({stickerCards.length} équipements actifs)
              </h3>
              <p className="text-[11px] text-slate-300 truncate">
                URL LAN cible : <span className="font-mono text-cyan-300">{hostBaseUrl}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => window.print()}
              disabled={stickerCards.length === 0}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimer la Planche ({stickerCards.length})</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
              title="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable A4 Sticker Grid */}
        <div className="p-5 overflow-y-auto print:overflow-visible print:p-2">
          {stickerCards.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs font-medium">
              Aucune machine active dans la sélection filtrée pour générer des étiquettes QR.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 print:grid-cols-3 print:gap-3">
              {stickerCards.map(({ machine, code, matrix, zoneLabel, isSysGeneral }) => {
                const dim = matrix.length || 21;
                return (
                  <div
                    key={code}
                    className="bg-white rounded-2xl border-2 border-slate-900 p-3.5 flex flex-col justify-between gap-2.5 break-inside-avoid print:rounded-xl print:p-2.5"
                  >
                    <div className="flex items-start justify-between gap-2 border-b border-slate-200 pb-2">
                      <div className="min-w-0">
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 block">
                          CIOB GMAO • ACTIF
                        </span>
                        <span className="text-base font-black font-mono text-slate-950 block truncate">
                          {code}
                        </span>
                        <span className="text-[11px] font-bold text-slate-700 block truncate">
                          {machine.designation || code}
                        </span>
                      </div>
                      {isSysGeneral && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 text-[9px] font-bold shrink-0">
                          <ShieldAlert className="w-2.5 h-2.5" />
                          SYS
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <svg
                        viewBox={`0 0 ${dim} ${dim}`}
                        className="w-20 h-20 shrink-0 border border-slate-300 rounded-lg p-1 bg-white"
                        shapeRendering="crispEdges"
                        aria-label={`QR Code ${code}`}
                      >
                        {matrix.map((row, rIdx) =>
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
                      <div className="min-w-0 text-[10.5px] space-y-1 text-slate-700">
                        <div className="flex items-center gap-1 font-semibold truncate">
                          <MapPin className="w-3 h-3 text-purple-600 shrink-0" />
                          <span className="truncate">{zoneLabel}</span>
                        </div>
                        <div className="font-mono text-[10px] text-slate-500">
                          Régime : <b className="text-slate-800">{machine.regime_travail || '2x8'}</b>
                        </div>
                        <div className="text-[9.5px] text-slate-500 leading-tight">
                          Scan Wi-Fi atelier : DI, BT 3-clics &amp; Préventif
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
