import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { KpiData } from "@/lib/mock";

export function StatCard({ kpi }: { kpi: KpiData }) {
  const trend = kpi.delta > 0 ? "up" : kpi.delta < 0 ? "down" : "flat";
  const TrendIcon =
    trend === "up" ? ArrowUpRight : trend === "down" ? ArrowDownRight : Minus;

  return (
    <Card className="p-5">
      <p className="text-sm text-muted">{kpi.label}</p>
      <div className="mt-2 flex items-end justify-between gap-2">
        <p className="font-display text-2xl font-semibold tracking-tight text-foreground">
          {kpi.value}
        </p>
        <span
          className={cn(
            "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium",
            trend === "up" && "bg-success-soft text-success",
            trend === "down" && "bg-danger-soft text-danger",
            trend === "flat" && "bg-surface-muted text-muted"
          )}
        >
          <TrendIcon className="h-3 w-3" />
          {Math.abs(kpi.delta)}%
        </span>
      </div>
      <p className="mt-2 text-xs text-subtle">{kpi.hint}</p>
    </Card>
  );
}
