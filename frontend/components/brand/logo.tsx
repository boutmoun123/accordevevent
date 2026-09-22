import Link from "next/link";
import { BrandMark } from "./brand-mark";
export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link
      href="/"
      className="inline-flex items-center gap-2.5"
      aria-label="فرح - الرئيسية"
    >
      <BrandMark />
      <span>
        <strong
          className={`block text-xl leading-5 ${light ? "text-white" : "text-brand-navy"}`}
        >
          فرح
        </strong>
        <small className={light ? "text-white/55" : "text-slate-400"}>
          Farah.event
        </small>
      </span>
    </Link>
  );
}
