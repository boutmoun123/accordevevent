import { expect, it } from "vitest";
import { safeRedirectPath } from "./utils";

it.each(["javascript:alert(1)", "https://example.com", "//example.com", "/\\example.com", null])("rejects an unsafe login destination: %s", (value) => {
  expect(safeRedirectPath(value)).toBeUndefined();
});
it("preserves an internal destination", () => {
  expect(safeRedirectPath("/chat?step=1")).toBe("/chat?step=1");
});
