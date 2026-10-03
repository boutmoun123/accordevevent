import { describe, expect, it } from "vitest";
import { statusLabel } from "@/components/ui/status";
import { displayFieldValue, labelForDetail, relatedDetailSections, visibleDetailEntries } from "./resource-manager";

describe("dashboard detail formatting", () => {
  it("uses Arabic labels for relationship and score fields", () => {
    expect(labelForDetail("female_profile_id")).toBe("معرّف ملف الفتاة");
    expect(labelForDetail("male_request_id")).toBe("معرّف طلب الشاب");
    expect(labelForDetail("matchmaker_id")).toBe("معرّف الخطّابة");
    expect(labelForDetail("male_to_female_score")).toBe("توافق طلب الشاب مع الفتاة");
    expect(labelForDetail("female_to_male_score")).toBe("توافق الفتاة مع طلب الشاب");
    expect(labelForDetail("mutual_score")).toBe("نسبة التوافق المتبادلة");
  });

  it("localizes dashboard status values instead of showing raw enum text", () => {
    expect(statusLabel("NOT_SHORTLISTED", "ar")).toBe("غير مرشح");
    expect(displayFieldValue("status", "NOT_SHORTLISTED")).toBe("غير مرشح");
    expect(statusLabel("READY_FOR_REVIEW", "ar")).not.toContain("_");
  });

  it("hides internal duplicate ids when public codes are available", () => {
    const fields = visibleDetailEntries({
      id: "candidate-id",
      male_request_id: "male-id",
      female_profile_id: "female-id",
      matchmaker_id: "matchmaker-id",
      male_request_code: "FRH-123",
      female_public_code: "FP-123",
      mutual_score: 86.6,
      status: "NOT_SHORTLISTED",
    }).map(([key]) => key);

    expect(fields).not.toContain("id");
    expect(fields).not.toContain("male_request_id");
    expect(fields).not.toContain("female_profile_id");
    expect(fields).not.toContain("matchmaker_id");
    expect(fields).toEqual(["male_request_code", "female_public_code", "mutual_score", "status"]);
  });

  it("groups opened male and female profiles into clear professional sections", () => {
    const maleSections = relatedDetailSections("male", {
      id: "male-id",
      request_code: "FRH-123",
      verification_status: "VERIFIED",
      workflow_status: "ACTIVE",
      male_characteristics: { age: 34, governorate: "DAMASCUS", occupation: "EMPLOYEE" },
      desired_female_characteristics: { age_min: 24, age_max: 30, hijab_status: "HIJAB" },
    });
    const femaleSections = relatedDetailSections("female", {
      id: "female-id",
      public_code: "FP-123",
      first_name: "سارة",
      age: 28,
      status: "ACTIVE",
      public_summary: "ملخص مناسب",
    });

    expect(maleSections.map((section) => section.title)).toEqual([
      "معلومات الشاب",
      "مواصفات شريكة الحياة",
      "حالة الطلب",
    ]);
    expect(femaleSections.map((section) => section.title)).toEqual([
      "معلومات الفتاة",
      "ملخص ومتابعة",
    ]);
  });
});
