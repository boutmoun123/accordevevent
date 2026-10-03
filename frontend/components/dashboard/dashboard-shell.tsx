"use client";

import { Bell, CheckCheck, ChevronDown, LogOut, Menu, Moon, Sun, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Logo } from "@/components/brand/logo";
import { useAuth } from "@/components/providers/auth-provider";
import { usePreferences } from "@/components/providers/preferences-provider";
import { languageLabel } from "@/lib/i18n";
import { cn, formatDate } from "@/lib/utils";
import { api } from "@/services/api";
import type { Notification } from "@/types";

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
    noNotifications: "لا توجد إشعارات",
    loadingNotifications: "جاري تحميل الإشعارات...",
    viewAll: "عرض الكل",
    markRead: "تمت القراءة",
    user: "المستخدم",
  },
  en: {
    signOut: "Sign out",
    closeMenu: "Close menu",
    subtitle: "Secure, organized management for the matchmaking journey",
    notifications: "Notifications",
    noNotifications: "No notifications",
    loadingNotifications: "Loading notifications...",
    viewAll: "View all",
    markRead: "Mark read",
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
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const path = usePathname();
  const { user, signOut } = useAuth();
  const { dir, language, toggleLanguage, isDark, toggleTheme } = usePreferences();
  const text = shellText[language];
  const scope = path.startsWith("/admin") ? "admin" : path.startsWith("/matchmaker") ? "matchmaker" : undefined;
  const notificationsHref = scope ? `/${scope}/notifications` : "#";
  const unreadCount = useMemo(() => notifications.filter((item) => !item.read_at).length, [notifications]);
  const loadNotifications = useCallback(async () => {
    if (!scope) return;
    setNotificationsLoading(true);
    try {
      const result = await api.get<Notification[] | { items: Notification[] }>(`/${scope}/notifications`);
      setNotifications(Array.isArray(result) ? result : result.items);
    } catch {
      setNotifications([]);
    } finally {
      setNotificationsLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Fetch external notification data when the dashboard scope changes.
    void loadNotifications();
  }, [loadNotifications]);

  const markNotificationRead = async (id: string) => {
    if (!scope) return;
    await api.patch(`/${scope}/notifications/${id}`, { read: true });
    setNotifications((items) =>
      items.map((item) => item.id === id ? { ...item, read_at: new Date().toISOString() } : item),
    );
  };

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
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setNotificationsOpen((value) => !value);
                  void loadNotifications();
                }}
                className={`relative rounded-xl border p-2.5 ${isDark ? "border-[#4A3040] bg-[#261722] text-[#C97AA1] hover:bg-[#30202C]" : "border-[#E6D7E0] bg-white text-[#6E3357] hover:bg-[#F3E6EC]"}`}
                aria-label={text.notifications}
                aria-expanded={notificationsOpen}
              >
                <Bell size={19} />
                {unreadCount > 0 && (
                  <span className="absolute -left-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-brand-rose px-1 text-[10px] font-bold text-white ring-2 ring-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
              {notificationsOpen && (
                <div className={`absolute left-0 top-12 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border shadow-xl ${isDark ? "border-[#4A3040] bg-[#21121E]" : "border-[#E6D7E0] bg-white"}`}>
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                    <h2 className="font-bold">{text.notifications}</h2>
                    <Link href={notificationsHref} onClick={() => setNotificationsOpen(false)} className="text-xs font-semibold text-brand-rose">
                      {text.viewAll}
                    </Link>
                  </div>
                  <div className="max-h-96 overflow-y-auto p-2">
                    {notificationsLoading ? (
                      <p className="p-4 text-sm text-slate-500">{text.loadingNotifications}</p>
                    ) : notifications.length ? (
                      notifications.slice(0, 6).map((item) => (
                        <article key={item.id} className={`rounded-xl p-3 ${item.read_at ? "opacity-70" : isDark ? "bg-[#2A1A26]" : "bg-brand-pink/60"}`}>
                          <div className="flex items-start gap-3">
                            <span className="mt-1 rounded-lg bg-white/70 p-2 text-brand-rose">
                              <Bell size={15} />
                            </span>
                            <div className="min-w-0 flex-1">
                              <h3 className="truncate text-sm font-semibold">{item.title || item.type.replaceAll("_", " ")}</h3>
                              <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{item.body || item.message || "—"}</p>
                              <time className="mt-2 block text-[11px] text-slate-400">{formatDate(item.created_at)}</time>
                            </div>
                            {!item.read_at && (
                              <button type="button" onClick={() => void markNotificationRead(item.id)} className="rounded-lg p-1.5 text-brand-rose hover:bg-white/70" aria-label={text.markRead}>
                                <CheckCheck size={16} />
                              </button>
                            )}
                          </div>
                        </article>
                      ))
                    ) : (
                      <p className="p-4 text-sm text-slate-500">{text.noNotifications}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
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
