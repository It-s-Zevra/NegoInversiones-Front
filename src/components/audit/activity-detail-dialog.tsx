"use client";

import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";
import type { ActivityLogEntry, ActorType } from "@/lib/api/types";

const ACTOR_LABELS: Record<ActorType, string> = {
  FRONTEND: "Panel",
  N8N: "n8n",
  AGENT: "Agente IA",
  SYSTEM: "Sistema",
};

const SENSITIVE = /token|secret|password|hash|api[_-]?key/i;

function mask(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(mask);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SENSITIVE.test(k) ? "••••" : mask(v);
  }
  return out;
}

function fmt(value: unknown): string {
  if (value === undefined) return "—";
  const masked = mask(value);
  if (masked === null) return "null";
  return typeof masked === "object" ? JSON.stringify(masked) : String(masked);
}

/** Visor campo a campo: muestra qué cambió (antes → después), no JSON crudo. */
function FieldDiff({
  before,
  after,
}: {
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}) {
  const b = (before ?? {}) as Record<string, unknown>;
  const a = (after ?? {}) as Record<string, unknown>;
  const keys = Array.from(new Set([...Object.keys(b), ...Object.keys(a)])).sort();
  if (keys.length === 0) {
    return <p className="text-sm text-muted">Sin cambios registrados.</p>;
  }
  const changed = (k: string) => JSON.stringify(b[k]) !== JSON.stringify(a[k]);
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border text-left text-subtle">
            <th className="px-3 py-2 font-medium">Campo</th>
            <th className="px-3 py-2 font-medium">Antes</th>
            <th className="px-3 py-2 font-medium">Después</th>
          </tr>
        </thead>
        <tbody>
          {keys.map((k) => (
            <tr
              key={k}
              className={
                changed(k)
                  ? "border-b border-border bg-warning-soft/40 last:border-0"
                  : "border-b border-border last:border-0"
              }
            >
              <td className="px-3 py-1.5 font-medium text-foreground">{k}</td>
              <td className="px-3 py-1.5 text-muted">{before ? fmt(b[k]) : "—"}</td>
              <td className="px-3 py-1.5 text-foreground">{after ? fmt(a[k]) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ActivityDetailDialog({
  entry,
  onClose,
}: {
  entry: ActivityLogEntry | null;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={!!entry}
      onClose={onClose}
      title={entry?.action ?? "Actividad"}
      description={entry ? formatDateTime(entry.createdAt) : undefined}
      size="lg"
    >
      {entry && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <div>
              <span className="text-muted">Actor: </span>
              <Badge tone="neutral">{ACTOR_LABELS[entry.actorType] ?? entry.actorType}</Badge>
            </div>
            {entry.entityType && (
              <div>
                <span className="text-muted">Entidad: </span>
                <span className="font-medium text-foreground">
                  {entry.entityType}
                  {entry.entityId ? ` #${entry.entityId}` : ""}
                </span>
              </div>
            )}
            {entry.actorUserId && (
              <div>
                <span className="text-muted">Usuario: </span>
                <span className="font-medium text-foreground">
                  #{entry.actorUserId}
                </span>
              </div>
            )}
            {entry.ipAddress && (
              <div>
                <span className="text-muted">IP: </span>
                <span className="font-medium text-foreground">
                  {entry.ipAddress}
                </span>
              </div>
            )}
            {entry.userAgent && (
              <div className="min-w-0">
                <span className="text-muted">User agent: </span>
                <span className="break-all font-medium text-foreground">
                  {entry.userAgent}
                </span>
              </div>
            )}
          </div>

          <FieldDiff before={entry.before} after={entry.after} />
        </div>
      )}
    </Dialog>
  );
}
