"use client";

import { CheckCircle2, Clipboard, Headphones, RefreshCw, SearchCheck } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { usePreferences } from "@/components/providers/preferences-provider";
import { Button } from "@/components/ui/button";

const text = {
  ar: {
    copied: "تم نسخ رقم الطلب",
    title: "تم حفظ طلبك بنجاح",
    body: "احتفظ برقم الطلب لمتابعة حالة طلبك.",
    copy: "نسخ رقم الطلب",
    matchesPrefix: "تم العثور على",
    matchesSuffix: "فرص توافق مناسبة لطلبك.",
    privacy: "حفاظا على الخصوصية، لا نعرض أي بيانات تعريفية.",
    refresh: "تحديث النتيجة",
    follow: "متابعة طلبي",
  },
  en: {
    copied: "Request code copied",
    title: "Your request was saved successfully",
    body: "Keep this request code to follow your request status.",
    copy: "Copy request code",
    matchesPrefix: "We found",
    matchesSuffix: "suitable match opportunities for your request.",
    privacy: "To protect privacy, identifying details are not shown.",
    refresh: "Refresh result",
    follow: "Follow my request",
  },
};

export function RequestSuccess({
  code,
  count,
  onRefresh,
}: {
  code: string;
  count?: number;
  onRefresh?: () => void;
}) {
  const { language } = usePreferences();
  const t = text[language];
  const copy = async () => {
    await navigator.clipboard.writeText(code);
    toast.success(t.copied);
  };

  return (
    <div className="mx-auto max-w-2xl rounded-3xl border bg-white p-7 text-center shadow-soft">
      <CheckCircle2 className="mx-auto text-green-600" size={54} />
      <h2 className="mt-4 text-2xl font-bold">{t.title}</h2>
      <p className="mt-2 text-slate-500">{t.body}</p>
      <div dir="ltr" className="mx-auto my-6 max-w-sm rounded-2xl bg-brand-navy px-5 py-4 font-mono text-2xl font-bold tracking-wider text-white">
        {code}
      </div>
      <Button onClick={copy} variant="outline">
        <Clipboard size={17} /> {t.copy}
      </Button>
      {typeof count === "number" && (
        <div className="mt-8 rounded-2xl bg-brand-pink p-6">
          <SearchCheck className="mx-auto text-brand-rose" />
          <p className="mt-3 text-lg font-semibold">
            {t.matchesPrefix} {count} {t.matchesSuffix}
          </p>
          <p className="mt-1 text-sm text-slate-500">{t.privacy}</p>
          {onRefresh && (
            <button onClick={onRefresh} className="mt-3 inline-flex items-center gap-2 text-sm text-brand-rose">
              <RefreshCw size={14} /> {t.refresh}
            </button>
          )}
        </div>
      )}
      <div className="mt-6 flex justify-center">
        <Button asChild>
          <Link href="/account">
            <Headphones size={17} /> {t.follow}
          </Link>
        </Button>
      </div>
    </div>
  );
}
