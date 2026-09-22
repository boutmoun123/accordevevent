"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, LogIn, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useAuth } from "@/components/providers/auth-provider";
import { usePreferences } from "@/components/providers/preferences-provider";
import { Button } from "@/components/ui/button";
import { safeRedirectPath } from "@/lib/utils";
import { api, clearTokens } from "@/services/api";

type Form = {
  identifier: string;
  password: string;
};

const text = {
  ar: {
    identifierRequired: "أدخل رقم الهاتف أو البريد الإلكتروني",
    passwordShort: "كلمة المرور قصيرة",
    staffOnly: "هذه الصفحة مخصصة لفريق Farah.event.",
    invalid: "بيانات الدخول غير صحيحة",
    title: "دخول فريق Farah.event",
    subtitle: "للإدارة والخطّابات المصرّح لهن فقط.",
    identifier: "رقم الهاتف أو البريد الإلكتروني",
    password: "كلمة المرور",
    hidePassword: "إخفاء كلمة المرور",
    showPassword: "إظهار كلمة المرور",
    signingIn: "جاري الدخول...",
    signIn: "تسجيل الدخول",
    malePrompt: "هل أنت شاب؟",
    maleLogin: "الدخول برقم الهاتف أو الطلب",
  },
  en: {
    identifierRequired: "Enter phone number or email",
    passwordShort: "Password is too short",
    staffOnly: "This page is for the Farah.event team.",
    invalid: "Invalid sign-in details",
    title: "Farah.event team sign-in",
    subtitle: "For authorized admins and matchmakers only.",
    identifier: "Phone number or email",
    password: "Password",
    hidePassword: "Hide password",
    showPassword: "Show password",
    signingIn: "Signing in...",
    signIn: "Sign in",
    malePrompt: "Are you a man?",
    maleLogin: "Sign in with phone or request code",
  },
};

export default function StaffLogin() {
  const [show, setShow] = useState(false);
  const router = useRouter();
  const params = useSearchParams();
  const { refresh } = useAuth();
  const { language } = usePreferences();
  const t = text[language];
  const schema = useMemo(
    () =>
      z.object({
        identifier: z.string().min(3, t.identifierRequired),
        password: z.string().min(6, t.passwordShort),
      }),
    [t.identifierRequired, t.passwordShort],
  );
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema) });

  const submit = async (data: Form) => {
    try {
      const result = await api.staffLogin(data.identifier, data.password);
      const role = result.user?.role;
      if (role !== "SUPER_ADMIN" && role !== "MATCHMAKER") {
        clearTokens();
        throw new Error(t.staffOnly);
      }
      await refresh();
      router.replace(safeRedirectPath(params.get("next")) || (role === "SUPER_ADMIN" ? "/admin" : "/matchmaker"));
    } catch (value) {
      toast.error(value instanceof Error ? value.message : t.invalid);
    }
  };

  return (
    <>
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-pink text-brand-rose">
        <ShieldCheck />
      </div>
      <h1 className="mt-5 text-3xl font-bold">{t.title}</h1>
      <p className="mt-2 text-slate-500">{t.subtitle}</p>
      <form className="mt-8 space-y-5" onSubmit={handleSubmit(submit)}>
        <div>
          <label className="label" htmlFor="staff-identifier">{t.identifier}</label>
          <input id="staff-identifier" className="field" dir="ltr" autoComplete="username" {...register("identifier")} />
          <p className="mt-1 text-xs text-red-600">{errors.identifier?.message}</p>
        </div>
        <div>
          <label className="label" htmlFor="staff-password">{t.password}</label>
          <div className="relative">
            <input id="staff-password" className="field pl-11" dir="ltr" type={show ? "text" : "password"} autoComplete="current-password" {...register("password")} />
            <button type="button" onClick={() => setShow((value) => !value)} className="absolute left-3 top-3 text-slate-400" aria-label={show ? t.hidePassword : t.showPassword}>
              {show ? <EyeOff /> : <Eye />}
            </button>
          </div>
          <p className="mt-1 text-xs text-red-600">{errors.password?.message}</p>
        </div>
        <Button className="w-full" disabled={isSubmitting}>
          {isSubmitting ? t.signingIn : <><LogIn size={17} /> {t.signIn}</>}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">
        {t.malePrompt}{" "}
        <Link href="/auth/login" className="font-semibold text-brand-rose">
          {t.maleLogin}
        </Link>
      </p>
    </>
  );
}
