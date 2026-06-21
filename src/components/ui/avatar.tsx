import * as React from "react";
import { cn } from "@/lib/utils";

interface AvatarProps {
  src?: string | null;
  name: string;
  className?: string;
}

/** Avatar minimalista: imagen si existe, si no las iniciales. */
export function Avatar({ src, name, className }: AvatarProps) {
  const initials =
    name
      .split(" ")
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";

  return (
    <span
      className={cn(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-soft text-xs font-semibold text-primary select-none",
        className
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className="h-full w-full object-cover" />
      ) : (
        initials
      )}
    </span>
  );
}
