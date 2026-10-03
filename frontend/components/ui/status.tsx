"use client";

import { usePreferences } from "@/components/providers/preferences-provider";
import { cn } from "@/lib/utils";

export const statusLabels: Record<string, { ar: string; en: string }> = {
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
  ASSIGNED: { ar: "مسند", en: "Assigned" },
  CONTACTED: { ar: "تم التواصل", en: "Contacted" },
  PROFILE_CREATED: { ar: "تم إنشاء الملف", en: "Profile created" },
  SELECTED: { ar: "مختار", en: "Selected" },
  SHORTLISTED: { ar: "مرشح", en: "Shortlisted" },
  NOT_SHORTLISTED: { ar: "غير مرشح", en: "Not shortlisted" },
  CANDIDATE_SELECTED: { ar: "تم اختيار المرشح", en: "Candidate selected" },
  MALE_VERIFICATION: { ar: "تحقق الشاب", en: "Male verification" },
  PAYMENT_PENDING: { ar: "بانتظار الدفع", en: "Payment pending" },
  READY_TO_CONTACT_FEMALE: { ar: "جاهز للتواصل مع الفتاة", en: "Ready to contact female" },
  WAITING_FEMALE: { ar: "بانتظار الفتاة", en: "Waiting for female" },
  FEMALE_ACCEPTED: { ar: "وافقت الفتاة", en: "Female accepted" },
  WAITING_MALE: { ar: "بانتظار الشاب", en: "Waiting for male" },
  MUTUAL_ACCEPTANCE: { ar: "قبول متبادل", en: "Mutual acceptance" },
  MEETING_SCHEDULED: { ar: "تم جدولة اللقاء", en: "Meeting scheduled" },
  MEETING_COMPLETED: { ar: "تم اللقاء", en: "Meeting completed" },
  FOLLOW_UP: { ar: "متابعة", en: "Follow-up" },
  SERIOUS_CONTACT: { ar: "تواصل جاد", en: "Serious contact" },
  OPEN: { ar: "مفتوح", en: "Open" },
  REVIEWING: { ar: "قيد المراجعة", en: "Reviewing" },
  RESOLVED: { ar: "تم الحل", en: "Resolved" },
  DISMISSED: { ar: "مستبعد", en: "Dismissed" },
  CANCELLED: { ar: "ملغى", en: "Cancelled" },
  COMPLETED: { ar: "مكتمل", en: "Completed" },
  NO_SHOW: { ar: "لم يحضر", en: "No show" },
  CONTINUE: { ar: "متابعة", en: "Continue" },
  ANOTHER_MEETING: { ar: "لقاء آخر", en: "Another meeting" },
  STOP: { ar: "إيقاف", en: "Stop" },
};

const fallbackStatusWords: Record<string, string> = {
  AVAILABLE: "متاح",
  NOT: "غير",
  SHORTLISTED: "مرشح",
  STALE: "قديم",
  PENDING: "قيد الانتظار",
  READY: "جاهز",
  WAITING: "بانتظار",
  CONTACT: "تواصل",
  FEMALE: "الفتاة",
  MALE: "الشاب",
  PAYMENT: "الدفع",
  REVIEW: "مراجعة",
  APPROVED: "موافق عليه",
  DECLINED: "مرفوض",
};

function fallbackStatusLabel(value: string, language: "ar" | "en") {
  if (language === "en") return value.replaceAll("_", " ");
  return value
    .split("_")
    .map((part) => fallbackStatusWords[part] || part)
    .join(" ");
}

export function statusLabel(value: string | undefined, language: "ar" | "en") {
  if (!value) return "-";
  return statusLabels[value]?.[language] || fallbackStatusLabel(value, language);
}

export function StatusBadge({ status }: { status?: string }) {
  const { language } = usePreferences();
  const value = status || "-";
  const positive = ["ACTIVE", "VERIFIED", "PAID", "MARRIED", "ENGAGED", "ACCEPTED"].includes(value);
  const warning = ["PENDING", "NEW", "DRAFT"].includes(value);

  return (
    <span className={cn("pill", positive ? "bg-green-50 text-green-700" : warning ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600")}>
      {statusLabel(value, language)}
    </span>
  );
}
