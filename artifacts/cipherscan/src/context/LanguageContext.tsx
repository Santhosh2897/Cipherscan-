import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { SupportedLanguage, TranslationKey, LanguageInfo, SUPPORTED_LANGUAGES } from '../i18n/types';
import { translations, en } from '../i18n/translations';

interface LanguageContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  t: (key: TranslationKey | string, fallbackOrParams?: string | Record<string, string | number>, maybeParams?: Record<string, string | number>) => string;
  currentLanguageInfo: LanguageInfo;
  languages: LanguageInfo[];
}

const STORAGE_KEY = 'cipherscan_language';

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

function getInitialLanguage(): SupportedLanguage {
  if (typeof window === 'undefined') return 'en';

  try {
    const saved = localStorage.getItem(STORAGE_KEY) as SupportedLanguage | null;
    if (saved && SUPPORTED_LANGUAGES.some((l) => l.code === saved)) {
      return saved;
    }

    // Auto-detect browser locale
    const browserLang = (navigator.language || '').toLowerCase();
    for (const lang of SUPPORTED_LANGUAGES) {
      if (browserLang.startsWith(lang.code)) {
        return lang.code;
      }
    }
  } catch {
    // ignore
  }

  return 'en';
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<SupportedLanguage>(getInitialLanguage);

  const setLanguage = useCallback((lang: SupportedLanguage) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
      document.documentElement.lang = lang;
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      document.documentElement.lang = language;
    } catch {
      // ignore
    }
  }, [language]);

  const currentLanguageInfo = useMemo(() => {
    return SUPPORTED_LANGUAGES.find((l) => l.code === language) || SUPPORTED_LANGUAGES[0];
  }, [language]);

  const t = useCallback(
    (
      key: TranslationKey | string,
      fallbackOrParams?: string | Record<string, string | number>,
      maybeParams?: Record<string, string | number>
    ): string => {
      let fallback = typeof fallbackOrParams === 'string' ? fallbackOrParams : undefined;
      const params = typeof fallbackOrParams === 'object' ? fallbackOrParams : maybeParams;

      // Look up translated string
      const langDict = translations[language];
      let text = (langDict && (langDict as Record<string, string>)[key]) || 
                 (en as Record<string, string>)[key] || 
                 fallback || 
                 key;

      // Perform parameter substitution (e.g. {device})
      if (params) {
        Object.entries(params).forEach(([paramKey, paramVal]) => {
          text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramVal));
        });
      }

      return text;
    },
    [language]
  );

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t,
      currentLanguageInfo,
      languages: SUPPORTED_LANGUAGES,
    }),
    [language, setLanguage, t, currentLanguageInfo]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextType {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
