"use client";

import { createContext, useEffect, useRef, useState } from "react";
import { getUnreadCount } from "@/lib/api/notifications";

const POLL_MS = 60_000; // ver flujos: polling sugerido 30–60s

/** Fuerza un refresco inmediato del contador de no leídas. Provisto en AppShell. */
export const UnreadContext = createContext<() => void>(() => {});

/** Contador de notificaciones no leídas con polling ligero. Falla en silencio. */
export function useUnreadCount(): { count: number; refresh: () => void } {
  const [count, setCount] = useState(0);
  const activeRef = useRef(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const loadRef = useRef<() => void>(() => {});
  // refresh estable entre renders: invoca siempre el loader más reciente.
  const [refresh] = useState(() => () => loadRef.current());

  useEffect(() => {
    activeRef.current = true;
    // Polling no solapado: el siguiente tick se agenda al terminar el anterior.
    const load = async () => {
      clearTimeout(timerRef.current);
      try {
        const { count } = await getUnreadCount();
        if (activeRef.current) setCount(count);
      } catch {
        // ignorar: el badge no debe romper la UI
      } finally {
        if (activeRef.current) timerRef.current = setTimeout(load, POLL_MS);
      }
    };
    loadRef.current = load;
    load();
    return () => {
      activeRef.current = false;
      clearTimeout(timerRef.current);
    };
  }, []);

  return { count, refresh };
}
