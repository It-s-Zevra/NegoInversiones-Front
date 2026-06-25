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
import { SaleForm } from "@/components/sales/sale-form";
import { useResource } from "@/lib/hooks/use-resource";
import { getSale } from "@/lib/api/sales";
import { listProjects } from "@/lib/api/projects";
import { errorMessage } from "@/lib/api/errors";
import type { Paginated, Project, Sale } from "@/lib/api/types";

export default function EditSalePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();

  const fetchSale = useCallback(
    (signal?: AbortSignal) => getSale(id, signal),
    [id]
  );
  const { data: sale, loading, error, refetch } = useResource<Sale>(fetchSale, [
    id,
  ]);

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
        href={`/ventas/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a la venta
      </Link>

      <PageHeader
        title="Editar venta"
        description="Actualiza el estado y las condiciones de la venta."
      />

      {loading ? (
        <Card>
          <CardContent className="space-y-4 pt-5">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-4 w-28" />
            <div className="space-y-3 pt-4">
              {Array.from({ length: 7 }).map((_, i) => (
                <Skeleton key={i} className="h-5 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          {error.statusCode === 404 ? (
            <EmptyState
              title={errorMessage(error)}
              description="Es posible que haya sido eliminada."
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => router.push("/ventas")}
                >
                  Volver a ventas
                </Button>
              }
            />
          ) : (
            <ErrorState error={error} onRetry={refetch} />
          )}
        </Card>
      ) : sale ? (
        <SaleForm
          sale={sale}
          projectOptions={projectOptions}
          onSaved={(saved) => router.replace(`/ventas/${saved.id}`)}
          onCancel={() => router.back()}
          onNotFound={() => router.push("/ventas")}
        />
      ) : null}
    </div>
  );
}
