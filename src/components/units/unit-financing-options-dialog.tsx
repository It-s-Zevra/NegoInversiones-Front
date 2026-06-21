"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Checkbox } from "@/components/ui/checkbox";
import { ErrorState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import {
  listFinancingPlans,
  getUnitFinancingOptions,
  setUnitFinancingOptions,
} from "@/lib/api/financing";
import { ApiException } from "@/lib/api/http";
import { errorMessage } from "@/lib/api/errors";
import { FINANCING_TYPE_LABELS, labelFor } from "@/lib/constants";
import type { FinancingPlan } from "@/lib/api/types";

interface Props {
  open: boolean;
  unitId: string;
  unitCode: string;
  onClose: () => void;
  /** Recibe el array de planes resultante tras guardar (reemplazo total). */
  onSaved: (plans: FinancingPlan[]) => void;
  /** La unidad ya no existe (404). */
  onUnitGone: () => void;
}

const CATALOG_QUERY = {
  page: 1,
  limit: 100,
  sortBy: "name",
  sortOrder: "ASC" as const,
};

/**
 * Gestiona el conjunto de planes de financiamiento de una unidad
 * (PUT /units/:id/financing-options es REEMPLAZO TOTAL; ver flujos/financiamiento/07).
 * Carga su propia baseline (catálogo + set actual) y no permite guardar hasta
 * tenerla, para no enviar un set incompleto.
 */
export function UnitFinancingOptionsDialog({
  open,
  unitId,
  unitCode,
  onClose,
  onSaved,
  onUnitGone,
}: Props) {
  const toast = useToast();
  const [catalog, setCatalog] = useState<FinancingPlan[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const [baselineLoaded, setBaselineLoaded] = useState(false);

  useEffect(() => {
    if (!open) return;
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga al abrir el diálogo
    setLoading(true);
    setError(null);
    setBaselineLoaded(false);
    Promise.all([listFinancingPlans(CATALOG_QUERY), getUnitFinancingOptions(unitId)])
      .then(([plans, current]) => {
        if (!active) return;
        setCatalog(plans.data);
        setSelected(new Set(current.map((p) => p.id)));
        setBaselineLoaded(true);
      })
      .catch((e) => {
        if (active) setError(e);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, unitId]);

  function toggle(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    try {
      const updated = await setUnitFinancingOptions(unitId, [...selected]);
      toast({ tone: "success", title: "Opciones de financiamiento actualizadas" });
      onSaved(updated);
      onClose();
    } catch (err) {
      if (err instanceof ApiException && err.statusCode === 404) {
        toast({ tone: "error", title: "Unidad no encontrada" });
        onClose();
        onUnitGone();
        return;
      }
      if (err instanceof ApiException && err.statusCode === 422) {
        // algún plan del set dejó de existir: recargar catálogo y podar selección
        // para no reenviar el id muerto y repetir el 422.
        try {
          const plans = await listFinancingPlans(CATALOG_QUERY);
          setCatalog(plans.data);
          const ids = new Set(plans.data.map((p) => p.id));
          setSelected((prev) => new Set([...prev].filter((id) => ids.has(id))));
        } catch {
          /* si falla la recarga se conserva la selección actual */
        }
        toast({
          tone: "info",
          title: "El catálogo de planes cambió",
          description: errorMessage(err),
        });
        return;
      }
      toast({ tone: "error", title: "No se pudieron guardar", description: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={saving ? () => {} : onClose}
      title={`Opciones de financiamiento · ${unitCode}`}
      description="Selecciona el conjunto completo de planes para esta unidad (reemplaza el actual)."
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={save}
            disabled={saving || loading || !baselineLoaded}
            aria-busy={saving}
          >
            {saving && <Spinner />}
            Guardar opciones
          </Button>
        </>
      }
    >
      {loading ? (
        <div className="grid place-items-center py-10">
          <Spinner className="h-5 w-5 text-muted" />
        </div>
      ) : error ? (
        <ErrorState error={error} />
      ) : catalog.length === 0 ? (
        <p className="text-sm text-muted">No hay planes de financiamiento en el catálogo.</p>
      ) : (
        <div className="space-y-2.5">
          <p className="text-xs text-muted">
            {selected.size} de {catalog.length} seleccionados
          </p>
          <div className="max-h-80 space-y-2.5 overflow-auto pr-1">
            {catalog.map((p) => (
              <Checkbox
                key={p.id}
                checked={selected.has(p.id)}
                onCheckedChange={(c) => toggle(p.id, c)}
                label={p.isActive ? p.name : `${p.name} (inactivo)`}
                description={labelFor(FINANCING_TYPE_LABELS, p.type)}
              />
            ))}
          </div>
        </div>
      )}
    </Dialog>
  );
}
