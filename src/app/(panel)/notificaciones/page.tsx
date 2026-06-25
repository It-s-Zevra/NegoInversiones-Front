"use client";

import { useContext, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, Check, ArrowUpRight } from "lucide-react";
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
import { UnreadContext, useUnreadCount } from "@/lib/hooks/use-unread-count";
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

/** Mapea la entidad origen de la notificación a su ruta en el panel. */
const ENTITY_ROUTES: Record<string, string> = {
  lead: "/leads",
  project: "/proyectos",
  unit: "/unidades",
  sale: "/ventas",
  "financing-plan": "/financiamiento",
  "availability-exception": "/agendas",
};

function entityHref(n: Notification): string | null {
  if (!n.entityType || !n.entityId) return null;
  const base = ENTITY_ROUTES[n.entityType.toLowerCase()];
  return base ? `${base}/${encodeURIComponent(n.entityId)}` : null;
}

export default function NotificacionesPage() {
  const toast = useToast();
  const router = useRouter();
  const refreshUnread = useContext(UnreadContext);
  const { count: unreadCount, refresh: refreshLocalUnread } = useUnreadCount();
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
      refreshLocalUnread();
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
  function goToEntity(n: Notification) {
    const href = entityHref(n);
    if (!href) return;
    if (!n.isRead) void markOne(n);
    router.push(href);
  }

  async function markAll() {
    setMarkingAll(true);
    try {
      const res = await markAllNotificationsRead();
      toast({ tone: "success", title: res.updated > 0 ? `${res.updated} marcadas como leídas` : "Sin pendientes" });
      list.refetch();
      refreshUnread();
      refreshLocalUnread();
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
          <Button
            variant="secondary"
            onClick={markAll}
            disabled={markingAll || unreadCount === 0}
            aria-busy={markingAll}
          >
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
                  <div className="flex shrink-0 items-center gap-1">
                    {entityHref(n) && (
                      <button
                        type="button"
                        onClick={() => goToEntity(n)}
                        className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-muted hover:text-foreground"
                        aria-label="Ver origen"
                      >
                        <ArrowUpRight className="h-4 w-4" />
                      </button>
                    )}
                    {!n.isRead && (
                      <button
                        type="button"
                        onClick={() => markOne(n)}
                        disabled={busyId === n.id}
                        className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-muted hover:text-foreground"
                        aria-label="Marcar como leída"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    )}
                  </div>
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
