import { Hammer } from "lucide-react";
import { NAV_SECTIONS } from "@/lib/constants";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";

// Placeholder para los módulos aún no implementados (las rutas reales lo sustituyen).
const MODULE_LABELS: Record<string, string> = Object.fromEntries(
  NAV_SECTIONS.flatMap((s) => s.items).map((i) => [
    i.href.replace(/^\//, ""),
    i.label,
  ])
);

export default async function ModulePlaceholder({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module } = await params;
  const label =
    MODULE_LABELS[module] ??
    module.charAt(0).toUpperCase() + module.slice(1).replace(/-/g, " ");

  return (
    <div className="space-y-6">
      <PageHeader title={label} description="Módulo en construcción." />
      <Card className="flex flex-col items-center gap-3 px-6 py-16 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-surface-muted text-subtle">
          <Hammer className="h-5 w-5" />
        </div>
        <p className="text-sm font-medium text-foreground">Próximamente</p>
        <p className="max-w-sm text-sm text-muted">
          Este módulo se construirá en las siguientes fases. La autenticación, el
          shell y el cliente de API ya están listos para conectarlo.
        </p>
      </Card>
    </div>
  );
}
