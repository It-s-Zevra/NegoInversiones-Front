"use client";

import { useState } from "react";
import { Eye } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import { ActivityDetailDialog } from "@/components/audit/activity-detail-dialog";
import { useList } from "@/lib/hooks/use-list";
import { listActivityLog } from "@/lib/api/audit-log";
import { formatDateTime } from "@/lib/format";
import type { ActivityLogEntry, ActorType } from "@/lib/api/types";

const ACTOR_LABELS: Record<ActorType, string> = {
  FRONTEND: "Panel",
  N8N: "n8n",
  AGENT: "Agente IA",
  SYSTEM: "Sistema",
};
const ACTOR_FILTER = [
  { value: "", label: "Todos los actores" },
  ...(Object.keys(ACTOR_LABELS) as ActorType[]).map((a) => ({
    value: a,
    label: ACTOR_LABELS[a],
  })),
];

export default function AuditoriaPage() {
  const list = useList<ActivityLogEntry>(listActivityLog, {
    initialSortOrder: "DESC",
  });
  const [selected, setSelected] = useState<ActivityLogEntry | null>(null);

  // Las fechas del filtro (YYYY-MM-DD) se mandan como rango ISO inclusivo.
  function setDate(key: "dateFrom" | "dateTo", value: string) {
    if (!value) {
      list.setFilter(key, undefined);
      return;
    }
    list.setFilter(
      key,
      key === "dateFrom" ? `${value}T00:00:00.000Z` : `${value}T23:59:59.999Z`
    );
  }
  const dateValue = (key: "dateFrom" | "dateTo") =>
    (list.filters[key] ?? "").slice(0, 10);

  // Rango invertido: ambas fechas seteadas y la inicial es posterior a la final.
  const fromIso = list.filters.dateFrom ?? "";
  const toIso = list.filters.dateTo ?? "";
  const invertedRange = !!fromIso && !!toIso && fromIso > toIso;

  const columns: Column<ActivityLogEntry>[] = [
    {
      key: "createdAt",
      header: "Fecha",
      render: (e) => (
        <span className="text-muted">{formatDateTime(e.createdAt)}</span>
      ),
    },
    {
      key: "action",
      header: "Acción",
      render: (e) => <span className="font-medium text-foreground">{e.action}</span>,
    },
    {
      key: "actor",
      header: "Actor",
      render: (e) => <Badge tone="neutral">{ACTOR_LABELS[e.actorType] ?? e.actorType}</Badge>,
    },
    {
      key: "entity",
      header: "Entidad",
      render: (e) => (
        <span className="text-muted">
          {e.entityType ? `${e.entityType}${e.entityId ? ` #${e.entityId}` : ""}` : "—"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (e) => (
        <button
          type="button"
          onClick={() => setSelected(e)}
          className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-muted hover:text-foreground"
          aria-label="Ver detalle"
        >
          <Eye className="h-4 w-4" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Auditoría"
        description="Bitácora de actividad del sistema (solo lectura)."
      />

      <div
        role="group"
        aria-label="Filtros"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <Field label="Actor" htmlFor="a-actor">
          <Select
            id="a-actor"
            options={ACTOR_FILTER}
            value={list.filters.actorType ?? ""}
            onChange={(e) => list.setFilter("actorType", e.target.value)}
          />
        </Field>
        <Field label="Usuario (ID)" htmlFor="a-user">
          <Input
            id="a-user"
            inputMode="numeric"
            value={list.filters.actorUserId ?? ""}
            onChange={(e) => list.setFilter("actorUserId", e.target.value)}
            placeholder="ID del usuario del panel"
          />
        </Field>
        <Field label="Cliente API (ID)" htmlFor="a-client">
          <Input
            id="a-client"
            inputMode="numeric"
            value={list.filters.apiClientId ?? ""}
            onChange={(e) => list.setFilter("apiClientId", e.target.value)}
            placeholder="ID del cliente de API"
          />
        </Field>
        <Field label="Tipo de entidad" htmlFor="a-entity">
          <Input
            id="a-entity"
            value={list.filters.entityType ?? ""}
            onChange={(e) => list.setFilter("entityType", e.target.value)}
            placeholder="user, project, sale…"
          />
        </Field>
        <Field label="ID de entidad" htmlFor="a-entity-id">
          <Input
            id="a-entity-id"
            inputMode="numeric"
            value={list.filters.entityId ?? ""}
            onChange={(e) => list.setFilter("entityId", e.target.value)}
            placeholder="ID de la entidad"
          />
        </Field>
        <Field label="Desde" htmlFor="a-from">
          <Input
            id="a-from"
            type="date"
            value={dateValue("dateFrom")}
            max={dateValue("dateTo") || undefined}
            invalid={invertedRange}
            onChange={(e) => setDate("dateFrom", e.target.value)}
          />
        </Field>
        <Field label="Hasta" htmlFor="a-to">
          <Input
            id="a-to"
            type="date"
            value={dateValue("dateTo")}
            min={dateValue("dateFrom") || undefined}
            invalid={invertedRange}
            onChange={(e) => setDate("dateTo", e.target.value)}
          />
        </Field>
      </div>

      {invertedRange && (
        <p role="alert" className="text-sm text-danger">
          La fecha &ldquo;Desde&rdquo; no puede ser posterior a &ldquo;Hasta&rdquo;.
        </p>
      )}

      <Card className="overflow-hidden p-0">
        <DataTable
          columns={columns}
          data={list.items}
          loading={list.loading}
          error={list.error}
          onRetry={list.refetch}
          rowKey={(e) => e.id}
          onRowClick={(e) => setSelected(e)}
          rowLabel={(e) => `Ver ${e.action}`}
          emptyTitle="Sin registros"
          emptyDescription="No hay actividad que coincida con los filtros."
          emptyAction={
            <Button size="sm" variant="secondary" onClick={() => list.resetFilters()}>
              Limpiar filtros
            </Button>
          }
        />
        {list.meta && !list.error && (
          <Pagination meta={list.meta} onPageChange={list.setPage} />
        )}
      </Card>

      <ActivityDetailDialog entry={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
