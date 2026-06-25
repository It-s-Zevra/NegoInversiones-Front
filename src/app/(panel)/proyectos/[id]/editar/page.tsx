"use client";

import { useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, SearchX } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, EmptyState } from "@/components/ui/states";
import { PageHeader } from "@/components/ui/page-header";
import { ProjectForm } from "@/components/projects/project-form";
import { useResource } from "@/lib/hooks/use-resource";
import { getProject } from "@/lib/api/projects";
import { errorMessage } from "@/lib/api/errors";
import type { Project } from "@/lib/api/types";

export default function EditProjectPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();

  const fetchProject = useCallback(
    (signal?: AbortSignal) => getProject(id, signal),
    [id],
  );
  const {
    data: project,
    loading,
    error,
    refetch,
  } = useResource<Project>(fetchProject, [id]);

  return (
    <div className="space-y-6 pb-24">
      <Link
        href={`/proyectos/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver al proyecto
      </Link>

      <PageHeader
        title="Editar proyecto"
        description="Actualiza los datos del proyecto."
      />

      {loading ? (
        <Card>
          <CardContent className="space-y-4 pt-5">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-10 w-full" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          {error.statusCode === 404 ? (
            <EmptyState
              icon={<SearchX className="h-5 w-5" />}
              title={errorMessage(error)}
              description="Es posible que haya sido eliminado."
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => router.push("/proyectos")}
                >
                  Volver a proyectos
                </Button>
              }
            />
          ) : (
            <ErrorState error={error} onRetry={refetch} />
          )}
        </Card>
      ) : project ? (
        <ProjectForm
          project={project}
          onSaved={(saved) => router.replace(`/proyectos/${saved.id}`)}
          onCancel={() => router.back()}
          onNotFound={() => router.push("/proyectos")}
        />
      ) : null}
    </div>
  );
}
