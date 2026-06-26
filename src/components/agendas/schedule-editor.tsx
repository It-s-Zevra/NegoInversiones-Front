"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, CalendarClock, Clock } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { ErrorState, EmptyState } from "@/components/ui/states";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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

// Orden de la semana empezando en Lunes (1) y terminando en Domingo (0).
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

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

  // Conservamos el índice original de cada franja para que update/remove
  // sigan operando sobre el array plano de estado.
  const indexed = windows.map((w, i) => ({ w, i }));

  return (
    <Card>
      <CardHeader>
        <div className="space-y-1">
          <CardTitle>Disponibilidad semanal</CardTitle>
          <p className="text-sm text-muted">
            Define las franjas horarias en que esta persona atiende cada día.
          </p>
        </div>
        {canWrite && (
          <Button size="sm" variant="secondary" onClick={save} disabled={saving || loading} aria-busy={saving}>
            {saving && <Spinner />}
            Guardar
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-card" />
            ))}
          </div>
        ) : error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : windows.length === 0 ? (
          <EmptyState
            icon={<CalendarClock className="h-5 w-5" />}
            title="Todavía no hay franjas"
            description="Una franja es un rango horario en el que la persona está disponible para atender (por ejemplo, los lunes de 09:00 a 13:00). Agrega la primera para empezar."
            action={
              canWrite ? (
                <Button type="button" variant="primary" size="sm" onClick={add}>
                  <Plus className="h-4 w-4" />
                  Agregar franja
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="space-y-3">
            {WEEK_ORDER.map((day) => {
              const dayWins = indexed.filter(({ w }) => w.dayOfWeek === day);
              if (dayWins.length === 0) return null;
              return (
                <div
                  key={day}
                  className="rounded-card border border-border bg-surface-muted/40 p-3 sm:p-4"
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h3 className="font-display text-sm font-semibold text-foreground">
                      {DAY_OF_WEEK_LABELS[day]}
                    </h3>
                    <Badge tone="primary">
                      {dayWins.length} {dayWins.length === 1 ? "franja" : "franjas"}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {dayWins.map(({ w, i }) => (
                      <div
                        key={i}
                        className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3 sm:flex-row sm:items-center"
                      >
                        <div className="flex flex-1 items-center gap-2">
                          <Clock className="h-4 w-4 shrink-0 text-subtle" aria-hidden="true" />
                          <div className="flex flex-1 items-center gap-2">
                            <Input
                              type="time"
                              value={w.startTime}
                              onChange={(e) => update(i, { startTime: e.target.value })}
                              disabled={!canWrite}
                              aria-label={`Hora de inicio · ${DAY_OF_WEEK_LABELS[day]}`}
                              className="flex-1"
                            />
                            <span className="text-sm text-subtle" aria-hidden="true">
                              a
                            </span>
                            <Input
                              type="time"
                              value={w.endTime}
                              onChange={(e) => update(i, { endTime: e.target.value })}
                              disabled={!canWrite}
                              aria-label={`Hora de fin · ${DAY_OF_WEEK_LABELS[day]}`}
                              className="flex-1"
                            />
                          </div>
                        </div>
                        {canWrite && (
                          <button
                            type="button"
                            onClick={() => remove(i)}
                            className="grid h-9 w-9 shrink-0 place-items-center self-end rounded-lg text-muted transition-colors hover:bg-danger-soft hover:text-danger sm:self-center"
                            aria-label={`Quitar franja de ${DAY_OF_WEEK_LABELS[day]}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {canWrite && (
              <div className="pt-1">
                <Button type="button" variant="outline" size="sm" onClick={add}>
                  <Plus className="h-4 w-4" />
                  Agregar franja
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
