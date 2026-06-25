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

/** Descriptor legible de una columna del CSV para la ayuda de la UI. */
export interface CsvColumn {
  /** Nombre canónico que espera el backend (clave del mapping). */
  key: string;
  /** Nombre claro en español para mostrar al usuario. */
  label: string;
  /** Ejemplo de valor para orientar al usuario. */
  example?: string;
  /** Si la columna es obligatoria. */
  required: boolean;
}

export interface CsvImporter {
  /** Sube el CSV y encola el job (202). */
  upload: (file: File, mapping?: string) => Promise<BulkImportAccepted>;
  /** Consulta el estado del job (polling). */
  status: (jobId: string) => Promise<BulkImportStatus>;
  /** Columnas del CSV (legibles) para el mapeador visual de la UI. */
  columns: CsvColumn[];
  /** Columnas canónicas obligatorias del CSV (derivado de `columns`). */
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
    que ya trae el prefijo /api/v1 que el cliente añade por su cuenta).
    `requiredColumns` se deriva de `columns` para no duplicar la verdad. */
function makeImporter(
  uploadPath: string,
  statusBase: string,
  columns: CsvColumn[]
): CsvImporter {
  return {
    upload: (file, mapping) => uploadCsv(uploadPath, file, mapping),
    status: (jobId) =>
      http.get<BulkImportStatus>(`${statusBase}/${encodeURIComponent(jobId)}`),
    columns,
    requiredColumns: columns.filter((c) => c.required).map((c) => c.key),
  };
}

/** Unidades de un proyecto (proyectos/06). Requeridas: code, type. */
export function projectUnitsImporter(projectId: string): CsvImporter {
  return makeImporter(
    `/projects/${encodeURIComponent(projectId)}/units/bulk`,
    "/projects/imports",
    [
      { key: "code", label: "Código de la unidad", example: "L-01", required: true },
      { key: "type", label: "Tipo: LOTE o VIVIENDA", example: "LOTE", required: true },
      { key: "price", label: "Precio", example: "25000", required: false },
      { key: "currency", label: "Moneda", example: "USD", required: false },
      { key: "area_m2", label: "Área m²", example: "360", required: false },
    ]
  );
}

/** Ventas históricas (ventas/06). Requeridas: lead_id, project_id, total_price. */
export const salesImporter: CsvImporter = makeImporter(
  "/sales/bulk",
  "/sales/imports",
  [
    { key: "lead_id", label: "ID del lead", example: "120", required: true },
    { key: "project_id", label: "ID del proyecto", example: "5", required: true },
    { key: "total_price", label: "Precio total", example: "25000", required: true },
  ]
);

/** Agendas / ventanas de disponibilidad (agendas/05).
    Requeridas: user_id, day_of_week, start_time, end_time. */
export const schedulesImporter: CsvImporter = makeImporter(
  "/schedules/bulk",
  "/schedules/imports",
  [
    { key: "user_id", label: "ID del usuario", example: "3", required: true },
    {
      key: "day_of_week",
      label: "Día de la semana (0=Dom .. 6=Sáb)",
      example: "1",
      required: true,
    },
    { key: "start_time", label: "Hora inicio (HH:MM)", example: "09:00", required: true },
    { key: "end_time", label: "Hora fin (HH:MM)", example: "18:00", required: true },
  ]
);
