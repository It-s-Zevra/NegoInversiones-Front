import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, ...props }, ref) => (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        "h-11 w-full rounded-lg border bg-surface px-3.5 text-sm text-foreground placeholder:text-subtle",
        "transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30",
        invalid
          ? "border-danger focus:border-danger focus:ring-danger/20"
          : "border-border-strong focus:border-primary",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("mb-1.5 block text-sm font-medium text-foreground", className)}
      {...props}
    />
  );
}
