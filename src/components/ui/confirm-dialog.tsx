"use client";

import { Dialog } from "./dialog";
import { Button } from "./button";
import { Spinner } from "./spinner";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
  loading?: boolean;
}

/** Diálogo de confirmación reutilizable (eliminar, acciones destructivas). */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  tone = "danger",
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={loading ? () => {} : onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button
            variant="secondary"
            size="sm"
            onClick={onClose}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : "primary"}
            size="sm"
            onClick={onConfirm}
            disabled={loading}
            aria-busy={loading}
          >
            {loading && <Spinner />}
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted">
        {description ?? "Esta acción no se puede deshacer."}
      </p>
    </Dialog>
  );
}
