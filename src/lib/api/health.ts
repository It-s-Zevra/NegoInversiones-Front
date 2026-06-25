/**
 * Healthcheck (GET /health). A diferencia del resto, va SIN el prefijo /api/v1
 * y SIN token (endpoint público). Por eso usa fetch directo y no el cliente http.
 */
import { API_BASE_URL } from "./config";

export interface HealthStatus {
  status: string;
  timestamp: string;
  uptime: number;
}

export async function getHealth(signal?: AbortSignal): Promise<HealthStatus> {
  const res = await fetch(`${API_BASE_URL}/health`, { signal });
  if (!res.ok) throw new Error(`health ${res.status}`);
  return res.json() as Promise<HealthStatus>;
}
