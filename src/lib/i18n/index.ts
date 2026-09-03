'use client';

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './resources/en';
import it from './resources/it';

export const SUPPORTED_LANGUAGES = ['en', 'it'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const STORAGE_KEY = 'qrilly-lang';

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      it: { translation: it },
    },
    lng: 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    returnNull: false,
  });
}

export function isSupportedLanguage(value: string | undefined | null): value is SupportedLanguage {
  return SUPPORTED_LANGUAGES.includes(value as SupportedLanguage);
}

/** localStorage -> browser language -> 'en', in that order. */
export function resolveInitialLanguage(): SupportedLanguage {
  if (typeof window === 'undefined') return 'en';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (isSupportedLanguage(stored)) return stored;
  const browserLang = window.navigator.language?.slice(0, 2);
  if (isSupportedLanguage(browserLang)) return browserLang;
  return 'en';
}

export function switchLanguage(lang: SupportedLanguage, { persist = true }: { persist?: boolean } = {}) {
  void i18n.changeLanguage(lang);
  if (persist && typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, lang);
  }
}

export default i18n;
