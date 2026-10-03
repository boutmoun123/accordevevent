import { describe, expect, it, vi } from "vitest";
import { domainOptions, labelForOption, localizeDisplayValue, localizeDomainValue, normalizeDomainValue } from "./domain-options";

describe("domain option labels", () => {
  it.each([
    ["RIF_DIMASHQ", "governorate", "ريف دمشق", "Rif Dimashq"],
    ["POSTGRADUATE", "education", "دراسات عليا", "Postgraduate"],
    ["BUSINESS_OWNER", "occupationMale", "صاحب عمل", "Business owner"],
    ["WELL_OFF", "financial", "ميسور الحال", "Well-off"],
    ["HIGH_SCHOOL", "education", "ثانوي", "High school"],
    ["HOMEMAKER", "occupationFemale", "سيدة منزل", "Homemaker"],
    ["SUNNI_MUSLIM", "religion", "مسلم سني", "Sunni Muslim"],
  ] as const)("localizes %s", (value, group, ar, en) => {
    expect(labelForOption(value, "ar", group)).toBe(ar);
    expect(labelForOption(value, "en", group)).toBe(en);
  });

  it("covers all Syrian governorates requested by product", () => {
    expect(domainOptions.governorate.map((item) => item.value)).toEqual(expect.arrayContaining([
      "DAMASCUS",
      "RIF_DIMASHQ",
      "ALEPPO",
      "HOMS",
      "HAMA",
      "LATAKIA",
      "TARTUS",
      "AS_SUWAYDA",
      "DARAA",
      "QUNEITRA",
      "IDLIB",
      "DEIR_EZ_ZOR",
      "RAQQA",
      "HASAKAH",
      "OUTSIDE_SYRIA",
    ]));
  });

  it("does not show unknown raw enums to users", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(localizeDomainValue("NEW_BACKEND_ENUM", "ar", "education")).toBe("غير محدد");
    expect(localizeDomainValue("NEW_BACKEND_ENUM", "en", "education")).toBe("Not specified");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("keeps stable enum values independent from the selected language", () => {
    const selected = domainOptions.governorate.find((item) => item.value === "RIF_DIMASHQ");
    expect(selected?.ar).toBe("ريف دمشق");
    expect(selected?.en).toBe("Rif Dimashq");
    expect(selected?.value).toBe("RIF_DIMASHQ");
  });

  it("formats display values without exposing raw enums", () => {
    expect(localizeDisplayValue("HOMEMAKER", "ar", { group: "occupationFemale" })).toBe("سيدة منزل");
    expect(localizeDisplayValue("HOMEMAKER", "en", { group: "occupationFemale" })).toBe("Homemaker");
    expect(localizeDisplayValue(["DAMASCUS", "RIF_DIMASHQ"], "ar", { group: "governorate" })).toBe("دمشق، ريف دمشق");
    expect(localizeDisplayValue("26-30", "ar", { rangeUnit: "years" })).toBe("26 - 30 سنة");
  });

  it("keeps existing labels and free-text answers intact", () => {
    expect(localizeDisplayValue("سيدة منزل", "ar", { group: "occupationFemale" })).toBe("سيدة منزل");
    expect(localizeDisplayValue("أحب القراءة", "ar")).toBe("أحب القراءة");
  });

  it("does not expose duplicate labels in selectable domain options", () => {
    for (const [group, values] of Object.entries(domainOptions)) {
      const arabicLabels = values.map((item) => item.ar);
      const englishLabels = values.map((item) => item.en);
      expect(new Set(arabicLabels).size, `${group}:ar`).toBe(arabicLabels.length);
      expect(new Set(englishLabels).size, `${group}:en`).toBe(englishLabels.length);
    }
  });

  it("normalizes localized labels back to stable enum values", () => {
    expect(normalizeDomainValue("دمشق", "governorate")).toBe("DAMASCUS");
    expect(normalizeDomainValue("Damascus", "governorate")).toBe("DAMASCUS");
    expect(normalizeDomainValue("عمل حر", "occupationMale")).toBe("SELF_EMPLOYED");
  });
});
