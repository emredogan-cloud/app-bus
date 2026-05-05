import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import tr from './tr.json';
import en from './en.json';

const deviceLocale = Localization.getLocales()[0]?.languageCode ?? 'tr';
const initialLng = deviceLocale === 'en' ? 'en' : 'tr';

void i18n.use(initReactI18next).init({
  resources: {
    tr: { translation: tr },
    en: { translation: en },
  },
  lng: initialLng,
  fallbackLng: 'tr',
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
