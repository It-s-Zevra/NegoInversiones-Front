/**
 * Datos de ejemplo SOLO para maquetar el dashboard mientras no hay backend.
 * Reemplazar por llamadas reales a la API (ver src/lib/api) al integrar flujos.
 */
import type {
  UserRole,
  UnitStatus,
  SaleStatus,
  Brand,
} from "@/lib/api/types";

export const CURRENT_USER: {
  name: string;
  role: UserRole;
  img: string | null;
} = {
  name: "Admin Nego",
  role: "ADMIN",
  img: null,
};

export const UNREAD_NOTIFICATIONS = 3;

export interface KpiData {
  key: string;
  label: string;
  value: string;
  delta: number; // variación % vs período anterior
  hint: string;
}

export const KPIS: KpiData[] = [
  { key: "sales", label: "Ventas del mes", value: "$486K", delta: 12.5, hint: "18 ventas cerradas" },
  { key: "pipeline", label: "En proceso", value: "$212K", delta: 4.2, hint: "9 ventas activas" },
  { key: "units", label: "Unidades disponibles", value: "143", delta: -6.1, hint: "de 320 totales" },
  { key: "projects", label: "Proyectos activos", value: "7", delta: 0, hint: "3 marcas" },
];

/** Ventas mensuales (USD) para el gráfico de barras. */
export const SALES_BY_MONTH: { month: string; value: number }[] = [
  { month: "Ene", value: 310000 },
  { month: "Feb", value: 280000 },
  { month: "Mar", value: 395000 },
  { month: "Abr", value: 350000 },
  { month: "May", value: 432000 },
  { month: "Jun", value: 486000 },
];

export const UNITS_BY_STATUS: { status: UnitStatus; count: number }[] = [
  { status: "DISPONIBLE", count: 143 },
  { status: "RESERVADO", count: 38 },
  { status: "VENDIDO", count: 121 },
  { status: "BLOQUEADO", count: 18 },
];

export interface RecentSale {
  id: string;
  unitCode: string;
  brand: Brand;
  executive: string;
  totalPrice: string;
  currency: string;
  status: SaleStatus;
  contractDate: string;
}

export const RECENT_SALES: RecentSale[] = [
  { id: "31", unitCode: "L-014", brand: "VISTA_VERDE", executive: "María Gonzales", totalPrice: "25000", currency: "USD", status: "EN_PROCESO", contractDate: "2026-06-16" },
  { id: "30", unitCode: "V-007", brand: "ISABELLA_CONDOMINIO", executive: "Carlos Rojas", totalPrice: "89500", currency: "USD", status: "COMPLETADA", contractDate: "2026-06-15" },
  { id: "29", unitCode: "L-022", brand: "VISTA_VERDE", executive: "Lucía Méndez", totalPrice: "31200", currency: "USD", status: "COMPLETADA", contractDate: "2026-06-14" },
  { id: "28", unitCode: "V-003", brand: "GONZALES_CONSTRUCTORA", executive: "Carlos Rojas", totalPrice: "115000", currency: "USD", status: "CANCELADA", contractDate: "2026-06-12" },
  { id: "27", unitCode: "L-009", brand: "VISTA_VERDE", executive: "María Gonzales", totalPrice: "27800", currency: "USD", status: "EN_PROCESO", contractDate: "2026-06-11" },
];

export interface ActivityItem {
  id: string;
  actor: string;
  action: string;
  target: string;
  createdAt: string;
}

export const RECENT_ACTIVITY: ActivityItem[] = [
  { id: "101", actor: "María Gonzales", action: "registró una venta", target: "Unidad L-014", createdAt: new Date(Date.now() - 1000 * 60 * 8).toISOString() },
  { id: "100", actor: "Admin Nego", action: "actualizó permisos del rol", target: "Jefe Comercial", createdAt: new Date(Date.now() - 1000 * 60 * 47).toISOString() },
  { id: "99", actor: "Carlos Rojas", action: "reservó", target: "Unidad V-012", createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString() },
  { id: "98", actor: "Lucía Méndez", action: "creó el proyecto", target: "Vista Verde Etapa III", createdAt: new Date(Date.now() - 1000 * 60 * 60 * 9).toISOString() },
  { id: "97", actor: "Agente IA", action: "registró un lead nuevo desde", target: "WhatsApp", createdAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString() },
];
