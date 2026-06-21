import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, invalid, ...props }, ref) => (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        "min-h-20 w-full rounded-lg border bg-surface px-3.5 py-2.5 text-sm text-foreground placeholder:text-subtle",
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
Textarea.displayName = "Textarea";
