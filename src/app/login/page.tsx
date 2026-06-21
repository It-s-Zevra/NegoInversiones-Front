import type { Metadata } from "next";
import { Suspense } from "react";
import { Logo } from "@/components/layout/logo";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo />
          <h1 className="mt-6 font-display text-2xl font-semibold tracking-tight text-foreground">
            Inicia sesión
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            Panel de administración de NegoInversiones
          </p>
        </div>

        <div className="rounded-card border border-border bg-surface p-6 shadow-soft sm:p-7">
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>

        <p className="mt-6 text-center text-xs text-subtle">
          © 2026 NegoInversiones · Uso interno
        </p>
      </div>
    </main>
  );
}
