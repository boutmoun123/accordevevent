import Image from "next/image";

const logoSrc = "/logo.png";

export function BrandMark({ size = 48 }: { size?: number }) {
  return (
    <Image
      src={logoSrc}
      alt=""
      width={size}
      height={size}
      priority
      className="object-contain"
    />
  );
}
