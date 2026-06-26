"use client";

import { useCallback, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  UserPlus,
  Phone,
  MessageCircle,
  Copy,
  Mail,
  User,
  Clock,
  CalendarClock,
  MapPin,
  Bell,
  FileText,
  MessageSquare,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, EmptyState } from "@/components/ui/states";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { LeadAssignDialog } from "@/components/leads/lead-assign-dialog";
import { QualificationTab } from "@/components/leads/tabs/qualification-tab";
import { InteractionsTab } from "@/components/leads/tabs/interactions-tab";
import { AppointmentsTab } from "@/components/leads/tabs/appointments-tab";
import { ZonesTab } from "@/components/leads/tabs/zones-tab";
import { FollowupsTab } from "@/components/leads/tabs/followups-tab";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/lib/hooks/use-resource";
import { useAuth } from "@/lib/auth/auth-context";
import { getLead, deleteLead } from "@/lib/api/leads";
import { listProjects } from "@/lib/api/projects";
import { listUsers } from "@/lib/api/users";
import { listRoles } from "@/lib/api/roles";
import { ApiException } from "@/lib/api/http";
import { errorMessage } from "@/lib/api/errors";
import { formatDate, formatDateTime, formatRelativeTime } from "@/lib/format";
import { leadStatusTone } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Lead, Paginated, Project, Role, User as ApiUser } from "@/lib/api/types";

type TabKey = "interactions" | "qualification" | "appointments" | "zones" | "followups";
const TABS: { key: TabKey; label: string; icon: typeof Bell }[] = [
  { key: "interactions", label: "Interacciones", icon: MessageSquare },
  { key: "qualification", label: "Calificación", icon: FileText },
  { key: "appointments", label: "Citas", icon: CalendarClock },
  { key: "zones", label: "Zonas", icon: MapPin },
  { key: "followups", label: "Followups", icon: Bell },
];

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border py-2.5 last:border-0">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-right text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

function Tile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Bell;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-subtle">
        <Icon className="h-4 w-4" />
        <p className="text-xs">{label}</p>
      </div>
      <p className="mt-1.5 truncate text-sm font-semibold text-foreground">{value}</p>
    </Card>
  );
}

export default function LeadDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const toast = useToast();
  const { can, user } = useAuth();

  const role = user?.role;
  const isManager = role === "ADMIN" || role === "JEFE_COMERCIAL";
  const isAdmin = role === "ADMIN";
  const canWrite =
    can("leads:write") &&
    (role === "ADMIN" || role === "JEFE_COMERCIAL" || role === "EJECUTIVO_VENTAS");
  const canAssign = isManager && can("leads:write");
  const canDelete = isAdmin && can("leads:delete");
  const canSubDelete = isManager && can("leads:delete"); // sub-recursos: ADMIN/JEFE

  const fetchLead = useCallback((s?: AbortSignal) => getLead(id, s), [id]);
  const { data: lead, loading, error, refetch } = useResource<Lead>(fetchLead, [id]);

  const fetchProjects = useCallback(
    (s?: AbortSignal) =>
      listProjects({ page: 1, limit: 100, sortBy: "name", sortOrder: "ASC" }, s),
    []
  );
  const { data: projectsPage } = useResource<Paginated<Project>>(fetchProjects, []);
  const projects = useMemo(() => projectsPage?.data ?? [], [projectsPage]);
  const projectName = (pid: string | null) =>
    pid ? (projects.find((p) => p.id === pid)?.name ?? `Proyecto #${pid}`) : null;

  const fetchUsers = useCallback(
    (s?: AbortSignal) =>
      listUsers({ page: 1, limit: 100, sortBy: "firstName", sortOrder: "ASC" }, s),
    []
  );
  const { data: usersPage } = useResource<Paginated<ApiUser>>(fetchUsers, []);
  const users = useMemo(() => usersPage?.data ?? [], [usersPage]);

  // Ejecutivos (rol EJECUTIVO_VENTAS) para el combobox de asignación.
  const rolesFetcher = useCallback((s?: AbortSignal) => listRoles(s), []);
  const { data: roles } = useResource<Role[]>(rolesFetcher, []);
  const execRoleId = useMemo(
    () => (roles ?? []).find((r) => r.code === "EJECUTIVO_VENTAS")?.id,
    [roles]
  );
  const execOptions = useMemo(() => {
    const pool = execRoleId ? users.filter((u) => u.roleId === execRoleId) : users;
    return pool.map((u) => ({ value: u.id, label: `${u.firstName} ${u.lastName}` }));
  }, [users, execRoleId]);
  const execName = (uid: string | null) => {
    if (!uid) return null;
    const u = users.find((x) => x.id === uid);
    return u ? `${u.firstName} ${u.lastName}` : `#${uid}`;
  };

  const [tab, setTab] = useState<TabKey>("interactions");
  const [assignOpen, setAssignOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function copyPhone() {
    if (!lead) return;
    try {
      await navigator.clipboard.writeText(lead.phone);
      toast({ tone: "success", title: "Teléfono copiado" });
    } catch {
      toast({ tone: "error", title: "No se pudo copiar" });
    }
  }

  async function confirmDelete() {
    if (!lead) return;
    setDeleteLoading(true);
    try {
      const res = await deleteLead(lead.id);
      toast({ tone: "success", title: res.message });
      router.push("/leads");
    } catch (err) {
      if (err instanceof ApiException && err.statusCode === 404) {
        router.push("/leads");
        return;
      }
      toast({ tone: "error", title: "No se pudo bloquear", description: errorMessage(err) });
      setDeleteLoading(false);
      setDeleting(false);
    }
  }

  const phoneDigits = lead?.phone.replace(/\D/g, "") ?? "";

  return (
    <div className="space-y-6">
      <Link
        href="/leads"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Leads
      </Link>

      {loading ? (
        <div className="space-y-6">
          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <Skeleton className="h-14 w-14 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            </CardContent>
          </Card>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-card" />
            ))}
          </div>
        </div>
      ) : error ? (
        <Card>
          {error.statusCode === 404 ? (
            <EmptyState
              title={errorMessage(error)}
              description="Es posible que haya sido bloqueado (papelera)."
              action={
                <Button variant="secondary" size="sm" onClick={() => router.push("/leads")}>
                  Volver a leads
                </Button>
              }
            />
          ) : (
            <ErrorState error={error} onRetry={refetch} />
          )}
        </Card>
      ) : lead ? (
        <>
          {/* Hero */}
          <Card>
            <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <Avatar
                  name={lead.full_name ?? lead.phone}
                  className="h-14 w-14 shrink-0 text-base"
                />
                <div className="min-w-0">
                  <h1 className="truncate font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                    {lead.full_name ?? "Lead sin nombre"}
                  </h1>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {lead.stage && <Badge tone="neutral">{lead.stage}</Badge>}
                    {lead.status && (
                      <Badge tone={leadStatusTone(lead.status)} dot>
                        {lead.status}
                      </Badge>
                    )}
                    {lead.source && <Badge tone="info">{lead.source}</Badge>}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {canAssign && (
                  <Button variant="secondary" onClick={() => setAssignOpen(true)}>
                    <UserPlus className="h-4 w-4" />
                    Asignar
                  </Button>
                )}
                {canWrite && (
                  <Button
                    variant="secondary"
                    onClick={() => router.push(`/leads/${lead.id}/editar`)}
                  >
                    <Pencil className="h-4 w-4" />
                    Editar
                  </Button>
                )}
                {canDelete && (
                  <Button variant="outline" onClick={() => setDeleting(true)}>
                    <Trash2 className="h-4 w-4 text-danger" />
                    <span className="text-danger">Bloquear</span>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Datos clave de un vistazo */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Tile
              icon={User}
              label="Ejecutivo"
              value={execName(lead.assigned_user_id) ?? "Sin asignar"}
            />
            <Tile
              icon={Clock}
              label="Último contacto"
              value={formatRelativeTime(lead.last_contact_at)}
            />
            <Tile
              icon={CalendarClock}
              label="Próximo followup"
              value={lead.next_followup_at ? formatDate(lead.next_followup_at) : "Sin programar"}
            />
          </div>

          {/* Layout: info (izq) + actividad (der) */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-1">
              {/* Contacto */}
              <Card>
                <CardContent className="space-y-4 p-5">
                  <h2 className="font-display text-sm font-semibold text-foreground">
                    Contacto
                  </h2>
                  <div className="rounded-lg border border-border bg-surface-muted/40 p-3">
                    <p className="text-xs text-subtle">Teléfono</p>
                    <p className="font-medium text-foreground">{lead.phone}</p>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      <a
                        href={`https://wa.me/${phoneDigits}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary-hover"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        WhatsApp
                      </a>
                      <a
                        href={`tel:${lead.phone}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border-strong px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        Llamar
                      </a>
                      <button
                        type="button"
                        onClick={copyPhone}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border-strong px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copiar
                      </button>
                    </div>
                  </div>
                  <dl>
                    <Row
                      label="Email"
                      value={
                        lead.email ? (
                          <a
                            href={`mailto:${lead.email}`}
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            <Mail className="h-3.5 w-3.5" />
                            {lead.email}
                          </a>
                        ) : (
                          "—"
                        )
                      }
                    />
                    <Row
                      label="Proyecto de interés"
                      value={
                        lead.project_id ? (
                          <Link
                            href={`/proyectos/${lead.project_id}`}
                            className="text-primary hover:underline"
                          >
                            {projectName(lead.project_id)}
                          </Link>
                        ) : (
                          "—"
                        )
                      }
                    />
                    <Row
                      label="Unidad de interés"
                      value={
                        lead.project_unit_id ? (
                          <Link
                            href={`/unidades/${lead.project_unit_id}`}
                            className="text-primary hover:underline"
                          >
                            Unidad #{lead.project_unit_id}
                          </Link>
                        ) : (
                          "—"
                        )
                      }
                    />
                  </dl>
                </CardContent>
              </Card>

              {/* Detalles */}
              <Card>
                <CardContent className="space-y-3 p-5">
                  <h2 className="font-display text-sm font-semibold text-foreground">
                    Detalles
                  </h2>
                  <dl>
                    <Row label="Intención" value={lead.intent ?? "—"} />
                    <Row label="Marca" value={lead.brand ?? "—"} />
                    <Row
                      label="Score"
                      value={
                        lead.score != null ? (
                          <Badge tone="primary">{lead.score}</Badge>
                        ) : (
                          "—"
                        )
                      }
                    />
                    <Row label="Notas" value={lead.notes ?? "—"} />
                    <Row label="Creado" value={formatDate(lead.created_at)} />
                    <Row label="Actualizado" value={formatDateTime(lead.updated_at)} />
                  </dl>
                </CardContent>
              </Card>
            </div>

            {/* Actividad (tabs) */}
            <div className="space-y-4 lg:col-span-2">
              <div
                role="tablist"
                aria-label="Actividad del lead"
                className="flex gap-1 overflow-x-auto rounded-card border border-border bg-surface p-1"
              >
                {TABS.map((t) => {
                  const Icon = t.icon;
                  const active = tab === t.key;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setTab(t.key)}
                      className={cn(
                        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-primary-soft text-primary"
                          : "text-muted hover:bg-surface-muted hover:text-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {t.label}
                    </button>
                  );
                })}
              </div>

              {tab === "qualification" && (
                <QualificationTab leadId={lead.id} canWrite={canWrite} canDelete={canSubDelete} />
              )}
              {tab === "interactions" && (
                <InteractionsTab leadId={lead.id} canWrite={canWrite} canDelete={canSubDelete} />
              )}
              {tab === "appointments" && (
                <AppointmentsTab leadId={lead.id} canWrite={canWrite} canDelete={canSubDelete} />
              )}
              {tab === "zones" && <ZonesTab leadId={lead.id} canWrite={canWrite} />}
              {tab === "followups" && (
                <FollowupsTab leadId={lead.id} canWrite={canWrite} canDelete={canSubDelete} />
              )}
            </div>
          </div>

          <LeadAssignDialog
            open={assignOpen}
            onClose={() => setAssignOpen(false)}
            leadIds={[lead.id]}
            executiveOptions={execOptions}
            onAssigned={() => refetch()}
          />

          <ConfirmDialog
            open={deleting}
            onClose={() => setDeleting(false)}
            onConfirm={confirmDelete}
            loading={deleteLoading}
            title="Bloquear lead"
            description="Se moverá a la papelera. Podrás restaurarlo después."
            confirmLabel="Bloquear"
          />
        </>
      ) : null}
    </div>
  );
}
