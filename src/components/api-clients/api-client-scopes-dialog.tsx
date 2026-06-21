"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/toast";
import { setApiClientScopes } from "@/lib/api/api-clients";
import { ApiException } from "@/lib/api/http";
import { errorMessage } from "@/lib/api/errors";
import type { ApiClient, ApiClientDetail, ApiScope } from "@/lib/api/types";

interface Props {
  open: boolean;
  client: ApiClient | null;
  scopeCatalog: ApiScope[];
  /** Scopes actuales del cliente; null si la baseline es desconocida. */
  currentScopeIds: string[] | null;
  onClose: () => void;
  /** Recibe el detalle (con el set resultante de scopes) tras guardar. */
  onSaved: (detail: ApiClientDetail) => void;
  /** El cliente ya no existe (404 en el PUT). */
  onClientGone: () => void;
  /** Algún scope del catálogo dejó de existir (422 en el PUT). */
  onCatalogStale: () => void;
}

export function ApiClientScopesDialog({
  open,
  client,
  scopeCatalog,
  currentScopeIds,
  onClose,
  onSaved,
  onClientGone,
  onCatalogStale,
}: Props) {
  const toast = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- precarga de baseline al abrir
    setSelected(new Set(currentScopeIds ?? []));
  }, [open, client, currentScopeIds]);

  // Tras recargar el catálogo (p. ej. después de un 422 por un scope eliminado),
  // descarta de la selección los scopes que ya no existen, para no reenviarlos
  // y caer en un bucle de 422. Solo poda con un catálogo ya cargado (no vacío).
  useEffect(() => {
    if (scopeCatalog.length === 0) return;
    const ids = new Set(scopeCatalog.map((s) => s.id));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- poda derivada del catálogo vigente
    setSelected((prev) =>
      [...prev].every((id) => ids.has(id))
        ? prev
        : new Set([...prev].filter((id) => ids.has(id)))
    );
  }, [scopeCatalog]);

  function toggle(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function save() {
    if (!client) return;
    setSaving(true);
    try {
      const detail = await setApiClientScopes(client.id, [...selected]);
      toast({ tone: "success", title: "Scopes actualizados" });
      onSaved(detail);
      onClose();
    } catch (err) {
      if (err instanceof ApiException && err.statusCode === 404) {
        toast({ tone: "success", title: "El cliente ya no existe." });
        onClose();
        onClientGone();
      } else if (err instanceof ApiException && err.statusCode === 422) {
        toast({ tone: "error", title: errorMessage(err) });
        onCatalogStale();
      } else {
        toast({ tone: "error", title: "No se pudieron guardar", description: errorMessage(err) });
      }
    } finally {
      setSaving(false);
    }
  }

  const baselineUnknown = currentScopeIds === null;

  return (
    <Dialog
      open={open}
      onClose={saving ? () => {} : onClose}
      title={`Scopes de ${client?.name ?? ""}`}
      description="Selecciona el conjunto completo de scopes (reemplaza el actual)."
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button size="sm" onClick={save} disabled={saving || baselineUnknown} aria-busy={saving}>
            {saving && <Spinner />}
            Guardar scopes
          </Button>
        </>
      }
    >
      {baselineUnknown && (
        <p className="mb-3 text-xs text-warning">
          No se conocen los scopes actuales de este cliente. Guarda un cambio desde una sesión donde se hayan cargado para evitar borrarlos.
        </p>
      )}
      <div className="max-h-80 space-y-2.5 overflow-auto pr-1">
        {scopeCatalog.length === 0 ? (
          <p className="text-sm text-muted">No hay scopes en el catálogo.</p>
        ) : (
          scopeCatalog.map((s) => (
            <Checkbox
              key={s.id}
              checked={selected.has(s.id)}
              onCheckedChange={(c) => toggle(s.id, c)}
              label={s.code}
              description={s.description ?? undefined}
            />
          ))
        )}
      </div>
    </Dialog>
  );
}
