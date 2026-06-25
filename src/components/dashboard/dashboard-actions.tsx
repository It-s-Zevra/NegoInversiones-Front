"use client";

import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DashboardActions() {
  const router = useRouter();
  return (
    <Button size="md" onClick={() => router.push("/ventas/nueva")}>
      <Plus className="h-4 w-4" />
      Nueva venta
    </Button>
  );
}
