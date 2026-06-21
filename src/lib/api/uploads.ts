/** Servicio de Uploads (imágenes a Cloudinary, base64). */
import { http } from "./http";
import { ENDPOINTS } from "./config";

export type UploadFolder = "projects" | "units" | "general";

export function uploadImage(
  imageBase64: string,
  folder: UploadFolder = "general"
): Promise<{ url: string }> {
  return http.post<{ url: string }>(`${ENDPOINTS.uploads}/image`, {
    imageBase64,
    folder,
  });
}

export function uploadImages(
  imagesBase64: string[],
  folder: UploadFolder = "units"
): Promise<{ urls: string[] }> {
  return http.post<{ urls: string[] }>(`${ENDPOINTS.uploads}/images`, {
    imagesBase64,
    folder,
  });
}
