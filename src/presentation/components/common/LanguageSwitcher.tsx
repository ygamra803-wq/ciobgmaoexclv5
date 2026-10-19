import { useState, useRef, useEffect } from 'react';
import { Languages } from 'lucide-react';
import { useTranslation } from '../../../i18n/I18nContext';

export default function LanguageSwitcher({ className = '' }) {
  const { language, setLanguage, availableLanguages } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const containerRef = useRef(null);
  const timeoutRef = useRef(null);

  const activeLang = availableLanguages.find((l) => l.code === language) || availableLanguages[0];

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsExpanded(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsExpanded(false);
    }, 250);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleSelectLanguage = (code) => {
    setLanguage(code);
    setIsExpanded(false);
  };

  return (
    <div
      ref={containerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative inline-flex items-center shrink-0 ${className}`}
    >
      {!isExpanded ? (
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          aria-label={`Changer la langue (actuellement ${activeLang?.label || language})`}
          title={`Langue : ${activeLang?.label || language} (Survolez ou cliquez pour changer)`}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100/90 hover:bg-slate-200/80 border border-slate-200/80 text-xs font-bold text-slate-700 transition shadow-2xs hover:shadow-xs cursor-pointer shrink-0 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-hidden group"
        >
          <Languages size={14} className="text-slate-500 group-hover:text-emerald-700 transition-colors" aria-hidden="true" />
          <span className="px-1.5 py-0.5 rounded-md bg-white text-emerald-800 shadow-xs ring-1 ring-emerald-500/20 text-[11px] font-bold">
            {activeLang?.flag || language.toUpperCase()}
          </span>
        </button>
      ) : (
        <div
          role="group"
          aria-label="Sélection de la langue"
          className="inline-flex items-center gap-1 p-1 bg-slate-100/95 border border-slate-200/90 rounded-xl text-xs font-semibold shadow-xs select-none animate-in fade-in zoom-in-95 duration-150 shrink-0"
        >
          <Languages size={14} className="text-slate-400 ml-1 mr-0.5 shrink-0" aria-hidden="true" />
          {availableLanguages.map((lang) => {
            const isActive = language === lang.code;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => handleSelectLanguage(lang.code)}
                aria-pressed={isActive}
                aria-label={`Changer la langue en ${lang.label}`}
                className={`px-2 py-1 rounded-lg transition-all duration-150 cursor-pointer text-[11px] font-bold ${
                  isActive
                    ? 'bg-white text-emerald-800 shadow-xs ring-1 ring-emerald-500/20'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                {lang.flag}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
