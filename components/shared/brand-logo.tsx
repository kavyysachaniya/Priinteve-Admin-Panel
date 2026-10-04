import { cn } from "@/lib/utils";

export const DEFAULT_LOGO = "/Logo.png";

/** Plain <img> (not next/image) so PDF export always captures a loaded, fixed-size image. */
export function BrandLogo({
  src,
  alt = "Priinteve",
  className,
}: {
  src?: string | null;
  alt?: string;
  className?: string;
}) {
  const url = src || DEFAULT_LOGO;
  const isDefault = url === DEFAULT_LOGO;
  return (
    <span
      className={cn("relative inline-block shrink-0 overflow-hidden rounded-md bg-[#0d3b33]", className)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={alt}
        width={64}
        height={64}
        className={cn("size-full", isDefault ? "scale-[1.6] object-cover" : "object-contain")}
      />
    </span>
  );
}
