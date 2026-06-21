"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
}

/** Checkbox accesible con etiqueta opcional. */
export function Checkbox({
  checked,
  onCheckedChange,
  label,
  description,
  disabled,
}: CheckboxProps) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-2.5",
        disabled && "cursor-not-allowed opacity-60"
      )}
    >
      <span
        className={cn(
          "mt-0.5 grid h-4.5 w-4.5 shrink-0 place-items-center rounded border transition-colors",
          checked
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border-strong bg-surface"
        )}
      >
        {checked && <Check className="h-3 w-3" strokeWidth={3} />}
      </span>
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onCheckedChange(e.target.checked)}
      />
      {(label || description) && (
        <span className="min-w-0 leading-tight">
          {label && <span className="text-sm text-foreground">{label}</span>}
          {description && (
            <span className="block text-xs text-muted">{description}</span>
          )}
        </span>
      )}
    </label>
  );
}
