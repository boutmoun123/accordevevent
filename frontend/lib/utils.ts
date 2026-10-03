import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
export const safeRedirectPath = (value: string | null) =>
  value?.startsWith("/") && !value.startsWith("//") && !value.includes("\\")
    ? value
    : undefined;
export const formatDate = (value?: string) =>
  value
    ? new Intl.DateTimeFormat("ar-SY", {
        numberingSystem: "latn",
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "—";
export const formatMoney = (value?: number, currency = "SYP") =>
  typeof value === "number"
    ? new Intl.NumberFormat("ar-SY", { numberingSystem: "latn", style: "currency", currency }).format(
        value,
      )
    : "—";
export const formatNumber = (value?: number | string | null) => {
  if (value === undefined || value === null || value === "") return "—";
  const number = Number(value);
  return Number.isFinite(number) ? new Intl.NumberFormat("en-US").format(number) : String(value);
};
export const formatPercent = (value?: number | string | null) => {
  if (value === undefined || value === null || value === "") return "غير محدد";
  const number = Number(value);
  return Number.isFinite(number) ? `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(number)}%` : String(value);
};
export const formatArabicDate = (value?: string, options?: Intl.DateTimeFormatOptions) =>
  value
    ? new Intl.DateTimeFormat("ar-SY", {
        numberingSystem: "latn",
        ...options,
      }).format(new Date(value))
    : "—";
