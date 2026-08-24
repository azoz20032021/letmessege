import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import ar from './locales/ar.json';
import tr from './locales/tr.json';

export const LANGUAGES = [
  { code: 'en', label: 'English', native: 'English', dir: 'ltr', flag: '🇬🇧' },
  { code: 'ar', label: 'Arabic', native: 'العربية', dir: 'rtl', flag: '🇸🇦' },
  { code: 'tr', label: 'Turkish', native: 'Türkçe', dir: 'ltr', flag: '🇹🇷' },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]['code'];

export const STORAGE_KEY = 'lm.lang';

export const isRTL = (code: string) => code === 'ar';

/** Keeps <html lang/dir> in step with the active language. */
export function applyDirection(code: string) {
  const html = document.documentElement;
  html.lang = code;
  html.dir = isRTL(code) ? 'rtl' : 'ltr';
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ar: { translation: ar },
      tr: { translation: tr },
    },
    fallbackLng: 'en',
    supportedLngs: LANGUAGES.map((l) => l.code),
    nonExplicitSupportedLngs: true, // "ar-SA" resolves to "ar"
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      lookupLocalStorage: STORAGE_KEY,
      caches: ['localStorage'],
    },
    interpolation: { escapeValue: false },
    returnNull: false,
  });

i18n.on('languageChanged', applyDirection);
applyDirection(i18n.resolvedLanguage ?? 'en');

export default i18n;
