"use client";

import { Edit3, LogOut, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Logo } from "@/components/brand/logo";
import { RequestSuccess } from "@/components/chat/request-success";
import { useAuth } from "@/components/providers/auth-provider";
import { usePreferences } from "@/components/providers/preferences-provider";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/feedback";
import { StatusBadge } from "@/components/ui/status";
import { domainOptions, localizeDomainValue, notSpecified, type DomainOption, type DomainOptionGroup } from "@/lib/domain-options";
import { api } from "@/services/api";
import type { MaleRequest } from "@/types";

type EditableSection = "male_characteristics" | "desired_female_characteristics";
type FieldRow = {
  key: string;
  label: { ar: string; en: string };
  type: "number" | "text" | "select" | "multi-select";
  group?: DomainOptionGroup;
  unit?: "age" | "height";
};

const selfFields: FieldRow[] = [
  { key: "age", label: { ar: "العمر", en: "Age" }, type: "number", unit: "age" },
  { key: "governorate", label: { ar: "المحافظة الحالية", en: "Current governorate" }, type: "select", group: "governorate" },
  { key: "city", label: { ar: "المدينة", en: "City" }, type: "text" },
  { key: "origin", label: { ar: "المحافظة الأصلية", en: "Original governorate" }, type: "select", group: "governorate" },
  { key: "marital_status", label: { ar: "الحالة الاجتماعية", en: "Marital status" }, type: "select", group: "maritalMale" },
  { key: "height", label: { ar: "الطول", en: "Height" }, type: "number", unit: "height" },
  { key: "education", label: { ar: "التعليم", en: "Education" }, type: "select", group: "education" },
  { key: "education_field", label: { ar: "مجال الدراسة", en: "Education field" }, type: "text" },
  { key: "occupation", label: { ar: "المهنة", en: "Occupation" }, type: "select", group: "occupationMale" },
  { key: "employment_status", label: { ar: "الوضع المادي", en: "Financial status" }, type: "select", group: "financial" },
  { key: "religious_preference", label: { ar: "الدين", en: "Religion" }, type: "select", group: "religion" },
  { key: "children", label: { ar: "الأطفال", en: "Children" }, type: "text" },
  { key: "values", label: { ar: "القيم والتفضيلات", en: "Values and preferences" }, type: "multi-select", group: "commitmentMale" },
  { key: "personality_traits", label: { ar: "صفات شخصية", en: "Personality traits" }, type: "text" },
  { key: "preferred_contact", label: { ar: "طريقة التواصل المفضلة", en: "Preferred contact" }, type: "text" },
];

const desiredFields: FieldRow[] = [
  { key: "marital_status", label: { ar: "الحالة الاجتماعية", en: "Marital status" }, type: "select", group: "maritalPreference" },
  { key: "age_min", label: { ar: "العمر من", en: "Age from" }, type: "number", unit: "age" },
  { key: "age_max", label: { ar: "العمر إلى", en: "Age to" }, type: "number", unit: "age" },
  { key: "preferred_origin", label: { ar: "المحافظة الأصلية المفضلة", en: "Preferred original governorate" }, type: "select", group: "preferenceGovernorate" },
  { key: "governorates", label: { ar: "محافظة الإقامة", en: "Residence governorate" }, type: "multi-select", group: "preferenceGovernorate" },
  { key: "height_min", label: { ar: "الطول من", en: "Height from" }, type: "number", unit: "height" },
  { key: "height_max", label: { ar: "الطول إلى", en: "Height to" }, type: "number", unit: "height" },
  { key: "education", label: { ar: "التعليم", en: "Education" }, type: "select", group: "education" },
  { key: "occupation", label: { ar: "المهنة", en: "Occupation" }, type: "select", group: "occupationPreference" },
  { key: "profession_preference", label: { ar: "تفضيل العمل", en: "Work preference" }, type: "select", group: "occupationPreference" },
  { key: "children", label: { ar: "الأطفال", en: "Children" }, type: "text" },
  { key: "children_preference", label: { ar: "تفضيل الأطفال", en: "Children preference" }, type: "text" },
  { key: "religious_preference", label: { ar: "الدين", en: "Religion" }, type: "select", group: "religion" },
  { key: "values", label: { ar: "درجة الالتزام", en: "Religious commitment" }, type: "multi-select", group: "commitmentPreference" },
  { key: "hijab_status", label: { ar: "اللباس", en: "Dress style" }, type: "select", group: "hijab" },
  { key: "traits", label: { ar: "صفات إضافية", en: "Additional traits" }, type: "text" },
  { key: "personality_traits", label: { ar: "صفات شخصية", en: "Personality traits" }, type: "text" },
  { key: "other_criteria", label: { ar: "المواصفات الإضافية", en: "Additional details" }, type: "text" },
];

const text = {
  ar: {
    loading: "جاري تحميل الطلب...",
    loadError: "تعذر تحميل الطلب",
    saveError: "تعذر حفظ التعديل",
    signInPrompt: "سجّل الدخول لمتابعة طلبك.",
    signIn: "تسجيل الدخول",
    hello: "أهلا",
    signOut: "خروج",
    noRequestTitle: "لا يوجد طلب فعال",
    noRequestDescription: "ابدأ محادثة Farah.event لإنشاء أول طلب توفيق.",
    verification: "حالة التحقق",
    editRequest: "طلب تعديل",
    myInfo: "تعديل معلوماتي",
    desiredInfo: "تعديل مواصفات شريكة الحياة",
    save: "حفظ",
    edit: "تعديل",
    notSpecified: "غير محدد",
    privacy: "لا تظهر المنصة ملفات الفتيات أو بياناتهن الشخصية للمستخدمين.",
    retry: "إعادة المحاولة",
  },
  en: {
    loading: "Loading request...",
    loadError: "Could not load the request",
    saveError: "Could not save changes",
    signInPrompt: "Sign in to follow your request.",
    signIn: "Sign in",
    hello: "Hello",
    signOut: "Sign out",
    noRequestTitle: "No active request",
    noRequestDescription: "Start a Farah.event chat to create your first matchmaking request.",
    verification: "Verification status",
    editRequest: "Edit request",
    myInfo: "Edit my information",
    desiredInfo: "Edit life partner preferences",
    save: "Save",
    edit: "Edit",
    notSpecified: "Not specified",
    privacy: "The platform does not show women's profiles or personal details to users.",
    retry: "Try again",
  },
};

function extractPreferredOrigin(otherCriteria: unknown) {
  if (typeof otherCriteria !== "string") return undefined;
  return otherCriteria.match(/(?:^|\s)preferred_origin:([A-Z_]+)/)?.[1];
}

function withoutPreferredOrigin(otherCriteria: unknown) {
  if (typeof otherCriteria !== "string") return otherCriteria;
  return otherCriteria.replace(/(?:^|\s)preferred_origin:[A-Z_]+/g, "").trim() || undefined;
}

function withPreferredOrigin(otherCriteria: unknown, origin: unknown) {
  const cleaned = withoutPreferredOrigin(otherCriteria);
  if (!origin || origin === "NO_PREFERENCE") return cleaned;
  return [cleaned, `preferred_origin:${origin}`].filter(Boolean).join(" ");
}

function valueForField(source: Record<string, unknown>, key: string) {
  if (key === "preferred_origin") return extractPreferredOrigin(source.other_criteria);
  if (key === "other_criteria") return withoutPreferredOrigin(source.other_criteria);
  return source[key];
}

function formatUnit(value: unknown, unit: FieldRow["unit"], language: "ar" | "en") {
  if (value === undefined || value === null || value === "") return notSpecified[language];
  const suffix = unit === "age" ? (language === "ar" ? " سنة" : " years") : (language === "ar" ? " سم" : " cm");
  return `${value}${suffix}`;
}

function displayValue(value: unknown, field: FieldRow, language: "ar" | "en") {
  if (field.unit) return formatUnit(value, field.unit, language);
  if (field.group) return localizeDomainValue(value, language, field.group);
  return localizeDomainValue(value, language);
}

function editValue(value: unknown) {
  if (Array.isArray(value)) return value.join(", ");
  if (value === undefined || value === null || value === "") return "";
  return String(value);
}

function coerceValue(raw: string, field: FieldRow, current: unknown) {
  const value = raw.trim();
  if (field.type === "multi-select" || Array.isArray(current)) return value ? value.split(/[,،]/).map((item) => item.trim()).filter(Boolean) : [];
  if (field.type === "number") return value ? Number(value) : undefined;
  return value || undefined;
}

function optionsFor(field: FieldRow): DomainOption[] {
  return field.group ? domainOptions[field.group] : [];
}

function RequestEditList({
  title,
  section,
  fields,
  data,
  onSave,
}: {
  title: string;
  section: EditableSection;
  fields: readonly FieldRow[];
  data: MaleRequest;
  onSave: (section: EditableSection, next: Record<string, unknown>) => Promise<void>;
}) {
  const { language, dir } = usePreferences();
  const t = text[language];
  const [editing, setEditing] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const source = (data[section] || {}) as Record<string, unknown>;
  const begin = (field: string) => {
    setEditing(field);
    setValue(editValue(valueForField(source, field)));
  };
  const save = async (field: FieldRow) => {
    const { key } = field;
    const nextValue = coerceValue(value, field, valueForField(source, key));
    const next = key === "preferred_origin"
      ? { ...source, other_criteria: withPreferredOrigin(source.other_criteria, nextValue) }
      : { ...source, [key]: nextValue };
    await onSave(section, next);
    setEditing(null);
    setValue("");
  };

  return (
    <section className="mt-5 rounded-2xl border bg-white p-4">
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      <div className="mt-4 divide-y">
        {fields.map((field) => {
          const { key, label: labelMap, type } = field;
          const isEditing = editing === key;
          const currentValue = valueForField(source, key);
          return (
            <div key={key} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-500">{labelMap[language]}</p>
                  {isEditing ? (
                    type === "select" || type === "multi-select" ? (
                      <select
                        className="field mt-2 min-h-11 max-w-full"
                        dir={dir}
                        multiple={type === "multi-select"}
                        value={type === "multi-select" ? value.split(", ").filter(Boolean) : value}
                        onChange={(event) => {
                          const selected = Array.from(event.currentTarget.selectedOptions).map((item) => item.value);
                          setValue(type === "multi-select" ? selected.join(", ") : selected[0] || "");
                        }}
                      >
                        {type === "select" && <option value="">{notSpecified[language]}</option>}
                        {optionsFor(field).map((item) => (
                          <option key={item.value} value={item.value}>{item[language]}</option>
                        ))}
                      </select>
                    ) : (
                      <input className="field mt-2" dir={type === "number" ? "ltr" : dir} inputMode={type === "number" ? "numeric" : "text"} value={value} onChange={(event) => setValue(event.target.value)} />
                    )
                  ) : (
                    <p className="mt-1 break-words font-medium text-slate-900">{displayValue(currentValue, field, language)}</p>
                  )}
                </div>
                {isEditing ? (
                  <Button size="sm" onClick={() => void save(field)}>{t.save}</Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => begin(key)}>
                    <Edit3 size={14} /> {t.edit}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function Account() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { language, dir } = usePreferences();
  const t = text[language];
  const [data, setData] = useState<MaleRequest>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    try {
      const request = await api.get<MaleRequest>("/male/request");
      setData(request);
      setError("");
      try {
        const count = await api.get<{ count: number }>("/matching/count");
        setData((value) => (value ? { ...value, match_count: count.count } : value));
      } catch {}
    } catch (errorValue) {
      if ((errorValue as { status?: number }).status !== 404) setError(errorValue instanceof Error ? errorValue.message : t.loadError);
    } finally {
      setLoading(false);
    }
  }, [t.loadError]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Load the authenticated request after auth state settles.
    if (!authLoading && user) void load();
  }, [authLoading, user, load]);

  const saveSection = async (section: EditableSection, next: Record<string, unknown>) => {
    if (!data || saving) return;
    setSaving(true);
    try {
      const updated = await api.patch<MaleRequest>("/male/request", {
        male_characteristics: data.male_characteristics,
        desired_female_characteristics: data.desired_female_characteristics,
        [section]: next,
      });
      setData(updated);
      try {
        const count = await api.get<{ count: number }>("/matching/count");
        setData((value) => (value ? { ...value, match_count: count.count } : value));
      } catch {}
    } catch (errorValue) {
      setError(errorValue instanceof Error ? errorValue.message : t.saveError);
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || (user && loading)) return <LoadingState label={t.loading} />;
  if (!user) {
    return (
      <main dir={dir} className="grid min-h-screen place-items-center">
        <div className="text-center">
          <p>{t.signInPrompt}</p>
          <Button asChild className="mt-4">
            <Link href="/auth/login?next=/account">{t.signIn}</Link>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main dir={dir} className="min-h-screen px-4 py-7">
      <header className="mx-auto flex max-w-5xl items-center justify-between">
        <Logo />
        <div className="flex items-center gap-3">
          <span className="hidden text-sm sm:inline">{t.hello}, {user.first_name}</span>
          <Button variant="ghost" onClick={() => void signOut()}>
            <LogOut size={17} /> {t.signOut}
          </Button>
        </div>
      </header>
      <section className="mx-auto mt-12 max-w-4xl">
        {error ? (
          <ErrorState message={error} retry={load} retryLabel={t.retry} />
        ) : !data ? (
          <EmptyState title={t.noRequestTitle} description={t.noRequestDescription} />
        ) : (
          <>
            <RequestSuccess code={data.request_code} count={data.match_count} onRefresh={load} />
            <div className="mx-auto mt-5 flex max-w-2xl items-center justify-between rounded-2xl border bg-white p-4">
              <div>
                <span className="text-sm text-slate-500">{t.verification}</span>
                <div className="mt-1"><StatusBadge status={data.verification_status} /></div>
              </div>
              <Button asChild variant="outline">
                <Link href="/chat"><Edit3 size={16} /> {t.editRequest}</Link>
              </Button>
            </div>
            <div className={saving ? "pointer-events-none opacity-70" : ""}>
              <RequestEditList title={t.myInfo} section="male_characteristics" fields={selfFields} data={data} onSave={saveSection} />
              <RequestEditList title={t.desiredInfo} section="desired_female_characteristics" fields={desiredFields} data={data} onSave={saveSection} />
            </div>
            <p className="mx-auto mt-5 flex max-w-2xl items-center gap-2 text-xs text-slate-400">
              <ShieldCheck size={14} /> {t.privacy}
            </p>
          </>
        )}
      </section>
    </main>
  );
}
