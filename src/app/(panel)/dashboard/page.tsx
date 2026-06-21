import type { Metadata } from "next";
import { Download, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/dashboard/stat-card";
import { SalesChart } from "@/components/dashboard/sales-chart";
import { UnitsBreakdown } from "@/components/dashboard/units-breakdown";
import { RecentSales } from "@/components/dashboard/recent-sales";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { KPIS } from "@/lib/mock";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Resumen comercial de NegoInversiones."
        actions={
          <>
            <Button variant="secondary" size="md">
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Exportar</span>
            </Button>
            <Button size="md">
              <Plus className="h-4 w-4" />
              Nueva venta
            </Button>
          </>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {KPIS.map((kpi) => (
          <StatCard key={kpi.key} kpi={kpi} />
        ))}
      </div>

      {/* Gráfico + inventario */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SalesChart />
        </div>
        <UnitsBreakdown />
      </div>

      {/* Ventas recientes + actividad */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentSales />
        </div>
        <ActivityFeed />
      </div>
    </div>
  );
}
