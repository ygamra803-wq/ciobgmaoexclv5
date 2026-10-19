import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import fr from './translations/fr.json';
import ar from './translations/ar.json';
import en from './translations/en.json';

import frZones from './locales/fr/zones.json';
import arZones from './locales/ar/zones.json';
import enZones from './locales/en/zones.json';

import frUtilisateurs from './locales/fr/utilisateurs.json';
import arUtilisateurs from './locales/ar/utilisateurs.json';
import enUtilisateurs from './locales/en/utilisateurs.json';

import frEntrepot from './locales/fr/entrepot.json';
import arEntrepot from './locales/ar/entrepot.json';
import enEntrepot from './locales/en/entrepot.json';

import frCorrective from './locales/fr/corrective.json';
import arCorrective from './locales/ar/corrective.json';
import enCorrective from './locales/en/corrective.json';

import frPreventive from './locales/fr/preventive.json';
import arPreventive from './locales/ar/preventive.json';
import enPreventive from './locales/en/preventive.json';

import frMachines from './locales/fr/machines.json';
import arMachines from './locales/ar/machines.json';
import enMachines from './locales/en/machines.json';

const dictionaries = {
  fr: { ...fr, zones: frZones, utilisateurs: frUtilisateurs, entrepot: frEntrepot, corrective: frCorrective, preventive: frPreventive, machines: frMachines },
  ar: { ...ar, zones: arZones, utilisateurs: arUtilisateurs, entrepot: arEntrepot, corrective: arCorrective, preventive: arPreventive, machines: arMachines },
  en: { ...en, zones: enZones, utilisateurs: enUtilisateurs, entrepot: enEntrepot, corrective: enCorrective, preventive: enPreventive, machines: enMachines },
};

const I18nContext = createContext({
  language: 'fr',
  setLanguage: () => {},
  t: (key) => key,
  dir: 'ltr',
  isRTL: false,
});

export function I18nProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    try {
      return localStorage.getItem('gmao_language') || 'fr';
    } catch {
      return 'fr';
    }
  });

  // Rule: Application layout is strictly locked to LTR for all languages including Arabic (AR)
  const dir = 'ltr';
  const isRTL = false;

  useEffect(() => {
    try {
      localStorage.setItem('gmao_language', language);
    } catch {
      /* ignore */
    }
    document.documentElement.dir = 'ltr';
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((newLang) => {
    if (dictionaries[newLang]) {
      setLanguageState(newLang);
    }
  }, []);

  const t = useCallback((path: string, fallbackOrParams?: string | Record<string, any>, params?: Record<string, any>) => {
    let fallbackText: string | undefined;
    let actualParams: Record<string, any> = {};

    if (typeof fallbackOrParams === 'string') {
      fallbackText = fallbackOrParams;
      if (params && typeof params === 'object') {
        actualParams = params;
      }
    } else if (fallbackOrParams && typeof fallbackOrParams === 'object') {
      actualParams = fallbackOrParams;
    }

    const keys = path.split('.');
    let current: any = dictionaries[language as keyof typeof dictionaries];

    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        // Fallback to French if key missing in target language
        let fallback: any = dictionaries.fr;
        for (const fKey of keys) {
          if (fallback && typeof fallback === 'object' && fKey in fallback) {
            fallback = fallback[fKey];
          } else {
            return fallbackText !== undefined ? fallbackText : path;
          }
        }
        current = fallback;
        break;
      }
    }

    if (typeof current === 'string') {
      let result = current;
      for (const [paramKey, paramVal] of Object.entries(actualParams)) {
        result = result.replace(new RegExp(`{{${paramKey}}}`, 'g'), String(paramVal));
      }
      return result;
    }

    return fallbackText !== undefined ? fallbackText : path;
  }, [language]);

  const value = useMemo(() => ({
    language,
    setLanguage,
    t,
    dir,
    isRTL,
    availableLanguages: [
      { code: 'fr', label: 'Français', flag: 'FR' },
      { code: 'ar', label: 'العربية', flag: 'AR' },
      { code: 'en', label: 'English', flag: 'EN' },
    ],
  }), [language, setLanguage, t, dir, isRTL]);

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useTranslation must be used within an I18nProvider');
  }
  return context;
}

export const useI18n = useTranslation;
