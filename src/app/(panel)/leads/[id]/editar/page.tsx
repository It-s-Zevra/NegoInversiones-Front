"use client";

import { useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, EmptyState } from "@/components/ui/states";
import { LeadForm } from "@/components/leads/lead-form";
import { useResource } from "@/lib/hooks/use-resource";
import { getLead } from "@/lib/api/leads";
import { listProjects } from "@/lib/api/projects";
import { listUsers } from "@/lib/api/users";
import { listRoles } from "@/lib/api/roles";
import { errorMessage } from "@/lib/api/errors";
import type { Lead, Paginated, Project, Role, User } from "@/lib/api/types";

export default function LeadEditPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();

  const fetchLead = useCallback((s?: AbortSignal) => getLead(id, s), [id]);
  const { data: lead, loading, error, refetch } = useResource<Lead>(fetchLead, [id]);

  // Proyectos para el selector de interés.
  const fetchProjects = useCallback(
    (s?: AbortSignal) =>
      listProjects({ page: 1, limit: 100, sortBy: "name", sortOrder: "ASC" }, s),
    []
  );
  const { data: projectsPage } = useResource<Paginated<Project>>(fetchProjects, []);
  const projects = useMemo(() => projectsPage?.data ?? [], [projectsPage]);
  const projectOptions = useMemo(
    () => projects.map((p) => ({ value: p.id, label: p.name })),
    [projects]
  );

  // Ejecutivos (rol EJECUTIVO_VENTAS). El filtro de /users es por roleId numérico,
  // así que resolvemos el id desde /roles.
  const fetchUsers = useCallback(
    (s?: AbortSignal) =>
      listUsers({ page: 1, limit: 100, sortBy: "firstName", sortOrder: "ASC" }, s),
    []
  );
  const { data: usersPage } = useResource<Paginated<User>>(fetchUsers, []);
  const users = useMemo(() => usersPage?.data ?? [], [usersPage]);

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

  return (
    <div className="space-y-6 pb-24">
      <Link
        href={`/leads/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver al lead
      </Link>

      <PageHeader
        title="Editar lead"
        description="Actualiza los datos, la etapa o el estado del lead."
      />

      {loading ? (
        <Card>
          <CardContent className="space-y-4 pt-5">
            <Skeleton className="h-7 w-48" />
            <div className="space-y-3 pt-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
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
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => router.push("/leads")}
                >
                  Volver a leads
                </Button>
              }
            />
          ) : (
            <ErrorState error={error} onRetry={refetch} />
          )}
        </Card>
      ) : lead ? (
        <LeadForm
          lead={lead}
          projectOptions={projectOptions}
          executiveOptions={execOptions}
          onSaved={(saved) => router.replace(`/leads/${saved.id}`)}
          onCancel={() => router.back()}
          onNotFound={() => router.push("/leads")}
        />
      ) : null}
    </div>
  );
}
