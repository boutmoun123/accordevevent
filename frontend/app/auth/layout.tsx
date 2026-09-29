"use client";

import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/brand/logo";
import { usePreferences } from "@/components/providers/preferences-provider";

const text = {
  ar: {
    loading: "جاري التحميل...",
    back: "العودة إلى الرئيسية",
    title: "رحلة تبدأ بثقة وتنتهي بفرح",
    body: "منصة توفيق سورية جادة تحفظ الخصوصية وتجمع الذكاء التقني مع الإشراف الإنساني الموثوق.",
  },
  en: {
    loading: "Loading...",
    back: "Back to home",
    title: "A journey that starts with trust and ends with joy",
    body: "A serious Syrian matchmaking platform that protects privacy and combines technology with trusted human supervision.",
  },
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { language, dir, isDark } = usePreferences();
  const t = text[language];

  return (
    <main dir={dir} className={`grid min-h-screen lg:grid-cols-[1fr_1.1fr] ${isDark ? "bg-[#1A1018] text-[#FFF8FB]" : "bg-white text-[#1F1630]"}`}>
      <section className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <Logo />
          <div className="mt-10">
            <Suspense fallback={<p>{t.loading}</p>}>{children}</Suspense>
          </div>
          <Link href="/" className={`mt-8 block text-center text-sm ${isDark ? "text-[#CDB7C3]" : "text-slate-500"}`}>
            {t.back}
          </Link>
        </div>
      </section>
      <aside className="relative hidden overflow-hidden bg-brand-navy p-16 text-white lg:flex lg:flex-col lg:justify-end">
        <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-brand-rose/30 blur-3xl" />
        <div className="relative max-w-xl">
          <p className="text-brand-rose">Farah.event</p>
          <h2 className="mt-4 text-5xl font-bold leading-tight">{t.title}</h2>
          <p className="mt-6 leading-8 text-white/60">{t.body}</p>
        </div>
      </aside>
    </main>
  );
}
