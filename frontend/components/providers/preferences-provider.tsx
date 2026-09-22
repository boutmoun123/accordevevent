"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from "react";

type Language = "ar" | "en";
type Theme = "light" | "dark";

type PreferencesContextValue = {
  language: Language;
  theme: Theme;
  dir: "rtl" | "ltr";
  isArabic: boolean;
  isRtl: boolean;
  isDark: boolean;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const LANGUAGE_KEY = "farah_language";
const THEME_KEY = "farah_theme";
const PREFERENCES_CHANGE_EVENT = "farah-preferences-change";

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

function readLanguage(): Language {
  if (typeof window === "undefined") return "ar";
  return localStorage.getItem(LANGUAGE_KEY) === "en" ? "en" : "ar";
}

function readTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
}

function applyDocumentPreferences(language: Language, theme: Theme) {
  const root = document.documentElement;
  root.lang = language;
  root.dir = language === "ar" ? "rtl" : "ltr";
  root.dataset.language = language;
  root.dataset.theme = theme;
  root.classList.toggle("dark", theme === "dark");
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(PREFERENCES_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(PREFERENCES_CHANGE_EVENT, onStoreChange);
  };
}

function getLanguageSnapshot() {
  return readLanguage();
}

function getThemeSnapshot() {
  return readTheme();
}

function getServerLanguageSnapshot(): Language {
  return "ar";
}

function getServerThemeSnapshot(): Theme {
  return "light";
}

function notifyPreferencesChanged() {
  window.dispatchEvent(new Event(PREFERENCES_CHANGE_EVENT));
}

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const language = useSyncExternalStore(subscribe, getLanguageSnapshot, getServerLanguageSnapshot);
  const theme = useSyncExternalStore(subscribe, getThemeSnapshot, getServerThemeSnapshot);

  useEffect(() => {
    applyDocumentPreferences(language, theme);
  }, [language, theme]);

  const setLanguage = useCallback((value: Language) => {
    localStorage.setItem(LANGUAGE_KEY, value);
    notifyPreferencesChanged();
  }, []);

  const setTheme = useCallback((value: Theme) => {
    localStorage.setItem(THEME_KEY, value);
    notifyPreferencesChanged();
  }, []);

  const value = useMemo<PreferencesContextValue>(
    () => ({
      language,
      theme,
      dir: language === "ar" ? "rtl" : "ltr",
      isArabic: language === "ar",
      isRtl: language === "ar",
      isDark: theme === "dark",
      setLanguage,
      toggleLanguage: () => setLanguage(language === "ar" ? "en" : "ar"),
      setTheme,
      toggleTheme: () => setTheme(theme === "dark" ? "light" : "dark"),
    }),
    [language, theme, setLanguage, setTheme],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error("usePreferences must be used inside PreferencesProvider");
  return value;
}
