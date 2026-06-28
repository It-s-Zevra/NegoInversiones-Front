"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { BrandLoader } from "@/components/layout/brand-loader";

/** Protege el shell del panel: muestra loader mientras hidrata; redirige si no hay sesión. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  if (status !== "authenticated") {
    return (
      <BrandLoader
        fullScreen
        caption={status === "unauthenticated" ? "Redirigiendo…" : "Cargando tu panel…"}
      />
    );
  }

  return <>{children}</>;
}
