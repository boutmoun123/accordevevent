"use client";
import { Bell, CheckCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/feedback";
import { api } from "@/services/api";
import { formatDate } from "@/lib/utils";
import type { Notification } from "@/types";
export function Notifications({ scope }: { scope: "admin" | "matchmaker" }) {
  const [data, setData] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get<Notification[] | { items: Notification[] }>(
        `/${scope}/notifications`,
      );
      setData(Array.isArray(r) ? r : r.items);
      setError("");
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
  const read = async (id: string) => {
    try {
      await api.patch(`/${scope}/notifications/${id}`, { read: true });
      void load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر تحديث الإشعار");
    }
  };
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} retry={load} />;
  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">الإشعارات</h2>
      </div>
      <div className="mt-6 space-y-3">
        {data.length ? (
          data.map((n) => (
            <article
              key={n.id}
              className={`panel flex items-start gap-4 ${!n.read_at ? "border-r-4 border-r-brand-rose" : "opacity-75"}`}
            >
              <div className="rounded-xl bg-brand-pink p-2 text-brand-rose">
                <Bell size={18} />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">
                  {n.title || n.type.replaceAll("_", " ")}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {n.body || n.message}
                </p>
                <time className="mt-2 block text-xs text-slate-400">
                  {formatDate(n.created_at)}
                </time>
              </div>
              {!n.read_at && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void read(n.id)}
                >
                  <CheckCheck size={16} /> تمت القراءة
                </Button>
              )}
            </article>
          ))
        ) : (
          <EmptyState title="لا توجد إشعارات" />
        )}
      </div>
    </div>
  );
}
