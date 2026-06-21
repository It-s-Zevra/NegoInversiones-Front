/** Servicio de notificaciones del usuario autenticado (acceso por pertenencia). */
import { http } from "./http";
import { ENDPOINTS } from "./config";
import type { Paginated, Notification } from "./types";
import type { ListQuery } from "@/lib/hooks/use-list";

export function getUnreadCount(): Promise<{ count: number }> {
  return http.get<{ count: number }>(`${ENDPOINTS.notifications}/unread-count`);
}

export function listNotifications(
  query: ListQuery,
  signal?: AbortSignal
): Promise<Paginated<Notification>> {
  return http.get<Paginated<Notification>>(ENDPOINTS.notifications, {
    query,
    signal,
  });
}

export function markNotificationRead(id: string): Promise<{ message: string }> {
  return http.patch<{ message: string }>(
    `${ENDPOINTS.notifications}/${encodeURIComponent(id)}/read`
  );
}

export function markAllNotificationsRead(): Promise<{ updated: number }> {
  return http.patch<{ updated: number }>(
    `${ENDPOINTS.notifications}/read-all`
  );
}
