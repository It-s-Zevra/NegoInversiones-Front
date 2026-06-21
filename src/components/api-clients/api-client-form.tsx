"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { ApiException } from "@/lib/api/http";
import { errorMessage, mapValidationErrors } from "@/lib/api/errors";
import {
  createApiClient,
  updateApiClient,
} from "@/lib/api/api-clients";
import type { ApiClient, ApiClientCreated, ApiScope } from "@/lib/api/types";

interface Props {
  open: boolean;
  onClose: () => void;
  client?: ApiClient | null;
  scopeCatalog: ApiScope[];
  /** create devuelve ApiClientCreated (con apiKey); edit devuelve ApiClient. */
  onSaved: (result: ApiClientCreated | ApiClient) => void;
}

export function ApiClientForm({ open, onClose, client, scopeCatalog, onSaved }: Props) {
  const toast = useToast();
  const isEdit = !!client;
  const [name, setName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [scopeIds, setScopeIds] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- precarga al abrir
    setErrors({});
    setName(client?.name ?? "");
    setIsActive(client?.isActive ?? true);
    setScopeIds(new Set());
  }, [open, client]);

  function toggleScope(id: string, checked: boolean) {
    setScopeIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setErrors({ name: "El nombre es obligatorio." });
      return;
    }
    setSubmitting(true);
    try {
      const result = isEdit
        ? await updateApiClient(client!.id, { name: name.trim(), isActive })
        : await createApiClient({ name: name.trim(), scopeIds: [...scopeIds] });
      toast({ tone: "success", title: isEdit ? "Cliente actualizado" : "Cliente creado" });
      onSaved(result);
      onClose();
    } catch (err) {
      if (err instanceof ApiException && err.statusCode === 400) {
        setErrors(mapValidationErrors(err, ["name", "scopeIds"]).fieldErrors);
      } else if (err instanceof ApiException && err.statusCode === 422) {
        toast({ tone: "error", title: errorMessage(err) });
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
      title={isEdit ? "Editar cliente de API" : "Nuevo cliente de API"}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" form="apiclient-form" size="sm" disabled={submitting} aria-busy={submitting}>
            {submitting && <Spinner />}
            {isEdit ? "Guardar" : "Crear"}
          </Button>
        </>
      }
    >
      <form id="apiclient-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        <Field label="Nombre" htmlFor="ac-name" required error={errors.name}>
          <Input id="ac-name" value={name} onChange={(e) => setName(e.target.value)}
            invalid={!!errors.name} aria-describedby={errors.name ? "ac-name-error" : undefined}
            placeholder="Integración n8n" />
        </Field>

        {isEdit ? (
          <div className="flex items-center justify-between rounded-lg border border-border bg-surface-muted/50 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">Cliente activo</p>
              <p className="text-xs text-muted">Desactívalo para pausar su API key.</p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} aria-label="Cliente activo" />
          </div>
        ) : (
          <Field label="Scopes" htmlFor="ac-scopes">
            <div className="max-h-56 space-y-2.5 overflow-auto rounded-lg border border-border p-3">
              {scopeCatalog.length === 0 ? (
                <p className="text-xs text-muted">No hay scopes en el catálogo.</p>
              ) : (
                scopeCatalog.map((s) => (
                  <Checkbox
                    key={s.id}
                    checked={scopeIds.has(s.id)}
                    onCheckedChange={(c) => toggleScope(s.id, c)}
                    label={s.code}
                    description={s.description ?? undefined}
                  />
                ))
              )}
            </div>
          </Field>
        )}
      </form>
    </Dialog>
  );
}
