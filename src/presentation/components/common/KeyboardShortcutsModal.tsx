import { useEffect, useState } from 'react';
import { Keyboard, X, Sparkles } from 'lucide-react';
import { keyboardShortcuts } from '../../../services/KeyboardShortcutsService';

export default function KeyboardShortcutsModal({ isOpen, onClose }) {
  const [shortcuts, setShortcuts] = useState([]);

  useEffect(() => {
    if (isOpen) {
      setShortcuts(keyboardShortcuts.getAllShortcuts());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const categories = {
    navigation: { title: 'Navigation & Vues', items: [] },
    actions: { title: 'Actions & Métier', items: [] },
    system: { title: 'Système & Interface', items: [] },
  };

  shortcuts.forEach((sc) => {
    const cat = categories[sc.category] || categories.system;
    cat.items.push(sc);
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Keyboard className="w-4 h-4" />
            </div>
            <div>
              <h3 id="shortcuts-modal-title" className="text-sm font-bold text-slate-900">
                Raccourcis Clavier
              </h3>
              <p className="text-[11px] text-slate-500">
                Commandes rapides pour naviguer et travailler à haute vitesse
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer la boîte de dialogue"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {Object.entries(categories).map(([catKey, category]) => {
            if (category.items.length === 0) return null;

            return (
              <div key={catKey} className="space-y-2">
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  {category.title}
                </h4>

                <div className="bg-slate-50/60 rounded-xl border border-slate-100 divide-y divide-slate-100">
                  {category.items.map((sc) => (
                    <div
                      key={sc.id}
                      className="px-3.5 py-2.5 flex items-center justify-between text-xs hover:bg-white transition"
                    >
                      <span className="font-medium text-slate-700">{sc.description}</span>

                      <div className="flex items-center gap-1 font-mono text-[11px]">
                        {sc.ctrl && (
                          <kbd className="px-2 py-0.5 bg-white rounded border border-slate-200 text-slate-600 shadow-2xs">
                            Ctrl
                          </kbd>
                        )}
                        {sc.alt && (
                          <kbd className="px-2 py-0.5 bg-white rounded border border-slate-200 text-slate-600 shadow-2xs">
                            Alt
                          </kbd>
                        )}
                        {sc.shift && (
                          <kbd className="px-2 py-0.5 bg-white rounded border border-slate-200 text-slate-600 shadow-2xs">
                            Shift
                          </kbd>
                        )}
                        <kbd className="px-2 py-0.5 bg-white rounded border border-slate-200 text-slate-800 font-bold shadow-2xs">
                          {sc.label || sc.key.toUpperCase()}
                        </kbd>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Appuyez sur <kbd className="font-mono bg-white px-1 rounded border border-slate-200">Échap</kbd> pour fermer</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 bg-slate-900 text-white rounded-lg font-bold text-xs hover:bg-slate-800 transition cursor-pointer"
          >
            Compris
          </button>
        </div>
      </div>
    </div>
  );
}
