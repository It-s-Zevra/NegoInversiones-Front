import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatCompactCurrency } from "@/lib/format";
import { SALES_BY_MONTH } from "@/lib/mock";

export function SalesChart() {
  const max = Math.max(...SALES_BY_MONTH.map((d) => d.value));

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Ventas por mes</CardTitle>
          <p className="mt-0.5 text-xs text-muted">Últimos 6 meses · USD</p>
        </div>
        <span className="text-xs font-medium text-muted">2026</span>
      </CardHeader>
      <CardContent>
        <div className="flex h-52 items-end gap-2 sm:gap-4">
          {SALES_BY_MONTH.map((d) => {
            const pct = Math.round((d.value / max) * 100);
            return (
              <div
                key={d.month}
                className="group flex flex-1 flex-col items-center gap-2"
              >
                <span className="text-[11px] font-medium text-foreground opacity-0 transition-opacity group-hover:opacity-100">
                  {formatCompactCurrency(d.value)}
                </span>
                <div className="flex w-full flex-1 items-end rounded-t-md bg-surface-muted">
                  <div
                    className="w-full rounded-t-md bg-primary opacity-80 transition-all group-hover:opacity-100"
                    style={{ height: `${pct}%` }}
                  />
                </div>
                <span className="text-xs text-muted">{d.month}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
