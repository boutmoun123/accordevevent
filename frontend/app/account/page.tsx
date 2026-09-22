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
import { governorateLabel, localizeBusinessValue } from "@/lib/i18n";
import { api } from "@/services/api";
import type { MaleRequest } from "@/types";

type EditableSection = "male_characteristics" | "desired_female_characteristics";
type FieldRow = readonly [string, { ar: string; en: string }, string];

const selfFields = [
  ["age", { ar: "العمر", en: "Age" }, "number"],
  ["governorate", { ar: "المحافظة", en: "Governorate" }, "text"],
  ["marital_status", { ar: "الحالة الاجتماعية", en: "Marital status" }, "text"],
  ["height", { ar: "الطول", en: "Height" }, "number"],
  ["education", { ar: "التعليم", en: "Education" }, "text"],
  ["occupation", { ar: "المهنة", en: "Occupation" }, "text"],
  ["employment_status", { ar: "الوضع المادي", en: "Financial status" }, "text"],
  ["religious_preference", { ar: "الدين", en: "Religion" }, "text"],
] as const;

const desiredFields = [
  ["age_min", { ar: "العمر من", en: "Age from" }, "number"],
  ["age_max", { ar: "العمر إلى", en: "Age to" }, "number"],
  ["governorates", { ar: "المحافظات", en: "Governorates" }, "text"],
  ["height_min", { ar: "الطول من", en: "Height from" }, "number"],
  ["height_max", { ar: "الطول إلى", en: "Height to" }, "number"],
  ["education", { ar: "التعليم", en: "Education" }, "text"],
  ["occupation", { ar: "المهنة", en: "Occupation" }, "text"],
  ["marital_status", { ar: "الحالة الاجتماعية", en: "Marital status" }, "text"],
  ["religious_preference", { ar: "الدين", en: "Religion" }, "text"],
  ["hijab_status", { ar: "اللباس", en: "Dress style" }, "text"],
  ["other_criteria", { ar: "تفاصيل أخرى", en: "Other details" }, "text"],
] as const;

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

function displayValue(value: unknown, language: "ar" | "en") {
  if (Array.isArray(value)) return value.map((item) => governorateLabel(String(item), language)).join(language === "ar" ? "، " : ", ");
  if (typeof value === "string") return governorateLabel(localizeBusinessValue(value, language), language);
  return localizeBusinessValue(value, language);
}

function editValue(value: unknown) {
  if (Array.isArray(value)) return value.join(", ");
  if (value === undefined || value === null || value === "") return "";
  return String(value);
}

function coerceValue(raw: string, type: string, current: unknown) {
  const value = raw.trim();
  if (Array.isArray(current)) return value ? value.split(/[,،]/).map((item) => item.trim()).filter(Boolean) : [];
  if (type === "number") return value ? Number(value) : undefined;
  return value || undefined;
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
    setValue(editValue(source[field]));
  };
  const save = async (field: FieldRow) => {
    const [key, , type] = field;
    await onSave(section, { ...source, [key]: coerceValue(value, type, source[key]) });
    setEditing(null);
    setValue("");
  };

  return (
    <section className="mt-5 rounded-2xl border bg-white p-4">
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      <div className="mt-4 divide-y">
        {fields.map((field) => {
          const [key, labelMap, type] = field;
          const isEditing = editing === key;
          return (
            <div key={key} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-500">{labelMap[language]}</p>
                  {isEditing ? (
                    <input className="field mt-2" dir={type === "number" ? "ltr" : dir} inputMode={type === "number" ? "numeric" : "text"} value={value} onChange={(event) => setValue(event.target.value)} />
                  ) : (
                    <p className="mt-1 break-words font-medium text-slate-900">{displayValue(source[key], language)}</p>
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
