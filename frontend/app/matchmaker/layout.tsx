"use client";

import {
  Bell,
  CalendarDays,
  CircleDollarSign,
  HeartHandshake,
  House,
  Inbox,
  MessageSquare,
  SearchCheck,
  Settings,
  UserRound,
  UsersRound,
} from "lucide-react";
import { DashboardShell, type NavItem } from "@/components/dashboard/dashboard-shell";
import { RoleGuard } from "@/components/dashboard/guard";
import { usePreferences } from "@/components/providers/preferences-provider";

const nav = [
  { label: { ar: "مواعيد التواصل", en: "Contact appointments" }, href: "/matchmaker/availability", icon: CalendarDays },
  { label: { ar: "الرئيسية", en: "Home" }, href: "/matchmaker", icon: House },
  { label: { ar: "طلبات الشباب", en: "Men's requests" }, href: "/matchmaker/male-requests", icon: SearchCheck },
  { label: { ar: "ملفات الفتيات", en: "Women's profiles" }, href: "/matchmaker/female-profiles", icon: UsersRound },
  { label: { ar: "العملاء الجدد", en: "New leads" }, href: "/matchmaker/female-leads", icon: Inbox },
  { label: { ar: "فرص التوافق", en: "Match opportunities" }, href: "/matchmaker/matches", icon: HeartHandshake },
  { label: { ar: "الحالات", en: "Cases" }, href: "/matchmaker/cases", icon: HeartHandshake },
  { label: { ar: "اللقاءات", en: "Meetings" }, href: "/matchmaker/meetings", icon: CalendarDays },
  { label: { ar: "المدفوعات", en: "Payments" }, href: "/matchmaker/payments", icon: CircleDollarSign },
  { label: { ar: "المحادثات", en: "Conversations" }, href: "/matchmaker/conversations", icon: MessageSquare },
  { label: { ar: "الإشعارات", en: "Notifications" }, href: "/matchmaker/notifications", icon: Bell },
  { label: { ar: "الملف الشخصي", en: "Profile" }, href: "/matchmaker/profile", icon: UserRound },
  { label: { ar: "الإعدادات", en: "Settings" }, href: "/matchmaker/settings", icon: Settings },
] as const;

export default function Layout({ children }: { children: React.ReactNode }) {
  const { language } = usePreferences();
  const items: NavItem[] = nav.map((item) => ({
    label: item.label[language],
    href: item.href,
    icon: item.icon,
  }));

  return (
    <RoleGuard role="MATCHMAKER">
      <DashboardShell items={items} title={language === "ar" ? "مساحة الخطّابة" : "Matchmaker workspace"}>
        {children}
      </DashboardShell>
    </RoleGuard>
  );
}
