import { Inbox, AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "./button";
import { errorMessage } from "@/lib/api/errors";

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

/** Estado de error con reintento. */
export function ErrorState({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-danger-soft text-danger">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <p className="text-sm font-medium text-foreground">No se pudo cargar</p>
      <p className="max-w-sm text-sm text-muted">{errorMessage(error)}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-2" onClick={onRetry}>
          <RotateCw className="h-3.5 w-3.5" />
          Reintentar
        </Button>
      )}
    </div>
  );
}
