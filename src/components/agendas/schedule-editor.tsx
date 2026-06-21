"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { ErrorState, EmptyState } from "@/components/ui/states";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/lib/hooks/use-resource";
import { getUserSchedule, setUserSchedule } from "@/lib/api/schedules";
import { errorMessage } from "@/lib/api/errors";
import { DAY_OF_WEEK_LABELS } from "@/lib/constants";
import type { Schedule } from "@/lib/api/types";

interface Win {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

const DAY_OPTIONS = [0, 1, 2, 3, 4, 5, 6].map((d) => ({
  value: String(d),
  label: DAY_OF_WEEK_LABELS[d],
}));

export function ScheduleEditor({
  userId,
  canWrite,
}: {
  userId: string;
  canWrite: boolean;
}) {
  const toast = useToast();
  const fetcher = useCallback((s?: AbortSignal) => getUserSchedule(userId, s), [userId]);
  const { data, loading, error, refetch } = useResource<Schedule[]>(fetcher, [userId]);

  const [windows, setWindows] = useState<Win[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza el editor con lo cargado
    setWindows(
      data.map((w) => ({
        dayOfWeek: w.dayOfWeek,
        startTime: w.startTime.slice(0, 5),
        endTime: w.endTime.slice(0, 5),
      }))
    );
  }, [data]);

  function update(i: number, patch: Partial<Win>) {
    setWindows((ws) => ws.map((w, idx) => (idx === i ? { ...w, ...patch } : w)));
  }
  function add() {
    setWindows((ws) => [...ws, { dayOfWeek: 1, startTime: "09:00", endTime: "18:00" }]);
  }
  function remove(i: number) {
    setWindows((ws) => ws.filter((_, idx) => idx !== i));
  }

  async function save() {
    setSaving(true);
    try {
      await setUserSchedule(
        userId,
        windows.map((w) => ({ ...w, isActive: true }))
      );
      toast({ tone: "success", title: "Disponibilidad guardada" });
      refetch();
    } catch (err) {
      toast({ tone: "error", title: "No se pudo guardar", description: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Disponibilidad semanal</CardTitle>
        {canWrite && (
          <Button size="sm" variant="secondary" onClick={save} disabled={saving || loading} aria-busy={saving}>
            {saving && <Spinner />}
            Guardar
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : (
          <div className="space-y-3">
            {windows.length === 0 && (
              <EmptyState title="Sin ventanas" description="Agrega franjas de disponibilidad semanal." />
            )}
            {windows.map((w, i) => (
              <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center">
                <Select
                  options={DAY_OPTIONS}
                  value={String(w.dayOfWeek)}
                  onChange={(e) => update(i, { dayOfWeek: Number(e.target.value) })}
                  disabled={!canWrite}
                  aria-label="Día"
                />
                <Input type="time" value={w.startTime} onChange={(e) => update(i, { startTime: e.target.value })}
                  disabled={!canWrite} aria-label="Hora inicio" />
                <Input type="time" value={w.endTime} onChange={(e) => update(i, { endTime: e.target.value })}
                  disabled={!canWrite} aria-label="Hora fin" />
                {canWrite && (
                  <button type="button" onClick={() => remove(i)}
                    className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger"
                    aria-label="Quitar ventana">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            {canWrite && (
              <Button type="button" variant="ghost" size="sm" onClick={add}>
                <Plus className="h-4 w-4" />
                Agregar ventana
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
