"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { ProjectForm } from "@/components/projects/project-form";

export default function NewProjectPage() {
  const router = useRouter();

  return (
    <div className="space-y-6 pb-24">
      <Link
        href="/proyectos"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Proyectos
      </Link>

      <PageHeader
        title="Nuevo proyecto"
        description="Crea un proyecto inmobiliario."
      />

      <ProjectForm
        onSaved={(saved) => router.replace(`/proyectos/${saved.id}`)}
        onCancel={() => router.push("/proyectos")}
      />
    </div>
  );
}
