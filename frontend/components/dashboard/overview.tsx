"use client";
import { Activity, UsersRound } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ErrorState, LoadingState, EmptyState } from "@/components/ui/feedback";
import { api } from "@/services/api";
import { formatArabicDate, formatNumber } from "@/lib/utils";
import type { DashboardData } from "@/types";
const labels: Record<string, string> = {
  male_users: "إجمالي الشباب",
  female_profiles: "ملفات الفتيات",
  active_profiles: "ملفات نشطة",
  matchmakers: "الخطّابات",
  active_requests: "طلبات نشطة",
  male_requests: "طلبات شباب جديدة",
  new_leads: "عملاء جدد",
  verification_pending: "طلبات تحقق",
  matches: "فرص توافق",
  match_candidates: "فرص توافق",
  cases: "حالات تواصل",
  match_cases: "حالات تواصل",
  upcoming_meetings: "لقاءات قادمة",
  engagements: "الخطبات",
  marriages: "الزيجات",
  success_cases: "حالات نجاح",
  revenue: "الإيرادات",
};
export function DashboardOverview({
  scope,
}: {
  scope: "admin" | "matchmaker";
}) {
  const [data, setData] = useState<DashboardData>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const raw = await api.get<DashboardData | Record<string, number>>(
        `/${scope}/dashboard`,
      );
      setData(
        "stats" in raw
          ? (raw as DashboardData)
          : { stats: raw as Record<string, number> },
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر التحميل");
    } finally {
      setLoading(false);
    }
  }, [scope]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Fetch external API data on mount or scope change.
    void load();
  }, [load]);
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} retry={load} />;
  const stats = Object.entries(data?.stats || {});
  return (
    <div>
      <div className="mb-7">
        <p className="text-sm text-slate-400">نظرة عامة محدثة من النظام</p>
        <h2 className="mt-1 text-2xl font-bold">لوحة التحكم</h2>
      </div>
      {stats.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map(([key, value], i) => (
            <div className="panel relative overflow-hidden" key={key}>
              <div
                className={`absolute inset-y-0 right-0 w-1 ${i % 2 ? "bg-brand-navy" : "bg-brand-rose"}`}
              />
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">
                  {labels[key] || key.replaceAll("_", " ")}
                </span>
                <div className="rounded-xl bg-slate-50 p-2 text-brand-rose">
                  <UsersRound size={18} />
                </div>
              </div>
              <strong className="mt-4 block text-3xl" dir="ltr">
                {formatNumber(value)}
              </strong>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title="لا توجد إحصاءات بعد"
          description="ستظهر المؤشرات بعد بدء تسجيل البيانات."
        />
      )}
      <section className="panel mt-6">
        <h3 className="mb-4 flex items-center gap-2 font-bold">
          <Activity size={18} className="text-brand-rose" /> أحدث النشاطات
        </h3>
        {data?.recent_activity?.length ? (
          <div className="divide-y">
            {data.recent_activity.map((x) => (
              <div
                key={x.id}
                className="flex items-center justify-between py-3"
              >
                <p className="text-sm">{x.description}</p>
                <span className="text-xs text-slate-400">
                  {x.created_at
                    ? formatArabicDate(x.created_at, { dateStyle: "medium" })
                    : ""}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="لا يوجد نشاط حديث" />
        )}
      </section>
    </div>
  );
}
