import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatCompactCurrency } from "@/lib/format";
import { SALES_BY_MONTH } from "@/lib/mock";

export function SalesChart() {
  const max = Math.max(...SALES_BY_MONTH.map((d) => d.value), 1);

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
        <div className="flex h-56 items-stretch gap-3 sm:gap-5">
          {SALES_BY_MONTH.map((d) => {
            // Mínimo 4% para que un mes con valor bajo siga siendo visible.
            const pct = Math.max(Math.round((d.value / max) * 100), 4);
            return (
              <div
                key={d.month}
                className="group flex flex-1 flex-col items-center gap-2"
              >
                <div className="relative flex w-full flex-1 items-end justify-center rounded-md bg-surface-muted">
                  <span className="pointer-events-none absolute -top-5 whitespace-nowrap text-[11px] font-semibold text-foreground opacity-0 transition-opacity group-hover:opacity-100">
                    {formatCompactCurrency(d.value)}
                  </span>
                  <div
                    className="w-full rounded-md bg-primary/85 transition-all duration-300 ease-out group-hover:bg-primary"
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
