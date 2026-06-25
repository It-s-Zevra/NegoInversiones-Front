"use client";

import { useCallback, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/lib/hooks/use-resource";
import { errorMessage } from "@/lib/api/errors";
import { listLeadZones, addLeadZone, removeLeadZone } from "@/lib/api/leads";
import { listZones } from "@/lib/api/zones";
import type { Zone } from "@/lib/api/types";

interface Props {
  leadId: string;
  canWrite: boolean;
}

export function ZonesTab({ leadId, canWrite }: Props) {
  const toast = useToast();
  const zonesFetcher = useCallback((s?: AbortSignal) => listLeadZones(leadId, s), [leadId]);
  const { data: zones, loading, error, refetch, mutate } = useResource<Zone[]>(zonesFetcher, [leadId]);

  const catalogFetcher = useCallback((s?: AbortSignal) => listZones(s), []);
  const { data: catalog } = useResource<Zone[]>(catalogFetcher, []);

  const [busy, setBusy] = useState(false);

  const available = useMemo(() => {
    const have = new Set((zones ?? []).map((z) => z.id));
    return (catalog ?? []).filter((z) => !have.has(z.id));
  }, [zones, catalog]);

  async function add(zoneId: string) {
    if (!zoneId) return;
    setBusy(true);
    try {
      const next = await addLeadZone(leadId, zoneId);
      mutate(next);
    } catch (err) {
      toast({ tone: "error", title: "No se pudo agregar la zona", description: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  async function remove(zoneId: string) {
    setBusy(true);
    try {
      const next = await removeLeadZone(leadId, zoneId);
      mutate(next);
    } catch (err) {
      toast({ tone: "error", title: "No se pudo quitar la zona", description: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Zonas de interés</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <Skeleton className="h-10 w-full" />
        ) : error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : (
          <>
            {(zones?.length ?? 0) === 0 ? (
              <EmptyState title="Sin zonas" description="Este lead no tiene zonas de interés." />
            ) : (
              <div className="flex flex-wrap gap-2">
                {zones!.map((z) => (
                  <span
                    key={z.id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-muted px-3 py-1 text-sm text-foreground"
                  >
                    {z.name}
                    {z.city ? <span className="text-xs text-subtle">· {z.city}</span> : null}
                    {canWrite && (
                      <button
                        type="button"
                        onClick={() => remove(z.id)}
                        disabled={busy}
                        className="grid h-4 w-4 place-items-center rounded-full text-muted hover:text-danger"
                        aria-label={`Quitar ${z.name}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </span>
                ))}
              </div>
            )}

            {canWrite && (
              <div className="flex items-center gap-2 sm:max-w-xs">
                <Plus className="h-4 w-4 shrink-0 text-subtle" />
                <Select
                  options={[
                    { value: "", label: available.length ? "Agregar zona…" : "Sin zonas disponibles" },
                    ...available.map((z) => ({
                      value: z.id,
                      label: z.city ? `${z.name} · ${z.city}` : z.name,
                    })),
                  ]}
                  value=""
                  onChange={(e) => add(e.target.value)}
                  disabled={busy || available.length === 0}
                  aria-label="Agregar zona de interés"
                />
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
