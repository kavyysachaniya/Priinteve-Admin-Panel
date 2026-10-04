import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/shared/brand-logo";

export function LogoMark({
  collapsed = false,
  className,
}: {
  collapsed?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2.5 overflow-hidden", className)}>
      <BrandLogo className="size-8" />
      {!collapsed && (
        <span className="truncate text-[15px] font-semibold tracking-tight text-sidebar-foreground">
          Priinteve
        </span>
      )}
    </div>
  );
}
