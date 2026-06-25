"use client";

import { useEffect, useState } from "react";
import { getHealth } from "@/lib/api/health";
import { cn } from "@/lib/utils";

type State = "checking" | "online" | "offline";

const META: Record<State, { dot: string; label: string }> = {
  checking: { dot: "bg-subtle", label: "Comprobando…" },
  online: { dot: "bg-success", label: "API en línea" },
  offline: { dot: "bg-danger", label: "Sin conexión" },
};

/** Indicador discreto de estado de la API (ping a /health, sin token). */
export function ApiStatus() {
  const [state, setState] = useState<State>("checking");

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ping = async () => {
      try {
        await getHealth();
        if (active) setState("online");
      } catch {
        if (active) setState("offline");
      } finally {
        if (active) timer = setTimeout(ping, 60_000);
      }
    };
    ping();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);

  const meta = META[state];
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] text-subtle"
      title={meta.label}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} aria-hidden />
      {meta.label}
    </span>
  );
}
