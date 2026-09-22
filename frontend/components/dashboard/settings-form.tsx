"use client";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/ui/feedback";
import { api } from "@/services/api";
type Settings = Record<string, string | number | boolean | null>;
const labels: Record<string, string> = {
  minimum_match_score: "الحد الأدنى للتوافق",
  maximum_candidates: "الحد الأقصى للمرشحات",
  contact_opening_fee: "أتعاب فتح التواصل",
  success_fee: "أتعاب النجاح",
  allow_multiple_serious_matches: "السماح بأكثر من تواصل جاد",
  male_registration_enabled: "تسجيل الشباب متاح",
  female_leads_enabled: "طلبات الفتيات متاحة",
  support_phone: "هاتف الدعم",
  support_whatsapp: "واتساب الدعم",
  default_matchmaker_assignment: "التعيين الافتراضي للخطّابة",
  maintenance_mode: "وضع الصيانة",
};
export function SettingsForm() {
  const [data, setData] = useState<Settings>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api.get("/admin/settings"));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر التحميل");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Fetch external API data on mount or scope change.
    void load();
  }, [load]);
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} retry={load} />;
  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const out: Settings = {};
    Object.entries(data || {}).forEach(([k, v]) => {
      if (typeof v === "boolean") out[k] = form.get(k) === "on";
      else if (typeof v === "number") out[k] = Number(form.get(k));
      else if (k === "default_matchmaker_assignment") out[k] = String(form.get(k) || "") || null;
      else out[k] = String(form.get(k) || "");
    });
    try {
      const saved = await api.patch<Settings>("/admin/settings", {
        values: out,
      });
      setData((current) => ({ ...(current || {}), ...saved }));
      toast.success("تم حفظ إعدادات النظام");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر الحفظ");
    }
  };
  return (
    <div>
      <h2 className="text-2xl font-bold">إعدادات النظام</h2>
      <p className="mt-1 text-sm text-slate-500">
        قيم تشغيلية تطبق في الخادم دون تعديل الكود.
      </p>
      <form onSubmit={save} className="panel mt-6 grid gap-5 sm:grid-cols-2">
        {Object.entries(data || {})
          .filter(([k]) => k in labels)
          .map(([k, v]) => (
            <label
              key={k}
              className={
                typeof v === "boolean"
                  ? "flex items-center justify-between rounded-xl bg-slate-50 p-4"
                  : ""
              }
            >
              <span className="label">{labels[k]}</span>
              {typeof v === "boolean" ? (
                <input
                  type="checkbox"
                  name={k}
                  defaultChecked={v}
                  className="h-5 w-5 accent-brand-rose"
                />
              ) : (
                <input
                  className="field"
                  name={k}
                  type={typeof v === "number" ? "number" : "text"}
                  defaultValue={String(v ?? "")}
                />
              )}
            </label>
          ))}
        <div className="sm:col-span-2">
          <Button>حفظ الإعدادات</Button>
        </div>
      </form>
    </div>
  );
}
