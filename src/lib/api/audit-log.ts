/** Servicio de Auditoría (activity-log). Solo lectura, orden fijo por created_at DESC. */
import { http } from "./http";
import { ENDPOINTS } from "./config";
import type { Paginated, ActivityLogEntry } from "./types";
import type { ListQuery } from "@/lib/hooks/use-list";

export function listActivityLog(
  query: ListQuery,
  signal?: AbortSignal
): Promise<Paginated<ActivityLogEntry>> {
  return http.get<Paginated<ActivityLogEntry>>(ENDPOINTS.activityLog, {
    query,
    signal,
  });
}
