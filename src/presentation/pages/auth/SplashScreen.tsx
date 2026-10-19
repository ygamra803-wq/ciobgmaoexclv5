import { useEffect, useState } from 'react';
import {
  FileSpreadsheet,
  ShieldCheck,
  Table,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';

export default function SplashScreen({ onComplete }) {
  const [progress, setProgress] = useState(15);
  const [statusText, setStatusText] = useState(
    'Ouverture du classeur Excel GMAO_Light_Template_V2_Formules.xlsx...'
  );

  useEffect(() => {
    const steps = [
      { p: 25, text: 'Chargement des feuilles : Stock_Actuel, Mouvements, Machines...' },
      { p: 55, text: 'Exécution des formules Excel SUMIFS (Entrées, Sorties, Stock Actuel)...' },
      { p: 85, text: 'Calcul des alertes de stock (OK, ALERTE, RUPTURE)...' },
      { p: 100, text: 'Feuille de calcul et données prêtes.' },
    ];

    let current = 0;
    const interval = setInterval(() => {
      if (current < steps.length) {
        setProgress(steps[current].p);
        setStatusText(steps[current].text);
        current++;
      } else {
        clearInterval(interval);
        setTimeout(() => {
          onComplete();
        }, 300);
      }
    }, 350);

    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-100 text-slate-900 flex flex-col items-center justify-between p-6 sm:p-10 select-none font-sans overflow-hidden">
      {/* Background Excel Grid Subtle Lines */}
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none bg-[radial-gradient(#107c41_1px,transparent_1px)] [background-size:20px_20px]" />
      <div className="absolute -top-32 -right-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Row */}
      <div className="w-full max-w-2xl flex justify-between items-center z-10">
        <div className="flex items-center gap-2 bg-white border border-slate-200 px-3.5 py-1.5 rounded-full shadow-xs">
          <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
          <span className="text-[11px] font-mono tracking-wide text-slate-700 font-bold">
            GMAO_Light_Template_V2_Formules.xlsx
          </span>
        </div>

        <button
          onClick={onComplete}
          className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-emerald-800 transition bg-white hover:bg-slate-50 border border-slate-200 px-3.5 py-1.5 rounded-full shadow-xs cursor-pointer font-medium"
        >
          <span>Accéder directement</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Center Excel Card & Loader */}
      <div className="w-full max-w-lg z-10 my-auto flex flex-col items-center text-center">
        {/* Main Light Card */}
        <div className="w-full bg-white border border-slate-200 p-6 sm:p-8 rounded-3xl shadow-xl relative overflow-hidden">
          {/* Top Excel Banner Stripe */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-600 via-green-500 to-emerald-700" />

          {/* Excel Icon */}
          <div className="relative inline-flex mb-5">
            <div className="w-16 h-16 rounded-2xl bg-emerald-700 text-white flex items-center justify-center shadow-lg shadow-emerald-700/20">
              <FileSpreadsheet className="w-9 h-9 stroke-[1.75]" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg bg-emerald-500 text-white flex items-center justify-center shadow-md">
              <RefreshCw className="w-3.5 h-3.5 animate-spin stroke-[2.5]" />
            </div>
          </div>

          {/* Title & Subtitle */}
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            CIOB GMAO LIGHT
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium max-w-xs mx-auto">
            Chargement du Modèle Excel Twin & Calculateur du Stock Actuel
          </p>

          {/* Mini Spreadsheet Simulation Grid */}
          <div className="my-6 border border-slate-200 rounded-xl overflow-hidden bg-slate-50/70 text-left text-[10.5px] font-mono shadow-inner">
            <div className="bg-slate-200/80 px-3 py-1.5 font-bold text-slate-700 border-b border-slate-200 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Table className="w-3.5 h-3.5 text-emerald-700" />
                <span>Feuille : Stock_Actuel</span>
              </span>
              <span className="text-[9.5px] text-emerald-700 font-sans font-semibold">
                Formules `=E+F-G`
              </span>
            </div>

            <div className="divide-y divide-slate-200/60 p-1">
              <div className="grid grid-cols-5 px-2 py-1 font-semibold text-slate-500 text-[9.5px] uppercase">
                <span>Réf</span>
                <span>Déscription</span>
                <span className="text-center">Init</span>
                <span className="text-center">Mvts</span>
                <span className="text-right">Stock</span>
              </div>
              <div className="grid grid-cols-5 px-2 py-1 text-slate-700 bg-white/60">
                <span className="font-bold text-emerald-800 truncate">ROUL-6204</span>
                <span className="truncate">Roulement 2RS</span>
                <span className="text-center">10</span>
                <span className="text-center text-blue-600">+5 / -2</span>
                <span className="text-right font-bold text-slate-900">13</span>
              </div>
              <div className="grid grid-cols-5 px-2 py-1 text-slate-700 bg-white">
                <span className="font-bold text-emerald-800 truncate">JOINT-35</span>
                <span className="truncate">Joint Spi Etanchéité</span>
                <span className="text-center">20</span>
                <span className="text-center text-rose-600">-18</span>
                <span className="text-right font-bold text-rose-600">2 (Alerte)</span>
              </div>
            </div>
          </div>

          {/* Progress Bar & Status Text */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs font-mono font-medium">
              <span className="text-slate-700 truncate pr-2 text-left">{statusText}</span>
              <span className="text-emerald-700 font-bold shrink-0">{progress}%</span>
            </div>

            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200 p-0.5">
              <div
                className="h-full bg-gradient-to-r from-emerald-600 via-green-600 to-emerald-500 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="w-full text-center z-10">
        <p className="text-[11px] font-mono text-slate-500 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Matrice de Calcul Client-Side • Excel Twin Architecture V2</span>
        </p>
      </div>
    </div>
  );
}
