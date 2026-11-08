import { useState, useRef, useEffect } from 'react';
import { Languages, Check, ChevronDown } from 'lucide-react';
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
      className={`relative shrink-0 ${className}`}
    >
      {/* Unified Capsule Trigger Button with Chevron (Matches Header Dropdowns) */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={`Changer la langue (actuellement ${activeLang?.label || language})`}
        title={`Langue : ${activeLang?.label || language}`}
        className="h-8 flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 rounded-full bg-slate-100/90 hover:bg-slate-200/80 border border-slate-200/90 text-xs font-bold text-slate-700 transition shadow-2xs hover:shadow-xs cursor-pointer shrink-0 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-hidden group"
      >
        <Languages size={14} className="text-slate-500 group-hover:text-emerald-700 transition-colors shrink-0" aria-hidden="true" />
        <span className="px-1.5 py-0.2 rounded-md bg-white text-emerald-800 shadow-2xs ring-1 ring-emerald-500/20 text-[10.5px] font-bold font-mono leading-none">
          {activeLang?.flag || language.toUpperCase()}
        </span>
        <span className="hidden 2xl:inline text-[11px] font-bold text-slate-700">
          {activeLang?.label || language.toUpperCase()}
        </span>
        <ChevronDown
          size={12}
          className={`text-slate-500 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label={t('common.language_select', 'Sélection de la langue')}
          className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-slate-200/90 py-2 select-none z-50 animate-in fade-in slide-in-from-top-2 duration-150"
        >
          <div className="px-3.5 py-1.5 border-b border-slate-100 mb-1">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 font-mono">
              LANGUE DU SYSTÈME
            </div>
            <div className="text-xs font-bold text-slate-800">
              {t('common.language_select', 'Sélection de la langue')}
            </div>
          </div>

          <div className="py-1 px-1.5 space-y-0.5">
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
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl transition-all duration-150 cursor-pointer text-xs ${
                    isActive
                      ? 'bg-emerald-50/90 text-emerald-950 font-bold border border-emerald-200/60 shadow-2xs'
                      : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100/80 font-medium'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <span
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black font-mono shadow-2xs ${
                        isActive
                          ? 'bg-emerald-700 text-white'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {lang.flag}
                    </span>
                    <span className="text-left">
                      <div className="text-xs font-bold leading-tight">{lang.label}</div>
                      <div className="text-[10px] text-slate-400 font-mono leading-tight">{lang.code.toUpperCase()}</div>
                    </span>
                  </span>
                  {isActive && <Check size={14} className="text-emerald-600 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

