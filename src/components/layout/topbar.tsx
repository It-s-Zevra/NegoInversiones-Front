"use client";

import Link from "next/link";
import { Menu, Bell } from "lucide-react";
import { UserMenu } from "./user-menu";

interface TopbarProps {
  onOpenMenu: () => void;
  unreadCount?: number;
  menuButtonRef?: React.Ref<HTMLButtonElement>;
}

export function Topbar({ onOpenMenu, unreadCount = 0, menuButtonRef }: TopbarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-surface/80 px-4 backdrop-blur-md sm:px-6">
      <button
        ref={menuButtonRef}
        type="button"
        onClick={onOpenMenu}
        className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-surface-muted lg:hidden"
        aria-label="Abrir menú"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        <Link
          href="/notificaciones"
          className="relative grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-surface-muted"
          aria-label={
            unreadCount > 0
              ? `Notificaciones, ${unreadCount} sin leer`
              : "Notificaciones"
          }
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span
              aria-hidden="true"
              className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Link>

        <UserMenu />
      </div>
    </header>
  );
}
