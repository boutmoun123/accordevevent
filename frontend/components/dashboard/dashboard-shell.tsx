"use client";

import { Bell, ChevronDown, LogOut, Menu, Moon, Sun, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/brand/logo";
import { useAuth } from "@/components/providers/auth-provider";
import { usePreferences } from "@/components/providers/preferences-provider";
import { languageLabel } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number }>;
  group?: string;
}

const shellText = {
  ar: {
    signOut: "تسجيل الخروج",
    closeMenu: "إغلاق القائمة",
    subtitle: "إدارة آمنة ومنظمة لرحلة التوفيق",
    notifications: "الإشعارات",
    user: "المستخدم",
  },
  en: {
    signOut: "Sign out",
    closeMenu: "Close menu",
    subtitle: "Secure, organized management for the matchmaking journey",
    notifications: "Notifications",
    user: "User",
  },
};

export function DashboardShell({
  children,
  items,
  title,
}: {
  children: React.ReactNode;
  items: NavItem[];
  title: string;
}) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const { user, signOut } = useAuth();
  const { dir, language, toggleLanguage, isDark, toggleTheme } = usePreferences();
  const text = shellText[language];

  const sidebar = (
    <>
      <div className="flex h-20 items-center justify-between px-5">
        <Logo light />
        <button className="lg:hidden" onClick={() => setOpen(false)} aria-label={text.closeMenu}>
          <X className="text-white" />
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        {items.map((item, index) => {
          const Icon = item.icon;
          const previousGroup = items[index - 1]?.group;
          return (
            <div key={item.href}>
              {item.group && item.group !== previousGroup && (
                <p className="mb-2 mt-5 px-3 text-[11px] font-semibold text-white/35">{item.group}</p>
              )}
              <Link
                onClick={() => setOpen(false)}
                href={item.href}
                className={cn(
                  "mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
                  path === item.href ? "bg-brand-rose text-white" : "text-white/65 hover:bg-white/5 hover:text-white",
                )}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            </div>
          );
        })}
      </nav>
      <button onClick={() => void signOut()} className="m-3 flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-white/60 hover:bg-white/5">
        <LogOut size={18} />
        {text.signOut}
      </button>
    </>
  );

  return (
    <div dir={dir} className={`min-h-screen ${isDark ? "bg-[#1A1018] text-[#FFF8FB]" : "bg-[#FAF5F8] text-[#1F1630]"}`}>
      <aside className={`fixed inset-y-0 z-40 hidden w-64 flex-col bg-brand-navy lg:flex ${dir === "rtl" ? "right-0" : "left-0"}`}>
        {sidebar}
      </aside>
      {open && (
        <>
          <button aria-label={text.closeMenu} className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />
          <aside className={`fixed inset-y-0 z-50 flex w-72 flex-col bg-brand-navy lg:hidden ${dir === "rtl" ? "right-0" : "left-0"}`}>
            {sidebar}
          </aside>
        </>
      )}
      <div className={dir === "rtl" ? "lg:mr-64" : "lg:ml-64"}>
        <header className={`sticky top-0 z-30 flex h-20 items-center justify-between border-b px-4 backdrop-blur sm:px-7 ${isDark ? "border-[#4A3040] bg-[#21121E]/95" : "border-[#E6D7E0] bg-white/90"}`}>
          <div className="flex items-center gap-3">
            <button onClick={() => setOpen(true)} className="rounded-xl border p-2 lg:hidden" aria-label={text.closeMenu}>
              <Menu />
            </button>
            <div>
              <h1 className="font-bold">{title}</h1>
              <p className={`hidden text-xs sm:block ${isDark ? "text-[#CDB7C3]" : "text-[#6F5C69]"}`}>{text.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={toggleLanguage} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${isDark ? "border-[#4A3040] bg-[#261722] text-[#C97AA1] hover:bg-[#30202C]" : "border-[#E6D7E0] bg-white text-[#6E3357] hover:bg-[#F3E6EC]"}`} dir="ltr">
              {languageLabel[language]}
            </button>
            <button type="button" onClick={toggleTheme} className={`rounded-xl border p-2.5 ${isDark ? "border-[#4A3040] bg-[#261722] text-[#C97AA1] hover:bg-[#30202C]" : "border-[#E6D7E0] bg-white text-[#6E3357] hover:bg-[#F3E6EC]"}`} aria-label={isDark ? "Light mode" : "Dark mode"}>
              {isDark ? <Moon size={19} /> : <Sun size={19} />}
            </button>
            <button className={`relative rounded-xl border p-2.5 ${isDark ? "border-[#4A3040] bg-[#261722] text-[#C97AA1] hover:bg-[#30202C]" : "border-[#E6D7E0] bg-white text-[#6E3357] hover:bg-[#F3E6EC]"}`} aria-label={text.notifications}>
              <Bell size={19} />
              <span className="absolute -left-1 -top-1 h-2.5 w-2.5 rounded-full bg-brand-rose ring-2 ring-white" />
            </button>
            <button className={`hidden items-center gap-3 rounded-xl border p-2 sm:flex ${isDark ? "border-[#4A3040] bg-[#261722]" : "border-[#E6D7E0] bg-white"}`}>
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand-pink text-sm font-bold text-brand-rose">
                {user?.first_name?.[0] || "F"}
              </div>
              <span className="text-sm">{user?.first_name || text.user}</span>
              <ChevronDown size={14} />
            </button>
          </div>
        </header>
        <main className="p-4 sm:p-7">{children}</main>
      </div>
    </div>
  );
}
