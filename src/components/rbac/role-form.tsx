"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { ApiException } from "@/lib/api/http";
import { errorMessage, mapValidationErrors } from "@/lib/api/errors";
import { createRole, updateRole } from "@/lib/api/roles";
import { ROLE_LABELS } from "@/lib/constants";
import type { Role, UserRole } from "@/lib/api/types";

const CODE_OPTIONS = (Object.keys(ROLE_LABELS) as UserRole[]).map((c) => ({
  value: c,
  label: `${ROLE_LABELS[c]} (${c})`,
}));

interface Props {
  open: boolean;
  onClose: () => void;
  role?: Role | null;
  onSaved: () => void;
}

export function RoleForm({ open, onClose, role, onSaved }: Props) {
  const toast = useToast();
  const isEdit = !!role;
  const [code, setCode] = useState<UserRole>("EJECUTIVO_VENTAS");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- precarga al abrir
    setErrors({});
    setCode(role?.code ?? "EJECUTIVO_VENTAS");
    setName(role?.name ?? "");
    setDescription(role?.description ?? "");
  }, [open, role]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = "El nombre es obligatorio.";
    setErrors(next);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    try {
      if (isEdit) {
        await updateRole(role!.id, {
          name: name.trim(),
          description: description.trim() || undefined,
        });
      } else {
        await createRole({
          code,
          name: name.trim(),
          description: description.trim() || undefined,
        });
      }
      toast({ tone: "success", title: isEdit ? "Rol actualizado" : "Rol creado" });
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
      title={isEdit ? "Editar rol" : "Nuevo rol"}
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" form="role-form" size="sm" disabled={submitting} aria-busy={submitting}>
            {submitting && <Spinner />}
            {isEdit ? "Guardar" : "Crear"}
          </Button>
        </>
      }
    >
      <form id="role-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        <Field label="Código" htmlFor="role-code" required error={errors.code}
          hint={isEdit ? "El código no se puede cambiar." : undefined}>
          <Select
            id="role-code"
            options={CODE_OPTIONS}
            value={code}
            onChange={(e) => setCode(e.target.value as UserRole)}
            disabled={isEdit}
            invalid={!!errors.code}
            aria-describedby={errors.code ? "role-code-error" : isEdit ? "role-code-hint" : undefined}
          />
        </Field>
        <Field label="Nombre" htmlFor="role-name" required error={errors.name}>
          <Input id="role-name" value={name} onChange={(e) => setName(e.target.value)}
            invalid={!!errors.name} aria-describedby={errors.name ? "role-name-error" : undefined}
            placeholder="Jefe Comercial" />
        </Field>
        <Field label="Descripción" htmlFor="role-desc">
          <Textarea id="role-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
      </form>
    </Dialog>
  );
}
