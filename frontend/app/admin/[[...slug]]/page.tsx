"use client";
import { use } from "react";
import { DashboardOverview } from "@/components/dashboard/overview";
import { Notifications } from "@/components/dashboard/notifications";
import {
  ResourceManager,
  type Column,
  type StatusAction,
} from "@/components/dashboard/resource-manager";
import { SettingsForm } from "@/components/dashboard/settings-form";
import { WorkflowCases } from "@/components/dashboard/workflow-cases";
import { MatchmakerForm } from "@/components/forms/entity-forms";
type Config = {
  title: string;
  endpoint: string;
  columns: Column[];
  actions?: boolean;
  statusActions?: StatusAction[];
};
const users: Column[] = [
  { key: "first_name", label: "الاسم" },
  { key: "phone", label: "الهاتف" },
  { key: "role", label: "الدور" },
  { key: "governorate", label: "المحافظة" },
  { key: "status", label: "الحالة" },
  { key: "created_at", label: "التسجيل" },
];
const configs: Record<string, Config> = {
  "female-profiles": {
    title: "ملفات الفتيات",
    endpoint: "/admin/female-profiles",
    columns: [
      { key: "public_code", label: "الرمز" },
      { key: "age", label: "العمر" },
      { key: "governorate", label: "المحافظة" },
      { key: "matchmaker_id", label: "الخطّابة" },
      { key: "status", label: "الحالة" },
    ],
  },
  "female-leads": {
    title: "طلبات الفتيات",
    endpoint: "/admin/female-leads",
    columns: [
      { key: "first_name", label: "الاسم" },
      { key: "phone", label: "الهاتف" },
      { key: "governorate", label: "المحافظة" },
      { key: "status", label: "الحالة" },
      { key: "created_at", label: "الوصول" },
    ],
  },
  "male-requests": {
    title: "طلبات الشباب",
    endpoint: "/admin/male-requests",
    columns: [
      { key: "request_code", label: "رقم الطلب" },
      { key: "male_user_id", label: "المستخدم" },
      { key: "verification_status", label: "التحقق" },
      { key: "workflow_status", label: "المسار" },
      { key: "created_at", label: "الإنشاء" },
    ],
  },
  matches: {
    title: "فرص التوافق",
    endpoint: "/admin/matches",
    columns: [
      { key: "male_request_id", label: "طلب الشاب" },
      { key: "female_profile_id", label: "ملف الفتاة" },
      { key: "mutual_score", label: "التوافق المتبادل" },
      { key: "status", label: "الحالة" },
    ],
  },
  meetings: {
    title: "اللقاءات",
    endpoint: "/admin/meetings",
    columns: [
      { key: "match_case_id", label: "الحالة" },
      { key: "meeting_type", label: "النوع" },
      { key: "scheduled_at", label: "الموعد" },
      { key: "status", label: "الحالة" },
    ],
    actions: false,
  },
  engagements: {
    title: "الخطبات",
    endpoint: "/admin/match-cases?status=ENGAGED",
    columns: [
      { key: "male_request_id", label: "طلب الشاب" },
      { key: "female_profile_id", label: "ملف الفتاة" },
      { key: "engaged_at", label: "تاريخ الخطبة" },
      { key: "success_fee_status", label: "أتعاب النجاح" },
    ],
    actions: false,
  },
  marriages: {
    title: "الزيجات",
    endpoint: "/admin/match-cases?status=MARRIED",
    columns: [
      { key: "male_request_id", label: "طلب الشاب" },
      { key: "female_profile_id", label: "ملف الفتاة" },
      { key: "married_at", label: "تاريخ الزواج" },
      { key: "success_fee_status", label: "أتعاب النجاح" },
    ],
    actions: false,
  },
  payments: {
    title: "المدفوعات",
    endpoint: "/admin/payments",
    columns: [
      { key: "male_request_id", label: "طلب الشاب" },
      { key: "amount", label: "المبلغ" },
      { key: "currency", label: "العملة" },
      { key: "status", label: "الحالة" },
      { key: "paid_at", label: "الدفع" },
    ],
  },
  "success-fees": {
    title: "أتعاب النجاح",
    endpoint: "/admin/success-fees",
    columns: [
      { key: "match_case_id", label: "الحالة" },
      { key: "amount", label: "المبلغ" },
      { key: "status", label: "الحالة" },
      { key: "paid_at", label: "الدفع" },
    ],
  },
  reports: {
    title: "البلاغات",
    endpoint: "/admin/reports",
    columns: [
      { key: "reporter_id", label: "المبلّغ" },
      { key: "entity_type", label: "النوع" },
      { key: "reason", label: "السبب" },
      { key: "status", label: "الحالة" },
      { key: "created_at", label: "التاريخ" },
    ],
  },
  "audit-logs": {
    title: "سجل التدقيق",
    endpoint: "/admin/audit-logs",
    columns: [
      { key: "actor_id", label: "المنفّذ" },
      { key: "action", label: "الإجراء" },
      { key: "entity_type", label: "الكيان" },
      { key: "entity_id", label: "المعرف" },
      { key: "created_at", label: "التاريخ" },
    ],
    actions: false,
  },
  permissions: {
    title: "الصلاحيات",
    endpoint: "/admin/permissions",
    columns: [
      { key: "code", label: "رمز الصلاحية" },
      { key: "description", label: "الوصف" },
      { key: "roles_count", label: "الأدوار" },
    ],
    actions: false,
  },
};
export default function Page({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const slug = use(params).slug?.[0];
  if (!slug) return <DashboardOverview scope="admin" />;
  if (slug === "settings") return <SettingsForm />;
  if (slug === "notifications") return <Notifications scope="admin" />;
  if (slug === "cases") return <WorkflowCases scope="admin" />;
  if (slug === "users" || slug === "males")
    return (
      <ResourceManager
        title={slug === "males" ? "الشباب" : "جميع المستخدمين"}
        endpoint={
          slug === "males" ? "/admin/users?role=MALE_USER" : "/admin/users"
        }
        columns={users}
        statusActions={[
          { label: "تفعيل", status: "ACTIVE" },
          { label: "إيقاف", status: "SUSPENDED", variant: "outline" },
          { label: "حظر", status: "BLOCKED", variant: "danger" },
        ]}
      />
    );
  if (slug === "matchmakers")
    return (
      <ResourceManager
        title="إدارة الخطّابات"
        endpoint="/admin/matchmakers"
        createForm={(done) => <MatchmakerForm done={done} />}
        columns={[
          { key: "first_name", label: "الاسم" },
          { key: "phone", label: "الهاتف" },
          { key: "user_id", label: "حساب المستخدم" },
          { key: "governorates", label: "المحافظات" },
          { key: "verification_status", label: "التحقق" },
          { key: "created_at", label: "الإنشاء" },
        ]}
        statusActions={[
          {
            label: "اعتماد",
            status: "VERIFIED",
            payload: { verification_status: "VERIFIED" },
          },
          {
            label: "رفض الاعتماد",
            status: "REJECTED",
            variant: "outline",
            payload: { verification_status: "REJECTED" },
          },
          { label: "إيقاف الحساب", status: "SUSPENDED", variant: "outline" },
          { label: "حظر الحساب", status: "BLOCKED", variant: "danger" },
        ]}
      />
    );
  const c = configs[slug];
  return c ? (
    <ResourceManager {...c} />
  ) : (
    <ResourceManager
      title="إدارة النظام"
      endpoint={`/admin/${slug}`}
      columns={[]}
      actions={false}
    />
  );
}
