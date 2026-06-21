"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { Logo } from "@/components/layout/logo";
import { Spinner } from "@/components/ui/spinner";

/** Protege el shell del panel: muestra loader mientras hidrata; redirige si no hay sesión. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  if (status !== "authenticated") {
    return (
      <div className="grid min-h-dvh place-items-center">
        <div className="flex flex-col items-center gap-4">
          <Logo collapsed />
          <Spinner className="h-5 w-5 text-muted" />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
