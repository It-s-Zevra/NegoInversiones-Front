"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { useUnreadCount } from "@/lib/hooks/use-unread-count";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const unreadCount = useUnreadCount();

  const panelRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // Drawer móvil: bloqueo de scroll, foco inicial, Escape, trampa de foco y retorno de foco.
  useEffect(() => {
    if (!mobileOpen) return;

    const trigger = menuButtonRef.current;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeBtnRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileOpen(false);
        return;
      }
      if (e.key === "Tab" && panelRef.current) {
        const focusables = panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
      trigger?.focus();
    };
  }, [mobileOpen]);

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-60 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-pop focus:outline-none focus:ring-2 focus:ring-primary"
      >
        Saltar al contenido
      </a>

      {/* Sidebar fijo (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-border lg:block">
        <Sidebar />
      </aside>

      {/* Drawer móvil */}
      <div
        className={cn(
          "fixed inset-0 z-50 lg:hidden",
          mobileOpen ? "pointer-events-auto" : "pointer-events-none"
        )}
        aria-hidden={!mobileOpen}
      >
        <div
          className={cn(
            "absolute inset-0 bg-foreground/40 transition-opacity",
            mobileOpen ? "opacity-100" : "opacity-0"
          )}
          onClick={() => setMobileOpen(false)}
        />
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="Menú de navegación"
          className={cn(
            "absolute inset-y-0 left-0 w-72 max-w-[85%] border-r border-border shadow-pop transition-transform duration-200",
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <button
            ref={closeBtnRef}
            type="button"
            onClick={() => setMobileOpen(false)}
            className="absolute right-3 top-4 grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-surface-muted"
            aria-label="Cerrar menú"
          >
            <X className="h-5 w-5" />
          </button>
          <Sidebar onNavigate={() => setMobileOpen(false)} />
        </div>
      </div>

      {/* Contenido */}
      <div className="lg:pl-64">
        <Topbar
          onOpenMenu={() => setMobileOpen(true)}
          unreadCount={unreadCount}
          menuButtonRef={menuButtonRef}
        />
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto w-full max-w-7xl px-4 py-6 outline-none sm:px-6 lg:px-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
