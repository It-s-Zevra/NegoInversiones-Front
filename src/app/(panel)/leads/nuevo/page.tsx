"use client";

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { LeadForm } from "@/components/leads/lead-form";
import { useResource } from "@/lib/hooks/use-resource";
import { listProjects } from "@/lib/api/projects";
import { listUsers } from "@/lib/api/users";
import { listRoles } from "@/lib/api/roles";
import type { Paginated, Project, Role, User } from "@/lib/api/types";

export default function LeadCreatePage() {
  const router = useRouter();

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
        href="/leads"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Leads
      </Link>

      <PageHeader
        title="Nuevo lead"
        description="Registra un contacto que llegó por fuera de WhatsApp."
      />

      <LeadForm
        projectOptions={projectOptions}
        executiveOptions={execOptions}
        onSaved={(saved) => router.replace(`/leads/${saved.id}`)}
        onCancel={() => router.push("/leads")}
      />
    </div>
  );
}
