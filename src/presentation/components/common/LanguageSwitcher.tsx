import { useState, useRef, useEffect } from 'react';
import { Languages, Check } from 'lucide-react';
import { useTranslation } from '../../../i18n/I18nContext';

export default function LanguageSwitcher({ className = '' }) {
  const { language, setLanguage, availableLanguages, t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const activeLang = availableLanguages.find((l) => l.code === language) || availableLanguages[0];

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelectLanguage = (code: string) => {
    setLanguage(code);
    setIsOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex items-center shrink-0 ${className}`}
    >
      {/* Fixed-width trigger button: never shifts neighboring Header elements (NH-13) */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={`Changer la langue (actuellement ${activeLang?.label || language})`}
        title={`Langue : ${activeLang?.label || language}`}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-slate-100/90 hover:bg-slate-200/80 border border-slate-200/80 text-xs font-bold text-slate-700 transition shadow-2xs hover:shadow-xs cursor-pointer shrink-0 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-hidden group"
      >
        <Languages size={14} className="text-slate-500 group-hover:text-emerald-700 transition-colors shrink-0" aria-hidden="true" />
        <span className="px-1.5 py-0.5 rounded-md bg-white text-emerald-800 shadow-xs ring-1 ring-emerald-500/20 text-[11px] font-bold leading-none">
          {activeLang?.flag || language.toUpperCase()}
        </span>
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label={t('common.language_select', 'Sélection de la langue')}
          className="absolute right-0 top-full mt-2 w-40 p-1.5 bg-white border border-slate-200/90 rounded-2xl text-xs font-semibold shadow-2xl select-none z-50 animate-in fade-in slide-in-from-top-1 duration-150"
        >
          {availableLanguages.map((lang) => {
            const isActive = language === lang.code;
            return (
              <button
                key={lang.code}
                type="button"
                role="menuitemradio"
                aria-checked={isActive}
                onClick={() => handleSelectLanguage(lang.code)}
                aria-label={`Changer la langue en ${lang.label}`}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl transition-all duration-150 cursor-pointer text-xs ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-900 font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-medium'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold font-mono ${
                      isActive
                        ? 'bg-emerald-700 text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {lang.flag}
                  </span>
                  <span>{lang.label}</span>
                </span>
                {isActive && <Check size={13} className="text-emerald-600 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

