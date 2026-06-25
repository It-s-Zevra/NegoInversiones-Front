import type { Metadata } from "next";
import { Suspense } from "react";
import { ShieldCheck, BarChart3, Zap } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Iniciar sesión" };

const HIGHLIGHTS = [
  {
    icon: BarChart3,
    title: "Todo tu negocio en un lugar",
    description: "Proyectos, unidades, ventas y agendas centralizados.",
  },
  {
    icon: Zap,
    title: "Operación más ágil",
    description: "Gestiona financiamiento e importaciones masivas sin fricción.",
  },
  {
    icon: ShieldCheck,
    title: "Acceso seguro",
    description: "Sesiones protegidas y de uso exclusivamente interno.",
  },
];

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      {/* Panel de marca (decorativo) — solo desktop */}
      <aside className="relative hidden overflow-hidden bg-primary text-primary-foreground lg:flex lg:flex-col lg:justify-between lg:p-12">
        {/* Degradado y brillos decorativos */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary via-primary to-primary-hover"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-white/10 blur-3xl"
        />

        <div className="relative">
          <Logo className="[&_span:first-child]:bg-white/15 [&_span:first-child]:text-primary-foreground [&_span:last-child]:text-primary-foreground [&_span:last-child_span]:text-primary-foreground/70" />
        </div>

        <div className="relative max-w-md">
          <h2 className="font-display text-3xl font-semibold leading-tight tracking-tight">
            El panel para administrar todo tu negocio inmobiliario.
          </h2>
          <p className="mt-4 text-base text-primary-foreground/80">
            Inicia sesión para gestionar proyectos, ventas y agendas desde un
            solo lugar.
          </p>

          <ul className="mt-10 space-y-5">
            {HIGHLIGHTS.map(({ icon: Icon, title, description }) => (
              <li key={title} className="flex gap-3.5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/15 ring-1 ring-white/20">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="mt-0.5 text-sm text-primary-foreground/75">
                    {description}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-primary-foreground/60">
          © 2026 NegoInversiones · Uso interno
        </p>
      </aside>

      {/* Columna del formulario */}
      <section className="flex min-h-dvh flex-col bg-app px-4 py-10 sm:px-8">
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm">
            {/* Logo + heading (móvil muestra logo; desktop ya lo tiene a la izquierda) */}
            <div className="mb-8 flex flex-col items-center text-center lg:items-start lg:text-left">
              <Logo className="lg:hidden" />
              <h1 className="mt-6 font-display text-2xl font-semibold tracking-tight text-foreground lg:mt-0">
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
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-subtle lg:hidden">
          © 2026 NegoInversiones · Uso interno
        </p>
      </section>
    </main>
  );
}
