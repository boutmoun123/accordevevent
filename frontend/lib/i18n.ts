"use client";

import { usePreferences } from "@/components/providers/preferences-provider";

export type Language = "ar" | "en";
export type Localized = Record<Language, string>;

export const languageLabel: Record<Language, string> = {
  ar: "EN",
  en: "AR",
};

export function pick<T extends Localized>(value: T, language: Language) {
  return value[language];
}

export function useLanguageText<T extends Record<string, Localized>>(dictionary: T) {
  const preferences = usePreferences();
  const text = Object.fromEntries(
    Object.entries(dictionary).map(([key, value]) => [key, value[preferences.language]]),
  ) as { [K in keyof T]: string };
  return { ...preferences, text };
}

export const businessLabels = {
  maritalStatus: {
    SINGLE: { ar: "عزباء", en: "Single" },
    DIVORCED: { ar: "منفصلة", en: "Divorced" },
    WIDOWED: { ar: "أرملة", en: "Widowed" },
    MARRIED: { ar: "متزوجة", en: "Married" },
  },
  maleMaritalStatus: {
    SINGLE: { ar: "أعزب", en: "Single" },
    DIVORCED: { ar: "منفصل", en: "Divorced" },
    WIDOWED: { ar: "أرمل", en: "Widowed" },
    MARRIED: { ar: "متزوج", en: "Married" },
  },
  hijabStatus: {
    HIJAB: { ar: "محجبة", en: "Hijab" },
    NONE: { ar: "غير محجبة", en: "No hijab" },
  },
  boolean: {
    true: { ar: "نعم", en: "Yes" },
    false: { ar: "لا", en: "No" },
  },
  requestStatus: {
    PENDING: { ar: "قيد المراجعة", en: "Pending review" },
    VERIFIED: { ar: "تم التحقق", en: "Verified" },
    REJECTED: { ar: "مرفوض", en: "Rejected" },
  },
} as const;

export function localizeBusinessValue(value: unknown, language: Language): string {
  if (Array.isArray(value)) return value.map((item) => localizeBusinessValue(item, language)).join(language === "ar" ? "، " : ", ");
  if (typeof value === "boolean") return businessLabels.boolean[String(value) as "true" | "false"][language];
  if (value === undefined || value === null || value === "") return language === "ar" ? "غير محدد" : "Not specified";
  const text = String(value);
  for (const group of Object.values(businessLabels)) {
    if (text in group) return group[text as keyof typeof group][language];
  }
  return text;
}

export const governorateOptions = [
  { value: "DAMASCUS", ar: "دمشق", en: "Damascus" },
  { value: "RIF_DIMASHQ", ar: "ريف دمشق", en: "Rif Dimashq" },
  { value: "ALEPPO", ar: "حلب", en: "Aleppo" },
  { value: "HOMS", ar: "حمص", en: "Homs" },
  { value: "HAMA", ar: "حماة", en: "Hama" },
  { value: "LATTAKIA", ar: "اللاذقية", en: "Latakia" },
  { value: "TARTUS", ar: "طرطوس", en: "Tartus" },
  { value: "DARAA", ar: "درعا", en: "Daraa" },
  { value: "AS_SUWAYDA", ar: "السويداء", en: "As-Suwayda" },
  { value: "IDLIB", ar: "إدلب", en: "Idlib" },
  { value: "DEIR_EZ_ZOR", ar: "دير الزور", en: "Deir ez-Zor" },
  { value: "AL_HASAKAH", ar: "الحسكة", en: "Al-Hasakah" },
  { value: "RAQQA", ar: "الرقة", en: "Raqqa" },
  { value: "OUTSIDE_SYRIA", ar: "خارج سوريا", en: "Outside Syria" },
] as const;

export function governorateLabel(value: string, language: Language) {
  return governorateOptions.find((item) => item.value === value)?.[language] || value;
}
