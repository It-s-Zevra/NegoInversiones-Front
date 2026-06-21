/** Servicio del módulo Ventas (ver flujos: ventas/*.md). */
import { http } from "./http";
import { ENDPOINTS } from "./config";
import type { Paginated, Sale, SaleStatus } from "./types";
import type { ListQuery } from "@/lib/hooks/use-list";

export interface CreateSaleInput {
  leadId: string;
  projectId: string;
  unitId?: string;
  executiveId?: string;
  status?: SaleStatus;
  totalPrice: number;
  currency?: string;
  downPayment?: number;
  contractDate?: string; // YYYY-MM-DD
  financingTermMonths?: number;
  interestRate?: number;
  agreements?: string;
}

/** En edición no se pueden reasignar leadId ni projectId (UpdateSaleDto los excluye). */
export type UpdateSaleInput = Partial<
  Omit<CreateSaleInput, "leadId" | "projectId">
>;

/** sortBy permitidos por el backend para el listado de ventas. */
export const SALE_SORT_FIELDS = [
  "createdAt",
  "contractDate",
  "totalPrice",
  "status",
] as const;

export function listSales(
  query: ListQuery,
  signal?: AbortSignal
): Promise<Paginated<Sale>> {
  return http.get<Paginated<Sale>>(ENDPOINTS.sales, { query, signal });
}

export function getSale(id: string, signal?: AbortSignal): Promise<Sale> {
  return http.get<Sale>(`${ENDPOINTS.sales}/${encodeURIComponent(id)}`, {
    signal,
  });
}

export function createSale(body: CreateSaleInput): Promise<Sale> {
  return http.post<Sale>(ENDPOINTS.sales, body);
}

export function updateSale(id: string, body: UpdateSaleInput): Promise<Sale> {
  return http.patch<Sale>(`${ENDPOINTS.sales}/${encodeURIComponent(id)}`, body);
}

export function deleteSale(id: string): Promise<{ message: string }> {
  return http.del<{ message: string }>(
    `${ENDPOINTS.sales}/${encodeURIComponent(id)}`
  );
}
