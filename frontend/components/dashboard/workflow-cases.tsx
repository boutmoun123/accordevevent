"use client";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/feedback";
import { StatusBadge, statusLabel } from "@/components/ui/status";
import { api } from "@/services/api";
import type { MatchCase } from "@/types";
const next: Record<string, string[]> = {
  CANDIDATE_SELECTED: ["MALE_VERIFICATION"],
  MALE_VERIFICATION: ["PAYMENT_PENDING"],
  PAYMENT_PENDING: ["READY_TO_CONTACT_FEMALE"],
  READY_TO_CONTACT_FEMALE: ["WAITING_FEMALE"],
  WAITING_FEMALE: ["FEMALE_ACCEPTED", "REJECTED"],
  FEMALE_ACCEPTED: ["WAITING_MALE"],
  WAITING_MALE: ["MUTUAL_ACCEPTANCE", "REJECTED"],
  MUTUAL_ACCEPTANCE: [],
  MEETING_SCHEDULED: [],
  MEETING_COMPLETED: ["FOLLOW_UP"],
  FOLLOW_UP: ["SERIOUS_CONTACT", "CLOSED"],
  SERIOUS_CONTACT: ["ENGAGED", "CLOSED"],
  ENGAGED: ["MARRIED", "CLOSED"],
};
export function WorkflowCases({
  scope = "matchmaker",
}: {
  scope?: "matchmaker" | "admin";
}) {
  const [data, setData] = useState<MatchCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get<MatchCase[] | { items: MatchCase[] }>(
        `/${scope}/match-cases`,
      );
      setData(Array.isArray(r) ? r : r.items);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحميل الحالات");
    } finally {
      setLoading(false);
    }
  }, [scope]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Fetch external API data on mount or scope change.
    void load();
  }, [load]);
  const advance = async (item: MatchCase, status: string) => {
    try {
      const payload: Record<string, string> = { status };
      if (status === "FEMALE_ACCEPTED") payload.female_decision = "ACCEPTED";
      if (status === "MUTUAL_ACCEPTANCE") payload.male_decision = "ACCEPTED";
      if (status === "REJECTED" && item.status === "WAITING_FEMALE") {
        payload.female_decision = "REJECTED";
      }
      if (status === "REJECTED" && item.status === "WAITING_MALE") {
        payload.male_decision = "REJECTED";
      }
      await api.patch(`/${scope}/match-cases/${item.id}`, payload);
      toast.success("تم تحديث مسار الحالة");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر التحديث");
    }
  };
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} retry={load} />;
  return (
    <div>
      <h2 className="text-2xl font-bold">حالات التوفيق</h2>
      <p className="mt-1 text-sm text-slate-500">
        كل انتقال يُحفظ في سجل الحالة والتدقيق.
      </p>
      {!data.length ? (
        <div className="mt-6">
          <EmptyState />
        </div>
      ) : (
        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          {data.map((x) => (
            <article key={x.id} className="panel">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-slate-400">
                    {x.case_code || x.id}
                  </p>
                  <h3 className="mt-1 font-bold">طلب الشاب</h3>
                  <p className="mt-1 font-mono text-xs text-slate-500" dir="ltr">{x.male_request_id}</p>
                </div>
                <StatusBadge status={x.status} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link href={`/${scope}/male-requests`}>فتح طلبات الشباب</Link>
                </Button>
                {x.female_profile_id && (
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/${scope}/female-profiles`}>فتح ملفات الفتيات</Link>
                  </Button>
                )}
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-slate-50 p-3">
                  <span className="text-xs text-slate-400">قرار الفتاة</span>
                  <div className="mt-1">
                    <StatusBadge status={x.female_decision} />
                  </div>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <span className="text-xs text-slate-400">قرار الشاب</span>
                  <div className="mt-1">
                    <StatusBadge status={x.male_decision} />
                  </div>
                </div>
              </div>
              {(next[x.status] || []).length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {next[x.status].map((s) => (
                    <Button
                      key={s}
                      variant={
                        s === "REJECTED" || s === "CLOSED"
                          ? "outline"
                          : "primary"
                      }
                      size="sm"
                      onClick={() => void advance(x, s)}
                    >
                      <ArrowLeft size={15} />{" "}
                      {statusLabel(s, "ar")}
                    </Button>
                  ))}
                </div>
              )}
              {x.status === "MUTUAL_ACCEPTANCE" && (
                <Button asChild className="mt-4" size="sm">
                  <Link href={`/${scope}/meetings`}>جدولة اللقاء الأول</Link>
                </Button>
              )}
              {x.status === "MEETING_SCHEDULED" && (
                <p className="mt-4 text-sm text-slate-500">
                  يُستكمل اللقاء وتقييم الطرفين من صفحة اللقاءات.
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
