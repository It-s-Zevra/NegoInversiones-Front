/**
 * Tipos del contrato de la API del panel admin de NegoInversiones.
 * Fuente: documentación de "flujos" (request/response DTOs del backend NestJS).
 * Convenciones:
 *  - Los IDs son `string` (bigserial serializado — no convertir a number).
 *  - Montos/numéricos llegan como `string` (numeric de Postgres).
 *  - Fechas en ISO 8601 (string).
 */

/* ---------- Envelopes comunes ---------- */

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface ApiError {
  statusCode: number;
  error: string;
  message: string | string[];
  timestamp: string;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "ASC" | "DESC";
}

/* ---------- Enums del dominio ---------- */

export type UserRole =
  | "ADMIN"
  | "DIRECTOR_GENERAL"
  | "JEFE_COMERCIAL"
  | "EJECUTIVO_VENTAS"
  | "CARTERA"
  | "LEGAL"
  | "FINANZAS"
  | "PROYECTOS";

export type Brand =
  | "VISTA_VERDE"
  | "GONZALES_CONSTRUCTORA"
  | "ISABELLA_CONDOMINIO";

export type UnitType = "LOTE" | "VIVIENDA";

export type UnitStatus = "DISPONIBLE" | "RESERVADO" | "VENDIDO" | "BLOQUEADO";

export type UnitAction = "reserve" | "sell" | "block" | "release";

export type SaleStatus = "EN_PROCESO" | "COMPLETADA" | "CANCELADA";

export type FinancingPlanType =
  | "CONTADO"
  | "CREDITO_DIRECTO"
  | "CREDITO_BANCARIO"
  | "MIXTO";

export type DownPaymentType = "NONE" | "FIXED" | "PERCENT";

export type InstallmentFrequency =
  | "MENSUAL"
  | "QUINCENAL"
  | "SEMANAL"
  | "DIARIO"
  | "ANUAL";

export type AvailabilityExceptionType =
  | "VACACIONES"
  | "PERMISO"
  | "FERIADO"
  | "LICENCIA_MEDICA"
  | "EMERGENCIA"
  | "BUSY"
  | "NO_MOLESTAR"
  | "ON_CALL";

export type AvailabilityExceptionEffect = "BLOQUEA" | "DISPONIBLE";

export type AvailabilityExceptionStatus =
  | "PENDIENTE"
  | "APROBADO"
  | "RECHAZADO"
  | "CANCELADO";

export type NotificationType =
  | "GENERIC"
  | "LEAD_NEW"
  | "AVAILABILITY_EXCEPTION_PENDING"
  | "AVAILABILITY_EXCEPTION_APPROVED"
  | "AVAILABILITY_EXCEPTION_REJECTED";

export type NotificationPriority = "LOW" | "NORMAL" | "HIGH";

export type KbSource = "MANUAL" | "AI_DRAFT" | "IMPORT";

export type ActorType = "FRONTEND" | "N8N" | "AGENT" | "SYSTEM";

/* ---------- Auth ---------- */

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresIn: number; // segundos de validez del access token
}

export interface MeResponse {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  role: UserRole;
  department: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  img: string | null;
}

/* ---------- Usuarios ---------- */

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  roleId: string;
  department: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  img: string | null;
  createdAt: string;
  updatedAt: string;
}

/* ---------- Roles / Permisos ---------- */

export interface Permission {
  id: string;
  code: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Role {
  id: string;
  code: UserRole;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RoleDetail extends Role {
  permissions: Permission[];
}

/* ---------- Clientes de API / Scopes ---------- */

export interface ApiScope {
  id: string;
  code: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiClient {
  id: string;
  name: string;
  keyPrefix: string;
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiClientDetail extends ApiClient {
  scopes: ApiScope[];
}

export interface ApiClientCreated extends ApiClientDetail {
  apiKey: string; // se muestra UNA sola vez
}

/* ---------- Conocimiento (KB) ---------- */

export interface KbCategory {
  id: string;
  code: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface KbTag {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface KbEntry {
  id: string;
  title: string;
  content: string;
  categoryId: string | null;
  category: { id: string; code: string; name: string } | null;
  projectId: string | null;
  brand: Brand | null;
  isActive: boolean;
  priority: number;
  source: KbSource | null;
  mediaUrls: string[] | null;
  tags: { id: string; name: string }[];
  createdByUserId: string | null;
  updatedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

/* ---------- Agendas / Disponibilidad ---------- */

export interface Schedule {
  id: string;
  userId: string;
  dayOfWeek: number; // 0=Dom .. 6=Sáb
  startTime: string; // HH:MM:SS
  endTime: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AvailabilityException {
  id: string;
  userId: string | null; // null = global (empresa)
  type: AvailabilityExceptionType;
  effect: AvailabilityExceptionEffect;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  isAllDay: boolean;
  startTime: string | null;
  endTime: string | null;
  reason: string | null;
  notes: string | null;
  status: AvailabilityExceptionStatus;
  requestedByUserId: string | null;
  approvedByUserId: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExecutiveAvailability {
  executiveId: string;
  executiveName: string;
  days: {
    date: string;
    dayOfWeek: number;
    available: boolean;
    windows: { start: string; end: string }[];
  }[];
}

export interface ExecutivesAvailability {
  from: string;
  to: string;
  executives: ExecutiveAvailability[];
}

/** Disponibilidad efectiva de un usuario en una fecha (ver flujos/agendas/12). */
export interface AvailabilityResolution {
  date: string;
  dayOfWeek: number;
  available: boolean;
  windows: { start: string; end: string }[];
  appliedExceptions: AvailabilityException[];
}

/* ---------- Proyectos ---------- */

export interface Project {
  id: string;
  name: string;
  brand: Brand;
  type: UnitType;
  location: string | null;
  city: string | null;
  description: string | null;
  totalUnits: number | null;
  metadata: Record<string, unknown> | null;
  imgUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/* ---------- Unidades ---------- */

export interface Unit {
  id: string;
  projectId: string;
  code: string;
  type: UnitType;
  status: UnitStatus;
  areaM2: string | null;
  price: string | null;
  currency: string;
  bedrooms: number | null;
  bathrooms: number | null;
  builtAreaM2: string | null;
  frontageM: string | null;
  depthM: string | null;
  hasUtilities: boolean | null;
  imgUrl: string[] | null;
  location: string | null;
  address1: string | null;
  address2: string | null;
  references: string | null;
  financingPlanId: string | null;
  createdAt: string;
  updatedAt: string;
}

/* ---------- Ventas ---------- */

export interface Sale {
  id: string;
  leadId: string;
  unitId: string | null;
  projectId: string;
  executiveId: string | null;
  status: SaleStatus;
  totalPrice: string;
  currency: string;
  downPayment: string | null;
  contractDate: string | null;
  financingTermMonths: number | null;
  interestRate: string | null;
  agreements: string | null;
  createdAt: string;
  updatedAt: string;
}

/* ---------- Financiamiento ---------- */

export interface FinancingPlan {
  id: string;
  name: string;
  description: string | null;
  type: FinancingPlanType;
  currency: string;
  downPaymentType: DownPaymentType;
  downPaymentRequired: string | null;
  downPaymentPercent: string | null;
  installmentsCount: number | null;
  installmentAmount: string | null;
  frequency: InstallmentFrequency;
  termMonths: number | null;
  interestRate: string | null;
  cashDiscountPercent: string | null;
  minAmount: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/* ---------- Auditoría ---------- */

export interface ActivityLogEntry {
  id: string;
  actorType: ActorType;
  action: string;
  actorUserId: string | null;
  apiClientId: string | null;
  entityType: string | null;
  entityId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

/* ---------- Notificaciones ---------- */

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  description: string | null;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  priority: NotificationPriority;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}
