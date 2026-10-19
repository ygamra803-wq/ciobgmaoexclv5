import { useState, useMemo } from 'react';
import { ChevronDown, Plus } from 'lucide-react';

/**
 * Reusable Custom Select with BDR Light styling, Search filtering, and Quick-Add action.
 */
export default function CustomSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Sélectionner...',
  disabled = false,
  onAddNew,
  addNewLabel = 'Ajouter...',
  className = '',
  icon = null,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredOptions = useMemo(() => {
    if (!search) return options;
    const q = String(search).toLowerCase();
    return options.filter((opt) => {
      const label = String(opt.label ?? opt.value ?? '');
      const badge = String(opt.badge ?? '');
      const sublabel = String(opt.sublabel ?? '');
      return (
        label.toLowerCase().includes(q) ||
        badge.toLowerCase().includes(q) ||
        sublabel.toLowerCase().includes(q)
      );
    });
  }, [options, search]);

  const selectedOpt = options.find((o) => o.value === value);

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full h-8 px-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between text-left transition cursor-pointer ${
          disabled
            ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
            : 'bg-white text-slate-800 border-slate-200 hover:border-indigo-400 focus:ring-2 focus:ring-indigo-500/15'
        }`}
      >
        <span className="truncate flex items-center gap-1.5">
          {icon && <span className="shrink-0">{icon}</span>}
          {selectedOpt ? (
            <span className="flex items-center gap-1.5 truncate">
              {selectedOpt.icon && <span className="shrink-0">{selectedOpt.icon}</span>}
              <span className="truncate">{selectedOpt.label}</span>
              {selectedOpt.badge && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 shrink-0">
                  {selectedOpt.badge}
                </span>
              )}
            </span>
          ) : (
            <span className="text-slate-400 font-normal">{placeholder}</span>
          )}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 shrink-0 ml-1 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 top-full mt-1 w-full min-w-[220px] max-w-sm bg-white rounded-xl border border-slate-200 shadow-xl z-50 p-1.5 space-y-1 max-h-60 overflow-y-auto">
            {options.length > 5 && (
              <div className="p-1 border-b border-slate-100 sticky top-0 bg-white">
                <input
                  type="text"
                  placeholder="Filtrer..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-7 px-2 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none"
                  autoFocus
                />
              </div>
            )}
            <div className="space-y-0.5">
              {filteredOptions.length === 0 ? (
                <div className="p-2 text-center text-xs text-slate-400">Aucun résultat</div>
              ) : (
                filteredOptions.map((opt, idx) => (
                  <button
                    key={`${opt.value}-${idx}`}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                      setSearch('');
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition cursor-pointer ${
                      opt.value === value
                        ? 'bg-indigo-50 text-indigo-950 font-bold'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="truncate flex items-center gap-2">
                      {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                      <div className="truncate">
                        <div className="truncate">{opt.label}</div>
                        {opt.sublabel && (
                          <div className="text-[10px] text-slate-400 font-normal truncate">
                            {opt.sublabel}
                          </div>
                        )}
                      </div>
                    </div>
                    {opt.badge && (
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 shrink-0 ml-1">
                        {opt.badge}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
            {onAddNew && (
              <div className="pt-1 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onAddNew();
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold text-indigo-600 hover:bg-indigo-50 flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{addNewLabel}</span>
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
