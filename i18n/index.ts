import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import hi from './hi.json';
import ta from './ta.json';
import zh from './zh.json';
import ko from './ko.json';
import ja from './ja.json';

/** App UI languages. Labels are always native so each option can be found regardless of the current language. */
export type Language = 'en' | 'hi' | 'ta' | 'zh' | 'ko' | 'ja';
export const LANGUAGES: readonly Language[] = ['en', 'hi', 'ta', 'zh', 'ko', 'ja'];

export const LANGUAGE_NATIVE_LABEL: Record<Language, string> = {
  en: 'English',
  hi: 'हिन्दी',
  ta: 'தமிழ்',
  zh: '中文',
  ko: '한국어',
  ja: '日本語',
};

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    hi: { translation: hi },
    ta: { translation: ta },
    zh: { translation: zh },
    ko: { translation: ko },
    ja: { translation: ja },
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
});

export function changeLanguage(language: Language): Promise<unknown> {
  return i18n.changeLanguage(language);
}

export default i18n;
