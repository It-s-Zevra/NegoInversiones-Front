"use client";

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { KbEntryForm } from "@/components/kb/kb-entry-form";
import { useResource } from "@/lib/hooks/use-resource";
import { useAuth } from "@/lib/auth/auth-context";
import { listKbCategories, listKbTags } from "@/lib/api/kb";
import { listProjects } from "@/lib/api/projects";
import type { KbCategory, KbTag, Paginated, Project } from "@/lib/api/types";

export default function NewKbEntryPage() {
  const router = useRouter();
  const { can } = useAuth();
  const canWrite = can("kb:write");

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
        href="/conocimiento"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Conocimiento
      </Link>

      <PageHeader
        title="Nueva entrada"
        description="Crea una entrada para la base de conocimiento del agente. Puedes redactarla con IA."
      />

      <KbEntryForm
        categories={categories ?? []}
        tags={tags ?? []}
        projectOptions={projectOptions}
        canWrite={canWrite}
        onSaved={(saved) => router.replace(`/conocimiento/${saved.id}`)}
        onCancel={() => router.push("/conocimiento")}
      />
    </div>
  );
}
