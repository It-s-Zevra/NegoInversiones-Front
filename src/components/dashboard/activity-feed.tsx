import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { formatRelativeTime } from "@/lib/format";
import { RECENT_ACTIVITY } from "@/lib/mock";

export function ActivityFeed() {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Actividad reciente</CardTitle>
        <Link
          href="/auditoria"
          className="text-xs font-medium text-primary hover:underline"
        >
          Ver auditoría
        </Link>
      </CardHeader>
      <CardContent>
        <ul className="space-y-4">
          {RECENT_ACTIVITY.map((a) => (
            <li key={a.id} className="flex gap-3">
              <Avatar name={a.actor} className="h-8 w-8 text-[11px]" />
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug text-foreground">
                  <span className="font-medium">{a.actor}</span>{" "}
                  <span className="text-muted">{a.action}</span>{" "}
                  <span className="font-medium">{a.target}</span>
                </p>
                <p className="mt-0.5 text-xs text-subtle">
                  {formatRelativeTime(a.createdAt)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
