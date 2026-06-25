"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./logo";
import { NAV_SECTIONS } from "@/lib/constants";
import { useAuth } from "@/lib/auth/auth-context";
import { cn } from "@/lib/utils";

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { can, user } = useAuth();

  // Pista de UI: ocultar módulos sin permiso/rol (el backend sigue siendo la autoridad).
  const sections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (item.permission && !can(item.permission)) return false;
      if (item.roles && !(user && item.roles.includes(user.role))) return false;
      return true;
    }),
  })).filter((section) => section.items.length > 0);

  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="flex h-16 items-center px-5 border-b border-border">
        <Link href="/dashboard" onClick={onNavigate} aria-label="Inicio">
          <Logo />
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {sections.map((section, i) => (
          <div key={i} className={cn(i > 0 && "mt-6")}>
            {section.title && (
              <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-subtle">
                {section.title}
              </p>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active =
                  pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-primary-soft text-primary"
                          : "text-muted hover:bg-surface-muted hover:text-foreground"
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4.5 w-4.5 shrink-0",
                          active
                            ? "text-primary"
                            : "text-subtle group-hover:text-foreground"
                        )}
                      />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-border p-4">
        <p className="text-[11px] text-subtle">
          Panel Admin · v0.1
        </p>
      </div>
    </div>
  );
}
