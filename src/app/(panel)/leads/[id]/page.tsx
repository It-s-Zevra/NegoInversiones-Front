"use client";

import { useCallback, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pencil, Trash2, UserPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import type { Lead, Paginated, Project, Role, User } from "@/lib/api/types";

type TabKey = "qualification" | "interactions" | "appointments" | "zones" | "followups";
const TABS: { key: TabKey; label: string }[] = [
  { key: "qualification", label: "Calificación" },
  { key: "interactions", label: "Interacciones" },
  { key: "appointments", label: "Citas" },
  { key: "zones", label: "Zonas" },
  { key: "followups", label: "Followups" },
];

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-border py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-sm font-medium text-foreground sm:text-right">{value}</dd>
    </div>
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
  const { data: usersPage } = useResource<Paginated<User>>(fetchUsers, []);
  const users = useMemo(() => usersPage?.data ?? [], [usersPage]);

  // Ejecutivos (rol EJECUTIVO_VENTAS) para el combobox de asignación.
  const rolesFetcher = useCallback((s?: AbortSignal) => listRoles(s), []);
  const { data: roles } = useResource<Role[]>(rolesFetcher, []);
  const execRoleId = useMemo(
    () => (roles ?? []).find((r) => r.code === "EJECUTIVO_VENTAS")?.id,
    [roles]
  );
  const execOptions = useMemo(() => {
    const pool = execRoleId
      ? users.filter((u) => u.roleId === execRoleId)
      : users;
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
        <Card>
          <CardContent className="space-y-4 pt-5">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-32" />
            <div className="space-y-3 pt-4">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-5 w-full" />)}
            </div>
          </CardContent>
        </Card>
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
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h1 className="font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                {lead.full_name ?? lead.phone}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {lead.stage && <Badge tone="neutral">{lead.stage}</Badge>}
                {lead.status && (
                  <Badge tone={leadStatusTone(lead.status)} dot>
                    {lead.status}
                  </Badge>
                )}
                <span className="text-sm text-muted">{lead.phone}</span>
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
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Datos del lead</CardTitle>
            </CardHeader>
            <CardContent>
              <dl>
                <Row label="Email" value={lead.email ?? "—"} />
                <Row label="Fuente" value={lead.source ?? "—"} />
                <Row label="Intención" value={lead.intent ?? "—"} />
                <Row label="Marca" value={lead.brand ?? "—"} />
                <Row label="Score" value={lead.score ?? "—"} />
                <Row label="Ejecutivo" value={execName(lead.assigned_user_id) ?? "—"} />
                <Row
                  label="Proyecto"
                  value={
                    lead.project_id ? (
                      <Link href={`/proyectos/${lead.project_id}`} className="text-primary hover:underline">
                        {projectName(lead.project_id)}
                      </Link>
                    ) : (
                      "—"
                    )
                  }
                />
                <Row
                  label="Unidad"
                  value={
                    lead.project_unit_id ? (
                      <Link href={`/unidades/${lead.project_unit_id}`} className="text-primary hover:underline">
                        Unidad #{lead.project_unit_id}
                      </Link>
                    ) : (
                      "—"
                    )
                  }
                />
                <Row label="Último contacto" value={formatRelativeTime(lead.last_contact_at)} />
                <Row label="Próximo followup" value={formatDate(lead.next_followup_at)} />
                <Row label="Notas" value={lead.notes ?? "—"} />
                <Row label="Creado" value={formatDate(lead.created_at)} />
                <Row label="Actualizado" value={formatDateTime(lead.updated_at)} />
              </dl>
            </CardContent>
          </Card>

          {/* Tabs */}
          <div
            role="tablist"
            aria-label="Sub-recursos del lead"
            className="flex flex-wrap gap-1 border-b border-border"
          >
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                  tab === t.key
                    ? "border-primary text-primary"
                    : "border-transparent text-muted hover:text-foreground"
                )}
              >
                {t.label}
              </button>
            ))}
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
