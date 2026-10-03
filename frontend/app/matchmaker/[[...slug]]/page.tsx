"use client";
import { AvailabilityManager } from "@/components/dashboard/availability-manager";
import { use } from "react";
import { DashboardOverview } from "@/components/dashboard/overview";
import { ResourceManager } from "@/components/dashboard/resource-manager";
import { MaleRequestSearch } from "@/components/dashboard/male-request-search";
import { MeetingsManager } from "@/components/dashboard/meetings-manager";
import { Notifications } from "@/components/dashboard/notifications";
import { WorkflowCases } from "@/components/dashboard/workflow-cases";
import {
  FemaleProfileForm,
  FemaleProfileWizard,
  PaymentForm,
} from "@/components/forms/entity-forms";
import { formatArabicDate } from "@/lib/utils";
export default function Page({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const slug = use(params).slug?.[0];
  if (!slug) return <DashboardOverview scope="matchmaker" />;
  switch (slug) {
    case "availability":
      return <AvailabilityManager />;
    case "male-requests":
      return <MaleRequestSearch />;
    case "female-profiles":
      return (
        <ResourceManager
          title="ملفات الفتيات"
          description="إدارة البيانات الخاصة والعامة والتفضيلات. تزامَن الملفات النشطة فقط للبحث."
          endpoint="/matchmaker/female-profiles"
          createForm={(done) => <FemaleProfileWizard done={done} />}
          editForm={(row, done) => <FemaleProfileForm done={done} initial={row} />}
          filters={[
            {
              name: "status",
              label: "الحالة",
              options: ["DRAFT", "ACTIVE", "HIDDEN", "MATCHED", "ARCHIVED"],
            },
            {
              name: "governorate",
              label: "المحافظة",
              options: ["دمشق", "ريف دمشق", "حلب", "حمص"],
            },
          ]}
          columns={[
            { key: "public_code", label: "الرمز العام" },
            { key: "age", label: "العمر" },
            { key: "governorate", label: "المحافظة" },
            { key: "education", label: "التعليم" },
            { key: "status", label: "الحالة" },
            { key: "created_at", label: "تاريخ الإنشاء" },
          ]}
          statusActions={[
            { label: "تفعيل", status: "ACTIVE" },
            { label: "إخفاء", status: "HIDDEN", variant: "outline" },
            { label: "أرشفة", status: "ARCHIVED", variant: "danger" },
          ]}
        />
      );
    case "female-leads":
      return (
        <ResourceManager
          title="العملاء الجدد"
          description="طلبات تواصل الفتيات الواردة من المسار العام."
          endpoint="/matchmaker/female-leads"
          filters={[
            {
              name: "status",
              label: "الحالة",
              options: [
                "NEW",
                "ASSIGNED",
                "CONTACTED",
                "PROFILE_CREATED",
                "CLOSED",
              ],
            },
          ]}
          columns={[
            {
              key: "scheduled_at",
              label: "التاريخ والساعة",
              render: (v) =>
                v
                  ? formatArabicDate(String(v), {
                      timeZone: "Asia/Damascus",
                      dateStyle: "long",
                      timeStyle: "short",
                    })
                  : "—",
            },
            { key: "notes", label: "الملاحظات" },
            { key: "phone", label: "الهاتف" },
            { key: "governorate", label: "المحافظة" },
            { key: "status", label: "الحالة" },
            { key: "created_at", label: "الوصول" },
          ]}
          statusActions={[
            { label: "تم التواصل", status: "CONTACTED" },
            { label: "تم إنشاء الملف", status: "PROFILE_CREATED" },
            { label: "إغلاق", status: "CLOSED", variant: "outline" },
          ]}
        />
      );
    case "matches":
      return (
        <ResourceManager
          title="فرص التوافق"
          description="نتائج توافق متبادل تجاوزت الحد المحدد في إعدادات النظام."
          endpoint="/matchmaker/matches"
          filters={[
            {
              name: "status",
              label: "الحالة",
              options: ["PENDING", "SELECTED", "REJECTED", "CLOSED"],
            },
          ]}
          columns={[
            { key: "male_request_code", label: "طلب الشاب" },
            { key: "female_public_code", label: "رمز الفتاة" },
            { key: "male_to_female_score", label: "ملاءمة طلب الشاب" },
            { key: "female_to_male_score", label: "ملاءمة طلب الفتاة" },
            { key: "mutual_score", label: "التوافق المتبادل" },
            { key: "status", label: "الحالة" },
          ]}
        />
      );
    case "cases":
      return <WorkflowCases />;
    case "meetings":
      return <MeetingsManager />;
    case "payments":
      return (
        <ResourceManager
          title="المدفوعات"
          description="أتعاب خدمة التوفيق وإدارة فتح التواصل."
          endpoint="/matchmaker/payments"
          createForm={(done) => <PaymentForm done={done} />}
          filters={[
            {
              name: "status",
              label: "الحالة",
              options: ["PENDING", "PAID", "WAIVED", "REFUNDED"],
            },
          ]}
          columns={[
            { key: "male_request_id", label: "طلب الشاب" },
            { key: "amount", label: "المبلغ" },
            { key: "currency", label: "العملة" },
            { key: "method", label: "الطريقة" },
            { key: "status", label: "الحالة" },
            { key: "paid_at", label: "تاريخ الدفع" },
          ]}
          statusActions={[
            { label: "تسجيل مدفوع", status: "PAID" },
            { label: "إعفاء", status: "WAIVED", variant: "outline" },
            { label: "استرداد", status: "REFUNDED", variant: "danger" },
          ]}
        />
      );
    case "conversations":
      return (
        <ResourceManager
          title="المحادثات"
          endpoint="/matchmaker/conversations"
          columns={[
            { key: "participant", label: "المشارك" },
            { key: "channel", label: "القناة" },
            { key: "last_message", label: "آخر رسالة" },
            { key: "updated_at", label: "آخر تحديث" },
          ]}
          actions={false}
        />
      );
    case "notifications":
      return <Notifications scope="matchmaker" />;
    case "profile":
      return (
        <ResourceManager
          title="ملفي الشخصي"
          endpoint="/matchmaker/profile"
          columns={[
            { key: "first_name", label: "الاسم" },
            { key: "phone", label: "الهاتف" },
            { key: "governorate", label: "المحافظة" },
            { key: "verification_status", label: "التوثيق" },
          ]}
          actions={false}
        />
      );
    case "settings":
      return (
        <ResourceManager
          title="إعدادات الخطّابة"
          endpoint="/matchmaker/settings"
          columns={[
            { key: "key", label: "الإعداد" },
            { key: "value", label: "القيمة" },
          ]}
          actions={false}
        />
      );
    default:
      return (
        <ResourceManager
          title="غير موجود"
          endpoint={`/matchmaker/${slug}`}
          columns={[]}
          actions={false}
        />
      );
  }
}
