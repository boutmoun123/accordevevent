"use client";
import {
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Eye,
  Filter,
  Heart,
  Link2,
  Plus,
  Search,
  UserRound,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/feedback";
import { Modal } from "@/components/ui/modal";
import { StatusBadge, statusLabel } from "@/components/ui/status";
import { localizeDisplayValue } from "@/lib/domain-options";
import { formatDate, formatNumber, formatPercent } from "@/lib/utils";
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

type RelatedTarget = {
  kind: "male" | "female";
  id?: string;
  code?: string;
  label: string;
};

type DetailItem = { key: string; value: unknown };
type DetailSection = { title: string; icon: React.ReactNode; items: DetailItem[] };

function compactCode(value: unknown) {
  const text = String(value || "").trim();
  return text || undefined;
}

function relatedTargets(row: Row): RelatedTarget[] {
  const targets: RelatedTarget[] = [];
  const maleCode = compactCode(row.male_request_code || row.request_code);
  const maleId = compactCode(row.male_request_id || (row.request_code ? row.id : undefined));
  if (maleCode || maleId) targets.push({ kind: "male", id: maleId, code: maleCode, label: "فتح طلب الشاب" });
  const femaleCode = compactCode(row.female_public_code || row.public_code);
  const femaleId = compactCode(row.female_profile_id || (row.public_code ? row.id : undefined));
  if (femaleCode || femaleId) targets.push({ kind: "female", id: femaleId, code: femaleCode, label: "فتح ملف الفتاة" });
  return targets;
}

function detailTitle(target: RelatedTarget) {
  return target.kind === "male" ? "معلومات طلب الشاب" : "معلومات ملف الفتاة";
}

function isStatusField(key: string) {
  return key.includes("status") || key.includes("decision");
}

function isReferenceField(key: string) {
  return key.endsWith("_id") || key === "id" || key.endsWith("_code") || key === "request_code" || key === "public_code";
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function hasDisplayValue(value: unknown) {
  if (value === undefined || value === null || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(objectValue(value)).length > 0;
  return true;
}

export function displayFieldValue(key: string, value: unknown) {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "number") return key.includes("score") ? formatPercent(value) : formatNumber(value);
  if (typeof value === "boolean") return value ? "نعم" : "لا";
  if (Array.isArray(value)) return value.join("، ");
  if (typeof value === "object") return "—";
  if (key.includes("_at")) return formatDate(String(value));
  if (isStatusField(key)) return statusLabel(String(value), "ar");
  return localizeDisplayValue(value, "ar");
}

const detailLabels: Record<string, string> = {
  id: "المعرّف",
  user_id: "معرّف المستخدم",
  male_user_id: "معرّف الشاب",
  female_user_id: "معرّف الفتاة",
  matchmaker_id: "معرّف الخطّابة",
  assigned_matchmaker_id: "الخطّابة المسندة",
  male_request_id: "معرّف طلب الشاب",
  female_profile_id: "معرّف ملف الفتاة",
  request_code: "رقم الطلب",
  male_request_code: "رقم طلب الشاب",
  public_code: "رمز الفتاة",
  female_public_code: "رمز ملف الفتاة",
  male_to_female_score: "توافق طلب الشاب مع الفتاة",
  female_to_male_score: "توافق الفتاة مع طلب الشاب",
  mutual_score: "نسبة التوافق المتبادلة",
  score: "نسبة التوافق",
  first_name: "الاسم",
  last_name: "الكنية",
  full_name: "الاسم الكامل",
  email: "البريد الإلكتروني",
  phone: "الهاتف",
  whatsapp: "واتساب",
  age: "العمر",
  birth_date: "تاريخ الميلاد",
  governorate: "المحافظة",
  city: "المدينة",
  neighborhood: "الحي",
  exact_address: "العنوان الخاص",
  height: "الطول",
  education: "التعليم",
  education_level: "المستوى التعليمي",
  field_of_study: "مجال الدراسة",
  education_field: "الاختصاص",
  occupation: "المهنة",
  work_field: "مجال العمل",
  employment_status: "تفصيل العمل",
  marital_status: "الحالة الاجتماعية",
  hijab_status: "الحجاب",
  financial_status: "الوضع المادي",
  religion: "الدين",
  children: "الأطفال",
  values_preferences: "القيم والتفضيلات",
  personality_traits: "صفات شخصية",
  religious_preference: "التدين",
  values: "القيم",
  traits: "الصفات",
  other_criteria: "مواصفات إضافية",
  age_min: "العمر من",
  age_max: "العمر إلى",
  height_min: "الطول من",
  height_max: "الطول إلى",
  governorates: "المحافظات",
  profession_preference: "المهنة المفضلة",
  children_preference: "تفضيل الأطفال",
  contact_preference: "طريقة التواصل المفضلة",
  public_summary: "الملخص العام",
  private_notes: "ملاحظات خاصة",
  notes: "الملاحظات",
  amount: "المبلغ",
  currency: "العملة",
  method: "طريقة الدفع",
  reference: "المرجع",
  paid_at: "تاريخ الدفع",
  match_case_id: "معرّف حالة التوافق",
  meeting_type: "نوع اللقاء",
  scheduled_at: "موعد اللقاء",
  ends_at: "نهاية الموعد",
  appointment_status: "حالة الموعد",
  status: "الحالة",
  decision: "القرار",
  verification_status: "التحقق",
  workflow_status: "مسار الطلب",
  match_count: "عدد فرص التوافق",
  is_active: "نشط",
  created_at: "تاريخ الإنشاء",
  updated_at: "آخر تحديث",
};

export function labelForDetail(key: string) {
  return detailLabels[key] || `حقل ${key.replaceAll("_", " ")}`;
}

export function visibleDetailEntries(row: Row) {
  const hasMalePublicReference = Boolean(row.male_request_code || row.request_code);
  const hasFemalePublicReference = Boolean(row.female_public_code || row.public_code);
  const hasAnyPublicReference = hasMalePublicReference || hasFemalePublicReference;
  const hiddenKeys = new Set<string>(["matchmaker_id", "assigned_matchmaker_id"]);

  if (hasAnyPublicReference) hiddenKeys.add("id");
  if (hasMalePublicReference) hiddenKeys.add("male_request_id");
  if (hasFemalePublicReference) hiddenKeys.add("female_profile_id");

  return Object.entries(row).filter(([key, value]) => {
    if (typeof value === "object") return false;
    return !hiddenKeys.has(key);
  });
}

function pickItems(source: Record<string, unknown>, keys: string[]): DetailItem[] {
  return keys
    .map((key) => ({ key, value: source[key] }))
    .filter((item) => hasDisplayValue(item.value));
}

export function relatedDetailSections(kind: "male" | "female", row: Row): DetailSection[] {
  if (kind === "male") {
    const male = objectValue(row.male_characteristics);
    const desired = objectValue(row.desired_female_characteristics);
    const summary = pickItems(row, ["request_code", "verification_status", "workflow_status", "match_count", "is_active", "created_at", "updated_at"]);
    return [
      {
        title: "معلومات الشاب",
        icon: <UserRound size={17} />,
        items: pickItems(male, ["age", "governorate", "city", "marital_status", "height", "education", "education_field", "occupation", "employment_status", "religious_preference", "children", "values", "personality_traits"]),
      },
      {
        title: "مواصفات شريكة الحياة",
        icon: <Heart size={17} />,
        items: pickItems(desired, ["age_min", "age_max", "governorates", "governorate", "height_min", "height_max", "education", "occupation", "profession_preference", "marital_status", "children_preference", "children", "hijab_status", "religious_preference", "values", "traits", "other_criteria"]),
      },
      {
        title: "حالة الطلب",
        icon: <ClipboardCheck size={17} />,
        items: summary,
      },
    ].filter((section) => section.items.length > 0);
  }

  return [
    {
      title: "معلومات الفتاة",
      icon: <UserRound size={17} />,
      items: pickItems(row, ["public_code", "first_name", "last_name", "phone", "age", "governorate", "city", "marital_status", "height", "education", "field_of_study", "occupation", "employment_status", "hijab_status", "financial_status", "religion", "children", "values_preferences", "personality_traits", "contact_preference"]),
    },
    {
      title: "ملخص ومتابعة",
      icon: <ClipboardCheck size={17} />,
      items: pickItems(row, ["public_summary", "private_notes", "notes", "status", "created_at", "updated_at"]),
    },
  ].filter((section) => section.items.length > 0);
}

function DetailSectionView({ section }: { section: DetailSection }) {
  return (
    <section className="rounded-xl border border-slate-100 bg-white p-4">
      <div className="mb-4 flex items-center gap-2 text-slate-800">
        <span className="grid size-8 place-items-center rounded-lg bg-brand-rose/10 text-brand-rose">
          {section.icon}
        </span>
        <h3 className="font-bold">{section.title}</h3>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {section.items.map((item) => (
          <DetailField key={item.key} fieldKey={item.key} value={item.value} />
        ))}
      </div>
    </section>
  );
}

function DetailField({
  fieldKey,
  value,
  onOpen,
}: {
  fieldKey: string;
  value: unknown;
  onOpen?: () => void;
}) {
  const isReference = isReferenceField(fieldKey);
  const isStatus = isStatusField(fieldKey);
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-4 transition hover:border-slate-200 hover:bg-white">
      <span className="block text-xs font-semibold text-slate-400">
        {labelForDetail(fieldKey)}
      </span>
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          className="mt-2 inline-flex max-w-full items-center gap-2 text-start font-mono text-sm font-semibold text-brand-rose underline-offset-4 hover:underline"
          dir="ltr"
        >
          <Link2 size={14} className="shrink-0" />
          <span className="truncate">{String(value ?? "—")}</span>
        </button>
      ) : isStatus ? (
        <span className="mt-2 inline-block">
          <StatusBadge status={String(value || "")} />
        </span>
      ) : (
        <span
          className={`mt-2 block break-words text-sm font-medium text-slate-800 ${isReference ? "font-mono" : ""}`}
          dir={isReference ? "ltr" : undefined}
        >
          {displayFieldValue(fieldKey, value)}
        </span>
      )}
    </div>
  );
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
  const language = "ar";
  const [items, setItems] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Row>();
  const [related, setRelated] = useState<{ target: RelatedTarget; data?: Row; loading: boolean; error?: string }>();
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
  const openRelated = async (target: RelatedTarget, source?: Row) => {
    setRelated({ target, loading: true });
    try {
      let data: Row | undefined;
      if (target.kind === "female") {
        if (endpoint.startsWith("/admin")) {
          const profiles = await api.get<Row[]>("/admin/female-profiles");
          data = profiles.find((item) => item.id === target.id || item.public_code === target.code);
        } else if (target.id) {
          data = await api.get<Row>(`/matchmaker/female-profiles/${encodeURIComponent(target.id)}`);
        }
      } else if (target.kind === "male") {
        const code = target.code || compactCode(source?.male_request_code || source?.request_code);
        if (code && !endpoint.startsWith("/admin")) {
          const detail = await api.get<{ request: Row; candidates?: Row[] }>(`/matchmaker/male-requests/${encodeURIComponent(code)}`);
          data = detail.request;
        } else {
          const path = endpoint.startsWith("/admin") ? "/admin/male-requests" : "/matchmaker/male-requests";
          const requests = await api.get<Row[]>(path);
          const found = requests.find((item) => item.id === target.id || item.request_code === code);
          if (found?.request_code && !endpoint.startsWith("/admin")) {
            const detail = await api.get<{ request: Row; candidates?: Row[] }>(`/matchmaker/male-requests/${encodeURIComponent(String(found.request_code))}`);
            data = detail.request;
          } else {
            data = found;
          }
        }
      }
      if (!data) throw new Error("لم يتم العثور على السجل المرتبط");
      setRelated({ target, data, loading: false });
    } catch (error) {
      setRelated({ target, loading: false, error: error instanceof Error ? error.message : "تعذر تحميل السجل المرتبط" });
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
                  {statusLabel(o, language)}
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
                        ) : (c.key === "male_request_id" || c.key === "female_profile_id" || c.key === "male_request_code" || c.key === "female_public_code") ? (
                          <button
                            type="button"
                            onClick={() => void openRelated({
                              kind: c.key.includes("female") ? "female" : "male",
                              id: c.key.endsWith("_id") ? compactCode(row[c.key]) : undefined,
                              code: c.key.includes("code") ? compactCode(row[c.key]) : compactCode(row[c.key.includes("female") ? "female_public_code" : "male_request_code"]),
                              label: c.key.includes("female") ? "فتح ملف الفتاة" : "فتح طلب الشاب",
                            }, row)}
                            className="font-mono text-xs font-semibold text-brand-rose underline-offset-4 hover:underline"
                            dir="ltr"
                          >
                            {String(row[c.key] ?? "—")}
                          </button>
                        ) : c.key.includes("status") ? (
                          <StatusBadge status={String(row[c.key] || "")} />
                        ) : c.key.includes("_at") ? (
                          formatDate(String(row[c.key] || ""))
                        ) : c.key.includes("score") ? (
                          formatPercent(row[c.key] as number | string | null)
                        ) : typeof row[c.key] === "number" ? (
                          formatNumber(row[c.key] as number)
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
            <span className="text-slate-400">{formatNumber(total)} نتيجة</span>
            <div className="flex gap-2">
              <Button
                size="icon"
                variant="outline"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronRight size={17} />
              </Button>
              <span className="grid min-w-10 place-items-center">{formatNumber(page)}</span>
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
            visibleDetailEntries(selected)
              .map(([k, v]) => (
                <DetailField
                  key={k}
                  fieldKey={k}
                  value={v}
                  onOpen={(k === "male_request_id" || k === "female_profile_id" || k === "male_request_code" || k === "female_public_code") ? () => void openRelated({
                        kind: k.includes("female") ? "female" : "male",
                        id: k.endsWith("_id") ? compactCode(v) : undefined,
                        code: k.includes("code") ? compactCode(v) : compactCode(selected[k.includes("female") ? "female_public_code" : "male_request_code"]),
                        label: k.includes("female") ? "فتح ملف الفتاة" : "فتح طلب الشاب",
                      }, selected) : undefined}
                />
              ))}
        </div>
        {selected && relatedTargets(selected).length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {relatedTargets(selected).map((target) => (
              <Button key={`${target.kind}-${target.id || target.code}`} type="button" variant="outline" onClick={() => void openRelated(target, selected)}>
                {target.label}
              </Button>
            ))}
          </div>
        )}
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
      <Modal
        open={!!related}
        onOpenChange={(open) => !open && setRelated(undefined)}
        title={related ? detailTitle(related.target) : ""}
        wide
      >
        {related?.loading ? (
          <LoadingState />
        ) : related?.error ? (
          <ErrorState message={related.error} retry={() => void openRelated(related.target, selected)} />
        ) : related?.data ? (
          <div className="space-y-4">
            {relatedDetailSections(related.target.kind, related.data).map((section) => (
              <DetailSectionView key={section.title} section={section} />
            ))}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
