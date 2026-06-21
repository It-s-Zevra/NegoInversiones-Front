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
import { createApiScope, SCOPE_CODE_RE } from "@/lib/api/api-clients";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function ApiScopeForm({ open, onClose, onSaved }: Props) {
  const toast = useToast();
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset al abrir
    setErrors({});
    setCode("");
    setDescription("");
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!SCOPE_CODE_RE.test(code.trim())) {
      setErrors({ code: "Formato recurso:accion en minúsculas (ej. leads:write)." });
      return;
    }
    setSubmitting(true);
    try {
      await createApiScope({ code: code.trim(), description: description.trim() || undefined });
      toast({ tone: "success", title: "Scope creado" });
      onSaved();
      onClose();
    } catch (err) {
      if (err instanceof ApiException && err.statusCode === 400) {
        setErrors(mapValidationErrors(err, ["code", "description"]).fieldErrors);
      } else if (err instanceof ApiException && err.statusCode === 409) {
        setErrors({ code: err.messages[0] });
      } else {
        toast({ tone: "error", title: "No se pudo crear", description: errorMessage(err) });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={submitting ? () => {} : onClose}
      title="Nuevo scope"
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" form="scope-form" size="sm" disabled={submitting} aria-busy={submitting}>
            {submitting && <Spinner />}
            Crear
          </Button>
        </>
      }
    >
      <form id="scope-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        <Field label="Código" htmlFor="scope-code" required error={errors.code}>
          <Input id="scope-code" value={code} onChange={(e) => setCode(e.target.value.toLowerCase())}
            invalid={!!errors.code} aria-describedby={errors.code ? "scope-code-error" : undefined}
            placeholder="leads:write" />
        </Field>
        <Field label="Descripción" htmlFor="scope-desc">
          <Textarea id="scope-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
      </form>
    </Dialog>
  );
}
