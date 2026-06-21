/** Servicio del módulo Conocimiento (KB): entradas, categorías, tags y borrador IA. */
import { http } from "./http";
import { ENDPOINTS } from "./config";
import type {
  Paginated,
  KbEntry,
  KbCategory,
  KbTag,
  Brand,
} from "./types";
import type { ListQuery } from "@/lib/hooks/use-list";

export interface CreateKbEntryInput {
  title: string;
  content: string;
  categoryId?: string;
  projectId?: string;
  brand?: Brand;
  priority?: number;
  isActive?: boolean;
  tagIds?: string[];
  mediaUrls?: string[];
}
export type UpdateKbEntryInput = Partial<CreateKbEntryInput>;

export const KB_SORT_FIELDS = [
  "priority",
  "title",
  "createdAt",
  "updatedAt",
] as const;

export const KB_CATEGORY_CODE_RE = /^[A-Z0-9_]+$/;

const entryById = (id: string) =>
  `${ENDPOINTS.knowledgeBase}/${encodeURIComponent(id)}`;

export function listKbEntries(
  query: ListQuery,
  signal?: AbortSignal
): Promise<Paginated<KbEntry>> {
  return http.get<Paginated<KbEntry>>(ENDPOINTS.knowledgeBase, { query, signal });
}

export function getKbEntry(id: string, signal?: AbortSignal): Promise<KbEntry> {
  return http.get<KbEntry>(entryById(id), { signal });
}

export function createKbEntry(body: CreateKbEntryInput): Promise<KbEntry> {
  return http.post<KbEntry>(ENDPOINTS.knowledgeBase, body);
}

export function updateKbEntry(
  id: string,
  body: UpdateKbEntryInput
): Promise<KbEntry> {
  return http.patch<KbEntry>(entryById(id), body);
}

export function deleteKbEntry(id: string): Promise<{ message: string }> {
  return http.del<{ message: string }>(entryById(id));
}

export interface AiDraftInput {
  topic: string;
  existingContent?: string;
  categoryCode?: string;
  brand?: Brand;
  instructions?: string;
}
export function aiDraft(
  body: AiDraftInput
): Promise<{ title: string; content: string }> {
  return http.post<{ title: string; content: string }>(
    `${ENDPOINTS.knowledgeBase}/ai-draft`,
    body
  );
}

/* Categorías */
export function listKbCategories(signal?: AbortSignal): Promise<KbCategory[]> {
  return http.get<KbCategory[]>(ENDPOINTS.kbCategories, { signal });
}
export function createKbCategory(body: {
  code: string;
  name: string;
}): Promise<KbCategory> {
  return http.post<KbCategory>(ENDPOINTS.kbCategories, body);
}
export function updateKbCategory(
  id: string,
  body: { code?: string; name?: string }
): Promise<KbCategory> {
  return http.patch<KbCategory>(
    `${ENDPOINTS.kbCategories}/${encodeURIComponent(id)}`,
    body
  );
}
export function deleteKbCategory(id: string): Promise<{ message: string }> {
  return http.del<{ message: string }>(
    `${ENDPOINTS.kbCategories}/${encodeURIComponent(id)}`
  );
}

/* Tags (sin edición; solo crear/eliminar) */
export function listKbTags(signal?: AbortSignal): Promise<KbTag[]> {
  return http.get<KbTag[]>(ENDPOINTS.kbTags, { signal });
}
export function createKbTag(body: { name: string }): Promise<KbTag> {
  return http.post<KbTag>(ENDPOINTS.kbTags, body);
}
export function deleteKbTag(id: string): Promise<{ message: string }> {
  return http.del<{ message: string }>(
    `${ENDPOINTS.kbTags}/${encodeURIComponent(id)}`
  );
}
