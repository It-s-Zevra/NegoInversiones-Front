import { Inbox, AlertTriangle, RotateCw, Lock } from "lucide-react";
import { Button } from "./button";
import { errorMessage } from "@/lib/api/errors";
import { ApiException } from "@/lib/api/http";
import { cn } from "@/lib/utils";

/** Estado vacío: sin resultados. */
export function EmptyState({
  title = "Sin resultados",
  description,
  icon,
  action,
}: {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-surface-muted text-subtle">
        {icon ?? <Inbox className="h-5 w-5" />}
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && (
        <p className="max-w-sm text-sm text-muted">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/**
 * Estado de error con reintento. Un 403 se trata aparte: el backend es la
 * autoridad de autorización (ver _comunes/04 §6), así que mostramos "Sin acceso"
 * y ocultamos el reintento (reintentar un 403 no cambia nada).
 */
export function ErrorState({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) {
  const forbidden = error instanceof ApiException && error.statusCode === 403;
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
      <div
        className={cn(
          "grid h-12 w-12 place-items-center rounded-full",
          forbidden ? "bg-surface-muted text-subtle" : "bg-danger-soft text-danger"
        )}
      >
        {forbidden ? <Lock className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
      </div>
      <p className="text-sm font-medium text-foreground">
        {forbidden ? "Sin acceso" : "No se pudo cargar"}
      </p>
      <p className="max-w-sm text-sm text-muted">
        {forbidden
          ? "No tienes acceso a esta sección. Si crees que es un error, contacta a un administrador."
          : errorMessage(error)}
      </p>
      {onRetry && !forbidden && (
        <Button variant="secondary" size="sm" className="mt-2" onClick={onRetry}>
          <RotateCw className="h-3.5 w-3.5" />
          Reintentar
        </Button>
      )}
    </div>
  );
}
