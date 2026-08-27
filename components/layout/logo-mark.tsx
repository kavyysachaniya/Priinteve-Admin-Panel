import { cn } from "@/lib/utils";

export function LogoMark({
  collapsed = false,
  className,
}: {
  collapsed?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2.5 overflow-hidden", className)}>
      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
        P
      </div>
      {!collapsed && (
        <span className="truncate text-[15px] font-semibold tracking-tight text-sidebar-foreground">
          Priinteve
        </span>
      )}
    </div>
  );
}
