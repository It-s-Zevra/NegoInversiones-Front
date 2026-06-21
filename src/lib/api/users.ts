/** Servicio del módulo Usuarios (RBAC). */
import { http } from "./http";
import { ENDPOINTS } from "./config";
import type { Paginated, User } from "./types";
import type { ListQuery } from "@/lib/hooks/use-list";

export interface CreateUserInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  roleId: string;
  phone?: string;
  department?: string;
  img?: string;
}

export type UpdateUserInput = Partial<CreateUserInput> & {
  isActive?: boolean;
};

export const USER_SORT_FIELDS = [
  "firstName",
  "lastName",
  "email",
  "createdAt",
] as const;

const byId = (id: string) => `${ENDPOINTS.users}/${encodeURIComponent(id)}`;

export function listUsers(
  query: ListQuery,
  signal?: AbortSignal
): Promise<Paginated<User>> {
  return http.get<Paginated<User>>(ENDPOINTS.users, { query, signal });
}

export function getUser(id: string, signal?: AbortSignal): Promise<User> {
  return http.get<User>(byId(id), { signal });
}

export function createUser(body: CreateUserInput): Promise<User> {
  return http.post<User>(ENDPOINTS.users, body);
}

export function updateUser(id: string, body: UpdateUserInput): Promise<User> {
  return http.patch<User>(byId(id), body);
}

export function deleteUser(id: string): Promise<{ message: string }> {
  return http.del<{ message: string }>(byId(id));
}
