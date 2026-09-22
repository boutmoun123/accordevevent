import Image from "next/image";

export function BrandMark({ size = 48 }: { size?: number }) {
  return (
    <Image
      src="/logo.png"
      alt="فرح"
      width={size}
      height={size}
      priority
      className="object-contain"
    />
  );
}
