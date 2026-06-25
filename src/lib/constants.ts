import {
  LayoutDashboard,
  Building2,
  ShoppingCart,
  Wallet,
  CalendarClock,
  BookOpen,
  Users,
  UserSearch,
  ShieldCheck,
  KeyRound,
  Plug,
  ScrollText,
  type LucideIcon,
} from "lucide-react";
import type {
  UserRole,
  Brand,
  UnitType,
  UnitStatus,
  UnitAction,
  SaleStatus,
  FinancingPlanType,
  DownPaymentType,
  InstallmentFrequency,
  AvailabilityExceptionType,
  AvailabilityExceptionEffect,
  AvailabilityExceptionStatus,
  NotificationType,
  FollowupChannel,
  FollowupStatus,
} from "./api/types";

export type BadgeTone =
  | "neutral"
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "info";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Permiso fino que habilita el módulo (referencia; el backend es la autoridad). */
  permission?: string;
  /**
   * Roles que ven el módulo. Para módulos cuyo acceso el backend resuelve por
   * ROL (o por pertenencia), no por un permiso fino — p. ej. Agendas, donde el
   * acceso a /users/:id/schedule es por propiedad o rol privilegiado y el board
   * de ejecutivos es @Roles(ADMIN, JEFE_COMERCIAL, EJECUTIVO_VENTAS). El ítem se
   * muestra si pasa AMBOS filtros (permission y roles) cuando están presentes.
   */
  roles?: UserRole[];
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

/** Navegación del panel, agrupada. */
export const NAV_SECTIONS: NavSection[] = [
  {
    items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    title: "Comercial",
    items: [
      { label: "Leads", href: "/leads", icon: UserSearch, permission: "leads:read" },
      { label: "Proyectos", href: "/proyectos", icon: Building2, permission: "projects:read" },
      { label: "Ventas", href: "/ventas", icon: ShoppingCart, permission: "sales:read" },
      { label: "Financiamiento", href: "/financiamiento", icon: Wallet, permission: "financing-plans:read" },
      // Agendas: acceso por rol/pertenencia, no por schedules:read (que el seed da
      // solo a ADMIN/JEFE_COMERCIAL). El board de ejecutivos lo autoriza
      // @Roles(ADMIN, JEFE_COMERCIAL, EJECUTIVO_VENTAS); cada quien gestiona su
      // propia disponibilidad por pertenencia. Sin esto, EJECUTIVO_VENTAS quedaba fuera.
      {
        label: "Agendas",
        href: "/agendas",
        icon: CalendarClock,
        roles: ["ADMIN", "JEFE_COMERCIAL", "EJECUTIVO_VENTAS"],
      },
      { label: "Conocimiento", href: "/conocimiento", icon: BookOpen, permission: "kb:read" },
    ],
  },
  {
    title: "Administración",
    items: [
      { label: "Usuarios", href: "/usuarios", icon: Users, permission: "users:read" },
      { label: "Roles", href: "/roles", icon: ShieldCheck, permission: "roles:read" },
      { label: "Permisos", href: "/permisos", icon: KeyRound, permission: "permissions:read" },
      { label: "Clientes API", href: "/clientes-api", icon: Plug, permission: "api-clients:read" },
      { label: "Auditoría", href: "/auditoria", icon: ScrollText, permission: "activity-log:read" },
    ],
  },
];

export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "Administrador",
  DIRECTOR_GENERAL: "Director General",
  JEFE_COMERCIAL: "Jefe Comercial",
  EJECUTIVO_VENTAS: "Ejecutivo de Ventas",
  CARTERA: "Cartera / Cobranzas",
  LEGAL: "Legal",
  FINANZAS: "Finanzas",
  PROYECTOS: "Proyectos",
};

export const BRAND_LABELS: Record<Brand, string> = {
  VISTA_VERDE: "Vista Verde",
  GONZALES_CONSTRUCTORA: "Gonzales Constructora",
  ISABELLA_CONDOMINIO: "Isabella Condominio",
};

export const UNIT_TYPE_LABELS: Record<UnitType, string> = {
  LOTE: "Lote",
  VIVIENDA: "Vivienda",
};

export const UNIT_STATUS_META: Record<
  UnitStatus,
  { label: string; tone: BadgeTone }
> = {
  DISPONIBLE: { label: "Disponible", tone: "success" },
  RESERVADO: { label: "Reservado", tone: "warning" },
  VENDIDO: { label: "Vendido", tone: "info" },
  BLOQUEADO: { label: "Bloqueado", tone: "danger" },
};

export const UNIT_ACTION_META: Record<
  UnitAction,
  { label: string; tone: BadgeTone }
> = {
  reserve: { label: "Reservar", tone: "warning" },
  sell: { label: "Vender", tone: "info" },
  block: { label: "Bloquear", tone: "danger" },
  release: { label: "Liberar", tone: "success" },
};

/**
 * Acciones de estado que conviene habilitar según el estado actual.
 * El backend NO valida transiciones (acepta cualquiera); esta es una regla de UI
 * para evitar acciones sin sentido (ver flujos unidades/04 §tabla).
 */
export const ALLOWED_UNIT_ACTIONS: Record<UnitStatus, UnitAction[]> = {
  DISPONIBLE: ["reserve", "sell", "block"],
  RESERVADO: ["sell", "release", "block"],
  VENDIDO: ["release", "block"],
  BLOQUEADO: ["release"],
};

export const SALE_STATUS_META: Record<
  SaleStatus,
  { label: string; tone: BadgeTone }
> = {
  EN_PROCESO: { label: "En proceso", tone: "warning" },
  COMPLETADA: { label: "Completada", tone: "success" },
  CANCELADA: { label: "Cancelada", tone: "danger" },
};

export const FINANCING_TYPE_LABELS: Record<FinancingPlanType, string> = {
  CONTADO: "Contado",
  CREDITO_DIRECTO: "Crédito directo",
  CREDITO_BANCARIO: "Crédito bancario",
  MIXTO: "Mixto",
};

export const DOWN_PAYMENT_TYPE_LABELS: Record<DownPaymentType, string> = {
  NONE: "Sin anticipo",
  FIXED: "Monto fijo",
  PERCENT: "Porcentaje",
};

export const FREQUENCY_LABELS: Record<InstallmentFrequency, string> = {
  MENSUAL: "Mensual",
  QUINCENAL: "Quincenal",
  SEMANAL: "Semanal",
  DIARIO: "Diario",
  ANUAL: "Anual",
};

export const DAY_OF_WEEK_LABELS: Record<number, string> = {
  0: "Domingo",
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
  6: "Sábado",
};

export const EXCEPTION_TYPE_LABELS: Record<AvailabilityExceptionType, string> = {
  VACACIONES: "Vacaciones",
  PERMISO: "Permiso",
  FERIADO: "Feriado",
  LICENCIA_MEDICA: "Licencia médica",
  EMERGENCIA: "Emergencia",
  BUSY: "Ocupado",
  NO_MOLESTAR: "No molestar",
  ON_CALL: "De guardia",
};

export const EXCEPTION_EFFECT_LABELS: Record<
  AvailabilityExceptionEffect,
  string
> = {
  BLOQUEA: "Bloquea",
  DISPONIBLE: "Disponible",
};

export const EXCEPTION_STATUS_META: Record<
  AvailabilityExceptionStatus,
  { label: string; tone: BadgeTone }
> = {
  PENDIENTE: { label: "Pendiente", tone: "warning" },
  APROBADO: { label: "Aprobado", tone: "success" },
  RECHAZADO: { label: "Rechazado", tone: "danger" },
  CANCELADO: { label: "Cancelado", tone: "neutral" },
};

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  GENERIC: "General",
  LEAD_NEW: "Nuevo lead",
  AVAILABILITY_EXCEPTION_PENDING: "Excepción pendiente",
  AVAILABILITY_EXCEPTION_APPROVED: "Excepción aprobada",
  AVAILABILITY_EXCEPTION_REJECTED: "Excepción rechazada",
};

/** Etiqueta de un enum con fallback al propio código (por si el backend agrega valores). */
export function labelFor<K extends string>(
  map: Record<K, string>,
  key: K
): string {
  return map[key] ?? key;
}

/* ---------- Leads (CRM) ----------
 * Catálogo canónico confirmado con backend (existen como enums pero el API NO
 * valida con @IsEnum: el front debe aceptar cualquier valor → sugerencias).
 */
export const LEAD_STAGE_SUGGESTIONS = [
  "RESERVA",
  "CUOTA_INICIAL",
  "CONTRATO",
  "LEGAL",
  "FINANZAS",
  "PROYECTO",
  "ARCHIVO",
] as const;

export const LEAD_STATUS_SUGGESTIONS = [
  "NUEVO",
  "ACTIVO",
  "CALIFICADO",
  "AGENDADO",
  "GANADO",
  "FRIO",
  "PERDIDO",
] as const;

export const LEAD_SOURCE_SUGGESTIONS = [
  "TIKTOK",
  "META_ADS",
  "WEB_FORM",
  "SOCIAL_COMMENT",
  "WHATSAPP_DIRECT",
  "REFERIDO",
  "OTRO",
] as const;

export const LEAD_INTENT_SUGGESTIONS = [
  "INFORMAR",
  "CALIFICAR",
  "AGENDAR",
  "CALIFICADO",
  "HUMANO",
] as const;

export const APPOINTMENT_TYPE_SUGGESTIONS = ["VISITA_LOTE", "REUNION"] as const;

export const APPOINTMENT_STATUS_SUGGESTIONS = [
  "AGENDADA",
  "CONFIRMADA",
  "REALIZADA",
  "CANCELADA",
  "REAGENDADA",
] as const;

/**
 * Cambiar el status a estos valores dispara side-effects en el backend
 * (auto-asignación + reporte IA + notificación). La UI debe confirmar antes.
 */
export const LEAD_STATUS_SIDE_EFFECTS = new Set(["CALIFICADO", "HUMANO"]);

/** Tonos conocidos para badges de status (fallback "neutral" para valores nuevos). */
const LEAD_STATUS_TONES: Record<string, BadgeTone> = {
  NUEVO: "info",
  ACTIVO: "primary",
  CALIFICADO: "primary",
  AGENDADO: "warning",
  HUMANO: "warning",
  GANADO: "success",
  FRIO: "neutral",
  PERDIDO: "danger",
};

export function leadStatusTone(status: string | null | undefined): BadgeTone {
  if (!status) return "neutral";
  return LEAD_STATUS_TONES[status] ?? "neutral";
}

const APPOINTMENT_STATUS_TONES: Record<string, BadgeTone> = {
  AGENDADA: "info",
  CONFIRMADA: "primary",
  REALIZADA: "success",
  CANCELADA: "danger",
  REAGENDADA: "warning",
};

export function appointmentStatusTone(status: string | null | undefined): BadgeTone {
  if (!status) return "neutral";
  return APPOINTMENT_STATUS_TONES[status] ?? "neutral";
}

export const FOLLOWUP_CHANNEL_LABELS: Record<FollowupChannel, string> = {
  WHATSAPP: "WhatsApp",
  WEB: "Web",
  PANEL: "Panel",
  SISTEMA: "Sistema",
};

export const FOLLOWUP_STATUS_META: Record<
  FollowupStatus,
  { label: string; tone: BadgeTone }
> = {
  PENDIENTE: { label: "Pendiente", tone: "warning" },
  ENVIADO: { label: "Enviado", tone: "info" },
  RESPONDIDO: { label: "Respondido", tone: "success" },
  OMITIDO: { label: "Omitido", tone: "neutral" },
};

/** Construye opciones para un <Select> a partir de un catálogo de sugerencias,
 * garantizando que el valor actual (libre) siempre tenga su opción. */
export function suggestionOptions(
  suggestions: readonly string[],
  current?: string | null
): { value: string; label: string }[] {
  const values = [...suggestions];
  if (current && !values.includes(current)) values.unshift(current);
  return values.map((v) => ({ value: v, label: v }));
}
