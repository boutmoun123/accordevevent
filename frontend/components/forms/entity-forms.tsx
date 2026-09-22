"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/services/api";

const gov = [
  "دمشق",
  "ريف دمشق",
  "حلب",
  "حمص",
  "حماة",
  "اللاذقية",
  "طرطوس",
  "درعا",
  "السويداء",
  "إدلب",
  "دير الزور",
  "الحسكة",
  "الرقة",
];

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
};

type Data = Record<string, FormDataEntryValue | number | boolean | Record<string, unknown> | string[]>;

function optionLabel(value: string) {
  return optionLabels[value] || value.replaceAll("_", " ");
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
        <select className="field" name={name} required={required} defaultValue={String(defaultValue || "")}>
          <option value="">اختر</option>
          {options.map((value) => (
            <option key={value} value={value}>
              {optionLabel(value)}
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
    const desired_male = {
      age_min: data.age_min,
      age_max: data.age_max,
      height_min: data.height_min,
      education: data.desired_education,
      profession_preference: data.profession_preference,
      marital_status: data.desired_marital_status,
    };
    const clean: Data = { ...data, desired_male };
    [
      "age_min",
      "age_max",
      "height_min",
      "desired_education",
      "profession_preference",
      "desired_marital_status",
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
          <Field label="التعليم" name="education" defaultValue={initial?.education} />
          <Field label="المهنة" name="occupation" defaultValue={initial?.occupation} />
          <Field label="الحالة الاجتماعية" name="marital_status" options={["SINGLE", "DIVORCED", "WIDOWED"]} defaultValue={initial?.marital_status} />
          <Field label="الحجاب" name="hijab_status" options={["HIJAB", "NIQAB", "NONE", "OTHER"]} defaultValue={initial?.hijab_status} />
          <Field label="الحالة" name="status" options={["DRAFT", "ACTIVE"]} defaultValue={initial?.status || "DRAFT"} required />
        </div>
        <label>
          <span className="label">الملخص العام</span>
          <textarea className="field" name="public_summary" rows={3} defaultValue={String(initial?.public_summary || "")} />
        </label>
      </Section>

      <Section title="مواصفات الزوج المطلوب">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="العمر من" name="age_min" type="number" min={18} max={90} defaultValue={(initial?.desired_male as Record<string, unknown> | undefined)?.age_min} />
          <Field label="العمر إلى" name="age_max" type="number" min={18} max={90} defaultValue={(initial?.desired_male as Record<string, unknown> | undefined)?.age_max} />
          <Field label="الطول الأدنى" name="height_min" type="number" min={120} max={230} defaultValue={(initial?.desired_male as Record<string, unknown> | undefined)?.height_min} />
          <Field label="التعليم" name="desired_education" defaultValue={(initial?.desired_male as Record<string, unknown> | undefined)?.education} />
          <Field label="المهنة" name="profession_preference" defaultValue={(initial?.desired_male as Record<string, unknown> | undefined)?.profession_preference} />
          <Field
            label="الحالة الاجتماعية"
            name="desired_marital_status"
            options={["SINGLE", "DIVORCED", "WIDOWED"]}
            defaultValue={(initial?.desired_male as Record<string, unknown> | undefined)?.marital_status}
          />
        </div>
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
  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <Field label="معرف طلب الشاب" name="male_request_id" required />
      <Field label="معرف الحالة" name="match_case_id" />
      <p className="text-sm text-slate-500">تحدد قيمة الأتعاب من إعدادات النظام.</p>
      <Field label="العملة" name="currency" options={["SYP", "USD"]} required />
      <Field label="الحالة" name="status" options={["PENDING", "PAID", "WAIVED"]} required />
      <Field label="طريقة الدفع" name="method" />
      <Field label="المرجع" name="reference" />
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
