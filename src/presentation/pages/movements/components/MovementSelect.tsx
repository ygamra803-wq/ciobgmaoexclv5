import { useState, useMemo, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { ChevronDown, Plus, Receipt, X } from 'lucide-react';

export interface MovementSelectOption {
  value: string;
  label: string;
  badge?: string;
  sublabel?: string;
  icon?: ReactNode;
}

export interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options?: MovementSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  onAddNew?: ((value?: string) => void) | null;
  addNewLabel?: string;
  className?: string;
  icon?: ReactNode;
}

/**
 * Custom Select Component with BDR Light styling and optional onAddNew trigger.
 */
export function CustomSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Sélectionner...',
  disabled = false,
  onAddNew = null,
  addNewLabel = 'Ajouter...',
  className = '',
  icon = null,
}: CustomSelectProps) {
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
                          <div className="text-[10px] text-slate-400 font-normal truncate">{opt.sublabel}</div>
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
                    const pendingSearch = search.trim();
                    setIsOpen(false);
                    setSearch('');
                    onAddNew(pendingSearch || undefined);
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

export interface FormContainerWrapperProps {
  isFloating: boolean;
  isWizardMode?: boolean;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Floating Form Container with frosted glass backdrop and elevated card,
 * or sticky left-hand column in Split View mode.
 */
export function FormContainerWrapper({
  isFloating,
  isWizardMode = false,
  onClose,
  children,
}: FormContainerWrapperProps) {
  if (isFloating) {
    return (
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 z-50 overflow-y-auto animate-in fade-in duration-200"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className={`relative w-full ${
            isWizardMode ? 'max-w-5xl' : 'max-w-4xl'
          } max-h-[90vh] bg-white rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.35)] border border-slate-200/90 overflow-hidden my-auto flex flex-col`}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center shadow-xs">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm sm:text-base text-slate-900 tracking-tight">
                  Émission de Bon de Mouvement
                </h3>
                <p className="text-xs text-slate-500">
                  Formulaire Flottant • Saisie rapide et enregistrement des flux
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
              title="Fermer le formulaire flottant (Échap)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
            <div className="space-y-4">{children}</div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="lg:col-span-5 lg:sticky lg:top-4 max-h-[calc(100vh-100px)] overflow-y-auto pr-1">
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out space-y-4">
        {children}
      </div>
    </div>
  );
}
