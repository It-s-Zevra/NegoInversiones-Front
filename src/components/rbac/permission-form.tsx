"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { ApiException } from "@/lib/api/http";
import { errorMessage, mapValidationErrors } from "@/lib/api/errors";
import {
  createPermission,
  updatePermission,
  PERMISSION_CODE_RE,
} from "@/lib/api/permissions";
import type { Permission } from "@/lib/api/types";

interface Props {
  open: boolean;
  onClose: () => void;
  permission?: Permission | null;
  onSaved: () => void;
}

export function PermissionForm({ open, onClose, permission, onSaved }: Props) {
  const toast = useToast();
  const isEdit = !!permission;
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- precarga al abrir
    setErrors({});
    setCode(permission?.code ?? "");
    setName(permission?.name ?? "");
    setDescription(permission?.description ?? "");
  }, [open, permission]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!isEdit && !PERMISSION_CODE_RE.test(code.trim()))
      next.code = "Formato recurso:accion en minúsculas (ej. leads:write).";
    if (!name.trim()) next.name = "El nombre es obligatorio.";
    setErrors(next);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    try {
      if (isEdit) {
        await updatePermission(permission!.id, {
          name: name.trim(),
          description: description.trim() || undefined,
        });
      } else {
        await createPermission({
          code: code.trim(),
          name: name.trim(),
          description: description.trim() || undefined,
        });
      }
      toast({ tone: "success", title: isEdit ? "Permiso actualizado" : "Permiso creado" });
      onSaved();
      onClose();
    } catch (err) {
      if (err instanceof ApiException && err.statusCode === 400) {
        setErrors(mapValidationErrors(err, ["code", "name", "description"]).fieldErrors);
      } else if (err instanceof ApiException && err.statusCode === 409) {
        setErrors({ code: err.messages[0] });
      } else {
        toast({ tone: "error", title: "No se pudo guardar", description: errorMessage(err) });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={submitting ? () => {} : onClose}
      title={isEdit ? "Editar permiso" : "Nuevo permiso"}
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" form="perm-form" size="sm" disabled={submitting} aria-busy={submitting}>
            {submitting && <Spinner />}
            {isEdit ? "Guardar" : "Crear"}
          </Button>
        </>
      }
    >
      <form id="perm-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        <Field label="Código" htmlFor="perm-code" required error={errors.code}
          hint={isEdit ? "El código no se puede cambiar." : undefined}>
          <Input
            id="perm-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toLowerCase())}
            invalid={!!errors.code}
            aria-describedby={errors.code ? "perm-code-error" : isEdit ? "perm-code-hint" : undefined}
            disabled={isEdit}
            placeholder="leads:write"
          />
        </Field>
        <Field label="Nombre" htmlFor="perm-name" required error={errors.name}>
          <Input
            id="perm-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            invalid={!!errors.name}
            aria-describedby={errors.name ? "perm-name-error" : undefined}
            placeholder="Crear/editar leads"
          />
        </Field>
        <Field label="Descripción" htmlFor="perm-desc">
          <Textarea
            id="perm-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
      </form>
    </Dialog>
  );
}
