"use client";

import { FileKey2, ShieldCheck } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { useAuth } from "@/components/providers/auth-provider";
import { usePreferences } from "@/components/providers/preferences-provider";
import { Button } from "@/components/ui/button";
import { api } from "@/services/api";
import type { AuthSession, MaleRequest } from "@/types";

const text = {
  ar: {
    title: "أهلا بك في Farah.event",
    subtitle: "ادخل إلى طلبك باستخدام رقم الطلب فقط.",
    requestCode: "رقم الطلب",
    requestHint: "استخدم الرقم الذي حصلت عليه عند إكمال طلبك.",
    requestMissing: "أدخل رقم الطلب كاملا",
    requestInvalid: "رقم الطلب غير صحيح.",
    requestLogin: "الدخول إلى طلبي",
    requestBusy: "جاري الدخول...",
    requestLoggedIn: "تم الدخول إلى طلبك",
  },
  en: {
    title: "Welcome to Farah.event",
    subtitle: "Sign in to your request using the request code only.",
    requestCode: "Request code",
    requestHint: "Use the code you received when you completed your request.",
    requestMissing: "Enter the full request code",
    requestInvalid: "Invalid request code.",
    requestLogin: "Sign in to my request",
    requestBusy: "Signing in...",
    requestLoggedIn: "Signed in to your request",
  },
};

export default function Login() {
  const { language, isDark } = usePreferences();
  const [requestCode, setRequestCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { refresh } = useAuth();
  const t = text[language];
  const muted = isDark ? "text-[#CDB7C3]" : "text-slate-500";
  const schema = useMemo(
    () => z.string().trim().min(8, t.requestMissing).max(40, t.requestInvalid),
    [t.requestInvalid, t.requestMissing],
  );

  const finishAuthentication = async (result: AuthSession) => {
    await refresh();
    let activeRequest = result.active_request;
    if (activeRequest === undefined) {
      try {
        activeRequest = await api.get<MaleRequest>("/male/request");
      } catch (value) {
        if ((value as { status?: number }).status !== 404) throw value;
        activeRequest = null;
      }
    }
    window.location.assign(activeRequest ? "/account" : "/chat");
  };

  const submitRequestCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = schema.safeParse(requestCode);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message || t.requestInvalid;
      setError(message);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await api.loginMaleWithRequestCode(parsed.data.toUpperCase());
      toast.success(t.requestLoggedIn);
      await finishAuthentication(result);
    } catch (value) {
      const message = value instanceof Error ? value.message : t.requestInvalid;
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-pink text-brand-rose">
        <ShieldCheck />
      </div>
      <h1 className="mt-5 text-3xl font-bold">{t.title}</h1>
      <p className={`mt-2 leading-7 ${muted}`}>{t.subtitle}</p>

      <form className="mt-8 space-y-5" onSubmit={submitRequestCode}>
        <div>
          <label className="label" htmlFor="male-request-code">{t.requestCode}</label>
          <div className="relative">
            <FileKey2 className="pointer-events-none absolute top-3.5 text-slate-400 ltr:left-3 rtl:right-3" size={17} />
            <input
              id="male-request-code"
              className="field text-center font-mono uppercase tracking-wider"
              dir="ltr"
              autoComplete="off"
              placeholder="FRH-X7K9-P2M4"
              value={requestCode}
              onChange={(event) => setRequestCode(event.target.value)}
              autoFocus
            />
          </div>
          <p className={`mt-2 text-xs leading-5 ${muted}`}>{t.requestHint}</p>
        </div>
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
        <Button className="w-full" disabled={busy}>
          {busy ? t.requestBusy : t.requestLogin}
        </Button>
      </form>
    </>
  );
}
