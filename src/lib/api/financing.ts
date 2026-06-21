/** Servicio del módulo Financiamiento (ver flujos: financiamiento/*.md). */
import { http } from "./http";
import { ENDPOINTS } from "./config";
import type {
  Paginated,
  FinancingPlan,
  FinancingPlanType,
  DownPaymentType,
  InstallmentFrequency,
} from "./types";
import type { ListQuery } from "@/lib/hooks/use-list";

export interface CreateFinancingPlanInput {
  name: string;
  description?: string;
  type: FinancingPlanType;
  currency?: string;
  downPaymentType: DownPaymentType;
  downPaymentRequired?: number;
  downPaymentPercent?: number;
  installmentsCount?: number;
  installmentAmount?: number;
  frequency?: InstallmentFrequency;
  termMonths?: number;
  interestRate?: number;
  cashDiscountPercent?: number;
  minAmount?: number;
}

export type UpdateFinancingPlanInput = Partial<CreateFinancingPlanInput> & {
  isActive?: boolean;
};

/** sortBy permitidos por el backend. */
export const FINANCING_SORT_FIELDS = [
  "name",
  "type",
  "createdAt",
  "updatedAt",
] as const;

const byId = (id: string) =>
  `${ENDPOINTS.financingPlans}/${encodeURIComponent(id)}`;

export function listFinancingPlans(
  query: ListQuery,
  signal?: AbortSignal
): Promise<Paginated<FinancingPlan>> {
  // Clamp del sortBy al allowlist (evita 400 si una columna futura usa un sortKey no permitido).
  const sortBy = (FINANCING_SORT_FIELDS as readonly string[]).includes(
    query.sortBy ?? ""
  )
    ? query.sortBy
    : "createdAt";
  return http.get<Paginated<FinancingPlan>>(ENDPOINTS.financingPlans, {
    query: { ...query, sortBy },
    signal,
  });
}

export function getFinancingPlan(
  id: string,
  signal?: AbortSignal
): Promise<FinancingPlan> {
  return http.get<FinancingPlan>(byId(id), { signal });
}

export function createFinancingPlan(
  body: CreateFinancingPlanInput
): Promise<FinancingPlan> {
  return http.post<FinancingPlan>(ENDPOINTS.financingPlans, body);
}

export function updateFinancingPlan(
  id: string,
  body: UpdateFinancingPlanInput
): Promise<FinancingPlan> {
  return http.patch<FinancingPlan>(byId(id), body);
}

export function deleteFinancingPlan(id: string): Promise<{ message: string }> {
  return http.del<{ message: string }>(byId(id));
}

/* Acciones dedicadas (POST sin body). */
export function activateFinancingPlan(id: string): Promise<FinancingPlan> {
  return http.post<FinancingPlan>(`${byId(id)}/activate`);
}

export function deactivateFinancingPlan(id: string): Promise<FinancingPlan> {
  return http.post<FinancingPlan>(`${byId(id)}/deactivate`);
}

export function cloneFinancingPlan(id: string): Promise<FinancingPlan> {
  return http.post<FinancingPlan>(`${byId(id)}/clone`);
}

/* Opciones de financiamiento de una unidad (ver flujos: financiamiento/07).
   GET devuelve los planes asociados; PUT es REEMPLAZO TOTAL: recibe el set
   completo de planIds que debe quedar ([] = sin planes, máx 50). */
const unitOptionsUrl = (unitId: string) =>
  `${ENDPOINTS.units}/${encodeURIComponent(unitId)}/financing-options`;

export function getUnitFinancingOptions(
  unitId: string,
  signal?: AbortSignal
): Promise<FinancingPlan[]> {
  return http.get<FinancingPlan[]>(unitOptionsUrl(unitId), { signal });
}

export function setUnitFinancingOptions(
  unitId: string,
  planIds: string[]
): Promise<FinancingPlan[]> {
  return http.put<FinancingPlan[]>(unitOptionsUrl(unitId), { planIds });
}
