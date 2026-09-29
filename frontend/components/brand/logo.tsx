import Link from "next/link";
import { BrandMark } from "./brand-mark";
import { cn } from "@/lib/utils";

export function Logo({ className }: { light?: boolean; className?: string }) {
  return (
    <Link href="/" className={cn("inline-flex items-center", className)} aria-label="Farah">
      <BrandMark />
    </Link>
  );
}
