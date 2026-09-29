import { cn } from "@/lib/utils";

type GenderIconProps = {
  gender: "female" | "male";
  className?: string;
};

export function GenderIcon({ gender, className }: GenderIconProps) {
  return (
    <span
      aria-hidden="true"
      className={cn("block shrink-0 bg-no-repeat", className)}
      style={{
        backgroundImage: "url('/icon.png')",
        backgroundSize: "200% 100%",
        backgroundPosition: gender === "female" ? "left center" : "right center",
      }}
    />
  );
}
