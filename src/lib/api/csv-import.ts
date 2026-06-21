/**
 * Importación masiva por CSV (asíncrona) — ver flujos:
 * proyectos/06 (unidades), ventas/06 (ventas), agendas/05 (agendas).
 *
 * Patrón común: POST multipart `file` (+ `mapping` JSON opcional) → 202 con
 * `jobId`/`statusUrl`; luego polling del GET de estado hasta `completed`/`failed`.
 * Los errores por fila NO son un error HTTP: el job termina 200 con
 * `summary.failed > 0` y `errors[]`.
 */
import { http } from "./http";

/** Límite de tamaño del archivo (5 MB) según el contrato. */
export const IMPORT_MAX_BYTES = 5 * 1024 * 1024;

export interface BulkImportAccepted {
  jobId: string;
  status: string; // "queued"
  statusUrl: string;
}

export interface ImportRowError {
  row: number;
  message: string;
}

export type ImportJobStatus =
  | "queued"
  | "active"
  | "completed"
  | "failed"
  | "unknown";

export interface BulkImportStatus {
  jobId: string;
  status: ImportJobStatus;
  progress?: number;
  summary?: { total: number; created: number; failed: number };
  errors?: ImportRowError[];
  failedReason?: string | null;
}

export interface CsvImporter {
  /** Sube el CSV y encola el job (202). */
  upload: (file: File, mapping?: string) => Promise<BulkImportAccepted>;
  /** Consulta el estado del job (polling). */
  status: (jobId: string) => Promise<BulkImportStatus>;
  /** Columnas canónicas obligatorias del CSV (para la ayuda de la UI). */
  requiredColumns: string[];
}

function uploadCsv(
  path: string,
  file: File,
  mapping?: string
): Promise<BulkImportAccepted> {
  const form = new FormData();
  form.append("file", file);
  if (mapping) form.append("mapping", mapping);
  return http.post<BulkImportAccepted>(path, form);
}

/** Construye el path de estado desde el jobId (no reusa el statusUrl crudo,
    que ya trae el prefijo /api/v1 que el cliente añade por su cuenta). */
function makeImporter(
  uploadPath: string,
  statusBase: string,
  requiredColumns: string[]
): CsvImporter {
  return {
    upload: (file, mapping) => uploadCsv(uploadPath, file, mapping),
    status: (jobId) =>
      http.get<BulkImportStatus>(`${statusBase}/${encodeURIComponent(jobId)}`),
    requiredColumns,
  };
}

/** Unidades de un proyecto (proyectos/06). Requeridas: code, type. */
export function projectUnitsImporter(projectId: string): CsvImporter {
  return makeImporter(
    `/projects/${encodeURIComponent(projectId)}/units/bulk`,
    "/projects/imports",
    ["code", "type"]
  );
}

/** Ventas históricas (ventas/06). Requeridas: lead_id, project_id, total_price. */
export const salesImporter: CsvImporter = makeImporter(
  "/sales/bulk",
  "/sales/imports",
  ["lead_id", "project_id", "total_price"]
);

/** Agendas / ventanas de disponibilidad (agendas/05).
    Requeridas: user_id, day_of_week, start_time, end_time. */
export const schedulesImporter: CsvImporter = makeImporter(
  "/schedules/bulk",
  "/schedules/imports",
  ["user_id", "day_of_week", "start_time", "end_time"]
);
