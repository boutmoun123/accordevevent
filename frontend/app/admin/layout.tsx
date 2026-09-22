"use client";

import {
  BadgeDollarSign,
  Bell,
  BookOpenCheck,
  CalendarDays,
  CircleDollarSign,
  FileWarning,
  Gem,
  HeartHandshake,
  House,
  Inbox,
  KeyRound,
  Landmark,
  ScrollText,
  Settings,
  ShieldCheck,
  UserCog,
  UsersRound,
} from "lucide-react";
import { DashboardShell, type NavItem } from "@/components/dashboard/dashboard-shell";
import { RoleGuard } from "@/components/dashboard/guard";
import { usePreferences } from "@/components/providers/preferences-provider";

const nav = [
  { label: { ar: "لوحة التحكم", en: "Dashboard" }, href: "/admin", icon: House },
  { group: { ar: "إدارة المستخدمين", en: "User management" }, label: { ar: "جميع المستخدمين", en: "All users" }, href: "/admin/users", icon: UsersRound },
  { group: { ar: "إدارة المستخدمين", en: "User management" }, label: { ar: "الشباب", en: "Men" }, href: "/admin/males", icon: UserCog },
  { group: { ar: "إدارة المستخدمين", en: "User management" }, label: { ar: "الخطّابات", en: "Matchmakers" }, href: "/admin/matchmakers", icon: ShieldCheck },
  { group: { ar: "الملفات", en: "Profiles" }, label: { ar: "ملفات الفتيات", en: "Women's profiles" }, href: "/admin/female-profiles", icon: BookOpenCheck },
  { group: { ar: "الملفات", en: "Profiles" }, label: { ar: "طلبات الفتيات", en: "Women's requests" }, href: "/admin/female-leads", icon: Inbox },
  { group: { ar: "التوفيق", en: "Matching" }, label: { ar: "طلبات الشباب", en: "Men's requests" }, href: "/admin/male-requests", icon: ScrollText },
  { group: { ar: "التوفيق", en: "Matching" }, label: { ar: "فرص التوافق", en: "Match opportunities" }, href: "/admin/matches", icon: HeartHandshake },
  { group: { ar: "التوفيق", en: "Matching" }, label: { ar: "الحالات", en: "Cases" }, href: "/admin/cases", icon: Gem },
  { group: { ar: "التوفيق", en: "Matching" }, label: { ar: "اللقاءات", en: "Meetings" }, href: "/admin/meetings", icon: CalendarDays },
  { group: { ar: "التوفيق", en: "Matching" }, label: { ar: "الخطبات", en: "Engagements" }, href: "/admin/engagements", icon: HeartHandshake },
  { group: { ar: "التوفيق", en: "Matching" }, label: { ar: "الزيجات", en: "Marriages" }, href: "/admin/marriages", icon: HeartHandshake },
  { group: { ar: "المالية", en: "Finance" }, label: { ar: "المدفوعات", en: "Payments" }, href: "/admin/payments", icon: CircleDollarSign },
  { group: { ar: "المالية", en: "Finance" }, label: { ar: "أتعاب النجاح", en: "Success fees" }, href: "/admin/success-fees", icon: BadgeDollarSign },
  { group: { ar: "النظام", en: "System" }, label: { ar: "الإشعارات", en: "Notifications" }, href: "/admin/notifications", icon: Bell },
  { group: { ar: "النظام", en: "System" }, label: { ar: "البلاغات", en: "Reports" }, href: "/admin/reports", icon: FileWarning },
  { group: { ar: "النظام", en: "System" }, label: { ar: "سجل التدقيق", en: "Audit log" }, href: "/admin/audit-logs", icon: Landmark },
  { group: { ar: "النظام", en: "System" }, label: { ar: "الإعدادات", en: "Settings" }, href: "/admin/settings", icon: Settings },
  { group: { ar: "النظام", en: "System" }, label: { ar: "الصلاحيات", en: "Permissions" }, href: "/admin/permissions", icon: KeyRound },
] as const;

export default function Layout({ children }: { children: React.ReactNode }) {
  const { language } = usePreferences();
  const items: NavItem[] = nav.map((item) => ({
    label: item.label[language],
    href: item.href,
    icon: item.icon,
    group: "group" in item ? item.group[language] : undefined,
  }));

  return (
    <RoleGuard role="SUPER_ADMIN">
      <DashboardShell items={items} title={language === "ar" ? "الإدارة العليا" : "Admin"}>
        {children}
      </DashboardShell>
    </RoleGuard>
  );
}
