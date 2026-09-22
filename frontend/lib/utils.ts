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
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "—";
export const formatMoney = (value?: number, currency = "SYP") =>
  typeof value === "number"
    ? new Intl.NumberFormat("ar-SY", { style: "currency", currency }).format(
        value,
      )
    : "—";
