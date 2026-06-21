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

function Snapshot({
  title,
  data,
}: {
  title: string;
  data: Record<string, unknown> | null;
}) {
  return (
    <div className="min-w-0">
      <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-subtle">
        {title}
      </p>
      <pre className="max-h-64 overflow-auto rounded-lg border border-border bg-surface-muted p-3 text-xs text-foreground">
        {data ? JSON.stringify(mask(data), null, 2) : "—"}
      </pre>
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
              <Badge tone="neutral">{ACTOR_LABELS[entry.actorType]}</Badge>
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
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Snapshot title="Antes" data={entry.before} />
            <Snapshot title="Después" data={entry.after} />
          </div>
        </div>
      )}
    </Dialog>
  );
}
