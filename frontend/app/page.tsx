"use client";

import { ArrowLeft, ArrowRight, Circle, FileText, MessageCircle, Settings2, ShieldCheck } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { GenderIcon } from "@/components/brand/gender-icon";
import { Navbar } from "@/components/public/navbar";
import { usePreferences } from "@/components/providers/preferences-provider";
import { Modal } from "@/components/ui/modal";

const faqs = [
  {
    key: "how",
    title: { ar: "كيف تعمل المنصة؟", en: "How does the platform work?" },
    subtitle: { ar: "تعرّف على آلية التوفيق خطوة بخطوة", en: "Learn how the matching journey works step by step" },
    body: {
      ar: "تعمل Farah.event على تسهيل الوصول إلى شريك الحياة المناسب بطريقة منظمة وآمنة.\n\nتبدأ العملية بتسجيل المعلومات الأساسية، ثم يتم التعامل مع البيانات وفق ضوابط الخصوصية، وبعدها تتم عملية التوفيق بناء على المعلومات المناسبة.\n\nعند وجود توافق، تنتقل العملية إلى مرحلة التواصل والمتابعة وفق الآلية المعتمدة في المنصة.",
      en: "Farah.event helps make the path to a suitable life partner organized and secure.\n\nThe process begins by registering the basic information, then data is handled according to privacy controls, and matching is performed based on the relevant information.\n\nWhen a suitable match is found, the process moves to communication and follow-up according to the platform workflow.",
    },
    icon: Settings2,
  },
  {
    key: "privacy",
    title: { ar: "كيف نحافظ على الخصوصية؟", en: "How do we protect privacy?" },
    subtitle: { ar: "بياناتك محفوظة ولا تعرض للطرف الآخر مباشرة", en: "Your data stays protected and is not shown directly" },
    body: {
      ar: "خصوصيتك أولوية لدينا.\n\nلا يتم عرض بياناتك الشخصية للطرف الآخر بشكل مباشر، ويتم التعامل مع المعلومات داخل النظام وفق الصلاحيات المسموحة.\n\nلا تتم مشاركة المعلومات الحساسة إلا عندما تسمح آلية العمل بذلك.",
      en: "Your privacy is our priority.\n\nYour personal data is not shown directly to the other party, and information is handled inside the system according to allowed permissions.\n\nSensitive information is shared only when the workflow allows it.",
    },
    icon: ShieldCheck,
  },
  {
    key: "followup",
    title: { ar: "التواصل والمتابعة", en: "Contact and follow-up" },
    subtitle: { ar: "كيف يتم التواصل بعد وجود توافق؟", en: "How contact is handled after a match" },
    body: {
      ar: "بعد وجود توافق مناسب، تبدأ مرحلة التواصل والمتابعة وفق الآلية المعتمدة.\n\nتتم متابعة الطلب والحالة من خلال المنصة، مع الحفاظ على خصوصية الطرفين وعدم كشف المعلومات غير المسموح بها.",
      en: "After a suitable match is found, the communication and follow-up stage begins according to the approved workflow.\n\nThe request and status are followed through the platform while protecting both parties' privacy.",
    },
    icon: MessageCircle,
  },
  {
    key: "register",
    title: { ar: "التسجيل لدى الخطّابة", en: "Register with a matchmaker" },
    subtitle: { ar: "كيف يتم تسجيل الفتاة وإدارة ملفها؟", en: "How a woman's profile is registered and managed" },
    body: {
      ar: "يمكن للفتاة التواصل مع الخطّابة وتقديم طلبها.\n\nتقوم الخطّابة بإدارة المواعيد والطلبات والملفات وفق الصلاحيات المتاحة لها، وتتم متابعة حالة الطلب من خلال النظام.",
      en: "A woman can contact the matchmaker and submit her request.\n\nThe matchmaker manages appointments, requests, and profiles according to her available permissions, and the request status is followed through the system.",
    },
    icon: FileText,
  },
];

const pageText = {
  ar: {
    welcome: "أول خطّابة بالذكاء الاصطناعي في العالم",
    title: "اختر شريك حياتك بهوية مخفية وبمساعدة AI، حتى يحين دور الأهل",
    subtitle: "",
    male: "أنا شاب",
    maleSub: "أبحث عن شريكة حياة مناسبة",
    female: "أنا فتاة",
    femaleSub: "تواصلي مع الخطّابة وسجّلي مجانا",
    online: "متصل",
    close: "إغلاق",
    homeLabel: "Farah.event - الرئيسية",
  },
  en: {
    welcome: "The world's first AI matchmaker",
    title: "Choose your life partner with a hidden identity and AI support until it is time for families to get involved",
    subtitle: "",
    male: "I am a man",
    maleSub: "I am looking for a suitable life partner",
    female: "I am a woman",
    femaleSub: "Contact the matchmaker and register for free",
    online: "Online",
    close: "Close",
    homeLabel: "Farah.event - Home",
  },
};

export default function Home() {
  const router = useRouter();
  const { language, isArabic, isDark: dark, dir } = usePreferences();
  const [gender, setGender] = useState<"male" | "female">("female");
  const [activeInfoCard, setActiveInfoCard] = useState<(typeof faqs)[number] | null>(null);
  const text = pageText[language];
  const ArrowIcon = isArabic ? ArrowLeft : ArrowRight;
  const visibleFaqs = faqs.filter((faq) => !["followup", "register"].includes(faq.key));

  const chooseGender = (value: "male" | "female") => {
    setGender(value);
    sessionStorage.setItem("farah_gender", value === "male" ? "MALE" : "FEMALE");
    router.push(value === "male" ? "/chat" : "/female");
  };

  return (
    <main dir={dir} className={`min-h-screen overflow-x-hidden transition-colors ${dark ? "bg-[#1A1018] text-[#FFF8FB]" : "bg-[#FAF5F8] text-[#1F1630]"}`}>
      <Navbar />
      <section className="relative flex min-h-[calc(100vh-80px)] items-start px-4 py-6 sm:items-center sm:px-6 lg:px-8">
        <div className={`pointer-events-none absolute inset-x-0 top-20 mx-auto rounded-full blur-2xl ${dark ? "h-28 max-w-[220px] bg-[rgba(201,122,161,0.12)]" : "h-48 max-w-3xl bg-[#F3E6EC]"}`} />
        <div className="relative mx-auto flex w-full max-w-4xl flex-col items-center text-center">
          <Image
            src="/logo.png"
            alt="Farah"
            width={112}
            height={112}
            priority
            unoptimized
            className="mb-3 hidden h-24 w-24 object-contain sm:block lg:h-28 lg:w-28"
          />
          <p className={`mb-1.5 text-sm font-semibold sm:text-base ${dark ? "text-[#C97AA1]" : "text-[#8E3D6B]"}`}>{text.welcome}</p>
          <h1 className={`max-w-[22rem] text-[1.55rem] font-bold leading-[1.35] tracking-normal sm:max-w-none sm:text-2xl ${dark ? "text-[#FFF8FB]" : "text-[#1F1630]"}`}>{text.title}</h1>
          <p className={`mt-2 max-w-[21rem] text-sm leading-6 sm:max-w-none sm:text-base ${dark ? "text-[#CDB7C3]" : "text-slate-500"}`}>{text.subtitle}</p>
          <div className={`mt-5 grid w-full max-w-[640px] grid-cols-2 gap-2 rounded-[24px] border p-2 shadow-[0_12px_34px_rgba(142,61,107,0.10)] sm:rounded-[26px] ${dark ? "border-[#4A3040] bg-[#21121E]" : "border-[#E6D7E0] bg-white/80"}`}>
            {(["female", "male"] as const).map((value) => (
              <button key={value} type="button" onClick={() => chooseGender(value)} className={`flex min-h-[104px] flex-col-reverse items-center justify-center gap-2 rounded-[18px] border px-3 py-3 text-center transition-colors sm:min-h-[78px] sm:flex-row sm:justify-between sm:gap-3 sm:rounded-[20px] sm:px-4 sm:text-start ${gender === value ? (dark ? "border-[#C97AA1] bg-[#261722]" : "border-[#C97AA1] bg-[#F3E6EC]") : dark ? "border-[#4A3040] bg-[#21121E] hover:border-[#C97AA1]" : "border-[#E6D7E0] bg-white hover:border-[#C97AA1]"}`}>
                <span>
                  <span className={`block text-base font-bold sm:text-lg ${gender === value ? (dark ? "text-[#C97AA1]" : "text-[#8E3D6B]") : dark ? "text-[#FFF8FB]" : "text-[#1F1630]"}`}>{value === "female" ? text.female : text.male}</span>
                  <span className={`mt-1 block text-xs leading-5 sm:text-sm ${gender === value ? (dark ? "text-[#C97AA1]" : "text-[#6E3357]") : dark ? "text-[#CDB7C3]" : "text-slate-500"}`}>{value === "female" ? text.femaleSub : text.maleSub}</span>
                </span>
                <span className={`grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full sm:h-16 sm:w-16 ${gender === value ? (dark ? "bg-[#30202C]" : "bg-[#F3E6EC]") : dark ? "bg-[#261722]" : "bg-[#F3E6EC]"}`}>
                  <GenderIcon gender={value} className="h-14 w-14 sm:h-16 sm:w-16" />
                </span>
              </button>
            ))}
          </div>
          <div className="mt-4 grid w-full max-w-[640px] grid-cols-1 gap-2 sm:mt-5 sm:grid-cols-2">
            {visibleFaqs.map((faq) => {
              const Icon = faq.icon;
              return (
                <button key={faq.key} type="button" onClick={() => setActiveInfoCard(faq)} className={`group flex min-h-[72px] cursor-pointer items-center justify-between gap-3 rounded-[18px] border px-3 text-start shadow-[0_12px_34px_rgba(142,61,107,0.08)] transition hover:-translate-y-1 sm:min-h-[78px] sm:rounded-[20px] sm:px-4 ${dark ? "border-[#4A3040] bg-[#21121E] hover:border-[#C97AA1]" : "border-[#E6D7E0] bg-white/95 hover:border-[#C97AA1]"}`}>
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${dark ? "bg-[#261722] text-[#C97AA1]" : "bg-[#F3E6EC] text-[#8E3D6B]"}`}><Icon className="h-5 w-5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm font-bold leading-6 sm:text-lg ${dark ? "text-[#FFF8FB]" : "text-[#1F1630]"}`}>{faq.title[language]}</span>
                    <span className={`mt-0.5 block text-xs leading-5 sm:mt-1 sm:text-sm ${dark ? "text-[#CDB7C3]" : "text-slate-500"}`}>{faq.subtitle[language]}</span>
                  </span>
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border sm:h-10 sm:w-10 ${dark ? "border-[#4A3040] text-[#C97AA1]" : "border-[#E6D7E0] text-[#8E3D6B]"}`}><ArrowIcon className="h-4 w-4" /></span>
                </button>
              );
            })}
          </div>
          <div className="mt-4 hidden h-10 items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-4 text-sm font-medium text-emerald-700 sm:flex">
            <Circle className="h-2.5 w-2.5 fill-emerald-500 text-emerald-500" />
            {text.online}
          </div>
        </div>
      </section>
      <Modal open={Boolean(activeInfoCard)} onOpenChange={(open) => !open && setActiveInfoCard(null)} title={activeInfoCard ? activeInfoCard.title[language] : ""} dir={dir}>
        {activeInfoCard && (
          <div className="text-start">
            <div className="mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-[#F3E6EC] text-[#8E3D6B]">
              <activeInfoCard.icon className="h-7 w-7" />
            </div>
            <div className="space-y-4 text-[15px] leading-8 text-slate-600">
              {activeInfoCard.body[language].split("\n\n").map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </main>
  );
}
