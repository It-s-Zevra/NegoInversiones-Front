import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { DashboardActions } from "@/components/dashboard/dashboard-actions";
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
        actions={<DashboardActions />}
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
