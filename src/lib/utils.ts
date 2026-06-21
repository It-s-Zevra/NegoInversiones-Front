import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Combina clases de Tailwind resolviendo conflictos. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Devuelve la URL solo si es absoluta y https (rechaza javascript:/data:/http/
 * relativas y strings no-URL). El backend valida imgUrl con @IsString (sin URL),
 * así que el front no debe renderizar valores arbitrarios en <img src>.
 */
export function safeImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}
