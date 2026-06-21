import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BRAND_LABELS, SALE_STATUS_META } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/format";
import { RECENT_SALES } from "@/lib/mock";

export function RecentSales() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ventas recientes</CardTitle>
        <Link
          href="/ventas"
          className="text-xs font-medium text-primary hover:underline"
        >
          Ver todas
        </Link>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {/* Tabla en desktop */}
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-border text-left text-xs text-subtle">
                <th className="px-5 py-2.5 font-medium">Unidad</th>
                <th className="px-5 py-2.5 font-medium">Ejecutivo</th>
                <th className="px-5 py-2.5 font-medium">Estado</th>
                <th className="px-5 py-2.5 font-medium">Fecha</th>
                <th className="px-5 py-2.5 text-right font-medium">Monto</th>
              </tr>
            </thead>
            <tbody>
              {RECENT_SALES.map((s) => (
                <tr
                  key={s.id}
                  className="border-b border-border last:border-0 hover:bg-surface-muted"
                >
                  <td className="px-5 py-3">
                    <p className="font-medium text-foreground">{s.unitCode}</p>
                    <p className="text-xs text-muted">{BRAND_LABELS[s.brand]}</p>
                  </td>
                  <td className="px-5 py-3 text-muted">{s.executive}</td>
                  <td className="px-5 py-3">
                    <Badge tone={SALE_STATUS_META[s.status].tone} dot>
                      {SALE_STATUS_META[s.status].label}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 text-muted">
                    {formatDate(s.contractDate)}
                  </td>
                  <td className="px-5 py-3 text-right font-medium text-foreground">
                    {formatCurrency(s.totalPrice, s.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Lista en móvil */}
        <ul className="divide-y divide-border sm:hidden">
          {RECENT_SALES.map((s) => (
            <li key={s.id} className="flex items-center justify-between px-5 py-3">
              <div className="min-w-0">
                <p className="font-medium text-foreground">{s.unitCode}</p>
                <p className="truncate text-xs text-muted">
                  {s.executive} · {formatDate(s.contractDate)}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-sm font-medium text-foreground">
                  {formatCurrency(s.totalPrice, s.currency)}
                </span>
                <Badge tone={SALE_STATUS_META[s.status].tone}>
                  {SALE_STATUS_META[s.status].label}
                </Badge>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
