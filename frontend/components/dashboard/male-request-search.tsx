"use client";

import { CheckCircle2, Pencil, Search, ShieldCheck, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState, LoadingState } from "@/components/ui/feedback";
import { StatusBadge } from "@/components/ui/status";
import { api } from "@/services/api";
import type { MaleRequest } from "@/types";

type Candidate = {
  id: string;
  female_profile_id: string;
  mutual_score: number;
  male_to_female_score?: number;
  female_to_male_score?: number;
  status: string;
};
type Detail = { request: MaleRequest; candidates: Candidate[] };
type Row = { label: string; value: unknown };

const enumLabels: Record<string, string> = {
  SINGLE: "أعزب / عزباء",
  DIVORCED: "منفصل / منفصلة",
  WIDOWED: "أرمل / أرملة",
  MARRIED: "متزوج / متزوجة",
  HIJAB: "محجبة",
  NIQAB: "منقبة",
  NONE: "لا",
  OTHER: "أخرى",
  PENDING: "قيد الانتظار",
  VERIFIED: "موثق",
  REJECTED: "مرفوض",
  ACTIVE: "نشط",
  true: "نعم",
  false: "لا",
};

function present(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (Array.isArray(value)) return value.map(present).filter(Boolean).join("، ") || null;
  if (typeof value === "object") return null;
  if (typeof value === "boolean") return value ? "نعم" : "لا";
  if (typeof value === "string") return enumLabels[value] || value;
  return String(value);
}

function textValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

function range(min?: unknown, max?: unknown, unit = "") {
  const a = present(min);
  const b = present(max);
  if (a && b) return `${a}-${b}${unit}`;
  if (a) return `من ${a}${unit}`;
  if (b) return `حتى ${b}${unit}`;
  return null;
}

function numberValue(value: FormDataEntryValue | null) {
  const text = String(value || "").trim();
  return text ? Number(text) : undefined;
}

function splitList(value: FormDataEntryValue | null) {
  return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

function DetailRows({ rows }: { rows: Row[] }) {
  const visible = rows.map((row) => ({ ...row, text: present(row.value) })).filter((row) => Boolean(row.text));
  if (!visible.length) return <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">لا توجد بيانات محددة بعد.</p>;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {visible.map((row) => (
        <div key={row.label} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs font-semibold text-slate-400">{row.label}</p>
          <p className="mt-1 font-semibold leading-7 text-slate-800">{row.text}</p>
        </div>
      ))}
    </div>
  );
}

function EditInput({ label, name, value, type = "text", min, max, required }: { label: string; name: string; value: unknown; type?: string; min?: number; max?: number; required?: boolean }) {
  return (
    <label>
      <span className="label">{label}</span>
      <input className="field" name={name} type={type} min={min} max={max} defaultValue={textValue(value)} required={required} />
    </label>
  );
}

function EditSelect({ label, name, value, options }: { label: string; name: string; value: unknown; options: string[] }) {
  return (
    <label>
      <span className="label">{label}</span>
      <select className="field" name={name} defaultValue={value === null || value === undefined ? "" : String(value)}>
        <option value="">اختر</option>
        {options.map((option) => <option key={option} value={option}>{enumLabels[option] || option}</option>)}
      </select>
    </label>
  );
}

function RequestDetails({ request, onSaved }: { request: MaleRequest; onSaved: (detail: Detail) => void }) {
  const male = request.male_characteristics || {};
  const desired = request.desired_female_characteristics || {};
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const maleRows: Row[] = [
    { label: "العمر", value: male.age },
    { label: "المحافظة الحالية", value: male.governorate },
    { label: "المدينة", value: male.city },
    { label: "الحالة الاجتماعية", value: male.marital_status },
    { label: "الطول", value: male.height ? `${male.height} سم` : null },
    { label: "التعليم", value: male.education },
    { label: "الاختصاص", value: male.education_field },
    { label: "العمل", value: male.occupation },
    { label: "الوضع المهني", value: male.employment_status },
    { label: "الديانة", value: male.religious_preference },
    { label: "الأطفال", value: male.children },
    { label: "القيم", value: male.values },
    { label: "المواصفات الإضافية", value: male.personality_traits },
  ];
  const desiredRows: Row[] = [
    { label: "الحالة الاجتماعية المطلوبة", value: desired.marital_status },
    { label: "العمر المطلوب", value: range(desired.age_min, desired.age_max, " سنة") },
    { label: "محافظة الإقامة", value: desired.governorates || desired.governorate },
    { label: "الطول", value: range(desired.height_min, desired.height_max, " سم") },
    { label: "التعليم", value: desired.education },
    { label: "الوضع المهني", value: desired.occupation || desired.profession_preference },
    { label: "الأطفال", value: desired.children_preference ?? desired.children },
    { label: "الديانة", value: desired.religious_preference },
    { label: "اللباس", value: desired.hijab_status },
    { label: "القيم", value: desired.values },
    { label: "المواصفات الإضافية", value: desired.other_criteria || desired.traits || desired.personality_traits },
  ];

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    const form = new FormData(event.currentTarget);
    const body = {
      male_characteristics: {
        ...male,
        age: numberValue(form.get("male.age")),
        governorate: String(form.get("male.governorate") || ""),
        city: String(form.get("male.city") || "") || null,
        marital_status: String(form.get("male.marital_status") || "") || null,
        height: numberValue(form.get("male.height")),
        education: String(form.get("male.education") || "") || null,
        education_field: String(form.get("male.education_field") || "") || null,
        occupation: String(form.get("male.occupation") || "") || null,
        employment_status: String(form.get("male.employment_status") || "") || null,
        religious_preference: String(form.get("male.religious_preference") || "") || null,
        children: form.get("male.children") === "" ? null : form.get("male.children") === "true",
        values: splitList(form.get("male.values")),
        personality_traits: splitList(form.get("male.personality_traits")),
      },
      desired_female_characteristics: {
        ...desired,
        age_min: numberValue(form.get("desired.age_min")),
        age_max: numberValue(form.get("desired.age_max")),
        governorates: splitList(form.get("desired.governorates")),
        height_min: numberValue(form.get("desired.height_min")),
        height_max: numberValue(form.get("desired.height_max")),
        education: String(form.get("desired.education") || "") || null,
        occupation: String(form.get("desired.occupation") || "") || null,
        profession_preference: String(form.get("desired.profession_preference") || "") || null,
        marital_status: String(form.get("desired.marital_status") || "") || null,
        children_preference: form.get("desired.children_preference") === "" ? null : form.get("desired.children_preference") === "true",
        hijab_status: String(form.get("desired.hijab_status") || "") || null,
        religious_preference: String(form.get("desired.religious_preference") || "") || null,
        values: splitList(form.get("desired.values")),
        traits: splitList(form.get("desired.traits")),
        other_criteria: String(form.get("desired.other_criteria") || "") || null,
      },
    };
    try {
      const saved = await api.patch<Detail>(`/matchmaker/male-requests/${request.request_code}`, body);
      onSaved(saved);
      setEditing(false);
      toast.success("تم حفظ التعديلات وتحديث المطابقة");
    } catch (e) {
      toast.error((e as { status?: number }).status === 422 ? "راجع القيم المدخلة." : e instanceof Error ? e.message : "تعذر الحفظ");
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <form className="space-y-5" onSubmit={submit}>
        <section className="panel">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-lg font-bold">معلومات الشاب</h3>
            <Button type="button" variant="outline" onClick={() => setEditing(false)}>إلغاء</Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <EditInput label="العمر" name="male.age" type="number" min={18} max={90} value={male.age} required />
            <EditInput label="المحافظة الحالية" name="male.governorate" value={male.governorate} required />
            <EditInput label="المدينة" name="male.city" value={male.city} />
            <EditSelect label="الحالة الاجتماعية" name="male.marital_status" value={male.marital_status} options={["SINGLE", "DIVORCED", "WIDOWED", "MARRIED"]} />
            <EditInput label="الطول" name="male.height" type="number" min={120} max={230} value={male.height} />
            <EditInput label="التعليم" name="male.education" value={male.education} />
            <EditInput label="الاختصاص" name="male.education_field" value={male.education_field} />
            <EditInput label="العمل" name="male.occupation" value={male.occupation} />
            <EditInput label="الوضع المهني" name="male.employment_status" value={male.employment_status} />
            <EditInput label="الديانة" name="male.religious_preference" value={male.religious_preference} />
            <EditSelect label="الأطفال" name="male.children" value={male.children} options={["true", "false"]} />
            <EditInput label="القيم" name="male.values" value={male.values} />
            <EditInput label="المواصفات الإضافية" name="male.personality_traits" value={male.personality_traits} />
          </div>
        </section>
        <section className="panel">
          <h3 className="mb-4 text-lg font-bold">مواصفات الزوجة المطلوبة</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <EditInput label="العمر من" name="desired.age_min" type="number" min={18} max={90} value={desired.age_min} required />
            <EditInput label="العمر إلى" name="desired.age_max" type="number" min={18} max={90} value={desired.age_max} required />
            <EditInput label="المحافظات" name="desired.governorates" value={desired.governorates || desired.governorate} />
            <EditInput label="الطول من" name="desired.height_min" type="number" min={120} max={230} value={desired.height_min} />
            <EditInput label="الطول إلى" name="desired.height_max" type="number" min={120} max={230} value={desired.height_max} />
            <EditInput label="التعليم" name="desired.education" value={desired.education} />
            <EditInput label="العمل" name="desired.occupation" value={desired.occupation} />
            <EditInput label="المهنة" name="desired.profession_preference" value={desired.profession_preference} />
            <EditSelect label="الحالة الاجتماعية" name="desired.marital_status" value={desired.marital_status} options={["SINGLE", "DIVORCED", "WIDOWED"]} />
            <EditSelect label="الأطفال" name="desired.children_preference" value={desired.children_preference ?? desired.children} options={["true", "false"]} />
            <EditSelect label="اللباس" name="desired.hijab_status" value={desired.hijab_status} options={["HIJAB", "NIQAB", "NONE", "OTHER"]} />
            <EditInput label="الديانة" name="desired.religious_preference" value={desired.religious_preference} />
            <EditInput label="القيم" name="desired.values" value={desired.values} />
            <EditInput label="الصفات" name="desired.traits" value={desired.traits} />
            <EditInput label="مواصفات إضافية" name="desired.other_criteria" value={desired.other_criteria || desired.personality_traits} />
          </div>
          <Button className="mt-5 w-full" disabled={saving}>{saving ? "جاري الحفظ..." : "حفظ التعديلات"}</Button>
        </section>
      </form>
    );
  }

  return (
    <div className="space-y-5">
      <section className="panel">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-bold">معلومات الشاب</h3>
          <Button variant="outline" onClick={() => setEditing(true)}><Pencil size={17} /> تعديل</Button>
        </div>
        <div className="mt-4"><DetailRows rows={maleRows} /></div>
      </section>
      <section className="panel">
        <h3 className="text-lg font-bold">مواصفات الزوجة المطلوبة</h3>
        <div className="mt-4"><DetailRows rows={desiredRows} /></div>
      </section>
    </div>
  );
}

export function MaleRequestSearch() {
  const [code, setCode] = useState("");
  const [data, setData] = useState<Detail>();
  const [requests, setRequests] = useState<MaleRequest[]>([]);
  const [busy, setBusy] = useState(false);
  const [loadingList, setLoadingList] = useState(true);

  const loadRequests = async () => {
    try {
      setRequests(await api.get<MaleRequest[]>("/matchmaker/male-requests"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر تحميل الطلبات");
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadRequests();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const search = async (requestCode = code) => {
    if (!requestCode.trim()) return;
    setBusy(true);
    try {
      const normalizedCode = requestCode.trim().toUpperCase();
      setCode(normalizedCode);
      setData(await api.get<Detail>(`/matchmaker/male-requests/${encodeURIComponent(normalizedCode)}`));
    } catch (e) {
      setData(undefined);
      toast.error(e instanceof Error ? e.message : "الطلب غير موجود");
    } finally {
      setBusy(false);
    }
  };

  const verify = async (status: "VERIFIED" | "REJECTED") => {
    if (!data) return;
    try {
      await api.post(`/matchmaker/male-requests/${data.request.request_code}/verify?status=${status}`);
      toast.success(status === "VERIFIED" ? "تم توثيق الطلب" : "تم رفض التحقق");
      void search();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر التحديث");
    }
  };

  const match = async () => {
    if (!data) return;
    try {
      await api.post(`/matchmaker/male-requests/${data.request.request_code}/matching/run`);
      toast.success("اكتملت المطابقة المتبادلة");
      void search();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر تشغيل المطابقة");
    }
  };

  return (
    <div dir="rtl">
      <h2 className="text-2xl font-bold">طلبات الشباب</h2>
      <p className="mt-1 text-sm text-slate-500">ابحث برقم الطلب أو افتح طلبا من القائمة لمراجعة البيانات وتعديلها وتشغيل المطابقة.</p>
      <div className="panel mt-6 flex gap-3">
        <input dir="ltr" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === "Enter" && void search()} className="field font-mono" placeholder="FRH-XXXX-XXXX-XXXX-XXXX" />
        <Button onClick={() => void search()} disabled={busy}><Search size={17} /> بحث</Button>
      </div>
      {busy ? <LoadingState /> : data ? (
        <div className="mt-5 space-y-5">
          <section className="panel">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-slate-500">رقم الطلب</p>
                <h3 className="font-mono text-xl font-bold" dir="ltr">{data.request.request_code}</h3>
              </div>
              <StatusBadge status={data.request.verification_status} />
              <p className="text-sm text-slate-500">تاريخ الإنشاء: {data.request.created_at ? new Date(data.request.created_at).toLocaleDateString("ar-SY") : "غير محدد"}</p>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              {data.request.verification_status !== "VERIFIED" && <Button onClick={() => void verify("VERIFIED")}><ShieldCheck size={17} /> توثيق الشاب</Button>}
              <Button variant="outline" onClick={() => void verify("REJECTED")}><XCircle size={17} /> رفض التحقق</Button>
              <Button variant="outline" onClick={() => void match()}><CheckCircle2 size={17} /> تشغيل المطابقة</Button>
            </div>
          </section>
          <RequestDetails request={data.request} onSaved={setData} />
          <section className="panel">
            <h3 className="mb-4 font-bold">نتائج التوافق ({data.candidates.length})</h3>
            {data.candidates.length ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.candidates.map((candidate) => (
                  <div key={candidate.id} className="rounded-lg bg-slate-50 p-4">
                    <div className="flex justify-between gap-3">
                      <span className="font-mono text-xs">{candidate.female_profile_id}</span>
                      <StatusBadge status={candidate.status} />
                    </div>
                    <strong className="mt-3 block text-brand-rose">{candidate.mutual_score}% توافق متبادل</strong>
                    <p className="mt-2 text-xs leading-6 text-slate-500">توافق تفضيلات الشاب: {candidate.male_to_female_score ?? "غير محدد"}%، وتوافق تفضيلات الفتاة: {candidate.female_to_male_score ?? "غير محدد"}%.</p>
                    <Button className="mt-3 w-full" size="sm" onClick={async () => {
                      try {
                        await api.post("/matchmaker/match-cases", { candidate_id: candidate.id });
                        toast.success("تم إنشاء حالة التواصل");
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "تعذر إنشاء الحالة");
                      }
                    }}>اختيار وفتح حالة</Button>
                  </div>
                ))}
              </div>
            ) : <EmptyState title="لا توجد فرص بعد" description="تحقق من الطلب ثم شغل المطابقة." />}
          </section>
          <section className="panel">
            <h3 className="font-bold">سجل الحالة</h3>
            <p className="mt-2 text-sm text-slate-500">حالة الطلب الحالية: {present(data.request.workflow_status) || "غير محدد"}</p>
          </section>
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          {loadingList ? <LoadingState /> : requests.length ? (
            <section className="panel">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold">الطلبات المتاحة</h3>
                  <p className="mt-1 text-sm text-slate-500">اختر طلبا من القائمة أو ابحث برقمه.</p>
                </div>
                <Button variant="outline" onClick={() => void loadRequests()}>تحديث</Button>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {requests.map((request) => (
                  <button type="button" key={request.id} onClick={() => void search(request.request_code)} className="rounded-lg border border-slate-100 bg-slate-50 p-4 text-start transition hover:border-brand-rose hover:bg-white">
                    <span className="block font-mono text-sm font-bold" dir="ltr">{request.request_code}</span>
                    <span className="mt-3 inline-block"><StatusBadge status={request.verification_status} /></span>
                    <span className="mt-3 block text-xs text-slate-500">{request.created_at ? new Date(request.created_at).toLocaleDateString("ar-SY") : "تاريخ غير محدد"}</span>
                  </button>
                ))}
              </div>
            </section>
          ) : <EmptyState title="لا توجد طلبات بعد" description="عندما ينشئ شاب طلبا جديدا سيظهر هنا تلقائيا." />}
          <EmptyState title="ابدأ برقم الطلب" description="ستظهر معلومات الشاب ومواصفات الزوجة ونتائج المطابقة هنا." />
        </div>
      )}
    </div>
  );
}
