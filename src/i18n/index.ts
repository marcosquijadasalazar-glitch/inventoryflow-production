import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import en from "./en.json";
import es from "./es.json";

if (!i18n.isInitialized) {
  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: { en: { translation: en }, es: { translation: es } },
      fallbackLng: "en",
      supportedLngs: ["en", "es"],
      interpolation: { escapeValue: false },
      detection: {
        order: ["localStorage", "navigator"],
        lookupLocalStorage: "inventoryflow.lang",
        caches: ["localStorage"],
      },
    });
}

export default i18n;

export function setLanguage(lng: "en" | "es") {
  i18n.changeLanguage(lng);
  try {
    localStorage.setItem("inventoryflow.lang", lng);
  } catch {}
}
