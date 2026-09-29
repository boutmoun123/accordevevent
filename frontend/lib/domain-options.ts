import type { Language, Localized } from "@/lib/i18n";

export type DomainOption = {
  value: string;
  ar: string;
  en: string;
};

export type DomainOptionGroup =
  | "governorate"
  | "preferenceGovernorate"
  | "maritalMale"
  | "maritalFemale"
  | "maritalPreference"
  | "education"
  | "occupationMale"
  | "occupationFemale"
  | "occupationPreference"
  | "financial"
  | "religion"
  | "commitmentMale"
  | "commitmentFemale"
  | "commitmentPreference"
  | "smoking"
  | "childrenSelf"
  | "childrenPreference"
  | "hijab"
  | "workAfterMarriage";

export type DisplayRangeUnit = "years" | "centimeters";

export type DisplayValueOptions = {
  group?: DomainOptionGroup;
  rangeUnit?: DisplayRangeUnit;
};

export const notSpecified: Localized = {
  ar: "غير محدد",
  en: "Not specified",
};

export const booleanLabels: Record<"true" | "false", Localized> = {
  true: { ar: "نعم", en: "Yes" },
  false: { ar: "لا", en: "No" },
};

export const governorateOptions: DomainOption[] = [
  { value: "DAMASCUS", ar: "دمشق", en: "Damascus" },
  { value: "RIF_DIMASHQ", ar: "ريف دمشق", en: "Rif Dimashq" },
  { value: "ALEPPO", ar: "حلب", en: "Aleppo" },
  { value: "HOMS", ar: "حمص", en: "Homs" },
  { value: "HAMA", ar: "حماة", en: "Hama" },
  { value: "LATAKIA", ar: "اللاذقية", en: "Latakia" },
  { value: "LATTAKIA", ar: "اللاذقية", en: "Latakia" },
  { value: "TARTUS", ar: "طرطوس", en: "Tartus" },
  { value: "AS_SUWAYDA", ar: "السويداء", en: "As-Suwayda" },
  { value: "DARAA", ar: "درعا", en: "Daraa" },
  { value: "QUNEITRA", ar: "القنيطرة", en: "Quneitra" },
  { value: "IDLIB", ar: "إدلب", en: "Idlib" },
  { value: "DEIR_EZ_ZOR", ar: "دير الزور", en: "Deir ez-Zor" },
  { value: "RAQQA", ar: "الرقة", en: "Raqqa" },
  { value: "HASAKAH", ar: "الحسكة", en: "Al-Hasakah" },
  { value: "AL_HASAKAH", ar: "الحسكة", en: "Al-Hasakah" },
  { value: "OUTSIDE_SYRIA", ar: "خارج سوريا", en: "Outside Syria" },
];

const noPreference = { value: "NO_PREFERENCE", ar: "لا يهم", en: "No preference" };

const options: Record<DomainOptionGroup, DomainOption[]> = {
  governorate: governorateOptions,
  preferenceGovernorate: [
    ...governorateOptions,
    { value: "FOREIGN", ar: "أجنبية", en: "Foreign" },
    noPreference,
  ],
  maritalMale: [
    { value: "SINGLE", ar: "أعزب", en: "Single" },
    { value: "SEPARATED", ar: "منفصل", en: "Separated" },
    { value: "DIVORCED", ar: "منفصل", en: "Separated" },
    { value: "WIDOWED", ar: "أرمل", en: "Widowed" },
    { value: "MARRIED", ar: "متزوج", en: "Married" },
  ],
  maritalFemale: [
    { value: "SINGLE", ar: "عزباء", en: "Single" },
    { value: "SEPARATED", ar: "منفصلة", en: "Separated" },
    { value: "DIVORCED", ar: "منفصلة", en: "Separated" },
    { value: "WIDOWED", ar: "أرملة", en: "Widowed" },
    { value: "MARRIED", ar: "متزوجة", en: "Married" },
  ],
  maritalPreference: [
    { value: "SINGLE", ar: "عزباء", en: "Single" },
    { value: "SEPARATED", ar: "منفصلة", en: "Separated" },
    { value: "DIVORCED", ar: "منفصلة", en: "Separated" },
    { value: "WIDOWED", ar: "أرملة", en: "Widowed" },
    { value: "SEPARATED_OR_WIDOWED", ar: "منفصلة أو أرملة", en: "Separated or widowed" },
    { value: "DIVORCED_OR_WIDOWED", ar: "منفصلة أو أرملة", en: "Separated or widowed" },
    noPreference,
  ],
  education: [
    { value: "BASIC", ar: "تعليم أساسي", en: "Basic education" },
    { value: "HIGH_SCHOOL", ar: "ثانوي", en: "High school" },
    { value: "INSTITUTE", ar: "معهد متوسط", en: "Institute" },
    { value: "UNIVERSITY", ar: "جامعي", en: "University" },
    { value: "UNIVERSITY_STUDENT", ar: "طالب جامعي", en: "University student" },
    { value: "UNIVERSITY_GRADUATE", ar: "خريج جامعي", en: "University graduate" },
    { value: "POSTGRADUATE", ar: "دراسات عليا", en: "Postgraduate" },
    { value: "MASTER", ar: "ماجستير", en: "Master's degree" },
    { value: "PHD", ar: "دكتوراه", en: "PhD" },
    noPreference,
  ],
  occupationMale: [
    { value: "EMPLOYEE", ar: "موظف", en: "Employee" },
    { value: "BUSINESS_OWNER", ar: "صاحب عمل", en: "Business owner" },
    { value: "SELF_EMPLOYED", ar: "عمل حر", en: "Self-employed" },
    { value: "FREELANCE", ar: "عمل حر", en: "Freelance" },
    { value: "STUDENT", ar: "طالب", en: "Student" },
    { value: "UNEMPLOYED", ar: "لا أعمل حاليا", en: "Unemployed" },
    { value: "NOT_WORKING", ar: "لا أعمل حاليا", en: "Not currently working" },
  ],
  occupationFemale: [
    { value: "EMPLOYEE", ar: "موظفة", en: "Employee" },
    { value: "BUSINESS_OWNER", ar: "صاحبة عمل", en: "Business owner" },
    { value: "SELF_EMPLOYED", ar: "عمل حر", en: "Self-employed" },
    { value: "FREELANCE", ar: "عمل حر", en: "Freelance" },
    { value: "STUDENT", ar: "طالبة", en: "Student" },
    { value: "UNEMPLOYED", ar: "لا تعمل حاليا", en: "Unemployed" },
    { value: "NOT_WORKING", ar: "لا تعمل حاليا", en: "Not currently working" },
    { value: "HOMEMAKER", ar: "سيدة منزل", en: "Homemaker" },
  ],
  occupationPreference: [],
  financial: [
    { value: "LIMITED_INCOME", ar: "دخل محدود", en: "Limited income" },
    { value: "LIMITED", ar: "دخل محدود", en: "Limited income" },
    { value: "AVERAGE_INCOME", ar: "متوسط الدخل", en: "Average income" },
    { value: "AVERAGE", ar: "متوسط الدخل", en: "Average income" },
    { value: "COMFORTABLE", ar: "مستور", en: "Comfortable" },
    { value: "FINANCIALLY_STABLE", ar: "مستقر ماديا", en: "Financially stable" },
    { value: "STABLE", ar: "مستقر ماديا", en: "Financially stable" },
    { value: "WELL_OFF", ar: "ميسور الحال", en: "Well-off" },
    { value: "WEALTHY", ar: "ثري", en: "Wealthy" },
    { value: "VERY_WEALTHY", ar: "ثري جدا", en: "Very wealthy" },
    noPreference,
  ],
  religion: [
    { value: "SUNNI_MUSLIM", ar: "مسلم سني", en: "Sunni Muslim" },
    { value: "ALAWITE_MUSLIM", ar: "مسلم علوي", en: "Alawite Muslim" },
    { value: "SHIA_MUSLIM", ar: "مسلم شيعي", en: "Shia Muslim" },
    { value: "ISMAILI_MUSLIM", ar: "مسلم إسماعيلي", en: "Ismaili Muslim" },
    { value: "DRUZE", ar: "موحد درزي", en: "Druze" },
    { value: "CHRISTIAN", ar: "مسيحي", en: "Christian" },
    { value: "YAZIDI", ar: "يزيدي", en: "Yazidi" },
    { value: "MUSLIM_ANY", ar: "مسلم - أعتبر المسلمين واحدا", en: "Muslim - any denomination" },
    noPreference,
  ],
  commitmentMale: [
    { value: "COMMITTED", ar: "ملتزم", en: "Committed" },
    { value: "MODERATE", ar: "متوسط الالتزام", en: "Moderately committed" },
    { value: "LOW", ar: "غير ملتزم كثيرا", en: "Low commitment" },
    { value: "NOT_VERY", ar: "غير ملتزم كثيرا", en: "Not very committed" },
    noPreference,
  ],
  commitmentFemale: [
    { value: "COMMITTED", ar: "ملتزمة", en: "Committed" },
    { value: "MODERATE", ar: "متوسطة الالتزام", en: "Moderately committed" },
    { value: "LOW", ar: "غير ملتزمة كثيرا", en: "Low commitment" },
    { value: "NOT_VERY", ar: "غير ملتزمة كثيرا", en: "Not very committed" },
    noPreference,
  ],
  commitmentPreference: [],
  smoking: [
    { value: "NO", ar: "لا", en: "No" },
    { value: "YES", ar: "نعم", en: "Yes" },
    { value: "SOMETIMES", ar: "أحيانا", en: "Sometimes" },
    noPreference,
  ],
  childrenSelf: [
    { value: "NO", ar: "لا", en: "No" },
    { value: "YES", ar: "نعم", en: "Yes" },
    { value: "YES_LIVING_WITH_ME", ar: "نعم، يعيشون معي", en: "Yes, living with me" },
    { value: "YES_WITH_ME", ar: "نعم، يعيشون معي", en: "Yes, living with me" },
    { value: "YES_NOT_LIVING_WITH_ME", ar: "نعم، لا يعيشون معي", en: "Yes, not living with me" },
    { value: "YES_NOT_WITH_ME", ar: "نعم، لا يعيشون معي", en: "Yes, not living with me" },
    { value: "NOT_APPLICABLE", ar: "لا ينطبق", en: "Not applicable" },
  ],
  childrenPreference: [
    { value: "NO", ar: "لا", en: "No" },
    { value: "YES", ar: "نعم", en: "Yes" },
    { value: "SINGLE_ONLY", ar: "أريد عزباء", en: "Single only" },
    { value: "PREFER_SINGLE", ar: "أريد عزباء", en: "I prefer single" },
    noPreference,
  ],
  hijab: [
    { value: "HIJAB", ar: "محجبة", en: "Hijab" },
    { value: "NO_HIJAB", ar: "غير محجبة", en: "No hijab" },
    { value: "NONE", ar: "غير محجبة", en: "No hijab" },
    noPreference,
  ],
  workAfterMarriage: [
    { value: "WANTS_TO_WORK", ar: "ترغب أن تعمل", en: "Wants to work" },
    { value: "SHOULD_WORK", ar: "أرغب أن تعمل", en: "I prefer that she works" },
    { value: "PREFER_NOT_TO_WORK", ar: "أفضل ألا تعمل", en: "Prefer not to work" },
    { value: "SHOULD_NOT_WORK", ar: "أفضل ألا تعمل", en: "I prefer that she does not work" },
    { value: "HER_CHOICE", ar: "الأمر يعود لها", en: "Her choice" },
    { value: "DEPENDS_ON_CIRCUMSTANCES", ar: "حسب الظروف", en: "Depends on circumstances" },
    { value: "DEPENDS", ar: "حسب الظروف", en: "Depends on circumstances" },
    { value: "UNDECIDED", ar: "غير محدد بعد", en: "Undecided" },
    noPreference,
  ],
};

options.occupationPreference = [...options.occupationFemale, noPreference];
options.commitmentPreference = options.commitmentFemale;

export const domainOptions = options;

export function labelForOption(value: string, language: Language, group?: DomainOptionGroup): string {
  const groups = group ? [domainOptions[group]] : Object.values(domainOptions);
  const match = groups.flat().find((item) => item.value === value);
  if (match) return match[language];
  if (process.env.NODE_ENV !== "production") {
    console.warn(`Missing domain option label for ${group ? `${group}:` : ""}${value}`);
  }
  return notSpecified[language];
}

export function localizeDomainValue(value: unknown, language: Language, group?: DomainOptionGroup): string {
  if (Array.isArray(value)) {
    if (value.length === 0) return notSpecified[language];
    return value.map((item) => localizeDomainValue(item, language, group)).join(language === "ar" ? "، " : ", ");
  }
  if (typeof value === "boolean") return booleanLabels[String(value) as "true" | "false"][language];
  if (value === undefined || value === null || value === "") return notSpecified[language];
  return labelForOption(String(value), language, group);
}

function optionLabel(value: string, language: Language, group?: DomainOptionGroup): string | undefined {
  const groups = group ? [domainOptions[group]] : Object.values(domainOptions);
  return groups.flat().find((item) => item.value === value)?.[language];
}

function hasLocalizedLabel(value: string): boolean {
  return Object.values(domainOptions).flat().some((item) => item.ar === value || item.en === value);
}

function formatDisplayRange(min: string, max: string, language: Language, unit?: DisplayRangeUnit): string {
  if (!unit) return `${min} - ${max}`;
  if (unit === "years") return language === "ar" ? `${min} - ${max} سنة` : `${min} - ${max} years`;
  return language === "ar" ? `${min} - ${max} سم` : `${min} - ${max} cm`;
}

export function localizeDisplayValue(value: unknown, language: Language, options: DisplayValueOptions = {}): string {
  if (Array.isArray(value)) {
    if (value.length === 0) return notSpecified[language];
    return value.map((item) => localizeDisplayValue(item, language, options)).join(language === "ar" ? "، " : ", ");
  }
  if (typeof value === "boolean") return booleanLabels[String(value) as "true" | "false"][language];
  if (value === undefined || value === null || value === "") return notSpecified[language];

  const text = String(value).trim();
  if (!text) return notSpecified[language];
  if (hasLocalizedLabel(text)) return text;

  const label = optionLabel(text, language, options.group);
  if (label) return label;

  const rangeMatch = text.match(/^(\d{1,3})\s*[-–]\s*(\d{1,3})$/);
  if (rangeMatch) return formatDisplayRange(rangeMatch[1], rangeMatch[2], language, options.rangeUnit);

  return text;
}
