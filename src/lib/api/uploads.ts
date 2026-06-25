/** Servicio de Uploads (media a Cloudinary, base64). Ver uploads/01-subir-imagenes.md */
import { http } from "./http";
import { ENDPOINTS } from "./config";

export type UploadFolder = "projects" | "units" | "documents" | "general";

export function uploadImage(
  imageBase64: string,
  folder: UploadFolder = "general"
): Promise<{ url: string }> {
  return http.post<{ url: string }>(`${ENDPOINTS.uploads}/image`, {
    imageBase64,
    folder,
  });
}

/** Galería: hasta 20 imágenes en una llamada; urls en el mismo orden. */
export function uploadImages(
  imagesBase64: string[],
  folder: UploadFolder = "units"
): Promise<{ urls: string[] }> {
  return http.post<{ urls: string[] }>(`${ENDPOINTS.uploads}/images`, {
    imagesBase64,
    folder,
  });
}

export function uploadDocument(
  documentBase64: string,
  folder: UploadFolder = "documents"
): Promise<{ url: string }> {
  return http.post<{ url: string }>(`${ENDPOINTS.uploads}/document`, {
    documentBase64,
    folder,
  });
}

export function uploadDocuments(
  documentsBase64: string[],
  folder: UploadFolder = "documents"
): Promise<{ urls: string[] }> {
  return http.post<{ urls: string[] }>(`${ENDPOINTS.uploads}/documents`, {
    documentsBase64,
    folder,
  });
}
