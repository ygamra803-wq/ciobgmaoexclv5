import { Monitor, Smartphone, Sparkles, RotateCcw } from 'lucide-react';
import { useAppShell, ShellMode } from '../../../core/shell/shellPolicy';

interface ShellModeSwitcherProps {
  compact?: boolean;
  onModeChanged?: (mode: ShellMode) => void;
  className?: string;
}

export default function ShellModeSwitcher({
  compact = false,
  onModeChanged,
  className = '',
}: ShellModeSwitcherProps) {
  const { mode, resolved, source, setMode, clearOverride } = useAppShell();

  const handleSelect = (nextMode: ShellMode) => {
    setMode(nextMode);
    onModeChanged?.(nextMode);
  };

  if (compact) {
    return (
      <div
        data-testid="shell-mode-switcher-compact"
        className={`inline-flex items-center gap-1 bg-slate-100 border border-slate-200/90 rounded-xl p-1 text-xs ${className}`}
      >
        {(['auto', 'desktop', 'mobile'] as ShellMode[]).map((item) => {
          const active = mode === item;
          const label = item === 'auto' ? 'Auto' : item === 'desktop' ? 'Desktop' : 'Mobile';
          return (
            <button
              key={item}
              type="button"
              onClick={() => handleSelect(item)}
              data-testid={`shell-mode-btn-${item}`}
              className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 ${
                active
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
              }`}
            >
              {item === 'auto' && <Sparkles className="w-3 h-3 text-emerald-400" />}
              {item === 'desktop' && <Monitor className="w-3 h-3" />}
              {item === 'mobile' && <Smartphone className="w-3 h-3" />}
              <span>{label}</span>
            </button>
          );
        })}
        <span
          data-testid="shell-resolved-badge"
          className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono text-[10px] font-bold"
          title={`Shell résolu: ${resolved} (source: ${source})`}
        >
          ={resolved}
        </span>
      </div>
    );
  }

  return (
    <div
      data-testid="shell-mode-switcher"
      className={`bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3 ${className}`}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
            <Smartphone className="w-4 h-4 text-emerald-600" />
            <span>Politique d'Affichage (ShellPolicy)</span>
          </h4>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Basculez instantanément entre la détection automatique, le Bureau complet ou le Shell Mobile terrain.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            data-testid="shell-resolved-indicator"
            className="px-2.5 py-1 rounded-lg bg-slate-900 text-white font-mono text-[11px] font-bold"
          >
            resolved: {resolved}
          </span>
          {mode !== 'auto' && (
            <button
              type="button"
              onClick={() => clearOverride()}
              data-testid="shell-clear-override-btn"
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
              title="Réinitialiser sur Auto"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => handleSelect('auto')}
          data-testid="shell-mode-btn-auto"
          className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between gap-1.5 ${
            mode === 'auto'
              ? 'bg-emerald-50/90 border-emerald-500 text-emerald-950 ring-2 ring-emerald-500/20'
              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-white'
          }`}
        >
          <div className="flex items-center justify-between">
            <Sparkles className={`w-4 h-4 ${mode === 'auto' ? 'text-emerald-600' : 'text-slate-400'}`} />
            {mode === 'auto' && (
              <span className="text-[9px] font-mono font-black uppercase px-1.5 py-0.5 rounded bg-emerald-200/80 text-emerald-900">
                Actif
              </span>
            )}
          </div>
          <div>
            <div className="text-xs font-black">Auto</div>
            <div className="text-[10px] text-slate-500 leading-tight">Tactile & Écran</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => handleSelect('desktop')}
          data-testid="shell-mode-btn-desktop"
          className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between gap-1.5 ${
            mode === 'desktop'
              ? 'bg-blue-50/90 border-blue-600 text-blue-950 ring-2 ring-blue-500/20'
              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-white'
          }`}
        >
          <div className="flex items-center justify-between">
            <Monitor className={`w-4 h-4 ${mode === 'desktop' ? 'text-blue-600' : 'text-slate-400'}`} />
            {mode === 'desktop' && (
              <span className="text-[9px] font-mono font-black uppercase px-1.5 py-0.5 rounded bg-blue-200/80 text-blue-900">
                Forcé
              </span>
            )}
          </div>
          <div>
            <div className="text-xs font-black">Desktop</div>
            <div className="text-[10px] text-slate-500 leading-tight">Suite Admin PC</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => handleSelect('mobile')}
          data-testid="shell-mode-btn-mobile"
          className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between gap-1.5 ${
            mode === 'mobile'
              ? 'bg-amber-50/90 border-amber-500 text-amber-950 ring-2 ring-amber-500/20'
              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-white'
          }`}
        >
          <div className="flex items-center justify-between">
            <Smartphone className={`w-4 h-4 ${mode === 'mobile' ? 'text-amber-600' : 'text-slate-400'}`} />
            {mode === 'mobile' && (
              <span className="text-[9px] font-mono font-black uppercase px-1.5 py-0.5 rounded bg-amber-200/80 text-amber-900">
                Forcé
              </span>
            )}
          </div>
          <div>
            <div className="text-xs font-black">Mobile</div>
            <div className="text-[10px] text-slate-500 leading-tight">Shell Terrain</div>
          </div>
        </button>
      </div>
    </div>
  );
}
