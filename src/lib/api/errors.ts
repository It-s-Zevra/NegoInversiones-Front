import { ApiException } from "./http";

/** Mensaje amigable (es) para un error de la API. Reutilizable en toda la UI. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiException) {
    if (err.isNetworkError)
      return "No se pudo conectar con el servidor. Revisa tu conexión.";
    switch (err.statusCode) {
      case 400:
        return err.messages[0] ?? "Revisa los datos e inténtalo de nuevo.";
      case 401:
        return "Tu sesión expiró. Vuelve a iniciar sesión.";
      case 403:
        return "No tienes permiso para realizar esta acción.";
      case 404:
        return err.messages[0] ?? "No se encontró el recurso.";
      case 409:
        return err.messages[0] ?? "Conflicto con el estado actual.";
      case 422:
        return err.messages[0] ?? "No se pudo procesar la solicitud.";
      case 429:
        return "Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.";
      case 503:
        return "El servicio no está disponible en este momento. Inténtalo más tarde.";
      case 500:
        return "Algo salió mal en el servidor. Inténtalo de nuevo.";
      default:
        return err.messages[0] ?? "Ocurrió un error. Inténtalo de nuevo.";
    }
  }
  return "Ocurrió un error inesperado. Inténtalo de nuevo.";
}

/**
 * Reparte los mensajes de un 400 de validación entre los campos del formulario.
 * Heurística por substring del nombre de campo (los mensajes vienen en inglés).
 * Devuelve { fieldErrors, rest } donde `rest` son mensajes no asignados.
 */
export function mapValidationErrors(
  err: ApiException,
  fields: string[]
): { fieldErrors: Record<string, string>; rest: string[] } {
  const fieldErrors: Record<string, string> = {};
  const rest: string[] = [];
  for (const message of err.messages) {
    const low = message.toLowerCase();
    const field = fields.find((f) => low.startsWith(f.toLowerCase()));
    if (field && !fieldErrors[field]) fieldErrors[field] = message;
    else rest.push(message);
  }
  return { fieldErrors, rest };
}
