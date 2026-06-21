"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastTone = "success" | "error" | "info";

interface ToastItem {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
}

interface ToastInput {
  title: string;
  description?: string;
  tone?: ToastTone;
}

const ToastContext = createContext<((t: ToastInput) => void) | null>(null);

const TONE_META: Record<
  ToastTone,
  { icon: typeof Info; className: string }
> = {
  success: { icon: CheckCircle2, className: "text-success" },
  error: { icon: AlertCircle, className: "text-danger" },
  info: { icon: Info, className: "text-info" },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [mounted, setMounted] = useState(false);
  const idRef = useRef(0);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  // eslint-disable-next-line react-hooks/set-state-in-effect -- montaje SSR-safe para createPortal
  useEffect(() => setMounted(true), []);

  // Limpia los timers pendientes al desmontar.
  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((t) => clearTimeout(t));
      map.clear();
    };
  }, []);

  const dismiss = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t !== undefined) {
      clearTimeout(t);
      timers.current.delete(id);
    }
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const toast = useCallback((input: ToastInput) => {
    const id = ++idRef.current;
    setToasts((prev) => [
      ...prev,
      { id, title: input.title, description: input.description, tone: input.tone ?? "info" },
    ]);
    const timer = setTimeout(() => {
      timers.current.delete(id);
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, 4500);
    timers.current.set(id, timer);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {mounted &&
        createPortal(
          <div className="pointer-events-none fixed bottom-4 right-4 z-80 flex w-full max-w-sm flex-col gap-2">
            {toasts.map((t) => {
              const { icon: Icon, className } = TONE_META[t.tone];
              return (
                <div
                  key={t.id}
                  role={t.tone === "error" ? "alert" : "status"}
                  aria-live={t.tone === "error" ? "assertive" : "polite"}
                  className="pointer-events-auto flex items-start gap-3 rounded-xl border border-border bg-surface px-4 py-3 shadow-pop"
                >
                  <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", className)} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {t.title}
                    </p>
                    {t.description && (
                      <p className="mt-0.5 text-sm text-muted">
                        {t.description}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => dismiss(t.id)}
                    className="-mr-1 grid h-6 w-6 shrink-0 place-items-center rounded text-subtle hover:text-foreground"
                    aria-label="Cerrar notificación"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}

export function useToast(): (t: ToastInput) => void {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast debe usarse dentro de <ToastProvider>");
  return ctx;
}
