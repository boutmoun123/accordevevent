"use client";

import { usePreferences } from "@/components/providers/preferences-provider";
import { cn } from "@/lib/utils";

const labels: Record<string, { ar: string; en: string }> = {
  ACTIVE: { ar: "نشط", en: "Active" },
  PENDING: { ar: "قيد الانتظار", en: "Pending" },
  VERIFIED: { ar: "موثق", en: "Verified" },
  REJECTED: { ar: "مرفوض", en: "Rejected" },
  SUSPENDED: { ar: "موقوف", en: "Suspended" },
  BLOCKED: { ar: "محظور", en: "Blocked" },
  DRAFT: { ar: "مسودة", en: "Draft" },
  HIDDEN: { ar: "مخفي", en: "Hidden" },
  ARCHIVED: { ar: "مؤرشف", en: "Archived" },
  PAID: { ar: "مدفوع", en: "Paid" },
  WAIVED: { ar: "معفى", en: "Waived" },
  REFUNDED: { ar: "مسترد", en: "Refunded" },
  NEW: { ar: "جديد", en: "New" },
  CLOSED: { ar: "مغلق", en: "Closed" },
  MARRIED: { ar: "زواج", en: "Married" },
  ENGAGED: { ar: "خطبة", en: "Engaged" },
  ACCEPTED: { ar: "مقبول", en: "Accepted" },
};

export function StatusBadge({ status }: { status?: string }) {
  const { language } = usePreferences();
  const value = status || "-";
  const positive = ["ACTIVE", "VERIFIED", "PAID", "MARRIED", "ENGAGED", "ACCEPTED"].includes(value);
  const warning = ["PENDING", "NEW", "DRAFT"].includes(value);

  return (
    <span className={cn("pill", positive ? "bg-green-50 text-green-700" : warning ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600")}>
      {labels[value]?.[language] || value.replaceAll("_", " ")}
    </span>
  );
}
