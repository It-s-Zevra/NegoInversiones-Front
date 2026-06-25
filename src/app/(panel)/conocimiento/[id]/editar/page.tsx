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
import { KbEntryForm } from "@/components/kb/kb-entry-form";
import { useResource } from "@/lib/hooks/use-resource";
import { useAuth } from "@/lib/auth/auth-context";
import { getKbEntry, listKbCategories, listKbTags } from "@/lib/api/kb";
import { listProjects } from "@/lib/api/projects";
import { errorMessage } from "@/lib/api/errors";
import type { KbEntry, KbCategory, KbTag, Paginated, Project } from "@/lib/api/types";

export default function EditKbEntryPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const { can } = useAuth();
  const canWrite = can("kb:write");

  const fetchEntry = useCallback((s?: AbortSignal) => getKbEntry(id, s), [id]);
  const { data: entry, loading, error, refetch } = useResource<KbEntry>(fetchEntry, [id]);

  const catFetcher = useCallback((s?: AbortSignal) => listKbCategories(s), []);
  const { data: categories } = useResource<KbCategory[]>(catFetcher, []);
  const tagFetcher = useCallback((s?: AbortSignal) => listKbTags(s), []);
  const { data: tags } = useResource<KbTag[]>(tagFetcher, []);
  const projFetcher = useCallback(
    (s?: AbortSignal) =>
      listProjects({ page: 1, limit: 100, sortBy: "name", sortOrder: "ASC" }, s),
    []
  );
  const { data: projectsPage } = useResource<Paginated<Project>>(projFetcher, []);
  const projectOptions = useMemo(
    () => (projectsPage?.data ?? []).map((p) => ({ value: p.id, label: p.name })),
    [projectsPage]
  );

  return (
    <div className="space-y-6 pb-24">
      <Link
        href={`/conocimiento/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a la entrada
      </Link>

      <PageHeader
        title="Editar entrada"
        description="Actualiza el contenido y la clasificación de esta entrada."
      />

      {loading ? (
        <Card>
          <CardContent className="space-y-4 pt-5">
            <Skeleton className="h-7 w-2/3" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-40 w-full" />
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
                  onClick={() => router.push("/conocimiento")}
                >
                  Volver a conocimiento
                </Button>
              }
            />
          ) : (
            <ErrorState error={error} onRetry={refetch} />
          )}
        </Card>
      ) : entry ? (
        <KbEntryForm
          entry={entry}
          categories={categories ?? []}
          tags={tags ?? []}
          projectOptions={projectOptions}
          canWrite={canWrite}
          onSaved={(saved) => router.replace(`/conocimiento/${saved.id}`)}
          onCancel={() => router.back()}
          onNotFound={() => router.push("/conocimiento")}
        />
      ) : null}
    </div>
  );
}
