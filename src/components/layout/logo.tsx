import { cn } from "@/lib/utils";

export function Logo({
  collapsed = false,
  className,
}: {
  collapsed?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-soft">
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M4 19V7l8-4 8 4v12" />
          <path d="M4 19h16" />
          <path d="M9 19v-5h6v5" />
        </svg>
      </span>
      {!collapsed && (
        <span className="font-display text-base font-semibold tracking-tight text-foreground">
          Nego<span className="text-muted font-normal">inversiones</span>
        </span>
      )}
    </div>
  );
}
