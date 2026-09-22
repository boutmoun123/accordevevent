"use client";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
  Plus,
  Search,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/feedback";
import { Modal } from "@/components/ui/modal";
import { StatusBadge } from "@/components/ui/status";
import { formatDate } from "@/lib/utils";
import { api } from "@/services/api";
export type Row = Record<string, unknown> & { id: string; status?: string };
export interface Column {
  key: string;
  label: string;
  render?: (v: unknown, row: Row) => React.ReactNode;
}
export interface StatusAction {
  label: string;
  status: string;
  variant?: "primary" | "outline" | "danger";
  payload?: Record<string, string>;
}
export interface ResourceProps {
  title: string;
  description?: string;
  endpoint: string;
  columns: Column[];
  filters?: Array<{ name: string; label: string; options: string[] }>;
  createForm?: React.ReactNode | ((done: () => void) => React.ReactNode);
  editForm?: (row: Row, done: () => void) => React.ReactNode;
  actions?: boolean;
  statusActions?: StatusAction[];
}
export function ResourceManager({
  title,
  description,
  endpoint,
  columns,
  filters = [],
  createForm,
  editForm,
  actions = true,
  statusActions = [],
}: ResourceProps) {
  const [items, setItems] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Row>();
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const qs = useMemo(() => {
    const s = new URLSearchParams();
    s.set("page", String(page));
    s.set("page_size", "12");
    if (query) s.set("search", query);
    Object.entries(filter).forEach(([k, v]) => v && s.set(k, v));
    return s;
  }, [page, query, filter]);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const join = endpoint.includes("?") ? "&" : "?";
      const r = await api.get<Row[] | { items: Row[]; total: number }>(
        `${endpoint}${qs.size ? join + qs : ""}`,
      );
      if (Array.isArray(r)) {
        const normalizedQuery = query.trim().toLocaleLowerCase("ar");
        const filtered = r.filter((row) => {
          const matchesQuery =
            !normalizedQuery ||
            Object.values(row).some((value) =>
              String(value ?? "")
                .toLocaleLowerCase("ar")
                .includes(normalizedQuery),
            );
          const matchesFilters = Object.entries(filter).every(
            ([key, value]) => !value || String(row[key] ?? "") === value,
          );
          return matchesQuery && matchesFilters;
        });
        setTotal(filtered.length);
        setItems(filtered.slice((page - 1) * 12, page * 12));
      } else if (Array.isArray(r.items)) {
        setItems(r.items);
        setTotal(r.total || 0);
      } else {
        const value = r as unknown as Record<string, unknown>;
        if (endpoint.endsWith("/profile") && value.user && value.matchmaker) {
          const user = value.user as Row;
          const matchmaker = value.matchmaker as Row;
          setItems([{ ...user, ...matchmaker, id: matchmaker.id || user.id }]);
          setTotal(1);
        } else if (endpoint.endsWith("/settings")) {
          const rows = Object.entries(value).map(([key, setting]) => ({
            id: key,
            key,
            value: setting,
          }));
          setItems(rows);
          setTotal(rows.length);
        } else {
          setItems([]);
          setTotal(0);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحميل البيانات");
    } finally {
      setLoading(false);
    }
  }, [endpoint, filter, page, qs, query]);
  useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [load]);
  const mutate = async (action: StatusAction) => {
    if (!selected) return;
    try {
      await api.patch(
        `${endpoint.split("?")[0]}/${selected.id}`,
        action.payload || { status: action.status },
      );
      toast.success("تم تحديث الحالة");
      setSelected(undefined);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر التحديث");
    }
  };
  return (
    <div>
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-2xl font-bold">{title}</h2>
          {description && (
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          )}
        </div>
        {createForm && (
          <Button onClick={() => setCreating(true)}>
            <Plus size={17} /> إضافة جديد
          </Button>
        )}
      </div>
      <div className="panel mb-5 flex flex-col gap-3 md:flex-row">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-3 text-slate-400" size={18} />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            className="field pr-10"
            placeholder="بحث..."
          />
        </div>
        {filters.map((f) => (
          <div className="relative" key={f.name}>
            <Filter
              className="absolute right-3 top-3 text-slate-400"
              size={16}
            />
            <select
              className="field min-w-40 pr-9"
              value={filter[f.name] || ""}
              onChange={(e) =>
                setFilter((v) => ({ ...v, [f.name]: e.target.value }))
              }
            >
              <option value="">{f.label}: الكل</option>
              {f.options.map((o) => (
                <option key={o} value={o}>
                  {o.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} retry={load} />
      ) : items.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="panel overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-right text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  {columns.map((c) => (
                    <th className="px-5 py-4 font-medium" key={c.key}>
                      {c.label}
                    </th>
                  ))}
                  {actions && <th className="px-5 py-4">التفاصيل</th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/60">
                    {columns.map((c) => (
                      <td className="px-5 py-4" key={c.key}>
                        {c.render ? (
                          c.render(row[c.key], row)
                        ) : c.key.includes("status") ? (
                          <StatusBadge status={String(row[c.key] || "")} />
                        ) : c.key.includes("_at") ? (
                          formatDate(String(row[c.key] || ""))
                        ) : Array.isArray(row[c.key]) ? (
                          (row[c.key] as unknown[]).join("، ")
                        ) : (
                          String(row[c.key] ?? "—")
                        )}
                      </td>
                    ))}
                    {actions && (
                      <td className="px-5 py-4">
                        <button
                          onClick={() => setSelected(row)}
                          className="rounded-lg p-2 hover:bg-slate-100"
                          aria-label="التفاصيل"
                        >
                          <Eye size={18} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t px-5 py-3 text-sm">
            <span className="text-slate-400">{total} نتيجة</span>
            <div className="flex gap-2">
              <Button
                size="icon"
                variant="outline"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronRight size={17} />
              </Button>
              <span className="grid min-w-10 place-items-center">{page}</span>
              <Button
                size="icon"
                variant="outline"
                disabled={items.length < 12}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronLeft size={17} />
              </Button>
            </div>
          </div>
        </div>
      )}
      <Modal
        open={!!selected && !creating}
        onOpenChange={(v) => !v && setSelected(undefined)}
        title="تفاصيل السجل"
        wide
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {selected &&
            Object.entries(selected)
              .filter(([, v]) => typeof v !== "object")
              .map(([k, v]) => (
                <div className="rounded-xl bg-slate-50 p-3" key={k}>
                  <span className="block text-xs text-slate-400">
                    {k.replaceAll("_", " ")}
                  </span>
                  <span className="mt-1 block break-words text-sm">
                    {String(v ?? "—")}
                  </span>
                </div>
              ))}
        </div>
        {statusActions.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {selected && editForm && (
              <Button variant="outline" onClick={() => setCreating(true)}>
                تعديل
              </Button>
            )}
            {statusActions.map((a) => (
              <Button
                key={a.status}
                variant={a.variant}
                onClick={() => void mutate(a)}
              >
                {a.label}
              </Button>
            ))}
          </div>
        )}
      </Modal>
      {(createForm || (selected && editForm)) && (
        <Modal
          open={creating}
          onOpenChange={setCreating}
          title={`إضافة — ${title}`}
          wide
        >
          {selected && editForm
            ? editForm(selected, () => {
                setCreating(false);
                setSelected(undefined);
                void load();
              })
            : typeof createForm === "function"
            ? createForm(() => {
                setCreating(false);
                void load();
              })
            : createForm}
        </Modal>
      )}
    </div>
  );
}
