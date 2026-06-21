"use client";

import { useContext, useState } from "react";
import { CheckCheck, Check } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { useList } from "@/lib/hooks/use-list";
import { UnreadContext } from "@/lib/hooks/use-unread-count";
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/lib/api/notifications";
import { errorMessage } from "@/lib/api/errors";
import { ApiException } from "@/lib/api/http";
import { formatRelativeTime } from "@/lib/format";
import { NOTIFICATION_TYPE_LABELS, labelFor } from "@/lib/constants";
import type { Notification, NotificationType } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const READ_FILTER = [
  { value: "", label: "Todas" },
  { value: "false", label: "No leídas" },
  { value: "true", label: "Leídas" },
];
const TYPE_FILTER = [
  { value: "", label: "Todos los tipos" },
  ...(Object.keys(NOTIFICATION_TYPE_LABELS) as NotificationType[]).map((t) => ({
    value: t,
    label: NOTIFICATION_TYPE_LABELS[t],
  })),
];

export default function NotificacionesPage() {
  const toast = useToast();
  const refreshUnread = useContext(UnreadContext);
  const list = useList<Notification>(listNotifications, { initialSortOrder: "DESC" });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  async function markOne(n: Notification) {
    if (n.isRead) return;
    setBusyId(n.id);
    try {
      await markNotificationRead(n.id);
      list.refetch();
      refreshUnread();
    } catch (err) {
      if (err instanceof ApiException && err.statusCode === 404) {
        // La notificación ya no existe: sincronizamos la lista.
        list.refetch();
      } else {
        toast({ tone: "error", title: "No se pudo marcar", description: errorMessage(err) });
      }
    } finally {
      setBusyId(null);
    }
  }
  async function markAll() {
    setMarkingAll(true);
    try {
      const res = await markAllNotificationsRead();
      toast({ tone: "success", title: res.updated > 0 ? `${res.updated} marcadas como leídas` : "Sin pendientes" });
      list.refetch();
      refreshUnread();
    } catch (err) {
      toast({ tone: "error", title: "No se pudo", description: errorMessage(err) });
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notificaciones"
        description="Tu bandeja de notificaciones."
        actions={
          <Button variant="secondary" onClick={markAll} disabled={markingAll} aria-busy={markingAll}>
            <CheckCheck className="h-4 w-4" />
            Marcar todas
          </Button>
        }
      />

      <div role="group" aria-label="Filtros" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:max-w-lg">
        <Field label="Estado" htmlFor="n-read">
          <Select id="n-read" options={READ_FILTER} value={list.filters.isRead ?? ""}
            onChange={(e) => list.setFilter("isRead", e.target.value)} />
        </Field>
        <Field label="Tipo" htmlFor="n-type">
          <Select id="n-type" options={TYPE_FILTER} value={list.filters.type ?? ""}
            onChange={(e) => list.setFilter("type", e.target.value)} />
        </Field>
      </div>

      <Card className="overflow-hidden p-0">
        <CardContent className="p-0">
          {list.loading ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : list.error ? (
            <ErrorState error={list.error} onRetry={list.refetch} />
          ) : list.items.length === 0 ? (
            <EmptyState title="Sin notificaciones" description="No hay notificaciones que coincidan." />
          ) : (
            <ul className="divide-y divide-border">
              {list.items.map((n) => (
                <li
                  key={n.id}
                  className={cn(
                    "flex items-start gap-3 px-5 py-3.5",
                    !n.isRead && "bg-primary-soft/30"
                  )}
                >
                  <span
                    className={cn(
                      "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                      n.isRead ? "bg-transparent" : "bg-primary"
                    )}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-sm font-medium text-foreground">{n.title}</p>
                      {n.priority === "HIGH" && <Badge tone="danger">Alta</Badge>}
                      <Badge tone="neutral">{labelFor(NOTIFICATION_TYPE_LABELS, n.type)}</Badge>
                    </div>
                    {n.description && <p className="mt-0.5 text-sm text-muted">{n.description}</p>}
                    <p className="mt-0.5 text-xs text-subtle">{formatRelativeTime(n.createdAt)}</p>
                  </div>
                  {!n.isRead && (
                    <button
                      type="button"
                      onClick={() => markOne(n)}
                      disabled={busyId === n.id}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-muted hover:text-foreground"
                      aria-label="Marcar como leída"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
        {list.meta && !list.error && (
          <Pagination meta={list.meta} onPageChange={list.setPage} />
        )}
      </Card>
    </div>
  );
}
