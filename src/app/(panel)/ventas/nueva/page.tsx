"use client";

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { SaleForm } from "@/components/sales/sale-form";
import { useResource } from "@/lib/hooks/use-resource";
import { listProjects } from "@/lib/api/projects";
import type { Paginated, Project } from "@/lib/api/types";

export default function NewSalePage() {
  const router = useRouter();

  const fetchProjects = useCallback(
    (signal?: AbortSignal) =>
      listProjects(
        { page: 1, limit: 100, sortBy: "name", sortOrder: "ASC" },
        signal
      ),
    []
  );
  const { data: projectsPage } = useResource<Paginated<Project>>(
    fetchProjects,
    []
  );
  const projectOptions = useMemo(
    () => (projectsPage?.data ?? []).map((p) => ({ value: p.id, label: p.name })),
    [projectsPage]
  );

  return (
    <div className="space-y-6 pb-24">
      <Link
        href="/ventas"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Ventas
      </Link>

      <PageHeader
        title="Registrar venta"
        description="Completa los datos del cierre. Solo el lead, el proyecto y el precio son obligatorios."
      />

      <SaleForm
        projectOptions={projectOptions}
        onSaved={(saved) => router.replace(`/ventas/${saved.id}`)}
        onCancel={() => router.push("/ventas")}
      />
    </div>
  );
}
