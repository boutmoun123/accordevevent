"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, CheckCircle2, LockKeyhole, Phone } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Logo } from "@/components/brand/logo";
import { usePreferences } from "@/components/providers/preferences-provider";
import { Button } from "@/components/ui/button";
import { governorateOptions } from "@/lib/i18n";
import type { ContactSlot } from "@/lib/availability";
import { api } from "@/services/api";

type Form = {
  phone: string;
  governorate: string;
  slot_id: string;
  notes?: string;
  consent: true;
};

const text = {
  ar: {
    home: "الرئيسية",
    doneTitle: "وصل طلبك بأمان",
    doneBody: "ستتواصل معك خطّابة موثوقة في الوقت المناسب. لن يعرض رقمك أو أي من بياناتك للعامة.",
    backHome: "العودة للرئيسية",
    introTitle: "خصوصيتك أولا",
    introBody: "خصوصيتك محفوظة. لا نعرض بياناتك لأي مستخدم داخل المنصة.\n\nالتسجيل يتم عبر خطّابات موثوقات، ويتم إنشاء ملفك ومتابعته من خلال الخطّابة فقط.\n\nلا حاجة للبحث بين الشباب. التوافق يتم بشكل خاص ومنظم، ثم تبدأ المتابعة عند وجود توافق مناسب.",
    start: "اتركي رقمك لتتواصل معك الخطّابة",
    formTitle: "طلب تواصل خاص",
    required: "الحقول المعلّمة مطلوبة.",
    phone: "رقم الهاتف *",
    governorate: "المحافظة *",
    selectGovernorate: "اختاري المحافظة",
    slot: "اختر موعدا مناسبا *",
    timezone: "المواعيد حسب توقيت دمشق",
    loadingSlots: "جاري تحميل المواعيد...",
    loadError: "تعذر تحميل المواعيد.",
    retry: "إعادة المحاولة",
    noSlots: "لا توجد مواعيد متاحة حاليا، يرجى المحاولة لاحقا.",
    notes: "ملاحظات (اختياري)",
    consent: "أوافق على معالجة بياناتي لغرض تواصل الخطّابة معي، وفق سياسة الخصوصية.",
    submitting: "جاري الإرسال...",
    submit: "إرسال الطلب بأمان",
    validPhone: "أدخلي رقم هاتف صحيحا",
    selectSlot: "اختاري موعدا مناسبا",
    selectGovernorateError: "اختاري المحافظة",
    consentError: "الموافقة مطلوبة لإرسال الطلب",
    submitError: "تعذر إرسال الطلب",
  },
  en: {
    home: "Home",
    doneTitle: "Your request was received safely",
    doneBody: "A trusted matchmaker will contact you at the right time. Your phone number and personal details will not be shown publicly.",
    backHome: "Back to home",
    introTitle: "Privacy first",
    introBody: "Your privacy is protected. We do not show your details to any user inside the platform.\n\nRegistration is handled through trusted matchmakers, and your profile is created and followed by the matchmaker only.\n\nThere is no need to browse profiles. Matching is private and organized, then follow-up begins when there is a suitable match.",
    start: "Leave your number so the matchmaker can contact you",
    formTitle: "Private contact request",
    required: "Marked fields are required.",
    phone: "Phone number *",
    governorate: "Governorate *",
    selectGovernorate: "Choose governorate",
    slot: "Choose a suitable appointment *",
    timezone: "Times are shown in Damascus time",
    loadingSlots: "Loading appointments...",
    loadError: "Could not load appointments.",
    retry: "Try again",
    noSlots: "No appointments are currently available. Please try again later.",
    notes: "Notes (optional)",
    consent: "I agree to the processing of my data so the matchmaker can contact me, according to the privacy policy.",
    submitting: "Sending...",
    submit: "Send request safely",
    validPhone: "Enter a valid phone number",
    selectSlot: "Choose a suitable appointment",
    selectGovernorateError: "Choose a governorate",
    consentError: "Consent is required to send the request",
    submitError: "Could not send the request",
  },
};

export default function FemalePage() {
  const { language, dir, isDark } = usePreferences();
  const t = text[language];
  const [mode, setMode] = useState<"intro" | "form" | "done">("intro");
  const [slots, setSlots] = useState<ContactSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const ArrowIcon = dir === "rtl" ? ArrowRight : ArrowLeft;
  const schema = useMemo(
    () =>
      z.object({
        phone: z.string().min(8, t.validPhone).max(30).regex(/^\+?[0-9][0-9\- ]+$/, t.validPhone),
        governorate: z.string().min(1, t.selectGovernorateError),
        slot_id: z.string().min(1, t.selectSlot),
        notes: z.string().max(500).optional(),
        consent: z.literal(true, { errorMap: () => ({ message: t.consentError }) }),
      }),
    [t.consentError, t.selectGovernorateError, t.selectSlot, t.validPhone],
  );
  const {
    register,
    setValue,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema) });

  const loadSlots = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const owner = new URLSearchParams(window.location.search).get("matchmaker_id");
      setSlots(await api.get(`/contact-availability${owner ? `?matchmaker_id=${encodeURIComponent(owner)}` : ""}`));
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  const openForm = () => {
    setMode("form");
    void loadSlots();
  };

  const submit = async (data: Form) => {
    try {
      const selected = slots.find((slot) => slot.id === data.slot_id);
      if (!selected) throw new Error(t.selectSlot);
      const { slot_id, ...details } = data;
      void slot_id;
      await api.post("/female-leads", {
        ...details,
        matchmaker_id: selected.matchmaker_id,
        scheduled_at: selected.scheduled_at,
      });
      setMode("done");
    } catch (error) {
      setValue("slot_id", "");
      toast.error(error instanceof Error ? error.message : t.submitError);
      void loadSlots();
    }
  };

  return (
    <main dir={dir} className={`min-h-screen px-4 py-8 transition-colors ${isDark ? "bg-[#180B13] text-[#FFF7FA]" : "bg-gradient-to-b from-brand-pink to-brand-paper text-[#111936]"}`}>
      <div className="mx-auto max-w-2xl">
        <div className="mb-10 flex items-center justify-between">
          <Logo />
          <Link href="/" className={`flex items-center gap-2 text-sm ${isDark ? "text-[#C9A8B5] hover:text-white" : "text-slate-500"}`}>
            <ArrowIcon size={16} /> {t.home}
          </Link>
        </div>
        <div className={`rounded-[2rem] p-6 sm:p-10 ${isDark ? "border border-[#4A2134] bg-[#21101A] shadow-[0_20px_60px_rgba(0,0,0,0.22)]" : "glass"}`}>
          {mode === "done" ? (
            <div className="py-12 text-center">
              <CheckCircle2 className="mx-auto text-green-600" size={56} />
              <h1 className="mt-5 text-2xl font-bold">{t.doneTitle}</h1>
              <p className={`mx-auto mt-3 max-w-md leading-7 ${isDark ? "text-[#E8D7DE]" : "text-slate-500"}`}>{t.doneBody}</p>
              <Button asChild className="mt-7">
                <Link href="/">{t.backHome}</Link>
              </Button>
            </div>
          ) : mode === "intro" ? (
            <div>
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-pink text-brand-rose">
                <LockKeyhole />
              </div>
              <h1 className="mt-6 text-3xl font-bold">{t.introTitle}</h1>
              <div className={`mt-4 space-y-4 leading-8 ${isDark ? "text-[#E8D7DE]" : "text-slate-600"}`}>
                {t.introBody.split("\n\n").map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
              <div className="mt-8 grid gap-3">
                <Button onClick={openForm}>
                  <Phone size={18} /> {t.start}
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit(submit)} className="space-y-4">
              <div>
                <h1 className="text-2xl font-bold">{t.formTitle}</h1>
                <p className={`mt-1 text-sm ${isDark ? "text-[#C9A8B5]" : "text-slate-500"}`}>{t.required}</p>
              </div>
              <div>
                <label className="label" htmlFor="contact-phone">{t.phone}</label>
                <input className="field" inputMode="tel" id="contact-phone" dir="ltr" {...register("phone")} />
                <p className="mt-1 text-xs text-red-600">{errors.phone?.message}</p>
              </div>
              <div>
                <label className="label" htmlFor="contact-governorate">{t.governorate}</label>
                <select id="contact-governorate" className="field" {...register("governorate")}>
                  <option value="">{t.selectGovernorate}</option>
                  {governorateOptions.map((item) => (
                    <option key={item.value} value={item.value}>{item[language]}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-red-600">{errors.governorate?.message}</p>
              </div>
              <fieldset>
                <legend className="label">{t.slot}</legend>
                <p className={`mb-2 text-xs ${isDark ? "text-[#C9A8B5]" : "text-slate-500"}`}>{t.timezone}</p>
                {loading ? (
                  <p role="status">{t.loadingSlots}</p>
                ) : loadError ? (
                  <div role="alert">
                    {t.loadError} <Button type="button" variant="outline" onClick={loadSlots}>{t.retry}</Button>
                  </div>
                ) : slots.length === 0 ? (
                  <p role="status">{t.noSlots}</p>
                ) : (
                  <div className="space-y-4">
                    {Array.from(new Set(slots.map((slot) => slot.appointment_date))).map((date) => (
                      <fieldset key={date} className="space-y-2">
                        <legend className="font-semibold">
                          {new Date(`${date}T12:00:00+03:00`).toLocaleDateString(language === "ar" ? "ar-SY" : "en-US", {
                            timeZone: "Asia/Damascus",
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                          })}
                        </legend>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                          {slots.filter((slot) => slot.appointment_date === date).map((slot) => (
                            <label key={slot.id} className={`cursor-pointer rounded-xl border p-3 has-[:checked]:border-brand-rose ${isDark ? "border-[#4A2134] bg-[#2B1421] text-[#FFF7FA] has-[:checked]:bg-[#3A1730]" : "border-brand-rose/20 bg-white has-[:checked]:bg-brand-pink"}`}>
                              <input type="radio" className="mx-2 accent-brand-rose" value={slot.id} {...register("slot_id")} />
                              {new Date(slot.scheduled_at).toLocaleTimeString(language === "ar" ? "ar-SY" : "en-US", {
                                timeZone: "Asia/Damascus",
                                hour: "numeric",
                                minute: "2-digit",
                                hour12: true,
                              })}
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    ))}
                  </div>
                )}
                <p className="mt-1 text-xs text-red-600">{errors.slot_id?.message}</p>
              </fieldset>
              <div>
                <label className="label">{t.notes}</label>
                <textarea rows={3} className="field resize-none" {...register("notes")} />
              </div>
              <label className={`flex cursor-pointer gap-3 rounded-xl p-4 text-sm leading-6 ${isDark ? "bg-[#2B1421] text-[#E8D7DE]" : "bg-slate-50"}`}>
                <input type="checkbox" className="mt-1 accent-brand-rose" {...register("consent")} />
                <span>{t.consent}</span>
              </label>
              <p className="text-xs text-red-600">{errors.consent?.message}</p>
              <Button className="w-full" disabled={isSubmitting || loading || loadError || slots.length === 0}>
                {isSubmitting ? t.submitting : t.submit}
              </Button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
