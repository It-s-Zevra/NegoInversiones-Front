"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, AlertCircle } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import { ApiException } from "@/lib/api/http";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Solo permite redirecciones internas del mismo origen (evita open-redirect). */
function safeRedirect(target: string | null): string {
  if (!target) return "/dashboard";
  try {
    const base =
      typeof window !== "undefined" ? window.location.origin : "http://localhost";
    const url = new URL(target, base);
    if (url.origin !== base) return "/dashboard";
    const path = `${url.pathname}${url.search}${url.hash}`;
    if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
      return "/dashboard";
    }
    return path;
  } catch {
    return "/dashboard";
  }
}

export function LoginForm() {
  const { login, status } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = safeRedirect(searchParams.get("redirect"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
  }>({});
  const alertRef = useRef<HTMLDivElement>(null);

  // Si ya hay sesión (hidratada), no mostrar el login.
  useEffect(() => {
    if (status === "authenticated") router.replace(redirectTo);
  }, [status, router, redirectTo]);

  // Llevar foco al mensaje de error tras un intento fallido (SR + scroll).
  useEffect(() => {
    if (formError) alertRef.current?.focus();
  }, [formError]);

  // Cooldown tras un 429: cuenta regresiva que rehabilita el botón.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  function validate(): boolean {
    const errors: typeof fieldErrors = {};
    if (!EMAIL_RE.test(email)) errors.email = "Ingresa un email válido.";
    if (password.length < 8 || password.length > 128)
      errors.password = "La contraseña debe tener entre 8 y 128 caracteres.";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (cooldown > 0) return;
    setFormError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      await login(email.trim(), password);
      router.replace(redirectTo);
    } catch (err) {
      if (err instanceof ApiException) {
        if (err.isNetworkError) {
          setFormError(
            "No se pudo conectar con el servidor. Revisa tu conexión."
          );
        } else if (err.statusCode === 401) {
          setFormError("Email o contraseña incorrectos.");
        } else if (err.statusCode === 429) {
          setCooldown(30);
          setFormError(
            "Demasiados intentos. Espera unos segundos e inténtalo de nuevo."
          );
        } else if (err.statusCode === 400) {
          const next: typeof fieldErrors = {};
          for (const m of err.messages) {
            const low = m.toLowerCase();
            if (low.includes("email")) next.email = m;
            else if (low.includes("password")) next.password = m;
          }
          setFieldErrors(next);
          if (Object.keys(next).length === 0) setFormError(err.messages[0]);
        } else {
          setFormError(err.messages[0] ?? "Ocurrió un error. Inténtalo de nuevo.");
        }
      } else {
        setFormError("Ocurrió un error inesperado. Inténtalo de nuevo.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {formError && (
        <div
          ref={alertRef}
          role="alert"
          tabIndex={-1}
          className="flex items-start gap-2.5 rounded-lg border border-danger/30 bg-danger-soft px-3.5 py-3 text-sm text-danger focus:outline-none"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{formError}</span>
        </div>
      )}

      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="tucorreo@negoinversiones.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          invalid={!!fieldErrors.email}
          aria-describedby={fieldErrors.email ? "email-error" : undefined}
          disabled={submitting}
          autoFocus
          className="h-12"
        />
        {fieldErrors.email && (
          <p id="email-error" role="alert" className="mt-1.5 text-xs text-danger">
            {fieldErrors.email}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="password">Contraseña</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            invalid={!!fieldErrors.password}
            aria-describedby={fieldErrors.password ? "password-error" : undefined}
            disabled={submitting}
            className="h-12 pr-12"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-md text-subtle transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            aria-pressed={showPassword}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
        {fieldErrors.password && (
          <p
            id="password-error"
            role="alert"
            className="mt-1.5 text-xs text-danger"
          >
            {fieldErrors.password}
          </p>
        )}
      </div>

      <Button
        type="submit"
        size="md"
        className="h-12 w-full text-sm"
        disabled={submitting || cooldown > 0}
        aria-busy={submitting}
      >
        {submitting && <Spinner />}
        {submitting
          ? "Ingresando…"
          : cooldown > 0
            ? `Reintenta en ${cooldown}s`
            : "Iniciar sesión"}
      </Button>
    </form>
  );
}
