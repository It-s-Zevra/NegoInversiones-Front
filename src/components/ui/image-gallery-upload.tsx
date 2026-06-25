"use client";

import { useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { Button } from "./button";
import { Spinner } from "./spinner";
import { useToast } from "./toast";
import { uploadImages, type UploadFolder } from "@/lib/api/uploads";
import { errorMessage } from "@/lib/api/errors";
import { safeImageUrl } from "@/lib/utils";

interface Props {
  value: string[];
  onChange: (urls: string[]) => void;
  folder?: UploadFolder;
  /** Máximo de imágenes (el backend acepta lotes de 20). */
  max?: number;
  id?: string;
}

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("read"));
    reader.readAsDataURL(file);
  });

/** Galería multi-imagen (base64 → Cloudinary). Sube en lote (máx. 20 por llamada). */
export function ImageGalleryUpload({
  value,
  onChange,
  folder = "units",
  max = 20,
  id,
}: Props) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const room = max - value.length;
    if (room <= 0) {
      toast({ tone: "error", title: `Máximo ${max} imágenes.` });
      return;
    }
    // El endpoint acepta hasta 20 por llamada; respetamos el espacio restante.
    const all = Array.from(files).slice(0, Math.min(room, 20));
    const batch = all.filter((f) => f.size <= 10 * 1024 * 1024);
    if (batch.length < all.length) {
      toast({ tone: "error", title: "Algunas imágenes superan 10 MB y se omitieron." });
    }
    if (batch.length === 0) {
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setUploading(true);
    try {
      const base64s = await Promise.all(batch.map(fileToBase64));
      const { urls } = await uploadImages(base64s, folder);
      onChange([...value, ...urls]);
      toast({ tone: "success", title: `${urls.length} imagen(es) subida(s)` });
    } catch (err) {
      toast({ tone: "error", title: "No se pudieron subir", description: errorMessage(err) });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function removeAt(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-3">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {value.map((url, i) => (
            <li key={`${url}-${i}`} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={safeImageUrl(url) || url}
                alt={`Imagen ${i + 1}`}
                className="h-20 w-20 rounded-lg border border-border object-cover"
              />
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-danger text-danger-foreground shadow"
                aria-label={`Quitar imagen ${i + 1}`}
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={uploading || value.length >= max}
          onClick={() => inputRef.current?.click()}
          aria-busy={uploading}
        >
          {uploading ? <Spinner /> : <ImagePlus className="h-4 w-4" />}
          Agregar imágenes
        </Button>
        <span className="text-xs text-subtle">
          {value.length}/{max}
        </span>
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>
    </div>
  );
}
