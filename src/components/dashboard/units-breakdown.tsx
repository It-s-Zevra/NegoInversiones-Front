import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { UNIT_STATUS_META } from "@/lib/constants";
import { UNITS_BY_STATUS } from "@/lib/mock";
import { formatNumber } from "@/lib/format";
import type { UnitStatus } from "@/lib/api/types";

const BAR_COLOR: Record<UnitStatus, string> = {
  DISPONIBLE: "bg-success",
  RESERVADO: "bg-warning",
  VENDIDO: "bg-info",
  BLOQUEADO: "bg-danger",
};

export function UnitsBreakdown() {
  const total = UNITS_BY_STATUS.reduce((acc, u) => acc + u.count, 0);

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Inventario de unidades</CardTitle>
          <p className="mt-0.5 text-xs text-muted">
            {formatNumber(total)} unidades en total
          </p>
        </div>
      </CardHeader>
      <CardContent>
        {/* Barra apilada */}
        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-surface-muted">
          {UNITS_BY_STATUS.map((u) => (
            <div
              key={u.status}
              className={BAR_COLOR[u.status]}
              style={{ width: `${(u.count / total) * 100}%` }}
              title={`${UNIT_STATUS_META[u.status].label}: ${u.count}`}
            />
          ))}
        </div>

        {/* Leyenda */}
        <ul className="mt-5 grid grid-cols-2 gap-4">
          {UNITS_BY_STATUS.map((u) => (
            <li key={u.status} className="flex items-center gap-2.5">
              <span
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${BAR_COLOR[u.status]}`}
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {formatNumber(u.count)}
                </p>
                <p className="truncate text-xs text-muted">
                  {UNIT_STATUS_META[u.status].label}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
