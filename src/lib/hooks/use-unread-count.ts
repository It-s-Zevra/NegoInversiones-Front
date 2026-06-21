"use client";

import { useEffect, useState } from "react";
import { getUnreadCount } from "@/lib/api/notifications";

const POLL_MS = 60_000; // ver flujos: polling sugerido 30–60s

/** Contador de notificaciones no leídas con polling ligero. Falla en silencio. */
export function useUnreadCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      try {
        const { count } = await getUnreadCount();
        if (active) setCount(count);
      } catch {
        // ignorar: el badge no debe romper la UI
      } finally {
        if (active) timer = setTimeout(tick, POLL_MS);
      }
    };

    tick();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);

  return count;
}
