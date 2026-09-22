"use client";
import { useRouter } from "next/navigation";
import { ArrowLeft, ShieldCheck, UserRound } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
export function GenderStart() {
  const router = useRouter();
  const [text, setText] = useState("");
  const choose = (gender: "MALE" | "FEMALE") => {
    sessionStorage.setItem("farah_gender", gender);
    if (text.trim()) sessionStorage.setItem("farah_first_message", text.trim());
    router.push(gender === "MALE" ? "/chat" : "/female");
  };
  return (
    <div className="mx-auto mt-10 max-w-3xl">
      <div className="mb-5 grid grid-cols-2 gap-3">
        <button
          onClick={() => choose("MALE")}
          className="group rounded-2xl border bg-white p-5 text-right shadow-sm transition hover:-translate-y-1 hover:border-brand-rose"
        >
          <UserRound className="mb-3 text-brand-rose" />
          <strong>أنا شاب</strong>
          <span className="mt-1 block text-xs text-slate-500">
            ابدأ محادثة طلب التوفيق
          </span>
        </button>
        <button
          onClick={() => choose("FEMALE")}
          className="group rounded-2xl border bg-white p-5 text-right shadow-sm transition hover:-translate-y-1 hover:border-brand-rose"
        >
          <ShieldCheck className="mb-3 text-brand-rose" />
          <strong>أنا فتاة</strong>
          <span className="mt-1 block text-xs text-slate-500">
            تواصلي بخصوصية مع خطّابة
          </span>
        </button>
      </div>
      <div className="glass rounded-3xl p-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          className="w-full resize-none bg-transparent p-3 outline-none"
          placeholder="اكتب هنا... مثلاً أبحث عن فتاة من دمشق بعمر 24 إلى 29 سنة"
        />
        <div className="flex items-center justify-between border-t px-2 pt-3">
          <span className="flex items-center gap-1.5 text-xs text-slate-400">
            <ShieldCheck size={14} /> محادثتك خاصة وآمنة
          </span>
          <Button onClick={() => choose("MALE")} size="icon" aria-label="إرسال">
            <ArrowLeft size={18} />
          </Button>
        </div>
      </div>
    </div>
  );
}
