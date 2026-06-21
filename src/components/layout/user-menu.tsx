"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, UserRound } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import { Avatar } from "@/components/ui/avatar";
import { ROLE_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) return null;
  const fullName = `${user.firstName} ${user.lastName}`.trim();

  return (
    <div ref={ref} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2.5 rounded-lg py-1 pl-1 pr-1.5 hover:bg-surface-muted sm:pr-2.5"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <Avatar name={fullName} src={user.img} />
        <span className="hidden text-left leading-tight sm:block">
          <span className="block text-sm font-medium text-foreground">
            {fullName}
          </span>
          <span className="block text-xs text-muted">
            {ROLE_LABELS[user.role]}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "hidden h-4 w-4 text-subtle transition-transform sm:block",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-60 overflow-hidden rounded-xl border border-border bg-surface shadow-pop">
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <Avatar name={fullName} src={user.img} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {fullName}
              </p>
              <p className="truncate text-xs text-muted">{user.email}</p>
            </div>
          </div>
          <div className="p-1.5">
            <button
              type="button"
              disabled
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted opacity-60"
            >
              <UserRound className="h-4 w-4" />
              Mi perfil
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                void logout();
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-danger hover:bg-danger-soft"
            >
              <LogOut className="h-4 w-4" />
              Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
