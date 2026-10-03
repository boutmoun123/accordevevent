"use client";

import { CheckCircle2, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { statusLabel } from "@/components/ui/status";
import { domainOptions, localizeDisplayValue, normalizeDomainValue, type DomainOptionGroup } from "@/lib/domain-options";
import { formatArabicDate, formatMoney, formatNumber } from "@/lib/utils";
import { api } from "@/services/api";

const gov = domainOptions.governorate.map((option) => option.value);

const optionGroups: Record<string, DomainOptionGroup> = {
  governorate: "governorate",
  education: "education",
  occupation: "occupationFemale",
  marital_status: "maritalFemale",
  hijab_status: "hijab",
  religious_preference: "religion",
  values: "commitmentFemale",
  desired_education: "education",
  profession_preference: "occupationMale",
  desired_marital_status: "maritalMale",
  desired_religious_preference: "religion",
  desired_values: "commitmentMale",
};

const optionLabels: Record<string, string> = {
  GUARDIAN_FIRST: "التواصل مع ولي الأمر أولا",
  FAMILIES: "بين العائلتين",
  MATCHMAKER: "عن طريق الخطابة",
  VIRTUAL_WITH_GUARDIAN: "لقاء افتراضي بحضور ولي الأمر",
  IN_PERSON_WITH_MATCHMAKER: "لقاء حضوري بإشراف الخطابة",
  OTHER: "أخرى",
  SINGLE: "عزباء",
  DIVORCED: "منفصلة",
  WIDOWED: "أرملة",
  HIJAB: "محجبة",
  NIQAB: "منقبة",
  NONE: "لا",
  DRAFT: "مسودة",
  ACTIVE: "نشط",
  PENDING: "قيد الانتظار",
  PAID: "مدفوع",
  WAIVED: "معفى",
  SYP: "ليرة سورية",
  USD: "دولار أمريكي",
  VIRTUAL: "افتراضي",
  IN_PERSON: "حضوري",
  FAMILY: "عائلي",
  MATCHMAKER_PRESENT: "بحضور الخطابة",
  true: "نعم",
  false: "لا",
};

type Data = Record<string, FormDataEntryValue | number | boolean | Record<string, unknown> | string[] | undefined>;
type MaleRequestOption = {
  id: string;
  request_code?: string;
  verification_status?: string;
  workflow_status?: string;
  created_at?: string;
  male_characteristics?: Record<string, unknown>;
};

function selectLabel(name: string, value: string) {
  return optionLabels[value] || localizeDisplayValue(value, "ar", { group: optionGroups[name] });
}

function selectValue(name: string, value: unknown) {
  if (value === undefined || value === null) return "";
  const text = String(value);
  const group = optionGroups[name];
  if (!group) return text;
  return domainOptions[group].find((option) => option.value === text || option.ar === text || option.en === text)?.value || text;
}

function listValue(value: unknown) {
  if (Array.isArray(value)) return value.join(", ");
  return value === undefined || value === null ? "" : String(value);
}

function splitList(value: unknown) {
  return String(value || "")
    .split(/[,،]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitDomainList(value: unknown, group: DomainOptionGroup) {
  return splitList(value)
    .map((item) => normalizeDomainValue(item, group))
    .filter((item): item is string => Boolean(item));
}

function booleanValue(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  return String(value) === "true";
}

function hasDisplayValue(value: unknown) {
  if (value === undefined || value === null || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function compactRecord<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined && (!Array.isArray(item) || item.length > 0)),
  ) as Partial<T>;
}

function Field({
  label,
  name,
  type = "text",
  required = false,
  options,
  min,
  max,
  minLength,
  maxLength,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  options?: string[];
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  defaultValue?: unknown;
}) {
  return (
    <label>
      <span className="label">
        {label}
        {required && " *"}
      </span>
      {options ? (
        <select className="field" name={name} required={required} defaultValue={selectValue(name, defaultValue)}>
          <option value="">اختر</option>
          {options.map((value) => (
            <option key={value} value={value}>
              {selectLabel(name, value)}
            </option>
          ))}
        </select>
      ) : (
        <input
          className="field"
          name={name}
          type={type}
          required={required}
          min={min}
          max={max}
          minLength={minLength}
          maxLength={maxLength}
          defaultValue={defaultValue === undefined || defaultValue === null ? "" : String(defaultValue)}
        />
      )}
    </label>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="rounded-2xl border p-4">
      <legend className="px-2 font-bold">{title}</legend>
      {hint && <p className="mb-4 text-xs text-slate-400">{hint}</p>}
      <div className="space-y-3">{children}</div>
    </fieldset>
  );
}

function MaleRequestPicker({ required = false }: { required?: boolean }) {
  const [requests, setRequests] = useState<MaleRequestOption[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api.get<MaleRequestOption[]>("/matchmaker/male-requests")
      .then((items) => {
        if (!cancelled) setRequests(items);
      })
      .catch(() => {
        if (!cancelled) setRequests([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ar");
    if (!normalized) return requests;
    return requests.filter((request) => {
      const male = request.male_characteristics || {};
      return [request.request_code, request.id, male.age, male.governorate, male.city, male.occupation]
        .some((value) => String(value ?? "").toLocaleLowerCase("ar").includes(normalized));
    });
  }, [query, requests]);

  return (
    <div className="sm:col-span-2">
      <input type="hidden" name="male_request_id" value={selectedId} required={required} />
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="label mb-0">طلب الشاب{required && " *"}</span>
        {selectedId && (
          <button type="button" className="text-xs font-semibold text-brand-rose" onClick={() => setSelectedId("")}>
            تغيير الاختيار
          </button>
        )}
      </div>
      <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
        <div className="relative">
          <Search className="absolute right-3 top-3 text-slate-400" size={17} />
          <input
            className="field bg-white pr-10"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ابحث برقم الطلب، المحافظة، العمر، أو المهنة"
          />
        </div>
        <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
          {loading ? (
            <p className="rounded-lg bg-white p-3 text-sm text-slate-500">جاري تحميل طلبات الشباب...</p>
          ) : filtered.length ? (
            filtered.map((request) => {
              const male = request.male_characteristics || {};
              const selected = selectedId === request.id;
              return (
                <button
                  type="button"
                  key={request.id}
                  onClick={() => setSelectedId(request.id)}
                  className={`w-full rounded-lg border bg-white p-3 text-start transition ${selected ? "border-brand-rose ring-2 ring-brand-rose/10" : "border-slate-100 hover:border-brand-rose"}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-sm font-bold text-brand-rose" dir="ltr">
                      {request.request_code || request.id}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                      {statusLabel(request.verification_status || request.workflow_status, "ar")}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    {hasDisplayValue(male.age) && <span>العمر: {String(male.age)}</span>}
                    {hasDisplayValue(male.governorate) && <span>المحافظة: {localizeDisplayValue(male.governorate, "ar", { group: "governorate" })}</span>}
                    {hasDisplayValue(male.occupation) && <span>العمل: {localizeDisplayValue(male.occupation, "ar", { group: "occupationMale" })}</span>}
                    {request.created_at && <span>{formatArabicDate(request.created_at, { dateStyle: "medium" })}</span>}
                  </div>
                </button>
              );
            })
          ) : (
            <p className="rounded-lg bg-white p-3 text-sm text-slate-500">لا توجد طلبات مطابقة للبحث.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function useSubmit(
  endpoint: string,
  done: () => void,
  transform?: (data: Data) => unknown,
  method: "post" | "patch" = "post",
) {
  const [busy, setBusy] = useState(false);
  return {
    busy,
    submit: async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setBusy(true);
      const data: Data = Object.fromEntries(new FormData(event.currentTarget).entries());
      Object.keys(data).forEach((key) => {
        if (data[key] === "") delete data[key];
      });
      ["age", "height", "age_min", "age_max", "height_min", "height_max", "amount"].forEach((key) => {
        if (data[key]) data[key] = Number(data[key]);
      });
      try {
        const body = transform ? transform(data) : data;
        if (method === "patch") await api.patch(endpoint, body);
        else await api.post(endpoint, body);
        toast.success("تم الحفظ بنجاح");
        done();
      } catch (error) {
        const status = (error as { status?: number }).status;
        toast.error(
          status === 422
            ? "راجع القيم المدخلة. بعض الحقول خارج الحدود المسموحة أو بصيغة غير صحيحة."
            : error instanceof Error
              ? error.message
              : "تعذر الحفظ",
        );
      } finally {
        setBusy(false);
      }
    },
  };
}

export function FemaleProfileForm({
  done,
  initial,
}: {
  done: () => void;
  initial?: Record<string, unknown> & { id?: string };
}) {
  const { busy, submit } = useSubmit(
    initial?.id ? `/matchmaker/female-profiles/${initial.id}` : "/matchmaker/female-profiles",
    done,
    (data) => {
    const desired_male = compactRecord({
      age_min: data.age_min,
      age_max: data.age_max,
      governorates: splitDomainList(data.desired_governorates, "preferenceGovernorate"),
      height_min: data.height_min,
      height_max: data.height_max,
      education: data.desired_education,
      profession_preference: data.profession_preference,
      marital_status: data.desired_marital_status,
      children_preference: booleanValue(data.desired_children_preference),
      religious_preference: data.desired_religious_preference,
      values: splitList(data.desired_values),
      traits: splitList(data.desired_traits),
    });
    const clean: Data = {
      ...data,
      children: booleanValue(data.children),
      personality_traits: splitList(data.personality_traits),
      values: splitList(data.values),
      desired_male,
    };
    [
      "age_min",
      "age_max",
      "desired_governorates",
      "height_min",
      "height_max",
      "desired_education",
      "profession_preference",
      "desired_marital_status",
      "desired_children_preference",
      "desired_religious_preference",
      "desired_values",
      "desired_traits",
    ].forEach((key) => delete clean[key]);
      return clean;
    },
    initial?.id ? "patch" : "post",
  );

  return (
    <form onSubmit={submit} className="space-y-6">
      <Section title="المعلومات الخاصة" hint="لا تدخل البحث ولا تظهر للشباب">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="الاسم الأول" name="first_name" minLength={2} maxLength={100} defaultValue={initial?.first_name} required />
          <Field label="اسم العائلة" name="last_name" maxLength={100} defaultValue={initial?.last_name} />
          <Field label="الهاتف" name="phone" minLength={8} maxLength={30} defaultValue={initial?.phone} required />
          <Field label="البريد" name="email" type="email" defaultValue={initial?.email} />
        </div>
        <label>
          <span className="label">العنوان الخاص</span>
          <textarea className="field" name="exact_address" defaultValue={String(initial?.exact_address || "")} />
        </label>
      </Section>

      <Section title="المعلومات القابلة للبحث">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="العمر" name="age" type="number" min={18} max={90} defaultValue={initial?.age} required />
          <Field label="المحافظة" name="governorate" options={gov} defaultValue={initial?.governorate} required />
          <Field label="المدينة" name="city" defaultValue={initial?.city} />
          <Field label="الطول (سم)" name="height" type="number" min={120} max={220} defaultValue={initial?.height} />
          <Field label="التعليم" name="education" options={domainOptions.education.map((option) => option.value)} defaultValue={initial?.education} />
          <Field label="المهنة" name="occupation" options={domainOptions.occupationFemale.map((option) => option.value)} defaultValue={initial?.occupation} />
          <Field label="الحالة الاجتماعية" name="marital_status" options={domainOptions.maritalFemale.map((option) => option.value)} defaultValue={initial?.marital_status} />
          <Field label="الأطفال" name="children" options={["true", "false"]} defaultValue={initial?.children} />
          <Field label="الحجاب" name="hijab_status" options={domainOptions.hijab.map((option) => option.value)} defaultValue={initial?.hijab_status} />
          <Field label="الدين" name="religious_preference" options={domainOptions.religion.map((option) => option.value)} defaultValue={initial?.religious_preference} />
          <Field label="درجة الالتزام" name="values" options={domainOptions.commitmentFemale.map((option) => option.value)} defaultValue={(initial?.values as unknown[] | undefined)?.[0]} />
          <Field label="الحالة" name="status" options={["DRAFT", "ACTIVE"]} defaultValue={initial?.status || "DRAFT"} required />
        </div>
        <label>
          <span className="label">صفات شخصية</span>
          <input className="field" name="personality_traits" defaultValue={listValue(initial?.personality_traits)} placeholder="مثال: هادئة، اجتماعية" />
        </label>
        <label>
          <span className="label">الملخص العام</span>
          <textarea className="field" name="public_summary" rows={3} defaultValue={String(initial?.public_summary || "")} />
        </label>
      </Section>

      <Section title="مواصفات الزوج المطلوب">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="العمر من" name="age_min" type="number" min={18} max={90} defaultValue={(initial?.desired_male as Record<string, unknown> | undefined)?.age_min} />
          <Field label="العمر إلى" name="age_max" type="number" min={18} max={90} defaultValue={(initial?.desired_male as Record<string, unknown> | undefined)?.age_max} />
          <Field label="محافظات الإقامة" name="desired_governorates" defaultValue={listValue((initial?.desired_male as Record<string, unknown> | undefined)?.governorates)} />
          <Field label="الطول الأدنى" name="height_min" type="number" min={120} max={230} defaultValue={(initial?.desired_male as Record<string, unknown> | undefined)?.height_min} />
          <Field label="الطول إلى" name="height_max" type="number" min={120} max={230} defaultValue={(initial?.desired_male as Record<string, unknown> | undefined)?.height_max} />
          <Field label="التعليم" name="desired_education" options={domainOptions.education.map((option) => option.value)} defaultValue={(initial?.desired_male as Record<string, unknown> | undefined)?.education} />
          <Field label="المهنة" name="profession_preference" options={domainOptions.occupationMale.map((option) => option.value)} defaultValue={(initial?.desired_male as Record<string, unknown> | undefined)?.profession_preference} />
          <Field
            label="الحالة الاجتماعية"
            name="desired_marital_status"
            options={domainOptions.maritalMale.map((option) => option.value)}
            defaultValue={(initial?.desired_male as Record<string, unknown> | undefined)?.marital_status}
          />
          <Field label="الأطفال" name="desired_children_preference" options={["true", "false"]} defaultValue={(initial?.desired_male as Record<string, unknown> | undefined)?.children_preference} />
          <Field label="الدين" name="desired_religious_preference" options={domainOptions.religion.map((option) => option.value)} defaultValue={(initial?.desired_male as Record<string, unknown> | undefined)?.religious_preference} />
          <Field label="درجة الالتزام" name="desired_values" options={domainOptions.commitmentMale.map((option) => option.value)} defaultValue={((initial?.desired_male as Record<string, unknown> | undefined)?.values as unknown[] | undefined)?.[0]} />
        </div>
        <label>
          <span className="label">صفات مطلوبة</span>
          <input className="field" name="desired_traits" defaultValue={listValue((initial?.desired_male as Record<string, unknown> | undefined)?.traits)} placeholder="مثال: مسؤول، هادئ" />
        </label>
      </Section>

      <Section title="طريقة التواصل">
        <Field
          label="التفضيل"
          name="contact_preference"
          options={["GUARDIAN_FIRST", "FAMILIES", "MATCHMAKER", "VIRTUAL_WITH_GUARDIAN", "OTHER"]}
          defaultValue={initial?.contact_preference || "MATCHMAKER"}
          required
        />
        <label>
          <span className="label">ملاحظات الخطابة</span>
          <textarea className="field" name="private_notes" rows={3} defaultValue={String(initial?.private_notes || "")} />
        </label>
      </Section>

      <Button className="w-full" disabled={busy}>
        {busy ? "جاري الحفظ..." : initial?.id ? "حفظ التعديلات" : "حفظ الملف"}
      </Button>
    </form>
  );
}

type WizardOption = { value: string; label: string };
type WizardStep = {
  key: string;
  title: string;
  hint?: string;
  type?: "text" | "number" | "textarea";
  options?: WizardOption[];
  required?: boolean;
  min?: number;
  max?: number;
};

const wizardOptions = {
  governorates: domainOptions.governorate.map((option) => ({ value: option.value, label: option.ar })),
  education: domainOptions.education.map((option) => ({ value: option.value, label: option.ar })),
  occupationFemale: domainOptions.occupationFemale.map((option) => ({ value: option.value, label: option.ar })),
  occupationMale: domainOptions.occupationMale.map((option) => ({ value: option.value, label: option.ar })),
  maritalFemale: domainOptions.maritalFemale.map((option) => ({ value: option.value, label: option.ar })),
  maritalMale: domainOptions.maritalMale.map((option) => ({ value: option.value, label: option.ar })),
  hijab: domainOptions.hijab.map((option) => ({ value: option.value, label: option.ar })),
  religion: domainOptions.religion.map((option) => ({ value: option.value, label: option.ar })),
  commitmentFemale: domainOptions.commitmentFemale.map((option) => ({ value: option.value, label: option.ar })),
  commitmentMale: domainOptions.commitmentMale.map((option) => ({ value: option.value, label: option.ar })),
  yesNo: [
    { value: "false", label: "لا" },
    { value: "true", label: "نعم" },
  ],
  status: [
    { value: "DRAFT", label: "مسودة" },
    { value: "ACTIVE", label: "نشط" },
  ],
};

const femaleWizardSteps: WizardStep[] = [
  { key: "first_name", title: "ما اسم الفتاة؟", hint: "الاسم الأول فقط يكفي داخل النظام.", required: true },
  { key: "phone", title: "ما رقم الهاتف؟", hint: "يبقى الرقم خاصا ولا يظهر للشباب.", required: true },
  { key: "age", title: "كم عمرها؟", type: "number", required: true, min: 18, max: 90 },
  { key: "governorate", title: "أين تقيم حاليا؟", options: wizardOptions.governorates, required: true },
  { key: "city", title: "ما المدينة؟", hint: "اختياري، يمكن تخطيه." },
  { key: "height", title: "ما طولها؟", hint: "بالسنتيمتر.", type: "number", min: 120, max: 220 },
  { key: "education", title: "ما مستواها التعليمي؟", options: wizardOptions.education },
  { key: "occupation", title: "ما وضعها المهني؟", options: wizardOptions.occupationFemale },
  { key: "marital_status", title: "ما حالتها الاجتماعية؟", options: wizardOptions.maritalFemale },
  { key: "children", title: "هل لديها أطفال؟", options: wizardOptions.yesNo },
  { key: "hijab_status", title: "ما طبيعة اللباس؟", options: wizardOptions.hijab },
  { key: "religious_preference", title: "ما الدين أو الخلفية الدينية؟", options: wizardOptions.religion },
  { key: "values", title: "كيف تصفين درجة الالتزام؟", options: wizardOptions.commitmentFemale },
  { key: "personality_traits", title: "صفات شخصية مهمة", hint: "مثال: هادئة، اجتماعية، مسؤولة. افصلي بينها بفواصل.", type: "textarea" },
  { key: "public_summary", title: "ملخص عام مختصر", hint: "نص يساعد الخطّابة على تذكر الملف.", type: "textarea" },
  { key: "age_min", title: "العمر المطلوب للزوج من", type: "number", min: 18, max: 90 },
  { key: "age_max", title: "العمر المطلوب للزوج إلى", type: "number", min: 18, max: 90 },
  { key: "desired_governorates", title: "محافظات إقامة الزوج المقبولة", hint: "يمكن كتابة أكثر من محافظة بفواصل.", type: "textarea" },
  { key: "height_min", title: "الطول الأدنى للزوج", type: "number", min: 120, max: 230 },
  { key: "height_max", title: "الطول الأعلى للزوج", type: "number", min: 120, max: 230 },
  { key: "desired_education", title: "تعليم الزوج المفضل", options: wizardOptions.education },
  { key: "profession_preference", title: "مهنة الزوج المفضلة", options: wizardOptions.occupationMale },
  { key: "desired_marital_status", title: "الحالة الاجتماعية المقبولة للزوج", options: wizardOptions.maritalMale },
  { key: "desired_children_preference", title: "هل تقبل بزوج لديه أطفال؟", options: wizardOptions.yesNo },
  { key: "desired_religious_preference", title: "الدين أو الخلفية الدينية المقبولة", options: wizardOptions.religion },
  { key: "desired_values", title: "درجة الالتزام المطلوبة", options: wizardOptions.commitmentMale },
  { key: "desired_traits", title: "صفات مطلوبة بالزوج", hint: "مثال: مسؤول، هادئ، كريم. افصلي بينها بفواصل.", type: "textarea" },
  { key: "status", title: "هل تريدين تفعيل الملف الآن؟", options: wizardOptions.status, required: true },
];

function wizardDisplayValue(step: WizardStep, value: string) {
  return step.options?.find((option) => option.value === value)?.label || value;
}

function normalizeWizardNumber(value: string) {
  const trimmed = value.trim();
  return trimmed ? Number(trimmed) : undefined;
}

export function FemaleProfileWizard({ done }: { done: () => void }) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({ status: "DRAFT" });
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const step = femaleWizardSteps[index];
  const progress = Math.round(((index + 1) / femaleWizardSteps.length) * 100);
  const answered = useMemo(
    () => femaleWizardSteps.filter((item) => answers[item.key]).length,
    [answers],
  );

  const goTo = (nextIndex: number) => {
    const target = femaleWizardSteps[nextIndex];
    setIndex(nextIndex);
    setValue(target ? answers[target.key] || "" : "");
  };

  const saveCurrent = () => {
    const next = value.trim();
    if (step.required && !next) {
      toast.error("هذا الحقل مطلوب");
      return false;
    }
    if (step.type === "number" && next) {
      const number = Number(next);
      if (!Number.isFinite(number) || (step.min && number < step.min) || (step.max && number > step.max)) {
        toast.error("راجعي الرقم المدخل");
        return false;
      }
    }
    setAnswers((old) => ({ ...old, [step.key]: next }));
    return true;
  };

  const next = () => {
    if (!saveCurrent()) return;
    if (index < femaleWizardSteps.length - 1) goTo(index + 1);
  };

  const back = () => {
    setAnswers((old) => ({ ...old, [step.key]: value.trim() }));
    if (index > 0) goTo(index - 1);
  };

  const submit = async () => {
    if (!saveCurrent()) return;
    const data = { ...answers, [step.key]: value.trim() };
    const desired_male = compactRecord({
      age_min: normalizeWizardNumber(data.age_min || ""),
      age_max: normalizeWizardNumber(data.age_max || ""),
      governorates: splitDomainList(data.desired_governorates, "preferenceGovernorate"),
      height_min: normalizeWizardNumber(data.height_min || ""),
      height_max: normalizeWizardNumber(data.height_max || ""),
      education: data.desired_education || undefined,
      profession_preference: data.profession_preference || undefined,
      marital_status: data.desired_marital_status || undefined,
      children_preference: booleanValue(data.desired_children_preference),
      religious_preference: data.desired_religious_preference || undefined,
      values: splitList(data.desired_values),
      traits: splitList(data.desired_traits),
    });
    const payload = compactRecord({
      first_name: data.first_name,
      phone: data.phone,
      age: normalizeWizardNumber(data.age || ""),
      governorate: data.governorate,
      city: data.city || undefined,
      height: normalizeWizardNumber(data.height || ""),
      education: data.education || undefined,
      occupation: data.occupation || undefined,
      marital_status: data.marital_status || undefined,
      children: booleanValue(data.children),
      hijab_status: data.hijab_status || undefined,
      religious_preference: data.religious_preference || undefined,
      personality_traits: splitList(data.personality_traits),
      values: splitList(data.values),
      public_summary: data.public_summary || undefined,
      desired_male,
      contact_preference: "MATCHMAKER",
      status: data.status || "DRAFT",
    });
    setBusy(true);
    try {
      await api.post("/matchmaker/female-profiles", payload);
      toast.success("تم حفظ ملف الفتاة بنجاح");
      done();
    } catch (error) {
      toast.error((error as { status?: number }).status === 422 ? "راجعي القيم المدخلة." : error instanceof Error ? error.message : "تعذر الحفظ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 flex items-center justify-between text-sm text-slate-500">
          <span>سؤال {index + 1} من {femaleWizardSteps.length}</span>
          <span>{answered} إجابة محفوظة</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-brand-pink">
          <div className="h-full rounded-full bg-brand-rose transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>
      <section className="rounded-2xl border bg-white p-5">
        <h3 className="text-xl font-bold">{step.title}</h3>
        {step.hint && <p className="mt-2 text-sm leading-6 text-slate-500">{step.hint}</p>}
        {step.options ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {step.options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setValue(option.value)}
                className={`rounded-full border px-4 py-2 text-sm transition ${value === option.value ? "border-brand-rose bg-brand-pink text-brand-rose" : "border-slate-200 bg-white hover:border-brand-rose"}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : step.type === "textarea" ? (
          <textarea className="field mt-5 min-h-28 resize-none" value={value} onChange={(event) => setValue(event.target.value)} />
        ) : (
          <input className="field mt-5" type={step.type || "text"} min={step.min} max={step.max} value={value} onChange={(event) => setValue(event.target.value)} />
        )}
      </section>
      <div className="rounded-2xl bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-600">آخر الإجابات</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {femaleWizardSteps.filter((item) => answers[item.key]).slice(-6).map((item) => (
            <button key={item.key} type="button" onClick={() => goTo(femaleWizardSteps.indexOf(item))} className="rounded-xl bg-white p-3 text-start text-sm hover:ring-1 hover:ring-brand-rose">
              <span className="block text-xs text-slate-400">{item.title}</span>
              <span className="mt-1 block font-semibold">{wizardDisplayValue(item, answers[item.key])}</span>
            </button>
          ))}
          {!answered && <p className="text-sm text-slate-400">ابدئي بالإجابة، وسنحفظها خطوة بخطوة.</p>}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="outline" disabled={index === 0 || busy} onClick={back}>
          <ChevronRight size={17} /> السابق
        </Button>
        {index === femaleWizardSteps.length - 1 ? (
          <Button type="button" disabled={busy} onClick={() => void submit()}>
            <CheckCircle2 size={17} /> {busy ? "جاري الحفظ..." : "حفظ الملف"}
          </Button>
        ) : (
          <Button type="button" disabled={busy} onClick={next}>
            التالي <ChevronLeft size={17} />
          </Button>
        )}
      </div>
    </div>
  );
}

export function MatchmakerForm({ done }: { done: () => void }) {
  const { busy, submit } = useSubmit("/admin/matchmakers", done, (data) => ({
    ...data,
    governorates: [String(data.governorate)],
    permissions: String(data.permissions || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    governorate: undefined,
  }));
  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <Field label="الاسم" name="first_name" required />
      <Field label="الهاتف" name="phone" required />
      <Field label="البريد" name="email" type="email" />
      <Field label="المحافظة" name="governorate" options={gov} required />
      <Field label="كلمة المرور المؤقتة" name="password" type="password" required />
      <label className="sm:col-span-2">
        <span className="label">الصلاحيات (مفصولة بفاصلة)</span>
        <input className="field" name="permissions" placeholder="female_profiles.manage, male_requests.view" />
      </label>
      <Button className="sm:col-span-2" disabled={busy}>
        {busy ? "جاري الحفظ..." : "إنشاء حساب الخطابة"}
      </Button>
    </form>
  );
}

export function PaymentForm({ done }: { done: () => void }) {
  const { busy, submit } = useSubmit("/matchmaker/payments", done);
  const [showOptional, setShowOptional] = useState(false);
  const [currency, setCurrency] = useState("");
  const [fee, setFee] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.get<Record<string, unknown>>("/matchmaker/settings")
      .then((settings) => {
        const value = Number(settings.contact_opening_fee ?? 0);
        if (!cancelled && Number.isFinite(value)) setFee(value);
      })
      .catch(() => {
        if (!cancelled) setFee(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <MaleRequestPicker required />
      <label>
        <span className="label">العملة *</span>
        <select className="field" name="currency" required value={currency} onChange={(event) => setCurrency(event.target.value)}>
          <option value="">اختر</option>
          {["SYP", "USD"].map((value) => (
            <option key={value} value={value}>
              {selectLabel("currency", value)}
            </option>
          ))}
        </select>
      </label>
      <Field label="الحالة" name="status" options={["PENDING", "PAID", "WAIVED"]} required />
      <div className="rounded-xl border border-brand-rose/15 bg-brand-pink/50 p-4 sm:col-span-2">
        <span className="block text-xs font-semibold text-slate-500">قيمة الأتعاب</span>
        <strong className="mt-1 block text-lg text-brand-rose">
          {fee === null ? "غير محددة" : currency ? formatMoney(fee, currency) : formatNumber(fee)}
        </strong>
        <p className="mt-1 text-xs text-slate-500">تؤخذ هذه القيمة من إعدادات النظام ولا تحتاجين لإدخالها يدويا.</p>
      </div>
      <button
        type="button"
        className="text-start text-sm font-semibold text-brand-rose underline-offset-4 hover:underline sm:col-span-2"
        onClick={() => setShowOptional((value) => !value)}
      >
        {showOptional ? "إخفاء التفاصيل الاختيارية" : "إضافة تفاصيل اختيارية"}
      </button>
      {showOptional && (
        <div className="grid gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4 sm:col-span-2 sm:grid-cols-2">
          <Field label="معرف الحالة" name="match_case_id" />
          <Field label="طريقة الدفع" name="method" />
          <Field label="المرجع" name="reference" />
        </div>
      )}
      <Button className="sm:col-span-2" disabled={busy}>
        {busy ? "جاري الحفظ..." : "تسجيل الدفعة"}
      </Button>
    </form>
  );
}

export function MeetingForm({ done }: { done: () => void }) {
  const { busy, submit } = useSubmit("/matchmaker/meetings", done, (data) => ({
    ...data,
    participants: String(data.participants || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  }));
  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <Field label="معرف الحالة" name="match_case_id" required />
      <Field label="نوع اللقاء" name="meeting_type" options={["VIRTUAL", "IN_PERSON", "FAMILY", "MATCHMAKER_PRESENT"]} required />
      <Field label="التاريخ والوقت" name="scheduled_at" type="datetime-local" required />
      <Field label="المكان أو الرابط" name="location_or_link" />
      <label className="sm:col-span-2">
        <span className="label">المشاركون (مفصولون بفاصلة)</span>
        <input className="field" name="participants" />
      </label>
      <label className="sm:col-span-2">
        <span className="label">ملاحظات</span>
        <textarea className="field" name="notes" />
      </label>
      <Button className="sm:col-span-2" disabled={busy}>
        {busy ? "جاري الحفظ..." : "جدولة اللقاء"}
      </Button>
    </form>
  );
}
