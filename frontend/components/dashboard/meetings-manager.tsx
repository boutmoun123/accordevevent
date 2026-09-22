"use client";

import { CalendarPlus, CheckCircle2, MessageSquareText } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { MeetingForm } from "@/components/forms/entity-forms";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/feedback";
import { Modal } from "@/components/ui/modal";
import { StatusBadge } from "@/components/ui/status";
import { formatDate } from "@/lib/utils";
import { api } from "@/services/api";
import type { Meeting } from "@/types";

type Party = "MALE" | "FEMALE";

export function MeetingsManager() {
  const [items, setItems] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [feedback, setFeedback] = useState<{ meeting: Meeting; party: Party }>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await api.get<Meeting[]>("/matchmaker/meetings"));
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "تعذر تحميل اللقاءات");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Fetch external API data on mount or scope change.
    void load();
  }, [load]);

  const complete = async (meeting: Meeting) => {
    try {
      await api.patch(`/matchmaker/meetings/${meeting.id}`, { status: "COMPLETED" });
      toast.success("تم تسجيل اكتمال اللقاء");
      void load();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "تعذر تحديث اللقاء");
    }
  };

  const submitFeedback = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!feedback) return;
    const form = new FormData(event.currentTarget);
    try {
      await api.post(`/matchmaker/meetings/${feedback.meeting.id}/feedback`, {
        party: feedback.party,
        decision: form.get("decision"),
        notes: form.get("notes") || undefined,
      });
      toast.success("تم حفظ التقييم");
      setFeedback(undefined);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "تعذر حفظ التقييم");
    }
  };

  return (
    <div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-bold">اللقاءات والمتابعة</h2>
          <p className="mt-1 text-sm text-slate-500">
            لا يمكن جدولة لقاء قبل القبول المتبادل، ويُحفظ تقييم كل طرف منفصلًا.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <CalendarPlus size={17} /> جدولة لقاء
        </Button>
      </div>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} retry={load} />
      ) : items.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="لا توجد لقاءات مجدولة" />
        </div>
      ) : (
        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          {items.map((meeting) => (
            <article className="panel" key={meeting.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-400">{meeting.match_case_id}</p>
                  <h3 className="mt-1 font-bold">{meeting.meeting_type.replaceAll("_", " ")}</h3>
                </div>
                <StatusBadge status={meeting.status} />
              </div>
              <p className="mt-4 text-sm text-slate-600">
                {formatDate(meeting.scheduled_at)}
              </p>
              {meeting.location_or_link && (
                <p className="mt-2 break-all text-sm text-slate-500">
                  {meeting.location_or_link}
                </p>
              )}
              <div className="mt-5 flex flex-wrap gap-2">
                {meeting.status !== "COMPLETED" ? (
                  <Button size="sm" onClick={() => void complete(meeting)}>
                    <CheckCircle2 size={16} /> تسجيل اكتمال اللقاء
                  </Button>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setFeedback({ meeting, party: "MALE" })}
                    >
                      <MessageSquareText size={16} /> تقييم الشاب
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setFeedback({ meeting, party: "FEMALE" })}
                    >
                      <MessageSquareText size={16} /> تقييم الفتاة
                    </Button>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal open={creating} onOpenChange={setCreating} title="جدولة لقاء" wide>
        <MeetingForm
          done={() => {
            setCreating(false);
            void load();
          }}
        />
      </Modal>
      <Modal
        open={Boolean(feedback)}
        onOpenChange={(open) => !open && setFeedback(undefined)}
        title={feedback?.party === "MALE" ? "تقييم الشاب" : "تقييم الفتاة"}
      >
        <form className="space-y-4" onSubmit={submitFeedback}>
          <label>
            <span className="label">القرار</span>
            <select name="decision" className="field" required>
              <option value="CONTINUE">متابعة</option>
              <option value="ANOTHER_MEETING">لقاء آخر</option>
              <option value="STOP">توقف</option>
            </select>
          </label>
          <label>
            <span className="label">ملاحظات</span>
            <textarea name="notes" className="field" rows={4} />
          </label>
          <Button className="w-full">حفظ التقييم</Button>
        </form>
      </Modal>
    </div>
  );
}
