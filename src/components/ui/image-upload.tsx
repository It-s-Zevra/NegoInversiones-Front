"use client";

import { useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { Button } from "./button";
import { Input } from "./input";
import { Spinner } from "./spinner";
import { useToast } from "./toast";
import { uploadImage, type UploadFolder } from "@/lib/api/uploads";
import { errorMessage } from "@/lib/api/errors";

interface Props {
  value: string;
  onChange: (url: string) => void;
  folder?: UploadFolder;
  id?: string;
}

/** Sube una imagen (base64 → Cloudinary) o permite pegar la URL manualmente. */
export function ImageUpload({ value, onChange, folder = "general", id }: Props) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("read"));
        reader.readAsDataURL(file);
      });
      const { url } = await uploadImage(base64, folder);
      onChange(url);
      toast({ tone: "success", title: "Imagen subida" });
    } catch (err) {
      toast({ tone: "error", title: "No se pudo subir", description: errorMessage(err) });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-16 w-16 rounded-lg border border-border object-cover" />
        ) : (
          <div className="grid h-16 w-16 place-items-center rounded-lg border border-dashed border-border-strong text-subtle">
            <Upload className="h-5 w-5" />
          </div>
        )}
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" size="sm" disabled={uploading}
            onClick={() => inputRef.current?.click()} aria-busy={uploading}>
            {uploading ? <Spinner /> : <Upload className="h-4 w-4" />}
            {value ? "Cambiar" : "Subir"}
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>
              <X className="h-4 w-4" />
              Quitar
            </Button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="…o pega una URL (https://res.cloudinary.com/…)"
      />
    </div>
  );
}
