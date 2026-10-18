import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import nl from '@/locales/nl.json';
import en from '@/locales/en.json';

export const LANGUAGES = ['nl', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];
const STORAGE_KEY = 'koreman.language';

function initialLanguage(): Language {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'nl' || stored === 'en') return stored;
  return navigator.language.startsWith('en') ? 'en' : 'nl';
}

void i18next.use(initReactI18next).init({
  resources: {
    nl: { translation: nl },
    en: { translation: en },
  },
  lng: initialLanguage(),
  fallbackLng: 'nl',
  interpolation: { escapeValue: false },
  returnNull: false,
});

export function setLanguage(language: Language) {
  localStorage.setItem(STORAGE_KEY, language);
  document.documentElement.lang = language;
  return i18next.changeLanguage(language);
}

document.documentElement.lang = i18next.resolvedLanguage ?? 'nl';

export default i18next;
